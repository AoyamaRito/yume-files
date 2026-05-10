// e2e.js — yume-files Phase 1〜3 partial の round-trip 検証
//
// 検証項目:
//   1. parseBlock — hello.fn.yume.js が parse できる
//   2. serializeBlock — parse → serialize → parse の round-trip 一致
//   3. hashContent — 決定的、prevHash chain 動作
//   4. atomicWrite + acquireLock — concurrent 動作の sanity
//   5. commitManual — clean(差なし)/ dirty(HEAD 編集後)の挙動
//   6. history — versions が正しく返る
//   7. show / diff — version 取得と text diff
//   8. notes / apply / rollback — mutable notes、folder search、applyId group、append-only rollback
//   9. folder apply — 複数 file 横断 apply 検索
//   10. heavy / heavyApply / impact / refsCheck — codec round-trip、multi-file applyId、refs graph
//
// 実 file を直接編集する代わりに tmp folder に hello を copy → 編集 → commit → 検査。

import { readFile, writeFile, stat, mkdir, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseBlock, serializeBlock, hashContent, extractRefsAndTags,
  atomicWrite, acquireLock, commitManual, history, validateBlock,
  heavy, heavyApply, impact, refsCheck,
  show, diff, rollback,
  refs as readRefs, tags as readTags,
  noteAdd, noteEdit, noteRm, noteList, notesSearch, applyList, applyShow, applyIndex, applySearch,
} from './runtimes/ver001.handle.yume.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const HELLO_SRC = join(HERE, 'examples', 'hello.fn.yume.js');
const RUNTIME_SRC = join(HERE, 'runtimes', 'ver001.handle.yume.js');
const PACKAGE_SRC = join(HERE, 'package.json');
const RUNBOOK_SRC = join(HERE, 'runAndReadMe.aiDoc.yume.js');

let pass = 0;
let fail = 0;

function assert(cond, label) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else      { fail++; console.error(`  ✗ ${label}`); }
}

function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

async function writeFixture(file, { id, type, content, ts }) {
  const p = parseBlock(await readFile(HELLO_SRC, 'utf8'));
  const extracted = extractRefsAndTags(content);
  p.block.id = id;
  p.block.type = type;
  p.block.versions = [{
    hash: hashContent(content, null, ts),
    prevHash: null,
    content,
    ts,
    refs: extracted.refs,
    tags: extracted.tags,
    applyId: null,
  }];
  p.head = content;
  p.boot = p.boot.replace('../runtimes/ver', './runtimes/ver');
  await atomicWrite(file, serializeBlock(p));
}

// ============================================================
// 0. project invariants
// ============================================================
console.log('\n[0] project invariants');
const packageJson = JSON.parse(await readFile(PACKAGE_SRC, 'utf8'));
assert(Object.keys(packageJson.dependencies ?? {}).length === 0, 'package has no runtime dependencies');
assert(Object.keys(packageJson.devDependencies ?? {}).length === 0, 'package has no dev dependencies');
const runbookSource = await readFile(RUNBOOK_SRC, 'utf8');
const runbookParsed = parseBlock(runbookSource);
assert(runbookParsed.block.id === 'runAndReadMe', 'runbook block id is runAndReadMe');
assert(runbookParsed.block.type === 'aiDoc', 'runbook block type is aiDoc');
assert(validateBlock(runbookParsed.block).ok, 'runbook validates hash chain');
assert(runbookParsed.block.versions.at(-1).refs.some((ref) => ref.target === 'BLOCKFILE'), 'runbook refs canonical spec');
assert(runbookParsed.block.versions.at(-1).refs.some((ref) => ref.target === 'hello'), 'runbook refs minimal example');
assert(packageJson.scripts.runbook === 'node runAndReadMe.aiDoc.yume.js show head', 'package exposes runbook script');

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
// 1c. parseBlock — nested marker literals (aiDoc self-description)
// ============================================================
console.log('\n[1c] parseBlock nested markers');
const nestedSource = `// @yume-format: 1

export const __block = {
  "id": "nested",
  "type": "doc",
  "schemaVersion": 1,
  "runtime": { "name": "yume", "version": "001" },
  "versions": []
};

// === HEAD ===
export const Markers = {
  begin: "// === HEAD ===",
  end:   "// === /HEAD ===",
};
export const Sample = \`
// === HEAD ===
inner content
// === /HEAD ===
\`;
export const real = "preserved";
// === /HEAD ===

// === BOOT ===
console.log("boot region");
// === /BOOT ===
`;
const nested = parseBlock(nestedSource);
assert(nested.head.includes('export const real = "preserved";'), 'parseBlock skips marker literals inside string/template');
assert(nested.head.includes('// === HEAD ==='), 'string-bound marker literal preserved in HEAD content');
assert(nested.boot.trim() === 'console.log("boot region");', 'BOOT extracted past nested HEAD markers');

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

const extracted = extractRefsAndTags(`
import { formatName } from './format.fn.yume.js';
export { helper } from './helper.module.yume.js';
const mod = await import('./dynamic.module.yume.js');
// @tags: greeting public-api
export function hello(name) {
  return formatName(name);
}
`);
assert(extracted.refs.some((ref) => ref.kind === 'import' && ref.target === './format.fn.yume.js'), 'extractRefsAndTags detects import refs');
assert(extracted.refs.some((ref) => ref.kind === 'export' && ref.target === './helper.module.yume.js'), 'extractRefsAndTags detects export refs');
assert(extracted.refs.some((ref) => ref.kind === 'dynamic-import' && ref.target === './dynamic.module.yume.js'), 'extractRefsAndTags detects dynamic import refs');
assert(extracted.refs.some((ref) => ref.kind === 'calls' && ref.target === 'formatName'), 'extractRefsAndTags detects call refs');
assert(extracted.tags.includes('greeting') && extracted.tags.includes('public-api'), 'extractRefsAndTags detects tags');
const extractedNoise = extractRefsAndTags(`
const text = "notActuallyCalled()";
// alsoNotCalled()
realCall();
`);
assert(!extractedNoise.refs.some((ref) => ref.target === 'notActuallyCalled'), 'extractRefsAndTags ignores calls in quoted strings');
assert(!extractedNoise.refs.some((ref) => ref.target === 'alsoNotCalled'), 'extractRefsAndTags ignores calls in comments');
assert(extractedNoise.refs.some((ref) => ref.kind === 'calls' && ref.target === 'realCall'), 'extractRefsAndTags keeps real call refs');

const extractedSourceBoundaries = extractRefsAndTags([
  `const docs = "import { nope } from './quoted.js'; // @tags: quoted";`,
  'const templateDoc = `',
  '// @tags: template-noise',
  'notTemplateTextCall();',
  '${templateExprCall(name)}',
  '`;',
  '// @tags: real-tag',
  `import { yes } from './real.js';`,
  `const dynamic = await import('./real-dynamic.js');`,
  'realBoundaryCall();',
].join('\n'));
assert(!extractedSourceBoundaries.refs.some((ref) => ref.target === './quoted.js'), 'extractRefsAndTags ignores import text inside strings');
assert(!extractedSourceBoundaries.tags.includes('quoted'), 'extractRefsAndTags ignores tag text inside strings');
assert(!extractedSourceBoundaries.tags.includes('template-noise'), 'extractRefsAndTags ignores tag text inside template text');
assert(!extractedSourceBoundaries.refs.some((ref) => ref.target === 'notTemplateTextCall'), 'extractRefsAndTags ignores calls in template text');
assert(extractedSourceBoundaries.refs.some((ref) => ref.target === 'templateExprCall'), 'extractRefsAndTags keeps calls inside template expressions');
assert(extractedSourceBoundaries.refs.some((ref) => ref.kind === 'import' && ref.target === './real.js'), 'extractRefsAndTags keeps real import refs after string masking');
assert(extractedSourceBoundaries.refs.some((ref) => ref.kind === 'dynamic-import' && ref.target === './real-dynamic.js'), 'extractRefsAndTags keeps real dynamic import refs after string masking');
assert(extractedSourceBoundaries.tags.includes('real-tag'), 'extractRefsAndTags keeps real comment tags');
assert(extractedSourceBoundaries.refs.some((ref) => ref.target === 'realBoundaryCall'), 'extractRefsAndTags keeps real boundary calls');

const extractedExplicitRefs = extractRefsAndTags([
  '// @ref: ./novel.world.yume.js',
  '// @ref: uses character-profile',
  'const quotedRef = "// @ref: ./not-real.yume.js";',
].join('\n'));
assert(extractedExplicitRefs.refs.some((ref) => ref.kind === 'ref' && ref.target === './novel.world.yume.js'), 'extractRefsAndTags detects explicit @ref path refs');
assert(extractedExplicitRefs.refs.some((ref) => ref.kind === 'uses' && ref.target === 'character-profile'), 'extractRefsAndTags detects explicit @ref typed refs');
assert(!extractedExplicitRefs.refs.some((ref) => ref.target === './not-real.yume.js'), 'extractRefsAndTags ignores explicit @ref inside strings');

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
  p.head = `import { formatName } from './format.fn.yume.js';
// @tags: greeting public-api
export function hello(name) {
  return formatName(name);
}
`;
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
assert(versions[1].content.includes('formatName(name)'), 'second version content reflects edit');
assert(versions[1].applyId === null, 'commitManual leaves applyId=null');
assert(versions[1].refs.some((ref) => ref.kind === 'import' && ref.target === './format.fn.yume.js'), 'commitManual stores import refs');
assert(versions[1].refs.some((ref) => ref.kind === 'calls' && ref.target === 'formatName'), 'commitManual stores call refs');
assert(versions[1].tags.includes('greeting') && versions[1].tags.includes('public-api'), 'commitManual stores tags');
assert((await readRefs(tmpFile)).length === versions[1].refs.length, 'refs() reads latest refs');
assert((await readTags(tmpFile)).includes('greeting'), 'tags() reads latest tags');
assert(validateBlock(parseBlock(await readFile(tmpFile, 'utf8')).block).ok, 'history validates after commit');

// ============================================================
// 7. show / diff
// ============================================================
console.log('\n[7] show / diff');
const shownFirst = await show(tmpFile, 0);
const shownLatest = await show(tmpFile, '-1');
const versionDiff = await diff(tmpFile, 0, 1);
assert(shownFirst.hash === versions[0].hash, 'show() resolves numeric index');
assert(shownLatest.hash === versions[1].hash, 'show() resolves negative latest index');
assert(versionDiff.includes(`--- ${versions[0].hash.slice(0, 7)}`), 'diff() includes old version label');
assert(versionDiff.includes(`+++ ${versions[1].hash.slice(0, 7)}`), 'diff() includes new version label');
assert(versionDiff.includes('-  return `hello, ${name}!`;'), 'diff() includes removed line');
assert(versionDiff.includes('+  return formatName(name);'), 'diff() includes added line');

// ============================================================
// 8. notes / apply
// ============================================================
console.log('\n[8] notes / apply');
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
  p.head = p.head.replace('return formatName(name);', 'return `hey, ${formatName(name)}!`;');
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
// 8b. rollback
// ============================================================
console.log('\n[8b] rollback');
let dirtyRollbackBlocked = false;
{
  const s = await readFile(tmpFile, 'utf8');
  const p = parseBlock(s);
  p.head += '// dirty edit\n';
  await atomicWrite(tmpFile, serializeBlock(p));
  try { await rollback(tmpFile, '-1'); } catch { dirtyRollbackBlocked = true; }

  const restored = parseBlock(await readFile(tmpFile, 'utf8'));
  restored.head = restored.block.versions.at(-1).content;
  await atomicWrite(tmpFile, serializeBlock(restored));
}
assert(dirtyRollbackBlocked, 'rollback refuses dirty HEAD');
const beforeRollback = await history(tmpFile);
const targetBeforeRollback = beforeRollback.at(-2);
const latestBeforeRollback = beforeRollback.at(-1);
const rb = await rollback(tmpFile, '-1', {
  note: { author: 'ai', text: 'rollback to previous version', kind: 'rollback' },
});
const afterRollback = await history(tmpFile);
assert(afterRollback.length === beforeRollback.length + 1, 'rollback appends a new version');
assert(rb.targetHash === targetBeforeRollback.hash, 'rollback -1 targets previous version');
assert(afterRollback.at(-1).prevHash === latestBeforeRollback.hash, 'rollback chains from previous head');
assert(afterRollback.at(-1).content === targetBeforeRollback.content, 'rollback content matches target version');
assert(afterRollback.at(-1).applyId === rb.applyId && rb.applyId, 'rollback with note stores an applyId');
assert((await show(tmpFile, 'head')).hash === rb.newHash, 'show() reads rollback head');
assert(validateBlock(parseBlock(await readFile(tmpFile, 'utf8')).block).ok, 'rollback validates after mutation');

// ============================================================
// 9. folder apply
// ============================================================
console.log('\n[9] folder apply');
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
const noteHits = await notesSearch(tmpDir, 'changed second file');
assert(noteHits.length === 1, 'notesSearch finds matching note text');
assert(noteHits[0].relativeFile === 'hello2.fn.yume.js', 'notesSearch reports relative file');
assert(noteHits[0].blockId === 'hello2', 'notesSearch reports block id');

// ============================================================
// 10. heavy / heavyApply / impact / refsCheck
// ============================================================
console.log('\n[10] heavy / heavyApply / impact / refsCheck');
const formatFile = join(tmpDir, 'format.fn.yume.js');
{
  const s = await readFile(HELLO_SRC, 'utf8');
  const p = parseBlock(s);
  const content = `export function formatName(name) {
  return \`formatted \${name}\`;
}
`;
  const ts = 1714000001000;
  p.block.id = 'formatName';
  p.block.type = 'fn';
  p.block.versions = [{
    hash: hashContent(content, null, ts),
    prevHash: null,
    content,
    ts,
    refs: [],
    tags: ['helper'],
    applyId: null,
  }];
  p.head = content;
  p.boot = p.boot.replace('../runtimes/ver', './runtimes/ver');
  await atomicWrite(formatFile, serializeBlock(p));
}

const heavyView = await heavy([tmpFile, tmpFile2, formatFile], 'hello', 1);
assert(heavyView.startsWith('// @yume-heavy: 1'), 'heavy() emits heavy view header');
assert(heavyView.includes('"file":"hello.fn.yume.js"'), 'heavy() includes root file');
assert(heavyView.includes('"file":"format.fn.yume.js"'), 'heavy() follows import refs within depth');
assert(!heavyView.includes('"file":"hello2.fn.yume.js"'), 'heavy() excludes unrelated files');

const editedHeavyView = heavyView.replace('return formatName(name);', 'return formatName(name).toUpperCase();');
const codecApply = await heavyApply([tmpFile, tmpFile2, formatFile], 'hello', editedHeavyView, 1, {
  note: { author: 'ai', text: 'codec round-trip edit', kind: 'codec' },
});
assert(codecApply.updated.length === 1 && codecApply.updated[0] === 'hello.fn.yume.js', 'heavyApply updates edited file only');
assert(codecApply.unchanged.includes('format.fn.yume.js'), 'heavyApply reports unchanged dependency');
assert(codecApply.applyId && codecApply.newHashes['hello.fn.yume.js'], 'heavyApply returns applyId and new hash');
const codecVersions = await history(tmpFile);
assert(codecVersions.at(-1).content.includes('toUpperCase()'), 'heavyApply appends edited content');
assert(codecVersions.at(-1).applyId === codecApply.applyId, 'heavyApply stores shared applyId');
const codecGroup = await applyShow(tmpFile, codecApply.applyId);
assert(codecGroup.notes.length === 1 && codecGroup.notes[0].text === 'codec round-trip edit', 'heavyApply stores apply note');

const heavyViewAfter = await heavy([tmpFile, tmpFile2, formatFile], 'hello', 1);
const noopApply = await heavyApply([tmpFile, tmpFile2, formatFile], 'hello', heavyViewAfter, 1);
assert(noopApply.updated.length === 0 && noopApply.applyId === null, 'heavyApply is no-op when view is unchanged');

const worldFile = join(tmpDir, 'novel.world.yume.js');
const chapterOneFile = join(tmpDir, 'chapter-one.draft.yume.js');
const chapterTwoFile = join(tmpDir, 'chapter-two.draft.yume.js');
await writeFixture(worldFile, {
  id: 'novelWorld',
  type: 'world',
  content: `export const world = { name: "Aster" };
`,
  ts: 1714000002000,
});
await writeFixture(chapterOneFile, {
  id: 'chapterOne',
  type: 'draft',
  content: `// @ref: uses ./novel.world.yume.js
export const chapterOne = "opening";
`,
  ts: 1714000003000,
});
await writeFixture(chapterTwoFile, {
  id: 'chapterTwo',
  type: 'draft',
  content: `// @ref: novelWorld
export const chapterTwo = "turn";
`,
  ts: 1714000004000,
});

const impactedWorld = await impact([worldFile, chapterOneFile, chapterTwoFile], 'novelWorld', 1);
assert(impactedWorld.length === 2, 'impact() finds direct reverse refs');
assert(impactedWorld.some((item) => item.relativeFile === 'chapter-one.draft.yume.js' && item.via.kind === 'uses'), 'impact() reports explicit path ref kind');
assert(impactedWorld.some((item) => item.relativeFile === 'chapter-two.draft.yume.js' && item.via.kind === 'ref'), 'impact() reports explicit id ref kind');

const explicitHeavyView = await heavy([worldFile, chapterOneFile, chapterTwoFile], 'chapterOne', 1);
assert(explicitHeavyView.includes('"file":"novel.world.yume.js"'), 'heavy() follows explicit @ref path refs');

const cleanRefsReport = await refsCheck([worldFile, chapterOneFile, chapterTwoFile]);
assert(cleanRefsReport.ok && cleanRefsReport.errors.length === 0, 'refsCheck() passes resolved explicit refs');

const brokenRefFile = join(tmpDir, 'broken-ref.draft.yume.js');
await writeFixture(brokenRefFile, {
  id: 'brokenRef',
  type: 'draft',
  content: `// @ref: ./missing.world.yume.js
export const brokenRef = "missing";
`,
  ts: 1714000005000,
});
const brokenRefsReport = await refsCheck([worldFile, brokenRefFile]);
assert(!brokenRefsReport.ok, 'refsCheck() fails dangling path refs');
assert(brokenRefsReport.errors.some((issue) => issue.type === 'dangling-path-ref' && issue.relativeFile === 'broken-ref.draft.yume.js'), 'refsCheck() reports dangling path refs');

const duplicateWorldFile = join(tmpDir, 'duplicate.world.yume.js');
await writeFixture(duplicateWorldFile, {
  id: 'novelWorld',
  type: 'world',
  content: `export const duplicateWorld = {};
`,
  ts: 1714000006000,
});
const duplicateRefsReport = await refsCheck([worldFile, duplicateWorldFile]);
assert(!duplicateRefsReport.ok, 'refsCheck() fails duplicate block ids');
assert(duplicateRefsReport.errors.some((issue) => issue.type === 'duplicate-block-id' && issue.blockId === 'novelWorld'), 'refsCheck() reports duplicate block ids');

const cycleAFile = join(tmpDir, 'cycle-a.spec.yume.js');
const cycleBFile = join(tmpDir, 'cycle-b.spec.yume.js');
await writeFixture(cycleAFile, {
  id: 'cycleA',
  type: 'spec',
  content: `// @ref: cycleB
export const cycleA = true;
`,
  ts: 1714000007000,
});
await writeFixture(cycleBFile, {
  id: 'cycleB',
  type: 'spec',
  content: `// @ref: cycleA
export const cycleB = true;
`,
  ts: 1714000008000,
});
const cycleRefsReport = await refsCheck([cycleAFile, cycleBFile]);
assert(cycleRefsReport.ok, 'refsCheck() treats cycles as warnings');
assert(cycleRefsReport.warnings.some((issue) => issue.type === 'cycle'), 'refsCheck() reports refs cycles');

// ============================================================
// cleanup
// ============================================================
await rm(tmpDir, { recursive: true, force: true });

// ============================================================
// summary
// ============================================================
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);

// [11] squash / decompression (Zlib Self-Compression)
{
  console.log("\n[11] squash / decompression (Zlib Self-Compression)");
  
  const f = join(tmpDir, "squash.fn.yume.js");
  const { squash } = await import('./runtimes/ver001.handle.yume.js'); await cp(HELLO_SRC, f);
  let newHash;
  for (let i = 1; i <= 5; i++) {
    const src = await readFile(f, "utf8");
    const changed = src.replace(/\/\/ === HEAD ===[\s\S]*?\/\/ === \/HEAD ===/, "// === HEAD ===\nexport function hello(name) { return \"" + "A".repeat(100*i) + "\"; }\n// === /HEAD ===");
    await writeFile(f, changed);
    const res = await commitManual(f);
    if (!res.committed) throw new Error("commit failed");
    newHash = res.newHash;
  }
  
  const { validateBlock, parseBlock } = await import('./runtimes/ver001.handle.yume.js'); const sourceBefore = await readFile(f, 'utf8'); const vBefore = validateBlock(parseBlock(sourceBefore).block);
  assert(vBefore.ok, "must be valid before squash");
  
  const sizeBefore = (await stat(f)).size;

  const { squashedCount } = await squash(f, 2);
  assert(squashedCount === 4, "should squash exactly 4 old versions (initial + 3 edits)");

  const sizeAfter = (await stat(f)).size;
  assert(sizeAfter < sizeBefore, "file size should decrease significantly");
  
  const sourceAfter = await readFile(f, 'utf8'); const vAfter = validateBlock(parseBlock(sourceAfter).block);
  assert(vAfter.ok, "must remain valid after squash");

  const { diff, history, rollback } = await import('./runtimes/ver001.handle.yume.js');
  const hist = await history(f);
  assert(hist.length === 6, "logical history length must remain 6");

  const diffStr = await diff(f, 0, 1);
  assert(diffStr.includes("return \"A"), "diff must be able to decompress and read old content");

  await rollback(f, 0);
  const rollbackHead = await readFile(f, "utf8");
  assert(rollbackHead.includes("return \`hello"), "rollback must restore original content from squashed state");

  
}

console.log("\n=== " + pass + " passed, " + fail + " failed ===");
if (fail > 0) process.exit(1);

// [12] squash edge cases & resilience
{
  console.log("\n[12] squash edge cases & resilience");
  const tmpDir = join(tmpdir(), "yume-files-e2e-" + process.pid + "-" + Date.now()); 
  await mkdir(join(tmpDir, "runtimes"), { recursive: true }); 
  await cp(RUNTIME_SRC, join(tmpDir, "runtimes", "ver001.handle.yume.js"));
  const f = join(tmpDir, "edge.fn.yume.js");
  await cp(HELLO_SRC, f);
  
  const rt = await import("./runtimes/ver001.handle.yume.js");

  for (let i = 1; i <= 3; i++) {
    let { block: curBlock, head, boot } = rt.parseBlock(await readFile(f, "utf8"));
    head = "\nexport function test() { return \"edit " + i + "\"; }\n";
    await writeFile(f, rt.serializeBlock({block: curBlock, head, boot}));
    const res = await rt.commitManual(f);
    assert(res.committed, "commit failed at " + i);
  }
  await rt.squash(f, 2);
  let parsed = rt.parseBlock(await readFile(f, "utf8"));
  assert(Object.keys(parsed.block.compressedContents).length === 2, "should have 2 compressed blobs");
  
  for (let i = 4; i <= 6; i++) {
    let { block: curBlock, head, boot } = rt.parseBlock(await readFile(f, "utf8"));
    head = "\nexport function test() { return \"edit " + i + "\"; }\n";
    await writeFile(f, rt.serializeBlock({block: curBlock, head, boot}));
    const res = await rt.commitManual(f);
    assert(res.committed, "commit failed at " + i);
  }
  await rt.squash(f, 2);
  parsed = rt.parseBlock(await readFile(f, "utf8"));
  assert(Object.keys(parsed.block.compressedContents).length === 5, "should accumulate blobs to 5");
  assert(rt.validateBlock(rt.parseBlock(await readFile(f, 'utf8')).block).ok, 'must remain valid after double squash');

  const view = await rt.heavy([f], "hello", 1);
  assert(view.includes("return \"edit 6\";"), "heavy must read HEAD correctly");
  
  const changedView = view.replace("return \"edit 6\";", "return \"edit 7 via codec\";");
  await rt.heavyApply([f], "hello", changedView, 1);
  parsed = rt.parseBlock(await readFile(f, "utf8"));
  assert(Object.keys(parsed.block.compressedContents).length === 5, "heavyApply must NOT erase compressedContents");
  
  const targetHash = Object.keys(parsed.block.compressedContents)[0];
  delete parsed.block.compressedContents[targetHash];
  await writeFile(f, rt.serializeBlock(parsed));
  console.log("targetHash is", targetHash); console.log("is deleted?", parsed.block.compressedContents[targetHash] === undefined); let threwMissing = false;
  try { const raw = await readFile(f, "utf8"); const p = rt.parseBlock(raw); console.log("compressedContents keys:", Object.keys(p.block.compressedContents)); console.log("versions squashed:", p.block.versions.map(v => v.squashed)); await rt.history(f); console.log("HISTORY DID NOT THROW"); } catch (e) { console.log("HISTORY THREW", e.message);
    threwMissing = true;
  }
  assert(threwMissing, "must throw explicit error if compressed payload is missing");

  parsed.block.compressedContents[targetHash] = "NOT_A_VALID_ZLIB_PAYLOAD!@#";
  await writeFile(f, rt.serializeBlock(parsed));
  let threwZlib = false;
  try {
    rt.validateBlock(rt.parseBlock(await readFile(f, 'utf8')).block); 
  } catch (e) {
    threwZlib = true;
  }
  assert(threwZlib, "must throw explicit error if decompression fails due to corruption");

  await rm(tmpDir, { recursive: true, force: true });
}

