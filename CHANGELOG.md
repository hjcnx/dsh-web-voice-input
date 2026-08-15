# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
