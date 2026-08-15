# dsh-web-voice-input 🎤

Voice input for the [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) Web GUI.

A **microphone button in the chat composer**: click to record, click again to stop —
the audio is transcribed by a Whisper-compatible ASR API and the recognized text
lands in the input box (appended to any existing draft). Zero runtime dependencies,
no build step, hot-pluggable through the standard DSH plugin mechanism.

> 中文说明见下文。[DeepSeek Harness Web UI 语音输入插件：聊天输入框加麦克风按钮，点击录音、再点停止，语音经 Whisper 类 API 识别后自动填入输入框。零运行时依赖、免构建、热插拔。](#中文说明)

---

## Features

- 🎙️ One-click record / click-again-to-stop in the composer (`conversation.input.left` slot)
- 🌐 OpenAI-compatible providers: **Groq** (default, `whisper-large-v3-turbo`),
  **OpenAI** (`whisper-1`), **SiliconFlow** (`FunAudioLLM/SenseVoiceSmall`),
  **Alibaba Cloud DashScope** (`qwen-audio-asr`) — or any custom endpoint
  (including fully local whisper.cpp / LocalAI / vLLM servers)
- 🔀 Two network modes:
  - `direct: true` — the **browser** calls the ASR API itself (rides your system proxy)
  - `direct: false` (default) — the local dsh **host** forwards the audio
- 🔒 Loopback-only trust fence on both host routes; the API key lives in the profile
  config, never in the client bundle (handed to the browser only in direct mode)
- ⏱️ Auto-stop at `maxDurationSec` (default 60s); in-flight recording is cancelled on session switch
- 🌍 zh/en localization; composer refocuses after insertion; friendly hints for 403 (region/permission) and network/CORS failures
- 🧪 Offline test suite: headless-Chrome E2E with fake media devices + a CORS-enabled stub provider

## Installation

```bash
# from npm (once published)
dsh plugin --profile web add dsh-web-voice-input

# from a local checkout (source edits apply on restart)
dsh plugin --profile web add <path-to-this-repo>
```

Then configure the API key in the **profile user layer**
(`~/.dsh/profiles/web/cordis.patch.yml`, applied after every bundle layer):

```yaml
- id: voice-input
  config:
    apiKey: gsk_xxx                # your provider key (or set GROQ_API_KEY env)
    provider: groq                 # groq | openai | siliconflow | dashscope
    model: whisper-large-v3-turbo  # default per provider when omitted
    language: ''                   # '' = auto-detect (zh/en/…)
    direct: true                   # browser calls the API itself (uses system proxy)
```

Restart `dsh web`. A microphone button appears on the left of the chat input;
the browser asks for microphone permission on first click.

## Configuration

| Key | Default | Description |
|---|---|---|
| `provider` | `groq` | `groq` / `openai` / `siliconflow` / `dashscope` (all OpenAI-compatible `/audio/transcriptions`) |
| `apiKey` | env `GROQ_API_KEY` | API key; host-side only unless `direct: true` |
| `baseUrl` | provider default | Custom OpenAI-compatible endpoint |
| `model` | provider default | Transcription model |
| `language` | `''` (auto-detect) | Fix to `zh` / `en` etc. |
| `direct` | `false` | `true` = browser calls the ASR API (rides the system proxy); `false` = host forwards |
| `maxDurationSec` | `60` | Auto-stop one recording after N seconds (clamped 5..300) |
| `autoSend` | `false` | Submit the draft automatically once text lands in the composer |
| `mock` | — | Non-empty string = canned result, upstream never called (offline tests) |
| `enabled` | `true` | `false` disables the plugin |

## Providers & Models

Built-in providers (all speak the OpenAI-compatible `/audio/transcriptions` protocol):

| `provider` | Default model | Other models | Mainland China direct access |
|---|---|---|---|
| `groq` | `whisper-large-v3-turbo` | `whisper-large-v3` | ❌ needs proxy |
| `openai` | `whisper-1` | — | ❌ needs proxy |
| `siliconflow` | `FunAudioLLM/SenseVoiceSmall` | SenseVoice variants | ✅ |
| `dashscope` | `qwen-audio-asr` | `qwen-audio-asr-latest`, `qwen-audio-3-0-asr-flash` | ✅ |

**Mainland China (no proxy) — SiliconFlow** (SenseVoice is excellent at Chinese):

```yaml
- id: voice-input
  config:
    provider: siliconflow
    apiKey: sk-xxxxxxxx          # console.siliconflow.cn
    language: zh
    direct: false                # reachable from the host directly
```

**Mainland China (no proxy) — Alibaba Cloud Model Studio (百炼)**:

```yaml
- id: voice-input
  config:
    provider: dashscope
    apiKey: sk-xxxxxxxx          # bailian.console.aliyun.com
    language: zh
```

**Any other OpenAI-compatible endpoint** — including fully local, free,
privacy-first ASR servers (whisper.cpp / LocalAI / vLLM):

```yaml
- id: voice-input
  config:
    baseUrl: http://127.0.0.1:8080/v1/audio/transcriptions
    model: whisper-large-v3-turbo
    apiKey: local                # dummy — local servers ignore it
    direct: false
```

Providers with proprietary (non-OpenAI-compatible) ASR protocols — iFlytek,
Tencent Cloud, Baidu, Volcengine, MiniMax — need a custom adapter and are not
reachable through `baseUrl` alone (see Roadmap).

## FAQ

**Groq returns 403 Forbidden but the key works for `/models`?**
Groq gates audio models by account region/permission. Options: enable whisper in
the [Groq console](https://console.groq.com/keys), use another key/account, or
switch `provider: siliconflow` (SenseVoiceSmall is excellent for Chinese and
works without a proxy in China).

**Which providers work in mainland China without a proxy?**
`siliconflow` (SenseVoiceSmall) and `dashscope` (Alibaba Cloud Model Studio,
`qwen-audio-asr`) both serve OpenAI-compatible `/audio/transcriptions`
endpoints and are directly reachable. You can also point `baseUrl` at any
OpenAI-compatible ASR service, including fully local ones (whisper.cpp /
LocalAI / vLLM, e.g. `http://127.0.0.1:8080/v1/audio/transcriptions` — no API
key, no network, best privacy).

**I use a proxy (e.g. Clash). Which mode should I pick?**
`direct: true` — the browser makes the upstream call, so the request goes through
your browser's/system proxy automatically. Use `direct: false` only when the
dsh host process itself can reach the provider.

**Where does my audio go?**
Browser → local dsh host (same-origin `fetch`) → the configured ASR API. Nothing
is stored by this plugin.

**Is the key exposed to the page?**
In `direct: true` the key is handed to the browser over a loopback-only endpoint
and lives in the page for the duration of the call — necessary because the
browser makes the request. In host-proxy mode it never leaves the host process.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md). The offline E2E suite runs a throwaway
dsh instance on another port and drives headless Chrome with a fake microphone:

```bash
dsh web --patch test/mock.patch.yml --port 3099 &
node test/cdp-test.cjs

node test/stub-provider.cjs &
dsh web --patch test/direct.patch.yml --port 3099 &
EXPECTED_TEXT='直连模式端到端测试成功' node test/cdp-test.cjs
```

## Roadmap

- Settings UI card (edit config from the web settings surface)
- Hold-to-talk / press-and-release gesture
- Per-session language switch
- Streaming / interim transcription

## License

[MIT](LICENSE)

---

## 中文说明

DeepSeek Harness (DSH) Web 界面的**语音输入插件**：聊天输入框左侧出现一个麦克风按钮，
点击开始录音、再次点击停止，语音经 Whisper 类 ASR 接口识别后**自动填入输入框**（已有文字则追加）。

### 特点

- 零运行时依赖、免构建，标准 DSH 双面插件（`dsh.bundle.patch` + `dsh.client`），一行命令安装
- 内置 Groq（默认）/ OpenAI / SiliconFlow / 阿里云百炼 DashScope 四家服务商，或任意 OpenAI 兼容端点（含 whisper.cpp / LocalAI / vLLM 本地服务）
- 双网络模式：`direct: true` 浏览器直连（走系统代理）；`direct: false` 本机宿主转发
- 两条 host 路由均有回环信任围栏；API key 只存在 profile 配置里，绝不进插件代码和客户端 bundle
- 录音超时自动停止（默认 60 秒）、切换会话自动取消录音、转写完成后焦点回到输入框
- 中英文界面文案；403（地区/权限）与网络/CORS 错误有明确中文提示
- 自带离线测试套件：无头 Chrome + 假麦克风端到端测试

### 安装

```bash
dsh plugin --profile web add dsh-web-voice-input   # npm 发布后
dsh plugin --profile web add <本地仓库路径>      # 本地源码（改完重启即生效）
```

在 profile 用户层 `~/.dsh/profiles/web/cordis.patch.yml` 配置（见上文 YAML 示例），
重启 `dsh web` 后输入框左侧出现麦克风按钮。

### 国内直连配置

- **硅基流动**：`provider: siliconflow`（SenseVoiceSmall，中文效果好、便宜）
- **阿里云百炼**：`provider: dashscope`（`qwen-audio-asr`）
- **完全本地**：`baseUrl` 指向 whisper.cpp / LocalAI / vLLM 的本地服务，零费用、零联网
- 服务商与模型速查表见上文 [Providers & Models](#providers--models)

### 常见问题

- **Groq 返回 403 Forbidden**：Groq 音频模型按账号地区/权限开放，去
  [控制台](https://console.groq.com/keys) 检查，或换 `provider: siliconflow`
  （SenseVoiceSmall 中文效果好、国内直连）。
- **需要代理**：用 `direct: true`，请求从浏览器发出，自动走系统代理。
- **音频流向**：浏览器 → 本机 dsh 宿主（同源）→ 所配置的 ASR 服务商；插件不存储音频。
