# Decisions

## Compare reported units, not invented station totals

Operators publish different scopes and may include connected routes in one value. The product keeps operator units separate and shows the official note. It never adds values across operators.

## Preserve missing years

A missing, absent, or unpublished year is not zero passengers. Annual series use `null`, and charts render a distinct short dashed mark.

## Search one compact national file

The 7,739 units fit in a 1.8 MB NDJSON file before transport compression. One national browser index lets station, operator, and route searches work immediately without sending queries.

## No authentication

The comparison tray stores four public records locally. Accounts would add friction and private-data handling without improving the core task.
