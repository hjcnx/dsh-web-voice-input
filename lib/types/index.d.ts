/**
 * dsh-web-voice-input — host half declaration.
 */
import type { Context } from '@deepseek-ai/cordis';

/** Plugin row config (resolved by the loader; env fallbacks apply). */
export interface VoiceInputConfig {
	/** `false` disables the whole plugin. Default `true`. */
	enabled?: boolean;
	/** Transcription provider: `groq` | `openai` | `siliconflow` | `dashscope`. Default `groq`. */
	provider?: 'groq' | 'openai' | 'siliconflow' | 'dashscope';
	/** API key; falls back to `GROQ_API_KEY`. */
	apiKey?: string;
	/** Custom OpenAI-compatible endpoint override. */
	baseUrl?: string;
	/** Model name; defaults per provider. */
	model?: string;
	/** Language hint (e.g. `zh` / `en`); empty = auto-detect. */
	language?: string;
	/** `true` = the browser calls the ASR API itself (rides the system proxy). */
	direct?: boolean;
	/** Hard cap on one recording in seconds (clamped to 5..300; default 60). */
	maxDurationSec?: number;
	/** Submit the composer draft automatically once transcription lands. */
	autoSend?: boolean;
	/** Offline test seam: canned transcription result, upstream never called. */
	mock?: string;
}

/** Stable cordis plugin name. */
export declare const name: 'dsh-web-voice-input';

/** Required services (the web server). */
export declare const inject: string[];

/** Mounts the `/api/voice-input/config` and `/api/voice-input/transcribe` routes. */
export declare function apply(ctx: Context, config?: VoiceInputConfig): void;
