// Main content-script entry point: detects which LLM site we're on and
// wires up the code-block downloader, crop/convert toolbar and live token
// counter. Bundled by esbuild into content/bundle.js (see build.js).

import { detectPlatform } from "./platforms.js";
import { startObserver } from "./observer.js";
import { initCropToolbar } from "./cropToolbar.js";
import { initTokenCounter } from "./tokenCounter.js";

function boot() {
  const platform = detectPlatform();
  if (platform === "unknown") return;

  document.documentElement.setAttribute("data-llm-ext-platform", platform);

  startObserver();
  initCropToolbar(platform);
  initTokenCounter(platform);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
