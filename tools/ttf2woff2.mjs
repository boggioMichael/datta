// Minimal TTF/OTF -> WOFF2 encoder (null transforms, Brotli via Node's zlib).
// Dependency-free, so the font pipeline works anywhere Node runs.
// Usage: node tools/ttf2woff2.mjs in.ttf out.woff2
import { readFileSync, writeFileSync } from "node:fs";
import { brotliCompressSync, constants } from "node:zlib";

const KNOWN = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep",
  "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE",
  "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt",
  "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar",
  "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill",
];

function base128(n) {
  const bytes = [];
  do { bytes.unshift(n & 0x7f); n = Math.floor(n / 128); } while (n > 0);
  return Buffer.from(bytes.map((b, i) => (i < bytes.length - 1 ? b | 0x80 : b)));
}
const round4 = (n) => (n + 3) & ~3;

export function ttfToWoff2(ttf) {
  const flavor = ttf.readUInt32BE(0);
  const numTables = ttf.readUInt16BE(4);
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    const tag = ttf.toString("latin1", o, o + 4);
    const offset = ttf.readUInt32BE(o + 8);
    const length = ttf.readUInt32BE(o + 12);
    tables.push({ tag, data: ttf.subarray(offset, offset + length) });
  }
  // Directory: known tag index or 63 + explicit tag; glyf/loca get the null transform (version 3).
  const dirParts = [];
  let totalSfntSize = 12 + 16 * numTables;
  for (const t of tables) {
    const idx = KNOWN.indexOf(t.tag);
    const transformVersion = t.tag === "glyf" || t.tag === "loca" ? 3 : 0;
    const flags = (idx === -1 ? 63 : idx) | (transformVersion << 6);
    dirParts.push(Buffer.from([flags]));
    if (idx === -1) dirParts.push(Buffer.from(t.tag, "latin1"));
    dirParts.push(base128(t.data.length));
    totalSfntSize += round4(t.data.length);
  }
  const directory = Buffer.concat(dirParts);
  const uncompressed = Buffer.concat(tables.map((t) => t.data));
  const compressed = brotliCompressSync(uncompressed, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_FONT,
      [constants.BROTLI_PARAM_SIZE_HINT]: uncompressed.length,
    },
  });
  const header = Buffer.alloc(48);
  header.writeUInt32BE(0x774f4632, 0); // 'wOF2'
  header.writeUInt32BE(flavor, 4);
  const totalLength = round4(48 + directory.length + compressed.length);
  header.writeUInt32BE(totalLength, 8);
  header.writeUInt16BE(numTables, 12);
  header.writeUInt16BE(0, 14);
  header.writeUInt32BE(totalSfntSize, 16);
  header.writeUInt32BE(compressed.length, 20);
  header.writeUInt16BE(1, 24);
  header.writeUInt16BE(0, 26);
  // meta/priv offsets+lengths stay zero (bytes 28..47)
  const out = Buffer.alloc(totalLength);
  header.copy(out, 0);
  directory.copy(out, 48);
  compressed.copy(out, 48 + directory.length);
  return out;
}

if (process.argv[1] && process.argv[1].endsWith("ttf2woff2.mjs")) {
  const [, , input, output] = process.argv;
  if (!input || !output) {
    console.error("usage: node tools/ttf2woff2.mjs in.ttf out.woff2");
    process.exit(1);
  }
  const woff2 = ttfToWoff2(readFileSync(input));
  writeFileSync(output, woff2);
  console.log(`${input} -> ${output} (${woff2.length} bytes)`);
}
