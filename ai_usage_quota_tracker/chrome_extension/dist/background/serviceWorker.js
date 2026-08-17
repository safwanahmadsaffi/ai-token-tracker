(() => {
  // src/background/serviceWorker.js
  var STATS_KEY = "llmext_stats_v1";
  var DAILY_LIMIT_KEY = "llmext_daily_limit_v1";
  var DEFAULT_DAILY_LIMIT = 1e5;
  var MAX_DAYS_RETAINED = 90;
  function todayKey() {
    const d = /* @__PURE__ */ new Date();
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
    const keys = Object.keys(stats).sort();
    if (keys.length > MAX_DAYS_RETAINED) {
      const remove = keys.slice(0, keys.length - MAX_DAYS_RETAINED);
      remove.forEach((k) => delete stats[k]);
    }
    await chrome.storage.local.set({ [STATS_KEY]: stats });
  }
  async function getDailyLimit() {
    const data = await chrome.storage.local.get(DAILY_LIMIT_KEY);
    return data[DAILY_LIMIT_KEY] !== void 0 ? Number(data[DAILY_LIMIT_KEY]) : DEFAULT_DAILY_LIMIT;
  }
  async function setDailyLimit(limit) {
    const num = Math.max(1e3, Number(limit) || DEFAULT_DAILY_LIMIT);
    await chrome.storage.local.set({ [DAILY_LIMIT_KEY]: num });
    return num;
  }
  function calculateTodayTotal(stats) {
    const today = stats[todayKey()] || {};
    return Object.values(today).reduce((sum, platformEntry) => {
      return sum + (platformEntry.input || 0) + (platformEntry.output || 0);
    }, 0);
  }
  var SKYSIZE_ODOO_URL_KEY = "llmext_skysize_url_v1";
  var DEFAULT_SKYSIZE_URL = "https://ai-token-tracker.skysize.io";
  async function syncToSkysize(platform, tokens) {
    try {
      const data = await chrome.storage.local.get(SKYSIZE_ODOO_URL_KEY);
      const baseUrl = data[SKYSIZE_ODOO_URL_KEY] || DEFAULT_SKYSIZE_URL;
      const endpoint = `${baseUrl.replace(/\/$/, "")}/ai_tracker/log_usage`;
      await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          params: {
            provider: platform,
            model: platform,
            tokens
          }
        })
      });
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
    stats[day][platform][direction] = (stats[day][platform][direction] || 0) + tokens;
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
      setTimeout(() => URL.revokeObjectURL(url), 15e3);
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
    return true;
  });
  chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get([STATS_KEY, DAILY_LIMIT_KEY]).then((data) => {
      if (!data[STATS_KEY]) {
        chrome.storage.local.set({ [STATS_KEY]: {} });
      }
      if (data[DAILY_LIMIT_KEY] === void 0) {
        chrome.storage.local.set({ [DAILY_LIMIT_KEY]: DEFAULT_DAILY_LIMIT });
      }
    });
  });
})();
