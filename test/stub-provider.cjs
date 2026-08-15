/**
 * CORS-enabled stub ASR provider for offline browser tests of dsh-web-voice-input
 * direct mode. Serves an OpenAI-compatible /audio/transcriptions endpoint that
 * answers every request with a canned transcription.
 */
const http = require("node:http");

const PORT = Number(process.env.PORT || 3900);
const TEXT = process.env.STUB_TEXT || "直连模式端到端测试成功";

const CORS = {
	"access-control-allow-origin": "*",
	"access-control-allow-methods": "GET,POST,OPTIONS",
	"access-control-allow-headers": "authorization,content-type",
	"access-control-max-age": "86400"
};

const server = http.createServer((req, res) => {
	if (req.method === "OPTIONS") {
		res.writeHead(204, CORS);
		res.end();
		return;
	}
	if (req.method === "POST") {
		let size = 0;
		req.on("data", (chunk) => {
			size += chunk.length;
		});
		req.on("end", () => {
			console.log(`[stub] POST ${req.url} body=${size} bytes auth=${req.headers.authorization ?? "none"}`);
			res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...CORS });
			res.end(JSON.stringify({ text: TEXT }));
		});
		return;
	}
	res.writeHead(404, CORS);
	res.end();
});

server.listen(PORT, "127.0.0.1", () => {
	console.log(`stub provider listening on http://127.0.0.1:${PORT}`);
});
