// Background service worker: aggregates token analytics into
// chrome.storage.local, manages daily quota settings, and centralizes file downloads.

const STATS_KEY = "llmext_stats_v1";
const DAILY_LIMIT_KEY = "llmext_daily_limit_v1";
const DEFAULT_DAILY_LIMIT = 100000; // 100,000 tokens default daily quota
const MAX_DAYS_RETAINED = 90;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

async function getStats() {
  const data = await chrome.storage.local.get(STATS_KEY);
  return data[STATS_KEY] || {};
}

async function setStats(stats) {
  // Prune old days so storage.local never grows unbounded.
  const keys = Object.keys(stats).sort();
  if (keys.length > MAX_DAYS_RETAINED) {
    const remove = keys.slice(0, keys.length - MAX_DAYS_RETAINED);
    remove.forEach((k) => delete stats[k]);
  }
  await chrome.storage.local.set({ [STATS_KEY]: stats });
}

async function getDailyLimit() {
  const data = await chrome.storage.local.get(DAILY_LIMIT_KEY);
  return data[DAILY_LIMIT_KEY] !== undefined ? Number(data[DAILY_LIMIT_KEY]) : DEFAULT_DAILY_LIMIT;
}

async function setDailyLimit(limit) {
  const num = Math.max(1000, Number(limit) || DEFAULT_DAILY_LIMIT);
  await chrome.storage.local.set({ [DAILY_LIMIT_KEY]: num });
  return num;
}

function calculateTodayTotal(stats) {
  const today = stats[todayKey()] || {};
  return Object.values(today).reduce((sum, platformEntry) => {
    return sum + (platformEntry.input || 0) + (platformEntry.output || 0);
  }, 0);
}

const SKYSIZE_ODOO_URL_KEY = "llmext_skysize_url_v1";
const DEFAULT_SKYSIZE_URL = "https://ai-token-tracker.skysize.io";

async function syncToSkysize(platform, tokens) {
  try {
    const data = await chrome.storage.local.get(SKYSIZE_ODOO_URL_KEY);
    const baseUrl = data[SKYSIZE_ODOO_URL_KEY] || DEFAULT_SKYSIZE_URL;
    const endpoint = `${baseUrl.replace(/\/$/, "")}/ai_tracker/log_usage`;

    const payload = JSON.stringify({
      jsonrpc: "2.0",
      params: {
        provider: platform,
        model: platform,
        tokens: tokens
      }
    });

    try {
      await fetch(endpoint, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: payload
      });
    } catch {
      // Fallback with text/plain to bypass browser CORS preflight if server preflight headers are missing
      await fetch(endpoint, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "text/plain" },
        body: payload
      });
    }
  } catch (err) {
    console.warn("Skysize Odoo sync failed:", err);
  }
}

async function recordTokenEvent(platform, direction, tokens) {
  if (!platform || !tokens || tokens <= 0) return;
  const stats = await getStats();
  const day = todayKey();
  stats[day] = stats[day] || {};
  stats[day][platform] = stats[day][platform] || { input: 0, output: 0 };
  stats[day][platform][direction] =
    (stats[day][platform][direction] || 0) + tokens;
  await setStats(stats);
  syncToSkysize(platform, tokens);
}

async function downloadTextFile({ filename, content, mimeType }) {
  const blob = new Blob([content], { type: mimeType || "text/plain" });
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({
      url,
      filename,
      saveAs: false,
      conflictAction: "uniquify"
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case "TOKEN_EVENT": {
        await recordTokenEvent(
          message.platform,
          message.direction,
          message.tokens
        );
        const stats = await getStats();
        const dailyLimit = await getDailyLimit();
        const todayTotal = calculateTodayTotal(stats);
        sendResponse({ ok: true, todayTotal, dailyLimit });
        break;
      }
      case "GET_STATS": {
        const stats = await getStats();
        const dailyLimit = await getDailyLimit();
        const todayTotal = calculateTodayTotal(stats);
        sendResponse({ ok: true, stats, dailyLimit, todayTotal });
        break;
      }
      case "SET_DAILY_LIMIT": {
        const limit = await setDailyLimit(message.limit);
        sendResponse({ ok: true, dailyLimit: limit });
        break;
      }
      case "CLEAR_STATS": {
        await chrome.storage.local.set({ [STATS_KEY]: {} });
        sendResponse({ ok: true });
        break;
      }
      case "DOWNLOAD_FILE": {
        try {
          await downloadTextFile(message.payload);
          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({ ok: false, error: String(err) });
        }
        break;
      }
      default:
        sendResponse({ ok: false, error: "unknown_message_type" });
    }
  })();
  return true; // keep the message channel open for the async response
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([STATS_KEY, DAILY_LIMIT_KEY]).then((data) => {
    if (!data[STATS_KEY]) {
      chrome.storage.local.set({ [STATS_KEY]: {} });
    }
    if (data[DAILY_LIMIT_KEY] === undefined) {
      chrome.storage.local.set({ [DAILY_LIMIT_KEY]: DEFAULT_DAILY_LIMIT });
    }
  });
});

