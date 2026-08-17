// Popup dashboard: today's token totals per platform, CSV analytics
// export, and a 1-click full-conversation exporter (Markdown/HTML/PDF)
// that pulls the active tab's chat via chrome.scripting.

const PLATFORM_LABELS = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  deepseek: "DeepSeek",
  gemini: "Gemini"
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => resolve(response));
  });
}

function platformTotal(entry) {
  if (!entry) return 0;
  return (entry.input || 0) + (entry.output || 0);
}

const PRESET_LIMITS = {
  "auto": 100000,
  "gpt-4o": 40000,
  "gpt-4o-mini": 250000,
  "o3-mini": 50000,
  "claude-3-5-sonnet": 45000,
  "claude-3-5-haiku": 150000,
  "deepseek-r1": 100000,
  "deepseek-v3": 200000,
  "gemini-1-5-flash": 1000000,
  "gemini-1-5-pro": 150000
};

async function renderStats() {
  const res = await sendMessage({ type: "GET_STATS" });
  const stats = res?.stats || {};
  const today = stats[todayKey()] || {};
  const dailyLimit = res?.dailyLimit || 100000;

  const total = Object.values(today).reduce(
    (sum, entry) => sum + platformTotal(entry),
    0
  );
  document.getElementById("todayTotal").textContent = total.toLocaleString();

  // Remaining token calculations
  const remaining = dailyLimit - total;
  const percentUsed = Math.min(100, Math.round((total / dailyLimit) * 100));

  const remValEl = document.getElementById("tokensRemaining");
  const remLabelEl = document.getElementById("remainingStatusLabel");
  const progressBar = document.getElementById("quotaProgressBar");
  const percentText = document.getElementById("quotaPercentText");
  const limitText = document.getElementById("quotaLimitText");
  const inputEl = document.getElementById("dailyLimitInput");

  if (inputEl && document.activeElement !== inputEl) {
    inputEl.value = dailyLimit;
  }

  if (remaining >= 0) {
    remValEl.textContent = remaining.toLocaleString();
    remValEl.classList.remove("exceeded");
    remLabelEl.textContent = "tokens left today";
  } else {
    remValEl.textContent = `+${Math.abs(remaining).toLocaleString()}`;
    remValEl.classList.add("exceeded");
    remLabelEl.textContent = "over daily quota";
  }

  progressBar.style.width = `${percentUsed}%`;
  progressBar.classList.remove("warning", "exceeded");
  if (percentUsed >= 100) {
    progressBar.classList.add("exceeded");
  } else if (percentUsed >= 80) {
    progressBar.classList.add("warning");
  }

  percentText.textContent = `${percentUsed}% of daily quota used`;
  limitText.textContent = `Daily Quota: ${dailyLimit.toLocaleString()}`;

  const grid = document.getElementById("platformGrid");
  grid.innerHTML = "";
  Object.keys(PLATFORM_LABELS).forEach((key) => {
    const value = platformTotal(today[key]);
    const item = document.createElement("div");
    item.className = "llm-pop-platform-item";
    item.innerHTML = `<div class="name">${PLATFORM_LABELS[key]}</div><div class="value">${value.toLocaleString()}</div>`;
    grid.appendChild(item);
  });

  return stats;
}

async function handlePresetChange() {
  const select = document.getElementById("presetQuotaSelect");
  const customRow = document.getElementById("customLimitRow");
  const val = select.value;

  if (val === "custom") {
    if (customRow) customRow.style.display = "flex";
  } else {
    if (customRow) customRow.style.display = "none";
    const limit = PRESET_LIMITS[val] || 100000;
    await sendMessage({ type: "SET_DAILY_LIMIT", limit });
    await renderStats();
  }
}

async function handleSaveLimit() {
  const inputEl = document.getElementById("dailyLimitInput");
  const limit = parseInt(inputEl.value, 10);
  if (!limit || limit < 1000) return;
  await sendMessage({ type: "SET_DAILY_LIMIT", limit });
  await renderStats();
}


function statsToCsv(stats) {
  const rows = [["date", "platform", "input_tokens", "output_tokens", "total_tokens"]];
  Object.keys(stats)
    .sort()
    .forEach((date) => {
      Object.keys(stats[date]).forEach((platform) => {
        const entry = stats[date][platform];
        rows.push([
          date,
          platform,
          entry.input || 0,
          entry.output || 0,
          platformTotal(entry)
        ]);
      });
    });
  return rows.map((r) => r.join(",")).join("\n");
}

function triggerPopupDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function handleExportCsv() {
  const res = await sendMessage({ type: "GET_STATS" });
  const stats = res?.stats || {};
  const csv = statsToCsv(stats);
  triggerPopupDownload(csv || "date,platform,input_tokens,output_tokens,total_tokens", "llm_token_analytics.csv", "text/csv");
}

async function handleClearStats() {
  await sendMessage({ type: "CLEAR_STATS" });
  await renderStats();
}

// --- Full conversation exporter -------------------------------------------------

function extractConversationFromPage() {
  // Runs inside the active tab via chrome.scripting.executeScript.
  function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) return "chatgpt";
    if (host.includes("claude.ai")) return "claude";
    if (host.includes("chat.deepseek.com")) return "deepseek";
    if (host.includes("gemini.google.com")) return "gemini";
    return "unknown";
  }

  const platform = detectPlatform();
  const SELECTORS = {
    chatgpt: {
      turn: "[data-message-author-role]",
      role: (el) => el.getAttribute("data-message-author-role")
    },
    claude: {
      turn: '[data-testid="user-message"], .font-claude-message',
      role: (el) => (el.matches('[data-testid="user-message"]') ? "user" : "assistant")
    },
    deepseek: {
      turn: '[class*="message"]',
      role: (el) =>
        el.className.toLowerCase().includes("user") ? "user" : "assistant"
    },
    gemini: {
      turn: "user-query, model-response",
      role: (el) => (el.tagName.toLowerCase() === "user-query" ? "user" : "assistant")
    }
  };

  const cfg = SELECTORS[platform];
  if (!cfg) return { platform, title: document.title, turns: [] };

  const nodes = Array.from(document.querySelectorAll(cfg.turn));
  const turns = nodes
    .map((el) => ({
      role: cfg.role(el),
      text: (el.innerText || el.textContent || "").trim(),
      html: el.innerHTML
    }))
    .filter((t) => t.text);

  return { platform, title: document.title, turns };
}

async function getActiveTabConversation() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab");
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractConversationFromPage
  });
  return result;
}

function conversationToMarkdown(convo) {
  const lines = [`# ${convo.title}`, ""];
  convo.turns.forEach((t) => {
    lines.push(`### ${t.role === "user" ? "🧑 User" : "🤖 Assistant"}`);
    lines.push("");
    lines.push(t.text);
    lines.push("");
  });
  return lines.join("\n");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function conversationToHtml(convo) {
  const body = convo.turns
    .map(
      (t) => `
      <div class="turn ${t.role}">
        <div class="role">${t.role === "user" ? "User" : "Assistant"}</div>
        <div class="content">${t.html || `<p>${escapeHtml(t.text)}</p>`}</div>
      </div>`
    )
    .join("\n");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
    convo.title
  )}</title><style>
    body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:820px;margin:0 auto;padding:24px;color:#1a1a1a;}
    .turn{margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #eee;}
    .role{font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#6d5efc;margin-bottom:6px;}
    pre{background:#f6f8fa;border:1px solid #e1e4e8;border-radius:6px;padding:12px;overflow:auto;}
  </style></head><body>
  <h1>${escapeHtml(convo.title)}</h1>
  ${body}
  </body></html>`;
}

function setStatus(msg) {
  document.getElementById("exportStatus").textContent = msg;
}

async function handleFullExport(format) {
  setStatus("Reading active conversation…");
  try {
    const convo = await getActiveTabConversation();
    if (!convo || convo.platform === "unknown" || !convo.turns.length) {
      setStatus("Open a supported LLM chat tab with visible messages first.");
      return;
    }

    const safeTitle = (convo.title || "conversation").replace(/[^a-z0-9_\-]+/gi, "_").slice(0, 60);

    if (format === "markdown") {
      triggerPopupDownload(conversationToMarkdown(convo), `${safeTitle}.md`, "text/markdown");
    } else if (format === "html") {
      triggerPopupDownload(conversationToHtml(convo), `${safeTitle}.html`, "text/html");
    } else if (format === "pdf") {
      const html = conversationToHtml(convo);
      const blob = new Blob([html + `<script>window.onload=()=>setTimeout(()=>window.print(),300);</script>`], {
        type: "text/html"
      });
      const url = URL.createObjectURL(blob);
      await chrome.tabs.create({ url });
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
    setStatus("Export ready.");
  } catch (err) {
    setStatus("Export failed: " + (err?.message || String(err)));
  }
}

async function detectActivePlatformBadge() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url || "";
    const found = Object.entries({
      "chatgpt.com": "ChatGPT",
      "chat.openai.com": "ChatGPT",
      "claude.ai": "Claude",
      "chat.deepseek.com": "DeepSeek",
      "gemini.google.com": "Gemini"
    }).find(([host]) => url.includes(host));
    document.getElementById("platformBadge").textContent = found
      ? `Active on ${found[1]}`
      : "Not on a supported LLM site";
  } catch {
    // ignore
  }
}

const presetSelectEl = document.getElementById("presetQuotaSelect");
if (presetSelectEl) {
  presetSelectEl.addEventListener("change", handlePresetChange);
}
document.getElementById("saveLimitBtn").addEventListener("click", handleSaveLimit);
document.getElementById("exportCsvBtn").addEventListener("click", handleExportCsv);
document.getElementById("clearStatsBtn").addEventListener("click", handleClearStats);
document.querySelectorAll("[data-export-format]").forEach((btn) => {
  btn.addEventListener("click", () => handleFullExport(btn.dataset.exportFormat));
});

renderStats();
detectActivePlatformBadge();


