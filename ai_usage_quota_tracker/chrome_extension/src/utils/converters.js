// Blob export engine: PDF (print-to-PDF), DOCX (real OOXML via JSZip),
// JSON, YAML and self-contained HTML.
import JSZip from "jszip";

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Export selected content (HTML fragment + plain text fallback) as a
 * self-contained, print-ready HTML document and open the browser print
 * dialog so the user can "Save as PDF" with formatting/highlighting intact.
 */
export function exportAsPdf({ html, text, title = "LLM Export" }) {
  const content = html || `<pre>${escapeHtml(text || "")}</pre>`;
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
    title
  )}</title><style>
    body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;line-height:1.55;padding:32px;max-width:800px;margin:0 auto;}
    pre{background:#f6f8fa;border:1px solid #e1e4e8;border-radius:6px;padding:14px;white-space:pre-wrap;word-break:break-word;font-family:Consolas,Menlo,monospace;font-size:13px;}
    code{font-family:Consolas,Menlo,monospace;}
    h1{font-size:18px;border-bottom:1px solid #eee;padding-bottom:8px;}
    @media print{ body{padding:0;} }
  </style></head><body>
    <h1>${escapeHtml(title)}</h1>
    ${content}
    <script>window.onload=()=>{setTimeout(()=>window.print(),300);};</script>
  </body></html>`;
  const blob = new Blob([doc], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank");
  if (!printWindow) {
    // Popup blocked: fall back to a plain HTML download the user can print manually.
    triggerDownload(blob, `${sanitizeFilename(title)}_${timestamp()}.html`);
  } else {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

/**
 * Build a minimal, valid .docx (OOXML) file from an HTML fragment or plain
 * text and trigger a download. Handles paragraphs, line breaks, headings
 * and <pre>/<code> blocks (rendered monospace).
 */
export async function exportAsDocx({ html, text, title = "LLM Export" }) {
  const zip = new JSZip();

  const paragraphs = htmlToDocxParagraphs(html, text);

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );

  zip.folder("_rels").file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  const word = zip.folder("word");
  word.folder("_rels").file(
    "document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`
  );

  word.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.join("\n")}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`
  );

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
  triggerDownload(blob, `${sanitizeFilename(title)}_${timestamp()}.docx`);
}

function htmlToDocxParagraphs(html, fallbackText) {
  const paras = [];
  if (html) {
    const container = document.createElement("div");
    container.innerHTML = html;
    const blocks = container.querySelectorAll(
      "p, h1, h2, h3, li, pre, div, span, td"
    );
    const seen = new Set();
    const nodes = blocks.length ? Array.from(blocks) : [container];
    nodes.forEach((node) => {
      const t = node.innerText || node.textContent || "";
      if (!t.trim() || seen.has(t)) return;
      seen.add(t);
      const isCode = node.tagName === "PRE" || node.querySelector?.("code");
      t.split("\n").forEach((line) => {
        paras.push(docxParagraph(line, isCode));
      });
    });
  }
  if (!paras.length) {
    const t = fallbackText || "";
    t.split("\n").forEach((line) => paras.push(docxParagraph(line, false)));
  }
  return paras.length ? paras : [docxParagraph("", false)];
}

function docxParagraph(text, monospace) {
  const rpr = monospace
    ? `<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/></w:rPr>`
    : "";
  return `<w:p><w:r>${rpr}<w:t xml:space="preserve">${escapeXml(
    text
  )}</w:t></w:r></w:p>`;
}

function sanitizeFilename(name) {
  return String(name)
    .replace(/[^a-z0-9_\-]+/gi, "_")
    .slice(0, 60) || "export";
}

/** Export selection as structured JSON. */
export function exportAsJson({ text, meta = {} }) {
  const payload = {
    selected_context: text,
    timestamp: new Date().toISOString(),
    ...meta
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  triggerDownload(blob, `llm_selection_${timestamp()}.json`);
}

/** Export selection as YAML. Converts obvious key: value lines, else raw block scalar. */
export function exportAsYaml({ text, meta = {} }) {
  const lines = text.split("\n");
  const kvPattern = /^[\w\- ]{1,40}:\s?.+/;
  const looksStructured =
    lines.filter((l) => kvPattern.test(l.trim())).length > lines.length * 0.5;

  let yaml;
  if (looksStructured) {
    yaml = lines
      .map((l) => {
        const trimmed = l.trim();
        if (!trimmed) return "";
        const idx = trimmed.indexOf(":");
        if (idx === -1) return `  ${yamlScalar(trimmed)}`;
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        return `${sanitizeYamlKey(key)}: ${yamlScalar(val)}`;
      })
      .join("\n");
  } else {
    const indented = text
      .split("\n")
      .map((l) => `  ${l}`)
      .join("\n");
    yaml = `selected_context: |\n${indented}`;
  }
  yaml += `\ntimestamp: "${new Date().toISOString()}"`;
  Object.entries(meta).forEach(([k, v]) => {
    yaml += `\n${sanitizeYamlKey(k)}: ${yamlScalar(String(v))}`;
  });

  const blob = new Blob([yaml], { type: "text/yaml" });
  triggerDownload(blob, `llm_selection_${timestamp()}.yaml`);
}

function sanitizeYamlKey(key) {
  return key.replace(/[^\w\- ]/g, "").trim() || "field";
}

function yamlScalar(val) {
  if (/^-?\d+(\.\d+)?$/.test(val)) return val;
  if (/^(true|false|null)$/i.test(val)) return val.toLowerCase();
  const escaped = val.replace(/"/g, '\\"');
  return `"${escaped}"`;
}

/** Export selection as self-contained HTML with inline styles. */
export function exportAsHtml({ html, text, title = "LLM Export" }) {
  const content = html || `<pre>${escapeHtml(text || "")}</pre>`;
  const doc = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;background:#fff;line-height:1.6;padding:24px;max-width:820px;margin:0 auto;}
  pre{background:#f6f8fa;border:1px solid #e1e4e8;border-radius:6px;padding:14px;overflow:auto;font-family:Consolas,Menlo,monospace;font-size:13px;}
  code{font-family:Consolas,Menlo,monospace;}
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${content}
<hr><small>Exported ${new Date().toLocaleString()} via LLM Artifact, Crop Exporter &amp; Token Engine</small>
</body>
</html>`;
  const blob = new Blob([doc], { type: "text/html" });
  triggerDownload(blob, `llm_selection_${timestamp()}.html`);
}

export { triggerDownload, timestamp, sanitizeFilename, escapeHtml };
