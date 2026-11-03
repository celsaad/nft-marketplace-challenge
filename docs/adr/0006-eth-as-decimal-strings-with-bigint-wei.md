# ETH amounts are decimal strings, calculated as bigint wei

Every ETH amount crosses the API as a decimal string. All arithmetic converts to `bigint` wei (18 decimals), computes there, and formats back to a string. A JavaScript `number` is never used for money. We wrote a small home-grown module instead of using `big.js` or `decimal.js`: ETH only needs fixed-point integer math, and the module adds no bundle weight and is fully covered by unit tests. The Quote returned by the API is still the authority for totals; client calculations only drive the display between Quotes.
