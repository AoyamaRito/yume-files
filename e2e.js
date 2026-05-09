// e2e.js — yume-files Phase 1〜3 partial の round-trip 検証
//
// 検証項目:
//   1. parseBlock — hello.fn.yume.js が parse できる
//   2. serializeBlock — parse → serialize → parse の round-trip 一致
//   3. hashContent — 決定的、prevHash chain 動作
//   4. atomicWrite + acquireLock — concurrent 動作の sanity
//   5. commitManual — clean(差なし)/ dirty(HEAD 編集後)の挙動
//   6. history — versions が正しく返る
//   7. notes / apply — mutable notes と applyId group の挙動
//   8. folder apply — 複数 file 横断 apply 検索
//
// 実 file を直接編集する代わりに tmp folder に hello を copy → 編集 → commit → 検査。

import { readFile, mkdir, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseBlock, serializeBlock, hashContent,
  atomicWrite, acquireLock, commitManual, history, validateBlock,
  noteAdd, noteEdit, noteRm, noteList, applyList, applyShow, applyIndex, applySearch,
} from './runtimes/ver001.handle.yume.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const HELLO_SRC = join(HERE, 'examples', 'hello.fn.yume.js');
const RUNTIME_SRC = join(HERE, 'runtimes', 'ver001.handle.yume.js');

let pass = 0;
let fail = 0;

function assert(cond, label) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else      { fail++; console.error(`  ✗ ${label}`); }
}

function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// ============================================================
// 1. parseBlock
// ============================================================
console.log('\n[1] parseBlock');
const helloSource = await readFile(HELLO_SRC, 'utf8');
const parsed = parseBlock(helloSource);
assert(parsed.block.id === 'hello', 'block.id is hello');
assert(parsed.block.type === 'fn', 'block.type is fn');
assert(parsed.block.runtime.version === '001', 'runtime.version is 001');
assert(parsed.block.versions.length === 1, 'has 1 initial version');
assert(parsed.head.includes('export function hello'), 'head contains hello function');
assert(parsed.boot && parsed.boot.includes('import.meta.url'), 'boot region present');
assert(validateBlock(parsed.block).ok, 'block validates hash chain');

// ============================================================
// 1b. parseBlock safety
// ============================================================
console.log('\n[1b] parseBlock safety');
globalThis.__yumeBlockParseExecuted = false;
const maliciousSource = `// @yume-format: 1

export const __block = {"id": (() => { globalThis.__yumeBlockParseExecuted = true; return "evil"; })()};

// === HEAD ===
export const x = 1;
// === /HEAD ===
`;
let rejectedExecutableBlock = false;
try { parseBlock(maliciousSource); } catch { rejectedExecutableBlock = true; }
assert(rejectedExecutableBlock, 'rejects non-JSON __block');
assert(globalThis.__yumeBlockParseExecuted === false, 'does not execute __block code');
delete globalThis.__yumeBlockParseExecuted;

// ============================================================
// 2. serializeBlock round-trip
// ============================================================
console.log('\n[2] serializeBlock round-trip');
const re = serializeBlock(parsed);
const reparsed = parseBlock(re);
assert(eq(parsed.block, reparsed.block), 'block round-trip equal');
assert(parsed.head === reparsed.head, 'head round-trip equal');
assert(parsed.boot === reparsed.boot, 'boot round-trip equal');

// ============================================================
// 3. hashContent
// ============================================================
console.log('\n[3] hashContent');
const h1 = hashContent('a', null, 1000);
const h2 = hashContent('a', null, 1000);
const h3 = hashContent('a', null, 1001);
const h4 = hashContent('a', 'prev', 1000);
assert(h1 === h2, 'deterministic for same input');
assert(h1 !== h3, 'changes with ts');
assert(h1 !== h4, 'changes with prevHash');
assert(/^[0-9a-f]{64}$/.test(h1), 'sha256 hex format');

const brokenBlock = JSON.parse(JSON.stringify(parsed.block));
brokenBlock.versions[0].hash = 'f'.repeat(64);
const brokenValidation = validateBlock(brokenBlock);
assert(!brokenValidation.ok && brokenValidation.errors.includes('versions[0].hash mismatch'), 'validateBlock catches hash mismatch');

// ============================================================
// 4. atomicWrite + acquireLock(tmp folder で実行)
// ============================================================
console.log('\n[4] atomicWrite + acquireLock');
const tmpDir = join(tmpdir(), `yume-files-e2e-${process.pid}-${Date.now()}`);
await mkdir(tmpDir, { recursive: true });
await mkdir(join(tmpDir, 'runtimes'), { recursive: true });
await cp(RUNTIME_SRC, join(tmpDir, 'runtimes', 'ver001.handle.yume.js'));
const tmpFile = join(tmpDir, 'hello.fn.yume.js');
await cp(HELLO_SRC, tmpFile);
// Fix the BOOT path — example uses ../runtimes/, but tmp layout has ./runtimes/
{
  let s = await readFile(tmpFile, 'utf8');
  s = s.replace('../runtimes/ver', './runtimes/ver');
  await atomicWrite(tmpFile, s);
}
const reread = await readFile(tmpFile, 'utf8');
assert(reread.includes('./runtimes/ver'), 'atomicWrite wrote to file');
const release = await acquireLock(tmpFile);
let lockBlocked = false;
try { await acquireLock(tmpFile); } catch (e) { lockBlocked = true; }
assert(lockBlocked, 'second lock attempt is blocked');
await release();

// ============================================================
// 5. commitManual — clean
// ============================================================
console.log('\n[5] commitManual — clean (no changes)');
const r1 = await commitManual(tmpFile);
assert(r1.committed === false, 'no commit when HEAD == head().content');

// ============================================================
// 5b. commitManual — dirty (edit HEAD region only, via parse/serialize)
// ============================================================
console.log('\n[5b] commitManual — dirty (after editing HEAD)');
{
  // text replace は versions[0].content (JSON) と HEAD 両方に hit するため、
  // ここでは parse/serialize を介して HEAD region のみ編集する
  // (= human が editor で HEAD だけ書き換えた状況の simulation)
  const s = await readFile(tmpFile, 'utf8');
  const p = parseBlock(s);
  p.head = p.head.replace('hello, ${name}!', 'hi, ${name}!');
  await atomicWrite(tmpFile, serializeBlock(p));
}
const r2 = await commitManual(tmpFile);
assert(r2.committed === true, 'commit happens when HEAD differs');
assert(typeof r2.newHash === 'string' && r2.newHash.length === 64, 'newHash is sha256 hex');

// commit 直後に再度 commit → no-op
const r3 = await commitManual(tmpFile);
assert(r3.committed === false, 'second commit is no-op (HEAD == new head().content)');

// ============================================================
// 6. history
// ============================================================
console.log('\n[6] history');
const versions = await history(tmpFile);
assert(versions.length === 2, 'history has 2 versions after 1 edit');
assert(versions[0].prevHash === null, 'first version has prevHash=null');
assert(versions[1].prevHash === versions[0].hash, 'second version chains to first');
assert(versions[1].content.includes('hi, ${name}'), 'second version content reflects edit');
assert(versions[1].applyId === null, 'commitManual leaves applyId=null');
assert(validateBlock(parseBlock(await readFile(tmpFile, 'utf8')).block).ok, 'history validates after commit');

// ============================================================
// 7. notes / apply
// ============================================================
console.log('\n[7] notes / apply');
const add = await noteAdd(tmpFile, 'head', { author: 'human', text: 'manual note', kind: 'intent' });
assert(typeof add.noteId === 'string' && add.noteId.startsWith('n-'), 'noteAdd returns note id');
assert(add.key === versions[1].hash, 'head note resolves to latest version hash');
let notes = await noteList(tmpFile, 'head');
assert(notes.length === 1 && notes[0].text === 'manual note', 'noteList reads head note');
await noteEdit(tmpFile, 'head', add.noteId, { text: 'edited note' });
notes = await noteList(tmpFile, 'head');
assert(notes[0].text === 'edited note', 'noteEdit updates text');
await noteRm(tmpFile, 'head', add.noteId);
notes = await noteList(tmpFile, 'head');
assert(notes.length === 0, 'noteRm removes note');

{
  const s = await readFile(tmpFile, 'utf8');
  const p = parseBlock(s);
  p.head = p.head.replace('hi, ${name}!', 'hey, ${name}!');
  await atomicWrite(tmpFile, serializeBlock(p));
}
const r4 = await commitManual(tmpFile, {
  applyId: 'apply-test-001',
  note: { author: 'ai', text: 'changed greeting via apply', kind: 'intent' },
});
assert(r4.committed === true && r4.applyId === 'apply-test-001', 'commitManual can set applyId');
const groups = await applyList(tmpFile);
assert(groups.length === 1 && groups[0].applyId === 'apply-test-001', 'applyList finds apply group');
assert(groups[0].versions.length === 1 && groups[0].noteCount === 1, 'applyList reports version and note counts');
const group = await applyShow(tmpFile, 'apply-test-001');
assert(group.versions.length === 1 && group.notes.length === 1, 'applyShow returns versions and apply notes');
assert(group.notes[0].text === 'changed greeting via apply', 'apply note text is stored');
assert(validateBlock(parseBlock(await readFile(tmpFile, 'utf8')).block).ok, 'notes/apply validate after mutation');

// ============================================================
// 8. folder apply
// ============================================================
console.log('\n[8] folder apply');
const tmpFile2 = join(tmpDir, 'hello2.fn.yume.js');
await cp(HELLO_SRC, tmpFile2);
{
  const s = await readFile(tmpFile2, 'utf8');
  const p = parseBlock(s);
  p.block.id = 'hello2';
  p.boot = p.boot.replace('../runtimes/ver', './runtimes/ver');
  p.head = p.head.replace('hello, ${name}!', 'yo, ${name}!');
  await atomicWrite(tmpFile2, serializeBlock(p));
}
const r5 = await commitManual(tmpFile2, {
  applyId: 'apply-test-001',
  note: { author: 'ai', text: 'changed second file in same apply', kind: 'intent' },
});
assert(r5.committed === true && r5.applyId === 'apply-test-001', 'second file can join same applyId');
const indexed = await applyIndex(tmpDir);
const indexedGroup = indexed.find((g) => g.applyId === 'apply-test-001');
assert(indexedGroup && indexedGroup.fileCount === 2, 'applyIndex finds apply across 2 files');
assert(indexedGroup.versionCount === 2 && indexedGroup.noteCount === 2, 'applyIndex aggregates versions and notes');
const searchedGroup = await applySearch(tmpDir, 'apply-test-001');
assert(searchedGroup.fileCount === 2, 'applySearch returns cross-file apply group');
assert(searchedGroup.files.some((file) => file.relativeFile === 'hello.fn.yume.js'), 'applySearch includes first file');
assert(searchedGroup.files.some((file) => file.relativeFile === 'hello2.fn.yume.js'), 'applySearch includes second file');

// ============================================================
// cleanup
// ============================================================
await rm(tmpDir, { recursive: true, force: true });

// ============================================================
// summary
// ============================================================
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
