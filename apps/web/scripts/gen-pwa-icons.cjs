const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

const svg = fs.readFileSync(path.join(__dirname, "..", "public", "favicon.svg"));

async function make(size, name, { maskable = false } = {}) {
  let pipeline = sharp(svg).resize(size, size);
  if (maskable) {
    const padded = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#070b08"/>
  <g transform="translate(56,56) scale(12.5)">
    <circle cx="16" cy="16" r="10" fill="none" stroke="#e6a31a" stroke-width="2"/>
    <path d="M16 6v20M6 16h20" stroke="#6fbf73" stroke-width="1"/>
  </g>
</svg>`);
    pipeline = sharp(padded).resize(size, size);
  }
  await pipeline.png().toFile(path.join(outDir, name));
  console.log("wrote", name);
}

(async () => {
  await make(192, "icon-192.png");
  await make(512, "icon-512.png");
  await make(512, "icon-512-maskable.png", { maskable: true });
  await make(180, "apple-touch-icon.png");
})();
