/**
 * dsh-web-voice-input — browser half declaration.
 *
 * The client bundle registers a session-scoped component in the
 * `conversation.input.left` slot: a microphone button that records audio,
 * transcribes it, and writes the text into the composer draft via the
 * `inputActions.setDraft` standard-kit prop.
 */
import type { Context } from '@deepseek-ai/cordis';

/** Required client services: the slot system and the locale service. */
export declare const inject: string[];

/** Mounts the plugin (locale dictionaries + slot registration). */
export declare function apply(ctx: Context): void;
