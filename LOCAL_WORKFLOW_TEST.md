# OmniOrder local workflow test

## Test data

- Sales login: `sales@orderdesk.example` / `orderdesk`
- New customer access code for this test order: `ORD-VM-2026`
- Returning profile: `Valley Market - Maya Patel`
- Customer: Valley Market, Maya Patel
- Sales representative: Dipendra Subedi, (415) 555-0124
- Order: `OR-2026-0137`
- Pro-forma: `PF-2026-0042`

The local catalog contains representative products with SKU, pack, published status, inventory, and wholesale prices. Prices are visible in the sales workspace but remain hidden from customers until the pro-forma.

## Customer-started workflow

1. On the home page, choose **Customer access**.
2. Select the returning Valley Market profile and enter the new test access code. Each order requires a newly issued code.
3. Enter quantities for at least one in-stock product.
4. Review and submit the request. Confirm that no prices appear in the catalog or request review.
5. Choose **Open sales workspace** and open **Orders**.
6. Review stock, pricing, customer, and delivery details, then create the pro-forma.
7. Open the customer approval view. This is the first customer screen where prices and the total appear.
8. Approve the pro-forma.
9. Approve the pro-forma and confirm that `PF-2026-0042-approved-pro-forma.pdf` downloads.
10. Confirm that the PDF visually matches the approved pro-forma shown on screen. This is the endpoint of the current MVP branch.

## Sales-started workflow

1. Sign into the sales workspace.
2. Choose **Create order list**.
3. Select Valley Market and the products to publish.
4. Generate the secure link. The customer view opens with only the selected products and no prices.
5. Enter quantities and submit the request.
6. Continue from sales review through pro-forma approval and approved PDF download as above.

## Approved PDF checks

The downloaded PDF should match the screen layout and contain the approved badge, seller, pro-forma and source-order numbers, issue and validity dates, billing address, line items, quantities, unit prices, line totals, shipping, 8.25% tax, total, Net 15 terms, approval note, and assigned sales-representative details.
