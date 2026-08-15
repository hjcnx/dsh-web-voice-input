window.__ModuleLoader__.load({
	id: "dsh-web-voice-input",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		const { jsx, jsxs } = react_jsx_runtime;

		/** Locale namespace this plugin owns. */
		const NS = "voice-input";
		const zh = {
			"button.label": "语音输入",
			"status.recording": "录音中…",
			"status.transcribing": "识别中…",
			"status.error": "识别失败，点击重试",
			"error.mic": "无法访问麦克风",
			"error.empty": "没有识别到内容",
			"error.hintDirect": "（直连模式网络/CORS 错误：请确认代理可用，或在配置中改为 direct: false 走宿主转发）"
		};
		const en = {
			"button.label": "Voice input",
			"status.recording": "Recording…",
			"status.transcribing": "Transcribing…",
			"status.error": "Failed, click to retry",
			"error.mic": "Microphone unavailable",
			"error.empty": "No speech recognized",
			"error.hintDirect": " (direct-mode network/CORS error: check your proxy, or set direct: false to route through the host)"
		};

		/** Plugin CSS, injected once per page. */
		const css = [
			".dvi-btn{box-sizing:border-box;height:28px;min-width:28px;padding:0 8px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-tertiary);display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;font-family:var(--dsw-font-family);font-size:12px;line-height:1}",
			".dvi-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}",
			".dvi-btn:disabled{cursor:default;opacity:.7}",
			".dvi-btn svg{width:16px;height:16px;flex:none}",
			".dvi-btn.dvi-recording{color:#f04438}",
			".dvi-btn.dvi-error{color:#f04438}",
			".dvi-dot{width:8px;height:8px;border-radius:50%;background:currentColor;flex:none;animation:dvi-pulse 1.2s ease-in-out infinite}",
			"@keyframes dvi-pulse{0%,100%{opacity:1}50%{opacity:.3}}",
			".dvi-spin{animation:dvi-rotate 1s linear infinite}",
			"@keyframes dvi-rotate{to{transform:rotate(360deg)}}",
			".dvi-status{white-space:nowrap}",
			".dvi-bang{font-weight:700;font-size:13px}"
		].join("");
		const cssTagId = "dsh-web-voice-input/style.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(cssTagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-web-voice-input";
			tag.dataset.pluginCss = cssTagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		/** Pick the first mime type this browser can record that Groq accepts. */
		function pickMime() {
			if (typeof MediaRecorder === "undefined") return "";
			const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg"];
			for (const type of candidates) if (MediaRecorder.isTypeSupported(type)) return type;
			return "";
		}

		/** Map a browser content-type to an upload filename the ASR API accepts. */
		function fileExtFor(type) {
			const mediaType = (type || "").split(";")[0].trim().toLowerCase();
			if (mediaType === "audio/webm") return "audio.webm";
			if (mediaType === "audio/mp4") return "audio.m4a";
			if (mediaType === "audio/ogg") return "audio.ogg";
			if (mediaType === "audio/mpeg" || mediaType === "audio/mp3") return "audio.mp3";
			if (mediaType === "audio/wav" || mediaType === "audio/x-wav") return "audio.wav";
			return "audio.webm";
		}

		function messageOf(error) {
			return error instanceof Error ? error.message : String(error);
		}

		function MicIcon() {
			return jsx("svg", {
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "2",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": true,
				children: jsxs("g", {
					children: [
						jsx("path", { d: "M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" }),
						jsx("path", { d: "M19 10v1a7 7 0 0 1-14 0v-1" }),
						jsx("path", { d: "M12 18v3" })
					]
				})
			});
		}

		function SpinnerIcon() {
			return jsx("svg", {
				className: "dvi-spin",
				viewBox: "0 0 24 24",
				fill: "none",
				"aria-hidden": true,
				children: jsxs("g", {
					children: [
						jsx("circle", {
							cx: "12",
							cy: "12",
							r: "9",
							stroke: "currentColor",
							strokeOpacity: "0.25",
							strokeWidth: "3"
						}),
						jsx("path", {
							d: "M21 12a9 9 0 0 0-9-9",
							stroke: "currentColor",
							strokeWidth: "3",
							strokeLinecap: "round"
						})
					]
				})
			});
		}

		/**
		 * The composer microphone button. Rendered inside the session-scoped
		 * `conversation.input.left` slot, so the slot framework supplies the
		 * standard kit: `inputActions` (the input machine's public verbs, incl.
		 * setDraft) and `useInput` (selector over the machine snapshot).
		 */
		function VoiceButton({ t, inputActions, useInput }) {
			const [phase, setPhase] = react.useState("idle"); // idle | recording | transcribing | error
			const [errorText, setErrorText] = react.useState("");
			const recorderRef = react.useRef(null);
			const chunksRef = react.useRef([]);
			const timerRef = react.useRef(void 0);
			const cfgRef = react.useRef(null);
			const aliveRef = react.useRef(true);
			const directModeRef = react.useRef(false);
			const draft = useInput === void 0 ? "" : useInput((snapshot) => snapshot?.draft ?? "");
			const draftRef = react.useRef(draft);
			draftRef.current = draft;

			// Stop any in-flight recording when this button unmounts (e.g. the
			// session switched mid-recording); skip the transcription of a
			// recording that outlived its composer.
			react.useEffect(() => () => {
				aliveRef.current = false;
				if (timerRef.current !== void 0) clearTimeout(timerRef.current);
				const recorder = recorderRef.current;
				if (recorder !== null && recorder.state === "recording") {
					try {
						recorder.stop();
					} catch {}
				}
			}, []);

			async function transcribe(mimeType) {
				const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
				try {
					const cfg = cfgRef.current;
					if (cfg === null) throw new Error("voice-input: config unavailable");
					let text = "";
					if (cfg.mock !== null && cfg.mock !== void 0 && cfg.mock !== "") {
						// Offline test seam: the host answers with canned text.
						text = String(cfg.mock).trim();
					} else if (cfg.direct) {
						// Browser-direct mode: call the ASR API from the browser so the
						// request rides the browser's network stack (system proxy included).
						directModeRef.current = true;
						const form = new FormData();
						form.append("file", blob, fileExtFor(blob.type));
						form.append("model", cfg.model);
						if (cfg.language !== null && cfg.language !== void 0 && cfg.language !== "") form.append("language", cfg.language);
						form.append("response_format", "json");
						const upstream = await fetch(cfg.baseUrl, {
							method: "POST",
							headers: { authorization: `Bearer ${cfg.apiKey}` },
							body: form
						});
						let payload = {};
						try {
							payload = await upstream.json();
						} catch {}
						if (!upstream.ok) throw new Error(payload?.error?.message ?? payload?.error ?? `HTTP ${upstream.status}`);
						text = typeof payload?.text === "string" ? payload.text.trim() : "";
					} else {
						// Host-proxy mode: the local host forwards the audio upstream.
						const response = await fetch("/api/voice-input/transcribe", {
							method: "POST",
							headers: { "content-type": blob.type || "audio/webm" },
							body: blob
						});
						let payload = {};
						try {
							payload = await response.json();
						} catch {}
						if (!response.ok) throw new Error(payload?.error !== void 0 && payload.error !== "" ? payload.error : `HTTP ${response.status}`);
						text = typeof payload?.text === "string" ? payload.text.trim() : "";
					}
					if (!aliveRef.current) return;
					if (text !== "") {
						const base = draftRef.current ?? "";
						const next = base !== "" ? `${base} ${text}` : text;
						inputActions?.setDraft(next);
						if (cfg.autoSend === true) inputActions?.submit();
						// Put the caret back into the composer so typing continues.
						if (typeof document !== "undefined") {
							const editor = document.querySelector("textarea[data-phase]");
							if (editor !== null) {
								try {
									editor.focus();
								} catch {}
							}
						}
						setPhase("idle");
						return;
					}
					setErrorText(t("error.empty"));
					setPhase("error");
				} catch (error) {
					if (!aliveRef.current) return;
					let message = messageOf(error);
					if (directModeRef.current && error instanceof TypeError) {
						message = `${message}${t("error.hintDirect")}`;
					}
					setErrorText(message);
					setPhase("error");
				}
			}

			async function start() {
				if (typeof navigator === "undefined" || navigator.mediaDevices?.getUserMedia === void 0) {
					setErrorText(t("error.mic"));
					setPhase("error");
					return;
				}
				try {
					// Fetch the config before recording so maxDurationSec can arm the
					// auto-stop timer; transcribe reuses the same snapshot.
					const cfgResponse = await fetch("/api/voice-input/config");
					if (!cfgResponse.ok) throw new Error(`config fetch failed: HTTP ${cfgResponse.status}`);
					const cfg = await cfgResponse.json();
					if (!aliveRef.current) return;
					cfgRef.current = cfg;
					const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
					if (!aliveRef.current) {
						stream.getTracks().forEach((track) => track.stop());
						return;
					}
					const mime = pickMime();
					const recorder = new MediaRecorder(stream, mime !== "" ? { mimeType: mime } : void 0);
					chunksRef.current = [];
					recorder.addEventListener("dataavailable", (event) => {
						if (event.data !== void 0 && event.data.size > 0) chunksRef.current.push(event.data);
					});
					recorder.addEventListener("stop", () => {
						stream.getTracks().forEach((track) => track.stop());
						if (aliveRef.current) void transcribe(mime !== "" ? mime : recorder.mimeType || "audio/webm");
					});
					recorder.start();
					recorderRef.current = recorder;
					const maxSec = typeof cfg.maxDurationSec === "number" && cfg.maxDurationSec > 0 ? cfg.maxDurationSec : 60;
					timerRef.current = setTimeout(() => {
						if (aliveRef.current) stop();
					}, maxSec * 1000);
					setErrorText("");
					setPhase("recording");
				} catch (error) {
					if (!aliveRef.current) return;
					setErrorText(`${t("error.mic")}: ${messageOf(error)}`);
					setPhase("error");
				}
			}

			function stop() {
				if (timerRef.current !== void 0) {
					clearTimeout(timerRef.current);
					timerRef.current = void 0;
				}
				setPhase("transcribing");
				try {
					recorderRef.current?.stop();
				} catch {
					setPhase("error");
					setErrorText(t("error.mic"));
				}
			}

			function onClick() {
				if (phase === "transcribing") return;
				if (phase === "recording") {
					stop();
					return;
				}
				setErrorText("");
				void start();
			}

			if (inputActions === void 0) return null;
			const className = ["dvi-btn", phase === "recording" ? "dvi-recording" : "", phase === "error" ? "dvi-error" : ""].filter((part) => part !== "").join(" ");
			const title = errorText !== "" ? errorText : t(phase === "recording" ? "status.recording" : "button.label");
			let glyph;
			if (phase === "transcribing") glyph = SpinnerIcon();
			else if (phase === "recording") glyph = jsx("span", { className: "dvi-dot" });
			else if (phase === "error") glyph = jsx("span", { className: "dvi-bang", children: "!" });
			else glyph = MicIcon();
			return jsxs("button", {
				type: "button",
				className,
				title,
				"aria-label": t("button.label"),
				"aria-pressed": phase === "recording",
				disabled: phase === "transcribing",
				onClick,
				children: [glyph, phase !== "idle" ? jsx("span", { className: "dvi-status", children: t("status." + phase) }) : null]
			});
		}

		/** Required services (fiber inject waiting — the runtime must be up first). */
		const inject = ["slots", "locale"];

		/**
		 * Mount the voice input plugin.
		 * @param ctx - client root context (services: slots, locale).
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "voice-input: dictionaries");
			ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
				name: "conversation.input.left",
				id: "voice-input",
				order: 20,
				locale: NS,
				inject: () => ({})
			}, VoiceButton));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
