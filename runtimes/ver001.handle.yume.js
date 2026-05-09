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
//   - commitManual(boundary case、AI 不在の人手編集救済)
//   - history / show / diff / rollback
//   - notes API(noteAdd / noteEdit / noteRm / noteList / notesSearch)
//   - apply API(applyList / applyShow / applyIndex / applySearch)
//   - refs / tags 抽出(import / export-from / dynamic import / bare calls / // @tags:)
//   - cli(verb dispatcher)
//
// 未実装(後続 phase):
//   - decompress / recompress(codec、Phase 5)
//
// spec: ../AiRunAndRead_BLOCKFILE.js

import { readFile, rename, unlink, open, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
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

// ============================================================
// parseBlock — source → {block, head, boot}
// ============================================================
export function parseBlock(source) {
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
  const beginIdx = source.indexOf(beginMarker);
  if (beginIdx < 0) return null;
  const afterBegin = beginIdx + beginMarker.length;
  // skip the newline immediately after begin marker
  const contentStart = source[afterBegin] === '\n' ? afterBegin + 1 : afterBegin;
  const endIdx = source.indexOf(endMarker, contentStart);
  if (endIdx < 0) return null;
  // trim the trailing newline before end marker
  const contentEnd = source[endIdx - 1] === '\n' ? endIdx - 1 : endIdx;
  return source.slice(contentStart, contentEnd);
}

// ============================================================
// serializeBlock — {block, head, boot} → source
// ============================================================
export function serializeBlock({ block, head, boot }) {
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
  return createHash('sha256')
    .update(content + '\n' + (prevHash ?? '') + '\n' + ts)
    .digest('hex');
}

// ============================================================
// refs / tags extraction — conservative source scan
// ============================================================
export function extractRefsAndTags(content) {
  if (typeof content !== 'string') throw new TypeError('extractRefsAndTags: content must be string');
  return {
    refs: extractRefs(content),
    tags: extractTags(content),
  };
}

function extractRefs(content) {
  const source = stripComments(content);
  const callSource = stripComments(content, { preservePlainStrings: false });
  const refs = [];

  collectModuleRefs(refs, source, /\bimport\s+(?:[^'";]*?\s+from\s*)?["']([^"']+)["']/g, 'import');
  collectModuleRefs(refs, source, /\bexport\s+[^'";]*?\s+from\s*["']([^"']+)["']/g, 'export');
  collectModuleRefs(refs, source, /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g, 'dynamic-import');
  collectCallRefs(refs, callSource);

  return uniqueRefs(refs);
}

function collectModuleRefs(refs, source, pattern, kind) {
  for (const match of source.matchAll(pattern)) {
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

function extractTags(content) {
  const tags = [];
  const pattern = /\/\/\s*@tags:\s*(.+)$/gm;
  for (const match of content.matchAll(pattern)) {
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

function stripComments(source, opts = {}) {
  const preservePlainStrings = opts.preservePlainStrings !== false;
  let out = '';
  let inString = false;
  let stringChar = null;
  let escape = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      out += c === '\n' ? '\n' : ' ';
      if (c === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      out += c === '\n' ? '\n' : ' ';
      if (c === '*' && next === '/') {
        out += ' ';
        i++;
        inBlockComment = false;
      }
      continue;
    }
    if (escape) {
      out += stringMaskChar(c, stringChar, preservePlainStrings);
      escape = false;
      continue;
    }
    if (inString) {
      out += stringMaskChar(c, stringChar, preservePlainStrings);
      if (c === '\\') {
        escape = true;
      } else if (c === stringChar) {
        inString = false;
      }
      continue;
    }

    if (c === '/' && next === '/') {
      out += '  ';
      i++;
      inLineComment = true;
      continue;
    }
    if (c === '/' && next === '*') {
      out += '  ';
      i++;
      inBlockComment = true;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inString = true;
      stringChar = c;
      out += stringMaskChar(c, stringChar, preservePlainStrings);
      continue;
    }
    out += c;
  }
  return out;
}

function stringMaskChar(c, stringChar, preservePlainStrings) {
  if (preservePlainStrings || stringChar === '`') return c;
  return c === '\n' ? '\n' : ' ';
}

// ============================================================
// atomicWrite — tmp + rename
// ============================================================
export async function atomicWrite(filePath, content) {
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
  const filePath = toPath(fileUrl);
  const { block } = await readParsedFile(filePath);
  return block.versions.at(-1)?.refs ?? [];
}

export async function tags(fileUrl) {
  const filePath = toPath(fileUrl);
  const { block } = await readParsedFile(filePath);
  return block.versions.at(-1)?.tags ?? [];
}

// ============================================================
// apply — applyId group 閲覧
// ============================================================
export async function applyList(fileUrl) {
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
  const filePath = toPath(fileUrl);
  const { block } = await readParsedFile(filePath);
  return block.versions;
}

export async function show(fileUrl, target = 'head') {
  const filePath = toPath(fileUrl);
  const { block } = await readParsedFile(filePath);
  return resolveVersion(block, target);
}

export async function diff(fileUrl, from = '-2', to = '-1') {
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
      console.error(`yume: unknown verb '${verb}'. v001 supports: commit, history, show, diff, rollback, validate, refs, tags, note-add, note-edit, note-rm, note-list, notes-search, apply-list, apply-show, apply-index, apply-search`);
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

function usage(message) {
  console.error(`usage: ${message}`);
  process.exit(1);
}

function toPath(fileUrl) {
  if (typeof fileUrl !== 'string') throw new TypeError('fileUrl must be string');
  return fileUrl.startsWith('file:') ? fileURLToPath(fileUrl) : fileUrl;
}
