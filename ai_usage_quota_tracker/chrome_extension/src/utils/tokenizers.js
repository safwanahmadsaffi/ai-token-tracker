// Token counting wrappers. ChatGPT uses a real BPE encoder (js-tiktoken).
// Claude / DeepSeek / Gemini use a fast character/word heuristic since no
// public offline BPE vocab ships for those models; the heuristic is tuned
// against published average chars-per-token ratios for each family.
// Import the "lite" Tiktoken class plus only the single o200k_base rank
// file directly, instead of `js-tiktoken`'s aggregator entry point (which
// statically pulls in every encoding — gpt2, r50k, p50k, cl100k, o200k —
// and would bloat this content script by several extra megabytes for
// vocabularies we never use).
import { Tiktoken } from "js-tiktoken/lite";
import o200kBaseRanks from "js-tiktoken/ranks/o200k_base";

let _o200k = null;

function getO200k() {
  if (!_o200k) _o200k = new Tiktoken(o200kBaseRanks);
  return _o200k;
}

/**
 * Exact BPE token count using js-tiktoken (o200k_base).
 * @param {string} text
 * @param {"o200k_base"|"cl100k_base"} encodingName
 */
export function countTiktoken(text, encodingName = "o200k_base") {
  if (!text) return 0;
  if (encodingName === "cl100k_base") return heuristicCount(text, 3.8);
  try {
    return getO200k().encode(text).length;
  } catch (err) {
    return heuristicCount(text, 3.8);
  }
}

/**
 * Lightweight heuristic token estimator using a chars-per-token ratio,
 * blended with a whitespace-word count so both prose and code estimate
 * reasonably well.
 * @param {string} text
 * @param {number} charsPerToken
 */
export function heuristicCount(text, charsPerToken = 3.8) {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const charEstimate = trimmed.length / charsPerToken;
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  const wordEstimate = words * 1.3; // sub-word splitting fudge factor
  return Math.max(1, Math.round((charEstimate + wordEstimate) / 2));
}

const PLATFORM_CONFIG = {
  chatgpt: { mode: "tiktoken", encoding: "o200k_base" },
  claude: { mode: "heuristic", charsPerToken: 3.8 },
  deepseek: { mode: "heuristic", charsPerToken: 3.6 },
  gemini: { mode: "heuristic", charsPerToken: 4.0 }
};

/**
 * Count tokens for a given platform key ("chatgpt" | "claude" | "deepseek" | "gemini").
 */
export function countTokensForPlatform(text, platform) {
  const cfg = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.claude;
  if (cfg.mode === "tiktoken") {
    return countTiktoken(text, cfg.encoding);
  }
  return heuristicCount(text, cfg.charsPerToken);
}

export { PLATFORM_CONFIG };
