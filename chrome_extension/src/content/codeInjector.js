// Detects rendered code blocks and injects a "Download .ext" button into
// each block's header (or directly onto the <pre> if the site has no
// header row).

const LANGUAGE_EXT_MAP = {
  javascript: "js",
  js: "js",
  jsx: "jsx",
  typescript: "ts",
  ts: "ts",
  tsx: "tsx",
  python: "py",
  py: "py",
  cpp: "cpp",
  "c++": "cpp",
  c: "c",
  csharp: "cs",
  cs: "cs",
  java: "java",
  go: "go",
  golang: "go",
  rust: "rs",
  rs: "rs",
  ruby: "rb",
  rb: "rb",
  php: "php",
  html: "html",
  xml: "xml",
  css: "css",
  scss: "scss",
  sass: "sass",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  bash: "sh",
  sh: "sh",
  shell: "sh",
  zsh: "sh",
  powershell: "ps1",
  sql: "sql",
  swift: "swift",
  kotlin: "kt",
  kt: "kt",
  dart: "dart",
  r: "r",
  scala: "scala",
  lua: "lua",
  perl: "pl",
  haskell: "hs",
  markdown: "md",
  md: "md",
  dockerfile: "dockerfile",
  makefile: "makefile",
  toml: "toml",
  ini: "ini",
  diff: "diff",
  plaintext: "txt",
  text: "txt"
};

const INLINE_FILENAME_PATTERNS = [
  /^\s*(?:\/\/|#|--|;|<!--)\s*([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)\s*(?:-->)?\s*$/,
  /^\s*\/\*\s*([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)\s*\*\/\s*$/
];

function detectLanguageFromClassName(className) {
  if (!className) return null;
  const match = className.match(/language-([a-zA-Z0-9+#]+)/);
  if (match) return match[1].toLowerCase();
  return null;
}

function extForLanguage(lang) {
  if (!lang) return "txt";
  return LANGUAGE_EXT_MAP[lang.toLowerCase()] || lang.toLowerCase() || "txt";
}

function detectInlineFilename(codeText) {
  const firstLines = codeText.split("\n").slice(0, 3);
  for (const line of firstLines) {
    for (const pattern of INLINE_FILENAME_PATTERNS) {
      const m = line.match(pattern);
      if (m) return m[1];
    }
  }
  return null;
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function buildFilename(codeText, ext) {
  const inline = detectInlineFilename(codeText);
  if (inline) return inline;
  return `snippet_${timestamp()}.${ext}`;
}

function downloadCode(codeText, filename) {
  const blob = new Blob([codeText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function makeButton(label) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "llm-ext-btn llm-ext-download-btn";
  btn.textContent = label;
  return btn;
}

function findHeaderBar(preEl) {
  // Most sites wrap <pre> in a container with a small header row that
  // already hosts a "Copy code" button. Reuse that row when present.
  const parent = preEl.parentElement;
  if (!parent) return null;
  const candidates = parent.querySelectorAll(
    ':scope > div, :scope > .flex, :scope > [class*="header"]'
  );
  for (const el of candidates) {
    if (el.contains(preEl)) continue;
    const text = el.textContent || "";
    if (
      el.querySelector("button") ||
      /copy/i.test(text) ||
      el.className.toLowerCase().includes("header")
    ) {
      return el;
    }
  }
  return null;
}

export function processCodeBlock(preEl) {
  if (!preEl || preEl.dataset.llmExtProcessed === "1") return;
  const codeEl = preEl.querySelector("code") || preEl;
  const className = codeEl.className || preEl.className || "";
  const lang = detectLanguageFromClassName(className);
  const ext = extForLanguage(lang);
  const codeText = codeEl.innerText || codeEl.textContent || "";
  if (!codeText.trim()) return;

  preEl.dataset.llmExtProcessed = "1";

  const label = `Download .${ext}`;
  const btn = makeButton(label);
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const filename = buildFilename(codeText, ext);
    downloadCode(codeText, filename);
    btn.textContent = "Saved!";
    setTimeout(() => {
      btn.textContent = label;
    }, 1500);
  });

  const header = findHeaderBar(preEl);
  if (header) {
    header.appendChild(btn);
  } else {
    const floating = document.createElement("div");
    floating.className = "llm-ext-code-toolbar";
    floating.appendChild(btn);
    preEl.style.position = preEl.style.position || "relative";
    preEl.prepend(floating);
  }
}

export function scanForCodeBlocks(root = document) {
  const pres = root.querySelectorAll("pre:not([data-llm-ext-processed])");
  pres.forEach((pre) => processCodeBlock(pre));
}

export { LANGUAGE_EXT_MAP, extForLanguage, detectLanguageFromClassName };
