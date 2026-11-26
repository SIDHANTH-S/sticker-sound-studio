const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const STAGE = path.join(DIST, "_stage");

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
const zipName = `sound-stickers-for-web-chat-${manifest.version}.zip`;
const zipPath = path.join(DIST, zipName);

const INCLUDE = [
  "manifest.json",
  "background.js",
  "log.html",
  "log.js",
  "LICENSE.md",
  "NOTICE",
  "README.md",
  "src",
  "icons",
  "_locales",
];

function copyFiltered(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (entry === "icon.svg") continue;
      copyFiltered(path.join(src, entry), path.join(dst, entry));
    }
  } else {
    fs.copyFileSync(src, dst);
  }
}

fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });

for (const item of INCLUDE) {
  const src = path.join(ROOT, item);
  if (!fs.existsSync(src)) {
    throw new Error(`Required build file missing: ${item}`);
  }
  copyFiltered(src, path.join(STAGE, item));
}

if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

// Build a cross-platform zip with forward-slash paths and manifest.json at the archive root.
const psScript = `
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stage = [System.IO.Path]::GetFullPath("${STAGE.replace(/\\/g, "\\\\")}")
$zipFile = [System.IO.Compression.ZipFile]::Open("${zipPath.replace(/\\/g, "\\\\")}", [System.IO.Compression.ZipArchiveMode]::Create)
try {
  Get-ChildItem -Path $stage -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($stage.Length + 1).Replace("\\", "/")
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipFile, $_.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally {
  $zipFile.Dispose()
}
`;

execFileSync("powershell.exe", ["-NoProfile", "-Command", psScript], { stdio: "inherit" });

fs.rmSync(STAGE, { recursive: true, force: true });
const size = fs.statSync(zipPath).size;
console.log(`Built ${zipPath} (${size} bytes)`);
