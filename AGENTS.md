# AI Agent Instructions for yume-files

This repository defines the portable `.yume.js` file format and its zero-dependency v001 runtime.

## Start Here

1. Read `runAndReadMe.aiDoc.yume.js` first. It is the operational runbook for AI agents.
2. Use `README.md` for the human-facing overview and examples.
3. Use `BLOCKFILE.aiDoc.yume.js` only when exact format or runtime semantics are needed.
4. Use `examples/hello.fn.yume.js` as the smallest valid `.yume.js` sample.
5. Use `novelSourceIngest.workflow.yume.js` before ingesting long novel txt sources.

## Project Rules

- Keep the runtime dependency-free. Do not add AST parser packages or other npm dependencies unless the project deliberately changes that constraint.
- Treat `filename.domain.yume.js` as meaningful. The `domain` segment tells an AI whether the file is code, spec, workflow, template, world, style, character data, or another knowledge unit.
- For normal `.yume.js` edits, edit only the `HEAD` region, then run `node <file>.yume.js commit --note "why this change exists"`.
- Do not hand-edit `__block.versions[]` unless deliberately repairing a broken file.
- Do not introduce compression of `__block.versions[]` (e.g. zlib/base64 squash). The substrate value of `.yume.js` is that all history stays plaintext and AI/grep readable. This was tried on branch `feat/zlib-self-compression` and rejected: the added bug surface (decompression side-effects in `validateBlock`, GC of orphaned compressed payloads, rollback integrity, parse cost) outweighed the size savings, which are bounded in practice. If history bloat ever becomes a real problem, prefer moving old versions to a sibling `*.archive.yume.js` file in plaintext rather than compressing in place.
- Use `notes` for mutable intent and commentary. Use `applyId` when one AI operation spans multiple files.
- Use `heavy` for related context, `impact` for reverse-reference blast radius, and `refs-check` for graph health.
- For long novel txt ingest, do not convert the whole source directly into a polished world file. Follow `novelSourceIngest.workflow.yume.js`: create source index, term index, an empty relation index, and redundant fact staging first; normalize only focused views later.
- Treat `.yume-work/` as generated intermediate/cache output. Keep it for debugging or resume, and ignore it in Git unless a fixture is intentionally added.
- Treat `*.spec.yume.js` as a planned domain for unit case tables. Strategy: do not block on unit tests during coding; verify at e2e time that every spec case is covered by an actual e2e path. Schema is ad-hoc in Phase 1 (`runtime.spec.yume.js`); will harden once real usage proves the shape.
- `cover.js` runs the spec table and reports declared-fn drift + runtime-export coverage. With `--e2e` (Phase 2.1) it spawns `e2e.js` with `YUME_COVER=1`, collects every runtime fn called during the e2e run via a one-line `globalThis.__yumeCoverHook?.()` at each export entry, and reports which spec cases are not reached by any e2e path (fn-level match; input-shape match is Phase 2.2). The hook is env-gated and a no-op under plain `npm test`.
- Keep Markdown/HTML docs aligned when public usage changes.

## Common Commands

```sh
npm test
node runAndReadMe.aiDoc.yume.js show head
node runAndReadMe.aiDoc.yume.js validate
node BLOCKFILE.aiDoc.yume.js show head
npm run ingest:novel -- input.txt --stem novel
node examples/hello.fn.yume.js refs-check .
node examples/hello.fn.yume.js heavy hello 1 .
node examples/hello.fn.yume.js impact hello 1 .
```

## Completion Checks

- Changed `.yume.js` files validate.
- `refs-check .` has no new unresolved path or duplicate block-id errors.
- `npm test` passes when runtime behavior, repository structure, or yume file invariants change.
- Public docs still describe the current commands and file layout.
