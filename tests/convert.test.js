const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  buildOggOpus,
  buildAnimatedWebp,
  buildStillWebp,
  fitTimeline,
  exifWhatsApp,
  readChunks,
  chunk,
  concat,
  oggCrc,
  plan,
  sha256b64,
  score,
  sampleAvg,
} = require("../src/convert.js");
const { formatMessage } = require("../src/i18n.js");

test("chunk, concat, and readChunks round-trip WebP RIFF containers", () => {
  const payloadA = new Uint8Array([1, 2, 3]); // odd size -> padded to 4
  const payloadB = new Uint8Array([10, 20, 30, 40]);
  const cA = chunk("TEST", payloadA);
  const cB = chunk("VP8 ", payloadB);
  assert.equal(cA.length, 8 + 3 + 1);
  assert.equal(cB.length, 8 + 4);

  const body = concat([cA, cB]);
  const riff = new Uint8Array(12);
  riff.set(new TextEncoder().encode("RIFF"), 0);
  new DataView(riff.buffer).setUint32(4, 4 + body.length, true);
  riff.set(new TextEncoder().encode("WEBP"), 8);

  const chunks = readChunks(concat([riff, body]));
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].fourcc, "TEST");
  assert.deepEqual(Array.from(chunks[0].data), [1, 2, 3]);
  assert.equal(chunks[1].fourcc, "VP8 ");
  assert.deepEqual(Array.from(chunks[1].data), [10, 20, 30, 40]);

  assert.throws(() => readChunks(new Uint8Array([0, 1, 2, 3])), /valid WebP/);
});

test("exifWhatsApp creates big-endian TIFF header with WA tag 0x5741", () => {
  const meta = { "sticker-pack-id": "abc", emojis: ["🔊"], "sound-sha256": "xyz" };
  const exif = exifWhatsApp(meta);
  const dv = new DataView(exif.buffer);
  assert.equal(exif[0], 0x4d); // 'M'
  assert.equal(exif[1], 0x4d); // 'M'
  assert.equal(dv.getUint16(2), 0x002a);
  assert.equal(dv.getUint32(4), 8);
  assert.equal(dv.getUint16(8), 1);
  assert.equal(dv.getUint16(10), 0x5741);
  assert.equal(dv.getUint16(12), 7);
  const jsonLen = dv.getUint32(14);
  const parsed = JSON.parse(new TextDecoder().decode(exif.subarray(26, 26 + jsonLen)));
  assert.deepEqual(parsed, meta);
});

test("buildAnimatedWebp and buildStillWebp produce valid RIFF/WEBP chunk structures", () => {
  const framePayload = chunk("VP8 ", new Uint8Array([0x9d, 0x01, 0x2a, 0x01, 0x00, 0x01, 0x00]));
  const exif = exifWhatsApp({ "sticker-pack-id": "test" });

  const anim = buildAnimatedWebp(
    [
      { payload: framePayload, hasAlpha: true, durationMs: 40 },
      { payload: framePayload, hasAlpha: false, durationMs: 60 },
    ],
    exif,
    512
  );
  const animChunks = readChunks(anim);
  assert.deepEqual(
    animChunks.map((c) => c.fourcc),
    ["VP8X", "ANIM", "ANMF", "ANMF", "EXIF"]
  );
  // VP8X flags: animation (0x02) | alpha (0x10) | exif (0x08) = 0x1a
  assert.equal(animChunks[0].data[0], 0x1a);

  const still = buildStillWebp({ payload: framePayload, hasAlpha: false }, exif, 256);
  const stillChunks = readChunks(still);
  assert.deepEqual(
    stillChunks.map((c) => c.fourcc),
    ["VP8X", "VP8 ", "EXIF"]
  );
  assert.equal(stillChunks[0].data[0], 0x08);
});

test("oggCrc and buildOggOpus create valid Ogg/Opus pages with verified CRCs", () => {
  const pkt1 = new Uint8Array([0xf8, 0xff, 0xfe]);
  const pkt2 = new Uint8Array([0xf8, 0x01, 0x02, 0x03]);
  const ogg = buildOggOpus([pkt1, pkt2], 312, 1920);

  // Check first page starts with OggS, BOS flag (0x02), and OpusHead payload.
  assert.equal(new TextDecoder().decode(ogg.subarray(0, 4)), "OggS");
  assert.equal(ogg[5], 0x02);

  // Verify each Ogg page CRC-32 matches oggCrc with zeroed CRC field.
  let offset = 0;
  let pageCount = 0;
  let sawVendor = false;
  while (offset < ogg.length) {
    assert.equal(new TextDecoder().decode(ogg.subarray(offset, offset + 4)), "OggS");
    const segCount = ogg[offset + 26];
    const lacing = ogg.subarray(offset + 27, offset + 27 + segCount);
    const dataLen = lacing.reduce((a, b) => a + b, 0);
    const pageLen = 27 + segCount + dataLen;
    const copy = new Uint8Array(ogg.subarray(offset, offset + pageLen));
    const storedCrc = new DataView(copy.buffer, copy.byteOffset).getUint32(22, true);
    copy.fill(0, 22, 26);
    assert.equal(oggCrc(copy), storedCrc);
    if (pageCount === 1) {
      const text = new TextDecoder().decode(copy.subarray(27 + segCount));
      assert.ok(text.startsWith("OpusTags"));
      assert.ok(text.includes("SoundStickersWebChat"));
      sawVendor = true;
    }
    offset += pageLen;
    pageCount++;
  }
  assert.equal(pageCount, 3);
  assert.ok(sawVendor);
});

test("plan() maps frame indices and preserves exact total duration", () => {
  const steps = plan(30, 1.0, 10, 30);
  assert.equal(steps.length, 10);
  assert.equal(
    steps.reduce((sum, s) => sum + s.durationMs, 0),
    1000
  );
  assert.equal(steps[0].idx, 0);
  assert.equal(steps[9].idx, 27);
});

test("fitTimeline() handles repeat and freeze modes accurately", () => {
  const captured = ["f0", "f1", "f2", "f3"]; // 4 frames for 1s @ 4fps
  const repeated = fitTimeline(captured, 1, 2, 4, "repeat");
  assert.deepEqual(repeated, ["f0", "f1", "f2", "f3", "f0", "f1", "f2", "f3"]);

  const frozen = fitTimeline(captured, 1, 2, 4, "freeze");
  assert.deepEqual(frozen, ["f0", "f1", "f2", "f3", "f3", "f3", "f3", "f3"]);
});

test("score() favors higher fps and penalizes sub-192px resolutions", () => {
  assert.ok(score(512, 20) > score(512, 15));
  assert.ok(score(192, 20) - score(160, 20) > score(256, 20) - score(224, 20));
});

test("sampleAvg() returns exact values and linearly interpolates", () => {
  const an = { sampleBytes: { 512: { 0.15: 1000, 0.35: 3000, 0.75: 7000 } } };
  assert.equal(sampleAvg(an, 512, 0.35), 3000);
  assert.ok(Math.abs(sampleAvg(an, 512, 0.25) - 2000) < 1e-9);
  assert.equal(sampleAvg(an, 512, 0.1), 1000);
  assert.equal(sampleAvg(an, 512, 0.9), 7000);
  assert.equal(sampleAvg(an, 256, 0.5), 0);
});

test("sha256b64() computes standard base64 SHA-256 digest", async () => {
  const digest = await sha256b64(new TextEncoder().encode("abc"));
  assert.equal(digest, "ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=");
});

test("i18n formatMessage and _locales/en/messages.json cover all UI keys", () => {
  const messagesPath = path.resolve(__dirname, "..", "_locales", "en", "messages.json");
  const raw = JSON.parse(fs.readFileSync(messagesPath, "utf8"));
  const bridgeSrc = fs.readFileSync(path.resolve(__dirname, "..", "src", "bridge.js"), "utf8");
  const uiSrc = fs.readFileSync(path.resolve(__dirname, "..", "src", "ui.js"), "utf8");
  const waSrc = fs.readFileSync(path.resolve(__dirname, "..", "src", "wa.js"), "utf8");

  // Verify every t("...") key used in src/ui.js and src/wa.js exists in messages.json & bridge.js.
  const usedKeys = new Set();
  for (const src of [uiSrc, waSrc]) {
    for (const m of src.matchAll(/\bt\(\s*"([a-zA-Z0-9_]+)"/g)) usedKeys.add(m[1]);
  }
  assert.ok(usedKeys.size > 40);
  for (const k of usedKeys) {
    assert.ok(raw[k], `Missing key "${k}" in _locales/en/messages.json`);
    assert.ok(bridgeSrc.includes(`"${k}"`), `Missing key "${k}" in src/bridge.js MESSAGE_KEYS`);
  }

  assert.equal(formatMessage({ hi: "Hello $1 ($2)" }, "hi", ["world", 42]), "Hello world (42)");
  assert.equal(formatMessage({}, "missing"), "missing");
});
