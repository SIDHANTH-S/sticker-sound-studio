const fs = require("node:fs");
const path = require("node:path");
const { Resvg } = require("@resvg/resvg-js");

const ICONS_DIR = path.resolve(__dirname, "..", "icons");
const SVG_PATH = path.join(ICONS_DIR, "icon.svg");
const SIZES = [16, 32, 48, 128];

const svg = fs.readFileSync(SVG_PATH, "utf8");

for (const size of SIZES) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
  });
  const pngData = resvg.render().asPng();
  const outPath = path.join(ICONS_DIR, `icon-${size}.png`);
  fs.writeFileSync(outPath, pngData);
  console.log(`Generated ${outPath} (${pngData.length} bytes)`);
}
