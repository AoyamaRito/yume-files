# yume-files

`.yume.js` file format / AI editing tool substrate の reference implementation。

`yume-files` は、Gemini CLI、Claude Code、Codex などの CLI 型 AI agent がファイルを読み、編集し、書き戻すための運用ツールであり、同時に JavaScript ベースの単一ファイル形式です。AI が使う知識・手順・仕様・創作設定・実コードを 1 file に閉じ、必要なら履歴もファイル自身に内蔵します。`yume` CLI / chat tool から独立した基盤として、`.yume.js` の仕様、runtime、最小例、round-trip test を管理します。

AI にファイルを編集させると、「今の内容」は残っても、「なぜこうなったか」「どの一連の依頼で複数ファイルが変わったか」「将来 runtime が変わっても読めるか」が失われがちです。`.yume.js` は、その問題を file format 側で扱います。

MIT License で公開しています。

Project page: https://aoyamarito.github.io/yume-files/

Changelog: [CHANGELOG.md](./CHANGELOG.md)

## 日本語

### 位置づけ

`yume-files` は `yume` の基盤ファイル形式です。

```txt
ai-desk     = 実験プロジェクト / lab。v2 が最新の思想・試作の中心
yume-files  = 安定化する file format / runtime / reference implementation
yume        = 誰でも使える product / CLI / chat REPL として整備中
```

`.yume.js` 形式を `yume` 本体から分離しておくことで、`yume` の UI や CLI が変わっても、履歴内蔵ファイルと runtime は残せます。

### 使用目的

`.yume.js` は、あらゆる AI 使用のための基礎ファイルです。

`filename.domain.yume.js` の `domain` は、その file を AI がどう扱うべきかを示す用途領域です。`fn` / `module` / `aiDoc` / `handle` のような code 寄りの domain だけでなく、`spec` / `workflow` / `template` / `world` / `style` のような非コード用途も同じ形式で扱えます。

たとえば、文書作成なら template、workflow、仕様、review rule を 1 file に閉じられます。小説執筆なら world、character、plot rule、style guide、執筆履歴を 1 file に閉じられます。開発では仕様、設計判断、運用規律、実装履歴を同じ substrate に置けます。

もちろん、通常の JavaScript file として実コードを書き、すべての変更履歴を追える file としても使えます。

### 想定ユースケース

`.yume.js` は「AI に繰り返し読ませたい文脈」を 1 file に閉じるための形式です。LLM に渡す時は、用途ごとに domain 名を分けると扱いやすくなります。

- AI onboarding / runbook: `project.aiDoc.yume.js`、`runAndReadMe.aiDoc.yume.js`
- 仕様・設計判断: `feature.spec.yume.js`、`api.contract.yume.js`、`decision.log.yume.js`
- ワークフロー: `review.workflow.yume.js`、`release.workflow.yume.js`、`support.workflow.yume.js`
- テンプレート: `doc.template.yume.js`、`pr.template.yume.js`、`prompt.template.yume.js`
- 請求・見積・帳票: `invoice.template.yume.js`、`estimate.workflow.yume.js`、`billing.rules.yume.js`、`statement.draft.yume.js`
- ピッチ・提案資料: `pitch.story.yume.js`、`deck.template.yume.js`、`slide.draft.yume.js`、`business-model.spec.yume.js`
- 小説・創作: `novel.world.yume.js`、`mira.character.yume.js`、`voice.style.yume.js`、`chapter.draft.yume.js`
- 研究・調査: `research.note.yume.js`、`source.index.yume.js`、`summary.template.yume.js`
- 評価・レビュー: `rubric.spec.yume.js`、`eval.workflow.yume.js`、`qa.checklist.yume.js`
- 実コード: `parser.fn.yume.js`、`renderer.module.yume.js`、`adapter.module.yume.js`
- エージェント記憶: `team.rules.yume.js`、`project.memory.yume.js`、`coding.style.yume.js`

請求書やピッチ資料のような実務 file では、顧客名・金額・案件名・個人情報は yume-files の公開サンプルに入れず、構造だけを template / workflow / spec として抽象化します。LLM に渡す file でも、公開する file と private data file を分けるのが安全です。

LLM に親切な `.yume.js` では、HEAD に現在の内容、`refs` に関連 Block、`tags` に検索語、`notes` に変更理由、`applyId` に一連の作業単位を持たせます。これにより、AI は「どこを読むべきか」「何に影響するか」「なぜ変わったか」を小さい文脈で追えます。

domain 名の目安:

```txt
aiDoc      AI が読む運用説明・runbook
spec       仕様、制約、契約、評価基準
workflow   手順、レビュー規則、運用フロー
template   文書、プロンプト、出力形式の雛形
story      ピッチや記事の構成、ナラティブ、説得順序
deck       スライド資料の全体構成、デザイン規則
slide      個別スライド、図表、コピー
invoice    請求書や帳票の現在形
billing    請求・見積・支払条件などの業務ルール
world      世界観、前提、舞台設定
character  キャラクター、声、関係性、状態
style      文体、ブランドトーン、禁止表現
draft      草稿、章、記事、生成物の現在形
note       調査メモ、会議メモ、意思決定ログ
fn/module  実行可能な JavaScript code
handle     runtime / handler infrastructure
```

### 何が嬉しいのか

- AI が何度も編集しても、各ファイルの変化が file 内に append-only で残ります。
- commit message を毎回書かなくても、あとから `notes` に意図や理由を追記・修正できます。
- `filename.domain.yume.js` という file 名だけで、AI が用途領域を判断できます。
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
- v001 runtime は `commit` / `history` / `heavy` / `heavy-apply` / `show` / `diff` / `rollback` / `validate` / `refs` / `tags` / `impact` / `refs-check` / `note-*` / `notes-search` / `apply-*` を提供します。
- `notes` は変更理由や意図を書く mutable layer です。version hash には含めません。
- `applyId` は一連の操作で生まれた version を束ねる ID です。apply 全体にも note を付けられます。
- `heavy` で関連 Block を AI が編集しやすい text view に展開し、`heavy-apply` で `.yume.js` に戻せます。
- `impact` で、ある Block を参照している file を reverse refs でたどれます。
- `refs-check` で refs graph の dangling path、duplicate block id、cycle、孤立 file を検査できます。
- folder を走査して、複数ファイルにまたがる apply group を検索できます。
- HEAD から `refs` / `tags` を抽出し、その Block が何とつながっているかを記録できます。

今後は `impact` の ref kind 拡充と source scan fixture の拡充を続けます。core runtime には AST parser や外部 package 依存を入れません。

### 使い方

必要環境:

- Node.js 20 以上

AI agent にこの repository を渡す場合は、まず `AGENTS.md` を読み、次に `runAndReadMe.aiDoc.yume.js` を読むのが最短です。`runAndReadMe` は AI が `.yume.js` をどう読み、どう編集し、どのコマンドで検証するかを yume file 自身として持つ operational runbook です。

AI agent 向け runbook:

```sh
npm run runbook
node runAndReadMe.aiDoc.yume.js validate
```

### 人間から AI へのプロンプト例

`@yume-files` を AI に読ませる時は、最初の依頼で「読む入口」と「完了条件」を一緒に伝えると安定します。下の例はそのまま貼って使えます。

まず理解させる:

```txt
@yume-files を読んでください。
最初に AGENTS.md と runAndReadMe.aiDoc.yume.js を確認し、
必要なときだけ BLOCKFILE.aiDoc.yume.js を参照してください。

この repo の .yume.js 運用ルールを短く説明し、
以後そのルールに従って作業してください。
```

既存の `.yume.js` を編集させる:

```txt
<file>.yume.js の HEAD を編集してください。
__block.versions[] は手で触らず、編集後に runtime の commit を使って履歴を追加してください。
変更理由は note に残し、validate と refs-check . まで実行してください。
```

新しい workflow / template / spec file を作る:

```txt
以下の内容を、AI が再利用できる 1 つの .yume.js file に整理してください。
filename.domain.yume.js の domain は用途に合うものを選んでください。
refs / tags / BOOT を入れ、validate と npm test まで確認してください。

内容:
...
```

小説執筆の基盤 file を作る:

```txt
以下の世界観・キャラクター・文体ルールを .yume.js の基盤 file として整理してください。
world / character / style / draft など、用途が分かる domain 名に分けてください。
章や draft が参照できるよう @ref と tags を設計し、refs-check . で確認してください。

素材:
...
```

長い小説 txt を読み込ませる:

```txt
novelSourceIngest.workflow.yume.js の方針に従ってください。
入力 txt をいきなり clean な world 設定に変換せず、まず source-index、term-index、
relations-index、settings-catalog、複数の空 settings collection、world-facts の
中間 artifact を作ってください。関連と設定集は空欄から証拠付きで徐々に記述し、
重複や矛盾は初期段階では残してください。

入力:
...
```

変更前に影響範囲を見せる:

```txt
<block-id> を変更したいです。
まず impact で参照元と影響範囲を確認し、変更案を出してください。
問題なければ編集し、commit、validate、refs-check .、npm test まで実行してください。
```

関連 context だけを展開して編集させる:

```txt
<block-id> を root にして heavy view を作り、関連 file だけを読んで編集してください。
編集後は heavy-apply で戻し、差分、applyId、検証結果を報告してください。
```

テスト:

```sh
npm test
```

長い小説 txt を高速に読み込み用 artifact へ変換:

```sh
npm run ingest:novel -- path/to/input.txt --stem novel
```

これは `.yume-work/` に `chunks/`、`terms.raw.jsonl`、`occurrences.jsonl`、`manifest.json` などの中間ファイルを作り、`novel.source.index.yume.js`、`novel.terms.index.yume.js`、`novel.relations.index.yume.js`、`novel.settings.catalog.yume.js`、複数の `novel.<collection>.settings.yume.js`、`novel.world.facts.yume.js` を生成します。中間ファイルを成功時に消す場合は `--clean-workdir` を付けます。

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

特定 version の表示と diff:

```sh
node examples/hello.fn.yume.js show head
node examples/hello.fn.yume.js diff 0 -1
```

最新 version の refs / tags を表示:

```sh
node examples/hello.fn.yume.js refs
node examples/hello.fn.yume.js tags
```

関連 file を AI 編集用 view に展開:

```sh
node examples/hello.fn.yume.js heavy hello 1 .
```

参照している file から影響範囲を表示:

```sh
node examples/hello.fn.yume.js impact hello 1 .
```

refs graph を検査:

```sh
node examples/hello.fn.yume.js refs-check .
node examples/hello.fn.yume.js refs-check . --json
```

編集済み view を `.yume.js` に戻す:

```sh
node examples/hello.fn.yume.js heavy-apply view.txt hello 1 . --note "AI edited view"
```

手動編集後に HEAD を commit:

```sh
node examples/hello.fn.yume.js commit
```

applyId と apply note 付きで commit:

```sh
node examples/hello.fn.yume.js commit --apply-id apply-demo-001 --note "changed greeting"
```

直前の version へ rollback:

```sh
node examples/hello.fn.yume.js rollback -1 --note "restore previous behavior"
```

最新 version に note を追加:

```sh
node examples/hello.fn.yume.js note-add head "why this version exists"
```

note を表示:

```sh
node examples/hello.fn.yume.js note-list
```

folder 内の note を検索:

```sh
node examples/hello.fn.yume.js notes-search . "why"
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
├── AGENTS.md                      # AI agent entrypoint / repo working rules
├── BLOCKFILE.aiDoc.yume.js       # canonical spec (role=aiDoc, self-historicizing)
├── CHANGELOG.md                   # notable changes
├── novelSourceIngest.workflow.yume.js # long novel txt ingest workflow
├── runAndReadMe.aiDoc.yume.js     # operational runbook for AI agents
├── runtimes/
│   └── ver001.handle.yume.js      # runtime v001
├── tools/
│   └── novel-source-ingest.js      # txt → source/term/relation/settings/fact staging generator
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
- commit 時に HEAD から `import` / `export ... from` / dynamic `import()` / bare function call / `// @ref:` / `// @tags:` を抽出します。
- `heavy` は root Block から `refs` をたどって関連 file を展開します。
- `impact` は root Block を参照している file を reverse refs でたどります。
- `refs-check` は path ref の未解決と duplicate block id を error、cycle と unresolved typed/id ref を warning、孤立 file を info として扱います。
- `heavy-apply` は編集済み view を逆配分し、差分がある file だけ同じ `applyId` で append します。
- rollback は `versions[]` を切り詰めず、指定 version の content を新しい version として append します。
- 書き込みは tmp file + fsync + rename で行います。
- lock file は atomic create + token ownership で扱います。
- commentary は `notes` layer に分離し、version hash には含めません。
- `notes-search` は folder 内の `.yume.js` を走査し、意図メモを横断検索します。
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

`yume-files` is the reference implementation of the `.yume.js` file format and AI editing tool substrate.

A `.yume.js` file is both an operational tool for CLI-based AI agents such as Gemini CLI, Claude Code, and Codex to read, edit, and write files back, and a JavaScript-based single-file format. It keeps AI-facing knowledge, procedures, specs, creative context, and executable code in one file. It can also carry its own version history. This repository keeps the format, runtime, examples, and round-trip tests independent from the `yume` CLI / chat tool.

When AI edits files repeatedly, the current content may survive, but the context often does not: why a change happened, which request changed multiple files together, and whether the file will still be readable after the runtime evolves. `.yume.js` moves those concerns into the file format.

This project is released under the MIT License.

### Project Role

```txt
ai-desk     = experimental lab. v2 is the latest design / prototype line
yume-files  = stable file format / runtime / reference implementation
yume        = product-facing CLI / chat REPL being prepared for general use
```

Keeping `.yume.js` separate from `yume` lets the file format and history survive even if the product UI or CLI evolves.

### Intended Uses

`.yume.js` is a foundation file format for AI work.

In `filename.domain.yume.js`, `domain` tells the AI how to treat the file. Code-oriented domains such as `fn`, `module`, `aiDoc`, and `handle` fit the same pattern as non-code domains such as `spec`, `workflow`, `template`, `world`, and `style`.

For documents, one file can hold a template, workflow, spec, and review rules. For fiction writing, one file can hold the world, characters, plot rules, style guide, and writing history. For development, one file can hold specs, design decisions, operating rules, code, and change history.

It can also be used as a normal JavaScript file whose full edit history remains traceable inside the file.

### Why This Is Useful

- Every AI or human edit can become an append-only version inside the file.
- You do not need to force a commit message at edit time; intent can be added or corrected later with `notes`.
- The `filename.domain.yume.js` name gives AI a file-system-visible usage signal.
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
- The v001 runtime currently supports `commit`, `history`, `heavy`, `heavy-apply`, `show`, `diff`, `rollback`, `validate`, `refs`, `tags`, `impact`, `refs-check`, `note-*`, `notes-search`, and `apply-*`.
- `notes` is a mutable commentary layer for intent and reasoning. It is not included in version hashes.
- `applyId` groups versions produced by the same operation. Notes can also be attached to an apply group.
- `heavy` expands related Blocks into an AI-editable text view, and `heavy-apply` writes that view back into `.yume.js` files.
- `impact` follows reverse refs to show which files reference a Block.
- `refs-check` validates the refs graph for dangling paths, duplicate block ids, cycles, and isolated files.
- Folder scans can find apply groups that span multiple files.
- The runtime extracts `refs` / `tags` from `HEAD` so each Block can record what it connects to.

Planned work includes richer `impact` ref kinds and more source-scan fixtures. The core runtime will not take an AST parser or external package dependency.

### Usage

Requirements:

- Node.js 20 or newer

Run tests:

```sh
npm test
```

Fast ingest for long novel txt sources:

```sh
npm run ingest:novel -- path/to/input.txt --stem novel
```

This creates intermediate files under `.yume-work/` and emits source, term, empty relation, settings catalog, empty settings collections, and empty world-fact staging `.yume.js` files. Use `--clean-workdir` when the intermediate files should be deleted after a successful run.

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

Show a specific version and diff versions:

```sh
node examples/hello.fn.yume.js show head
node examples/hello.fn.yume.js diff 0 -1
```

Show latest refs / tags:

```sh
node examples/hello.fn.yume.js refs
node examples/hello.fn.yume.js tags
```

Expand related files into an AI-editable view:

```sh
node examples/hello.fn.yume.js heavy hello 1 .
```

Show the files impacted by a Block:

```sh
node examples/hello.fn.yume.js impact hello 1 .
```

Check the refs graph:

```sh
node examples/hello.fn.yume.js refs-check .
node examples/hello.fn.yume.js refs-check . --json
```

Write an edited view back into `.yume.js` files:

```sh
node examples/hello.fn.yume.js heavy-apply view.txt hello 1 . --note "AI edited view"
```

Commit a manually edited `HEAD` region:

```sh
node examples/hello.fn.yume.js commit
```

Commit with an applyId and apply note:

```sh
node examples/hello.fn.yume.js commit --apply-id apply-demo-001 --note "changed greeting"
```

Rollback to the previous version:

```sh
node examples/hello.fn.yume.js rollback -1 --note "restore previous behavior"
```

Add a note to the latest version:

```sh
node examples/hello.fn.yume.js note-add head "why this version exists"
```

List notes:

```sh
node examples/hello.fn.yume.js note-list
```

Search notes across a folder:

```sh
node examples/hello.fn.yume.js notes-search . "why"
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
├── BLOCKFILE.aiDoc.yume.js       # canonical spec (role=aiDoc, self-historicizing)
├── novelSourceIngest.workflow.yume.js # long novel txt ingest workflow
├── runtimes/
│   └── ver001.handle.yume.js      # runtime v001
├── tools/
│   └── novel-source-ingest.js      # txt → source/term/relation/settings/fact staging generator
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
- On commit, the runtime extracts `import`, `export ... from`, dynamic `import()`, bare function calls, `// @ref:`, and `// @tags:`.
- `heavy` follows `refs` from a root Block and expands related files.
- `impact` follows reverse refs to find files that reference the root Block.
- `refs-check` treats dangling path refs and duplicate block ids as errors, cycles and unresolved typed/id refs as warnings, and isolated files as info.
- `heavy-apply` maps an edited view back into files and appends changed files with the same `applyId`.
- Rollback does not truncate `versions[]`; it appends the target version content as a new version.
- Writes use tmp file + fsync + rename.
- Lock files use atomic create + token ownership.
- Commentary lives in a separate `notes` layer and stays out of version hashes.
- `notes-search` scans `.yume.js` files in a folder and searches intent notes across files.
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
