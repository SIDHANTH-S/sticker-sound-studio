const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const TARGETS = [
  "background.js",
  "log.js",
  "log.html",
  "manifest.json",
  ...fs.readdirSync(path.join(ROOT, "src")).map((f) => path.join("src", f)),
];

const FORBIDDEN = [
  { name: "fetch()", re: /\bfetch\s*\(/g },
  { name: "XMLHttpRequest", re: /\bXMLHttpRequest\b/g },
  { name: "WebSocket", re: /\bWebSocket\b/g },
  { name: "sendBeacon", re: /\bsendBeacon\b/g },
  { name: "eval()", re: /\beval\s*\(/g },
  { name: "new Function", re: /\bnew\s+Function\b/g },
  { name: "innerHTML", re: /\binnerHTML\b/g },
  { name: "ko-fi / donation", re: /ko-?fi|apoyar/gi },
];

let failures = 0;

for (const rel of TARGETS) {
  const full = path.join(ROOT, rel);
  const content = fs.readFileSync(full, "utf8");
  for (const rule of FORBIDDEN) {
    const matches = content.match(rule.re);
    if (matches) {
      console.error(`FAIL [${rule.name}] found in ${rel}: ${matches.join(", ")}`);
      failures++;
    }
  }
}

if (failures > 0) {
  process.exit(1);
}

console.log(`Security check passed across ${TARGETS.length} runtime files.`);
