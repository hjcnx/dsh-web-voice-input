/**
 * 转写后处理：专名纠错 + 中文数字规范化（ESM）。
 *
 * 为什么需要：ASR 模型对训练数据里没有的新词（Hermes / Codex / Claude Code）
 * 容易识别成同音词；而硅基流动的 /audio/transcriptions 只接受 file + model
 * 两个参数（官方文档确认），不支持 prompt/热词引导 —— 只能在本地做后处理。
 *
 * 两条规则链：
 *   1. CORRECTIONS   —— 专名同音误识别纠错（Cloud Code → Claude Code 等）
 *   2. normalizeCnNumbers —— 中文数字 → 阿拉伯数字（二零二六年 → 2026年）
 *
 * 两条都保持保守：只处理明确的数字语境（白名单量词），避免误伤
 * "一起 / 一样 / 一定 / 十分 / 一点 / 第一时间" 这类正常表达。
 * @module dsh-web-voice-input/postprocess
 */

/** ASR 常见专名误识别 → 正确写法。 */
const CORRECTIONS = [
	// 边界用 (?<![A-Za-z])/(?![A-Za-z]) 而非 \b：中文字符属于 \w，
	// 中文与英文相邻时 \b 不成立（"用Hermis和" 会漏修正），只按 ASCII 字母判边界。
	[/(?<![A-Za-z])(?:Cloud|Clock|Claud|Clyde)\s*Code(?![A-Za-z])/gi, "Claude Code"],
	[/(?<![A-Za-z])(?:clock|cloud)\s*coat(?![A-Za-z])/gi, "Claude Code"],
	[/(?<![A-Za-z])Hermis(?![A-Za-z])/g, "Hermes"],
	[/(?<![A-Za-z])Hermers(?![A-Za-z])/g, "Hermes"],
	[/(?<![A-Za-z])LangChain\s*(?:4|四|for|four)\s*j?(?![A-Za-z])/gi, "LangChain4j"],
	[/(?<![A-Za-z])Lunchain\s*(?:4|四|for)?\s*j?(?![A-Za-z])/gi, "LangChain4j"],
	[/(?<![A-Za-z])Lang\s*Chain(?![A-Za-z])/gi, "LangChain"],
	[/(?<![A-Za-z])rag(?![A-Za-z])/g, "RAG"],
	[/(?<![A-Za-z])deep\s*seek(?![A-Za-z])/gi, "DeepSeek"],
	[/(?<![A-Za-z])spring\s*boot(?![A-Za-z])/gi, "Spring Boot"],
	[/(?<![A-Za-z])github\s*copilot(?![A-Za-z])/gi, "GitHub Copilot"],
	[/(?<![A-Za-z])codex(?![A-Za-z])/gi, "Codex"],
	[/(?<![A-Za-z])(?:vs\s*code|vscode)(?![A-Za-z])/gi, "VS Code"]
];

/** 中文数字字符与单位。 */
const CN_DIGITS = { "零": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9 };
const CN_UNITS = { "十": 10, "百": 100, "千": 1000, "万": 10000, "亿": 100000000 };
const CN_CHAR_CLASS = "[零一二三四五六七八九十百千万两亿]";
/** 单个中文数字后紧跟这些量词时才转换（白名单，避免误伤正常副词/成语）。 */
const CN_MEASURES = ["个", "人", "次", "天", "秒", "元", "块", "岁", "层", "楼", "号",
	"条", "只", "份", "页", "行", "张", "台", "部", "本", "篇", "小时", "分钟", "公里", "米", "斤", "克", "吨"];

/**
 * 中文数字串 → 数字。
 * 全为数字字符（二零二六）按逐位读法；含单位（二十八）按数值算法。
 * @param s - 中文数字串
 * @returns 数值；无法解析时 null
 */
function cn2num(s) {
	if (!s) return null;
	const chars = [...s];
	if (chars.every((ch) => ch in CN_DIGITS)) {
		return parseInt(chars.map((ch) => CN_DIGITS[ch]).join(""), 10);
	}
	let total = 0;
	let section = 0;
	let number = 0;
	for (const ch of chars) {
		if (ch in CN_DIGITS) {
			number = CN_DIGITS[ch];
		} else if (ch in CN_UNITS) {
			const unit = CN_UNITS[ch];
			if (unit >= 10000) {
				section = (section + number) * unit;
				total += section;
				section = 0;
			} else {
				if (number === 0) number = 1; // "十五" 的十 → 10
				section += number * unit;
			}
			number = 0;
		} else {
			return null;
		}
	}
	return total + section + number;
}

/**
 * 中文数字 → 阿拉伯数字（保守：只处理明确的数字语境）。
 * @param text - 转写文本
 * @returns 规范化后的文本
 */
export function normalizeCnNumbers(text) {
	const yearRe = new RegExp(`(${CN_CHAR_CLASS}{2,4})年`, "g");
	const monthRe = new RegExp(`(${CN_CHAR_CLASS}{1,3})月`, "g");
	const dayRe = new RegExp(`(${CN_CHAR_CLASS}{1,3})([日号])`, "g");
	const runRe = new RegExp(`${CN_CHAR_CLASS}{2,}`, "g");
	const measureRe = new RegExp(`(${CN_CHAR_CLASS})(?=(?:${CN_MEASURES.join("|")}))`, "g");

	text = text.replace(yearRe, (m, p1) => { const v = cn2num(p1); return v === null ? m : `${v}年`; });
	text = text.replace(monthRe, (m, p1) => { const v = cn2num(p1); return v === null ? m : `${v}月`; });
	text = text.replace(dayRe, (m, p1, p2) => { const v = cn2num(p1); return v === null ? m : `${v}${p2}`; });
	// 两位以上数字串优先（否则"十五个人"会被切成"十5个人"）
	text = text.replace(runRe, (m) => { const v = cn2num(m); return v === null ? m : String(v); });
	text = text.replace(measureRe, (m, p1) => { const v = cn2num(p1); return v === null ? m : String(v); });
	return text;
}

/**
 * 对一次转写结果做完整后处理（专名纠错 + 中文数字规范化）。
 * @param text - ASR 原始转写
 * @returns 后处理后的文本
 */
export function postprocess(text) {
	if (typeof text !== "string" || text === "") return "";
	let out = text;
	for (const [pattern, repl] of CORRECTIONS) out = out.replace(pattern, repl);
	return normalizeCnNumbers(out);
}
