/**
 * First-run setup dialog E2E test for dsh-web-voice-input.
 *
 * Boots headless Chrome against a test dsh instance running the popup overlay
 * (no API key configured, isolated store file), clicks the mic button, fills
 * the setup dialog, saves, and asserts:
 *   1. the setup dialog appeared on mic click
 *   2. it closed after saving
 *   3. the isolated store file was written with the entered key
 *
 * Prints one JSON result line. Exit code 0 = pass, 1 = fail.
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const WebSocket = require("C:/Users/hjc05/.dsh/profiles/web/node_modules/ws");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const DEBUG_PORT = 9223;
const GUI = process.env.GUI_URL || "http://127.0.0.1:3099";
const STORE_PATH = "C:/Users/hjc05/dsh-voice-input/test/tmp-store.json";
const PROFILE_DIR = "C:/Users/hjc05/dsh-voice-input/test/chrome-profile-popup";
const TEST_KEY = "sk-fake-test-123";

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
	setupDialogAppeared: false,
	dialogClosed: false,
	storeWritten: false,
	buttonStateAfter: null,
	errors: []
};

async function main() {
	if (fs.existsSync(STORE_PATH)) fs.rmSync(STORE_PATH);
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

		// Wait for the shell and open a session (same heuristics as cdp-test).
		const bootDeadline = Date.now() + 90000;
		let bootOk = false;
		while (Date.now() < bootDeadline) {
			bootOk = await evaluate(`!!(window.__DSH_BOOT__ && Array.isArray(window.__DSH_BOOT__.entries) && window.__DSH_BOOT__.entries.some(e => e.id === 'dsh-web-voice-input'))`);
			if (bootOk) break;
			await sleep(1000);
		}
		if (!bootOk) throw new Error("boot graph never included dsh-web-voice-input");
		const micDeadline = Date.now() + 120000;
		let micFound = false;
		while (Date.now() < micDeadline && !micFound) {
			micFound = await evaluate(`!!document.querySelector('[aria-label="语音输入"], .dvi-btn')`);
			if (micFound) break;
			await evaluate(`(() => {
				const pick = (preds) => { for (const p of preds) { const el = [...document.querySelectorAll('button,[role=button]')].find(p); if (el) { el.click(); return true; } } return false; };
				return pick([
					(el) => /新建会话|新会话|new session/i.test((el.textContent || '') + (el.getAttribute('aria-label') || '')),
					(el) => /选择工作区|选择文件夹|打开工作区|workspace/i.test((el.textContent || '') + (el.getAttribute('aria-label') || '')),
					(el) => /开始|继续|start|continue/i.test((el.textContent || '').trim())
				]);
			})()`);
			await sleep(1500);
		}
		if (!micFound) throw new Error("mic button never appeared");

		// Click the mic → the setup dialog must appear (no key configured).
		await evaluate(`(() => { const b = document.querySelector('[aria-label="语音输入"], .dvi-btn'); b && b.click(); })()`);
		const dialogDeadline = Date.now() + 15000;
		while (Date.now() < dialogDeadline && !result.setupDialogAppeared) {
			result.setupDialogAppeared = await evaluate(`!!document.querySelector('[data-dvi-setup]')`);
			if (!result.setupDialogAppeared) await sleep(500);
		}
		if (!result.setupDialogAppeared) throw new Error("setup dialog never appeared");

		// Fill the key and save.
		await evaluate(`(() => {
			const input = document.querySelector('[data-dvi-key-input]');
			if (!input) return false;
			const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
			setter.call(input, ${JSON.stringify(TEST_KEY)});
			input.dispatchEvent(new Event('input', { bubbles: true }));
			return true;
		})()`);
		await sleep(300);
		await evaluate(`(() => { const b = document.querySelector('[data-dvi-save]'); b && b.click(); return !!b; })()`);

		const closedDeadline = Date.now() + 20000;
		while (Date.now() < closedDeadline) {
			result.dialogClosed = !(await evaluate(`!!document.querySelector('[data-dvi-setup]')`));
			if (result.dialogClosed) break;
			await sleep(500);
		}
		result.storeWritten = fs.existsSync(STORE_PATH) && fs.readFileSync(STORE_PATH, "utf8").includes(TEST_KEY);
		result.buttonStateAfter = await evaluate(`(() => {
			const b = document.querySelector('.dvi-btn');
			return b ? { cls: b.className, title: b.title } : null;
		})()`);
	} finally {
		spawn("taskkill", ["/F", "/T", "/PID", String(chrome.pid)], { stdio: "ignore", windowsHide: true });
		await sleep(500);
	}
}

main()
	.then(() => {
		console.log(JSON.stringify(result, null, 2));
		const pass = result.setupDialogAppeared && result.dialogClosed && result.storeWritten;
		console.log(pass ? "PASS" : "FAIL");
		process.exit(pass ? 0 : 1);
	})
	.catch((error) => {
		result.fatal = error.message;
		console.log(JSON.stringify(result, null, 2));
		console.log("FAIL: " + error.message);
		process.exit(1);
	});
