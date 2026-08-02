import { Hono } from "hono";
import type { Context } from "hono";
import { requestId } from "hono/request-id";

export type Bindings = { ASSETS: Fetcher; DB: D1Database };
type Variables = { requestId: string };
type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;
class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 403 | 413 | 415,
  ) {
    super(code);
  }
}

const origin = "https://eki-joko.yhay81.com";
const official = "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-S12-2024.html";
const sessionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const eventNames = new Set([
  "visited",
  "searched",
  "no_result",
  "type_changed",
  "compared",
  "copied",
  "official_opened",
  "returned",
]);
const operatorTypes = [
  [1, "JR新幹線", 48],
  [2, "JR在来線", 2638],
  [3, "公営鉄道", 526],
  [4, "民営鉄道", 3220],
  [5, "第三セクター", 1307],
] as const;
const nowSeconds = () => Math.floor(Date.now() / 1000);
const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const sameOrigin = (c: AppContext) => {
  const site = c.req.header("sec-fetch-site");
  if (site && site !== "same-origin") throw new ApiError("cross_site_request", 403);
  const requestOrigin = c.req.header("origin");
  if (requestOrigin && requestOrigin !== new URL(c.req.url).origin)
    throw new ApiError("cross_site_request", 403);
};
const parseJson = async (c: AppContext) => {
  if (!(c.req.header("content-type") ?? "").toLowerCase().startsWith("application/json"))
    throw new ApiError("unsupported_media_type", 415);
  const raw = await c.req.text();
  if (new TextEncoder().encode(raw).byteLength > 256) throw new ApiError("payload_too_large", 413);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new ApiError("invalid_json", 400);
  }
};
const record = async (c: AppContext, name: string) => {
  const session = (c.req.header("x-eki-joko-session") ?? "").toLowerCase();
  if (!sessionPattern.test(session)) return;
  await c.env.DB.prepare(
    "INSERT INTO product_events (session_hash,event_name,is_qa,created_at) VALUES (?,?,?,?)",
  )
    .bind(await sha256(session), name, c.req.header("x-eki-joko-qa") === "1" ? 1 : 0, nowSeconds())
    .run();
};

const Layout = ({
  canonical,
  children,
  description,
  noindex = false,
  title,
}: {
  canonical: string;
  children: unknown;
  description: string;
  noindex?: boolean;
  title: string;
}) => (
  <html lang="ja">
    <head>
      <meta charset="utf-8" />
      <meta content="width=device-width,initial-scale=1" name="viewport" />
      <title>{title}</title>
      <meta content={description} name="description" />
      {noindex ? <meta content="noindex,nofollow" name="robots" /> : null}
      <link href={canonical} rel="canonical" />
      <meta content="website" property="og:type" />
      <meta content="駅乗降くらべ" property="og:site_name" />
      <meta content={title} property="og:title" />
      <meta content={description} property="og:description" />
      <meta content={canonical} property="og:url" />
      <meta content={`${origin}/og.svg`} property="og:image" />
      <meta content="summary_large_image" name="twitter:card" />
      <meta content="#182f48" name="theme-color" />
      <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      <link href="/manifest.webmanifest" rel="manifest" />
      <link href="/styles.css" rel="stylesheet" />
      <script defer src="/app.js" />
    </head>
    <body>
      <a class="skip-link" href="#main">
        本文へ
      </a>
      <header class="site-header">
        <a class="wordmark" href="/" aria-label="駅乗降くらべ ホーム">
          <span class="gate-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>駅乗降くらべ</span>
        </a>
        <nav aria-label="案内">
          <a href="/guide">見方</a>
          <a href="/source">出典</a>
          <a href="/privacy">保存</a>
        </nav>
      </header>
      {children}
      <footer class="site-footer">
        <span>国土交通省「国土数値情報 駅別乗降客数」を加工して作成</span>
        <span>
          <a href="/source">出典と注意</a>
          <a href={official} rel="noopener noreferrer">
            公式データ
          </a>
        </span>
      </footer>
    </body>
  </html>
);

const StationScene = () => (
  <div class="station-scene" aria-hidden="true">
    <div class="roof">
      <i />
      <i />
      <i />
      <i />
    </div>
    <div class="train">
      <span />
      <span />
      <span />
      <b>2024</b>
    </div>
    <div class="platform">
      <span>新宿</span>
      <i>SHINJUKU</i>
    </div>
    <div class="gates">
      <span />
      <span />
      <span />
      <span />
    </div>
    <div class="passenger-board">
      <small>1日平均</small>
      <strong>1,333,618</strong>
      <i>人</i>
    </div>
    <div class="year-rail">
      {[44, 48, 49, 21, 29, 38, 46].map((height, index) => (
        <span style={`height:${height}px`}>
          <i>{2018 + index}</i>
        </span>
      ))}
    </div>
  </div>
);

const HomePage = () => (
  <Layout
    canonical={`${origin}/`}
    description="全国7,739の駅別乗降客数を駅名・事業者・路線から探し、2011〜2024年度の推移を最大4件で比較できます。"
    title="駅の1日平均乗降客数を14年で比較 | 駅乗降くらべ"
  >
    <main class="home" id="main">
      <section class="intro" aria-labelledby="product-title">
        <div class="product-heading">
          <p class="eyebrow">STATION PASSENGERS 2011—2024</p>
          <h1 id="product-title">駅を探す。14年を同じホームで比べる。</h1>
          <p>駅名・事業者・路線から公表値を探し、1日平均乗降客数の変化を年ごとに並べられます。</p>
          <div class="facts">
            <span>
              <strong>7,739</strong>
              <small>2024年度 公表単位</small>
            </span>
            <span>
              <strong>14</strong>
              <small>収録年度</small>
            </span>
            <span>
              <strong>全国</strong>
              <small>鉄道事業者</small>
            </span>
          </div>
        </div>
        <StationScene />
      </section>
      <div class="meaning-ribbon">
        <strong>2024年度値・2026年4月更新</strong>
        <span>駅全体の単純合計ではなく、事業者が提供した公表単位で表示します。</span>
        <a href="/guide">比べ方を確認</a>
      </div>
      <section class="search-desk" aria-labelledby="search-heading">
        <header class="section-heading">
          <div>
            <p>乗降台帳</p>
            <h2 id="search-heading">駅名・事業者・路線で探す</h2>
          </div>
          <output id="data-status">全国データを準備しています…</output>
        </header>
        <label class="station-search" for="station-search">
          <span>検索する</span>
          <span class="search-box">
            <i aria-hidden="true">⌕</i>
            <input
              autocomplete="off"
              disabled
              id="station-search"
              placeholder="一覧を準備しています"
              type="search"
            />
            <button disabled id="clear-search" type="button">
              消す
            </button>
          </span>
        </label>
        <fieldset class="type-filter" disabled id="type-filter">
          <legend>事業者種別</legend>
          <div>
            <button aria-pressed="true" data-type="all" type="button">
              すべて
            </button>
            {operatorTypes.map(([code, name, count]) => (
              <button aria-pressed="false" data-type={code} type="button">
                <span>{name}</span>
                <small>{count.toLocaleString("ja-JP")}</small>
              </button>
            ))}
          </div>
        </fieldset>
        <p class="privacy-note">
          入力した駅名・事業者名・路線名はこの端末内で照合し、送信・保存しません。
        </p>
      </section>
      <section class="result-and-compare">
        <section class="station-results" aria-labelledby="result-heading">
          <header class="result-heading">
            <div>
              <p>駅票</p>
              <h2 id="result-heading">見つかった公表値</h2>
            </div>
            <output id="result-count">準備中</output>
          </header>
          <p id="search-status" role="status">
            公式データを開いています…
          </p>
          <div class="station-list" id="station-list">
            <div class="empty-platform" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
          <button class="load-more" hidden id="load-more" type="button">
            次の30件を見る
          </button>
        </section>
        <aside class="compare-tray" aria-labelledby="compare-heading">
          <header>
            <div>
              <p>見比べる</p>
              <h2 id="compare-heading">4つのホーム</h2>
            </div>
            <output id="compared-count">0 / 4</output>
          </header>
          <div id="compared-items">
            <p>駅票の「比べる」を押すと、最大4つの公表単位を同じホームに置けます。</p>
          </div>
          <div class="compare-actions">
            <button disabled id="copy-compared" type="button">
              比較をまとめてコピー
            </button>
            <button class="clear-button" disabled id="clear-compared" type="button">
              ホームを空にする
            </button>
          </div>
        </aside>
      </section>
    </main>
  </Layout>
);

const GuidePage = () => (
  <Layout
    canonical={`${origin}/guide`}
    description="駅別乗降客数の公表単位、年度、推移、欠損と比較の見方。"
    title="乗降客数の見方 | 駅乗降くらべ"
  >
    <main class="content-page" id="main">
      <header class="content-heading">
        <span>読</span>
        <div>
          <p>見方</p>
          <h1>同じ駅名でも、事業者ごとの公表値を読む</h1>
        </div>
      </header>
      <div class="instruction-grid">
        <section>
          <b>一</b>
          <h2>駅を探す</h2>
          <p>
            駅名、事業者、代表路線から検索します。同じ駅でもJR、私鉄、地下鉄は別の駅票になります。
          </p>
        </section>
        <section>
          <b>二</b>
          <h2>含む路線を確認</h2>
          <p>
            公表値が複数路線を含む場合は、公式備考を駅票に表示します。路線名だけで合計範囲を決めません。
          </p>
        </section>
        <section>
          <b>三</b>
          <h2>同じ年を比べる</h2>
          <p>2024年度の1日平均と2011年度からの推移を確認します。欠けた年を0人として扱いません。</p>
        </section>
      </div>
      <div class="passenger-anatomy">
        <span>
          <small>統計年度</small>
          <b>2024</b>
        </span>
        <i>×</i>
        <span>
          <small>単位</small>
          <b>人 / 日</b>
        </span>
        <i>↔</i>
        <span>
          <small>収録</small>
          <b>14年</b>
        </span>
      </div>
      <aside class="care-note">
        <strong>事業者をまたいだ駅全体合計ではありません</strong>
        <p>
          事業者ごとに算出方法が異なり、相互直通や乗換を含む範囲も備考で変わります。別事業者の値を足すと二重計上になる場合があります。
        </p>
      </aside>
      <a class="page-cta" href="/">
        駅を探す
      </a>
    </main>
  </Layout>
);
const SourcePage = () => (
  <Layout
    canonical={`${origin}/source`}
    description="国土数値情報の2024年度駅別乗降客数、収録範囲、加工、ライセンスと注意事項。"
    title="出典とデータ | 駅乗降くらべ"
  >
    <main class="content-page" id="main">
      <header class="content-heading">
        <span>典</span>
        <div>
          <p>出典とデータ</p>
          <h1>全国の公式公表値を、14年の駅票へ</h1>
        </div>
      </header>
      <div class="source-grid">
        <section>
          <h2>出典</h2>
          <p>
            国土交通省「
            <a href={official} rel="noopener noreferrer">
              国土数値情報 駅別乗降客数データ（2024年度）
            </a>
            」の全国GeoJSONを使用します。原典は鉄道事業者提供資料です。
          </p>
        </section>
        <section>
          <h2>収録範囲</h2>
          <p>
            10,534路線形状から、2024年度に公表値を持つ重複代表7,739件を収録。2011〜2024年度の値を欠損と0人を分けて表示します。
          </p>
        </section>
        <section>
          <h2>表示の加工</h2>
          <p>
            駅コード、駅名、事業者、代表路線、公式備考、各年度値を抽出し、現在の公表単位に沿って過去値を接続します。別事業者の値は合算しません。
          </p>
        </section>
        <section>
          <h2>利用条件</h2>
          <p>
            <a href="https://creativecommons.org/licenses/by/4.0/deed.ja" rel="noopener noreferrer">
              CC BY 4.0
            </a>
            に従い出典と加工を表示します。国土交通省や鉄道事業者による保証・推奨を示しません。
          </p>
        </section>
      </div>
      <dl class="source-ledger">
        <div>
          <dt>取得日</dt>
          <dd>2026年8月2日</dd>
        </div>
        <div>
          <dt>更新</dt>
          <dd>2026年4月</dd>
        </div>
        <div>
          <dt>ZIP</dt>
          <dd>6,913,743 bytes</dd>
        </div>
        <div>
          <dt>SHA-256</dt>
          <dd>
            <code>0785e932a32b3ec15e1a1345537ae145eafe1c07bf38d5c16c11ee2b391e7a28</code>
          </dd>
        </div>
      </dl>
      <aside class="care-note warning">
        <strong>比較できない値を作らない</strong>
        <p>
          各事業者の算出方法は統一されず、一部の駅はデータなし・非公開です。欠けた年度を0人で補わず、駅全体の合計や将来予測も推計しません。
        </p>
      </aside>
    </main>
  </Layout>
);
const PrivacyPage = () => (
  <Layout
    canonical={`${origin}/privacy`}
    description="駅乗降くらべの検索語、比較駅票、匿名利用計測の保存範囲。"
    title="保存と計測 | 駅乗降くらべ"
  >
    <main class="content-page" id="main">
      <header class="content-heading">
        <span>守</span>
        <div>
          <p>保存と計測</p>
          <h1>検索語は端末内。残すのは公開駅票だけ。</h1>
        </div>
      </header>
      <div class="privacy-grid">
        <section>
          <h2>検索条件</h2>
          <p>駅名、事業者名、路線名、種別はブラウザ内だけで処理し、計測へ送りません。</p>
        </section>
        <section>
          <h2>4つのホーム</h2>
          <p>
            選んだ公開駅票を最大4件、ブラウザのローカルストレージへ保存します。画面からいつでも消せます。
          </p>
        </section>
        <section>
          <h2>匿名の利用計測</h2>
          <p>
            訪問、検索、種別変更、比較、コピーなどの操作名と匿名化したセッションだけを35日間保存します。駅名や駅コードは記録しません。
          </p>
        </section>
        <section>
          <h2>アカウント</h2>
          <p>
            登録、ログイン、個人識別Cookieはありません。拒否信号と自動テストを実利用から分けます。
          </p>
        </section>
      </div>
    </main>
  </Layout>
);

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
app.use("*", requestId());
app.use("*", async (c, next) => {
  await next();
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
  );
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Resource-Policy", "same-origin");
  c.header("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-Request-Id", c.get("requestId"));
});
app.get("/", (c) => {
  c.header("Cache-Control", "public,max-age=60,s-maxage=300");
  return c.html(<HomePage />);
});
app.get("/guide", (c) => c.html(<GuidePage />));
app.get("/source", (c) => c.html(<SourcePage />));
app.get("/privacy", (c) => c.html(<PrivacyPage />));
app.post("/api/telemetry", async (c) => {
  sameOrigin(c);
  const payload = await parseJson(c);
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new ApiError("invalid_request", 400);
  const name =
    typeof (payload as Record<string, unknown>).name === "string"
      ? (payload as Record<string, string>).name
      : "";
  if (!eventNames.has(name)) throw new ApiError("invalid_event", 400);
  await record(c, name);
  return c.body(null, 202);
});
app.get("/health", async (c) => {
  const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return c.json({ dataYear: 2024, ok: row?.ok === 1, service: "eki-joko", units: 7739, years: 14 });
});
app.get("/sitemap.xml", (c) => {
  const paths = ["/", "/guide", "/source", "/privacy"];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("")}</urlset>`;
  c.header("Cache-Control", "public,max-age=300,s-maxage=300");
  c.header("Content-Type", "application/xml; charset=utf-8");
  return c.body(xml);
});
app.notFound((c) => {
  c.status(404);
  return c.html(
    <Layout
      canonical={`${origin}/404`}
      description="指定されたページは見つかりません。"
      noindex
      title="ページが見つかりません | 駅乗降くらべ"
    >
      <main class="not-found" id="main">
        <span>404</span>
        <h1>この駅票は見つかりません</h1>
        <p>駅を探す画面へ戻ってください。</p>
        <a href="/">駅を探す</a>
      </main>
    </Layout>,
  );
});
app.onError((error, c) => {
  if (error instanceof ApiError)
    return c.json({ error: error.code, requestId: c.get("requestId") }, error.status);
  console.error(
    "request_failed",
    c.get("requestId"),
    error instanceof Error ? error.message : "unknown",
  );
  return c.json({ error: "internal_error", requestId: c.get("requestId") }, 500);
});
export const scheduled = async (_event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) => {
  await env.DB.prepare("DELETE FROM product_events WHERE created_at < ?")
    .bind(nowSeconds() - 35 * 86400)
    .run();
};
export { app };
export default { fetch: app.fetch, scheduled };
