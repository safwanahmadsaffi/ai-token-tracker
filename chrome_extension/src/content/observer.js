// Single shared MutationObserver that watches the chat DOM for newly
// rendered code blocks (ChatGPT, Claude, DeepSeek, Gemini all stream
// content in, so blocks appear incrementally) and hands them to the code
// injector.

import { scanForCodeBlocks } from "./codeInjector.js";

let observerStarted = false;

export function startObserver() {
  if (observerStarted) return;
  observerStarted = true;

  scanForCodeBlocks(document);

  let scanScheduled = false;
  const scheduleScan = () => {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(() => {
      scanScheduled = false;
      scanForCodeBlocks(document);
    });
  };

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length) {
        scheduleScan();
        break;
      }
    }
  });

  mo.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("beforeunload", () => mo.disconnect());
}
