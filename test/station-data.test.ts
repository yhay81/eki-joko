import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
type Unit = {
  i: string;
  c: string;
  g: string;
  n: string;
  o: string;
  l: string;
  t: number;
  k: number;
  x: string;
  v: Array<number | null>;
  la: number;
  lo: number;
};
const root = process.cwd();
const index = JSON.parse(readFileSync(resolve(root, "public/data/index.json"), "utf8"));
const units = readFileSync(resolve(root, "public/data/stations.ndjson"), "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as Unit);
const find = (name: string, operator: string) =>
  units.find((unit) => unit.n === name && unit.o === operator);
describe("official 2024 station passenger data", () => {
  it("retains verified source metadata and dimensions", () => {
    expect(index).toMatchObject({
      count: 7739,
      dataYear: 2024,
      features: 10534,
      representatives: 9396,
      noData: 1626,
      complete14Years: 6138,
      updatedAt: "2026-04",
    });
    expect(index.years).toEqual([
      2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024,
    ]);
    expect(index.source).toMatchObject({
      bytes: 6913743,
      license: "CC BY 4.0",
      sha256: "0785e932a32b3ec15e1a1345537ae145eafe1c07bf38d5c16c11ee2b391e7a28",
    });
  });
  it("contains 7,739 unique current public units", () => {
    expect(units).toHaveLength(7739);
    expect(new Set(units.map((unit) => unit.i)).size).toBe(7739);
    expect(
      index.types
        .map((type: { count: number }) => type.count)
        .reduce((sum: number, count: number) => sum + count, 0),
    ).toBe(7739);
  });
  it("retains known operator-specific station values", () => {
    expect(find("新宿", "東日本旅客鉄道")).toMatchObject({
      l: "中央線",
      v: expect.arrayContaining([1333618]),
    });
    expect(find("新宿", "東日本旅客鉄道")?.v[13]).toBe(1333618);
    expect(find("渋谷", "東急電鉄")?.v[13]).toBe(1770430);
    expect(find("大阪", "西日本旅客鉄道")?.v[13]).toBe(751006);
  });
  it("preserves compact records, missing years, and delivery budget", () => {
    expect(statSync(resolve(root, "public/data/stations.ndjson")).size).toBeLessThan(2200000);
    expect(units.some((unit) => unit.v.includes(null))).toBe(true);
    for (const unit of units) {
      expect(Object.keys(unit).sort()).toEqual([
        "c",
        "g",
        "i",
        "k",
        "l",
        "la",
        "lo",
        "n",
        "o",
        "t",
        "v",
        "x",
      ]);
      expect(unit.i).toMatch(/^[0-9a-f]{12}$/u);
      expect(unit.v).toHaveLength(14);
      expect(unit.v[13]).toBeGreaterThan(0);
      expect(unit.la).toBeGreaterThan(20);
      expect(unit.lo).toBeGreaterThan(120);
    }
  });
});
