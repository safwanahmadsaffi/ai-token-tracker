// Central platform detection + DOM selector map. Each site restructures its
// DOM frequently, so selectors intentionally include several fallbacks.

export function detectPlatform() {
  const host = window.location.hostname;
  if (host.includes("chatgpt.com") || host.includes("chat.openai.com"))
    return "chatgpt";
  if (host.includes("claude.ai")) return "claude";
  if (host.includes("chat.deepseek.com")) return "deepseek";
  if (host.includes("gemini.google.com")) return "gemini";
  return "unknown";
}

export function detectActiveModel(platform) {
  try {
    if (platform === "chatgpt") {
      const btn = document.querySelector(
        '[data-testid="model-selector-dropdown"], [aria-haspopup="menu"] button, button[id*="model"], .font-medium'
      );
      const text = btn ? btn.innerText || btn.textContent : "";
      if (text.includes("GPT-4o mini") || text.includes("4o-mini")) return "GPT-4o mini";
      if (text.includes("GPT-4o") || text.includes("4o")) return "GPT-4o";
      if (text.includes("o3-mini") || text.includes("o3")) return "o3-mini";
      if (text.includes("o1")) return "o1";
      return "GPT-4o mini";
    }

    if (platform === "claude") {
      const el = document.querySelector(
        '[data-testid="model-selector"], button[aria-haspopup="true"], [class*="model-selector"]'
      );
      const text = el ? el.innerText || el.textContent : "";
      if (text.includes("Haiku")) return "Claude 3.5 Haiku";
      if (text.includes("3.7")) return "Claude 3.7 Sonnet";
      return "Claude 3.5 Sonnet";
    }

    if (platform === "deepseek") {
      const activeR1 = document.querySelector(
        '.ds-toggle-button--active, [class*="active"]'
      );
      const bodyText = document.body.innerText || "";
      if (activeR1?.innerText?.includes("DeepThink") || bodyText.includes("DeepThink (R1)")) {
        return "DeepSeek-R1";
      }
      return "DeepSeek-V3";
    }

    if (platform === "gemini") {
      const picker = document.querySelector(
        'mat-select, .model-picker-button, [aria-label*="model"]'
      );
      const text = picker ? picker.innerText || picker.textContent : "";
      if (text.includes("Pro")) return "Gemini 1.5 Pro";
      if (text.includes("2.0")) return "Gemini 2.0 Flash";
      return "Gemini 1.5 Flash";
    }
  } catch (err) {
    // fallback
  }

  return `${platform ? platform.toUpperCase() : "LLM"} (Free Tier)`;
}

export const PLATFORMS = {
  chatgpt: {
    label: "ChatGPT",
    messageContainer: '[data-message-author-role], article, main',
    assistantMessage: '[data-message-author-role="assistant"]',
    userMessage: '[data-message-author-role="user"]',
    codeBlockWrapper: "pre",
    codeElement: "pre code",
    inputBox:
      '#prompt-textarea, textarea[data-id="root"], div[contenteditable="true"]#prompt-textarea, form textarea'
  },
  claude: {
    label: "Claude",
    messageContainer:
      '[data-testid="user-message"], [data-testid="conversation-turn"], .font-claude-message',
    assistantMessage: ".font-claude-message, [data-is-streaming]",
    userMessage: '[data-testid="user-message"]',
    codeBlockWrapper: "pre",
    codeElement: "pre code",
    inputBox: 'div[contenteditable="true"], textarea'
  },
  deepseek: {
    label: "DeepSeek",
    messageContainer: '[class*="message"], .ds-message, .chat-message',
    assistantMessage: '[class*="assistant"], .ds-message--assistant',
    userMessage: '[class*="user"], .ds-message--user',
    codeBlockWrapper: "pre",
    codeElement: "pre code",
    inputBox: 'textarea, div[contenteditable="true"]'
  },
  gemini: {
    label: "Gemini",
    messageContainer:
      "message-content, .conversation-container, response-container",
    assistantMessage: "model-response, message-content.model-response-text",
    userMessage: "user-query, .user-query-container",
    codeBlockWrapper: "pre, code-block",
    codeElement: "pre code, code-block code",
    inputBox: 'div[contenteditable="true"].ql-editor, rich-textarea textarea'
  }
};

export function getPlatformConfig(platform) {
  return PLATFORMS[platform] || null;
}

