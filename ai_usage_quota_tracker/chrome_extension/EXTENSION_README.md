# LLM Artifact, Crop Exporter & Token Engine

A Manifest V3 Chrome extension that runs entirely client-side (no backend,
no hosting cost) and augments **ChatGPT**, **Claude**, **DeepSeek**, and
**Gemini** with:

1. **Automated code file downloads** — every rendered code block gets a
   "Download .ext" button, with filenames inferred from inline comments
   (`// main.cpp`, `# app.py`, ...) or timestamped fallbacks.
2. **Floating crop & format converter toolbar** — select any text/code in a
   chat message and export it as **PDF**, **Word (.docx)**, **JSON**,
   **YAML**, or self-contained **HTML**.
3. **Multi-platform live token tracker** — real BPE token counting for
   ChatGPT (`o200k_base` via `js-tiktoken`) and a calibrated
   chars-per-token heuristic for Claude / DeepSeek / Gemini, with live
   input-box badges, per-response output badges, daily local analytics
   (`chrome.storage.local`), and a popup dashboard with CSV export.
4. **Full conversation exporter** — one click in the popup exports the
   active chat thread to Markdown, HTML, or PDF.

## Project structure

```
├── manifest source: src/manifest.json   (copied verbatim into dist/)
├── build.js               # esbuild bundler -> dist/
├── scripts/make-icons.js  # generates icons/icon{16,48,128}.png (no deps)
├── src/
│   ├── background/serviceWorker.js   # download handler + storage/analytics sync
│   ├── content/
│   │   ├── index.js         # entry point, wires everything up
│   │   ├── platforms.js     # per-site DOM selector map + detection
│   │   ├── observer.js      # shared MutationObserver -> code block scan
│   │   ├── codeInjector.js  # code block parsing + download button injection
│   │   ├── cropToolbar.js   # selection listener + floating convert toolbar
│   │   └── tokenCounter.js  # live tokenizer badges (input + output)
│   ├── popup/
│   │   ├── popup.html / popup.css / popup.js   # dashboard, CSV export, full exporter
│   ├── utils/
│   │   ├── converters.js    # PDF / DOCX / JSON / YAML / HTML export engine
│   │   └── tokenizers.js    # js-tiktoken wrapper + heuristic estimator
│   └── styles/injected.css  # isolated `.llm-ext-*` styles for injected UI
└── dist/                   # built, load-unpacked-ready extension (checked in)
```

## Build

The repo ships a pre-built `dist/` folder, so you can load it immediately
(see below) without installing anything. To rebuild after changing source:

```bash
npm install
npm run build      # bundles src/ -> dist/ with esbuild
npm run icons      # regenerate icons/icon*.png if needed
```

`npm run watch` rebuilds on file change during development.

## Install (load unpacked)

1. Run `npm install && npm run build` (or just use the committed `dist/`).
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the `dist/` folder.
5. Visit chatgpt.com, claude.ai, chat.deepseek.com, or gemini.google.com.

## Implementation notes

- **Code downloads**: a single shared `MutationObserver` (`observer.js`)
  batches DOM scans via `requestAnimationFrame` and hands new `<pre>`
  blocks to `codeInjector.js`, which maps `language-*` classes to file
  extensions, looks for an inline filename comment on the first 3 lines,
  and falls back to `snippet_<timestamp>.<ext>`. Downloads use
  `URL.createObjectURL(new Blob(...))` + a synthetic `<a download>` click.
- **Crop/convert toolbar**: listens for `mouseup` + `selectionchange`
  inside each platform's message container (see `platforms.js`), clones the
  selected `Range` to preserve formatting, and positions a floating
  toolbar above the selection. PDF export renders a print-ready HTML
  document in a new tab and triggers `window.print()` (preserves
  highlighting/formatting via the browser's own print pipeline — the most
  reliable dependency-free way to get a client-side PDF). DOCX export
  builds a real, minimal OOXML `.docx` (zipped with `jszip`) rather than an
  HTML-renamed-to-.doc hack.
- **Token tracking**: ChatGPT token counts use `js-tiktoken`'s `o200k_base`
  encoding (imported via its `lite` + single-rank-file entry points so the
  bundle doesn't pull in every vocabulary — still ~2.3MB of local rank
  data, which is normal for exact BPE tokenization and never touches the
  network). Claude/DeepSeek/Gemini use a blended chars-per-token +
  word-count heuristic calibrated per platform. Every token event is sent
  to the background service worker, which aggregates totals into
  `chrome.storage.local` keyed by day and platform, pruning anything older
  than 90 days so storage never grows unbounded.
- **Popup dashboard**: reads today's aggregated stats, renders per-platform
  totals, and can export the full stored history as CSV
  (`date,platform,input_tokens,output_tokens,total_tokens`). The full
  conversation exporter uses `chrome.scripting.executeScript` to pull
  message turns out of the active tab's DOM, then serializes to
  Markdown/HTML, or opens a print-ready tab for PDF.
- **Style isolation**: every injected element uses `.llm-ext-*` class names
  with a scoped stylesheet (`styles/injected.css`) so nothing collides with
  host-page CSS.

## Permissions

`storage`, `downloads`, `activeTab`, `scripting`, and host permissions
scoped to the four supported chat domains only. No remote hosts, no
analytics/telemetry endpoints — all data stays in `chrome.storage.local`.

## Known limitations

- Site DOM structures change frequently; selectors in `platforms.js`
  include fallbacks but may need updates if ChatGPT/Claude/DeepSeek/Gemini
  ship a redesign.
- PDF export relies on the browser's native print-to-PDF flow rather than
  a headless PDF renderer, so exact pixel-for-pixel fidelity depends on
  the browser's print CSS support (very good in Chrome).
- Claude/DeepSeek/Gemini token counts are heuristic estimates, not exact
  BPE counts (no public offline vocab is shipped for those model
  families).
