import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { unzipSync } from "fflate";

const DOWNLOAD = "https://nlftp.mlit.go.jp/ksj/gml/data/S12/S12-25/S12-25_GML.zip";
const SOURCE_PAGE = "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-S12-2024.html";
const EXPECTED_BYTES = 6_913_743;
const EXPECTED_SHA256 = "0785e932a32b3ec15e1a1345537ae145eafe1c07bf38d5c16c11ee2b391e7a28";
const EXPECTED_FEATURES = 10_534;
const EXPECTED_PUBLIC = 7_739;
const years = Array.from({ length: 14 }, (_, index) => 2011 + index);
const propertyKey = (offset, year) => `S12_${String(offset + (year - 2011) * 4).padStart(3, "0")}`;
const clean = (value) =>
  String(value ?? "")
    .replace(/[\u3000\s]+/gu, " ")
    .trim();
const midpoint = (coordinates) => {
  const points = coordinates.flat(Infinity).filter((value) => typeof value === "number");
  if (points.length < 2) throw new Error("Invalid station geometry");
  const pairs = [];
  for (let index = 0; index < points.length; index += 2)
    pairs.push([points[index], points[index + 1]]);
  const center = pairs[Math.floor(pairs.length / 2)];
  return [Math.round(center[0] * 1e6) / 1e6, Math.round(center[1] * 1e6) / 1e6];
};
const valueFor = (feature, year) => {
  const properties = feature.properties;
  if (properties[propertyKey(6, year)] !== 1 || properties[propertyKey(7, year)] !== 1) return null;
  const value = Number(properties[propertyKey(9, year)]);
  return value > 0 ? value : null;
};

const response = await fetch(DOWNLOAD, { headers: { "user-agent": "eki-joko-data-builder/0.1" } });
if (!response.ok) throw new Error(`Download failed: ${response.status}`);
const archive = new Uint8Array(await response.arrayBuffer());
const sha256 = createHash("sha256").update(archive).digest("hex");
if (archive.byteLength !== EXPECTED_BYTES)
  throw new Error(`Unexpected archive size: ${archive.byteLength}`);
if (sha256 !== EXPECTED_SHA256) throw new Error(`Unexpected archive hash: ${sha256}`);
const entries = unzipSync(archive, {
  filter: (entry) => entry.name.endsWith("UTF-8/S12-25_NumberOfPassengers.geojson"),
});
const sourceEntry = Object.entries(entries)[0];
if (!sourceEntry) throw new Error("UTF-8 GeoJSON was not found in the official archive");
const geojson = JSON.parse(new TextDecoder().decode(sourceEntry[1]));
if (geojson.type !== "FeatureCollection" || geojson.features.length !== EXPECTED_FEATURES)
  throw new Error(`Unexpected feature count: ${geojson.features?.length}`);

const companyGroups = new Map();
for (const feature of geojson.features) {
  const properties = feature.properties;
  const key = `${properties.S12_001g}\0${properties.S12_002}`;
  if (!companyGroups.has(key)) companyGroups.set(key, []);
  companyGroups.get(key).push(feature);
}

const representatives = geojson.features.filter((feature) => feature.properties.S12_058 === 1);
const publicFeatures = representatives.filter(
  (feature) => feature.properties.S12_059 === 1 && feature.properties.S12_061 > 0,
);
if (publicFeatures.length !== EXPECTED_PUBLIC)
  throw new Error(`Unexpected public unit count: ${publicFeatures.length}`);
const currentCounts = new Map();
for (const feature of publicFeatures) {
  const properties = feature.properties;
  const key = `${properties.S12_001g}\0${properties.S12_002}`;
  currentCounts.set(key, (currentCounts.get(key) ?? 0) + 1);
}

const ids = new Set();
const items = publicFeatures
  .map((feature) => {
    const properties = feature.properties;
    const groupKey = `${properties.S12_001g}\0${properties.S12_002}`;
    const group = companyGroups.get(groupKey);
    const multiUnit = currentCounts.get(groupKey) > 1;
    const values = years.map((year) => {
      if (multiUnit) return valueFor(feature, year);
      const candidates = group
        .map((candidate) => valueFor(candidate, year))
        .filter((value) => value !== null);
      return candidates.length === 1 ? candidates[0] : valueFor(feature, year);
    });
    const [longitude, latitude] = midpoint(feature.geometry.coordinates);
    const sourceIdentity = `${properties.S12_001c}\0${properties.S12_002}\0${properties.S12_003}`;
    const id = createHash("sha256").update(sourceIdentity).digest("hex").slice(0, 12);
    if (ids.has(id)) throw new Error(`Duplicate derived id: ${id}`);
    ids.add(id);
    const item = {
      i: id,
      c: clean(properties.S12_001c),
      g: clean(properties.S12_001g),
      n: clean(properties.S12_001),
      o: clean(properties.S12_002),
      l: clean(properties.S12_003),
      t: Number(properties.S12_005),
      k: Number(properties.S12_004),
      x: clean(properties.S12_060),
      v: values,
      la: latitude,
      lo: longitude,
    };
    if (
      !item.n ||
      !item.o ||
      !item.l ||
      item.v[13] !== Number(properties.S12_061) ||
      latitude < 20 ||
      latitude > 50 ||
      longitude < 120 ||
      longitude > 155
    )
      throw new Error(`Invalid public unit: ${id}`);
    return item;
  })
  .toSorted((a, b) => b.v[13] - a.v[13] || a.n.localeCompare(b.n, "ja"));

const find = (name, operator) => items.find((item) => item.n === name && item.o === operator);
if (find("新宿", "東日本旅客鉄道")?.v[13] !== 1_333_618)
  throw new Error("Known Shinjuku JR value mismatch");
if (find("渋谷", "東急電鉄")?.v[13] !== 1_770_430)
  throw new Error("Known Shibuya Tokyu value mismatch");
if (find("大阪", "西日本旅客鉄道")?.v[13] !== 751_006)
  throw new Error("Known Osaka JR value mismatch");

const typeNames = { 1: "JR新幹線", 2: "JR在来線", 3: "公営鉄道", 4: "民営鉄道", 5: "第三セクター" };
const index = {
  dataYear: 2024,
  updatedAt: "2026-04",
  years,
  count: items.length,
  features: EXPECTED_FEATURES,
  representatives: representatives.length,
  noData: representatives.filter((feature) => feature.properties.S12_059 === 2).length,
  complete14Years: items.filter((item) => item.v.every((value) => value !== null)).length,
  types: Object.entries(typeNames).map(([code, name]) => ({
    code: Number(code),
    name,
    count: items.filter((item) => item.t === Number(code)).length,
  })),
  source: {
    title: "国土数値情報 駅別乗降客数データ（2024年度）",
    sourcePage: SOURCE_PAGE,
    download: DOWNLOAD,
    retrievedAt: "2026-08-02",
    bytes: EXPECTED_BYTES,
    sha256,
    license: "CC BY 4.0",
    coordinateSystem: "JGD2011",
  },
};
const output = resolve(process.cwd(), "public", "data");
await mkdir(output, { recursive: true });
const indexJson = JSON.stringify(index, null, 2).replace(
  /"years": \[\s+([\d,\s]+)\s+\]/,
  (_match, years) => `"years": [${years.replace(/\s+/g, " ").trim()}]`,
);
await writeFile(resolve(output, "index.json"), `${indexJson}\n`, "utf8");
await writeFile(
  resolve(output, "stations.ndjson"),
  `${items.map((item) => JSON.stringify(item)).join("\n")}\n`,
  "utf8",
);
console.log(
  `Built ${items.length.toLocaleString("ja-JP")} public units from ${EXPECTED_FEATURES.toLocaleString("ja-JP")} features (${sha256})`,
);
