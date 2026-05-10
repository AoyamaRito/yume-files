# yume-files Handout — Spec Coverage Strategy

最終更新: 2026-05-10 (Phase 2.1 達成後)
区切り: Phase 0 〜 2.1 完了時点の引き継ぎ資料 (別 session の AI / 人間が状況を最短で把握するため)

---

## 戦略の核

「coding 中は unit に気を取られない、e2e 時に unit case の全パターンが踏まれた事を保証する」

通常の TDD でも line/branch coverage でもなく **specification coverage**。仕様 (unit case 表 = `*.spec.yume.js`) と振る舞い (`e2e.js`) を直交軸として持ち、両者の交差で品質を担保する。

AI 編集との相性が良い理由:
- 編集中に「unit を毎度通そうとする」摩擦が消える
- 最後の reckoning で「e2e がどの仕様 case を踏んだか」を客観指標で確認
- 不足は「未 hit case 一覧」として AI に渡せる作業項目になる

業界的には航空 (DO-178C) や金融など mission-critical 系で実証された「spec vs impl 整合性 monitoring」の系譜。

---

## 現状サマリ (2026-05-10)

| Phase | 内容 | 状態 |
|---|---|---|
| 0 | docs (AGENTS.md) に戦略追記 | ✅ 完了 |
| 1 薄 | runtime.spec.yume.js (31 case, 純粋関数のみ) | ✅ 完了 |
| 1 厚 | 79 case (純粋 + I/O) に拡張 | ✅ 完了 |
| 2.0 | cover.js で spec の self-coverage 計測 | ✅ 完了 |
| 2.1 | e2e に hook 仕込んで「e2e が spec を網羅したか」判定 | ✅ 完了 (戦略の本命達成) |
| 2.2 | input-shape 一致まで踏み込んだ網羅判定 (現状は fn-level) | ⏸ 未着手 |
| 3+ | spec.yume.js を file format の正規 domain に / `cover` `gaps` を runtime verb 化 | ⏸ 未着手 |

### 数値

```
spec cases:                            79 (all pass)
declared-fn drift:                     0/79
runtime-export coverage (spec):        28/31  (untouched: cli, decompress, recompress)
e2e fn coverage (e2e が呼ぶ runtime fn): 28/31  (spec と完全一致 / 同 3 つだけ未呼)
spec cases not reached by e2e:         0/79   ← Phase 2.1 達成、戦略本命
npm test (e2e):                        121 pass
yume files (validate):                 BLOCKFILE / runAndReadMe / hello / runtime.spec 全部 valid
```

**意味**: spec が宣言する全 fn を e2e が現実シナリオで踏んでいる。spec/e2e/cover 三層が完全整合 = 仕様と振る舞いに今知り得る範囲で乖離なし、という状態。

---

## 戦略が引き出した発見 (5 件)

| # | 内容 | 対応 |
|---|---|---|
| 1 | `validateBlock` が空 `versions[]` を valid 判定 | fix `c19166c` (1 行追加) |
| 2 | `commitManual({note})` は version hash でなく `apply:` key 保管 | spec 認識を実装に合わせ修正、設計は妥当 |
| 3 | `decompress` / `recompress` (heavy alias) が **どの spec case にも触られない死荷物** | deprecate 候補として next steps へ |
| 4 | spec 79 case が宣言通りの fn を実際呼んでいる (drift=0) | spec 自身の整合性証明 |
| 5 | 残り 3 untouched export (`cli` / `decompress` / `recompress`) が **全部 entry point + deprecate 候補** | runtime API が無駄なく整理されている裏付け |

---

## 関連 file

| file | 役割 |
|---|---|
| `runtime.spec.yume.js` | case 表 (79 case)、yume file format で書かれた spec |
| `cover.js` | Phase 2.0 spec coverage runner (`npm run cover`) |
| `runtimes/ver001.handle.yume.js` | runtime (validateBlock fix 適用済) |
| `AGENTS.md` | 戦略の運用ルール記載 |
| `package.json` | `npm run cover` script 追加済 |
| `e2e.js` | 既存 e2e 121 tests + Phase 2.1 hook header (env-gated、env 未設定時ゼロ効果) |

---

## 関連 commit (新しい順)

```
7aaa553  feat(spec): expand runtime.spec.yume.js to 79 cases (Phase 1 thicker)
85d882b  feat(cover): add Phase 2.0 spec coverage runner
52b80c6  feat(spec): expand runtime.spec.yume.js to 61 cases (Phase 1 thick)
d542511  feat: introduce *.spec.yume.js (Phase 1, ad-hoc)
c19166c  fix(runtime): reject empty versions[] in validateBlock
9c66d32  docs: record decision against zlib squash compression
```

---

## Next Steps

### 即着手可 (リスク小)

**`decompress` / `recompress` の deprecate**
cover.js が「死荷物」として定量検出した。整理対象:
- `examples/hello.fn.yume.js` の `api` 配列から削除
- `runtimes/ver001.handle.yume.js` の `cli()` から `case 'decompress':` / `case 'recompress':` 削除 (関数本体は heavy/heavy-apply に統合済 = export 自体を削除可)
- AGENTS.md / README に「heavy / heavy-apply のみ supported」明記

### Phase 2.1 (達成済) の仕様

実装は A 案 (runtime hook) を 28 export に段階追加、`e2e.js` に env-gated header、`cover.js` に `--e2e` flag。`node cover.js --e2e` で:
- e2e を `child_process.spawn` で `YUME_COVER=1` 付き起動
- e2e 中の全 fn 呼び出しを `process.on('exit')` で JSON dump
- 親が読み取り、spec case の宣言 fn と突合
- 「e2e で 1 度も呼ばれない fn」「網羅できない spec case」を出す

現状: gaps=0/79 (戦略本命達成)。

### Phase 2.2 候補 — input-shape 一致判定

現状は **fn 名一致のみ**。同 fn が呼ばれたかどうかしか見ていないので、spec case が `parseBlock(壊れた input)` を期待していても、e2e が `parseBlock(正常 input)` だけ呼んでいれば「hit」と数えてしまう。

input-shape (型 + サイズ + 構造の signature) で一致判定するなら:
- spec case に `args` を data として置く必要 (現状は `run(rt)` の中に隠れている)
- もしくは hook で記録した args と spec の run 内呼び出し時の args を比較

これは schema を硬化する Phase 3 と一緒にやる方が筋が良い。

### Phase 3 以降の射程

- `*.spec.yume.js` を file format の正規 domain として確立 (`BLOCKFILE.aiDoc.yume.js` に明記)
- `cover` / `gaps` を runtime の正規 verb 化 (`yume cover spec.yume.js e2e.js`, `yume gaps`)
- AI agent が gaps 出力を読んで「未 hit を埋めるシナリオ」を自動生成 (self-healing test system)

---

## 実装ノート (引き継ぎ時の注意)

- **case schema は ad-hoc**: `{ tag, fn, run(rt) }` の配列。`run()` は truthy/falsy/throw。schema 硬化は Phase 2.1 以降を予定。
- **bootstrap script は使い切り**: `tmp_bootstrap.mjs` を作って実行し、生成後は `/PJs/trash/yume-files-bootstrap-2026-05-10/` に退避済。再 bootstrap が必要なら復元可能。
- **yume の流儀との不整合**: 本来は HEAD 編集 → `commit` で履歴を進めるのが正規。Phase 1 ad-hoc では bootstrap で全体再生成を選んだ。Phase 2 以降は yume commit 流儀へ移行推奨。
- **I/O case の隔離**: per-case で `mkdtempSync` の sandbox 隔離。sequential 実行前提。並列化する場合は dir conflict 注意。
- **cover.js の限界 (解決済)**: Phase 2.0 の Proxy wrap は spec runner 専用。e2e.js は runtime を直接 import するため、Phase 2.1 では runtime 内 hook + child_process という別アプローチを採った。両者は独立に動く (plain `cover` は Proxy、`cover --e2e` は子プロセス + runtime hook)。
- **撤退済の関連知識**: 直前に `feat/zlib-self-compression` branch (commit `e3c4bef`) で zlib squash 機能を実験 → 撤退。「平文を保つ」が yume-files の core value、圧縮は cost-benefit 合わない。`AGENTS.md` / `CHANGELOG.md` に決定記録。
