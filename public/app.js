// @ts-check
/** @typedef {{i:string,c:string,g:string,n:string,o:string,l:string,t:number,k:number,x:string,v:(number|null)[],la:number,lo:number}} StationUnit */
/** @typedef {{count:number,dataYear:number,years:number[],types:Array<{code:number,name:string,count:number}>}} DataIndex */

const YEARS = Array.from({ length: 14 }, (_, index) => 2011 + index);
const OFFICIAL_URL = "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-S12-2024.html";
const STORAGE_KEY = "eki-joko-compared-v1";
const SESSION_KEY = "eki-joko-session-v1";
const MAX_COMPARE = 4;
const PAGE_SIZE = 30;
const number = new Intl.NumberFormat("ja-JP");
/** @param {string} id */ const byId = (id) => document.getElementById(id);
/** @param {keyof HTMLElementTagNameMap} tag @param {string} className @param {string} [text] */
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
/** @param {Element} parent @param {(Node|string)[]} children */ const append = (
  parent,
  ...children
) => parent.append(...children);
const normalize = (value) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP")
    .replace(/[\s\-‐―ー・()（）号線]+/gu, "");
const passengers = (value) => `${number.format(value)}人 / 日`;
const changeFrom = (item, year) => {
  const base = item.v[year - 2011];
  const latest = item.v[13];
  return base && latest ? (latest / base - 1) * 100 : null;
};
const changeText = (value) =>
  value === null ? "比較できません" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
const changeClass = (value) =>
  value === null || Math.abs(value) < 0.05 ? "flat" : value > 0 ? "up" : "down";
const typeNames = new Map([
  [1, "JR新幹線"],
  [2, "JR在来線"],
  [3, "公営鉄道"],
  [4, "民営鉄道"],
  [5, "第三セクター"],
]);

const loadCompared = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed
          .filter((item) => item && typeof item.i === "string" && Array.isArray(item.v))
          .slice(0, MAX_COMPARE)
      : [];
  } catch {
    return [];
  }
};
const state = {
  /** @type {DataIndex|null} */ index: null,
  /** @type {StationUnit[]} */ items: [],
  /** @type {StationUnit[]} */ compared: loadCompared(),
  query: "",
  type: "all",
  visible: PAGE_SIZE,
};
const qa = navigator.webdriver;
const privacyOptOut =
  navigator.doNotTrack === "1" ||
  /** @type {Navigator & {globalPrivacyControl?:boolean}} */ (navigator).globalPrivacyControl ===
    true;
let session = sessionStorage.getItem(SESSION_KEY);
if (!session) {
  session = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, session);
}
/** @param {string} name */ const emit = (name) => {
  if (privacyOptOut) return;
  void fetch("/api/telemetry", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-eki-joko-session": session ?? "",
      "x-eki-joko-qa": qa ? "1" : "0",
    },
    body: JSON.stringify({ name }),
    keepalive: true,
  }).catch(() => undefined);
};
const setPressed = (selector, key, value) =>
  document
    .querySelectorAll(selector)
    .forEach((button) =>
      button.setAttribute("aria-pressed", button.getAttribute(key) === value ? "true" : "false"),
    );
const filteredItems = () => {
  const needle = normalize(state.query);
  return state.items.filter(
    (item) =>
      (state.type === "all" || String(item.t) === state.type) &&
      (!needle || normalize([item.n, item.o, item.l, item.x, item.c].join(" ")).includes(needle)),
  );
};

/** @param {StationUnit} item @param {boolean} [compact] */
const trend = (item, compact = false) => {
  const chart = element("div", compact ? "trend compact" : "trend");
  const available = item.v.filter((value) => value !== null);
  const max = Math.max(...available);
  item.v.forEach((value, index) => {
    const bar = element("span", value === null ? "missing" : "");
    bar.style.height =
      value === null ? "5px" : `${Math.max(8, Math.round((value / max) * (compact ? 36 : 56)))}px`;
    bar.title =
      value === null
        ? `${YEARS[index]}年度 データなし`
        : `${YEARS[index]}年度 ${number.format(value)}人/日`;
    const label = element(
      "i",
      "",
      index === 0 || index === 8 || index === 13 ? String(YEARS[index]) : "",
    );
    bar.append(label);
    chart.append(bar);
  });
  return chart;
};
/** @param {StationUnit} item */
const summary = (item) => {
  const lines = [`${item.n}駅｜${item.o}｜${item.l}`, `2024年度 ${passengers(item.v[13])}`];
  const from2019 = changeFrom(item, 2019);
  if (from2019 !== null) lines.push(`2019年度比 ${changeText(from2019)}`);
  if (item.x) lines.push(`備考 ${item.x}`);
  lines.push(`駅コード ${item.c}`);
  return lines.join("\n");
};
/** @param {string} value @param {HTMLButtonElement} button */
const copyText = async (value, button) => {
  const before = button.textContent;
  try {
    await navigator.clipboard.writeText(value);
    button.textContent = "コピーしました";
    emit("copied");
  } catch {
    button.textContent = "コピーできませんでした";
  }
  window.setTimeout(() => {
    button.textContent = before;
  }, 1600);
};
const saveCompared = () =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.compared.slice(0, MAX_COMPARE)));
/** @param {StationUnit} item */
const toggleCompared = (item) => {
  const index = state.compared.findIndex((entry) => entry.i === item.i);
  if (index >= 0) state.compared.splice(index, 1);
  else if (state.compared.length < MAX_COMPARE) {
    state.compared.push(item);
    emit("compared");
  }
  saveCompared();
  renderCompared();
  renderResults();
};

/** @param {StationUnit} item */
const resultCard = (item) => {
  const card = element("article", "station-card");
  const selected = state.compared.some((entry) => entry.i === item.i);
  const heading = element("header", "station-card-heading");
  const identity = element("div", "station-identity");
  append(
    identity,
    element("span", "operator-type", typeNames.get(item.t) ?? "鉄道"),
    element("h3", "", `${item.n}駅`),
    element("p", "", `${item.o}｜${item.l}`),
  );
  const value = element("div", "passenger-stake");
  const from2019 = changeFrom(item, 2019);
  append(
    value,
    element("small", "", "2024年度 1日平均"),
    element("strong", "", number.format(item.v[13])),
    element("em", changeClass(from2019), `2019比 ${changeText(from2019)}`),
  );
  append(heading, identity, value);
  const chartWrap = element("div", "trend-wrap");
  append(chartWrap, trend(item), element("small", "", "棒に触れると各年度値を確認できます"));
  const note = element(
    "p",
    item.x ? "official-note" : "official-note quiet",
    item.x ? `公表範囲：${item.x}` : "この公表単位に追加の公式備考はありません。",
  );
  const actions = element("div", "card-actions");
  const compare = /** @type {HTMLButtonElement} */ (
    element("button", selected ? "selected" : "", selected ? "比較から外す" : "比べる")
  );
  compare.type = "button";
  compare.disabled = !selected && state.compared.length >= MAX_COMPARE;
  compare.addEventListener("click", () => toggleCompared(item));
  const copy = /** @type {HTMLButtonElement} */ (element("button", "copy-unit", "駅票をコピー"));
  copy.type = "button";
  copy.addEventListener("click", () => void copyText(summary(item), copy));
  const link = element("a", "official-link", "公式データの定義を見る");
  link.setAttribute("href", OFFICIAL_URL);
  link.setAttribute("rel", "noopener noreferrer");
  link.addEventListener("click", () => emit("official_opened"));
  append(actions, compare, copy, link);
  append(card, heading, chartWrap, note, actions);
  return card;
};

const renderResults = () => {
  const list = byId("station-list");
  const count = byId("result-count");
  const status = byId("search-status");
  const loadMore = /** @type {HTMLButtonElement|null} */ (byId("load-more"));
  if (!list || !count || !status || !loadMore) return;
  list.replaceChildren();
  const filtered = filteredItems();
  count.textContent = `${number.format(filtered.length)}件`;
  status.textContent =
    state.query || state.type !== "all"
      ? `全国${number.format(state.items.length)}件から絞り込みました。`
      : "2024年度の1日平均が多い順に表示しています。";
  if (!filtered.length) {
    const empty = element("div", "no-results");
    append(
      empty,
      element("strong", "", "一致する公表値がありません"),
      element("p", "", "「駅」を外す、事業者名を短くする、種別をすべてに戻す、を試してください。"),
    );
    list.append(empty);
  } else filtered.slice(0, state.visible).forEach((item) => list.append(resultCard(item)));
  loadMore.hidden = filtered.length <= state.visible;
};
const renderCompared = () => {
  const container = byId("compared-items");
  const count = byId("compared-count");
  const copy = /** @type {HTMLButtonElement|null} */ (byId("copy-compared"));
  const clear = /** @type {HTMLButtonElement|null} */ (byId("clear-compared"));
  if (!container || !count || !copy || !clear) return;
  container.replaceChildren();
  count.textContent = `${state.compared.length} / ${MAX_COMPARE}`;
  copy.disabled = !state.compared.length;
  clear.disabled = !state.compared.length;
  if (!state.compared.length) {
    container.append(
      element("p", "", "駅票の「比べる」を押すと、最大4つの公表単位を同じホームに置けます。"),
    );
    return;
  }
  state.compared.forEach((item, index) => {
    const row = element("article", "compared-row");
    const marker = element(
      "span",
      `compare-marker marker-${index + 1}`,
      String.fromCharCode(65 + index),
    );
    const detail = element("div", "");
    append(
      detail,
      element("strong", "", `${item.n}駅`),
      element("small", "", `${item.o}｜${item.l}`),
      element("b", "", passengers(item.v[13])),
      trend(item, true),
    );
    const remove = /** @type {HTMLButtonElement} */ (element("button", "", "外す"));
    remove.type = "button";
    remove.setAttribute("aria-label", `${item.n}駅を比較から外す`);
    remove.addEventListener("click", () => toggleCompared(item));
    append(row, marker, detail, remove);
    container.append(row);
  });
};

let searchTimer = 0;
const scheduleSearch = () => {
  window.clearTimeout(searchTimer);
  if (normalize(state.query).length < 1) return;
  searchTimer = window.setTimeout(
    () => emit(filteredItems().length ? "searched" : "no_result"),
    650,
  );
};
document.querySelectorAll("[data-type]").forEach((button) =>
  button.addEventListener("click", () => {
    state.type = button.getAttribute("data-type") ?? "all";
    state.visible = PAGE_SIZE;
    setPressed("[data-type]", "data-type", state.type);
    emit("type_changed");
    renderResults();
  }),
);
const input = /** @type {HTMLInputElement|null} */ (byId("station-search"));
input?.addEventListener("input", () => {
  state.query = input.value;
  state.visible = PAGE_SIZE;
  const clear = /** @type {HTMLButtonElement|null} */ (byId("clear-search"));
  if (clear) clear.disabled = !state.query;
  renderResults();
  scheduleSearch();
});
byId("clear-search")?.addEventListener("click", () => {
  if (input) input.value = "";
  state.query = "";
  const clear = /** @type {HTMLButtonElement|null} */ (byId("clear-search"));
  if (clear) clear.disabled = true;
  renderResults();
  input?.focus();
});
byId("load-more")?.addEventListener("click", () => {
  state.visible += PAGE_SIZE;
  renderResults();
});
byId("clear-compared")?.addEventListener("click", () => {
  state.compared = [];
  saveCompared();
  renderCompared();
  renderResults();
});
byId("copy-compared")?.addEventListener("click", (event) => {
  const button = /** @type {HTMLButtonElement} */ (event.currentTarget);
  void copyText(
    [
      "駅別乗降客数 比較（2024年度）",
      ...state.compared.flatMap((item, index) => [
        `\n${String.fromCharCode(65 + index)}. ${summary(item)}`,
      ]),
      "\n出典: 国土交通省 国土数値情報 駅別乗降客数データ",
    ].join("\n"),
    button,
  );
});
document
  .querySelectorAll(`a[href="${OFFICIAL_URL}"]`)
  .forEach((link) => link.addEventListener("click", () => emit("official_opened")));

const initialize = async () => {
  renderCompared();
  if (state.compared.length) emit("returned");
  emit("visited");
  const status = byId("data-status");
  try {
    const [indexResponse, dataResponse] = await Promise.all([
      fetch("/data/index.json"),
      fetch("/data/stations.ndjson"),
    ]);
    if (!indexResponse.ok || !dataResponse.ok) throw new Error("Data request failed");
    state.index = await indexResponse.json();
    const text = await dataResponse.text();
    state.items = text
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    if (state.index?.count !== 7739 || state.items.length !== 7739)
      throw new Error("Unexpected station count");
    if (status) status.textContent = "全国 7,739公表単位";
    if (input) {
      input.disabled = false;
      input.placeholder = "例 新宿、山手線、東急、003700…";
    }
    const clear = /** @type {HTMLButtonElement|null} */ (byId("clear-search"));
    if (clear) clear.disabled = true;
    const fieldset = /** @type {HTMLFieldSetElement|null} */ (byId("type-filter"));
    if (fieldset) fieldset.disabled = false;
    renderResults();
  } catch {
    if (status) status.textContent = "データを開けませんでした。再度お試しください。";
  }
};
void initialize();
