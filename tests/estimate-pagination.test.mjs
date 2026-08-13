import assert from "node:assert/strict";
import test from "node:test";

import { paginateEstimateLines } from "../lib/estimate-pagination.ts";

for (const count of [0, 1, 20, 21, 28, 29, 59, 60, 61, 96, 97, 250]) {
  test(`paginates ${count} estimate lines without loss, duplication, or totals-only pages`, () => {
    const input = Array.from({ length: count }, (_, index) => index);
    const pages = paginateEstimateLines(input);
    assert.deepEqual(pages.flat(), input);
    assert.equal(new Set(pages.flat()).size, count);
    assert.ok(pages.every((page) => page.length > 0 || count === 0));
    assert.ok(pages.at(-1).length > 0 || count === 0);
    assert.ok(pages.at(-1).length <= (pages.length === 1 ? 20 : 32));
  });
}

test("preserves every product across all boundary sizes through 500 lines", () => {
  for (let count = 0; count <= 500; count++) {
    const input = Array.from({ length: count }, (_, index) => index);
    const pages = paginateEstimateLines(input);
    assert.deepEqual(pages.flat(), input, `line sequence changed at ${count}`);
    assert.ok(pages.every((page) => page.length > 0 || count === 0), `empty page at ${count}`);
    assert.ok(pages.at(-1).length > 0 || count === 0, `totals-only page at ${count}`);
    assert.ok(pages.at(-1).length <= (pages.length === 1 ? 20 : 32), `last page overflow at ${count}`);
  }
});
