# StoreOS — Store Management System

> Full-stack retail, inventory, POS, and procurement platform for Ethiopian businesses (ETB).  
> **React 19 · Vite · GraphQL · Apollo · Prisma · SQLite · Tailwind · TypeScript**

**Repository:** [https://github.com/kalu-123-cmd/Store-Management-System](https://github.com/kalu-123-cmd/Store-Management-System)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Prerequisites](#4-prerequisites)
5. [Quick Start](#5-quick-start)
6. [Environment Variables](#6-environment-variables)
7. [Database Setup & Seeding](#7-database-setup--seeding)
8. [Default Login Credentials](#8-default-login-credentials)
9. [Feature Pages](#9-feature-pages)
10. [AI Intelligence Dashboard](#10-ai-intelligence-dashboard)
11. [API Reference](#11-api-reference)
12. [CSV / Excel Product Import](#12-csv--excel-product-import)
13. [Audit Log](#13-audit-log)
14. [Role-Based Access Control](#14-role-based-access-control)
15. [Build for Production](#15-build-for-production)
16. [Deploy (Vercel + Render)](#16-deploy-vercel--render)
17. [Scripts Reference](#17-scripts-reference)
18. [Demo Data Summary](#18-demo-data-summary)
19. [Troubleshooting](#19-troubleshooting)
20. [License](#20-license)

---

## 1. Overview

StoreOS is a complete store management system with:

- **Point of Sale** — Sales invoices, VAT, payments, returns
- **Inventory** — Stock levels, low-stock alerts, batch / expiry tracking
- **Purchase Orders** — Draft → Sent → Received (auto stock update)
- **Procurement** — Requests, tenders, contracts with approval workflows
- **AI Intelligence Dashboard** — Store health score, alerts, reorder & expiry markdown advice
- **Organizations** — Orgs, units, departments, warehouses, branches
- **CSV / Excel Import** — Bulk products from `.csv`, `.xlsx`, `.xls`
- **Audit Log** — Actions with IP, entity, and change diff
- **i18n** — English & Amharic
- **Dark mode** & **PWA** install support
- **RBAC** — ADMIN, MANAGER, CASHIER

---

## 2. Tech Stack

### Frontend (`/client`)

| Package | Purpose |
|---|---|
| React 19 | UI |
| Vite 8 | Dev server & build |
| TypeScript | Types |
| Tailwind CSS | Styling |
| Apollo Client | GraphQL |
| React Router 7 | Routing |
| Framer Motion | Animation |
| Recharts | Charts |
| lucide-react | Icons |
| xlsx | Excel parse |
| i18next | Localization |
| vite-plugin-pwa | PWA |

### Backend (`/server`)

| Package | Purpose |
|---|---|
| Node.js ≥ 18 | Runtime |
| Apollo Server 4 | GraphQL API |
| Express 5 | HTTP |
| Prisma 5 | ORM |
| SQLite | Database |
| JWT + bcrypt | Auth |
| Helmet + rate-limit | Security |

---

## 3. Project Structure

```
Store-Management-System/
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/         # Layout, Toast, StockAlertBell, …
│   │   ├── pages/              # Dashboard, Sales, AIDashboard, Procurement, …
│   │   ├── hooks/              # useRole, useStockAlerts, …
│   │   ├── lib/                # currency (ETB), LangContext
│   │   ├── App.tsx
│   │   └── main.tsx            # Apollo → VITE_API_URL or localhost:4000
│   ├── vercel.json
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── graphql/            # typeDefs.ts, resolvers.ts
│   │   ├── services/           # CSV import, inventory, batches, …
│   │   ├── agents/             # Reorder / AI helpers
│   │   └── index.ts
│   ├── prisma/                 # schema.prisma, seed, SQLite
│   └── package.json
│
├── render.yaml                 # Backend deploy blueprint (Render)
├── vercel.json                 # Frontend deploy hints
├── docker-compose.yml          # Optional container setup
└── README.md
```

---

## 4. Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

No Docker or Redis required for local development (SQLite file DB).

---

## 5. Quick Start

### 1. Clone & install

```bash
git clone https://github.com/kalu-123-cmd/Store-Management-System.git
cd Store-Management-System

cd server && npm install && cd ..
cd client && npm install && cd ..
```

### 2. Database

```bash
cd server
npx prisma db push
npm run seed
```

### 3. Run

**Terminal 1 — API**

```bash
cd server
npm run dev
# http://localhost:4000/graphql
```

**Terminal 2 — UI**

```bash
cd client
npm run dev
# http://localhost:5173
```

Open **http://localhost:5173** and sign in (credentials below).

---

## 6. Environment Variables

### Server (`server/.env`)

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="change-me-to-a-long-random-string"
PORT=4000
NODE_ENV=development
CLIENT_URL="http://localhost:5173"
```

### Client

**Local** — defaults to `http://localhost:4000/graphql` (no file needed).

**Production** — `client/.env.production`:

```env
VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/graphql
```

---

## 7. Database Setup & Seeding

```bash
cd server
npx prisma db push
npm run seed

# Optional demo extras
npx tsx scripts/seedPurchaseOrders.ts
npx tsx scripts/seedProcurement.ts
npx tsx scripts/seedOrganizations.ts
```

Reset:

```bash
npx prisma db push --force-reset
npm run seed
```

Browse data: `npx prisma studio`

---

## 8. Default Login Credentials

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@store.com` | `admin123` |
| **Manager** | `manager@store.com` | `manager123` |
| **Cashier** | `cashier@store.com` | `cashier123` |

Change these before any public production deploy.

---

## 9. Feature Pages

| Route | Description |
|---|---|
| `/dashboard` | KPIs, charts, activity |
| `/ai-dashboard` | AI health score, alerts, insights |
| `/products` | Product CRUD |
| `/inventory` | Stock & batches |
| `/sales` | POS / invoices |
| `/purchases` | Purchase orders |
| `/procurement` | Requests · tenders · contracts |
| `/csv-import` | Bulk import |
| `/customers` / `/suppliers` / `/categories` | Masters |
| `/organizations` / `/branches` | Org structure |
| `/reports` | Sales & inventory reports |
| `/audit` | Activity log |
| `/users` / `/settings` / `/profile` | Admin |

---

## 10. AI Intelligence Dashboard

Route: **`/ai-dashboard`**

| Tab | What you get |
|---|---|
| **Overview** | Store health (0–100), period revenue (today/week/month), stock, margin, top categories, quick actions |
| **Alerts** | Low / out-of-stock list with suggested reorder qty, expiry batches with markdown %, receivables vs payables |
| **Insights** | Clickable recommendations (reorder PO, expiry clear, protect top category, cash gap, sales dip) |

**Empty store:** guided steps (categories → products → suppliers → first sale).

Data refreshes every **30 seconds**. Buttons navigate to Purchases, Inventory, Sales, Reports, etc.

---

## 11. API Reference

```
POST http://localhost:4000/graphql
Authorization: Bearer <JWT>
```

```graphql
mutation {
  login(email: "admin@store.com", password: "admin123") {
    token
    user { id name role }
  }
}

query {
  dashboardStats {
    todaySales weekSales monthlyRevenue
    lowStockCount outOfStockCount expiringCount
    inventoryValue pendingPurchases
  }
  lowStockProducts { id name stock minStockLevel costPrice sellingPrice category { name } }
  expiringBatches(days: 30) { id batchNumber expiryDate currentQuantity product { name sellingPrice } }
}
```

Health: `GET /health`

---

## 12. CSV / Excel Product Import

Page: `/csv-import`

**Required columns:** `name`, `sku`  
**Common optional:** `category`, `stock`, `costPrice`, `sellingPrice`, `barcode`

Sample file: `sample-products.csv` (repo root / server demo Excel).

---

## 13. Audit Log

Every important action stores user, IP, entity, old/new values, and field diffs. Filter by action, entity, user, or IP on `/audit`.

---

## 14. Role-Based Access Control

| Feature | ADMIN | MANAGER | CASHIER |
|---|---|---|---|
| Dashboard / AI | ✅ | ✅ | ✅ |
| Products edit | ✅ | ✅ | ❌ |
| Sales | ✅ | ✅ | ✅ |
| Purchase Orders | ✅ | ✅ | ❌ |
| Procurement | ✅ | ✅ | ❌ |
| Users | ✅ | ❌ | ❌ |
| Audit / Reports | ✅ | ✅ | ❌ |

---

## 15. Build for Production

```bash
# API
cd server
npm run build
npm start

# UI
cd client
# set VITE_API_URL first
npm run build
npm run preview
```

---

## 16. Deploy (Vercel + Render)

Recommended split:

| Layer | Host | Config |
|---|---|---|
| Frontend | [Vercel](https://vercel.com) | `client/` + `VITE_API_URL` |
| Backend | [Render](https://render.com) | `render.yaml` / `server/` |

### A. Backend on Render

1. Create a **Web Service** from this GitHub repo.
2. **Root directory:** `server`
3. **Build:**  
   `npm install && npx prisma generate && npm run build && npx prisma db push --accept-data-loss`
4. **Start:** `node dist/index.js`
5. Add a **persistent disk** (e.g. mount `/data`) and set:

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=file:/data/prod.db
JWT_SECRET=<long-random-secret>
CLIENT_URL=https://YOUR-VERCEL-APP.vercel.app
```

6. After first deploy, open the service shell (or one-off job) and run `npm run seed` if you want demo users.

Or apply the included blueprint:

```bash
# From repo root (Render CLI / dashboard “Blueprint”)
# render.yaml → service storeos-api
```

### B. Frontend on Vercel

1. Import the same GitHub repo into Vercel.
2. **Root Directory:** `client`
3. Framework: Vite
4. Environment variable:

```env
VITE_API_URL=https://YOUR-RENDER-HOST.onrender.com/graphql
```

5. Deploy. Set Render `CLIENT_URL` to the Vercel URL (CORS).

### C. CLI deploy (if logged in)

```bash
# Frontend
cd client
npx vercel --prod --yes

# Ensure VITE_API_URL is set in the Vercel project settings
```

### Docker (optional)

```bash
docker compose up --build
```

(See `docker-compose.yml` in the repo.)

---

## 17. Scripts Reference

### Server

| Command | Description |
|---|---|
| `npm run dev` | Dev API (tsx watch) |
| `npm run build` | Compile + Prisma generate |
| `npm start` | Production start |
| `npm run seed` | Seed users / catalog |
| `npx prisma db push` | Sync schema |
| `npx prisma studio` | DB UI |

### Client

| Command | Description |
|---|---|
| `npm run dev` | Vite dev |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview build |
| `npm run lint` | oxlint |

---

## 18. Demo Data Summary

After seeding you typically get:

- Users: Admin / Manager / Cashier (see §8)
- Dozens of products across Electronics, Household, Clothing, etc.
- Sample sales, POs, procurement requests/tenders/contracts
- Suppliers & customers with ETB pricing

Exact counts depend on which seed scripts you run.

---

## 19. Troubleshooting

| Issue | Fix |
|---|---|
| AI Dashboard all zeros | Seed DB or add products + record a sale; restart API after pulling schema changes |
| Alerts / Insights empty | Ensure server is running latest `resolvers`/`typeDefs`; click **Refresh** |
| GraphQL auth errors | Log out/in; check `JWT_SECRET` matches |
| CORS in production | Set `CLIENT_URL` on API to your Vercel origin |
| `xlsx` TS “baseUrl deprecated” in IDE | Harmless `node_modules` noise; app `tsconfig` uses `skipLibCheck` |
| Procurement expand crash / TS 2339 | Use latest `Procurement.tsx` (toggle uses `t.id`, not `e.id`) |
| Render free tier sleep | First request after idle can be slow; upgrade plan for always-on |

---

## 20. License

MIT — free to use, modify, and distribute.

---

**StoreOS** — Built for Ethiopian retail & procurement teams.
