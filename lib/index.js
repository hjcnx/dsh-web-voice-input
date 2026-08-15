// dsh-web-voice-input — host half.
//
// Registers three loopback-only routes on the web server:
//   GET  /api/voice-input/config       effective config view (key masked)
//   POST /api/voice-input/config       save user settings (first-run setup form)
//   POST /api/voice-input/transcribe   forward recorded audio to the ASR API
//
// User-entered settings live in ~/.dsh/dsh-web-voice-input.json (atomic
// writes, 0600) so first-run setup in the browser never touches YAML.
// Config precedence: user store > plugin row config (cordis.patch.yml) >
// environment variables > defaults. The API key never appears in the client
// bundle; it is handed to the browser only in direct mode over loopback.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** Stable cordis plugin name. */
export const name = "dsh-web-voice-input";

/** Services required before the routes can mount. */
export const inject = ["webServer"];

/** ASR per-file upload limit (25 MB). MediaRecorder audio is far below this. */
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** Cap on JSON request bodies (the setup form payload is tiny). */
const MAX_JSON_BODY_BYTES = 64 * 1024;

/** OpenAI-compatible /audio/transcriptions providers. */
const PROVIDERS = {
	siliconflow: {
		url: "https://api.siliconflow.cn/v1/audio/transcriptions",
		defaultModel: "FunAudioLLM/SenseVoiceSmall",
		keyEnv: "SILICONFLOW_API_KEY"
	},
	groq: {
		url: "https://api.groq.com/openai/v1/audio/transcriptions",
		defaultModel: "whisper-large-v3-turbo",
		keyEnv: "GROQ_API_KEY"
	},
	openai: {
		url: "https://api.openai.com/v1/audio/transcriptions",
		defaultModel: "whisper-1",
		keyEnv: "OPENAI_API_KEY"
	},
	dashscope: {
		url: "https://dashscope.aliyuncs.com/compatible-mode/v1/audio/transcriptions",
		defaultModel: "qwen-audio-asr",
		keyEnv: "DASHSCOPE_API_KEY"
	}
};

/** Default provider for first-run users (mainland-China friendly). */
const DEFAULT_PROVIDER = "siliconflow";

/**
 * Loopback-only trust fence (same shape as dsh-ssh's routes): these endpoints
 * hold a paid API key, so LAN-exposed deployments must not serve them to
 * other machines.
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

/** First non-empty string among candidates. */
function firstNonEmpty(...candidates) {
	for (const candidate of candidates) {
		if (typeof candidate === "string" && candidate.trim() !== "") return candidate.trim();
	}
	return void 0;
}

/** Clamp one number option into [min, max], defaulting when absent/invalid. */
function clampNumber(value, min, max, fallback) {
	return typeof value === "number" && Number.isFinite(value) ? Math.min(Math.max(Math.round(value), min), max) : fallback;
}

/** User store location (config.storePath exists for tests/custom deployments). */
function storePath(config) {
	return typeof config?.storePath === "string" && config.storePath.trim() !== "" ? config.storePath.trim() : join(homedir(), ".dsh", "dsh-web-voice-input.json");
}

/** Load the user store (empty object when absent or unreadable). */
function loadStore(config) {
	try {
		const parsed = JSON.parse(readFileSync(storePath(config), "utf8"));
		if (typeof parsed === "object" && parsed !== null) return parsed;
	} catch {}
	return {};
}

/** Atomically persist the user store (0600, tmp + rename). */
function saveStore(config, data) {
	const path = storePath(config);
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	const tmp = `${path}.tmp`;
	writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
	renameSync(tmp, path);
}

/** Resolve effective config: store > row config > env > defaults. */
function resolveConfig(config) {
	const store = loadStore(config);
	const env = process.env;
	const rawProvider = firstNonEmpty(store.provider, config?.provider, env.STT_PROVIDER) ?? DEFAULT_PROVIDER;
	const providerName = rawProvider.toLowerCase();
	const provider = PROVIDERS[providerName];
	const apiKey = firstNonEmpty(store.apiKey, config?.apiKey, provider?.keyEnv === void 0 ? void 0 : env[provider.keyEnv], env.STT_API_KEY) ?? "";
	const keySource = apiKey === "" ? "none" : firstNonEmpty(store.apiKey) === apiKey ? "store" : firstNonEmpty(config?.apiKey) === apiKey ? "config" : "env";
	return {
		enabled: config?.enabled !== false,
		apiKey,
		keySource,
		providerName,
		unknownProvider: provider === void 0,
		baseUrl: firstNonEmpty(store.baseUrl, config?.baseUrl) ?? provider?.url ?? PROVIDERS[DEFAULT_PROVIDER].url,
		model: firstNonEmpty(store.model, config?.model) ?? provider?.defaultModel ?? PROVIDERS[DEFAULT_PROVIDER].defaultModel,
		language: firstNonEmpty(store.language, config?.language),
		// Browser-direct mode: the browser half fetches the provider config from
		// /api/voice-input/config and calls the ASR API itself, so the request
		// rides the browser's network stack (system proxy included). Host-proxy
		// mode (direct: false, the default) forwards server-side instead.
		direct: store.direct !== void 0 ? store.direct === true : config?.direct === true,
		// Hard cap on one recording (seconds); the browser half auto-stops at it.
		maxDurationSec: clampNumber(store.maxDurationSec ?? config?.maxDurationSec, 5, 300, 60),
		// Submit the draft automatically once transcription lands in the composer.
		autoSend: store.autoSend !== void 0 ? store.autoSend === true : config?.autoSend === true,
		// Offline test seam: when set to a non-empty string, the route answers
		// with it as the transcription result and never calls the upstream API.
		mock: typeof config?.mock === "string" && config.mock.trim() !== "" ? config.mock.trim() : void 0
	};
}

/** Masked key preview for the browser form ("sk-sd…mrrn"). */
function maskKey(key) {
	if (key.length <= 8) return "…";
	return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

/** The wire view the browser form reads (apiKey only when direct mode needs it). */
function configView(value) {
	return {
		direct: value.direct,
		provider: value.providerName,
		baseUrl: value.baseUrl,
		model: value.model,
		language: value.language ?? null,
		maxDurationSec: value.maxDurationSec,
		autoSend: value.autoSend,
		mock: value.mock ?? null,
		hasApiKey: value.apiKey !== "",
		keySource: value.keySource,
		...(value.apiKey !== "" ? { maskedApiKey: maskKey(value.apiKey) } : {}),
		...(value.direct && value.apiKey !== "" ? { apiKey: value.apiKey } : {})
	};
}

/** Best-effort key probe: GET <api-base>/models. true/false/null (unknown). */
async function probeKey(value) {
	try {
		const base = value.baseUrl.replace(/\/audio\/transcriptions\/?$/, "");
		const response = await fetch(`${base}/models`, {
			headers: { authorization: `Bearer ${value.apiKey}` },
			signal: AbortSignal.timeout(10_000)
		});
		return response.ok ? true : false;
	} catch {
		return null;
	}
}

/** Map a browser content-type to a file extension the ASR API accepts. */
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

/** Read a JSON request body (undefined when too large or unparseable). */
async function readJsonBody(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = chunk;
		size += buffer.length;
		if (size > MAX_JSON_BODY_BYTES) return void 0;
		chunks.push(buffer);
	}
	try {
		const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
		return typeof parsed === "object" && parsed !== null ? parsed : void 0;
	} catch {
		return void 0;
	}
}

/** GET /api/voice-input/config handler: the browser form's read surface. */
function handleConfigGet(req, res, config) {
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
	writeJson(res, 200, configView(value));
}

/**
 * POST /api/voice-input/config handler: the first-run setup form's write
 * surface. Saves into the user store; validation is best-effort and reported
 * as keyValid (true/false/null) without blocking the save.
 */
async function handleConfigPost(req, res, config) {
	if (!isLoopbackRequest(req)) {
		writeJson(res, 403, { error: "forbidden: loopback-only" });
		return;
	}
	if (req.method !== "POST") {
		writeJson(res, 405, { error: `method not allowed: ${req.method}` });
		return;
	}
	const body = await readJsonBody(req);
	if (body === void 0) {
		writeJson(res, 400, { error: "invalid JSON body" });
		return;
	}
	const next = { ...loadStore(config) };
	const bad = (message) => writeJson(res, 400, { error: message });
	if ("apiKey" in body) {
		if (body.apiKey === null || body.apiKey === "") delete next.apiKey;
		else if (typeof body.apiKey === "string") next.apiKey = body.apiKey.trim();
		else return bad("apiKey must be a string, null, or empty");
	}
	if ("provider" in body) {
		if (typeof body.provider !== "string" || body.provider.trim() === "") return bad("provider must be a non-empty string");
		const providerName = body.provider.trim().toLowerCase();
		if (PROVIDERS[providerName] === void 0) return bad(`unknown provider "${providerName}" — use one of: ${Object.keys(PROVIDERS).join(", ")}`);
		next.provider = providerName;
	}
	if ("baseUrl" in body) {
		if (body.baseUrl === null || body.baseUrl === "") delete next.baseUrl;
		else if (typeof body.baseUrl === "string") next.baseUrl = body.baseUrl.trim();
		else return bad("baseUrl must be a string, null, or empty");
	}
	if ("model" in body) {
		if (body.model === null || body.model === "") delete next.model;
		else if (typeof body.model === "string") next.model = body.model.trim();
		else return bad("model must be a string, null, or empty");
	}
	if ("language" in body) {
		if (body.language === null || body.language === "") delete next.language;
		else if (typeof body.language === "string") next.language = body.language.trim();
		else return bad("language must be a string, null, or empty");
	}
	if ("direct" in body) {
		if (typeof body.direct !== "boolean") return bad("direct must be a boolean");
		next.direct = body.direct;
	}
	if ("maxDurationSec" in body) {
		if (typeof body.maxDurationSec !== "number" || !Number.isFinite(body.maxDurationSec)) return bad("maxDurationSec must be a number");
		next.maxDurationSec = clampNumber(body.maxDurationSec, 5, 300, 60);
	}
	if ("autoSend" in body) {
		if (typeof body.autoSend !== "boolean") return bad("autoSend must be a boolean");
		next.autoSend = body.autoSend;
	}
	try {
		saveStore(config, next);
	} catch (error) {
		writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
		return;
	}
	const value = resolveConfig(config);
	if (value.unknownProvider) {
		writeJson(res, 500, { error: `voice-input: unknown provider "${value.providerName}"` });
		return;
	}
	const keyValid = value.apiKey === "" ? null : await probeKey(value);
	writeJson(res, 200, {
		ok: true,
		config: configView(value),
		keyValid
	});
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
		writeJson(res, 500, { error: `voice-input: no API key configured (open the first-run setup by clicking the microphone, or set config.apiKey on the voice-input row)` });
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
				message = `${message}（403 通常表示该服务商的 API key 未开通语音/音频模型权限或存在地区限制，请到服务商控制台检查，或在设置弹窗里更换 provider，例如 siliconflow）`;
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

/**
 * Mount the routes.
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
					handler: (req, res) => {
						if (req.method === "POST") void handleConfigPost(req, res, config ?? {});
						else handleConfigGet(req, res, config ?? {});
					}
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
		}, "dsh-web-voice-input: routes");
	};
	sync();
}
