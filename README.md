# OmniOrder / Order Desk

A warehouse order-management web application for sales representatives, customers, and distribution teams. The MVP carries one order through a complete operational workflow without retyping: published catalog → customer quantity request → sales review → priced pro-forma → customer approval → distribution dispatch → final invoice.

## MVP included

- Sales dashboard with live workflow metrics and recent requests
- Sales-initiated targeted order lists: choose a customer and products, generate a secure link, and receive quantities back into the same order workflow
- Product and inventory workspace modeled on the supplied 848-SKU warehouse list
- Search, category filtering, visibility controls, stock status, price, create, and edit
- CSV import using `sku,name,category,pack,stock,price`; SKU is the update key
- Account-free customer access using a sales-shared secure link or access code plus email
- Customer-facing, price-private catalog with quantity controls and responsive order review
- Customer details, delivery preference, requested date, and request confirmation
- Sales order review with availability, quantity, pricing, and customer context
- Pro-forma document, secure customer approval view, and offline approval recording
- Shared sales/distribution fulfillment timeline
- Dispatch action that unlocks an immutable-numbered final invoice
- Final invoice action representing customer email delivery with the sales rep copied
- Responsive layouts for desktop, tablet, and phone

The interface contains seeded sample inventory from the supplied product list. The source HTML contains the complete 848-item mapping; the MVP surfaces a representative cross-category subset so the workflow stays fast and reviewable.

## Run locally

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
```

## CSV import format

Use this header row:

```csv
sku,name,category,pack,stock,price
10191,Turmeric Ground 3oz (85g),3 Oz,12 x 3oz,37,2.49
```

Re-importing an existing SKU updates that item rather than creating a duplicate.

## Implementation roadmap

### Phase 1 — Interactive MVP (current)

- Validate the end-to-end workflow and role handoffs
- Use representative source products and browser-based CSV parsing
- Demonstrate catalog publishing, order request, quoting, approval, dispatch, and invoice issuance
- Establish the responsive visual system and business terminology

### Phase 2 — Durable multi-user pilot

- Add database-backed products, customers, orders, document snapshots, and activity history
- Add secure sales authentication and role permissions for sales, distribution, and admin
- Store imports and generated PDF documents in object storage
- Add transactional email delivery, approval links, expiry, and audit events
- Import and validate all 848 source products and support spreadsheet column mapping

### Phase 3 — Operational launch

- Generate branded pro-forma and invoice PDFs with revision and void/reissue controls
- Add import rollback, error reports, customer-specific price lists, taxes, discounts, and payment terms
- Add distribution pick/pack views, partial dispatch, backorders, and payment status
- Add observability, automated tests, backups, security review, and data retention controls

### Phase 4 — Integrations and scale

- Connect the product catalog to the warehouse inventory/ERP system
- Sync live availability and reserve stock at the agreed business event
- Connect accounting, payments, shipping labels, and delivery tracking
- Add multi-warehouse availability, territory rules, reporting, and sales analytics

## Product decisions

- Customers never see prices in the initial catalog; pricing first appears in the pro-forma.
- Submitting a request does not reserve stock or confirm a sale.
- SKU is the stable import and integration key.
- Pro-formas and final invoices are frozen snapshots with separate number sequences.
- Final invoices are created only after dispatch and cannot be silently overwritten.
- Distribution sees only approved work and the fulfillment information it needs.

## Production data model

Core records: users, customers, products, catalog publications, imports, order requests, order lines, pro-formas, pro-forma revisions, approvals, dispatches, invoices, document files, notifications, and immutable activity events.

## Source materials

- `OmniOrder_MVP_Blueprint.md` — original product brief
- `warehouse-order-app-2.html` — complete 848-item seed mapping and early interaction prototype
- `Product list customer (1)-2.pdf` — warehouse catalog source
- Two supplied interface screenshots — visual direction for customer entry and sales inventory
