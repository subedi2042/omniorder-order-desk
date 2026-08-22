import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { estimateTotalsLayout, paginateEstimateLines } from "../lib/estimate-pagination.ts";

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

test("totals follow the final product row and remain clear of the footer", () => {
  for (const count of [1, 8, 20, 21, 32, 33, 60, 97, 250]) {
    const pages = paginateEstimateLines(Array.from({ length: count }, (_, index) => index));
    const finalPage = pages.at(-1);
    const firstAndOnlyPage = pages.length === 1;
    const nextRowY = (firstAndOnlyPage ? 551 : 737) - finalPage.length * 17;
    const lastDividerY = nextRowY + 10;

    for (const hasDiscount of [false, true]) {
      const totals = estimateTotalsLayout(nextRowY, hasDiscount);
      const gapAfterItems = lastDividerY - totals.subtotalY;
      assert.ok(gapAfterItems >= 17 && gapAfterItems <= 51, `totals gap is not 1-3 lines at ${count} items`);
      assert.ok(totals.totalY > 36, `totals collide with footer at ${count} items`);
    }
  }
});

test("every estimate workflow uses the shared adaptive PDF generator", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(pageSource, /Math\.ceil\([^\n]*\.length\s*\/\s*6\)/);
  assert.match(pageSource, /const linePages = paginateEstimateLines\(lines\)/);
  assert.match(pageSource, /downloadAwaitingApprovalEstimatePdf\(estimateProducts, estimateCart/);
  assert.match(pageSource, /const downloadAwaitingApproval = \(\) => \{ downloadAwaitingApprovalEstimatePdf\(/);
  assert.match(pageSource, /const download = \(\) => \{ downloadApprovedProformaPdf\(/);
  assert.match(pageSource, /createProformaPdf\(products, cart, quoteLines,[\s\S]*false, customer\)/);
  assert.match(pageSource, /createProformaPdf\(products, cart, quoteLines,[\s\S]*true, customer\)/);
});

test("new customer orders reset selections while estimate drafts persist", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const draftRoute = await readFile(new URL("../app/api/order-list-drafts/route.ts", import.meta.url), "utf8");

  assert.match(pageSource, /if \(next === "create-list" && view !== "create-list"\) resetNewOrder\(\)/);
  assert.match(pageSource, /setSelectedCustomerId\(""\); setTargetSkus\(\[\]\); setTargetQuantities\(\{\}\)/);
  assert.match(pageSource, /\/api\/order-list-drafts\?customerId=/);
  assert.match(pageSource, /saveOrderStatus\?\.\("request", \{ quoteLines: draftLines/);
  assert.match(draftRoute, /PRIMARY KEY \(sales_sub,customer_id\)/);
});

test("Google sign-in cannot spin indefinitely", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const authSource = await readFile(new URL("../app/api/auth/google/route.ts", import.meta.url), "utf8");
  assert.match(pageSource, /AbortSignal\.timeout\(15000\)/);
  assert.match(pageSource, /Google sign-in timed out/);
  assert.match(authSource, /AbortSignal\.timeout\(10000\)/);
});

test("sales order products are grouped by category", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const productsRoute = await readFile(new URL("../app/api/products/route.ts", import.meta.url), "utf8");
  assert.match(pageSource, /const \[categoryFilter, setCategoryFilter\]/);
  assert.match(pageSource, /aria-label="Filter products by category"/);
  assert.match(pageSource, /Group by CSV category/);
  assert.match(pageSource, /Showing all CSV categories/);
  assert.doesNotMatch(pageSource, /category: row\.category \|\| "Imported"/);
  assert.doesNotMatch(productsRoute, /category \|\| "Imported"/);
  assert.match(productsRoute, /product\.sku && product\.name && product\.category/);
  assert.match(pageSource, /JSON\.stringify\(\{ products: parsed, replaceAll: true \}\)/);
  assert.match(productsRoute, /if \(body\.replaceAll\)/);
  assert.match(productsRoute, /sql\.transaction/);
  assert.match(productsRoute, /jsonb_to_recordset/);
  assert.match(pageSource, /const groupedVisible = useMemo/);
  assert.match(pageSource, /className="builder-category"/);
  assert.match(pageSource, /Select category/);
  assert.match(pageSource, /group\.products\.map/);
});

test("customer and catalog changes are confirmed only after durable storage", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const customerRoute = await readFile(new URL("../app/api/customers/route.ts", import.meta.url), "utf8");
  const productsRoute = await readFile(new URL("../app/api/products/route.ts", import.meta.url), "utf8");

  assert.match(pageSource, /const saveCustomer = async/);
  assert.match(pageSource, /Customer added and saved/);
  assert.match(pageSource, /No customer records were changed/);
  assert.match(customerRoute, /CREATE TABLE IF NOT EXISTS customers/);
  assert.match(productsRoute, /CREATE TABLE IF NOT EXISTS products/);
});
