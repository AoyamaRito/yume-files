// @yume-format: 1
// hello.fn.yume.js — minimal valid yume file(role=fn)

export const __block = {
  "id": "hello",
  "type": "fn",
  "schemaVersion": 1,
  "runtime": {
    "name": "yume",
    "version": "001"
  },
  "api": ["commit", "history", "show", "diff", "rollback", "validate", "refs", "tags", "noteAdd", "noteEdit", "noteRm", "noteList", "applyList", "applyShow", "applyIndex", "applySearch"],
  "versions": [
    {
      "hash": "4b6f0d194c32fd00abec668b757f95008eccdb64dddb40c4d82af5261a9f9b21",
      "prevHash": null,
      "content": "export function hello(name) {\n  return `hello, ${name}!`;\n}\n",
      "ts": 1714000000000,
      "refs": [],
      "tags": [],
      "applyId": null
    }
  ]
};

// === HEAD ===
export function hello(name) {
  return `hello, ${name}!`;
}

// === /HEAD ===

// === BOOT ===
if (import.meta.url === `file://${process.argv[1]}`) {
  const path = __block.runtime.path ?? `../runtimes/ver${__block.runtime.version}.handle.yume.js`;
  const rt = await import(path);
  await rt.cli(import.meta.url, __block, process.argv);
}
// === /BOOT ===
