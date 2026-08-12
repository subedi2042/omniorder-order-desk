# Desi Kitchen Wholesale Ordering

A production-oriented wholesale order-management web application for Desi Kitchen sales representatives and customers. This branch delivers the launch workflow: published catalog → customer quantity request → sales review → priced estimate → customer approval → matching approved estimate PDF.

## Desi Kitchen production branch

The `codex/desi-kitchen` branch carries the Desi Kitchen identity, public logo, Fraunces/DM Sans typography, deep-green/leaf-green/brown palette, authenticated sales workspace, durable product/customer storage, and approved estimate workflow. Customers do not create stored login accounts; they enter through a sales-issued secure code or order link.

Sales representative Sahil Man Singh Pradhan should create the first sales account with his valid email on the registration screen. Passwords are never committed to GitHub and are stored only as salted PBKDF2 hashes.

## MVP included

- Sales dashboard with live workflow metrics and recent requests
- Sales-initiated targeted order lists: choose a customer and products, generate a secure link, and receive quantities back into the same order workflow
- Product and inventory workspace modeled on the supplied 848-SKU warehouse list
- Search, category filtering, visibility controls, stock status, price, create, and edit
- CSV import using `sku,name,category,pack,stock,price`; SKU is the update key
- Account-free customer access using a single-order secure token or a new sales-shared access code
- Returning customers may select a saved profile, but must enter a newly issued code for every order
- First-time customers may create a profile only after a valid sales-issued code is verified
- Public Fast Quote, Privacy, and fictitious Technical Support pages with working navigation and contact links
- Customer-facing, price-private catalog with quantity controls and responsive order review
- Customer details, delivery preference, requested date, and request confirmation
- Sales order review with availability, quantity, pricing, and customer context
- Sales estimate editor with product substitution, line add/remove, quantity changes, unit-price overrides, percentage discount, and customer-facing notes
- Estimate document, secure customer approval view, and offline approval recording
- Clickable estimate number with an in-app, read-only PDF preview before customer approval
- Approved estimate PDF that visually matches the document shown in the application
- PDF includes status, seller, customer, source order, SKU/pack lines, quantities, unit prices, shipping, tax, total, terms, and sales-rep contact
- Responsive layouts for desktop, tablet, and phone
- Real Google Identity Services sign-in requirement for the sales workspace, with server-side ID-token verification and an HTTP-only session cookie
- First-time sales account registration and returning email/password sign-in, with durable D1 storage and PBKDF2 password hashing

## Google sales sign-in setup

Create a Google OAuth 2.0 Web application client and authorize both the local and published application origins. Copy `.env.example` to `.env.local`, set `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, and generate a long random `AUTH_SESSION_SECRET`. Add the same values to the hosted environment before publishing. No Google client secret is used or committed.

The interface contains seeded sample inventory from the supplied product list. The source HTML contains the complete 848-item mapping; the MVP surfaces a representative cross-category subset so the workflow stays fast and reviewable.

## Run locally

```bash
npm install
npm run dev
```

Open the exact local URL printed in the terminal. The demo includes published inventory, stock levels, wholesale prices, customer information, tax, shipping, and document numbering. See [`LOCAL_WORKFLOW_TEST.md`](LOCAL_WORKFLOW_TEST.md) for the two-role test script.

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

Product and inventory imports accept CSV or text-based PDF files. PDF extraction recognizes rows containing SKU, description, stock, and price; CSV is the reliable fallback for scanned or unusually formatted PDFs. Starter files are available at `/templates/desi-kitchen-products-inventory.csv` and `/templates/desi-kitchen-customers.csv`.

Customer CSV header:

```csv
business,contact,email,phone,address
```

## Implementation roadmap

### Phase 1 — Approved estimate MVP (current branch)

- Validate the end-to-end workflow and role handoffs
- Use representative source products and browser-based CSV parsing
- Demonstrate catalog publishing, either customer- or sales-initiated ordering, quoting, approval, and approved PDF download
- Establish the responsive visual system and business terminology

### Phase 2 — Durable multi-user pilot and fulfillment

- Add database-backed products, customers, orders, document snapshots, and activity history
- Add secure sales authentication and role permissions for sales, distribution, and admin
- Store imports and generated PDF documents in object storage
- Add transactional email delivery, approval links, expiry, and audit events
- Import and validate all 848 source products and support spreadsheet column mapping
- Activate the retained distribution, dispatch, final invoice, and payment workflow

### Phase 3 — Operational launch

- Generate branded estimate and invoice PDFs with revision and void/reissue controls
- Add import rollback, error reports, customer-specific price lists, taxes, discounts, and payment terms
- Add distribution pick/pack views, partial dispatch, backorders, and payment status
- Add observability, automated tests, backups, security review, and data retention controls

### Phase 4 — Integrations and scale

- Connect the product catalog to the warehouse inventory/ERP system
- Sync live availability and reserve stock at the agreed business event
- Connect accounting, payments, shipping labels, and delivery tracking
- Add multi-warehouse availability, territory rules, reporting, and sales analytics

## Product decisions

- Customers never see prices in the initial catalog; pricing first appears in the estimate.
- Submitting a request does not reserve stock or confirm a sale.
- SKU is the stable import and integration key.
- Estimates and final invoices are frozen snapshots with separate number sequences.
- Final invoices are created only after dispatch and cannot be silently overwritten.
- Distribution sees only approved work and the fulfillment information it needs.

## Production data model

Core records: users, customers, products, catalog publications, imports, order requests, order lines, estimates, estimate revisions, approvals, dispatches, invoices, document files, notifications, and immutable activity events.

## Source materials

- `OmniOrder_MVP_Blueprint.md` — original product brief
- `warehouse-order-app-2.html` — complete 848-item seed mapping and early interaction prototype
- `Product list customer (1)-2.pdf` — warehouse catalog source
- Two supplied interface screenshots — visual direction for customer entry and sales inventory
