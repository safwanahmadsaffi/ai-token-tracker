// Live token tracking: badges the input box with a running token count as
// the user types, tags completed and streaming assistant responses with live token badges,
// and continuously reports token deltas to the background service worker.

import { countTokensForPlatform } from "../utils/tokenizers.js";
import { getPlatformConfig, detectActiveModel } from "./platforms.js";
import { getQuotaForModel } from "../utils/modelQuotas.js";

const DEBOUNCE_INPUT_MS = 150;
let inputDebounceTimer = null;
let inputBadgeEl = null;

// Track output tokens per message element using WeakMap
const lastReportedOutputTokens = new WeakMap();
// Track processed user message elements using WeakSet so input tokens sent are recorded once per turn
const processedUserMessages = new WeakSet();

function sendTokenEvent(platform, direction, tokens) {
  if (!tokens || tokens <= 0) return;
  try {
    chrome.runtime.sendMessage({
      type: "TOKEN_EVENT",
      platform,
      direction,
      tokens
    });
  } catch (err) {
    // extension context can be invalidated on reload; ignore silently
  }
}

function ensureInputBadge() {
  if (inputBadgeEl && document.body.contains(inputBadgeEl)) return inputBadgeEl;

  const badge = document.createElement("div");
  badge.className = "llm-ext-token-badge llm-ext-input-badge";
  badge.textContent = "0 tokens";
  document.body.appendChild(badge);
  inputBadgeEl = badge;
  return badge;
}

function positionInputBadge(inputEl) {
  if (!inputBadgeEl || !inputEl) return;
  const rect = inputEl.getBoundingClientRect();
  if (!rect.width && !rect.height) {
    inputBadgeEl.style.display = "none";
    return;
  }
  inputBadgeEl.style.display = "flex";
  inputBadgeEl.style.top = `${Math.max(4, window.scrollY + rect.top - 28)}px`;
  inputBadgeEl.style.left = `${Math.max(4, window.scrollX + rect.left)}px`;
}

function readInputText(inputEl) {
  if (!inputEl) return "";
  if (inputEl.tagName === "TEXTAREA" || inputEl.tagName === "INPUT") {
    return inputEl.value || "";
  }
  return inputEl.innerText || inputEl.textContent || "";
}

function handleInputChange(inputEl, platform) {
  if (inputDebounceTimer) clearTimeout(inputDebounceTimer);
  inputDebounceTimer = setTimeout(() => {
    const text = readInputText(inputEl);
    const tokens = countTokensForPlatform(text, platform);
    const badge = ensureInputBadge();
    if (!text.trim()) {
      badge.style.display = "none";
      return;
    }

    const activeModelName = detectActiveModel(platform);
    const quotaInfo = getQuotaForModel(activeModelName, platform);

    try {
      chrome.runtime.sendMessage({ type: "GET_STATS" }, (res) => {
        const todayTotal = res?.todayTotal || 0;
        // Use model-specific free tier quota if not overridden
        const dailyLimit = res?.dailyLimit || quotaInfo.dailyTokens;
        const remaining = dailyLimit - todayTotal;
        const remStr =
          remaining >= 0
            ? `${remaining.toLocaleString()} left today`
            : `quota exceeded`;

        badge.textContent = `${tokens.toLocaleString()} token${
          tokens === 1 ? "" : "s"
        } • ${quotaInfo.name} (${remStr})`;

        if (remaining < 0) {
          badge.style.background = "#e5484d";
        } else {
          badge.style.background = "rgba(17, 18, 20, 0.9)";
        }
        positionInputBadge(inputEl);
      });
    } catch (err) {
      badge.textContent = `${tokens.toLocaleString()} token${
        tokens === 1 ? "" : "s"
      } • ${quotaInfo.name}`;
      positionInputBadge(inputEl);
    }
  }, DEBOUNCE_INPUT_MS);
}



function attachInputListener(platform) {
  const cfg = getPlatformConfig(platform);
  if (!cfg) return;

  const attach = (el) => {
    if (!el || el.dataset.llmExtInputBound === "1") return;
    el.dataset.llmExtInputBound = "1";

    const update = () => handleInputChange(el, platform);

    el.addEventListener("input", update);
    el.addEventListener("keyup", update);
    el.addEventListener("change", update);
    el.addEventListener("paste", update);
    el.addEventListener("focus", update);
    window.addEventListener("resize", () => positionInputBadge(el));
    window.addEventListener("scroll", () => positionInputBadge(el), true);

    // Observe text mutations in contenteditable inputs
    if (el.isContentEditable || el.getAttribute("contenteditable") === "true") {
      const inputMo = new MutationObserver(update);
      inputMo.observe(el, { childList: true, subtree: true, characterData: true });
    }

    update();
  };

  const scan = () => {
    document.querySelectorAll(cfg.inputBox).forEach(attach);
  };

  scan();
  const mo = new MutationObserver(() => scan());
  mo.observe(document.body, { childList: true, subtree: true });
}

// Helper to extract text from a message element excluding any injected extension badges
function getCleanMessageText(messageEl) {
  if (!messageEl) return "";
  const clone = messageEl.cloneNode(true);
  clone.querySelectorAll(".llm-ext-token-badge").forEach((el) => el.remove());
  return (clone.innerText || clone.textContent || "").trim();
}

function updateOutputBadge(messageEl, platform) {
  if (!messageEl) return;
  const text = getCleanMessageText(messageEl);
  if (!text) return;

  const tokens = countTokensForPlatform(text, platform);
  const prev = lastReportedOutputTokens.get(messageEl) || 0;

  let badge = messageEl.querySelector(":scope > .llm-ext-output-badge");
  if (!badge) {
    badge = messageEl.querySelector(".llm-ext-output-badge");
  }

  if (!badge) {
    badge = document.createElement("div");
    badge.className = "llm-ext-output-badge llm-ext-token-badge";
    messageEl.appendChild(badge);
  }

  badge.textContent = `Tokens: ${tokens.toLocaleString()}`;

  if (tokens !== prev) {
    const delta = tokens - prev;
    lastReportedOutputTokens.set(messageEl, tokens);
    if (delta > 0) {
      sendTokenEvent(platform, "output", delta);
    }
  }
}

function processUserMessages(platform) {
  const cfg = getPlatformConfig(platform);
  if (!cfg?.userMessage) return;

  document.querySelectorAll(cfg.userMessage).forEach((el) => {
    if (processedUserMessages.has(el)) return;
    const text = getCleanMessageText(el);
    if (!text) return;

    processedUserMessages.add(el);
    const tokens = countTokensForPlatform(text, platform);
    if (tokens > 0) {
      sendTokenEvent(platform, "input", tokens);
    }
  });
}

function attachOutputObserver(platform) {
  const cfg = getPlatformConfig(platform);
  if (!cfg) return;

  const scan = () => {
    // Update user prompt input totals
    processUserMessages(platform);

    // Update assistant response output totals & badges
    document.querySelectorAll(cfg.assistantMessage).forEach((el) => {
      updateOutputBadge(el, platform);
    });
  };

  scan();

  // Throttled observer loop: execute scan at most every 150ms during live streaming
  let scheduled = false;
  const mo = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      scan();
    }, 150);
  });

  mo.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

export function initTokenCounter(platform) {
  attachInputListener(platform);
  attachOutputObserver(platform);
}

