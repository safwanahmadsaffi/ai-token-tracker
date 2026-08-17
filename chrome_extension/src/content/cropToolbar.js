// Floating "crop & convert" toolbar: appears above any text selection made
// inside an LLM chat message and offers PDF / DOCX / JSON / YAML / HTML
// export of the selected content.

import {
  exportAsPdf,
  exportAsDocx,
  exportAsJson,
  exportAsYaml,
  exportAsHtml
} from "../utils/converters.js";
import { getPlatformConfig } from "./platforms.js";

let toolbarEl = null;
let currentSelectionHtml = "";
let currentSelectionText = "";
let hideTimer = null;

function buildToolbar() {
  if (toolbarEl) return toolbarEl;

  const el = document.createElement("div");
  el.className = "llm-ext-toolbar";
  el.innerHTML = `
    <button type="button" class="llm-ext-toolbar-btn" data-action="toggle">
      Convert &amp; Download <span class="llm-ext-caret">&#9662;</span>
    </button>
    <div class="llm-ext-toolbar-menu">
      <button type="button" data-format="pdf">PDF</button>
      <button type="button" data-format="docx">WORD (.docx)</button>
      <button type="button" data-format="json">JSON</button>
      <button type="button" data-format="yaml">YAML</button>
      <button type="button" data-format="html">HTML</button>
    </div>
  `;
  document.body.appendChild(el);

  el.querySelector('[data-action="toggle"]').addEventListener(
    "click",
    (e) => {
      e.stopPropagation();
      el.classList.toggle("llm-ext-open");
    }
  );

  el.querySelectorAll("[data-format]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleExport(btn.dataset.format);
      el.classList.remove("llm-ext-open");
      hideToolbar();
    });
  });

  el.addEventListener("mouseenter", () => {
    if (hideTimer) clearTimeout(hideTimer);
  });
  el.addEventListener("mouseleave", scheduleHide);

  toolbarEl = el;
  return el;
}

function handleExport(format) {
  const title = document.title?.replace(/\s*[-|].*$/, "").trim() || "LLM Export";
  const payload = {
    html: currentSelectionHtml,
    text: currentSelectionText,
    title
  };
  switch (format) {
    case "pdf":
      exportAsPdf(payload);
      break;
    case "docx":
      exportAsDocx(payload);
      break;
    case "json":
      exportAsJson({ text: currentSelectionText, meta: { source: title } });
      break;
    case "yaml":
      exportAsYaml({ text: currentSelectionText, meta: { source: title } });
      break;
    case "html":
      exportAsHtml(payload);
      break;
  }
}

function scheduleHide() {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(hideToolbar, 4000);
}

function hideToolbar() {
  if (!toolbarEl) return;
  toolbarEl.classList.remove("llm-ext-visible", "llm-ext-open");
}

function positionToolbar(rect) {
  const el = buildToolbar();
  const top = window.scrollY + rect.top - el.offsetHeight - 10;
  const left = window.scrollX + rect.left + rect.width / 2;
  el.style.top = `${Math.max(window.scrollY + 8, top)}px`;
  el.style.left = `${left}px`;
  el.classList.add("llm-ext-visible");
  scheduleHide();
}

function isInsideChatMessage(node, platform) {
  const cfg = getPlatformConfig(platform);
  if (!cfg) return true;
  const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!el) return false;
  return Boolean(el.closest(cfg.messageContainer));
}

export function initCropToolbar(platform) {
  const onSelectionEnd = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return;
    }
    const range = selection.getRangeAt(0);
    const text = selection.toString();
    if (!text || text.trim().length < 3) return;

    if (!isInsideChatMessage(range.commonAncestorContainer, platform)) return;

    const container = document.createElement("div");
    container.appendChild(range.cloneContents());
    currentSelectionHtml = container.innerHTML;
    currentSelectionText = text;

    const rect = range.getBoundingClientRect();
    if (rect && (rect.width || rect.height)) {
      positionToolbar(rect);
    }
  };

  document.addEventListener("mouseup", () => {
    setTimeout(onSelectionEnd, 10);
  });

  document.addEventListener("selectionchange", () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      scheduleHide();
    }
  });

  document.addEventListener("mousedown", (e) => {
    if (toolbarEl && !toolbarEl.contains(e.target)) {
      toolbarEl.classList.remove("llm-ext-open");
    }
  });

  window.addEventListener("scroll", () => {
    if (toolbarEl && toolbarEl.classList.contains("llm-ext-visible")) {
      hideToolbar();
    }
  });
}
