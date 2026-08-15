# dsh-web-voice-input 🎤

DeepSeek Harness（DSH）Web 界面的**语音输入插件**：聊天输入框左侧出现一个麦克风按钮，
点击开始录音、再次点击停止，语音经 Whisper 类 ASR 接口识别后**自动填入输入框**
（已有文字则追加）。零运行时依赖、免构建、热插拔，一行命令安装。

**主要面向国内用户**：默认使用硅基流动（SenseVoice 系列，中文识别准确、国内直连、
有免费额度），首次点击麦克风会弹出设置窗口，粘贴 API Key 即可使用，全程无需编辑任何配置文件。

> English summary: a microphone button in the DSH Web chat composer that records,
> transcribes via an OpenAI-compatible Whisper-class ASR API (SiliconFlow by default),
> and inserts the text into the input box. First-run setup happens in a browser dialog —
> no YAML editing. See [English](#english) below.

---

## ✨ 功能特性

- 🎙️ 聊天框麦克风按钮：点击录音 → 再点停止 → 文字自动入框（可配置自动发送）
- 🪄 **首次使用弹窗**：没配 Key 时点击麦克风，自动弹出设置窗口（选服务商 → 粘贴 Key → 保存即用），
  保存时顺手验证 Key 有效性
- 🇨🇳 **国内友好**：默认硅基流动，中文识别准确、无需代理；也支持 Groq / OpenAI / 阿里云百炼
  或任意 OpenAI 兼容端点（含 whisper.cpp / LocalAI / vLLM 本地免费方案）
- 🔀 双网络模式：`direct: true` 浏览器直连（走系统代理）；`direct: false`（默认）本机宿主转发，
  Key 不进浏览器
- 🔒 两条 host 路由均有本机回环信任围栏；Key 只存 `~/.dsh/dsh-web-voice-input.json`（0600 权限），
  绝不进插件代码和客户端 bundle
- ⏱️ 录音超时自动停止（默认 60 秒）、切换会话自动取消录音、转写完成后焦点回到输入框
- 🌍 中英文界面；403（地区/权限）与网络/CORS 错误有明确中文提示
- 🧪 自带离线测试套件（无头 Chrome + 假麦克风端到端测试）

## 🚀 安装

```bash
dsh plugin --profile web add dsh-web-voice-input
```

重启 `dsh web`，打开一个会话后，聊天输入框左侧出现麦克风按钮。

### 环境要求

| 项目 | 要求 |
|---|---|
| DSH | 0.1.0-rc.6（本插件在该版本上开发与测试） |
| pnpm | 已安装并在 PATH 中（`dsh plugin` 依赖它，缺了会提示 "pnpm not found"） |
| 浏览器 | Chrome / Edge 最佳，Firefox / Safari 亦支持（录音格式自动适配） |
| 访问方式 | 通过 `http://127.0.0.1:3080` 本机访问 GUI；**局域网/手机远程页面不支持语音功能**（浏览器麦克风安全策略 + 插件回环安全围栏，属安全设计） |

### 安装自检

```bash
dsh web --dump-config | findstr voice-input    # 应看到 - id: voice-input 一行
```

重启后在 GUI 中：**先新建或打开一个会话**，聊天输入框左下角应出现 🎤 按钮。

## 🎤 首次使用

1. **申请 API Key（推荐硅基流动）**：打开 [cloud.siliconflow.cn](https://cloud.siliconflow.cn)
   免费注册，在「API 密钥」页面创建一个 Key（新用户有免费额度，
   `FunAudioLLM/SenseVoiceSmall` 与 `TeleAI/TeleSpeechASR` 都是免费模型，中文效果好）
2. **点击聊天框的麦克风按钮** → 自动弹出「配置语音识别」窗口
3. 服务商默认选中「SiliconFlow 硅基流动」，粘贴你的 Key，点「保存并开始录音」
4. 保存时插件会自动验证 Key：显示「Key 验证通过 ✓」后即开始录音，之后无需再做任何配置

没有 Key 时的点击行为就是弹窗；有 Key 后点击直接开始录音。

## ⚙️ 配置说明

**优先级**：设置弹窗保存的值（`~/.dsh/dsh-web-voice-input.json`）＞
profile 配置（`~/.dsh/profiles/web/cordis.patch.yml` 的 `voice-input` 行）＞
环境变量 ＞ 默认值。修改后立即生效，无需重启。

高级用户也可以直接在 `cordis.patch.yml` 里配置：

```yaml
- id: voice-input
  config:
    provider: siliconflow            # siliconflow（默认）| groq | openai | dashscope
    apiKey: sk-xxxx                  # 也可用环境变量 SILICONFLOW_API_KEY / GROQ_API_KEY 等
    model: FunAudioLLM/SenseVoiceSmall
    language: zh                     # 留空 = 自动检测
    direct: false                    # false = 宿主转发（Key 不进浏览器）
    maxDurationSec: 60               # 单次录音上限（5~300 秒）
    autoSend: false                  # true = 转写完成后自动发送
```

| 配置项 | 默认 | 说明 |
|---|---|---|
| `provider` | `siliconflow` | `siliconflow` / `groq` / `openai` / `dashscope`，均为 OpenAI 兼容 `/audio/transcriptions` |
| `apiKey` | 环境变量 | API key（弹窗保存的值优先级最高） |
| `baseUrl` | 服务商默认 | 任意 OpenAI 兼容端点 |
| `model` | 服务商默认 | 转写模型 |
| `language` | `''` 自动检测 | 可固定为 `zh` / `en` 等 |
| `direct` | `false` | `true` = 浏览器直连（走系统代理）；`false` = 宿主转发 |
| `maxDurationSec` | `60` | 单次录音上限，自动停止 |
| `autoSend` | `false` | 转写完成后自动发送消息 |
| `enabled` | `true` | `false` 关闭插件 |
| `mock` | — | 测试用：非空字符串直接返回，不调上游 |

## 🌐 服务商与模型

| `provider` | 默认模型 | 其他可选 | 国内直连 |
|---|---|---|---|
| `siliconflow` | `FunAudioLLM/SenseVoiceSmall` | `TeleAI/TeleSpeechASR` 等 | ✅ |
| `dashscope` | `qwen-audio-asr` | `qwen-audio-asr-latest`、`qwen-audio-3-0-asr-flash` | ✅ |
| `groq` | `whisper-large-v3-turbo` | `whisper-large-v3` | ❌ 需代理 |
| `openai` | `whisper-1` | — | ❌ 需代理 |

**完全本地免费方案**（不联网、零费用、隐私最好）：

```yaml
- id: voice-input
  config:
    baseUrl: http://127.0.0.1:8080/v1/audio/transcriptions   # whisper.cpp / LocalAI / vLLM
    model: whisper-large-v3-turbo
    apiKey: local    # 本地服务忽略
```

讯飞、腾讯云、百度、火山引擎、MiniMax 等为私有协议，需要单独适配（见 Roadmap）。

## ❓ 常见问题

**看不到麦克风按钮？**
麦克风按钮挂在会话级输入框上，需要先**新建/打开一个会话**才会渲染。若仍看不到，跑一下
`dsh web --dump-config | findstr voice-input` 确认插件行已进配置，并确认重启过 `dsh web`。

**在手机 / 局域网其他设备上能用语音吗？**
不能，这是安全设计：浏览器仅在 `localhost` 等安全上下文允许麦克风，且插件的配置与转写
路由只接受本机回环请求。远程页面请继续用文字输入。

**Groq 返回 403 Forbidden（key 本身有效）？**
Groq 音频模型按账号地区/权限开放。去 [Groq 控制台](https://console.groq.com/keys) 检查，
或直接换回 `siliconflow`（默认，国内直连）。

**需要代理？**
用 `direct: true`（设置弹窗里勾选「浏览器直连」），请求从浏览器发出，自动走系统代理。

**Key 会泄漏吗？**
`direct: false`（默认）时 Key 只在宿主进程内使用，绝不进浏览器；`direct: true` 时 Key 经本机
回环接口交给浏览器完成请求。两条路由都只接受本机回环访问，LAN 暴露部署也不会泄漏。

**音频去哪了？**
浏览器 → 本机 dsh 宿主（同源）→ 所配置的 ASR 服务商；插件不存储音频。

## 🧪 开发与测试

见 [CONTRIBUTING.md](CONTRIBUTING.md)。离线端到端测试在独立端口启动临时实例，
驱动无头 Chrome + 假麦克风验证完整链路：

```bash
# 录音 → 转写 → 文字入框（mock 模式）
dsh web --patch test/mock.patch.yml --port 3099 &
node test/cdp-test.cjs

# 首次使用弹窗流程（无 Key → 弹窗 → 保存 → 落盘）
dsh web --patch test/popup.patch.yml --port 3099 &
node test/popup-test.cjs

# 浏览器直连模式（对本地 CORS stub）
node test/stub-provider.cjs &
dsh web --patch test/direct.patch.yml --port 3099 &
EXPECTED_TEXT='直连模式端到端测试成功' node test/cdp-test.cjs
```

## 🗺️ Roadmap

- 设置页（设置 → 插件）里的图形化配置卡片
- 按住说话（长按录音、松手发送）
- 每会话语言切换
- 讯飞 / 腾讯 / 火山等私有协议的适配器

## License

[MIT](LICENSE)

---

## English

**dsh-web-voice-input** is a voice input plugin for the [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness)
Web GUI: a microphone button in the chat composer. Click to record, click again to stop;
the audio is transcribed by an OpenAI-compatible Whisper-class ASR API and the text lands
in the input box. SiliconFlow is the default provider (great Chinese accuracy, free tier,
no proxy needed in mainland China).

```bash
dsh plugin --profile web add dsh-web-voice-input
```

First use: click the microphone → the setup dialog appears → paste an API key
(e.g. from [cloud.siliconflow.cn](https://cloud.siliconflow.cn)) → save. The key is
validated on save and stored in `~/.dsh/dsh-web-voice-input.json`; no YAML editing needed.
Advanced options (provider, model, language, direct/host-proxy mode, max duration,
auto-send) are available in the same dialog or via the profile config layer.
See the Chinese sections above for the full configuration reference, provider table,
FAQ, and the offline E2E test suite.
