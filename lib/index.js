// dsh-voice-input — host half.
//
// Registers POST /api/voice-input/transcribe on the web server: the browser
// half sends the raw recorded audio as the request body, this handler
// forwards it to an OpenAI-compatible /audio/transcriptions API
// (Groq / OpenAI / SiliconFlow, selected by config.provider) and returns
// { text }.
//
// The API key is resolved per request from the plugin row config
// (profile cordis.patch.yml) or the GROQ_API_KEY environment variable — it
// never appears in the client bundle.

/** Stable cordis plugin name. */
export const name = "dsh-voice-input";

/** Services required before the route can mount. */
export const inject = ["webServer"];

/** Groq per-file upload limit (25 MB). MediaRecorder audio is far below this. */
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** OpenAI-compatible /audio/transcriptions providers. */
const PROVIDERS = {
	groq: {
		url: "https://api.groq.com/openai/v1/audio/transcriptions",
		defaultModel: "whisper-large-v3-turbo"
	},
	openai: {
		url: "https://api.openai.com/v1/audio/transcriptions",
		defaultModel: "whisper-1"
	},
	siliconflow: {
		url: "https://api.siliconflow.cn/v1/audio/transcriptions",
		defaultModel: "FunAudioLLM/SenseVoiceSmall"
	}
};

/**
 * Loopback-only trust fence (same shape as dsh-ssh's routes): this endpoint
 * forwards audio with a paid API key, so LAN-exposed deployments must not
 * serve it to other machines.
 */
function isLoopbackRequest(request) {
	const address = request.socket.remoteAddress;
	if (address !== "127.0.0.1" && address !== "::1" && address !== "::ffff:127.0.0.1") return false;
	const host = request.headers.host;
	if (typeof host !== "string") return false;
	let hostUrl;
	try {
		hostUrl = new URL(`http://${host}`);
	} catch {
		return false;
	}
	if (hostUrl.hostname !== "127.0.0.1" && hostUrl.hostname !== "localhost" && hostUrl.hostname !== "[::1]") return false;
	if (request.headers["sec-fetch-site"] === "cross-site") return false;
	const origin = request.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}

/** One JSON response. */
function writeJson(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"referrer-policy": "no-referrer"
	});
	res.end(payload);
}

/** Resolve effective config from the row config + environment fallbacks. */
function resolveConfig(config) {
	const rawProvider = typeof config?.provider === "string" && config.provider.trim() !== "" ? config.provider.trim() : process.env.STT_PROVIDER || "groq";
	const providerName = rawProvider.toLowerCase();
	const provider = PROVIDERS[providerName];
	const apiKey = typeof config?.apiKey === "string" && config.apiKey.trim() !== "" ? config.apiKey.trim() : process.env.GROQ_API_KEY ?? "";
	return {
		enabled: config?.enabled !== false,
		apiKey,
		providerName,
		unknownProvider: provider === void 0,
		baseUrl: typeof config?.baseUrl === "string" && config.baseUrl.trim() !== "" ? config.baseUrl.trim() : provider?.url ?? PROVIDERS.groq.url,
		model: typeof config?.model === "string" && config.model.trim() !== "" ? config.model.trim() : provider?.defaultModel ?? PROVIDERS.groq.defaultModel,
		language: typeof config?.language === "string" && config.language.trim() !== "" ? config.language.trim() : void 0,
		// Browser-direct mode: the browser half fetches the provider config from
		// /api/voice-input/config and calls the ASR API itself, so the request
		// rides the browser's network stack (system proxy included). Host-proxy
		// mode (direct: false, the default) forwards server-side instead.
		direct: config?.direct === true,
		// Hard cap on one recording (seconds); the browser half auto-stops at it.
		maxDurationSec: typeof config?.maxDurationSec === "number" && Number.isFinite(config.maxDurationSec) ? Math.min(Math.max(Math.round(config.maxDurationSec), 5), 300) : 60,
		// Submit the draft automatically once transcription lands in the composer.
		autoSend: config?.autoSend === true,
		// Offline test seam: when set to a non-empty string, the route answers
		// with it as the transcription result and never calls the upstream API.
		mock: typeof config?.mock === "string" && config.mock.trim() !== "" ? config.mock.trim() : void 0
	};
}

/** Map a browser content-type to a file extension Groq will accept. */
function extensionOf(contentType) {
	const type = (contentType ?? "").split(";")[0].trim().toLowerCase();
	if (type === "audio/webm") return "audio.webm";
	if (type === "audio/ogg") return "audio.ogg";
	if (type === "audio/mp4") return "audio.m4a";
	if (type === "audio/mpeg" || type === "audio/mp3") return "audio.mp3";
	if (type === "audio/wav" || type === "audio/x-wav") return "audio.wav";
	return "audio.webm";
}

/**
 * Read the raw request body up to maxBytes.
 * @returns the buffer, or undefined when the body exceeds the cap.
 */
async function readBody(req, maxBytes) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = chunk;
		size += buffer.length;
		if (size > maxBytes) return void 0;
		chunks.push(buffer);
	}
	return Buffer.concat(chunks);
}

/** One POST /api/voice-input/transcribe handler. */
async function handleTranscribe(req, res, config) {
	if (!isLoopbackRequest(req)) {
		writeJson(res, 403, { error: "forbidden: loopback-only" });
		return;
	}
	if (req.method !== "POST") {
		writeJson(res, 405, { error: `method not allowed: ${req.method}` });
		return;
	}
	const value = resolveConfig(config);
	if (value.unknownProvider) {
		writeJson(res, 500, { error: `voice-input: unknown provider "${value.providerName}" — use one of: ${Object.keys(PROVIDERS).join(", ")}` });
		return;
	}
	if (value.mock !== void 0) {
		// Offline test seam (see resolveConfig): answer without the upstream call.
		writeJson(res, 200, { text: value.mock, language: void 0, mock: true });
		return;
	}
	if (value.apiKey === "") {
		writeJson(res, 500, { error: `voice-input: no API key configured (set config.apiKey on the voice-input row, or the GROQ_API_KEY environment variable)` });
		return;
	}
	const contentType = req.headers["content-type"] ?? "audio/webm";
	const body = await readBody(req, MAX_AUDIO_BYTES);
	if (body === void 0) {
		writeJson(res, 413, { error: `audio too large (limit ${MAX_AUDIO_BYTES} bytes)` });
		return;
	}
	if (body.length === 0) {
		writeJson(res, 400, { error: "empty audio body" });
		return;
	}
	const form = new FormData();
	form.append("file", new Blob([body], { type: contentType }), extensionOf(contentType));
	form.append("model", value.model);
	if (value.language !== void 0) form.append("language", value.language);
	form.append("response_format", "json");
	try {
		const upstream = await fetch(value.baseUrl, {
			method: "POST",
			headers: { authorization: `Bearer ${value.apiKey}` },
			body: form,
			signal: AbortSignal.timeout(180_000)
		});
		let payload = {};
		try {
			payload = await upstream.json();
		} catch {}
		if (!upstream.ok) {
			let message = payload?.error?.message ?? upstream.statusText ?? `HTTP ${upstream.status}`;
			if (upstream.status === 403) {
				message = `${message}（403 通常表示该服务商的 API key 未开通语音/音频模型权限或存在地区限制，请到服务商控制台检查，或在配置里更换 provider，例如 siliconflow）`;
			}
			writeJson(res, 502, { error: `${value.providerName}: ${message}` });
			return;
		}
		writeJson(res, 200, {
			text: typeof payload?.text === "string" ? payload.text : "",
			language: payload?.language
		});
	} catch (error) {
		writeJson(res, 502, { error: error instanceof Error ? error.message : String(error) });
	}
}

/** GET /api/voice-input/config handler: browser-direct mode's config source. */
function handleConfig(req, res, config) {
	if (!isLoopbackRequest(req)) {
		writeJson(res, 403, { error: "forbidden: loopback-only" });
		return;
	}
	if (req.method !== "GET") {
		writeJson(res, 405, { error: `method not allowed: ${req.method}` });
		return;
	}
	const value = resolveConfig(config);
	if (value.unknownProvider) {
		writeJson(res, 500, { error: `voice-input: unknown provider "${value.providerName}" — use one of: ${Object.keys(PROVIDERS).join(", ")}` });
		return;
	}
	writeJson(res, 200, {
		direct: value.direct,
		baseUrl: value.baseUrl,
		model: value.model,
		language: value.language ?? null,
		maxDurationSec: value.maxDurationSec,
		autoSend: value.autoSend,
		mock: value.mock ?? null,
		// The key is only handed to the browser when the browser makes the
		// upstream call itself; host-proxy mode keeps it server-side.
		...(value.direct && value.apiKey !== "" ? { apiKey: value.apiKey } : {})
	});
}

/**
 * Mount the transcription route.
 * @param ctx - host plugin context carrying webServer.
 * @param config - resolved plugin config (row config from the profile layer).
 */
export function apply(ctx, config) {
	let dispose;
	const sync = () => {
		if (dispose !== void 0) {
			dispose();
			dispose = void 0;
		}
		const value = resolveConfig(config ?? {});
		if (!value.enabled) return;
		dispose = ctx.effect(() => {
			const disposers = [
				ctx.webServer.register({
					kind: "exact",
					path: "/api/voice-input/config",
					handler: (req, res) => handleConfig(req, res, config ?? {})
				}),
				ctx.webServer.register({
					kind: "exact",
					path: "/api/voice-input/transcribe",
					handler: (req, res) => handleTranscribe(req, res, config ?? {})
				})
			];
			return () => {
				for (const unregister of disposers) unregister();
			};
		}, "dsh-voice-input: routes");
	};
	sync();
}
