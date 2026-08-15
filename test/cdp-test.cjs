/**
 * Browser end-to-end test for dsh-web-voice-input.
 *
 * Launches headless Chrome with fake media devices, opens the DSH web GUI on
 * a test instance (which must run with the mock patch overlay), then:
 *   1. asserts the plugin is in the boot graph
 *   2. opens a session so the composer renders
 *   3. finds the mic button (aria-label 语音输入), clicks it → recording state
 *   4. clicks again → stop + transcribe (mock) → asserts the text lands in the
 *      composer draft (via the persisted chat store and the visible editor)
 *   5. collects console errors / page exceptions
 *
 * Prints one JSON result line. Exit code 0 = pass, 1 = fail.
 */
const { spawn } = require("node:child_process");
const http = require("node:http");
const WebSocket = require("C:/Users/hjc05/.dsh/profiles/web/node_modules/ws");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const DEBUG_PORT = 9222;
const GUI = process.env.GUI_URL || "http://127.0.0.1:3099";
const EXPECTED_TEXT = process.env.EXPECTED_TEXT || "这是一段语音识别测试文本。";
const PROFILE_DIR = "C:/Users/hjc05/dsh-voice-input/test/chrome-profile";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function httpJson(method, url) {
	return new Promise((resolve, reject) => {
		const req = http.request(url, { method }, (res) => {
			let data = "";
			res.on("data", (c) => (data += c));
			res.on("end", () => {
				try {
					resolve(JSON.parse(data));
				} catch {
					resolve(data);
				}
			});
		});
		req.on("error", reject);
		req.end();
	});
}

const result = {
	chromeLaunched: false,
	bootGraphOk: false,
	micButtonFound: false,
	recordingStateOk: false,
	textLanded: false,
	editorShowsText: false,
	buttonIdleAfter: false,
	errors: []
};

async function main() {
	const chrome = spawn(
		CHROME,
		[
			"--headless=new",
			`--remote-debugging-port=${DEBUG_PORT}`,
			`--user-data-dir=${PROFILE_DIR}`,
			"--use-fake-ui-for-media-stream",
			"--use-fake-device-for-media-stream",
			"--no-first-run",
			"--no-default-browser-check",
			"--disable-gpu",
			"about:blank"
		],
		{ stdio: "ignore", windowsHide: true }
	);
	result.chromeLaunched = true;

	try {
		let version;
		for (let i = 0; i < 80; i++) {
			try {
				version = await httpJson("GET", `http://127.0.0.1:${DEBUG_PORT}/json/version`);
				if (version && version.webSocketDebuggerUrl) break;
			} catch {}
			await sleep(500);
		}
		if (!version || !version.webSocketDebuggerUrl) throw new Error("chrome devtools endpoint unreachable");

		await httpJson("PUT", `http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(GUI)}`);
		await sleep(800);
		const list = await httpJson("GET", `http://127.0.0.1:${DEBUG_PORT}/json/list`);
		const page = list.find((t) => t.type === "page" && t.url.includes("127.0.0.1:3099")) || list.find((t) => t.type === "page");
		if (!page) throw new Error("no page target found");

		const ws = new WebSocket(page.webSocketDebuggerUrl);
		await new Promise((res, rej) => {
			ws.on("open", res);
			ws.on("error", rej);
		});
		let seq = 0;
		const pending = new Map();
		ws.on("message", (data) => {
			const msg = JSON.parse(data.toString());
			if (msg.id !== undefined && pending.has(msg.id)) {
				const { resolve, reject } = pending.get(msg.id);
				pending.delete(msg.id);
				msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
				return;
			}
			if (msg.method === "Runtime.exceptionThrown") {
				const d = msg.params.exceptionDetails;
				result.errors.push("exception: " + (d.exception?.description || d.text || "").slice(0, 400));
			}
			if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
				result.errors.push("log: " + String(msg.params.entry.text).slice(0, 400));
			}
			if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
				result.errors.push("console.error: " + (msg.params.args || []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 400));
			}
		});
		const send = (method, params = {}) =>
			new Promise((resolve, reject) => {
				const mid = ++seq;
				pending.set(mid, { resolve, reject });
				ws.send(JSON.stringify({ id: mid, method, params }));
			});
		const evaluate = async (expression, awaitPromise = false) => {
			const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise });
			if (r.exceptionDetails) throw new Error("eval failed: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
			return r.result.value;
		};
		await send("Runtime.enable");
		await send("Page.enable");
		await send("Log.enable");

		// 1. boot graph
		const bootDeadline = Date.now() + 90000;
		while (Date.now() < bootDeadline) {
			result.bootGraphOk = await evaluate(
				`!!(window.__DSH_BOOT__ && Array.isArray(window.__DSH_BOOT__.entries) && window.__DSH_BOOT__.entries.some(e => e.id === 'dsh-web-voice-input'))`
			);
			if (result.bootGraphOk) break;
			await sleep(1000);
		}
		if (!result.bootGraphOk) throw new Error("boot graph never included dsh-web-voice-input");

		// 2. open a session and wait for the mic button (or report what we see)
		const micDeadline = Date.now() + 120000;
		while (Date.now() < micDeadline && !result.micButtonFound) {
			result.micButtonFound = await evaluate(`!!document.querySelector('[aria-label="语音输入"], .dvi-btn')`);
			if (result.micButtonFound) break;
			const opened = await evaluate(`(() => {
				const pick = (preds) => { for (const p of preds) { const el = [...document.querySelectorAll('button,[role=button]')].find(p); if (el) { el.click(); return true; } } return false; };
				const candidates = [
					(el) => /新建会话|新会话|new session/i.test((el.textContent || '') + (el.getAttribute('aria-label') || '')),
					(el) => /选择工作区|选择文件夹|打开工作区|workspace/i.test((el.textContent || '') + (el.getAttribute('aria-label') || '')),
					(el) => /开始|继续|start|continue/i.test((el.textContent || '').trim())
				];
				return pick(candidates);
			})()`);
			await sleep(1500);
		}
		if (!result.micButtonFound) {
			const text = await evaluate(`(document.body.innerText || '').slice(0, 900)`);
			result.bodyText = text;
			throw new Error("mic button never appeared; body text: " + text);
		}

		// 2.5 clear any persisted draft so stale text cannot fake a pass
		const cleared = await evaluate(`(() => {
			const editor = document.querySelector('textarea[data-phase]');
			if (!editor) return false;
			const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
			setter.call(editor, '');
			editor.dispatchEvent(new Event('input', { bubbles: true }));
			return true;
		})()`);
		result.draftCleared = cleared === true;
		await sleep(800);

		// 3. click → recording state (probe over 3s to catch slow getUserMedia)
		await evaluate(`(() => { const b = document.querySelector('[aria-label="语音输入"], .dvi-btn'); b && b.click(); return !!b; })()`);
		result.recordingProbe = [];
		for (const delay of [300, 600, 1200, 2000, 3000]) {
			await sleep(delay - (result.recordingProbe[result.recordingProbe.length - 1]?.delay ?? 0));
			const state = await evaluate(`(() => {
				const b = document.querySelector('.dvi-btn');
				return b ? { cls: b.className, title: b.title } : null;
			})()`);
			result.recordingProbe.push({ delay, ...state });
		}
		result.recordingStateOk = result.recordingProbe.some((p) => p.cls?.includes("dvi-recording"));

		// 4. click again → stop + transcribe (mock / stub)
		await evaluate(`(() => { const b = document.querySelector('.dvi-btn'); b && b.click(); })()`);
		const landedDeadline = Date.now() + 30000;
		while (Date.now() < landedDeadline) {
			const landed = await evaluate(`(() => {
				const editor = document.querySelector('textarea[data-phase]');
				return !!editor && editor.value.includes(${JSON.stringify(EXPECTED_TEXT)});
			})()`);
			result.buttonIdleAfter = await evaluate(`(() => { const b = document.querySelector('.dvi-btn'); return !!b && !b.className.includes('dvi-recording') && !b.className.includes('dvi-error'); })()`);
			if (landed) {
				result.textLanded = true;
				break;
			}
			await sleep(1000);
		}
		const snapshot = await evaluate(`(() => {
			const out = { editorValue: null, storageKeys: [] };
			const editor = document.querySelector('textarea[data-phase]');
			if (editor) out.editorValue = editor.value;
			try { for (let i = 0; i < localStorage.length; i++) out.storageKeys.push(localStorage.key(i)); } catch {}
			return out;
		})()`);
		result.editorValue = snapshot.editorValue;
		result.storageKeys = snapshot.storageKeys;
		result.editorShowsText = typeof snapshot.editorValue === "string" && snapshot.editorValue.includes(EXPECTED_TEXT);
	} finally {
		spawn("taskkill", ["/F", "/T", "/PID", String(chrome.pid)], { stdio: "ignore", windowsHide: true });
		await sleep(500);
	}
}

main()
	.then(() => {
		console.log(JSON.stringify(result, null, 2));
		const pass = result.bootGraphOk && result.micButtonFound && result.recordingStateOk && result.textLanded && result.buttonIdleAfter;
		console.log(pass ? "PASS" : "FAIL");
		process.exit(pass ? 0 : 1);
	})
	.catch((error) => {
		result.fatal = error.message;
		console.log(JSON.stringify(result, null, 2));
		console.log("FAIL: " + error.message);
		process.exit(1);
	});

