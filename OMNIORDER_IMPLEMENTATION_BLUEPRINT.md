# OmniOrder MVP Implementation Blueprint

Version 1.1 — August 7, 2026

## Product outcome

OmniOrder gives a warehouse sales team one traceable order record from customer request through final invoice. It removes spreadsheet and message re-entry while preserving the commercial control point: customers request quantities without seeing prices, and sales confirms price and stock in a estimate.

## Refined workflow

1. Sales imports or edits inventory using SKU as the stable identity.
2. Sales publishes a general or customer-targeted catalog link.
3. Customer selects quantities and provides delivery details. The request explicitly does not reserve stock.
4. Sales reviews requested quantities, available stock, prices, discounts, tax, freight, and terms.
5. The system freezes and sends a numbered estimate snapshot.
6. Customer approves or requests changes; sales may record approval received outside the system.
7. Approved work becomes visible to distribution for pick, pack, and dispatch.
8. Dispatch is the trigger for the separately numbered final invoice.
9. The invoice is sent to the customer and the originating sales representative is copied.

## MVP roles

- Customer: views a secure price-private catalog, requests quantities, reviews estimate pricing, and approves or requests changes.
- Sales representative: controls products, visibility, inventory, pricing, quotes, customer communication, and exceptions.
- Distribution: sees approved fulfillment records and records dispatch; it does not edit commercial terms.
- Admin: configures identity, tax, currency, terms, numbering, and permissions.

## Key business rules

- Exact inventory is internal; customers see In stock, Low stock, or Out of stock.
- Initial catalog and request views contain no selling prices or price placeholders.
- A customer request is non-binding and does not reserve inventory.
- Approved estimates and issued invoices are immutable snapshots.
- Changes after approval require a new estimate revision.
- Changes after invoice issuance require void-and-reissue or a credit-note workflow.
- Every status transition is an append-only activity event with actor and timestamp.
- Email delivery is asynchronous and retryable; document status does not depend on an open browser.

## Required production entities

Users, roles, customers, customer contacts, products, inventory snapshots, imports, catalog publications, secure links, order requests, order lines, estimates, document revisions, approvals, dispatches, invoices, files, notifications, and activity events.

## Status model

- Order request: New → Reviewing → Quoted → Closed, with Cancelled as an exception.
- Estimate: Draft → Sent → Approved → Converted, with Changes requested, Expired, and Cancelled exceptions.
- Fulfillment: Awaiting approval → Ready to pick → Picking → Dispatched, with Partial dispatch and Backordered added in phase 3.
- Invoice: Draft → Issued → Paid, with Partially paid, Overdue, and Void exceptions.

## MVP acceptance scenario

A rep publishes at least three products; a customer requests non-zero quantities and submits contact and fulfillment details; the rep opens the same request, confirms quantities and prices, and sends a numbered estimate; the customer approves it; distribution sees the approved record and marks it dispatched; the system issues a separately numbered invoice and records delivery to the customer with the rep copied.

## Delivery phases

The complete phased implementation plan is maintained in `README.md`. Phase 1 is the interactive MVP. Phase 2 replaces prototype state with durable storage, authentication, file storage, document generation, and transactional email before a live customer pilot.
