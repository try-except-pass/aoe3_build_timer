/**
 * Minimal reader for Age of Empires III: DE `.bar` archives (format version 6).
 *
 * Supported entries: plain files (flag 0, e.g. the UI images in Game/UI/UIResources*.bar) and
 * LZ4-compressed files (flag 1, "alz4", e.g. the XMB data in Game/Data/Data.bar). Binary XMB
 * documents are converted back to XML text. Encrypted entries (flag 2, game audio) are
 * deliberately not supported.
 *
 *   node scripts/bar.mjs list <archive.bar> [filter-regex]
 *   node scripts/bar.mjs extract <archive.bar> <filter-regex> <out-dir>   (.XMB is written as XML)
 */
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @returns {{ name: string, offset: number, size: number, flag: number }[]} */
export function listBar(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const total = fs.fstatSync(fd).size;
    const head = Buffer.alloc(304);
    fs.readSync(fd, head, 0, head.length, 0);
    if (head.toString('ascii', 0, 4) !== 'ESPN') throw new Error(`${file} is not a BAR archive`);
    const version = head.readUInt32LE(4);
    if (version !== 6) throw new Error(`${file}: unsupported BAR version ${version}`);
    // magic, version, unk, 66×unk, checksum, file count, unk → files table offset (int64)
    const tableOffset = Number(head.readBigInt64LE(4 + 4 + 4 + 264 + 4 + 4 + 4));
    const t = Buffer.alloc(total - tableOffset);
    fs.readSync(fd, t, 0, t.length, tableOffset);

    let p = 0;
    const rootLen = t.readUInt32LE(p);
    p += 4;
    const root = t.toString('utf16le', p, p + rootLen * 2);
    p += rootLen * 2;
    const count = t.readUInt32LE(p);
    p += 4;
    const entries = [];
    for (let i = 0; i < count; i++) {
      const offset = Number(t.readBigInt64LE(p));
      p += 8;
      p += 4; // uncompressed size
      const size = t.readUInt32LE(p); // stored size
      p += 8; // stored size + spare size field
      const nameLen = t.readUInt32LE(p);
      p += 4;
      const name = (root + t.toString('utf16le', p, p + nameLen * 2)).replace(/\\/g, '/');
      p += nameLen * 2;
      const flag = t.readUInt32LE(p);
      p += 4;
      entries.push({ name, offset, size, flag });
    }
    return entries;
  } finally {
    fs.closeSync(fd);
  }
}

/** Raw bytes of an entry; "alz4" (LZ4) compressed entries are decompressed. */
export function readEntry(file, entry) {
  if (entry.flag !== 0 && entry.flag !== 1) throw new Error(`${entry.name}: unsupported entry type (flag ${entry.flag})`);
  const fd = fs.openSync(file, 'r');
  let buf;
  try {
    buf = Buffer.alloc(entry.size);
    fs.readSync(fd, buf, 0, entry.size, entry.offset);
  } finally {
    fs.closeSync(fd);
  }
  return buf.toString('latin1', 0, 4) === 'alz4' ? decompressAlz4(buf) : buf;
}

/** "alz4" container: magic, uncompressed size, compressed size, version, then one LZ4 block. */
function decompressAlz4(buf) {
  const size = buf.readUInt32LE(4);
  const compressed = buf.readUInt32LE(8);
  return lz4Block(buf.subarray(16, 16 + compressed), size);
}

/** Standard LZ4 block decoder. */
function lz4Block(src, size) {
  const out = Buffer.alloc(size);
  let s = 0;
  let d = 0;
  const readLen = (len) => {
    if (len === 15) {
      let b;
      do {
        b = src[s++];
        len += b;
      } while (b === 255);
    }
    return len;
  };
  while (s < src.length) {
    const token = src[s++];
    const lit = readLen(token >> 4);
    src.copy(out, d, s, s + lit);
    s += lit;
    d += lit;
    if (s >= src.length) break; // last sequence has literals only
    const offset = src[s] | (src[s + 1] << 8);
    s += 2;
    const match = readLen(token & 15) + 4;
    // Byte-by-byte: matches may overlap their own output.
    for (let i = 0; i < match; i++, d++) out[d] = out[d - offset];
  }
  return out;
}

const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Converts an AoE3 binary XMB document (version 8) to XML text. */
export function xmbToXml(buf) {
  let p = 0;
  const u32 = () => {
    const v = buf.readUInt32LE(p);
    p += 4;
    return v;
  };
  const str = () => {
    const len = u32();
    const s = buf.toString('utf16le', p, p + len * 2);
    p += len * 2;
    return s;
  };
  const magic = (m) => {
    if (buf.toString('latin1', p, p + 2) !== m) throw new Error(`XMB: expected ${m} at ${p}`);
    p += 2;
  };
  magic('X1');
  u32(); // data length
  magic('XR');
  u32(); // always 4
  const version = u32();
  if (version !== 8) throw new Error(`XMB: unsupported version ${version}`);
  const elements = Array.from({ length: u32() }, str);
  const attributes = Array.from({ length: u32() }, str);

  const out = [];
  const node = (depth) => {
    magic('XN');
    u32(); // node length
    const text = str();
    const name = elements[u32()];
    u32(); // source line number
    const attrs = [];
    for (let n = u32(); n > 0; n--) {
      const attrName = attributes[u32()];
      attrs.push(` ${attrName}="${escapeXml(str())}"`);
    }
    const children = u32();
    const pad = '  '.repeat(depth);
    if (children === 0) {
      out.push(`${pad}<${name}${attrs.join('')}>${escapeXml(text)}</${name}>`);
      return;
    }
    out.push(`${pad}<${name}${attrs.join('')}>${escapeXml(text)}`);
    for (let i = 0; i < children; i++) node(depth + 1);
    out.push(`${pad}</${name}>`);
  };
  node(0);
  return out.join('\n') + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, file, filter, out] = process.argv.slice(2);
  const re = filter ? new RegExp(filter, 'i') : null;
  const entries = listBar(file).filter((e) => !re || re.test(e.name));
  if (cmd === 'list') {
    for (const e of entries) console.log(`${e.name}\t${Math.round(e.size / 1024)} KB\tflag=${e.flag}`);
  } else if (cmd === 'extract') {
    for (const e of entries) {
      const isXmb = /\.xmb$/i.test(e.name);
      const dest = path.join(out, isXmb ? e.name.replace(/\.xmb$/i, '') : e.name);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const data = readEntry(file, e);
      fs.writeFileSync(dest, isXmb ? xmbToXml(data) : data);
    }
    console.log(`extracted ${entries.length} files to ${out}`);
  } else {
    console.error('Usage: node scripts/bar.mjs list|extract <archive.bar> [filter] [out-dir]');
    process.exit(1);
  }
}
