// Model-specific free-tier daily token limits and presets for public LLMs.
export const FREE_TIER_QUOTAS = {
  // ChatGPT models
  "gpt-4o": {
    name: "GPT-4o",
    platform: "chatgpt",
    dailyTokens: 40000,
    description: "Free tier (~10 msgs / 3 hours)"
  },
  "gpt-4o-mini": {
    name: "GPT-4o mini",
    platform: "chatgpt",
    dailyTokens: 250000,
    description: "Free tier (Generous daily allowance)"
  },
  "o3-mini": {
    name: "o3-mini",
    platform: "chatgpt",
    dailyTokens: 50000,
    description: "Free reasoning tier (~15 msgs/day)"
  },

  // Claude models
  "claude-3-5-sonnet": {
    name: "Claude 3.5 Sonnet",
    platform: "claude",
    dailyTokens: 45000,
    description: "Free tier (~10-15 msgs / 5 hours)"
  },
  "claude-3-7-sonnet": {
    name: "Claude 3.7 Sonnet",
    platform: "claude",
    dailyTokens: 45000,
    description: "Free tier (~10-15 msgs / 5 hours)"
  },
  "claude-3-5-haiku": {
    name: "Claude 3.5 Haiku",
    platform: "claude",
    dailyTokens: 150000,
    description: "Free tier (~30 msgs / 5 hours)"
  },

  // DeepSeek models
  "deepseek-r1": {
    name: "DeepSeek-R1",
    platform: "deepseek",
    dailyTokens: 100000,
    description: "Free reasoning tier (~50 msgs/day)"
  },
  "deepseek-v3": {
    name: "DeepSeek-V3",
    platform: "deepseek",
    dailyTokens: 200000,
    description: "Free standard tier (~100 msgs/day)"
  },

  // Gemini models
  "gemini-1-5-flash": {
    name: "Gemini 1.5 Flash",
    platform: "gemini",
    dailyTokens: 1000000,
    description: "Free tier (1,500 requests / day)"
  },
  "gemini-1-5-pro": {
    name: "Gemini 1.5 Pro",
    platform: "gemini",
    dailyTokens: 150000,
    description: "Free tier (50 requests / day)"
  },
  "gemini-2-0-flash": {
    name: "Gemini 2.0 Flash",
    platform: "gemini",
    dailyTokens: 500000,
    description: "Free experimental tier"
  },

  // Platform default fallbacks
  "chatgpt-default": {
    name: "ChatGPT (Free)",
    platform: "chatgpt",
    dailyTokens: 100000,
    description: "Default free allocation"
  },
  "claude-default": {
    name: "Claude (Free)",
    platform: "claude",
    dailyTokens: 60000,
    description: "Default free allocation"
  },
  "deepseek-default": {
    name: "DeepSeek (Free)",
    platform: "deepseek",
    dailyTokens: 150000,
    description: "Default free allocation"
  },
  "gemini-default": {
    name: "Gemini (Free)",
    platform: "gemini",
    dailyTokens: 500000,
    description: "Default free allocation"
  }
};

/**
 * Match a raw model name string or platform key to a known model quota entry.
 */
export function getQuotaForModel(modelName, platform) {
  if (!modelName && !platform) return FREE_TIER_QUOTAS["chatgpt-default"];

  const str = (modelName || "").toLowerCase();

  // ChatGPT
  if (str.includes("gpt-4o mini") || str.includes("4o-mini") || str.includes("mini")) {
    return FREE_TIER_QUOTAS["gpt-4o-mini"];
  }
  if (str.includes("gpt-4o") || str.includes("4o")) return FREE_TIER_QUOTAS["gpt-4o"];
  if (str.includes("o3-mini") || str.includes("o3")) return FREE_TIER_QUOTAS["o3-mini"];

  // Claude
  if (str.includes("3.7") || str.includes("3-7")) return FREE_TIER_QUOTAS["claude-3-7-sonnet"];
  if (str.includes("sonnet")) return FREE_TIER_QUOTAS["claude-3-5-sonnet"];
  if (str.includes("haiku")) return FREE_TIER_QUOTAS["claude-3-5-haiku"];

  // DeepSeek
  if (str.includes("r1") || str.includes("deepthink") || str.includes("reasoning")) {
    return FREE_TIER_QUOTAS["deepseek-r1"];
  }
  if (str.includes("v3") || str.includes("deepseek")) return FREE_TIER_QUOTAS["deepseek-v3"];

  // Gemini
  if (str.includes("pro")) return FREE_TIER_QUOTAS["gemini-1-5-pro"];
  if (str.includes("2.0") || str.includes("flash 2.0")) return FREE_TIER_QUOTAS["gemini-2-0-flash"];
  if (str.includes("flash")) return FREE_TIER_QUOTAS["gemini-1-5-flash"];

  // Fallbacks by platform
  if (platform && FREE_TIER_QUOTAS[`${platform}-default`]) {
    return FREE_TIER_QUOTAS[`${platform}-default`];
  }

  return FREE_TIER_QUOTAS["chatgpt-default"];
}
