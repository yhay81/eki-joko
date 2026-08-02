import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
describe("product surface", () => {
  const worker = read("src/worker.tsx");
  const client = read("public/app.js");
  const css = read("public/styles.css");
  const migration = read("migrations/0001_telemetry.sql");
  const source = read("SOURCE.md");
  const surface = `${worker}\n${client}`;
  it("communicates through a train, platform, gates, annual rail, station cards, and four platforms", () => {
    expect(worker).toContain('class="station-scene"');
    expect(worker).toContain('class="train"');
    expect(worker).toContain('class="gates"');
    expect(worker).toContain('class="year-rail"');
    expect(worker).toContain('class="compare-tray"');
    expect(client).toContain('element("article", "station-card")');
    expect(client).toContain('element("article", "compared-row")');
    expect(css.toLowerCase()).not.toContain("gradient");
  });
  it("keeps station searches and compared public units in the browser", () => {
    expect(worker).toContain('app.post("/api/telemetry"');
    expect(worker).not.toContain('app.post("/api/search"');
    expect(client).toContain('fetch("/data/stations.ndjson")');
    expect(client).toContain("localStorage");
    expect(client).toContain("state.compared.length < MAX_COMPARE");
    expect(client).toContain("slice(0, MAX_COMPARE)");
    expect(migration).not.toMatch(
      /station_(?:name|code)|operator|route|coordinates|query|search_term|email|phone/iu,
    );
    expect(client).not.toMatch(/history\.(?:pushState|replaceState)|location\.search\s*=/u);
  });
  it("keeps operators separate, missing years distinct, and links official definitions", () => {
    expect(worker).toContain("駅全体の単純合計ではなく");
    expect(worker).toContain("別事業者の値を足すと二重計上");
    expect(client).toContain('value === null ? "5px"');
    expect(client).toContain("nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-S12-2024.html");
    expect(client).not.toContain("innerHTML");
    expect(worker).not.toContain("dangerouslySetInnerHTML");
  });
  it("states year, dimensions, terms, transformation, and interpretation boundary", () => {
    expect(source).toContain("2024年度");
    expect(source).toContain("7,739");
    expect(source).toContain("CC BY 4.0");
    expect(source).toContain("Transformation / 加工");
    expect(source).toContain("does not estimate whole-station totals");
  });
  it("separates automated QA, honors privacy signals, and needs no account", () => {
    expect(client).toContain("navigator.webdriver");
    expect(client).toContain("navigator.doNotTrack");
    expect(client).toContain("globalPrivacyControl");
    expect(client).toContain('"x-eki-joko-qa"');
    expect(migration).toContain("is_qa");
    expect(surface).not.toMatch(/better-auth|betterAuth/iu);
  });
  it("contains no internal evaluation language", () => {
    expect(surface).not.toMatch(
      /public validation|success criteria|experiment|仮説|成功条件|市場スコア|移行候補|収益性/iu,
    );
  });
});
