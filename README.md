# 駅乗降くらべ

全国の駅別乗降客数を駅名、事業者、路線から探し、2011〜2024年度の推移を最大4つの公表単位で比較する匿名Webサービスです。

- Production: <https://eki-joko.yhay81.com>
- Source: 国土交通省「国土数値情報 駅別乗降客数データ（2024年度）」
- Dataset: 7,739 public units / 14 years
- Stack: Cloudflare Workers, Hono JSX, Vite+, D1, NDJSON

```powershell
npm install
npm run data:build
npm run release:check
npm run check
npm test
npm run build
npm run dev
```

`npm run data:build` は公式全国GeoJSONを取得し、SHA-256、件数、重複代表、データ有無、既知駅を検証して軽量NDJSONを生成します。検索と比較はブラウザ内で行い、駅名や選択駅票をWorkerへ送りません。

```powershell
npx wrangler d1 migrations apply eki-joko --local
npx wrangler d1 migrations apply eki-joko --remote
npm run deploy
npm run metrics
npm run indexnow
```
