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
      "hash": "28f462da8b108d69a571d9b2cd1320022d8937280a50344708d42ce7fc641050",
      "prevHash": null,
      "content": "import { readFileSync } from 'node:fs';\n\nconst HELLO_URL = new URL('./examples/hello.fn.yume.js', import.meta.url);\nconst HELLO = readFileSync(HELLO_URL, 'utf8');\n\n// One case = one verifiable claim about a pure runtime function.\n// run(rt) returns truthy on pass, falsy on fail, or throws.\n// Phase 1 ad-hoc; schema may change as the strategy hardens.\nexport const cases = [\n  // ---- parseBlock --------------------------------------------------------\n  { tag: 'parseBlock/hello/id',\n    fn: 'parseBlock',\n    run: (rt) => rt.parseBlock(HELLO).block.id === 'hello' },\n  { tag: 'parseBlock/hello/type-fn',\n    fn: 'parseBlock',\n    run: (rt) => rt.parseBlock(HELLO).block.type === 'fn' },\n  { tag: 'parseBlock/hello/single-version',\n    fn: 'parseBlock',\n    run: (rt) => rt.parseBlock(HELLO).block.versions.length === 1 },\n  { tag: 'parseBlock/hello/head-contains-fn',\n    fn: 'parseBlock',\n    run: (rt) => rt.parseBlock(HELLO).head.includes('export function hello') },\n  { tag: 'parseBlock/hello/boot-contains-cli',\n    fn: 'parseBlock',\n    run: (rt) => rt.parseBlock(HELLO).boot.includes('rt.cli') },\n  { tag: 'parseBlock/missing-block-throws',\n    fn: 'parseBlock',\n    run: (rt) => { try { rt.parseBlock('// nothing here'); return false; } catch { return true; } } },\n  { tag: 'parseBlock/missing-format-marker-throws',\n    fn: 'parseBlock',\n    run: (rt) => { try { rt.parseBlock('export const __block = {};'); return false; } catch { return true; } } },\n\n  // ---- hashContent -------------------------------------------------------\n  { tag: 'hashContent/64-hex-chars',\n    fn: 'hashContent',\n    run: (rt) => /^[0-9a-f]{64}$/.test(rt.hashContent('x', null, 0)) },\n  { tag: 'hashContent/deterministic',\n    fn: 'hashContent',\n    run: (rt) => rt.hashContent('x', null, 0) === rt.hashContent('x', null, 0) },\n  { tag: 'hashContent/changes-with-content',\n    fn: 'hashContent',\n    run: (rt) => rt.hashContent('x', null, 0) !== rt.hashContent('y', null, 0) },\n  { tag: 'hashContent/changes-with-prevHash',\n    fn: 'hashContent',\n    run: (rt) => rt.hashContent('x', null, 0) !== rt.hashContent('x', 'a'.repeat(64), 0) },\n  { tag: 'hashContent/changes-with-ts',\n    fn: 'hashContent',\n    run: (rt) => rt.hashContent('x', null, 0) !== rt.hashContent('x', null, 1) },\n\n  // ---- extractRefsAndTags -----------------------------------------------\n  { tag: 'extractRefsAndTags/empty/no-refs',\n    fn: 'extractRefsAndTags',\n    run: (rt) => rt.extractRefsAndTags('const x = 1;').refs.length === 0 },\n  { tag: 'extractRefsAndTags/empty/no-tags',\n    fn: 'extractRefsAndTags',\n    run: (rt) => rt.extractRefsAndTags('const x = 1;').tags.length === 0 },\n  { tag: 'extractRefsAndTags/import-path',\n    fn: 'extractRefsAndTags',\n    run: (rt) => rt.extractRefsAndTags(\"import x from './y.js';\").refs.some(r => r.target === './y.js') },\n  { tag: 'extractRefsAndTags/dynamic-import',\n    fn: 'extractRefsAndTags',\n    run: (rt) => rt.extractRefsAndTags(\"const m = await import('./y.js');\").refs.some(r => r.target === './y.js') },\n  { tag: 'extractRefsAndTags/at-ref-comment',\n    fn: 'extractRefsAndTags',\n    run: (rt) => rt.extractRefsAndTags('// @ref: foo').refs.some(r => r.target === 'foo') },\n  { tag: 'extractRefsAndTags/at-tags-comment',\n    fn: 'extractRefsAndTags',\n    run: (rt) => {\n      const t = rt.extractRefsAndTags('// @tags: alpha beta').tags;\n      return t.includes('alpha') && t.includes('beta');\n    } },\n  { tag: 'extractRefsAndTags/import-in-string-not-extracted',\n    fn: 'extractRefsAndTags',\n    run: (rt) => rt.extractRefsAndTags(\"const s = 'import x from \\\"./y.js\\\"';\").refs.length === 0 },\n  { tag: 'extractRefsAndTags/import-in-comment-not-extracted',\n    fn: 'extractRefsAndTags',\n    run: (rt) => rt.extractRefsAndTags(\"// import x from './y.js';\").refs.length === 0 },\n\n  // ---- validateBlock ----------------------------------------------------\n  { tag: 'validateBlock/hello-ok',\n    fn: 'validateBlock',\n    run: (rt) => rt.validateBlock(rt.parseBlock(HELLO).block).ok === true },\n  { tag: 'validateBlock/missing-id-fails',\n    fn: 'validateBlock',\n    run: (rt) => {\n      const b = rt.parseBlock(HELLO).block;\n      delete b.id;\n      return rt.validateBlock(b).ok === false;\n    } },\n  { tag: 'validateBlock/empty-versions-fails',\n    fn: 'validateBlock',\n    run: (rt) => {\n      const b = rt.parseBlock(HELLO).block;\n      b.versions = [];\n      const r = rt.validateBlock(b);\n      return r.ok === false && r.errors.some(e => e.includes('at least one'));\n    } },\n  { tag: 'validateBlock/broken-hash-chain-fails',\n    fn: 'validateBlock',\n    run: (rt) => {\n      const b = rt.parseBlock(HELLO).block;\n      b.versions[0].hash = 'f'.repeat(64);\n      return rt.validateBlock(b).ok === false;\n    } },\n  { tag: 'validateBlock/null-fails-cleanly',\n    fn: 'validateBlock',\n    run: (rt) => {\n      try { return rt.validateBlock(null).ok === false; } catch { return true; }\n    } },\n\n  // ---- serializeBlock (round-trip) --------------------------------------\n  { tag: 'serializeBlock/round-trip-id-preserved',\n    fn: 'serializeBlock',\n    run: (rt) => {\n      const p = rt.parseBlock(HELLO);\n      const out = rt.serializeBlock({ block: p.block, head: p.head, boot: p.boot });\n      return rt.parseBlock(out).block.id === 'hello';\n    } },\n  { tag: 'serializeBlock/round-trip-version-count-preserved',\n    fn: 'serializeBlock',\n    run: (rt) => {\n      const p = rt.parseBlock(HELLO);\n      const out = rt.serializeBlock({ block: p.block, head: p.head, boot: p.boot });\n      return rt.parseBlock(out).block.versions.length === p.block.versions.length;\n    } },\n  { tag: 'serializeBlock/round-trip-head-byte-equal',\n    fn: 'serializeBlock',\n    run: (rt) => {\n      const p = rt.parseBlock(HELLO);\n      const out = rt.serializeBlock({ block: p.block, head: p.head, boot: p.boot });\n      return rt.parseBlock(out).head === p.head;\n    } },\n  { tag: 'serializeBlock/round-trip-boot-byte-equal',\n    fn: 'serializeBlock',\n    run: (rt) => {\n      const p = rt.parseBlock(HELLO);\n      const out = rt.serializeBlock({ block: p.block, head: p.head, boot: p.boot });\n      return rt.parseBlock(out).boot === p.boot;\n    } },\n  { tag: 'serializeBlock/round-trip-validates',\n    fn: 'serializeBlock',\n    run: (rt) => {\n      const p = rt.parseBlock(HELLO);\n      const out = rt.serializeBlock({ block: p.block, head: p.head, boot: p.boot });\n      return rt.validateBlock(rt.parseBlock(out).block).ok === true;\n    } },\n  { tag: 'serializeBlock/idempotent',\n    fn: 'serializeBlock',\n    run: (rt) => {\n      const p = rt.parseBlock(HELLO);\n      const a = rt.serializeBlock({ block: p.block, head: p.head, boot: p.boot });\n      const b = rt.serializeBlock(rt.parseBlock(a));\n      return a === b;\n    } },\n];\n",
      "ts": 1778400612805,
      "refs": [
        {
          "kind": "import",
          "target": "node:fs"
        },
        {
          "kind": "calls",
          "target": "URL"
        },
        {
          "kind": "calls",
          "target": "readFileSync"
        }
      ],
      "tags": [],
      "applyId": null
    }
  ]
};

// === HEAD ===
import { readFileSync } from 'node:fs';

const HELLO_URL = new URL('./examples/hello.fn.yume.js', import.meta.url);
const HELLO = readFileSync(HELLO_URL, 'utf8');

// One case = one verifiable claim about a pure runtime function.
// run(rt) returns truthy on pass, falsy on fail, or throws.
// Phase 1 ad-hoc; schema may change as the strategy hardens.
export const cases = [
  // ---- parseBlock --------------------------------------------------------
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

  // ---- hashContent -------------------------------------------------------
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

  // ---- extractRefsAndTags -----------------------------------------------
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

  // ---- validateBlock ----------------------------------------------------
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

  // ---- serializeBlock (round-trip) --------------------------------------
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
