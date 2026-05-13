# Handoff to Claude

Date: 2026-05-13
Repo: `yume-files`

## Current State

The repo is in a good, working state. The working tree is clean before this handoff doc was added.

Recent work is focused on long-novel ingest. The flow now intentionally avoids "convert the whole txt into a polished world file in one pass". Instead it stages the work into smaller artifacts:

`txt -> source index -> term index -> relation index -> settings catalog -> empty settings collections -> world facts -> focused views`

The main intent is to reduce initial AI load and make the process resumable.

## What Changed Recently

- Added `novelSourceIngest.workflow.yume.js` as a `.yume.js` workflow for long-novel ingest.
- Added `tools/novel-source-ingest.js`, a zero-dependency CLI that creates intermediate files and staged `.yume.js` outputs.
- Added a relation staging step, then extended it with a settings catalog and multiple empty settings collections.
- Kept `.yume-work/` as generated intermediate/cache output and ignored it in Git.

Recent commits:

- `21179c9` `feat(ingest): add settings catalog staging`
- `0ce2289` `feat(ingest): add relation staging output`
- `be3165c` `feat(ingest): add novel source staging workflow`
- `bf2608a` `fix(runtime): harden yume file behavior`
- `a97b6c8` `chore: remove decompress/recompress aliases (cover-detected dead weight)`

## Key Files

- [novelSourceIngest.workflow.yume.js](/Users/AoyamaRito/PJs/yume-files/novelSourceIngest.workflow.yume.js)
- [tools/novel-source-ingest.js](/Users/AoyamaRito/PJs/yume-files/tools/novel-source-ingest.js)
- [e2e.js](/Users/AoyamaRito/PJs/yume-files/e2e.js)
- [README.md](/Users/AoyamaRito/PJs/yume-files/README.md)
- [AGENTS.md](/Users/AoyamaRito/PJs/yume-files/AGENTS.md)

## Ingest Output

Running:

```sh
npm run ingest:novel -- path/to/input.txt --stem novel
```

creates:

- `novel.source.index.yume.js`
- `novel.terms.index.yume.js`
- `novel.relations.index.yume.js`
- `novel.settings.catalog.yume.js`
- `novel.world.facts.yume.js`
- `novel.world.settings.yume.js`
- `novel.characters.settings.yume.js`
- `novel.places.settings.yume.js`
- `novel.groups.settings.yume.js`
- `novel.objects.settings.yume.js`
- `novel.rules.settings.yume.js`
- `novel.events.settings.yume.js`

and intermediate files under `.yume-work/`:

- `manifest.json`
- `source.index.json`
- `terms.index.json`
- `occurrences.jsonl`
- `terms.raw.jsonl`
- `relations.raw.jsonl`
- `facts.raw.jsonl`
- `chunks/*.txt`

Use `--clean-workdir` if the intermediates should be deleted after success.

## How The Flow Works

1. `source.index` chunks the txt and records hash, line ranges, and previews.
2. `term.index` extracts candidate terms and occurrence data.
3. `relation.index` starts empty except for term nodes.
4. `settings.catalog` maps terms to candidate collections and exposes multiple lookup sources.
5. Empty settings collections are created for `world`, `characters`, `places`, `groups`, `objects`, `rules`, and `events`.
6. `world.facts` stays empty until later AI extraction.

This is deliberate. The first stage is "readability infrastructure", not final classification.

## Verification Status

Current verification has been run successfully:

```txt
npm test
npm run cover:e2e
node novelSourceIngest.workflow.yume.js validate
node examples/hello.fn.yume.js refs-check . --json
```

At the time of handoff:

- `npm test` passed
- `npm run cover:e2e` passed
- `refs-check .` reported no errors
- `novelSourceIngest.workflow.yume.js validate` passed

## Notes For Next Work

- The next useful step is likely to start filling `settings.catalog` and the settings collections from relation evidence.
- The setup already allows a term to map to multiple collections. That should be preserved.
- Keep the early stage redundant and evidence-heavy. Do not collapse to one clean world file too early.
- If you add new generated outputs, update `README.md`, `AGENTS.md`, `CHANGELOG.md`, and the e2e checks together.

## Commands That Matter

```sh
npm test
npm run cover:e2e
npm run ingest:novel -- path/to/input.txt --stem novel
node novelSourceIngest.workflow.yume.js validate
node examples/hello.fn.yume.js refs-check . --json
```
