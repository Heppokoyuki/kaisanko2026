# ロックマラソン得点計算ツール

`docs/rule.md` の競技規則に従ってチーム得点を計算する静的サイト。ビルド不要。

- `scoring.js` … 得点計算ロジック（ブラウザ／Node 共通）
- `app.js` / `index.html` / `style.css` … UI。データは localStorage に保存
- `sw.js` … オフライン対応（一度開けば電波がなくても再読み込みできる）

```sh
node --test site/scoring.test.js      # ロジックのテスト
python3 -m http.server -d site 8000  # ローカル確認 → http://localhost:8000
```

GitHub の Settings → Pages → Source を「GitHub Actions」にすると、
`main` への push で `.github/workflows/pages.yml` が `site/` を公開する。
