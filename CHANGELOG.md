# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - unreleased

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
