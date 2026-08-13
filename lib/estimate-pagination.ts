export function paginateEstimateLines<T>(lines: T[]) {
  const firstPageWithTotals = 20;
  const firstPageWithoutTotals = 28;
  const continuationPage = 38;
  const finalPageWithTotals = 32;
  if (lines.length <= firstPageWithTotals) return [lines];

  let pageCount = 2;
  while (lines.length > firstPageWithoutTotals + Math.max(0, pageCount - 2) * continuationPage + finalPageWithTotals) pageCount++;
  const capacities = [firstPageWithoutTotals, ...Array(Math.max(0, pageCount - 2)).fill(continuationPage), finalPageWithTotals];
  const pages: T[][] = [];
  let offset = 0;
  capacities.forEach((capacity, pageIndex) => {
    const remaining = lines.length - offset;
    const pagesLeft = capacities.length - pageIndex;
    const futureCapacity = capacities.slice(pageIndex + 1).reduce((sum, value) => sum + value, 0);
    const minimumRequiredHere = Math.max(1, remaining - futureCapacity);
    const balancedTarget = Math.ceil(remaining / pagesLeft);
    const count = pageIndex === capacities.length - 1 ? remaining : Math.min(capacity, Math.max(minimumRequiredHere, balancedTarget));
    pages.push(lines.slice(offset, offset + count));
    offset += count;
  });
  return pages.filter((page) => page.length > 0);
}
