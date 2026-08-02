# Source and transformation

## Official source

- Publisher: 国土交通省
- Dataset: 国土数値情報 駅別乗降客数データ（2024年度）
- Source page: <https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-S12-2024.html>
- Download: <https://nlftp.mlit.go.jp/ksj/gml/data/S12/S12-25/S12-25_GML.zip>
- Updated: 2026-04
- Retrieved: 2026-08-02
- Archive: 6,913,743 bytes
- SHA-256: `0785e932a32b3ec15e1a1345537ae145eafe1c07bf38d5c16c11ee2b391e7a28`

## Dimensions

The official nationwide GeoJSON contains 10,534 line features. Of 9,396 current duplicate representatives, 7,739 have a positive, available 2024 passenger value and are exposed as searchable public units. 1,626 current representatives are explicitly data-absent. The product retains 2011–2024 values, and 6,138 units have all fourteen years after deterministic representative continuity.

## Transformation / 加工

The generator verifies the archive byte length and SHA-256 and extracts only the official UTF-8 GeoJSON. A current public unit must have 2024 duplicate code 1 (recorded on this line), data-availability code 1, and a positive passenger value. Each unit retains station and group codes, station name, operator, representative route, operator and railway types, official 2024 note, coordinates, and fourteen annual values.

When one current public unit exists for a station-group/operator pair, its history follows the unique annual duplicate representative within that same pair, preserving continuity through representative-line changes. The eleven group/operator pairs with multiple independent current units retain feature-level histories. Missing or unavailable years remain `null`; they are never converted to zero. Values from different operators are never summed.

Known 2024 values verify JR East Shinjuku (1,333,618), Tokyu Shibuya (1,770,430), and JR West Osaka (751,006) passengers per day.

## License and interpretation boundary

The current edition is provided under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.ja). Attribution and transformation are disclosed; no official endorsement or warranty is implied.

Values originate from railway operators and are not calculated under one uniform method. Notes may include other lines or operators. Some stations are absent or unpublished. The product compares disclosed units; it does not estimate whole-station totals, unique persons, transfers, future demand, congestion, or revenue.
