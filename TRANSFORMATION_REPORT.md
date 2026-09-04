# SmartStore OS — Transformation deliverable (phases 1–24)

**Date:** 2026-09-05  
**Scope:** Continue from a verified Phase 8 Supplier & Purchasing module through remaining product, POS, finance, security, CI, and ops work.

## Status

| Phase | Outcome |
| --- | --- |
| 1–7 | Previously completed (audit, build, TypeScript/Zod, auth/RBAC, products, inventory ledger, atomic stock) |
| 8 | Finished: client lint + production build and server typecheck passed for supplier/PO pages |
| 9 | Batch tracking page (`/batches`) with FEFO/FIFO sort, expiry warnings, create-lot form |
| 10 | POS checkout: payment methods, discount %, customer search, VAT, cash tendered/change, receipt |
| 11 | Sales history filters (status, payment, dates) and partial returns on the receipt |
| 12 | Customer utang/credit: limits, ledger, record payment (GraphQL + UI) |
| 13 | Dashboard KPIs for expiring lots, open POs, receivables, payables |
| 14 | Reports date presets, CSV exports, profit & loss strip |
| 15 | Revenue/profit use sale-item cost snapshots and subtract refunds |
| 16 | Audit log server date filters wired into the UI |
| 17 | IndexedDB offline sale queue with flush on reconnect |
| 18 | Route-level code splitting; customer list no longer loads every sale line; sales `limit`/`offset`; batch indexes |
| 19 | GraphQL depth limit (12) and mutation-specific rate limit |
| 20 | Node test suite for financial helpers (`npm test` on server) |
| 21 | GitHub Actions: lint, typecheck, build, plus backend unit tests |
| 22 | Admin SQLite backup/restore HTTP endpoints and Settings UI |
| 23 | Empty states, checkout responsive layout, control labels, Batches nav |
| 24 | This report |

## How to verify

From `project/client`: `npm run lint` then `npm run build`  
From `project/server`: `npx tsc --project tsconfig.build.json --noEmit` then `npm test`

## Operational notes

- **Backup:** Admin Settings → Download backup. On Render, the SQLite file is expected at `/data/prod.db`.
- **Offline POS:** Queued sales use the same idempotency key so a retry after reconnect should not double-charge.
- **Credit sales:** Require a selected customer; payment amount is sent as `0` so the atomic sale service records utang.
- **FEFO:** Batches page sorts by expiry. POS still decrements product `stock`; lot-level deduction at checkout is a follow-up if you want strict FEFO enforcement on every ticket.

## Residual risk

- Credit account service still writes a separate `AuditLog` table; Activity Log UI reads `ActivityLog`. Both exist.
- `createItemBatch` tracks lots; it does not by itself adjust product on-hand (receive still happens via PO receive / stock adjust).
- Restore replaces the live DB file; take a backup first.
