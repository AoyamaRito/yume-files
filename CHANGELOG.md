# Changelog

All notable changes to `yume-files` are summarized here.

## 2026-05-13

### Added

- Added `novelSourceIngest.workflow.yume.js` to preserve the long-novel txt ingest workflow as a `.yume.js` file.
- Added `tools/novel-source-ingest.js`, a zero-dependency CLI that creates chunk, term, occurrence, and manifest intermediates before emitting source-index, terms-index, relation-index, settings-catalog, settings-collection, and world-facts staging `.yume.js` files.
- Added `npm run ingest:novel -- <input.txt>` and e2e coverage for generated ingest artifacts.

### Changed

- Ignored `.yume-work/` as generated ingest intermediate/cache output.

## 2026-05-10

### Added

- Added `AGENTS.md` and `runAndReadMe.aiDoc.yume.js` as AI-facing entrypoints.
- Added a one-line starter prompt and usage guide for humans using AI agents with `yume-files`.
- Added a structured usage catalog covering aiDoc, specs, workflows, templates, invoices/estimates, pitch decks, fiction writing, research, and executable JavaScript.
- Added privacy boundaries for public examples derived from private project patterns.
- Added the GitHub Pages site with JP/EN language switching, architecture, workflow, fiction, commands, usage, and author sections.
- Added `impact` and `refs-check` support to inspect reverse refs and graph health.
- Added human prompt examples to the README.

### Changed

- Clarified that `yume-files` is both an editing substrate for CLI-based AI agents and the `.yume.js` file format itself.
- Moved the web usage guide near the top of the page so first-time users see it immediately after the overview.
- Shortened the web starter prompt and added a copy button.
- Clarified that the v001 runtime remains zero-dependency and avoids AST package dependencies.

### Decided against

- Did not adopt zlib/base64 self-compression (squash) of `__block.versions[]`. The substrate value of `.yume.js` depends on history staying plaintext and AI/grep readable; the added bug surface (decompression side-effects in `validateBlock`, missing GC of orphaned compressed payloads, rollback integrity, parse cost) was judged uneconomical against the bounded size savings. The full experiment is preserved on branch `feat/zlib-self-compression` for reference.

### Verified

- `npm test`
- `node runAndReadMe.aiDoc.yume.js validate`
- `node examples/hello.fn.yume.js refs-check .`
