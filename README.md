# yume-files

`.yume.js` file format の reference implementation。

`yume-files` は、履歴をファイル自身に内蔵する JavaScript ベースの単一ファイル形式です。`yume` CLI / chat tool から独立した基盤として、`.yume.js` の仕様、runtime、最小例、round-trip test を管理します。

AI にファイルを編集させると、「今の内容」は残っても、「なぜこうなったか」「どの一連の依頼で複数ファイルが変わったか」「将来 runtime が変わっても読めるか」が失われがちです。`.yume.js` は、その問題を file format 側で扱います。

MIT License で公開しています。

## 日本語

### 位置づけ

`yume-files` は `yume` の基盤ファイル形式です。

```txt
ai-desk     = 実験プロジェクト / lab。v2 が最新の思想・試作の中心
yume-files  = 安定化する file format / runtime / reference implementation
yume        = 誰でも使える product / CLI / chat REPL として整備中
```

`.yume.js` 形式を `yume` 本体から分離しておくことで、`yume` の UI や CLI が変わっても、履歴内蔵ファイルと runtime は残せます。

### 何が嬉しいのか

- AI が何度も編集しても、各ファイルの変化が file 内に append-only で残ります。
- commit message を毎回書かなくても、あとから `notes` に意図や理由を追記・修正できます。
- 複数ファイルをまたぐ AI の一回の作業を `applyId` で束ねられます。
- `.yume.js` は普通の JavaScript file なので、専用 DB や外部 service が消えても JS parser だけで読めます。
- runtime version を file 側で pin するため、将来 yume が変わっても古い file を古い runtime で扱えます。
- `yume` product から独立しているので、editor plugin、別 CLI、library からも同じ format を利用できます。

つまり `yume-files` は、AI 時代の「ファイル単位の履歴・意図・作業単位」を、Git とは別の粒度で持つための substrate です。

### 何ができるか

- 1つの `.yume.js` ファイルが自分の履歴を `__block.versions[]` に保持します。
- `HEAD` region には現在の実コードを置きます。
- `BOOT` region から co-located runtime を呼び出せます。
- runtime version を file 側で pin するため、古い file は古い runtime のまま動かせます。
- v001 runtime は `commit` / `history` / `validate` / `refs` / `tags` / `note-*` / `apply-*` を提供します。
- `notes` は変更理由や意図を書く mutable layer です。version hash には含めません。
- `applyId` は一連の操作で生まれた version を束ねる ID です。apply 全体にも note を付けられます。
- folder を走査して、複数ファイルにまたがる apply group を検索できます。
- HEAD から `refs` / `tags` を抽出し、その Block が何とつながっているかを記録できます。

将来的には、AI が編集した view を `.yume.js` に戻す codec round-trip、rollback、diff を追加する想定です。

### 使い方

必要環境:

- Node.js 20 以上

テスト:

```sh
npm test
```

仕様の概要を表示:

```sh
npm run spec
```

example file の検証:

```sh
node examples/hello.fn.yume.js validate
```

履歴表示:

```sh
node examples/hello.fn.yume.js history
```

最新 version の refs / tags を表示:

```sh
node examples/hello.fn.yume.js refs
node examples/hello.fn.yume.js tags
```

手動編集後に HEAD を commit:

```sh
node examples/hello.fn.yume.js commit
```

applyId と apply note 付きで commit:

```sh
node examples/hello.fn.yume.js commit --apply-id apply-demo-001 --note "changed greeting"
```

最新 version に note を追加:

```sh
node examples/hello.fn.yume.js note-add head "why this version exists"
```

note を表示:

```sh
node examples/hello.fn.yume.js note-list
```

apply group を表示:

```sh
node examples/hello.fn.yume.js apply-list
node examples/hello.fn.yume.js apply-show apply-demo-001
```

folder 内の apply group を横断検索:

```sh
node examples/hello.fn.yume.js apply-index .
node examples/hello.fn.yume.js apply-search . apply-demo-001
```

### ファイル構成

```txt
yume-files/
├── AiRunAndRead_BLOCKFILE.js     # canonical spec
├── runtimes/
│   └── ver001.handle.yume.js      # runtime v001
├── examples/
│   └── hello.fn.yume.js           # minimal example
├── e2e.js                         # round-trip / runtime test
├── package.json
└── LICENSE
```

### 設計の要点

- `__block` は canonical JSON object literal として保存します。
- runtime は `__block` を実行せず `JSON.parse` します。
- `versions[]` は append-only です。
- `hash` / `prevHash` によって履歴 chain を検証します。
- commit 時に HEAD から `import` / `export ... from` / dynamic `import()` / bare function call / `// @tags:` を抽出します。
- 書き込みは tmp file + fsync + rename で行います。
- lock file は atomic create + token ownership で扱います。
- commentary は `notes` layer に分離し、version hash には含めません。
- apply 全体の commentary は `__block.notes["apply:<applyId>"]` に保存します。
- cross-file apply は永続 index を作らず、現時点では folder scan で解決します。

### Git との違い

Git は repository 全体の snapshot 管理に強い道具です。`.yume.js` はそれを置き換えるものではありません。

ただし、AI が作業中に過去の経緯を参照する用途では、Git は粒度と操作のオーバーヘッドが大きくなりがちです。AI が `git log`、`git show`、diff、commit message をたどって「この関数がなぜ今こうなっているか」を復元するには、repository 全体の文脈から必要な断片を探す必要があります。

`.yume.js` が担当するのは、もっと小さい粒度です。

- file / function 単位の履歴
- AI が触った作業単位
- あとから直せる意図メモ
- runtime version 付きの可搬な実行単位

`.yume.js` では、AI が1つの Block file を開くだけで、現在の `HEAD`、過去の `versions[]`、意図を書いた `notes`、複数ファイル操作を束ねる `applyId` を同じ場所で読めます。これは、AI が履歴を「外部の巨大な repo 履歴」ではなく「いま編集している Block の局所文脈」として扱える、という意味があります。

この局所性が重要です。AI は必要な履歴を Block 単位で自由に読み、必要なら apply group を folder scan で追えます。Git のように repo 全体の checkpoint を復元するのではなく、作業対象そのものに過去の変化と理由が同居しているため、AI の探索コストが下がります。

Git と併用する前提です。Git は repo の checkpoint、`.yume.js` は file 内の event log です。

### ライセンス

MIT License です。仕様、runtime、example、test を自由に利用、改変、再配布できます。詳しくは [LICENSE](./LICENSE) を参照してください。

## English

### What Is This?

`yume-files` is the reference implementation of the `.yume.js` file format.

A `.yume.js` file is a JavaScript-based single-file format that carries its own version history. This repository keeps the format, runtime, examples, and round-trip tests independent from the `yume` CLI / chat tool.

When AI edits files repeatedly, the current content may survive, but the context often does not: why a change happened, which request changed multiple files together, and whether the file will still be readable after the runtime evolves. `.yume.js` moves those concerns into the file format.

This project is released under the MIT License.

### Project Role

```txt
ai-desk     = experimental lab. v2 is the latest design / prototype line
yume-files  = stable file format / runtime / reference implementation
yume        = product-facing CLI / chat REPL being prepared for general use
```

Keeping `.yume.js` separate from `yume` lets the file format and history survive even if the product UI or CLI evolves.

### Why This Is Useful

- Every AI or human edit can become an append-only version inside the file.
- You do not need to force a commit message at edit time; intent can be added or corrected later with `notes`.
- A single AI operation that changes multiple files can be grouped with `applyId`.
- `.yume.js` remains a normal JavaScript file, so it can still be read with a JS parser even without a service or database.
- Runtime versions are pinned per file, so older files can keep using older runtimes as yume evolves.
- The format is independent from the `yume` product, so editor plugins, other CLIs, and libraries can reuse it.

In short, `yume-files` is a substrate for file-level history, intent, and AI operation grouping at a finer granularity than Git.

### Features

- A single `.yume.js` file stores its own history in `__block.versions[]`.
- The `HEAD` region contains the current source code.
- The optional `BOOT` region can invoke a co-located runtime.
- Runtime versions are pinned per file, so older files can keep using older runtimes.
- The v001 runtime currently supports `commit`, `history`, `validate`, `refs`, `tags`, `note-*`, and `apply-*`.
- `notes` is a mutable commentary layer for intent and reasoning. It is not included in version hashes.
- `applyId` groups versions produced by the same operation. Notes can also be attached to an apply group.
- Folder scans can find apply groups that span multiple files.
- The runtime extracts `refs` / `tags` from `HEAD` so each Block can record what it connects to.

Planned work includes codec round-trip for AI-edited views, rollback, and diff.

### Usage

Requirements:

- Node.js 20 or newer

Run tests:

```sh
npm test
```

Print the spec summary:

```sh
npm run spec
```

Validate the example file:

```sh
node examples/hello.fn.yume.js validate
```

Show history:

```sh
node examples/hello.fn.yume.js history
```

Show latest refs / tags:

```sh
node examples/hello.fn.yume.js refs
node examples/hello.fn.yume.js tags
```

Commit a manually edited `HEAD` region:

```sh
node examples/hello.fn.yume.js commit
```

Commit with an applyId and apply note:

```sh
node examples/hello.fn.yume.js commit --apply-id apply-demo-001 --note "changed greeting"
```

Add a note to the latest version:

```sh
node examples/hello.fn.yume.js note-add head "why this version exists"
```

List notes:

```sh
node examples/hello.fn.yume.js note-list
```

Show apply groups:

```sh
node examples/hello.fn.yume.js apply-list
node examples/hello.fn.yume.js apply-show apply-demo-001
```

Search apply groups across a folder:

```sh
node examples/hello.fn.yume.js apply-index .
node examples/hello.fn.yume.js apply-search . apply-demo-001
```

### Repository Layout

```txt
yume-files/
├── AiRunAndRead_BLOCKFILE.js     # canonical spec
├── runtimes/
│   └── ver001.handle.yume.js      # runtime v001
├── examples/
│   └── hello.fn.yume.js           # minimal example
├── e2e.js                         # round-trip / runtime test
├── package.json
└── LICENSE
```

### Design Notes

- `__block` is stored as a canonical JSON object literal.
- The runtime parses `__block` with `JSON.parse` and does not execute it.
- `versions[]` is append-only.
- `hash` / `prevHash` form a verifiable history chain.
- On commit, the runtime extracts `import`, `export ... from`, dynamic `import()`, bare function calls, and `// @tags:`.
- Writes use tmp file + fsync + rename.
- Lock files use atomic create + token ownership.
- Commentary lives in a separate `notes` layer and stays out of version hashes.
- Apply-level commentary is stored under `__block.notes["apply:<applyId>"]`.
- Cross-file apply lookup currently uses folder scanning instead of a persistent index.

### How It Relates To Git

Git is excellent at repository-level snapshots. `.yume.js` does not replace Git.

However, Git can be too coarse and too expensive as a context source while an AI is actively working. To understand why one function looks the way it does, the AI often has to inspect repository-level history, diffs, and commit messages, then reconstruct the relevant local story from a much larger timeline.

`.yume.js` focuses on a smaller unit:

- file / function-level history
- AI operation grouping
- mutable intent notes
- portable runtime-pinned execution units

With `.yume.js`, an AI can open one Block file and read the current `HEAD`, previous `versions[]`, mutable `notes`, and related `applyId` context in the same place. The history is not only in an external repository log; it is colocated with the object being edited.

That locality matters. The AI can inspect history at Block granularity and follow cross-file apply groups only when needed. Instead of reconstructing intent from the entire repository timeline, it can start from the local history and reasoning attached to the current Block.

The intended use is together with Git: Git is the repository checkpoint, while `.yume.js` is the event log inside the file.

### License

MIT License. You may use, copy, modify, publish, distribute, sublicense, and sell copies of the spec, runtime, examples, and tests. See [LICENSE](./LICENSE).
