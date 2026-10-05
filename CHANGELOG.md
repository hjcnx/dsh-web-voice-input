# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2026-10-05

### Fixed

- 专名纠错在中文语境下失效：原文用 `` 单词边界，但中文字符属于 `\w`，
  中文与英文相邻时边界不成立（`用Hermis和` 匹配不到）。改用
  `(?<![A-Za-z])` / `(?![A-Za-z])` 只按 ASCII 字母判边界。
  修复后 `Hermis→Hermes`、`Clock Coat→Claude Code`、`Lunchain4→LangChain4j` 均可修正。

## [0.3.0] - 2026-09-27

### Added

- 转写后处理（`lib/postprocess.js`）：专名纠错 + 中文数字规范化
  - 专名纠错：`Cloud Code` / `Clock Coat` → `Claude Code`、`Hermis` → `Hermes`、
    `LangChain 四 j` → `LangChain4j`、`rag` → `RAG`、`spring boot` → `Spring Boot` 等
  - 中文数字 → 阿拉伯数字：`二零二六年八月十五日` → `2026年8月15日`、
    `二十八度` → `28度`、`六百六十六` → `666`（白名单量词，不误伤“一起/一样/十分/一点”）
  - 动机：ASR 对训练数据外的新词专名易同音误识别，而 SiliconFlow 的
    `/audio/transcriptions` 只接受 `file` + `model`，不支持 prompt/热词引导

### Changed

- `siliconflow` 默认模型 `FunAudioLLM/SenseVoiceSmall`（平台已下架）
  → `Qwen/Qwen3-ASR-1.7B`（实测英文专名更准：Hermes / Codex / Spring Boot 均正确）

## [0.2.0] - unreleased

### Added

- First-run setup flow: when no API key is configured, clicking the microphone
  opens a setup dialog in the browser (provider select, key input, model /
  language / duration / direct / autoSend options). Saving writes to
  `~/.dsh/dsh-web-voice-input.json` (atomic, 0600) through a loopback-only
  `POST /api/voice-input/config` route — no YAML editing required.
- Best-effort key validation on save (`GET <provider>/models`), reported as
  `keyValid` without blocking the save.
- Config precedence: user store > plugin row config > environment variables >
  defaults; the store is read per request, so changes apply immediately.
- SiliconFlow is now the default provider (mainland-China friendly);
  provider-specific env fallbacks (`SILICONFLOW_API_KEY`, `GROQ_API_KEY`,
  `OPENAI_API_KEY`, `DASHSCOPE_API_KEY`) in addition to `STT_API_KEY`.

### Changed

- `GET /api/voice-input/config` now returns a full form view: `provider`,
  `hasApiKey`, `maskedApiKey`, `keySource`, `maxDurationSec`, `autoSend`.
- The 403 error hint now points users at the setup dialog for provider changes.

## [0.1.0] - 2026-08-15

### Added

- Microphone button in the DSH Web GUI chat composer (`conversation.input.left` slot)
- One-click record / click-again-to-stop flow with MediaRecorder (webm/opus preferred)
- Transcription through OpenAI-compatible `/audio/transcriptions` providers: Groq (default), OpenAI, SiliconFlow, Alibaba Cloud DashScope — plus any custom endpoint via `baseUrl`
- Two network modes:
  - `direct: true` — the browser calls the ASR API itself (rides the system proxy)
  - `direct: false` (default) — the local dsh host forwards the audio
- Loopback-only trust fence on both host routes; the API key stays in the profile
  config and is only handed to the browser in direct mode
- Config options: `provider`, `apiKey`, `baseUrl`, `model`, `language`,
  `maxDurationSec` (auto-stop), `autoSend`, `mock` (offline test seam), `enabled`
- zh/en localization through the dsh locale service
- Robustness: recording auto-stops at `maxDurationSec`, in-flight recordings are
  cancelled on session switch, composer refocuses after insertion, friendly
  hints for 403 (region/permission) and direct-mode network/CORS failures
- Offline test suite: `test/cdp-test.cjs` (headless-Chrome end-to-end with fake
  media devices), `test/stub-provider.cjs` (CORS-enabled fake ASR), and patch
  overlays for mock and direct modes
