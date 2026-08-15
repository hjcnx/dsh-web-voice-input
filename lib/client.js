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
			"error.hintDirect": "（直连模式网络/CORS 错误：请确认代理可用，或在设置中改为宿主转发）",
			"setup.title": "配置语音识别",
			"setup.intro": "首次使用需要配置一个语音识别服务的 API Key。",
			"setup.suggest": "还没有 Key？去 cloud.siliconflow.cn 免费注册申请（新用户有免费额度，中文识别效果好，国内直连）。",
			"setup.provider": "服务商",
			"setup.apiKey": "API Key",
			"setup.apiKeyPlaceholder": "粘贴你的 API Key",
			"setup.apiKeyMasked": "已配置（{key}），留空保持不变",
			"setup.model": "模型（留空用服务商默认）",
			"setup.language": "语言提示（如 zh/en，留空自动检测）",
			"setup.direct": "浏览器直连服务商（走系统代理）",
			"setup.maxDurationSec": "单次录音上限（秒）",
			"setup.autoSend": "转写完成后自动发送",
			"setup.save": "保存并开始录音",
			"setup.cancel": "取消",
			"setup.valid": "Key 验证通过 ✓",
			"setup.invalid": "Key 验证失败（已保存，可修改后重试）",
			"setup.unverified": "已保存（当前网络无法验证，稍后可重试）",
			"setup.saveFailed": "保存失败：{error}"
		};
		const en = {
			"button.label": "Voice input",
			"status.recording": "Recording…",
			"status.transcribing": "Transcribing…",
			"status.error": "Failed, click to retry",
			"error.mic": "Microphone unavailable",
			"error.empty": "No speech recognized",
			"error.hintDirect": " (direct-mode network/CORS error: check your proxy, or switch to host-proxy mode)",
			"setup.title": "Configure speech recognition",
			"setup.intro": "First use: configure an API key for a speech recognition provider.",
			"setup.suggest": "No key yet? Sign up free at cloud.siliconflow.cn (free quota for new users, great Chinese accuracy, no proxy needed).",
			"setup.provider": "Provider",
			"setup.apiKey": "API Key",
			"setup.apiKeyPlaceholder": "Paste your API key",
			"setup.apiKeyMasked": "Configured ({key}); leave blank to keep",
			"setup.model": "Model (blank = provider default)",
			"setup.language": "Language hint (e.g. zh/en; blank = auto-detect)",
			"setup.direct": "Browser calls the provider directly (uses system proxy)",
			"setup.maxDurationSec": "Max recording length (seconds)",
			"setup.autoSend": "Auto-send after transcription",
			"setup.save": "Save & start recording",
			"setup.cancel": "Cancel",
			"setup.valid": "Key verified ✓",
			"setup.invalid": "Key rejected (saved; edit and retry)",
			"setup.unverified": "Saved (unreachable now; retry later)",
			"setup.saveFailed": "Save failed: {error}"
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
			".dvi-bang{font-weight:700;font-size:13px}",
			".dvi-overlay{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}",
			".dvi-dialog{box-sizing:border-box;width:min(420px,calc(100vw - 32px));max-height:calc(100vh - 48px);overflow:auto;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:18px;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);box-shadow:0 12px 40px rgba(0,0,0,.3)}",
			".dvi-dialog h3{margin:0 0 6px;font-size:16px}",
			".dvi-dialog p{margin:0 0 10px;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-secondary)}",
			".dvi-hint{color:var(--dsw-alias-label-tertiary);font-size:12px}",
			".dvi-field{margin:0 0 12px;display:flex;flex-direction:column;gap:5px}",
			".dvi-field label{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}",
			".dvi-field input,.dvi-field select{box-sizing:border-box;width:100%;height:32px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-specific-input-major);color:var(--dsw-alias-label-primary);font-size:13px;font-family:var(--dsw-font-family);outline:none}",
			".dvi-field input:focus,.dvi-field select:focus{border-color:var(--dsw-alias-button-info-fill)}",
			".dvi-check{display:flex;align-items:center;gap:8px;font-size:13px;margin:0 0 10px;color:var(--dsw-alias-label-secondary)}",
			".dvi-check input{margin:0}",
			".dvi-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}",
			".dvi-btn-primary{height:32px;padding:0 14px;border:none;border-radius:8px;background:var(--dsw-alias-button-info-fill);color:#fff;font-size:13px;cursor:pointer;font-family:var(--dsw-font-family)}",
			".dvi-btn-ghost{height:32px;padding:0 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:13px;cursor:pointer;font-family:var(--dsw-font-family)}",
			".dvi-result{margin-top:10px;font-size:12px;line-height:1.5}",
			".dvi-result[data-kind=ok]{color:#1a7f37}",
			".dvi-result[data-kind=bad]{color:#f04438}",
			".dvi-result[data-kind=warn]{color:var(--dsw-alias-label-secondary)}"
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

		/** Providers the first-run setup form offers (default first). */
		const PROVIDER_OPTIONS = [
			{ value: "siliconflow", label: "SiliconFlow 硅基流动" },
			{ value: "groq", label: "Groq" },
			{ value: "openai", label: "OpenAI" },
			{ value: "dashscope", label: "阿里云百炼 DashScope" }
		];

		/**
		 * First-run setup dialog: pick a provider, paste the API key, save.
		 * Saving writes to the host user store via POST /api/voice-input/config
		 * (loopback-only) and reports best-effort key validation.
		 */
		function SetupDialog({ t, cfg, onClose, onSaved }) {
			const [provider, setProvider] = react.useState(cfg?.provider ?? "siliconflow");
			const [apiKey, setApiKey] = react.useState("");
			const [model, setModel] = react.useState("");
			const [language, setLanguage] = react.useState("");
			const [direct, setDirect] = react.useState(false);
			const [maxDurationSec, setMaxDurationSec] = react.useState(cfg?.maxDurationSec ?? 60);
			const [autoSend, setAutoSend] = react.useState(false);
			const [busy, setBusy] = react.useState(false);
			const [saveError, setSaveError] = react.useState("");
			const masked = cfg?.hasApiKey === true && typeof cfg?.maskedApiKey === "string" ? cfg.maskedApiKey : null;
			const keyPlaceholder = masked !== null ? t("setup.apiKeyMasked").replace("{key}", masked) : t("setup.apiKeyPlaceholder");

			async function save() {
				setBusy(true);
				setSaveError("");
				try {
					const body = {
						provider,
						direct,
						maxDurationSec: Number(maxDurationSec) || 60,
						autoSend
					};
					if (apiKey.trim() !== "") body.apiKey = apiKey.trim();
					if (model.trim() !== "") body.model = model.trim();
					if (language.trim() !== "") body.language = language.trim();
					const response = await fetch("/api/voice-input/config", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify(body)
					});
					const payload = await response.json().catch(() => ({}));
					if (!response.ok || payload.ok !== true) throw new Error(payload?.error ?? `HTTP ${response.status}`);
					onSaved(payload);
				} catch (error) {
					setSaveError(t("setup.saveFailed").replace("{error}", messageOf(error)));
					setBusy(false);
				}
			}

			return jsx("div", {
				className: "dvi-overlay",
				"data-dvi-setup": "",
				onMouseDown: (event) => {
					if (event.target === event.currentTarget) onClose();
				},
				children: jsxs("div", {
					className: "dvi-dialog",
					role: "dialog",
					"aria-label": t("setup.title"),
					children: [
						jsx("h3", { children: t("setup.title") }),
						jsx("p", { children: t("setup.intro") }),
						jsx("p", { className: "dvi-hint", children: t("setup.suggest") }),
						jsxs("div", {
							className: "dvi-field",
							children: [
								jsx("label", { children: t("setup.provider") }),
								jsx("select", {
									value: provider,
									onChange: (event) => setProvider(event.target.value),
									children: PROVIDER_OPTIONS.map((option) => jsx("option", { value: option.value, children: option.label }, option.value))
								})
							]
						}),
						jsxs("div", {
							className: "dvi-field",
							children: [
								jsx("label", { children: t("setup.apiKey") }),
								jsx("input", {
									type: "password",
									"data-dvi-key-input": "",
									placeholder: keyPlaceholder,
									autoComplete: "off",
									autoFocus: true,
									value: apiKey,
									onChange: (event) => setApiKey(event.target.value)
								})
							]
						}),
						jsxs("div", {
							className: "dvi-field",
							children: [
								jsx("label", { children: t("setup.model") }),
								jsx("input", {
									type: "text",
									placeholder: cfg?.model ?? "",
									autoComplete: "off",
									value: model,
									onChange: (event) => setModel(event.target.value)
								})
							]
						}),
						jsxs("div", {
							className: "dvi-field",
							children: [
								jsx("label", { children: t("setup.language") }),
								jsx("input", {
									type: "text",
									placeholder: "zh / en",
									autoComplete: "off",
									value: language,
									onChange: (event) => setLanguage(event.target.value)
								})
							]
						}),
						jsxs("div", {
							className: "dvi-field",
							children: [
								jsx("label", { children: t("setup.maxDurationSec") }),
								jsx("input", {
									type: "number",
									min: "5",
									max: "300",
									value: String(maxDurationSec),
									onChange: (event) => setMaxDurationSec(Number(event.target.value))
								})
							]
						}),
						jsxs("label", {
							className: "dvi-check",
							children: [
								jsx("input", {
									type: "checkbox",
									checked: direct,
									onChange: (event) => setDirect(event.target.checked)
								}),
								t("setup.direct")
							]
						}),
						jsxs("label", {
							className: "dvi-check",
							children: [
								jsx("input", {
									type: "checkbox",
									checked: autoSend,
									onChange: (event) => setAutoSend(event.target.checked)
								}),
								t("setup.autoSend")
							]
						}),
						saveError !== "" && jsx("div", { className: "dvi-result", "data-kind": "bad", children: saveError }),
						jsxs("div", {
							className: "dvi-actions",
							children: [
								jsx("button", {
									type: "button",
									className: "dvi-btn-ghost",
									onClick: onClose,
									children: t("setup.cancel")
								}),
								jsx("button", {
									type: "button",
									className: "dvi-btn-primary",
									"data-dvi-save": "",
									disabled: busy,
									onClick: () => void save(),
									children: t("setup.save")
								})
							]
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
			const [setupOpen, setSetupOpen] = react.useState(false);
			const [cfgView, setCfgView] = react.useState(null);
			const recorderRef = react.useRef(null);
			const chunksRef = react.useRef([]);
			const timerRef = react.useRef(void 0);
			const cfgRef = react.useRef(null);
			const aliveRef = react.useRef(true);
			const directModeRef = react.useRef(false);
			const setupInvalidRef = react.useRef(false);
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

			/** Fetch the effective config view from the host. */
			async function fetchConfig() {
				const response = await fetch("/api/voice-input/config");
				if (!response.ok) throw new Error(`config fetch failed: HTTP ${response.status}`);
				const value = await response.json();
				cfgRef.current = value;
				setCfgView(value);
				return value;
			}

			/** Start recording with a config snapshot already in hand. */
			async function start(cfgValue) {
				if (typeof navigator === "undefined" || navigator.mediaDevices?.getUserMedia === void 0) {
					setErrorText(t("error.mic"));
					setPhase("error");
					return;
				}
				try {
					if (!aliveRef.current) return;
					cfgRef.current = cfgValue;
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
					const maxSec = typeof cfgValue?.maxDurationSec === "number" && cfgValue.maxDurationSec > 0 ? cfgValue.maxDurationSec : 60;
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

			/** The setup form saved successfully: adopt the config and continue. */
			async function handleSaved(payload) {
				setSetupOpen(false);
				const value = payload?.config ?? null;
				if (value !== null) {
					cfgRef.current = value;
					setCfgView(value);
				}
				if (payload?.keyValid === false) {
					setupInvalidRef.current = true;
					setErrorText(t("setup.invalid"));
					setPhase("error");
					return;
				}
				setupInvalidRef.current = false;
				await start(value ?? cfgRef.current);
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

			async function onClick() {
				if (phase === "transcribing") return;
				if (phase === "recording") {
					stop();
					return;
				}
				setErrorText("");
				if (setupInvalidRef.current) {
					setSetupOpen(true);
					return;
				}
				try {
					const value = await fetchConfig();
					if (value.hasApiKey !== true && (value.mock === null || value.mock === void 0 || value.mock === "")) {
						setSetupOpen(true);
						return;
					}
					await start(value);
				} catch (error) {
					if (!aliveRef.current) return;
					setErrorText(messageOf(error));
					setPhase("error");
				}
			}

			if (inputActions === void 0) return null;
			const className = ["dvi-btn", phase === "recording" ? "dvi-recording" : "", phase === "error" ? "dvi-error" : ""].filter((part) => part !== "").join(" ");
			const title = errorText !== "" ? errorText : t(phase === "recording" ? "status.recording" : "button.label");
			let glyph;
			if (phase === "transcribing") glyph = SpinnerIcon();
			else if (phase === "recording") glyph = jsx("span", { className: "dvi-dot" });
			else if (phase === "error") glyph = jsx("span", { className: "dvi-bang", children: "!" });
			else glyph = MicIcon();
			return jsxs(react.Fragment, {
				children: [
					jsxs("button", {
						type: "button",
						className,
						title,
						"aria-label": t("button.label"),
						"aria-pressed": phase === "recording",
						disabled: phase === "transcribing",
						onClick: () => void onClick(),
						children: [glyph, phase !== "idle" ? jsx("span", { className: "dvi-status", children: t("status." + phase) }) : null]
					}),
					setupOpen && jsx(SetupDialog, {
						t,
						cfg: cfgView ?? cfgRef.current,
						onClose: () => setSetupOpen(false),
						onSaved: (payload) => void handleSaved(payload)
					})
				]
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
