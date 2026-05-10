# AI Agent Instructions for yume-files

This repository defines the portable `.yume.js` file format and its zero-dependency v001 runtime.

## Start Here

1. Read `runAndReadMe.aiDoc.yume.js` first. It is the operational runbook for AI agents.
2. Use `README.md` for the human-facing overview and examples.
3. Use `BLOCKFILE.aiDoc.yume.js` only when exact format or runtime semantics are needed.
4. Use `examples/hello.fn.yume.js` as the smallest valid `.yume.js` sample.

## Project Rules

- Keep the runtime dependency-free. Do not add AST parser packages or other npm dependencies unless the project deliberately changes that constraint.
- Treat `filename.domain.yume.js` as meaningful. The `domain` segment tells an AI whether the file is code, spec, workflow, template, world, style, character data, or another knowledge unit.
- For normal `.yume.js` edits, edit only the `HEAD` region, then run `node <file>.yume.js commit --note "why this change exists"`.
- Do not hand-edit `__block.versions[]` unless deliberately repairing a broken file.
- Use `notes` for mutable intent and commentary. Use `applyId` when one AI operation spans multiple files.
- Use `heavy` for related context, `impact` for reverse-reference blast radius, and `refs-check` for graph health.
- Keep Markdown/HTML docs aligned when public usage changes.

## Common Commands

```sh
npm test
node runAndReadMe.aiDoc.yume.js show head
node runAndReadMe.aiDoc.yume.js validate
node BLOCKFILE.aiDoc.yume.js show head
node examples/hello.fn.yume.js refs-check .
node examples/hello.fn.yume.js heavy hello 1 .
node examples/hello.fn.yume.js impact hello 1 .
```

## Completion Checks

- Changed `.yume.js` files validate.
- `refs-check .` has no new unresolved path or duplicate block-id errors.
- `npm test` passes when runtime behavior, repository structure, or yume file invariants change.
- Public docs still describe the current commands and file layout.
