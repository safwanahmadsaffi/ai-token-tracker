// Build script: bundles the ES-module source under src/ into a flat,
// dependency-free dist/ folder that can be loaded directly as an unpacked
// Chrome extension (chrome://extensions -> Load unpacked -> select dist/).
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");

const watch = process.argv.includes("--watch");

function rimraf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else copyFile(src, dest);
  }
}

async function build() {
  rimraf(DIST);
  fs.mkdirSync(DIST, { recursive: true });

  // Static assets
  copyFile(path.join(SRC, "manifest.json"), path.join(DIST, "manifest.json"));
  copyFile(
    path.join(SRC, "popup", "popup.html"),
    path.join(DIST, "popup", "popup.html")
  );
  copyFile(
    path.join(SRC, "popup", "popup.css"),
    path.join(DIST, "popup", "popup.css")
  );
  copyFile(
    path.join(SRC, "styles", "injected.css"),
    path.join(DIST, "styles", "injected.css")
  );
  copyDir(path.join(ROOT, "icons"), path.join(DIST, "icons"));

  const entryPoints = [
    {
      in: path.join(SRC, "content", "index.js"),
      out: path.join(DIST, "content", "bundle.js")
    },
    {
      in: path.join(SRC, "background", "serviceWorker.js"),
      out: path.join(DIST, "background", "serviceWorker.js")
    },
    {
      in: path.join(SRC, "popup", "popup.js"),
      out: path.join(DIST, "popup", "popup.js")
    }
  ];

  const buildOpts = entryPoints.map(({ in: infile, out }) => ({
    entryPoints: [infile],
    outfile: out,
    bundle: true,
    format: "iife",
    target: "chrome110",
    minify: false,
    sourcemap: false,
    logLevel: "info"
  }));

  if (watch) {
    const contexts = await Promise.all(
      buildOpts.map((opts) => esbuild.context(opts))
    );
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    console.log("Watching for changes...");
  } else {
    await Promise.all(buildOpts.map((opts) => esbuild.build(opts)));
    console.log("Build complete -> dist/");
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
