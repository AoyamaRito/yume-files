// @yume-format: 1
// ver001.handle.yume.js — yume runtime v001(role=handle)
//
// v001 では plain ESM module(__block / versions / 自己 commit なし、bootstrap 回避)。
// future v00N で完全 .yume.js 化(自己 recursion)を再評価、現状は naming convention のみ。
//
// 実装範囲(Phase 1〜3 partial):
//   - parseBlock / serializeBlock(round-trip 保証)
//   - hashContent(sha256 + prevHash chain)
//   - atomicWrite(tmp + rename)
//   - acquireLock(stale recovery 込み)
//   - validateBlock(hash chain / schema sanity)
//   - heavy / heavyApply codec(decompress / recompress aliases)
//   - commitManual(boundary case、AI 不在の人手編集救済)
//   - history / show / diff / rollback
//   - notes API(noteAdd / noteEdit / noteRm / noteList / notesSearch)
//   - apply API(applyList / applyShow / applyIndex / applySearch)
//   - impact(reverse refs closure)
//   - refsCheck(graph sanity)
//   - refs / tags 抽出(import / export-from / dynamic import / bare calls / // @ref: / // @tags:)
//   - cli(verb dispatcher)
//
// 未実装(後続 phase):
//   - richer ref kinds / deeper scanner fixtures
//
// spec: ../BLOCKFILE.aiDoc.yume.js

import { readFile, rename, unlink, open, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { hostname } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';

export const VERSION = '001';
export const SCHEMA_VERSION = 1;

// ============================================================
// region markers
// ============================================================
const HEAD_BEGIN = '// === HEAD ===';
const HEAD_END   = '// === /HEAD ===';
const BOOT_BEGIN = '// === BOOT ===';
const BOOT_END   = '// === /BOOT ===';
const HEAVY_HEADER = '// @yume-heavy: 1';
const HEAVY_FILE_BEGIN = '// === YUME:FILE ===';
const HEAVY_META_PREFIX = '// yume:meta ';
const HEAVY_CONTENT_BEGIN = '// === YUME:CONTENT ===';
const HEAVY_FILE_END = '// === /YUME:FILE ===';

// ============================================================
// parseBlock — source → {block, head, boot}
// ============================================================
export function parseBlock(source) {
  globalThis.__yumeCoverHook?.('parseBlock', arguments);
  if (typeof source !== 'string') throw new TypeError('parseBlock: source must be string');
  if (!hasHeaderMarker(source)) throw new Error('parseBlock: missing `// @yume-format: 1` marker in first 5 lines');

  const blockExpr = extractBlockExpr(source);
  if (!blockExpr) throw new Error('parseBlock: `export const __block = {...}` not found');

  let block;
  try {
    block = JSON.parse(blockExpr);
  } catch (e) {
    throw new Error('parseBlock: __block must be a canonical JSON object literal: ' + e.message);
  }

  const head = extractRegion(source, HEAD_BEGIN, HEAD_END);
  if (head === null) throw new Error('parseBlock: HEAD region not found (missing `' + HEAD_BEGIN + '` ... `' + HEAD_END + '`)');

  const boot = extractRegion(source, BOOT_BEGIN, BOOT_END);  // null if missing (boot is optional)

  return { block, head, boot };
}

function hasHeaderMarker(source) {
  const lines = source.split(/\r?\n/, 5);
  return lines.some((line) => line.replace(/^\uFEFF/, '').trim() === '// @yume-format: 1');
}

// brace-balanced extraction of the `{...}` of `export const __block = {...};`
function extractBlockExpr(source) {
  const m = source.match(/export\s+const\s+__block\s*=\s*\{/);
  if (!m) return null;
  const startIdx = m.index + m[0].length - 1;  // position of '{'

  let depth = 0;
  let inString = false;
  let stringChar = null;
  let escape = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = startIdx; i < source.length; i++) {
    const c = source[i];
    const next = source[i + 1];

    if (escape) { escape = false; continue; }
    if (inString) {
      if (c === '\\') { escape = true; continue; }
      if (c === stringChar) inString = false;
      continue;
    }
    if (inLineComment) {
      if (c === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (c === '*' && next === '/') { inBlockComment = false; i++; }
      continue;
    }

    if (c === '/' && next === '/') { inLineComment = true; i++; continue; }
    if (c === '/' && next === '*') { inBlockComment = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { inString = true; stringChar = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  return null;
}

function extractRegion(source, beginMarker, endMarker) {
  const beginIdx = findMarkerOutsideStrings(source, beginMarker, 0);
  if (beginIdx < 0) return null;
  const afterBegin = beginIdx + beginMarker.length;
  // skip the newline immediately after begin marker
  const contentStart = source[afterBegin] === '\n' ? afterBegin + 1 : afterBegin;
  const endIdx = findMarkerOutsideStrings(source, endMarker, contentStart);
  if (endIdx < 0) return null;
  // trim the trailing newline before end marker
  const contentEnd = source[endIdx - 1] === '\n' ? endIdx - 1 : endIdx;
  return source.slice(contentStart, contentEnd);
}

// Find marker outside string/template literals and block comments.
// Skips matches inside `"..."`, `'...'`, `` `...` ``, and `/* ... */`.
// Does NOT skip line comments because markers ARE line comments themselves.
// Required so AI docs (e.g. BLOCKFILE.aiDoc.yume.js) can quote marker literals
// in spec bodies without truncating their own HEAD region.
function findMarkerOutsideStrings(source, marker, startFrom) {
  let i = startFrom;
  let inString = false;
  let stringChar = null;
  let escape = false;
  let inBlockComment = false;

  while (i <= source.length - marker.length) {
    const c = source[i];

    if (inBlockComment) {
      if (c === '*' && source[i + 1] === '/') { inBlockComment = false; i += 2; continue; }
      i++; continue;
    }
    if (escape) { escape = false; i++; continue; }
    if (inString) {
      if (c === '\\') { escape = true; i++; continue; }
      if (c === stringChar) { inString = false; stringChar = null; }
      i++; continue;
    }
    if (c === '/' && source[i + 1] === '*') { inBlockComment = true; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') { inString = true; stringChar = c; i++; continue; }

    if (source.startsWith(marker, i)) return i;
    i++;
  }
  return -1;
}

// ============================================================
// serializeBlock — {block, head, boot} → source
// ============================================================
export function serializeBlock({ block, head, boot }) {
  globalThis.__yumeCoverHook?.('serializeBlock', arguments);
  if (!block || typeof block !== 'object') throw new TypeError('serializeBlock: block must be object');
  if (typeof head !== 'string')              throw new TypeError('serializeBlock: head must be string');

  const blockJson = JSON.stringify(block, null, 2);
  let out = '// @yume-format: 1\n\n';
  out += 'export const __block = ' + blockJson + ';\n\n';
  out += HEAD_BEGIN + '\n';
  out += head;
  out += '\n' + HEAD_END + '\n';
  if (boot != null) {
    out += '\n' + BOOT_BEGIN + '\n';
    out += boot;
    out += '\n' + BOOT_END + '\n';
  }
  return out;
}

// ============================================================
// hashContent — sha256(content + '\n' + (prevHash ?? '') + '\n' + ts)
// ============================================================
export function hashContent(content, prevHash, ts) {
  globalThis.__yumeCoverHook?.('hashContent', arguments);
  return createHash('sha256')
    .update(content + '\n' + (prevHash ?? '') + '\n' + ts)
    .digest('hex');
}

// ============================================================
// refs / tags extraction — conservative source scan
// ============================================================
export function extractRefsAndTags(content) {
  globalThis.__yumeCoverHook?.('extractRefsAndTags', arguments);
  if (typeof content !== 'string') throw new TypeError('extractRefsAndTags: content must be string');
  return {
    refs: extractRefs(content),
    tags: extractTags(content),
  };
}

function extractRefs(content) {
  const sourceView = makeSourceView(content);
  const refs = [];

  collectModuleRefs(refs, sourceView, /\bimport\s+(?:[^'";]*?\s+from\s*)?["']([^"']+)["']/g, 'import');
  collectModuleRefs(refs, sourceView, /\bexport\s+[^'";]*?\s+from\s*["']([^"']+)["']/g, 'export');
  collectModuleRefs(refs, sourceView, /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g, 'dynamic-import');
  collectCallRefs(refs, sourceView.callSource);
  collectExplicitRefs(refs, sourceView.lineCommentSource);

  return uniqueRefs(refs);
}

function collectModuleRefs(refs, sourceView, pattern, kind) {
  for (const match of sourceView.moduleSource.matchAll(pattern)) {
    if (!isExecutableCodeAt(sourceView, match.index)) continue;
    refs.push({ kind, target: match[1] });
  }
}

const CALL_EXCLUDE = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'import',
  'typeof', 'new', 'super', 'await', 'do', 'throw', 'class',
]);

function collectCallRefs(refs, source) {
  const pattern = /\b([A-Za-z_$][\w$]*)\s*\(/g;
  for (const match of source.matchAll(pattern)) {
    const name = match[1];
    if (CALL_EXCLUDE.has(name)) continue;

    const before = source.slice(Math.max(0, match.index - 32), match.index);
    const prev = source[match.index - 1];
    if (/\b(function|class)\s+$/.test(before)) continue;
    if (prev === '.' || /[\w$]/.test(prev)) continue;

    refs.push({ kind: 'calls', target: name });
  }
}

function collectExplicitRefs(refs, source) {
  const pattern = /\/\/\s*@ref:\s*(.+)$/gm;
  for (const match of source.matchAll(pattern)) {
    const parsed = parseExplicitRef(match[1]);
    if (parsed) refs.push(parsed);
  }
}

function parseExplicitRef(value) {
  const raw = value.trim();
  if (!raw) return null;
  const parts = raw.split(/\s+/);
  if (parts.length === 1) return { kind: 'ref', target: parts[0] };
  return { kind: parts[0], target: parts.slice(1).join(' ') };
}

function extractTags(content) {
  const sourceView = makeSourceView(content);
  const tags = [];
  const pattern = /\/\/\s*@tags:\s*(.+)$/gm;
  for (const match of sourceView.lineCommentSource.matchAll(pattern)) {
    for (const tag of match[1].split(/[,\s]+/)) {
      const trimmed = tag.trim();
      if (trimmed) tags.push(trimmed);
    }
  }
  return [...new Set(tags)];
}

function uniqueRefs(refs) {
  const out = [];
  const seen = new Set();
  for (const ref of refs) {
    const key = `${ref.kind}\0${ref.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

function isExecutableCodeAt(sourceView, index) {
  return sourceView.callSource[index] === sourceView.moduleSource[index];
}

function makeSourceView(source) {
  const moduleChars = [];
  const callChars = [];
  const commentChars = [];
  const stack = [{ mode: 'code' }];

  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    const next = source[i + 1];
    const ctx = stack.at(-1);

    if (ctx.mode === 'lineComment') {
      emitLineComment(moduleChars, callChars, commentChars, c);
      if (c === '\n') stack.pop();
      continue;
    }

    if (ctx.mode === 'blockComment') {
      emitMasked(moduleChars, callChars, commentChars, c);
      if (c === '*' && next === '/') {
        i++;
        emitMasked(moduleChars, callChars, commentChars, next);
        stack.pop();
      }
      continue;
    }

    if (ctx.mode === 'string') {
      emitString(moduleChars, callChars, commentChars, c);
      if (ctx.escape) {
        ctx.escape = false;
      } else if (c === '\\') {
        ctx.escape = true;
      } else if (c === ctx.quote) {
        stack.pop();
      }
      continue;
    }

    if (ctx.mode === 'templateText') {
      emitTemplateText(moduleChars, callChars, commentChars, c);
      if (ctx.escape) {
        ctx.escape = false;
      } else if (c === '\\') {
        ctx.escape = true;
      } else if (c === '`') {
        stack.pop();
      } else if (c === '$' && next === '{') {
        i++;
        emitTemplateText(moduleChars, callChars, commentChars, next);
        stack.push({ mode: 'templateExpr', braceDepth: 1 });
      }
      continue;
    }

    if (ctx.mode === 'templateExpr' && c === '}') {
      emitCode(moduleChars, callChars, commentChars, c);
      ctx.braceDepth--;
      if (ctx.braceDepth === 0) stack.pop();
      continue;
    }

    if (c === '/' && next === '/') {
      emitLineComment(moduleChars, callChars, commentChars, c);
      i++;
      emitLineComment(moduleChars, callChars, commentChars, next);
      stack.push({ mode: 'lineComment' });
      continue;
    }
    if (c === '/' && next === '*') {
      emitMasked(moduleChars, callChars, commentChars, c);
      i++;
      emitMasked(moduleChars, callChars, commentChars, next);
      stack.push({ mode: 'blockComment' });
      continue;
    }
    if (c === '"' || c === "'") {
      emitString(moduleChars, callChars, commentChars, c);
      stack.push({ mode: 'string', quote: c, escape: false });
      continue;
    }
    if (c === '`') {
      emitTemplateText(moduleChars, callChars, commentChars, c);
      stack.push({ mode: 'templateText', escape: false });
      continue;
    }
    if (ctx.mode === 'templateExpr' && c === '{') {
      ctx.braceDepth++;
    }
    emitCode(moduleChars, callChars, commentChars, c);
  }

  return {
    moduleSource: moduleChars.join(''),
    callSource: callChars.join(''),
    lineCommentSource: commentChars.join(''),
  };
}

function emitCode(moduleChars, callChars, commentChars, c) {
  moduleChars.push(c);
  callChars.push(c);
  commentChars.push(maskChar(c));
}

function emitString(moduleChars, callChars, commentChars, c) {
  moduleChars.push(c);
  callChars.push(maskChar(c));
  commentChars.push(maskChar(c));
}

function emitTemplateText(moduleChars, callChars, commentChars, c) {
  moduleChars.push(c);
  callChars.push(maskChar(c));
  commentChars.push(maskChar(c));
}

function emitLineComment(moduleChars, callChars, commentChars, c) {
  moduleChars.push(maskChar(c));
  callChars.push(maskChar(c));
  commentChars.push(c);
}

function emitMasked(moduleChars, callChars, commentChars, c) {
  const masked = maskChar(c);
  moduleChars.push(masked);
  callChars.push(masked);
  commentChars.push(masked);
}

function maskChar(c) {
  return c === '\n' ? '\n' : ' ';
}

// ============================================================
// atomicWrite — tmp + rename
// ============================================================
export async function atomicWrite(filePath, content) {
  globalThis.__yumeCoverHook?.('atomicWrite', arguments);
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}.${randomUUID()}`;
  try {
    await writeFileDurable(tmp, content);
    await rename(tmp, filePath);
  } catch (e) {
    try { await unlink(tmp); } catch {}
    throw e;
  }
}

async function writeFileDurable(filePath, content) {
  const handle = await open(filePath, 'wx');
  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

// ============================================================
// acquireLock — atomic create、{ pid, ts, host, token } JSON、stale 1h で自動削除
// ============================================================
const STALE_MS = 60 * 60 * 1000;
const CURRENT_HOST = hostname();

export async function acquireLock(filePath) {
  globalThis.__yumeCoverHook?.('acquireLock', arguments);
  const lockPath = filePath + '.lock';
  const lockData = {
    pid: process.pid,
    ts: Date.now(),
    host: CURRENT_HOST,
    token: randomUUID(),
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await createLockFile(lockPath, lockData);
      return releaseLock(lockPath, lockData.token);
    } catch (e) {
      if (e?.code !== 'EEXIST') throw e;
      await removeStaleLock(lockPath);
    }
  }

  throw new Error(`yume: could not acquire lock after stale recovery: ${lockPath}`);
}

async function acquireLocks(filePaths) {
  const releases = [];
  const files = [...new Set(filePaths)].sort();
  try {
    for (const file of files) {
      releases.push(await acquireLock(file));
    }
  } catch (e) {
    for (const release of releases.reverse()) {
      try { await release(); } catch {}
    }
    throw e;
  }
  return async function releaseAll() {
    for (const release of releases.reverse()) {
      await release();
    }
  };
}

async function createLockFile(lockPath, lockData) {
  const handle = await open(lockPath, 'wx');
  try {
    await handle.writeFile(JSON.stringify(lockData), 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function removeStaleLock(lockPath) {
  let data = null;
  let unreadable = false;
  try {
    data = JSON.parse(await readFile(lockPath, 'utf8'));
  } catch (e) {
    if (e?.code === 'ENOENT') return;
    unreadable = true;
  }

  const age = typeof data?.ts === 'number' ? Date.now() - data.ts : Infinity;
  const sameHost = data?.host == null || data.host === CURRENT_HOST || data.host === 'unknown';
  const dead = sameHost ? !pidAlive(data?.pid) : false;

  if (!unreadable && age < STALE_MS && !dead) {
    throw new Error(`yume: lock held — pid=${data.pid} ts=${data.ts} host=${data.host} age=${age}ms`);
  }

  if (unreadable) {
    console.warn('yume: removing unreadable lock');
  } else {
    console.warn(`yume: removing stale lock (age=${age}ms pidDead=${dead}, was pid=${data.pid})`);
  }

  try { await unlink(lockPath); } catch (e) {
    if (e?.code !== 'ENOENT') throw e;
  }
}

function releaseLock(lockPath, token) {
  let released = false;
  return async function release() {
    if (released) return;
    released = true;
    let data = null;
    try {
      data = JSON.parse(await readFile(lockPath, 'utf8'));
    } catch (e) {
      return;
    }
    if (data?.token !== token) return;
    try { await unlink(lockPath); } catch (e) {
      if (e?.code !== 'ENOENT') throw e;
    }
  };
}

function pidAlive(pid) {
  if (typeof pid !== 'number') return false;
  try { process.kill(pid, 0); return true; }
  catch (e) { return e.code === 'EPERM'; }
}

// ============================================================
// validateBlock — schema sanity + hash chain 検証
// ============================================================
export function validateBlock(block) {
  globalThis.__yumeCoverHook?.('validateBlock', arguments);
  const errors = [];

  if (!isPlainObject(block)) {
    return { ok: false, errors: ['block must be an object'] };
  }
  if (typeof block.id !== 'string' || block.id.length === 0) errors.push('id must be a non-empty string');
  if (typeof block.type !== 'string' || block.type.length === 0) errors.push('type must be a non-empty string');
  if (typeof block.schemaVersion !== 'number') errors.push('schemaVersion must be a number');
  if (!isPlainObject(block.runtime)) errors.push('runtime must be an object');
  if (!Array.isArray(block.versions)) {
    errors.push('versions must be an array');
    return { ok: false, errors };
  }
  if (block.versions.length === 0) errors.push('versions must contain at least one entry');
  if (block.notes !== undefined && !isPlainObject(block.notes)) errors.push('notes must be an object when present');

  let prevHash = null;
  for (let i = 0; i < block.versions.length; i++) {
    const v = block.versions[i];
    const prefix = `versions[${i}]`;
    if (!isPlainObject(v)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    if (typeof v.content !== 'string') errors.push(`${prefix}.content must be a string`);
    if (typeof v.ts !== 'number') errors.push(`${prefix}.ts must be a number`);
    if (v.prevHash !== prevHash) errors.push(`${prefix}.prevHash must equal previous hash`);
    if (typeof v.hash !== 'string' || !/^[0-9a-f]{64}$/.test(v.hash)) errors.push(`${prefix}.hash must be sha256 hex`);
    if (!Array.isArray(v.refs)) errors.push(`${prefix}.refs must be an array`);
    if (!Array.isArray(v.tags)) errors.push(`${prefix}.tags must be an array`);
    if (v.applyId !== null && typeof v.applyId !== 'string') errors.push(`${prefix}.applyId must be null or string`);
    if (Array.isArray(v.refs)) {
      for (let j = 0; j < v.refs.length; j++) {
        const ref = v.refs[j];
        const refPrefix = `${prefix}.refs[${j}]`;
        if (!isPlainObject(ref)) {
          errors.push(`${refPrefix} must be an object`);
          continue;
        }
        if (typeof ref.kind !== 'string' || ref.kind.length === 0) errors.push(`${refPrefix}.kind must be a non-empty string`);
        if (typeof ref.target !== 'string' || ref.target.length === 0) errors.push(`${refPrefix}.target must be a non-empty string`);
      }
    }
    if (Array.isArray(v.tags)) {
      for (let j = 0; j < v.tags.length; j++) {
        if (typeof v.tags[j] !== 'string' || v.tags[j].length === 0) errors.push(`${prefix}.tags[${j}] must be a non-empty string`);
      }
    }

    if (typeof v.content === 'string' && typeof v.ts === 'number' && typeof v.hash === 'string') {
      const expected = hashContent(v.content, v.prevHash, v.ts);
      if (v.hash !== expected) errors.push(`${prefix}.hash mismatch`);
    }
    prevHash = v.hash;
  }

  if (isPlainObject(block.notes)) {
    const versionHashes = new Set(block.versions.map((version) => version.hash));
    const applyKeys = new Set(block.versions.filter((version) => version.applyId).map((version) => `apply:${version.applyId}`));
    for (const [key, notes] of Object.entries(block.notes)) {
      if (!versionHashes.has(key) && !applyKeys.has(key)) errors.push(`notes[${key}] must target an existing version hash or applyId`);
      if (!Array.isArray(notes)) {
        errors.push(`notes[${key}] must be an array`);
        continue;
      }
      const seen = new Set();
      for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        const prefix = `notes[${key}][${i}]`;
        if (!isPlainObject(note)) {
          errors.push(`${prefix} must be an object`);
          continue;
        }
        if (typeof note.id !== 'string' || note.id.length === 0) errors.push(`${prefix}.id must be a non-empty string`);
        if (typeof note.author !== 'string' || note.author.length === 0) errors.push(`${prefix}.author must be a non-empty string`);
        if (typeof note.ts !== 'number') errors.push(`${prefix}.ts must be a number`);
        if (typeof note.text !== 'string') errors.push(`${prefix}.text must be a string`);
        if (note.kind !== undefined && typeof note.kind !== 'string') errors.push(`${prefix}.kind must be a string when present`);
        if (seen.has(note.id)) errors.push(`${prefix}.id must be unique within its note key`);
        seen.add(note.id);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function assertValidBlock(block) {
  globalThis.__yumeCoverHook?.('assertValidBlock', arguments);
  const result = validateBlock(block);
  if (!result.ok) throw new Error('validateBlock: ' + result.errors.join('; '));
  return block;
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

// ============================================================
// notes — mutable commentary layer(hash chain から分離)
// ============================================================
export async function noteAdd(fileUrl, target, note) {
  globalThis.__yumeCoverHook?.('noteAdd', arguments);
  const filePath = toPath(fileUrl);
  const release = await acquireLock(filePath);
  try {
    const parsed = await readParsedFile(filePath);
    const key = resolveNoteKey(parsed.block, target);
    const stored = makeNote(note);
    ensureNotes(parsed.block);
    parsed.block.notes[key] ??= [];
    parsed.block.notes[key].push(stored);
    await atomicWrite(filePath, serializeBlock(parsed));
    return { key, noteId: stored.id };
  } finally {
    await release();
  }
}

export async function noteEdit(fileUrl, target, noteId, patch) {
  globalThis.__yumeCoverHook?.('noteEdit', arguments);
  const filePath = toPath(fileUrl);
  const release = await acquireLock(filePath);
  try {
    const parsed = await readParsedFile(filePath);
    const key = resolveNoteKey(parsed.block, target);
    const note = findNote(parsed.block, key, noteId);
    if (patch.text !== undefined) {
      if (typeof patch.text !== 'string') throw new TypeError('noteEdit: patch.text must be string');
      note.text = patch.text;
    }
    if (patch.kind !== undefined) {
      if (patch.kind !== null && typeof patch.kind !== 'string') throw new TypeError('noteEdit: patch.kind must be string or null');
      if (patch.kind === null) delete note.kind;
      else note.kind = patch.kind;
    }
    note.ts = Date.now();
    await atomicWrite(filePath, serializeBlock(parsed));
    return { key, noteId };
  } finally {
    await release();
  }
}

export async function noteRm(fileUrl, target, noteId) {
  globalThis.__yumeCoverHook?.('noteRm', arguments);
  const filePath = toPath(fileUrl);
  const release = await acquireLock(filePath);
  try {
    const parsed = await readParsedFile(filePath);
    const key = resolveNoteKey(parsed.block, target);
    const notes = parsed.block.notes?.[key] ?? [];
    const before = notes.length;
    if (!parsed.block.notes) throw new Error(`noteRm: note not found: ${noteId}`);
    parsed.block.notes[key] = notes.filter((note) => note.id !== noteId);
    const after = parsed.block.notes[key].length;
    if (parsed.block.notes[key].length === 0) delete parsed.block.notes[key];
    if (Object.keys(parsed.block.notes).length === 0) delete parsed.block.notes;
    if (before === after) throw new Error(`noteRm: note not found: ${noteId}`);
    await atomicWrite(filePath, serializeBlock(parsed));
    return { key, removed: true };
  } finally {
    await release();
  }
}

export async function noteList(fileUrl, target = null) {
  globalThis.__yumeCoverHook?.('noteList', arguments);
  const filePath = toPath(fileUrl);
  const { block } = await readParsedFile(filePath);
  if (target != null) {
    const key = resolveNoteKey(block, target);
    return (block.notes?.[key] ?? []).map((note) => ({ key, ...note }));
  }
  return Object.entries(block.notes ?? {}).flatMap(([key, notes]) =>
    notes.map((note) => ({ key, ...note }))
  );
}

export async function notesSearch(folder, query) {
  globalThis.__yumeCoverHook?.('notesSearch', arguments);
  const root = toPath(folder);
  if (typeof query !== 'string' || query.length === 0) throw new TypeError('notesSearch: query must be a non-empty string');
  const needle = query.toLowerCase();
  const files = await listYumeFiles(root);
  const results = [];

  for (const file of files) {
    const parsed = await readYumeFileOrNull(file);
    if (!parsed) continue;
    for (const [key, notes] of Object.entries(parsed.block.notes ?? {})) {
      for (const note of notes) {
        if (!note.text.toLowerCase().includes(needle)) continue;
        results.push({
          file,
          relativeFile: relative(root, file),
          blockId: parsed.block.id,
          key,
          ...note,
        });
      }
    }
  }

  return results;
}

// ============================================================
// refs / tags — latest version metadata
// ============================================================
export async function refs(fileUrl) {
  globalThis.__yumeCoverHook?.('refs', arguments);
  const filePath = toPath(fileUrl);
  const { block } = await readParsedFile(filePath);
  return block.versions.at(-1)?.refs ?? [];
}

export async function tags(fileUrl) {
  globalThis.__yumeCoverHook?.('tags', arguments);
  const filePath = toPath(fileUrl);
  const { block } = await readParsedFile(filePath);
  return block.versions.at(-1)?.tags ?? [];
}

// ============================================================
// impact — reverse refs closure(what changes if root changes?)
// ============================================================
export async function impact(fileUrls, rootId, depth = 1) {
  globalThis.__yumeCoverHook?.('impact', arguments);
  const entries = await loadYumeEntries(fileUrls);
  const selected = selectImpactEntries(entries, rootId, normalizeDepth(depth));
  return selected.map(({ entry, distance, via }) => ({
    file: entry.file,
    relativeFile: entry.relativeFile,
    blockId: entry.block.id,
    type: entry.block.type,
    distance,
    via,
  }));
}

// ============================================================
// refsCheck — refs graph sanity
// ============================================================
export async function refsCheck(fileUrls) {
  globalThis.__yumeCoverHook?.('refsCheck', arguments);
  const { entries, issues } = await loadYumeEntriesForCheck(fileUrls);
  if (entries.length === 0) throw new Error('refsCheck: no readable yume block files');

  const byFile = new Map(entries.map((entry) => [entry.file, entry]));
  const byBlockId = new Map();
  const idGroups = new Map();
  for (const entry of entries) {
    const group = idGroups.get(entry.block.id) ?? [];
    group.push(entry);
    idGroups.set(entry.block.id, group);
    if (!byBlockId.has(entry.block.id)) byBlockId.set(entry.block.id, entry);
  }

  for (const [blockId, group] of idGroups) {
    if (group.length <= 1) continue;
    issues.push({
      level: 'error',
      type: 'duplicate-block-id',
      blockId,
      files: group.map((entry) => entry.relativeFile),
      message: `duplicate block id '${blockId}'`,
    });
  }

  const adjacency = new Map(entries.map((entry) => [entry.file, new Set()]));
  const incoming = new Map(entries.map((entry) => [entry.file, 0]));

  for (const entry of entries) {
    for (const ref of latestRefs(entry)) {
      const target = resolveEntryRef(entry, ref, byFile, byBlockId);
      if (!target) {
        addUnresolvedRefIssue(issues, entry, ref);
        continue;
      }
      adjacency.get(entry.file).add(target.file);
      incoming.set(target.file, (incoming.get(target.file) ?? 0) + 1);
    }
  }

  for (const cycle of findRefCycles(entries, adjacency)) {
    issues.push({
      level: 'warning',
      type: 'cycle',
      files: cycle.map((entry) => entry.relativeFile),
      message: `refs cycle: ${cycle.map((entry) => entry.relativeFile).join(' -> ')}`,
    });
  }

  for (const entry of entries) {
    if ((incoming.get(entry.file) ?? 0) > 0) continue;
    if ((adjacency.get(entry.file)?.size ?? 0) > 0) continue;
    issues.push({
      level: 'info',
      type: 'isolated-file',
      file: entry.file,
      relativeFile: entry.relativeFile,
      blockId: entry.block.id,
      message: 'file has no resolved incoming or outgoing refs',
    });
  }

  const errors = issues.filter((issue) => issue.level === 'error');
  const warnings = issues.filter((issue) => issue.level === 'warning');
  const info = issues.filter((issue) => issue.level === 'info');
  return {
    ok: errors.length === 0,
    files: entries.length,
    errors,
    warnings,
    info,
    issues,
  };
}

// ============================================================
// codec — heavy/decompress and heavyApply/recompress
// ============================================================
export async function heavy(fileUrls, rootId = '*', depth = 1) {
  globalThis.__yumeCoverHook?.('heavy', arguments);
  const entries = await loadYumeEntries(fileUrls);
  const selected = selectHeavyEntries(entries, rootId, normalizeDepth(depth));
  return serializeHeavyView(selected, rootId, depth);
}

export async function decompress(fileUrls, rootId = '*', depth = 1) {
  return heavy(fileUrls, rootId, depth);
}

export async function heavyApply(fileUrls, rootId, content, depth = 1, opts = {}) {
  globalThis.__yumeCoverHook?.('heavyApply', arguments);
  if (typeof content !== 'string') throw new TypeError('heavyApply: content must be string');

  const sections = parseHeavyView(content);
  const entries = await loadYumeEntries(fileUrls);
  const selected = selectHeavyEntries(entries, rootId, normalizeDepth(depth));
  const byRelative = new Map(selected.map((entry) => [entry.relativeFile, entry]));
  const byBlockId = new Map(selected.map((entry) => [entry.block.id, entry]));
  const sectionByFile = new Map();

  for (const section of sections) {
    const entry = byRelative.get(section.meta.file) ?? byBlockId.get(section.meta.id);
    if (!entry) throw new Error(`heavyApply: view contains unknown file: ${section.meta.file ?? section.meta.id ?? '?'}`);
    if (sectionByFile.has(entry.file)) throw new Error(`heavyApply: duplicate file section: ${entry.relativeFile}`);
    sectionByFile.set(entry.file, { entry, section });
  }

  for (const entry of selected) {
    if (!sectionByFile.has(entry.file)) throw new Error(`heavyApply: missing file section: ${entry.relativeFile}`);
  }

  const unchanged = [];
  const pending = [];
  for (const { entry, section } of sectionByFile.values()) {
    if (section.content === latestContent(entry)) {
      unchanged.push(entry.relativeFile);
    } else {
      pending.push({ entry, section });
    }
  }

  if (pending.length === 0) {
    return { updated: [], unchanged, applyId: null, newHashes: {} };
  }

  const applyId = opts.applyId ?? makeApplyId();
  const release = await acquireLocks(pending.map(({ entry }) => entry.file));
  const updated = [];
  const newHashes = {};

  try {
    for (const { entry, section } of pending) {
      const parsed = await readParsedFile(entry.file);
      const currentHead = parsed.block.versions.at(-1);
      if (!currentHead) throw new Error(`heavyApply: no versions: ${entry.relativeFile}`);
      if (parsed.head !== currentHead.content) {
        throw new Error(`heavyApply: HEAD is dirty: ${entry.relativeFile}`);
      }
      if (section.meta.hash && currentHead.hash !== section.meta.hash) {
        throw new Error(`heavyApply: stale view for ${entry.relativeFile}: expected ${section.meta.hash}, found ${currentHead.hash}`);
      }

      parsed.head = section.content;
      const version = appendVersion(parsed.block, section.content, { ...opts, applyId });
      await atomicWrite(entry.file, serializeBlock(parsed));
      updated.push(entry.relativeFile);
      newHashes[entry.relativeFile] = version.hash;
    }
  } finally {
    await release();
  }

  return { updated, unchanged, applyId, newHashes };
}

export async function recompress(fileUrls, rootId, editedView, depth = 1, opts = {}) {
  return heavyApply(fileUrls, rootId, editedView, depth, opts);
}

async function loadYumeEntries(fileUrls) {
  const filePaths = normalizeFileUrls(fileUrls);
  const root = commonDirectory(filePaths);
  const entries = [];

  for (const file of filePaths) {
    const parsed = await readYumeFileOrNull(file);
    if (!parsed) continue;
    entries.push({
      file,
      relativeFile: relative(root, file) || basename(file),
      block: parsed.block,
      head: parsed.head,
      boot: parsed.boot,
    });
  }

  if (entries.length === 0) throw new Error('heavy: no readable yume block files');
  return entries;
}

async function loadYumeEntriesForCheck(fileUrls) {
  const filePaths = normalizeFileUrls(fileUrls);
  const root = commonDirectory(filePaths);
  const entries = [];
  const issues = [];

  for (const file of filePaths) {
    const relativeFile = relative(root, file) || basename(file);
    try {
      const parsed = await readParsedFile(file);
      entries.push({
        file,
        relativeFile,
        block: parsed.block,
        head: parsed.head,
        boot: parsed.boot,
      });
    } catch (error) {
      if (isPlainHandleRuntime(file, error)) continue;
      issues.push({
        level: 'error',
        type: 'invalid-file',
        file,
        relativeFile,
        message: error?.message ?? String(error),
      });
    }
  }

  return { entries, issues };
}

function isPlainHandleRuntime(file) {
  return basename(file).endsWith('.handle.yume.js');
}

function normalizeFileUrls(fileUrls) {
  if (!Array.isArray(fileUrls) || fileUrls.length === 0) {
    throw new TypeError('fileUrls must be a non-empty array');
  }
  const out = [];
  const seen = new Set();
  for (const fileUrl of fileUrls) {
    const file = resolve(toPath(fileUrl));
    if (seen.has(file)) continue;
    seen.add(file);
    out.push(file);
  }
  return out;
}

function commonDirectory(filePaths) {
  let root = dirname(filePaths[0]);
  while (filePaths.some((file) => !isInside(root, file))) {
    const parent = dirname(root);
    if (parent === root) break;
    root = parent;
  }
  return root;
}

function isInside(root, file) {
  const rel = relative(root, file);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..');
}

function selectHeavyEntries(entries, rootId, depth) {
  if (rootId == null || rootId === '' || rootId === '*') return entries;
  const root = findHeavyEntry(entries, String(rootId));
  if (!root) throw new Error(`heavy: root not found: ${rootId}`);

  const selected = [];
  const seen = new Set();
  const queue = [{ entry: root, distance: 0 }];
  const byFile = new Map(entries.map((entry) => [entry.file, entry]));
  const byBlockId = new Map(entries.map((entry) => [entry.block.id, entry]));

  while (queue.length > 0) {
    const { entry, distance } = queue.shift();
    if (seen.has(entry.file)) continue;
    seen.add(entry.file);
    selected.push(entry);

    if (distance >= depth) continue;
    for (const ref of latestRefs(entry)) {
      const next = resolveEntryRef(entry, ref, byFile, byBlockId);
      if (next && !seen.has(next.file)) queue.push({ entry: next, distance: distance + 1 });
    }
  }

  return selected;
}

function selectImpactEntries(entries, rootId, depth) {
  const root = findHeavyEntry(entries, String(rootId ?? ''));
  if (!root) throw new Error(`impact: root not found: ${rootId}`);

  const byFile = new Map(entries.map((entry) => [entry.file, entry]));
  const byBlockId = new Map(entries.map((entry) => [entry.block.id, entry]));
  const reverseRefs = buildReverseRefs(entries, byFile, byBlockId);
  const selected = [];
  const seen = new Set([root.file]);
  const queue = [{ entry: root, distance: 0 }];

  while (queue.length > 0) {
    const { entry, distance } = queue.shift();
    if (distance >= depth) continue;

    for (const edge of reverseRefs.get(entry.file) ?? []) {
      if (seen.has(edge.entry.file)) continue;
      seen.add(edge.entry.file);
      const next = { entry: edge.entry, distance: distance + 1, via: edge.ref };
      selected.push(next);
      queue.push(next);
    }
  }

  return selected;
}

function buildReverseRefs(entries, byFile, byBlockId) {
  const reverseRefs = new Map(entries.map((entry) => [entry.file, []]));
  for (const entry of entries) {
    for (const ref of latestRefs(entry)) {
      const target = resolveEntryRef(entry, ref, byFile, byBlockId);
      if (!target) continue;
      reverseRefs.get(target.file).push({ entry, ref });
    }
  }
  return reverseRefs;
}

function addUnresolvedRefIssue(issues, entry, ref) {
  if (!ref || typeof ref.target !== 'string') return;
  if (ref.kind === 'calls') return;
  const pathLike = looksLikePathRef(ref.target);
  issues.push({
    level: pathLike ? 'error' : 'warning',
    type: pathLike ? 'dangling-path-ref' : 'unresolved-ref',
    file: entry.file,
    relativeFile: entry.relativeFile,
    blockId: entry.block.id,
    ref,
    message: `${pathLike ? 'dangling path ref' : 'unresolved ref'} '${ref.kind}:${ref.target}'`,
  });
}

function findRefCycles(entries, adjacency) {
  const byFile = new Map(entries.map((entry) => [entry.file, entry]));
  const cycles = [];
  const seenCycles = new Set();
  const stack = [];
  const stackSet = new Set();
  const visited = new Set();

  function visit(file) {
    if (stackSet.has(file)) {
      const start = stack.indexOf(file);
      const cycleFiles = stack.slice(start).concat(file);
      const key = canonicalCycleKey(cycleFiles);
      if (!seenCycles.has(key)) {
        seenCycles.add(key);
        cycles.push(cycleFiles.map((cycleFile) => byFile.get(cycleFile)));
      }
      return;
    }
    if (visited.has(file)) return;

    visited.add(file);
    stack.push(file);
    stackSet.add(file);
    for (const next of adjacency.get(file) ?? []) visit(next);
    stackSet.delete(file);
    stack.pop();
  }

  for (const entry of entries) visit(entry.file);
  return cycles;
}

function canonicalCycleKey(files) {
  const cycle = files.slice(0, -1);
  if (cycle.length === 0) return '';
  let best = null;
  for (let i = 0; i < cycle.length; i++) {
    const rotated = cycle.slice(i).concat(cycle.slice(0, i)).join('\0');
    if (best == null || rotated < best) best = rotated;
  }
  return best;
}

function findHeavyEntry(entries, rootId) {
  const normalized = resolveMaybePath(rootId);
  return entries.find((entry) =>
    entry.block.id === rootId ||
    entry.relativeFile === rootId ||
    entry.file === normalized ||
    basename(entry.file) === rootId
  );
}

function resolveMaybePath(value) {
  try {
    return resolve(toPath(value));
  } catch {
    return value;
  }
}

function latestVersion(entry) {
  return entry.block.versions.at(-1) ?? null;
}

function latestContent(entry) {
  return latestVersion(entry)?.content ?? entry.head;
}

function latestRefs(entry) {
  return latestVersion(entry)?.refs ?? [];
}

function resolveEntryRef(entry, ref, byFile, byBlockId) {
  if (!ref || typeof ref.target !== 'string') return null;
  const byId = byBlockId.get(ref.target);
  if (byId) return byId;

  if (looksLikePathRef(ref.target)) {
    const targetFile = resolve(dirname(entry.file), ref.target);
    return byFile.get(targetFile) ?? null;
  }

  return null;
}

function looksLikePathRef(target) {
  return target.startsWith('./') ||
    target.startsWith('../') ||
    target.startsWith('/') ||
    target.endsWith('.yume.js');
}

function serializeHeavyView(entries, rootId, depth) {
  const meta = {
    rootId,
    depth: formatDepth(depth),
    files: entries.length,
  };
  let out = `${HEAVY_HEADER}\n`;
  out += `// yume:root ${JSON.stringify(meta)}\n\n`;

  for (const entry of entries) {
    const version = latestVersion(entry);
    const content = latestContent(entry);
    const fileMeta = {
      file: entry.relativeFile,
      id: entry.block.id,
      type: entry.block.type,
      hash: version?.hash ?? null,
      refs: version?.refs?.length ?? 0,
      tags: version?.tags ?? [],
      contentEndsWithNewline: content.endsWith('\n'),
    };
    out += `${HEAVY_FILE_BEGIN}\n`;
    out += `${HEAVY_META_PREFIX}${JSON.stringify(fileMeta)}\n`;
    out += `${HEAVY_CONTENT_BEGIN}\n`;
    out += content;
    if (!content.endsWith('\n')) out += '\n';
    out += `${HEAVY_FILE_END}\n\n`;
  }

  return out;
}

function parseHeavyView(view) {
  const lines = view.split(/\r?\n/);
  const sections = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== HEAVY_FILE_BEGIN) continue;

    const metaLine = lines[++i];
    if (!metaLine?.startsWith(HEAVY_META_PREFIX)) throw new Error('parseHeavyView: missing file metadata');
    let meta;
    try {
      meta = JSON.parse(metaLine.slice(HEAVY_META_PREFIX.length));
    } catch (e) {
      throw new Error('parseHeavyView: invalid file metadata: ' + e.message);
    }

    if (lines[++i] !== HEAVY_CONTENT_BEGIN) throw new Error(`parseHeavyView: missing content marker for ${meta.file ?? meta.id ?? '?'}`);
    const contentLines = [];
    while (++i < lines.length && lines[i] !== HEAVY_FILE_END) {
      contentLines.push(lines[i]);
    }
    if (i >= lines.length) throw new Error(`parseHeavyView: missing end marker for ${meta.file ?? meta.id ?? '?'}`);

    let content = contentLines.join('\n');
    if (meta.contentEndsWithNewline) content += '\n';
    sections.push({ meta, content });
  }

  if (sections.length === 0) throw new Error('parseHeavyView: no file sections found');
  return sections;
}

function normalizeDepth(depth) {
  if (depth === Number.POSITIVE_INFINITY) return depth;
  if (depth === 'all' || depth === '*') return Number.POSITIVE_INFINITY;
  const n = Number(depth);
  if (!Number.isInteger(n) || n < 0) throw new TypeError('depth must be a non-negative integer or `all`');
  return n;
}

function formatDepth(depth) {
  const normalized = normalizeDepth(depth);
  return Number.isFinite(normalized) ? normalized : 'all';
}

// ============================================================
// apply — applyId group 閲覧
// ============================================================
export async function applyList(fileUrl) {
  globalThis.__yumeCoverHook?.('applyList', arguments);
  const filePath = toPath(fileUrl);
  const { block } = await readParsedFile(filePath);
  const groups = new Map();
  for (const version of block.versions) {
    if (!version.applyId) continue;
    const group = groups.get(version.applyId) ?? {
      applyId: version.applyId,
      versions: [],
      noteCount: 0,
    };
    group.versions.push(version);
    groups.set(version.applyId, group);
  }
  for (const group of groups.values()) {
    group.noteCount = (block.notes?.[`apply:${group.applyId}`] ?? []).length;
  }
  return [...groups.values()];
}

export async function applyShow(fileUrl, applyId) {
  globalThis.__yumeCoverHook?.('applyShow', arguments);
  const filePath = toPath(fileUrl);
  const { block } = await readParsedFile(filePath);
  const id = normalizeApplyId(applyId);
  ensureApplyExists(block, id);
  return {
    applyId: id,
    versions: block.versions.filter((version) => version.applyId === id),
    notes: block.notes?.[`apply:${id}`] ?? [],
  };
}

export async function applyIndex(folder) {
  globalThis.__yumeCoverHook?.('applyIndex', arguments);
  const root = toPath(folder);
  const files = await listYumeFiles(root);
  const groups = new Map();

  for (const file of files) {
    const parsed = await readYumeFileOrNull(file);
    if (!parsed) continue;
    for (const version of parsed.block.versions) {
      if (!version.applyId) continue;
      const group = groups.get(version.applyId) ?? {
        applyId: version.applyId,
        files: new Map(),
        versionCount: 0,
        noteCount: 0,
      };
      const fileEntry = group.files.get(file) ?? {
        file,
        relativeFile: relative(root, file),
        blockId: parsed.block.id,
        versions: [],
        notes: parsed.block.notes?.[`apply:${version.applyId}`] ?? [],
      };
      fileEntry.versions.push(version);
      group.versionCount++;
      group.files.set(file, fileEntry);
      groups.set(version.applyId, group);
    }
  }

  return [...groups.values()].map((group) => {
    const files = [...group.files.values()];
    return {
      applyId: group.applyId,
      files,
      fileCount: files.length,
      versionCount: group.versionCount,
      noteCount: files.reduce((sum, file) => sum + file.notes.length, 0),
    };
  });
}

export async function applySearch(folder, applyId) {
  globalThis.__yumeCoverHook?.('applySearch', arguments);
  const id = normalizeApplyId(applyId);
  const groups = await applyIndex(folder);
  const group = groups.find((g) => g.applyId === id);
  if (!group) {
    return {
      applyId: id,
      files: [],
      fileCount: 0,
      versionCount: 0,
      noteCount: 0,
    };
  }
  return group;
}

async function listYumeFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      files.push(...await listYumeFiles(path));
    } else if (entry.isFile() && entry.name.endsWith('.yume.js')) {
      files.push(path);
    }
  }
  return files;
}

async function readYumeFileOrNull(filePath) {
  try {
    return await readParsedFile(filePath);
  } catch {
    return null;
  }
}

async function readParsedFile(filePath) {
  const source = await readFile(filePath, 'utf8');
  const parsed = parseBlock(source);
  assertValidBlock(parsed.block);
  return parsed;
}

function ensureNotes(block) {
  if (block.notes === undefined) block.notes = {};
  if (!isPlainObject(block.notes)) throw new Error('notes must be an object');
}

function makeNote(note) {
  if (!isPlainObject(note)) throw new TypeError('note must be an object');
  if (typeof note.text !== 'string' || note.text.length === 0) throw new TypeError('note.text must be a non-empty string');
  const stored = {
    id: `n-${randomUUID()}`,
    author: note.author ?? 'human',
    ts: Date.now(),
    text: note.text,
  };
  if (typeof stored.author !== 'string' || stored.author.length === 0) throw new TypeError('note.author must be a non-empty string');
  if (note.kind != null) {
    if (typeof note.kind !== 'string') throw new TypeError('note.kind must be a string when present');
    stored.kind = note.kind;
  }
  return stored;
}

function findNote(block, key, noteId) {
  if (typeof noteId !== 'string' || noteId.length === 0) throw new TypeError('noteId must be a non-empty string');
  const note = block.notes?.[key]?.find((n) => n.id === noteId);
  if (!note) throw new Error(`note not found: ${noteId}`);
  return note;
}

function resolveNoteKey(block, target) {
  if (target == null || target === '' || target === 'head' || target === 'latest') {
    const head = block.versions.at(-1);
    if (!head) throw new Error('resolveNoteKey: no versions');
    return head.hash;
  }
  if (typeof target !== 'string') throw new TypeError('note target must be string');

  if (target.startsWith('apply:')) {
    const applyId = normalizeApplyId(target.slice('apply:'.length));
    ensureApplyExists(block, applyId);
    return `apply:${applyId}`;
  }
  if (target.startsWith('apply-')) {
    const applyId = normalizeApplyId(target);
    ensureApplyExists(block, applyId);
    return `apply:${applyId}`;
  }
  if (/^-?\d+$/.test(target)) {
    const index = Number(target);
    const resolved = index < 0 ? block.versions.at(index) : block.versions[index];
    if (!resolved) throw new Error(`version index not found: ${target}`);
    return resolved.hash;
  }

  const matches = block.versions.filter((version) => version.hash === target || version.hash.startsWith(target));
  if (matches.length === 0) throw new Error(`version hash not found: ${target}`);
  if (matches.length > 1) throw new Error(`version hash prefix is ambiguous: ${target}`);
  return matches[0].hash;
}

function ensureApplyExists(block, applyId) {
  if (!block.versions.some((version) => version.applyId === applyId)) {
    throw new Error(`applyId not found: ${applyId}`);
  }
}

function normalizeApplyId(applyId) {
  if (typeof applyId !== 'string' || applyId.length === 0) throw new TypeError('applyId must be a non-empty string');
  return applyId.startsWith('apply:') ? applyId.slice('apply:'.length) : applyId;
}

function makeApplyId() {
  const d = new Date();
  const date = [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-');
  return `apply-${date}-${randomUUID().slice(0, 8)}`;
}

function noteCountForVersion(block, version) {
  const versionNotes = block.notes?.[version.hash]?.length ?? 0;
  const applyNotes = version.applyId ? (block.notes?.[`apply:${version.applyId}`]?.length ?? 0) : 0;
  return versionNotes + applyNotes;
}

function appendVersion(block, content, opts = {}) {
  const lastVersion = block.versions.at(-1);
  const ts = Date.now();
  const prevHash = lastVersion?.hash ?? null;
  const hash = hashContent(content, prevHash, ts);
  const applyId = opts.applyId ?? (opts.note ? makeApplyId() : null);
  const extracted = extractRefsAndTags(content);
  const version = {
    hash,
    prevHash,
    content,
    ts,
    refs: extracted.refs,
    tags: extracted.tags,
    applyId,
  };
  block.versions.push(version);
  if (opts.note) {
    ensureNotes(block);
    block.notes[`apply:${applyId}`] ??= [];
    block.notes[`apply:${applyId}`].push(makeNote(opts.note));
  }
  return version;
}

function resolveVersion(block, target = 'head', opts = {}) {
  if (!Array.isArray(block.versions) || block.versions.length === 0) {
    throw new Error('resolveVersion: no versions');
  }
  if (target == null || target === '' || target === 'head' || target === 'latest') {
    return block.versions.at(-1);
  }
  if (typeof target === 'number' && Number.isInteger(target)) {
    return resolveVersionIndex(block, target, opts);
  }
  if (typeof target !== 'string') throw new TypeError('version target must be string or integer');

  if (/^-?\d+$/.test(target)) {
    return resolveVersionIndex(block, Number(target), opts);
  }

  const matches = block.versions.filter((version) => version.hash === target || version.hash.startsWith(target));
  if (matches.length === 0) throw new Error(`version not found: ${target}`);
  if (matches.length > 1) throw new Error(`version hash prefix is ambiguous: ${target}`);
  return matches[0];
}

function resolveVersionIndex(block, index, opts = {}) {
  const offset = opts.negativeFromPrevious && index < 0 ? -1 : 0;
  const actualIndex = index < 0 ? block.versions.length + index + offset : index;
  const version = block.versions[actualIndex];
  if (!version) throw new Error(`version index not found: ${index}`);
  return version;
}

function versionLabel(version, fallback) {
  return version ? `${version.hash.slice(0, 7)}` : fallback;
}

function lineDiff(oldText, newText, oldLabel = 'old', newLabel = 'new') {
  if (oldText === newText) return '';

  const a = splitDiffLines(oldText);
  const b = splitDiffLines(newText);
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const lines = [`--- ${oldLabel}`, `+++ ${newLabel}`];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push(` ${a[i]}`);
      i++;
      j++;
    } else if (j < b.length && (i === a.length || dp[i][j + 1] >= dp[i + 1][j])) {
      lines.push(`+${b[j]}`);
      j++;
    } else {
      lines.push(`-${a[i]}`);
      i++;
    }
  }
  return lines.join('\n') + '\n';
}

function splitDiffLines(text) {
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

// ============================================================
// commitManual — boundary case、AI 不在の人手編集救済
// ============================================================
export async function commitManual(fileUrl, opts = {}) {
  globalThis.__yumeCoverHook?.('commitManual', arguments);
  const filePath = toPath(fileUrl);
  const release = await acquireLock(filePath);
  try {
    const source = await readFile(filePath, 'utf8');
    const parsed = parseBlock(source);
    assertValidBlock(parsed.block);
    const headInSource = parsed.head;
    const lastVersion  = parsed.block.versions.at(-1);
    const lastContent  = lastVersion?.content ?? '';

    if (headInSource === lastContent) return { committed: false };

    const newVersion = appendVersion(parsed.block, headInSource, opts);
    await atomicWrite(filePath, serializeBlock(parsed));
    return { committed: true, newHash: newVersion.hash, applyId: newVersion.applyId };
  } finally {
    await release();
  }
}

// ============================================================
// history — versions 列挙
// ============================================================
export async function history(fileUrl) {
  globalThis.__yumeCoverHook?.('history', arguments);
  const filePath = toPath(fileUrl);
  const { block } = await readParsedFile(filePath);
  return block.versions;
}

export async function show(fileUrl, target = 'head') {
  globalThis.__yumeCoverHook?.('show', arguments);
  const filePath = toPath(fileUrl);
  const { block } = await readParsedFile(filePath);
  return resolveVersion(block, target);
}

export async function diff(fileUrl, from = '-2', to = '-1') {
  globalThis.__yumeCoverHook?.('diff', arguments);
  const filePath = toPath(fileUrl);
  const { block } = await readParsedFile(filePath);
  const oldVersion = resolveVersion(block, from);
  const newVersion = resolveVersion(block, to);
  return lineDiff(
    oldVersion.content,
    newVersion.content,
    versionLabel(oldVersion, String(from)),
    versionLabel(newVersion, String(to))
  );
}

export async function rollback(fileUrl, target, opts = {}) {
  globalThis.__yumeCoverHook?.('rollback', arguments);
  const filePath = toPath(fileUrl);
  const release = await acquireLock(filePath);
  try {
    const parsed = await readParsedFile(filePath);
    const lastVersion = parsed.block.versions.at(-1);
    if (!lastVersion) throw new Error('rollback: no versions');
    if (parsed.head !== lastVersion.content) {
      throw new Error('rollback: HEAD is dirty; run commit before rollback');
    }

    const targetVersion = resolveVersion(parsed.block, target, { negativeFromPrevious: true });
    if (targetVersion.hash === lastVersion.hash) {
      throw new Error('rollback: target is already the latest version');
    }

    parsed.head = targetVersion.content;
    const newVersion = appendVersion(parsed.block, targetVersion.content, opts);
    await atomicWrite(filePath, serializeBlock(parsed));
    return {
      newHash: newVersion.hash,
      targetHash: targetVersion.hash,
      applyId: newVersion.applyId,
    };
  } finally {
    await release();
  }
}

// ============================================================
// cli — verb dispatcher(BOOT region から呼ばれる)
// ============================================================
export async function cli(fileUrl, block, argv) {
  const verb = argv[2];
  switch (verb) {
    case 'commit': {
      const noteText = flagValue(argv, '--note');
      const r = await commitManual(fileUrl, {
        applyId: flagValue(argv, '--apply-id'),
        note: noteText ? {
          author: flagValue(argv, '--author') ?? 'human',
          kind: flagValue(argv, '--kind'),
          text: noteText,
        } : undefined,
      });
      console.log(r.committed ? `committed: ${r.newHash.slice(0, 7)}  apply=${r.applyId ?? '-'}` : 'no changes');
      return;
    }
    case 'history': {
      const parsed = await readParsedFile(toPath(fileUrl));
      for (const v of parsed.block.versions) {
        const ts = new Date(v.ts).toISOString();
        const aid = v.applyId ?? '-';
        const notes = noteCountForVersion(parsed.block, v);
        console.log(`${v.hash.slice(0, 7)}  ${ts}  refs=${v.refs.length}  apply=${aid}  notes=${notes}`);
      }
      return;
    }
    case 'heavy':
    case 'decompress': {
      const rootId = argv[3] ?? block.id;
      const depth = parseDepthArg(argv[4], 1);
      const inputs = positionalArgs(argv, 5);
      const files = inputs.length > 0 ? await expandFileInputs(inputs) : [fileUrl];
      process.stdout.write(await heavy(files, rootId, depth));
      return;
    }
    case 'heavy-apply':
    case 'recompress': {
      const viewPath = argv[3];
      if (!viewPath) return usage(`${verb} <viewFile|-> [rootId] [depth] [fileOrFolder...]`);
      const rootId = argv[4] ?? block.id;
      const depth = parseDepthArg(argv[5], 1);
      const inputs = positionalArgs(argv, 6);
      const files = inputs.length > 0 ? await expandFileInputs(inputs) : [fileUrl];
      const noteText = flagValue(argv, '--note');
      const view = viewPath === '-' ? await readStdin() : await readFile(toPath(viewPath), 'utf8');
      const r = await heavyApply(files, rootId, view, depth, {
        applyId: flagValue(argv, '--apply-id'),
        note: noteText ? {
          author: flagValue(argv, '--author') ?? 'human',
          kind: flagValue(argv, '--kind'),
          text: noteText,
        } : undefined,
      });
      console.log(`apply=${r.applyId ?? '-'}  updated=${r.updated.length}  unchanged=${r.unchanged.length}`);
      for (const file of r.updated) console.log(`  updated ${file}  ${r.newHashes[file].slice(0, 7)}`);
      for (const file of r.unchanged) console.log(`  unchanged ${file}`);
      return;
    }
    case 'show': {
      const v = await show(fileUrl, argv[3] ?? 'head');
      console.log(`hash: ${v.hash}`);
      console.log(`prevHash: ${v.prevHash ?? '-'}`);
      console.log(`ts: ${new Date(v.ts).toISOString()}`);
      console.log(`refs: ${v.refs.length}`);
      console.log(`tags: ${v.tags.join(',') || '-'}`);
      console.log(`apply: ${v.applyId ?? '-'}`);
      console.log('--- content');
      process.stdout.write(v.content.endsWith('\n') ? v.content : `${v.content}\n`);
      return;
    }
    case 'diff': {
      const from = argv[3] ?? '-2';
      const to = argv[4] ?? '-1';
      process.stdout.write(await diff(fileUrl, from, to));
      return;
    }
    case 'rollback': {
      const target = argv[3];
      if (!target) return usage('rollback <target>');
      const noteText = flagValue(argv, '--note');
      const r = await rollback(fileUrl, target, {
        applyId: flagValue(argv, '--apply-id'),
        note: noteText ? {
          author: flagValue(argv, '--author') ?? 'human',
          kind: flagValue(argv, '--kind'),
          text: noteText,
        } : undefined,
      });
      console.log(`rolled back: ${r.targetHash.slice(0, 7)} -> ${r.newHash.slice(0, 7)}  apply=${r.applyId ?? '-'}`);
      return;
    }
    case 'note-add': {
      const target = argv[3];
      const text = argv.slice(4).join(' ');
      if (!target || !text) return usage('note-add <target> <text>');
      const r = await noteAdd(fileUrl, target, { author: 'human', text });
      console.log(`note added: ${r.noteId}  key=${r.key}`);
      return;
    }
    case 'note-edit': {
      const target = argv[3];
      const noteId = argv[4];
      const text = argv.slice(5).join(' ');
      if (!target || !noteId || !text) return usage('note-edit <target> <noteId> <text>');
      const r = await noteEdit(fileUrl, target, noteId, { text });
      console.log(`note edited: ${r.noteId}  key=${r.key}`);
      return;
    }
    case 'note-rm': {
      const target = argv[3];
      const noteId = argv[4];
      if (!target || !noteId) return usage('note-rm <target> <noteId>');
      const r = await noteRm(fileUrl, target, noteId);
      console.log(`note removed: ${noteId}  key=${r.key}`);
      return;
    }
    case 'note-list': {
      const notes = await noteList(fileUrl, argv[3] ?? null);
      for (const note of notes) {
        const kind = note.kind ?? '-';
        console.log(`${note.key}  ${note.id}  ${new Date(note.ts).toISOString()}  ${note.author}  ${kind}  ${note.text}`);
      }
      return;
    }
    case 'notes-search': {
      const folder = argv[3];
      const query = argv.slice(4).join(' ');
      if (!folder || !query) return usage('notes-search <folder> <query>');
      const notes = await notesSearch(folder, query);
      for (const note of notes) {
        const kind = note.kind ?? '-';
        console.log(`${note.relativeFile}  ${note.key}  ${note.id}  ${new Date(note.ts).toISOString()}  ${note.author}  ${kind}  ${note.text}`);
      }
      return;
    }
    case 'refs': {
      for (const ref of await refs(fileUrl)) {
        console.log(`${ref.kind}  ${ref.target}`);
      }
      return;
    }
    case 'tags': {
      for (const tag of await tags(fileUrl)) {
        console.log(tag);
      }
      return;
    }
    case 'impact': {
      const rootId = argv[3] ?? block.id;
      const depth = parseDepthArg(argv[4], 1);
      const inputs = positionalArgs(argv, 5);
      const files = inputs.length > 0 ? await expandFileInputs(inputs) : [fileUrl];
      for (const item of await impact(files, rootId, depth)) {
        const via = item.via ? `${item.via.kind}:${item.via.target}` : '-';
        console.log(`${item.relativeFile}  block=${item.blockId}  distance=${item.distance}  via=${via}`);
      }
      return;
    }
    case 'refs-check': {
      const inputs = refsCheckInputs(argv);
      const files = inputs.length > 0 ? await expandFileInputs(inputs) : [fileUrl];
      const report = await refsCheck(files);
      if (hasFlag(argv, '--json')) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        printRefsCheckReport(report);
      }
      if (!report.ok) process.exit(1);
      return;
    }
    case 'apply-list': {
      const groups = await applyList(fileUrl);
      for (const group of groups) {
        console.log(`${group.applyId}  versions=${group.versions.length}  notes=${group.noteCount}`);
      }
      return;
    }
    case 'apply-show': {
      const applyId = argv[3];
      if (!applyId) return usage('apply-show <applyId>');
      const group = await applyShow(fileUrl, applyId);
      console.log(`${group.applyId}  versions=${group.versions.length}  notes=${group.notes.length}`);
      for (const v of group.versions) {
        console.log(`  version ${v.hash.slice(0, 7)}  ${new Date(v.ts).toISOString()}`);
      }
      for (const note of group.notes) {
        const kind = note.kind ?? '-';
        console.log(`  note ${note.id}  ${new Date(note.ts).toISOString()}  ${note.author}  ${kind}  ${note.text}`);
      }
      return;
    }
    case 'apply-index': {
      const folder = argv[3] ?? '.';
      const groups = await applyIndex(folder);
      for (const group of groups) {
        console.log(`${group.applyId}  files=${group.fileCount}  versions=${group.versionCount}  notes=${group.noteCount}`);
      }
      return;
    }
    case 'apply-search': {
      const folder = argv[3];
      const applyId = argv[4];
      if (!folder || !applyId) return usage('apply-search <folder> <applyId>');
      const group = await applySearch(folder, applyId);
      console.log(`${group.applyId}  files=${group.fileCount}  versions=${group.versionCount}  notes=${group.noteCount}`);
      for (const file of group.files) {
        console.log(`  file ${file.relativeFile}  block=${file.blockId}  versions=${file.versions.length}  notes=${file.notes.length}`);
        for (const v of file.versions) {
          console.log(`    version ${v.hash.slice(0, 7)}  ${new Date(v.ts).toISOString()}`);
        }
        for (const note of file.notes) {
          const kind = note.kind ?? '-';
          console.log(`    note ${note.id}  ${new Date(note.ts).toISOString()}  ${note.author}  ${kind}  ${note.text}`);
        }
      }
      return;
    }
    case 'validate': {
      const source = await readFile(toPath(fileUrl), 'utf8');
      const { block } = parseBlock(source);
      const result = validateBlock(block);
      if (!result.ok) {
        for (const error of result.errors) console.error(`invalid: ${error}`);
        process.exit(1);
      }
      console.log('valid');
      return;
    }
    default:
      console.error(`yume: unknown verb '${verb}'. v001 supports: commit, history, heavy, heavy-apply, decompress, recompress, show, diff, rollback, validate, refs, tags, impact, refs-check, note-add, note-edit, note-rm, note-list, notes-search, apply-list, apply-show, apply-index, apply-search`);
      process.exit(1);
  }
}

// ============================================================
// utility
// ============================================================
function flagValue(argv, name) {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const value = argv[i + 1];
  if (!value || value.startsWith('--')) return undefined;
  return value;
}

function hasFlag(argv, name) {
  return argv.includes(name);
}

function printRefsCheckReport(report) {
  console.log(`refs-check: ${report.ok ? 'ok' : 'failed'}  files=${report.files}  errors=${report.errors.length}  warnings=${report.warnings.length}  info=${report.info.length}`);
  for (const issue of report.issues) {
    console.log(formatRefsCheckIssue(issue));
  }
}

function formatRefsCheckIssue(issue) {
  const parts = [issue.level, issue.type];
  if (issue.relativeFile) parts.push(issue.relativeFile);
  if (issue.blockId) parts.push(`block=${issue.blockId}`);
  if (issue.ref) parts.push(`ref=${issue.ref.kind}:${issue.ref.target}`);
  if (issue.files) parts.push(`files=${issue.files.join(' -> ')}`);
  if (issue.message) parts.push(`- ${issue.message}`);
  return parts.join('  ');
}

function refsCheckInputs(argv) {
  const out = [];
  for (let i = 3; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') continue;
    if (arg.startsWith('--')) {
      if (argv[i + 1] && !argv[i + 1].startsWith('--')) i++;
      continue;
    }
    out.push(arg);
  }
  return out;
}

function positionalArgs(argv, start) {
  const out = [];
  for (let i = start; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      if (argv[i + 1] && !argv[i + 1].startsWith('--')) i++;
      continue;
    }
    out.push(arg);
  }
  return out;
}

function parseDepthArg(value, fallback) {
  if (value == null || value.startsWith?.('--')) return fallback;
  return normalizeDepth(value);
}

async function expandFileInputs(inputs) {
  const files = [];
  const seen = new Set();
  for (const input of inputs) {
    const path = resolve(toPath(input));
    const info = await stat(path);
    const expanded = info.isDirectory() ? await listYumeFiles(path) : [path];
    for (const file of expanded) {
      const resolved = resolve(file);
      if (seen.has(resolved)) continue;
      seen.add(resolved);
      files.push(resolved);
    }
  }
  return files;
}

async function readStdin() {
  process.stdin.setEncoding('utf8');
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

function usage(message) {
  console.error(`usage: ${message}`);
  process.exit(1);
}

function toPath(fileUrl) {
  if (typeof fileUrl !== 'string') throw new TypeError('fileUrl must be string');
  return fileUrl.startsWith('file:') ? fileURLToPath(fileUrl) : fileUrl;
}
