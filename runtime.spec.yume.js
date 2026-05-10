// @yume-format: 1

export const __block = {
  "id": "runtime-spec",
  "type": "spec",
  "schemaVersion": 1,
  "runtime": {
    "name": "yume",
    "version": "001",
    "path": "./runtimes/ver001.handle.yume.js"
  },
  "api": [
    "commit",
    "history",
    "show",
    "diff",
    "validate"
  ],
  "versions": [
    {
      "hash": "8897755c0b43929c0b5d23946b110e001b5b9f2197900cb69d25c4522ef9e6ed",
      "prevHash": null,
      "content": "import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';\nimport { tmpdir } from 'node:os';\nimport { dirname, join } from 'node:path';\nimport { fileURLToPath } from 'node:url';\n\nconst HERE = dirname(fileURLToPath(import.meta.url));\nconst HELLO_SRC = join(HERE, 'examples/hello.fn.yume.js');\nconst RUNTIME_SRC = join(HERE, 'runtimes/ver001.handle.yume.js');\nconst HELLO = readFileSync(HELLO_SRC, 'utf8');\n\nasync function withFreshHello(body) {\n  const dir = mkdtempSync(join(tmpdir(), 'yume-spec-'));\n  mkdirSync(join(dir, 'runtimes'), { recursive: true });\n  copyFileSync(RUNTIME_SRC, join(dir, 'runtimes', 'ver001.handle.yume.js'));\n  const file = join(dir, 'hello.fn.yume.js');\n  copyFileSync(HELLO_SRC, file);\n  try { return await body(file, dir); }\n  finally { rmSync(dir, { recursive: true, force: true }); }\n}\n\nfunction rewriteHead(file, newHeadBody) {\n  const src = readFileSync(file, 'utf8');\n  const next = src.replace(\n    /\\/\\/ === HEAD ===[\\s\\S]*?\\/\\/ === \\/HEAD ===/,\n    '// === HEAD ===\\n' + newHeadBody + '\\n// === /HEAD ==='\n  );\n  writeFileSync(file, next);\n}\n\n// One case = one verifiable claim about a runtime function.\n// run(rt) returns truthy on pass, falsy on fail, or throws.\n// Phase 1 ad-hoc; schema may change as the strategy hardens.\nexport const cases = [\n  // ====================================================================\n  // PURE FUNCTIONS\n  // ====================================================================\n\n  // ---- parseBlock ----------------------------------------------------\n  { tag: 'parseBlock/hello/id',\n    fn: 'parseBlock',\n    run: (rt) => rt.parseBlock(HELLO).block.id === 'hello' },\n  { tag: 'parseBlock/hello/type-fn',\n    fn: 'parseBlock',\n    run: (rt) => rt.parseBlock(HELLO).block.type === 'fn' },\n  { tag: 'parseBlock/hello/single-version',\n    fn: 'parseBlock',\n    run: (rt) => rt.parseBlock(HELLO).block.versions.length === 1 },\n  { tag: 'parseBlock/hello/head-contains-fn',\n    fn: 'parseBlock',\n    run: (rt) => rt.parseBlock(HELLO).head.includes('export function hello') },\n  { tag: 'parseBlock/hello/boot-contains-cli',\n    fn: 'parseBlock',\n    run: (rt) => rt.parseBlock(HELLO).boot.includes('rt.cli') },\n  { tag: 'parseBlock/missing-block-throws',\n    fn: 'parseBlock',\n    run: (rt) => { try { rt.parseBlock('// nothing here'); return false; } catch { return true; } } },\n  { tag: 'parseBlock/missing-format-marker-throws',\n    fn: 'parseBlock',\n    run: (rt) => { try { rt.parseBlock('export const __block = {};'); return false; } catch { return true; } } },\n\n  // ---- hashContent ---------------------------------------------------\n  { tag: 'hashContent/64-hex-chars',\n    fn: 'hashContent',\n    run: (rt) => /^[0-9a-f]{64}$/.test(rt.hashContent('x', null, 0)) },\n  { tag: 'hashContent/deterministic',\n    fn: 'hashContent',\n    run: (rt) => rt.hashContent('x', null, 0) === rt.hashContent('x', null, 0) },\n  { tag: 'hashContent/changes-with-content',\n    fn: 'hashContent',\n    run: (rt) => rt.hashContent('x', null, 0) !== rt.hashContent('y', null, 0) },\n  { tag: 'hashContent/changes-with-prevHash',\n    fn: 'hashContent',\n    run: (rt) => rt.hashContent('x', null, 0) !== rt.hashContent('x', 'a'.repeat(64), 0) },\n  { tag: 'hashContent/changes-with-ts',\n    fn: 'hashContent',\n    run: (rt) => rt.hashContent('x', null, 0) !== rt.hashContent('x', null, 1) },\n  { tag: 'hashContent/empty-content-still-hex',\n    fn: 'hashContent',\n    run: (rt) => /^[0-9a-f]{64}$/.test(rt.hashContent('', null, 0)) },\n\n  // ---- extractRefsAndTags -------------------------------------------\n  { tag: 'extractRefsAndTags/empty/no-refs',\n    fn: 'extractRefsAndTags',\n    run: (rt) => rt.extractRefsAndTags('const x = 1;').refs.length === 0 },\n  { tag: 'extractRefsAndTags/empty/no-tags',\n    fn: 'extractRefsAndTags',\n    run: (rt) => rt.extractRefsAndTags('const x = 1;').tags.length === 0 },\n  { tag: 'extractRefsAndTags/import-path',\n    fn: 'extractRefsAndTags',\n    run: (rt) => rt.extractRefsAndTags(\"import x from './y.js';\").refs.some(r => r.target === './y.js') },\n  { tag: 'extractRefsAndTags/dynamic-import',\n    fn: 'extractRefsAndTags',\n    run: (rt) => rt.extractRefsAndTags(\"const m = await import('./y.js');\").refs.some(r => r.target === './y.js') },\n  { tag: 'extractRefsAndTags/at-ref-comment',\n    fn: 'extractRefsAndTags',\n    run: (rt) => rt.extractRefsAndTags('// @ref: foo').refs.some(r => r.target === 'foo') },\n  { tag: 'extractRefsAndTags/at-tags-comment',\n    fn: 'extractRefsAndTags',\n    run: (rt) => {\n      const t = rt.extractRefsAndTags('// @tags: alpha beta').tags;\n      return t.includes('alpha') && t.includes('beta');\n    } },\n  { tag: 'extractRefsAndTags/import-in-string-not-extracted',\n    fn: 'extractRefsAndTags',\n    run: (rt) => rt.extractRefsAndTags(\"const s = 'import x from \\\"./y.js\\\"';\").refs.length === 0 },\n  { tag: 'extractRefsAndTags/import-in-comment-not-extracted',\n    fn: 'extractRefsAndTags',\n    run: (rt) => rt.extractRefsAndTags(\"// import x from './y.js';\").refs.length === 0 },\n\n  // ---- validateBlock -------------------------------------------------\n  { tag: 'validateBlock/hello-ok',\n    fn: 'validateBlock',\n    run: (rt) => rt.validateBlock(rt.parseBlock(HELLO).block).ok === true },\n  { tag: 'validateBlock/missing-id-fails',\n    fn: 'validateBlock',\n    run: (rt) => {\n      const b = rt.parseBlock(HELLO).block;\n      delete b.id;\n      return rt.validateBlock(b).ok === false;\n    } },\n  { tag: 'validateBlock/empty-versions-fails',\n    fn: 'validateBlock',\n    run: (rt) => {\n      const b = rt.parseBlock(HELLO).block;\n      b.versions = [];\n      const r = rt.validateBlock(b);\n      return r.ok === false && r.errors.some(e => e.includes('at least one'));\n    } },\n  { tag: 'validateBlock/broken-hash-chain-fails',\n    fn: 'validateBlock',\n    run: (rt) => {\n      const b = rt.parseBlock(HELLO).block;\n      b.versions[0].hash = 'f'.repeat(64);\n      return rt.validateBlock(b).ok === false;\n    } },\n  { tag: 'validateBlock/null-fails-cleanly',\n    fn: 'validateBlock',\n    run: (rt) => {\n      try { return rt.validateBlock(null).ok === false; } catch { return true; }\n    } },\n\n  // ---- assertValidBlock ---------------------------------------------\n  { tag: 'assertValidBlock/returns-block-on-valid',\n    fn: 'assertValidBlock',\n    run: (rt) => {\n      const b = rt.parseBlock(HELLO).block;\n      return rt.assertValidBlock(b) === b;\n    } },\n  { tag: 'assertValidBlock/throws-on-invalid',\n    fn: 'assertValidBlock',\n    run: (rt) => {\n      const b = rt.parseBlock(HELLO).block;\n      b.versions = [];\n      try { rt.assertValidBlock(b); return false; } catch { return true; }\n    } },\n\n  // ---- serializeBlock (round-trip) ----------------------------------\n  { tag: 'serializeBlock/round-trip-id-preserved',\n    fn: 'serializeBlock',\n    run: (rt) => {\n      const p = rt.parseBlock(HELLO);\n      const out = rt.serializeBlock({ block: p.block, head: p.head, boot: p.boot });\n      return rt.parseBlock(out).block.id === 'hello';\n    } },\n  { tag: 'serializeBlock/round-trip-version-count-preserved',\n    fn: 'serializeBlock',\n    run: (rt) => {\n      const p = rt.parseBlock(HELLO);\n      const out = rt.serializeBlock({ block: p.block, head: p.head, boot: p.boot });\n      return rt.parseBlock(out).block.versions.length === p.block.versions.length;\n    } },\n  { tag: 'serializeBlock/round-trip-head-byte-equal',\n    fn: 'serializeBlock',\n    run: (rt) => {\n      const p = rt.parseBlock(HELLO);\n      const out = rt.serializeBlock({ block: p.block, head: p.head, boot: p.boot });\n      return rt.parseBlock(out).head === p.head;\n    } },\n  { tag: 'serializeBlock/round-trip-boot-byte-equal',\n    fn: 'serializeBlock',\n    run: (rt) => {\n      const p = rt.parseBlock(HELLO);\n      const out = rt.serializeBlock({ block: p.block, head: p.head, boot: p.boot });\n      return rt.parseBlock(out).boot === p.boot;\n    } },\n  { tag: 'serializeBlock/round-trip-validates',\n    fn: 'serializeBlock',\n    run: (rt) => {\n      const p = rt.parseBlock(HELLO);\n      const out = rt.serializeBlock({ block: p.block, head: p.head, boot: p.boot });\n      return rt.validateBlock(rt.parseBlock(out).block).ok === true;\n    } },\n  { tag: 'serializeBlock/idempotent',\n    fn: 'serializeBlock',\n    run: (rt) => {\n      const p = rt.parseBlock(HELLO);\n      const a = rt.serializeBlock({ block: p.block, head: p.head, boot: p.boot });\n      const b = rt.serializeBlock(rt.parseBlock(a));\n      return a === b;\n    } },\n\n  // ====================================================================\n  // I/O FUNCTIONS (each runs in an isolated tmpdir sandbox)\n  // ====================================================================\n\n  // ---- commitManual --------------------------------------------------\n  { tag: 'commitManual/clean-no-changes',\n    fn: 'commitManual',\n    run: (rt) => withFreshHello(async (f) => {\n      const r = await rt.commitManual(f);\n      return r.committed === false;\n    }) },\n  { tag: 'commitManual/dirty-extends-versions',\n    fn: 'commitManual',\n    run: (rt) => withFreshHello(async (f) => {\n      rewriteHead(f, 'export function hello(){return \"hi\";}');\n      const r = await rt.commitManual(f);\n      const after = rt.parseBlock(readFileSync(f, 'utf8')).block;\n      return r.committed === true && after.versions.length === 2;\n    }) },\n  { tag: 'commitManual/dirty-keeps-validity',\n    fn: 'commitManual',\n    run: (rt) => withFreshHello(async (f) => {\n      rewriteHead(f, 'export function hello(){return \"x\";}');\n      await rt.commitManual(f);\n      return rt.validateBlock(rt.parseBlock(readFileSync(f, 'utf8')).block).ok === true;\n    }) },\n  { tag: 'commitManual/prevHash-chains',\n    fn: 'commitManual',\n    run: (rt) => withFreshHello(async (f) => {\n      rewriteHead(f, 'export function hello(){return \"x\";}');\n      await rt.commitManual(f);\n      const vs = rt.parseBlock(readFileSync(f, 'utf8')).block.versions;\n      return vs[1].prevHash === vs[0].hash;\n    }) },\n  { tag: 'commitManual/applyId-preserved',\n    fn: 'commitManual',\n    run: (rt) => withFreshHello(async (f) => {\n      rewriteHead(f, 'export function hello(){return \"x\";}');\n      const r = await rt.commitManual(f, { applyId: 'apply-test-001' });\n      const v = rt.parseBlock(readFileSync(f, 'utf8')).block.versions[1];\n      return v.applyId === 'apply-test-001' && r.applyId === 'apply-test-001';\n    }) },\n  { tag: 'commitManual/note-attached-via-applyId',\n    fn: 'commitManual',\n    run: (rt) => withFreshHello(async (f) => {\n      rewriteHead(f, 'export function hello(){return \"x\";}');\n      const r = await rt.commitManual(f, { note: { author: 'spec', text: 'why' } });\n      const block = rt.parseBlock(readFileSync(f, 'utf8')).block;\n      const key = 'apply:' + r.applyId;\n      return Array.isArray(block.notes?.[key]) && block.notes[key].some(n => n.text === 'why');\n    }) },\n  { tag: 'commitManual/note-auto-creates-applyId',\n    fn: 'commitManual',\n    run: (rt) => withFreshHello(async (f) => {\n      rewriteHead(f, 'export function hello(){return \"x\";}');\n      const r = await rt.commitManual(f, { note: { author: 'spec', text: 'auto' } });\n      return typeof r.applyId === 'string' && r.applyId.length > 0;\n    }) },\n  { tag: 'commitManual/extracts-refs-from-head',\n    fn: 'commitManual',\n    run: (rt) => withFreshHello(async (f) => {\n      rewriteHead(f, \"import x from './other.js';\");\n      await rt.commitManual(f);\n      const v = rt.parseBlock(readFileSync(f, 'utf8')).block.versions[1];\n      return v.refs.some(r => r.target === './other.js');\n    }) },\n  { tag: 'commitManual/extracts-tags-from-head',\n    fn: 'commitManual',\n    run: (rt) => withFreshHello(async (f) => {\n      rewriteHead(f, '// @tags: alpha beta');\n      await rt.commitManual(f);\n      const v = rt.parseBlock(readFileSync(f, 'utf8')).block.versions[1];\n      return v.tags.includes('alpha') && v.tags.includes('beta');\n    }) },\n\n  // ---- show / history / diff ----------------------------------------\n  { tag: 'show/head-returns-latest',\n    fn: 'show',\n    run: (rt) => withFreshHello(async (f) => {\n      const v = await rt.show(f, 'head');\n      return /^[0-9a-f]{64}$/.test(v.hash);\n    }) },\n  { tag: 'show/index-0-returns-first',\n    fn: 'show',\n    run: (rt) => withFreshHello(async (f) => {\n      const v = await rt.show(f, 0);\n      return v.content.includes('hello, ');\n    }) },\n  { tag: 'history/length-matches-versions',\n    fn: 'history',\n    run: (rt) => withFreshHello(async (f) => {\n      const h = await rt.history(f);\n      return h.length === 1;\n    }) },\n  { tag: 'history/length-after-commit-extends',\n    fn: 'history',\n    run: (rt) => withFreshHello(async (f) => {\n      rewriteHead(f, 'export function hello(){return \"x\";}');\n      await rt.commitManual(f);\n      const h = await rt.history(f);\n      return h.length === 2;\n    }) },\n  { tag: 'diff/v0-vs-v1-shows-changes',\n    fn: 'diff',\n    run: (rt) => withFreshHello(async (f) => {\n      rewriteHead(f, 'export function hello(){return \"x\";}');\n      await rt.commitManual(f);\n      const d = await rt.diff(f, 0, -1);\n      return d.length > 0 && d.includes('\"x\"');\n    }) },\n\n  // ---- rollback ------------------------------------------------------\n  { tag: 'rollback/appends-not-truncates',\n    fn: 'rollback',\n    run: (rt) => withFreshHello(async (f) => {\n      rewriteHead(f, 'export function hello(){return \"edit\";}');\n      await rt.commitManual(f);\n      await rt.rollback(f, 0);\n      const v = rt.parseBlock(readFileSync(f, 'utf8')).block.versions;\n      return v.length === 3;\n    }) },\n  { tag: 'rollback/restores-content',\n    fn: 'rollback',\n    run: (rt) => withFreshHello(async (f) => {\n      rewriteHead(f, 'export function hello(){return \"edit\";}');\n      await rt.commitManual(f);\n      await rt.rollback(f, 0);\n      return readFileSync(f, 'utf8').includes('hello, ');\n    }) },\n  { tag: 'rollback/dirty-refuses',\n    fn: 'rollback',\n    run: (rt) => withFreshHello(async (f) => {\n      rewriteHead(f, 'export function hello(){return \"dirty\";}');\n      try { await rt.rollback(f, 0); return false; } catch { return true; }\n    }) },\n\n  // ---- heavy / heavyApply -------------------------------------------\n  { tag: 'heavy/contains-head',\n    fn: 'heavy',\n    run: (rt) => withFreshHello(async (f) => {\n      const v = await rt.heavy([f], 'hello', 1);\n      return v.includes('export function hello');\n    }) },\n  { tag: 'heavyApply/no-changes-noop',\n    fn: 'heavyApply',\n    run: (rt) => withFreshHello(async (f) => {\n      const view = await rt.heavy([f], 'hello', 1);\n      const r = await rt.heavyApply([f], 'hello', view, 1);\n      return r.updated.length === 0;\n    }) },\n  { tag: 'heavyApply/with-changes-updates',\n    fn: 'heavyApply',\n    run: (rt) => withFreshHello(async (f) => {\n      const view = await rt.heavy([f], 'hello', 1);\n      const edited = view.replace('hello, ', 'hi, ');\n      const r = await rt.heavyApply([f], 'hello', edited, 1);\n      return r.updated.length === 1;\n    }) },\n  { tag: 'heavyApply/with-changes-shared-applyId',\n    fn: 'heavyApply',\n    run: (rt) => withFreshHello(async (f) => {\n      const view = await rt.heavy([f], 'hello', 1);\n      const edited = view.replace('hello, ', 'hi, ');\n      const r = await rt.heavyApply([f], 'hello', edited, 1);\n      return typeof r.applyId === 'string' && r.applyId.length > 0;\n    }) },\n\n  // ---- refsCheck ----------------------------------------------------\n  { tag: 'refsCheck/clean-ok',\n    fn: 'refsCheck',\n    run: (rt) => withFreshHello(async (f) => {\n      const r = await rt.refsCheck([f]);\n      return r.ok === true && r.errors.length === 0;\n    }) },\n  { tag: 'refsCheck/dangling-path-errors',\n    fn: 'refsCheck',\n    run: (rt) => withFreshHello(async (f) => {\n      rewriteHead(f, \"import x from './does-not-exist.js';\");\n      await rt.commitManual(f);\n      const r = await rt.refsCheck([f]);\n      return r.ok === false && r.errors.length > 0;\n    }) },\n  { tag: 'refsCheck/duplicate-block-id-errors',\n    fn: 'refsCheck',\n    run: (rt) => withFreshHello(async (f, dir) => {\n      const f2 = join(dir, 'dupe.fn.yume.js');\n      copyFileSync(f, f2);\n      const r = await rt.refsCheck([f, f2]);\n      return r.ok === false && r.errors.some(e => e.type === 'duplicate-block-id');\n    }) },\n  { tag: 'refsCheck/isolated-info',\n    fn: 'refsCheck',\n    run: (rt) => withFreshHello(async (f) => {\n      const r = await rt.refsCheck([f]);\n      return r.info.some(i => i.type === 'isolated-file');\n    }) },\n\n  // ---- impact -------------------------------------------------------\n  { tag: 'impact/no-incoming-empty',\n    fn: 'impact',\n    run: (rt) => withFreshHello(async (f) => {\n      const r = await rt.impact([f], 'hello', 1);\n      return Array.isArray(r) && r.length === 0;\n    }) },\n\n  // ---- notes / search ----------------------------------------------\n  { tag: 'noteAdd/persists-via-noteList',\n    fn: 'noteAdd',\n    run: (rt) => withFreshHello(async (f) => {\n      await rt.noteAdd(f, 'head', { author: 'spec', text: 'because' });\n      const notes = await rt.noteList(f);\n      return notes.some(n => n.text === 'because');\n    }) },\n  { tag: 'noteEdit/replaces-text',\n    fn: 'noteEdit',\n    run: (rt) => withFreshHello(async (f) => {\n      const r = await rt.noteAdd(f, 'head', { author: 'spec', text: 'old' });\n      await rt.noteEdit(f, 'head', r.noteId, { text: 'new' });\n      const notes = await rt.noteList(f);\n      return notes.some(n => n.id === r.noteId && n.text === 'new');\n    }) },\n  { tag: 'noteRm/removes',\n    fn: 'noteRm',\n    run: (rt) => withFreshHello(async (f) => {\n      const r = await rt.noteAdd(f, 'head', { author: 'spec', text: 'gone' });\n      await rt.noteRm(f, 'head', r.noteId);\n      const notes = await rt.noteList(f);\n      return notes.every(n => n.id !== r.noteId);\n    }) },\n  { tag: 'notesSearch/finds-text',\n    fn: 'notesSearch',\n    run: (rt) => withFreshHello(async (f, dir) => {\n      await rt.noteAdd(f, 'head', { author: 'spec', text: 'findable-needle' });\n      const found = await rt.notesSearch(dir, 'findable-needle');\n      return found.length === 1 && found[0].text.includes('findable-needle');\n    }) },\n\n  // ---- refs / tags (file API) --------------------------------------\n  { tag: 'refs/empty-on-fresh-hello',\n    fn: 'refs',\n    run: (rt) => withFreshHello(async (f) => {\n      const r = await rt.refs(f);\n      return r.length === 0;\n    }) },\n  { tag: 'refs/from-latest-version',\n    fn: 'refs',\n    run: (rt) => withFreshHello(async (f) => {\n      rewriteHead(f, \"import x from './y.js';\");\n      await rt.commitManual(f);\n      const r = await rt.refs(f);\n      return r.some(x => x.target === './y.js');\n    }) },\n  { tag: 'tags/empty-on-fresh-hello',\n    fn: 'tags',\n    run: (rt) => withFreshHello(async (f) => {\n      const t = await rt.tags(f);\n      return t.length === 0;\n    }) },\n  { tag: 'tags/from-latest-version',\n    fn: 'tags',\n    run: (rt) => withFreshHello(async (f) => {\n      rewriteHead(f, '// @tags: alpha beta');\n      await rt.commitManual(f);\n      const t = await rt.tags(f);\n      return t.includes('alpha') && t.includes('beta');\n    }) },\n\n  // ---- apply* (group API) ------------------------------------------\n  { tag: 'applyList/no-apply-empty',\n    fn: 'applyList',\n    run: (rt) => withFreshHello(async (f) => {\n      const groups = await rt.applyList(f);\n      return groups.length === 0;\n    }) },\n  { tag: 'applyList/single-apply-found',\n    fn: 'applyList',\n    run: (rt) => withFreshHello(async (f) => {\n      rewriteHead(f, 'export function hello(){return \"x\";}');\n      await rt.commitManual(f, { applyId: 'apply-test' });\n      const groups = await rt.applyList(f);\n      return groups.length === 1 && groups[0].applyId === 'apply-test';\n    }) },\n  { tag: 'applyShow/returns-versions-for-applyId',\n    fn: 'applyShow',\n    run: (rt) => withFreshHello(async (f) => {\n      rewriteHead(f, 'export function hello(){return \"x\";}');\n      await rt.commitManual(f, { applyId: 'a1' });\n      const group = await rt.applyShow(f, 'a1');\n      return group.versions.length === 1 && group.applyId === 'a1';\n    }) },\n  { tag: 'applyShow/missing-throws',\n    fn: 'applyShow',\n    run: (rt) => withFreshHello(async (f) => {\n      try { await rt.applyShow(f, 'no-such'); return false; } catch { return true; }\n    }) },\n  { tag: 'applyIndex/folder-scan-finds-apply',\n    fn: 'applyIndex',\n    run: (rt) => withFreshHello(async (f, dir) => {\n      rewriteHead(f, 'export function hello(){return \"x\";}');\n      await rt.commitManual(f, { applyId: 'apply-folder' });\n      const groups = await rt.applyIndex(dir);\n      return groups.some(g => g.applyId === 'apply-folder');\n    }) },\n  { tag: 'applySearch/finds-by-id',\n    fn: 'applySearch',\n    run: (rt) => withFreshHello(async (f, dir) => {\n      rewriteHead(f, 'export function hello(){return \"x\";}');\n      await rt.commitManual(f, { applyId: 'apply-search' });\n      const group = await rt.applySearch(dir, 'apply-search');\n      return group.applyId === 'apply-search' && group.fileCount >= 1;\n    }) },\n\n  // ---- atomicWrite -------------------------------------------------\n  { tag: 'atomicWrite/creates-file',\n    fn: 'atomicWrite',\n    run: (rt) => withFreshHello(async (_f, dir) => {\n      const target = join(dir, 'new.txt');\n      await rt.atomicWrite(target, 'hello');\n      return readFileSync(target, 'utf8') === 'hello';\n    }) },\n  { tag: 'atomicWrite/overwrites',\n    fn: 'atomicWrite',\n    run: (rt) => withFreshHello(async (_f, dir) => {\n      const target = join(dir, 'new.txt');\n      writeFileSync(target, 'old');\n      await rt.atomicWrite(target, 'new');\n      return readFileSync(target, 'utf8') === 'new';\n    }) },\n\n  // ---- acquireLock -------------------------------------------------\n  { tag: 'acquireLock/release-allows-second-acquire',\n    fn: 'acquireLock',\n    run: (rt) => withFreshHello(async (f) => {\n      const r1 = await rt.acquireLock(f);\n      await r1();\n      const r2 = await rt.acquireLock(f);\n      await r2();\n      return true;\n    }) },\n  { tag: 'acquireLock/double-acquire-throws',\n    fn: 'acquireLock',\n    run: (rt) => withFreshHello(async (f) => {\n      const r1 = await rt.acquireLock(f);\n      try {\n        await rt.acquireLock(f);\n        await r1();\n        return false;\n      } catch {\n        await r1();\n        return true;\n      }\n    }) },\n  { tag: 'acquireLock/different-files-independent',\n    fn: 'acquireLock',\n    run: (rt) => withFreshHello(async (f, dir) => {\n      const f2 = join(dir, 'b.fn.yume.js');\n      copyFileSync(f, f2);\n      const r1 = await rt.acquireLock(f);\n      const r2 = await rt.acquireLock(f2);\n      await r1(); await r2();\n      return true;\n    }) },\n];\n",
      "ts": 1778401958421,
      "refs": [
        {
          "kind": "import",
          "target": "node:fs"
        },
        {
          "kind": "import",
          "target": "node:os"
        },
        {
          "kind": "import",
          "target": "node:path"
        },
        {
          "kind": "import",
          "target": "node:url"
        },
        {
          "kind": "calls",
          "target": "dirname"
        },
        {
          "kind": "calls",
          "target": "fileURLToPath"
        },
        {
          "kind": "calls",
          "target": "join"
        },
        {
          "kind": "calls",
          "target": "readFileSync"
        },
        {
          "kind": "calls",
          "target": "mkdtempSync"
        },
        {
          "kind": "calls",
          "target": "tmpdir"
        },
        {
          "kind": "calls",
          "target": "mkdirSync"
        },
        {
          "kind": "calls",
          "target": "copyFileSync"
        },
        {
          "kind": "calls",
          "target": "body"
        },
        {
          "kind": "calls",
          "target": "rmSync"
        },
        {
          "kind": "calls",
          "target": "writeFileSync"
        },
        {
          "kind": "calls",
          "target": "withFreshHello"
        },
        {
          "kind": "calls",
          "target": "async"
        },
        {
          "kind": "calls",
          "target": "rewriteHead"
        },
        {
          "kind": "calls",
          "target": "r1"
        },
        {
          "kind": "calls",
          "target": "r2"
        }
      ],
      "tags": [],
      "applyId": null
    }
  ]
};

// === HEAD ===
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HELLO_SRC = join(HERE, 'examples/hello.fn.yume.js');
const RUNTIME_SRC = join(HERE, 'runtimes/ver001.handle.yume.js');
const HELLO = readFileSync(HELLO_SRC, 'utf8');

async function withFreshHello(body) {
  const dir = mkdtempSync(join(tmpdir(), 'yume-spec-'));
  mkdirSync(join(dir, 'runtimes'), { recursive: true });
  copyFileSync(RUNTIME_SRC, join(dir, 'runtimes', 'ver001.handle.yume.js'));
  const file = join(dir, 'hello.fn.yume.js');
  copyFileSync(HELLO_SRC, file);
  try { return await body(file, dir); }
  finally { rmSync(dir, { recursive: true, force: true }); }
}

function rewriteHead(file, newHeadBody) {
  const src = readFileSync(file, 'utf8');
  const next = src.replace(
    /\/\/ === HEAD ===[\s\S]*?\/\/ === \/HEAD ===/,
    '// === HEAD ===\n' + newHeadBody + '\n// === /HEAD ==='
  );
  writeFileSync(file, next);
}

// One case = one verifiable claim about a runtime function.
// run(rt) returns truthy on pass, falsy on fail, or throws.
// Phase 1 ad-hoc; schema may change as the strategy hardens.
export const cases = [
  // ====================================================================
  // PURE FUNCTIONS
  // ====================================================================

  // ---- parseBlock ----------------------------------------------------
  { tag: 'parseBlock/hello/id',
    fn: 'parseBlock',
    run: (rt) => rt.parseBlock(HELLO).block.id === 'hello' },
  { tag: 'parseBlock/hello/type-fn',
    fn: 'parseBlock',
    run: (rt) => rt.parseBlock(HELLO).block.type === 'fn' },
  { tag: 'parseBlock/hello/single-version',
    fn: 'parseBlock',
    run: (rt) => rt.parseBlock(HELLO).block.versions.length === 1 },
  { tag: 'parseBlock/hello/head-contains-fn',
    fn: 'parseBlock',
    run: (rt) => rt.parseBlock(HELLO).head.includes('export function hello') },
  { tag: 'parseBlock/hello/boot-contains-cli',
    fn: 'parseBlock',
    run: (rt) => rt.parseBlock(HELLO).boot.includes('rt.cli') },
  { tag: 'parseBlock/missing-block-throws',
    fn: 'parseBlock',
    run: (rt) => { try { rt.parseBlock('// nothing here'); return false; } catch { return true; } } },
  { tag: 'parseBlock/missing-format-marker-throws',
    fn: 'parseBlock',
    run: (rt) => { try { rt.parseBlock('export const __block = {};'); return false; } catch { return true; } } },

  // ---- hashContent ---------------------------------------------------
  { tag: 'hashContent/64-hex-chars',
    fn: 'hashContent',
    run: (rt) => /^[0-9a-f]{64}$/.test(rt.hashContent('x', null, 0)) },
  { tag: 'hashContent/deterministic',
    fn: 'hashContent',
    run: (rt) => rt.hashContent('x', null, 0) === rt.hashContent('x', null, 0) },
  { tag: 'hashContent/changes-with-content',
    fn: 'hashContent',
    run: (rt) => rt.hashContent('x', null, 0) !== rt.hashContent('y', null, 0) },
  { tag: 'hashContent/changes-with-prevHash',
    fn: 'hashContent',
    run: (rt) => rt.hashContent('x', null, 0) !== rt.hashContent('x', 'a'.repeat(64), 0) },
  { tag: 'hashContent/changes-with-ts',
    fn: 'hashContent',
    run: (rt) => rt.hashContent('x', null, 0) !== rt.hashContent('x', null, 1) },
  { tag: 'hashContent/empty-content-still-hex',
    fn: 'hashContent',
    run: (rt) => /^[0-9a-f]{64}$/.test(rt.hashContent('', null, 0)) },

  // ---- extractRefsAndTags -------------------------------------------
  { tag: 'extractRefsAndTags/empty/no-refs',
    fn: 'extractRefsAndTags',
    run: (rt) => rt.extractRefsAndTags('const x = 1;').refs.length === 0 },
  { tag: 'extractRefsAndTags/empty/no-tags',
    fn: 'extractRefsAndTags',
    run: (rt) => rt.extractRefsAndTags('const x = 1;').tags.length === 0 },
  { tag: 'extractRefsAndTags/import-path',
    fn: 'extractRefsAndTags',
    run: (rt) => rt.extractRefsAndTags("import x from './y.js';").refs.some(r => r.target === './y.js') },
  { tag: 'extractRefsAndTags/dynamic-import',
    fn: 'extractRefsAndTags',
    run: (rt) => rt.extractRefsAndTags("const m = await import('./y.js');").refs.some(r => r.target === './y.js') },
  { tag: 'extractRefsAndTags/at-ref-comment',
    fn: 'extractRefsAndTags',
    run: (rt) => rt.extractRefsAndTags('// @ref: foo').refs.some(r => r.target === 'foo') },
  { tag: 'extractRefsAndTags/at-tags-comment',
    fn: 'extractRefsAndTags',
    run: (rt) => {
      const t = rt.extractRefsAndTags('// @tags: alpha beta').tags;
      return t.includes('alpha') && t.includes('beta');
    } },
  { tag: 'extractRefsAndTags/import-in-string-not-extracted',
    fn: 'extractRefsAndTags',
    run: (rt) => rt.extractRefsAndTags("const s = 'import x from \"./y.js\"';").refs.length === 0 },
  { tag: 'extractRefsAndTags/import-in-comment-not-extracted',
    fn: 'extractRefsAndTags',
    run: (rt) => rt.extractRefsAndTags("// import x from './y.js';").refs.length === 0 },

  // ---- validateBlock -------------------------------------------------
  { tag: 'validateBlock/hello-ok',
    fn: 'validateBlock',
    run: (rt) => rt.validateBlock(rt.parseBlock(HELLO).block).ok === true },
  { tag: 'validateBlock/missing-id-fails',
    fn: 'validateBlock',
    run: (rt) => {
      const b = rt.parseBlock(HELLO).block;
      delete b.id;
      return rt.validateBlock(b).ok === false;
    } },
  { tag: 'validateBlock/empty-versions-fails',
    fn: 'validateBlock',
    run: (rt) => {
      const b = rt.parseBlock(HELLO).block;
      b.versions = [];
      const r = rt.validateBlock(b);
      return r.ok === false && r.errors.some(e => e.includes('at least one'));
    } },
  { tag: 'validateBlock/broken-hash-chain-fails',
    fn: 'validateBlock',
    run: (rt) => {
      const b = rt.parseBlock(HELLO).block;
      b.versions[0].hash = 'f'.repeat(64);
      return rt.validateBlock(b).ok === false;
    } },
  { tag: 'validateBlock/null-fails-cleanly',
    fn: 'validateBlock',
    run: (rt) => {
      try { return rt.validateBlock(null).ok === false; } catch { return true; }
    } },

  // ---- assertValidBlock ---------------------------------------------
  { tag: 'assertValidBlock/returns-block-on-valid',
    fn: 'assertValidBlock',
    run: (rt) => {
      const b = rt.parseBlock(HELLO).block;
      return rt.assertValidBlock(b) === b;
    } },
  { tag: 'assertValidBlock/throws-on-invalid',
    fn: 'assertValidBlock',
    run: (rt) => {
      const b = rt.parseBlock(HELLO).block;
      b.versions = [];
      try { rt.assertValidBlock(b); return false; } catch { return true; }
    } },

  // ---- serializeBlock (round-trip) ----------------------------------
  { tag: 'serializeBlock/round-trip-id-preserved',
    fn: 'serializeBlock',
    run: (rt) => {
      const p = rt.parseBlock(HELLO);
      const out = rt.serializeBlock({ block: p.block, head: p.head, boot: p.boot });
      return rt.parseBlock(out).block.id === 'hello';
    } },
  { tag: 'serializeBlock/round-trip-version-count-preserved',
    fn: 'serializeBlock',
    run: (rt) => {
      const p = rt.parseBlock(HELLO);
      const out = rt.serializeBlock({ block: p.block, head: p.head, boot: p.boot });
      return rt.parseBlock(out).block.versions.length === p.block.versions.length;
    } },
  { tag: 'serializeBlock/round-trip-head-byte-equal',
    fn: 'serializeBlock',
    run: (rt) => {
      const p = rt.parseBlock(HELLO);
      const out = rt.serializeBlock({ block: p.block, head: p.head, boot: p.boot });
      return rt.parseBlock(out).head === p.head;
    } },
  { tag: 'serializeBlock/round-trip-boot-byte-equal',
    fn: 'serializeBlock',
    run: (rt) => {
      const p = rt.parseBlock(HELLO);
      const out = rt.serializeBlock({ block: p.block, head: p.head, boot: p.boot });
      return rt.parseBlock(out).boot === p.boot;
    } },
  { tag: 'serializeBlock/round-trip-validates',
    fn: 'serializeBlock',
    run: (rt) => {
      const p = rt.parseBlock(HELLO);
      const out = rt.serializeBlock({ block: p.block, head: p.head, boot: p.boot });
      return rt.validateBlock(rt.parseBlock(out).block).ok === true;
    } },
  { tag: 'serializeBlock/idempotent',
    fn: 'serializeBlock',
    run: (rt) => {
      const p = rt.parseBlock(HELLO);
      const a = rt.serializeBlock({ block: p.block, head: p.head, boot: p.boot });
      const b = rt.serializeBlock(rt.parseBlock(a));
      return a === b;
    } },

  // ====================================================================
  // I/O FUNCTIONS (each runs in an isolated tmpdir sandbox)
  // ====================================================================

  // ---- commitManual --------------------------------------------------
  { tag: 'commitManual/clean-no-changes',
    fn: 'commitManual',
    run: (rt) => withFreshHello(async (f) => {
      const r = await rt.commitManual(f);
      return r.committed === false;
    }) },
  { tag: 'commitManual/dirty-extends-versions',
    fn: 'commitManual',
    run: (rt) => withFreshHello(async (f) => {
      rewriteHead(f, 'export function hello(){return "hi";}');
      const r = await rt.commitManual(f);
      const after = rt.parseBlock(readFileSync(f, 'utf8')).block;
      return r.committed === true && after.versions.length === 2;
    }) },
  { tag: 'commitManual/dirty-keeps-validity',
    fn: 'commitManual',
    run: (rt) => withFreshHello(async (f) => {
      rewriteHead(f, 'export function hello(){return "x";}');
      await rt.commitManual(f);
      return rt.validateBlock(rt.parseBlock(readFileSync(f, 'utf8')).block).ok === true;
    }) },
  { tag: 'commitManual/prevHash-chains',
    fn: 'commitManual',
    run: (rt) => withFreshHello(async (f) => {
      rewriteHead(f, 'export function hello(){return "x";}');
      await rt.commitManual(f);
      const vs = rt.parseBlock(readFileSync(f, 'utf8')).block.versions;
      return vs[1].prevHash === vs[0].hash;
    }) },
  { tag: 'commitManual/applyId-preserved',
    fn: 'commitManual',
    run: (rt) => withFreshHello(async (f) => {
      rewriteHead(f, 'export function hello(){return "x";}');
      const r = await rt.commitManual(f, { applyId: 'apply-test-001' });
      const v = rt.parseBlock(readFileSync(f, 'utf8')).block.versions[1];
      return v.applyId === 'apply-test-001' && r.applyId === 'apply-test-001';
    }) },
  { tag: 'commitManual/note-attached-via-applyId',
    fn: 'commitManual',
    run: (rt) => withFreshHello(async (f) => {
      rewriteHead(f, 'export function hello(){return "x";}');
      const r = await rt.commitManual(f, { note: { author: 'spec', text: 'why' } });
      const block = rt.parseBlock(readFileSync(f, 'utf8')).block;
      const key = 'apply:' + r.applyId;
      return Array.isArray(block.notes?.[key]) && block.notes[key].some(n => n.text === 'why');
    }) },
  { tag: 'commitManual/note-auto-creates-applyId',
    fn: 'commitManual',
    run: (rt) => withFreshHello(async (f) => {
      rewriteHead(f, 'export function hello(){return "x";}');
      const r = await rt.commitManual(f, { note: { author: 'spec', text: 'auto' } });
      return typeof r.applyId === 'string' && r.applyId.length > 0;
    }) },
  { tag: 'commitManual/extracts-refs-from-head',
    fn: 'commitManual',
    run: (rt) => withFreshHello(async (f) => {
      rewriteHead(f, "import x from './other.js';");
      await rt.commitManual(f);
      const v = rt.parseBlock(readFileSync(f, 'utf8')).block.versions[1];
      return v.refs.some(r => r.target === './other.js');
    }) },
  { tag: 'commitManual/extracts-tags-from-head',
    fn: 'commitManual',
    run: (rt) => withFreshHello(async (f) => {
      rewriteHead(f, '// @tags: alpha beta');
      await rt.commitManual(f);
      const v = rt.parseBlock(readFileSync(f, 'utf8')).block.versions[1];
      return v.tags.includes('alpha') && v.tags.includes('beta');
    }) },

  // ---- show / history / diff ----------------------------------------
  { tag: 'show/head-returns-latest',
    fn: 'show',
    run: (rt) => withFreshHello(async (f) => {
      const v = await rt.show(f, 'head');
      return /^[0-9a-f]{64}$/.test(v.hash);
    }) },
  { tag: 'show/index-0-returns-first',
    fn: 'show',
    run: (rt) => withFreshHello(async (f) => {
      const v = await rt.show(f, 0);
      return v.content.includes('hello, ');
    }) },
  { tag: 'history/length-matches-versions',
    fn: 'history',
    run: (rt) => withFreshHello(async (f) => {
      const h = await rt.history(f);
      return h.length === 1;
    }) },
  { tag: 'history/length-after-commit-extends',
    fn: 'history',
    run: (rt) => withFreshHello(async (f) => {
      rewriteHead(f, 'export function hello(){return "x";}');
      await rt.commitManual(f);
      const h = await rt.history(f);
      return h.length === 2;
    }) },
  { tag: 'diff/v0-vs-v1-shows-changes',
    fn: 'diff',
    run: (rt) => withFreshHello(async (f) => {
      rewriteHead(f, 'export function hello(){return "x";}');
      await rt.commitManual(f);
      const d = await rt.diff(f, 0, -1);
      return d.length > 0 && d.includes('"x"');
    }) },

  // ---- rollback ------------------------------------------------------
  { tag: 'rollback/appends-not-truncates',
    fn: 'rollback',
    run: (rt) => withFreshHello(async (f) => {
      rewriteHead(f, 'export function hello(){return "edit";}');
      await rt.commitManual(f);
      await rt.rollback(f, 0);
      const v = rt.parseBlock(readFileSync(f, 'utf8')).block.versions;
      return v.length === 3;
    }) },
  { tag: 'rollback/restores-content',
    fn: 'rollback',
    run: (rt) => withFreshHello(async (f) => {
      rewriteHead(f, 'export function hello(){return "edit";}');
      await rt.commitManual(f);
      await rt.rollback(f, 0);
      return readFileSync(f, 'utf8').includes('hello, ');
    }) },
  { tag: 'rollback/dirty-refuses',
    fn: 'rollback',
    run: (rt) => withFreshHello(async (f) => {
      rewriteHead(f, 'export function hello(){return "dirty";}');
      try { await rt.rollback(f, 0); return false; } catch { return true; }
    }) },

  // ---- heavy / heavyApply -------------------------------------------
  { tag: 'heavy/contains-head',
    fn: 'heavy',
    run: (rt) => withFreshHello(async (f) => {
      const v = await rt.heavy([f], 'hello', 1);
      return v.includes('export function hello');
    }) },
  { tag: 'heavyApply/no-changes-noop',
    fn: 'heavyApply',
    run: (rt) => withFreshHello(async (f) => {
      const view = await rt.heavy([f], 'hello', 1);
      const r = await rt.heavyApply([f], 'hello', view, 1);
      return r.updated.length === 0;
    }) },
  { tag: 'heavyApply/with-changes-updates',
    fn: 'heavyApply',
    run: (rt) => withFreshHello(async (f) => {
      const view = await rt.heavy([f], 'hello', 1);
      const edited = view.replace('hello, ', 'hi, ');
      const r = await rt.heavyApply([f], 'hello', edited, 1);
      return r.updated.length === 1;
    }) },
  { tag: 'heavyApply/with-changes-shared-applyId',
    fn: 'heavyApply',
    run: (rt) => withFreshHello(async (f) => {
      const view = await rt.heavy([f], 'hello', 1);
      const edited = view.replace('hello, ', 'hi, ');
      const r = await rt.heavyApply([f], 'hello', edited, 1);
      return typeof r.applyId === 'string' && r.applyId.length > 0;
    }) },

  // ---- refsCheck ----------------------------------------------------
  { tag: 'refsCheck/clean-ok',
    fn: 'refsCheck',
    run: (rt) => withFreshHello(async (f) => {
      const r = await rt.refsCheck([f]);
      return r.ok === true && r.errors.length === 0;
    }) },
  { tag: 'refsCheck/dangling-path-errors',
    fn: 'refsCheck',
    run: (rt) => withFreshHello(async (f) => {
      rewriteHead(f, "import x from './does-not-exist.js';");
      await rt.commitManual(f);
      const r = await rt.refsCheck([f]);
      return r.ok === false && r.errors.length > 0;
    }) },
  { tag: 'refsCheck/duplicate-block-id-errors',
    fn: 'refsCheck',
    run: (rt) => withFreshHello(async (f, dir) => {
      const f2 = join(dir, 'dupe.fn.yume.js');
      copyFileSync(f, f2);
      const r = await rt.refsCheck([f, f2]);
      return r.ok === false && r.errors.some(e => e.type === 'duplicate-block-id');
    }) },
  { tag: 'refsCheck/isolated-info',
    fn: 'refsCheck',
    run: (rt) => withFreshHello(async (f) => {
      const r = await rt.refsCheck([f]);
      return r.info.some(i => i.type === 'isolated-file');
    }) },

  // ---- impact -------------------------------------------------------
  { tag: 'impact/no-incoming-empty',
    fn: 'impact',
    run: (rt) => withFreshHello(async (f) => {
      const r = await rt.impact([f], 'hello', 1);
      return Array.isArray(r) && r.length === 0;
    }) },

  // ---- notes / search ----------------------------------------------
  { tag: 'noteAdd/persists-via-noteList',
    fn: 'noteAdd',
    run: (rt) => withFreshHello(async (f) => {
      await rt.noteAdd(f, 'head', { author: 'spec', text: 'because' });
      const notes = await rt.noteList(f);
      return notes.some(n => n.text === 'because');
    }) },
  { tag: 'noteEdit/replaces-text',
    fn: 'noteEdit',
    run: (rt) => withFreshHello(async (f) => {
      const r = await rt.noteAdd(f, 'head', { author: 'spec', text: 'old' });
      await rt.noteEdit(f, 'head', r.noteId, { text: 'new' });
      const notes = await rt.noteList(f);
      return notes.some(n => n.id === r.noteId && n.text === 'new');
    }) },
  { tag: 'noteRm/removes',
    fn: 'noteRm',
    run: (rt) => withFreshHello(async (f) => {
      const r = await rt.noteAdd(f, 'head', { author: 'spec', text: 'gone' });
      await rt.noteRm(f, 'head', r.noteId);
      const notes = await rt.noteList(f);
      return notes.every(n => n.id !== r.noteId);
    }) },
  { tag: 'notesSearch/finds-text',
    fn: 'notesSearch',
    run: (rt) => withFreshHello(async (f, dir) => {
      await rt.noteAdd(f, 'head', { author: 'spec', text: 'findable-needle' });
      const found = await rt.notesSearch(dir, 'findable-needle');
      return found.length === 1 && found[0].text.includes('findable-needle');
    }) },

  // ---- refs / tags (file API) --------------------------------------
  { tag: 'refs/empty-on-fresh-hello',
    fn: 'refs',
    run: (rt) => withFreshHello(async (f) => {
      const r = await rt.refs(f);
      return r.length === 0;
    }) },
  { tag: 'refs/from-latest-version',
    fn: 'refs',
    run: (rt) => withFreshHello(async (f) => {
      rewriteHead(f, "import x from './y.js';");
      await rt.commitManual(f);
      const r = await rt.refs(f);
      return r.some(x => x.target === './y.js');
    }) },
  { tag: 'tags/empty-on-fresh-hello',
    fn: 'tags',
    run: (rt) => withFreshHello(async (f) => {
      const t = await rt.tags(f);
      return t.length === 0;
    }) },
  { tag: 'tags/from-latest-version',
    fn: 'tags',
    run: (rt) => withFreshHello(async (f) => {
      rewriteHead(f, '// @tags: alpha beta');
      await rt.commitManual(f);
      const t = await rt.tags(f);
      return t.includes('alpha') && t.includes('beta');
    }) },

  // ---- apply* (group API) ------------------------------------------
  { tag: 'applyList/no-apply-empty',
    fn: 'applyList',
    run: (rt) => withFreshHello(async (f) => {
      const groups = await rt.applyList(f);
      return groups.length === 0;
    }) },
  { tag: 'applyList/single-apply-found',
    fn: 'applyList',
    run: (rt) => withFreshHello(async (f) => {
      rewriteHead(f, 'export function hello(){return "x";}');
      await rt.commitManual(f, { applyId: 'apply-test' });
      const groups = await rt.applyList(f);
      return groups.length === 1 && groups[0].applyId === 'apply-test';
    }) },
  { tag: 'applyShow/returns-versions-for-applyId',
    fn: 'applyShow',
    run: (rt) => withFreshHello(async (f) => {
      rewriteHead(f, 'export function hello(){return "x";}');
      await rt.commitManual(f, { applyId: 'a1' });
      const group = await rt.applyShow(f, 'a1');
      return group.versions.length === 1 && group.applyId === 'a1';
    }) },
  { tag: 'applyShow/missing-throws',
    fn: 'applyShow',
    run: (rt) => withFreshHello(async (f) => {
      try { await rt.applyShow(f, 'no-such'); return false; } catch { return true; }
    }) },
  { tag: 'applyIndex/folder-scan-finds-apply',
    fn: 'applyIndex',
    run: (rt) => withFreshHello(async (f, dir) => {
      rewriteHead(f, 'export function hello(){return "x";}');
      await rt.commitManual(f, { applyId: 'apply-folder' });
      const groups = await rt.applyIndex(dir);
      return groups.some(g => g.applyId === 'apply-folder');
    }) },
  { tag: 'applySearch/finds-by-id',
    fn: 'applySearch',
    run: (rt) => withFreshHello(async (f, dir) => {
      rewriteHead(f, 'export function hello(){return "x";}');
      await rt.commitManual(f, { applyId: 'apply-search' });
      const group = await rt.applySearch(dir, 'apply-search');
      return group.applyId === 'apply-search' && group.fileCount >= 1;
    }) },

  // ---- atomicWrite -------------------------------------------------
  { tag: 'atomicWrite/creates-file',
    fn: 'atomicWrite',
    run: (rt) => withFreshHello(async (_f, dir) => {
      const target = join(dir, 'new.txt');
      await rt.atomicWrite(target, 'hello');
      return readFileSync(target, 'utf8') === 'hello';
    }) },
  { tag: 'atomicWrite/overwrites',
    fn: 'atomicWrite',
    run: (rt) => withFreshHello(async (_f, dir) => {
      const target = join(dir, 'new.txt');
      writeFileSync(target, 'old');
      await rt.atomicWrite(target, 'new');
      return readFileSync(target, 'utf8') === 'new';
    }) },

  // ---- acquireLock -------------------------------------------------
  { tag: 'acquireLock/release-allows-second-acquire',
    fn: 'acquireLock',
    run: (rt) => withFreshHello(async (f) => {
      const r1 = await rt.acquireLock(f);
      await r1();
      const r2 = await rt.acquireLock(f);
      await r2();
      return true;
    }) },
  { tag: 'acquireLock/double-acquire-throws',
    fn: 'acquireLock',
    run: (rt) => withFreshHello(async (f) => {
      const r1 = await rt.acquireLock(f);
      try {
        await rt.acquireLock(f);
        await r1();
        return false;
      } catch {
        await r1();
        return true;
      }
    }) },
  { tag: 'acquireLock/different-files-independent',
    fn: 'acquireLock',
    run: (rt) => withFreshHello(async (f, dir) => {
      const f2 = join(dir, 'b.fn.yume.js');
      copyFileSync(f, f2);
      const r1 = await rt.acquireLock(f);
      const r2 = await rt.acquireLock(f2);
      await r1(); await r2();
      return true;
    }) },
];

// === /HEAD ===

// === BOOT ===
if (import.meta.url === `file://${process.argv[1]}`) {
  const rtPath = __block.runtime.path ?? `./runtimes/ver${__block.runtime.version}.handle.yume.js`;
  const rt = await import(rtPath);
  if (process.argv[2]) {
    await rt.cli(import.meta.url, __block, process.argv);
  } else {
    let pass = 0, fail = 0;
    for (const c of cases) {
      try {
        const ok = await c.run(rt);
        if (ok) pass++;
        else { fail++; console.log('FAIL ' + c.tag); }
      } catch (e) {
        fail++;
        console.log('ERROR ' + c.tag + ': ' + e.message);
      }
    }
    console.log('spec: ' + pass + ' passed, ' + fail + ' failed (' + cases.length + ' total)');
    if (fail) process.exit(1);
  }
}

// === /BOOT ===
