# Contributing

Thanks for your interest in dsh-web-voice-input! This is a dual-face
[DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) web
plugin: the host half runs in the dsh host process, the browser half loads in
the Web GUI.

## Development setup

```bash
# 1. install into your web profile as a link (source edits apply on restart)
dsh plugin --profile web add <path-to-this-repo>

# 2. configure the Groq key (or another provider) in the profile user layer
#    ~/.dsh/profiles/web/cordis.patch.yml
#    see the "Configuration" section of the README

# 3. restart dsh web
```

The host half (`lib/index.js`) is plain ESM with zero runtime dependencies
(Node 18+ `fetch`/`FormData`/`Blob`). The browser half (`lib/client.js`) is a
hand-written `window.__ModuleLoader__.load` bundle (no build step); it requires
`react` and `react/jsx-runtime` from the client module table.

## Testing

The test suite runs against a throwaway dsh instance on another port, so it
never touches your running GUI:

```bash
# offline pipeline test (host answers with canned text)
dsh web --patch test/mock.patch.yml --port 3099 &
node test/cdp-test.cjs

# direct-mode test against a local CORS-enabled stub provider
node test/stub-provider.cjs &
dsh web --patch test/direct.patch.yml --port 3099 &
EXPECTED_TEXT='直连模式端到端测试成功' node test/cdp-test.cjs
```

`test/cdp-test.cjs` drives headless Chrome (fake microphone device) and asserts:
boot-graph membership, button mount, recording state, transcription, and that
the text lands in the composer editor.

## Conventions

- No runtime dependencies. Keep it that way unless there is a very good reason.
- The API key must never appear in code, the client bundle, or logs.
- Both host routes stay loopback-fenced.
- Keep the client bundle hand-written and syntax-checked with `node --check`.
