# StoreOS — Store Management System

> A full-stack, enterprise-grade retail & procurement management platform built for Ethiopian businesses.  
> React 19 · GraphQL · Prisma · SQLite · TailwindCSS · TypeScript

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
10. [API Reference](#10-api-reference)
11. [CSV / Excel Product Import](#11-csv--excel-product-import)
12. [Audit Log](#12-audit-log)
13. [Role-Based Access Control](#13-role-based-access-control)
14. [Build for Production](#14-build-for-production)
15. [Scripts Reference](#15-scripts-reference)
16. [Demo Data Summary](#16-demo-data-summary)

---

## 1. Overview

StoreOS is a complete store management system with:

- **Point of Sale** — Create sales invoices with VAT calculation and payment tracking
- **Inventory Management** — Real-time stock levels, low-stock alerts, batch tracking
- **Purchase Orders** — Full PO lifecycle: Draft → Sent → Received (auto-updates stock)
- **Procurement** — Requests, Tenders, Contracts with approval workflows
- **Organization Management** — Organizations, Units, Departments, Warehouses
- **CSV / Excel Import** — Bulk product import from `.csv`, `.xlsx`, `.xls`
- **Audit Log** — Every action logged with IP address, entity, and change diff
- **Multi-language** — English and Amharic (አማርኛ) support
- **Dark Mode** — Full dark/light theme toggle
- **PWA** — Installable as a Progressive Web App
- **Role-Based Access** — ADMIN, MANAGER, CASHIER roles with granular permissions

---

## 2. Tech Stack

### Frontend (`/client`)

| Package | Version | Purpose |
|---|---|---|
| React | 19.2 | UI framework |
| Vite | 8.2 | Build tool & dev server |
| TypeScript | 6.0 | Type safety |
| TailwindCSS | 3.4 | Utility-first styling |
| Apollo Client | 3.14 | GraphQL client with cache |
| React Router | 7.18 | Client-side routing |
| Framer Motion | 12.43 | Animations |
| Recharts | 3.10 | Dashboard charts |
| lucide-react | 1.31 | Icon library |
| xlsx | 0.18 | Excel file parsing |
| i18next | 26 | Internationalization |
| vite-plugin-pwa | 1.3 | PWA support |

### Backend (`/server`)

| Package | Version | Purpose |
|---|---|---|
| Node.js | ≥18 | Runtime |
| TypeScript | 7.0 | Type safety |
| Apollo Server | 4.13 | GraphQL server |
| Express | 5.2 | HTTP server |
| Prisma | 5.22 | ORM + migrations |
| SQLite | — | Database (file-based) |
| JWT | 9.0 | Authentication tokens |
| bcrypt | 6.0 | Password hashing |
| Helmet | 8.3 | Security headers |
| express-rate-limit | 8.6 | API rate limiting |
| xlsx | 0.18 | Excel generation |
| tsx | 4.23 | TypeScript runner |

---

## 3. Project Structure

```
Store-Management-System/
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/         # Shared UI components
│   │   │   ├── Layout.tsx      # App shell with sidebar
│   │   │   ├── Toast.tsx       # Notification system
│   │   │   ├── Logo.tsx
│   │   │   └── StockAlertBell.tsx
│   │   ├── pages/              # Route pages
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Products.tsx
│   │   │   ├── Sales.tsx
│   │   │   ├── Inventory.tsx
│   │   │   ├── PurchaseOrders.tsx
│   │   │   ├── CSVImport.tsx
│   │   │   ├── Procurement.tsx
│   │   │   ├── Organizations.tsx
│   │   │   ├── AuditLog.tsx
│   │   │   ├── Customers.tsx
│   │   │   ├── Suppliers.tsx
│   │   │   ├── Categories.tsx
│   │   │   ├── Reports.tsx
│   │   │   ├── Users.tsx
│   │   │   ├── Branches.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── AIDashboard.tsx
│   │   │   └── Login.tsx
│   │   ├── hooks/              # Custom React hooks
│   │   │   ├── useRole.ts      # RBAC helpers
│   │   │   ├── useDarkMode.ts
│   │   │   └── useStockAlerts.ts
│   │   ├── lib/
│   │   │   ├── currency.ts     # ETB formatting helpers
│   │   │   ├── LangContext.tsx # Language context
│   │   │   └── i18n.ts
│   │   ├── i18n/config.ts      # i18next setup
│   │   ├── App.tsx             # Route definitions
│   │   └── main.tsx            # Apollo Client setup
│   └── public/
│       └── manifest.json       # PWA manifest
│
├── server/
│   ├── src/
│   │   ├── graphql/
│   │   │   ├── typeDefs.ts     # Full GraphQL schema
│   │   │   └── resolvers.ts    # All query & mutation handlers
│   │   ├── services/
│   │   │   ├── csvImportService.ts   # CSV/Excel import logic
│   │   │   └── posTransactionService.ts
│   │   ├── dataloaders/        # DataLoader for N+1 prevention
│   │   └── index.ts            # Express + Apollo server
│   ├── prisma/
│   │   ├── schema.prisma       # Full database schema
│   │   ├── seed.ts             # Main seed (users, products, sales)
│   │   └── dev.db              # SQLite database file
│   └── scripts/
│       ├── seedPurchaseOrders.ts
│       ├── seedProcurement.ts
│       └── seedOrganizations.ts
│
├── sample-products.csv         # Sample CSV for import testing
├── demo-data.xlsx              # Full demo Excel file (5 sheets)
└── README.md
```

---

## 4. Prerequisites

- **Node.js** ≥ 18.0.0
- **npm** ≥ 9.0.0

No Docker, no external database, no Redis required for development.  
The app runs entirely on SQLite — zero external dependencies.

---

## 5. Quick Start

### 1. Install dependencies

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 2. Set up the database

```bash
cd server
npx prisma db push
npm run seed
```

### 3. Seed demo data (optional but recommended)

```bash
cd server
npx tsx scripts/seedPurchaseOrders.ts
npx tsx scripts/seedProcurement.ts
npx tsx scripts/seedOrganizations.ts
```

### 4. Start both servers

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
# Server ready at http://localhost:4000/graphql
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
# App running at http://localhost:5173
```

### 5. Open the app

Navigate to **http://localhost:5173** and log in with the admin credentials below.

---

## 6. Environment Variables

### Server (`server/.env`)

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="supersecret_jwt_key_12345"
PORT=4000
NODE_ENV=development
```

### Client (`client/.env.production`)

```env
VITE_API_URL=https://your-backend-url/graphql
```

For local development the client automatically points to `http://localhost:4000/graphql`.

---

## 7. Database Setup & Seeding

```bash
cd server

# Push schema to database (creates tables)
npx prisma db push

# Run the main seed (users, categories, suppliers, products, sales)
npm run seed

# Seed purchase orders (8 POs in various states)
npx tsx scripts/seedPurchaseOrders.ts

# Seed procurement data (requests, tenders, contracts)
npx tsx scripts/seedProcurement.ts

# Seed organization structure (orgs, units, departments, warehouses)
npx tsx scripts/seedOrganizations.ts
```

To reset the database completely:
```bash
npx prisma db push --force-reset
npm run seed
```

To open the Prisma visual database browser:
```bash
npx prisma studio
```

---

## 8. Default Login Credentials

| Role | Email | Password | Access |
|---|---|---|---|
| **Admin** | admin@store.com | admin123 | Full access to all features |
| **Manager** | manager@store.com | manager123 | Products, sales, POs, reports |
| **Cashier** | cashier@store.com | cashier123 | Sales, basic inventory view |

> **Security note:** Change these passwords before any production deployment.

---

## 9. Feature Pages

| Route | Page | Description |
|---|---|---|
| `/dashboard` | Dashboard | KPIs, revenue chart, low stock alerts, activity feed |
| `/products` | Products | Full CRUD with search, filter, barcode, category |
| `/inventory` | Inventory | Stock levels, adjustments, batch tracking |
| `/sales` | Sales | POS-style invoice creation, payment methods, returns |
| `/purchases` | Purchase Orders | PO creation, send, receive (auto-updates stock) |
| `/csv-import` | CSV / Excel Import | Bulk product import from `.csv`, `.xlsx`, `.xls` |
| `/customers` | Customers | Customer profiles, credit accounts, purchase history |
| `/suppliers` | Suppliers | Supplier management with contact details |
| `/categories` | Categories | Product category tree management |
| `/procurement` | Procurement | Requests → Tenders → Contracts workflow |
| `/organizations` | Organizations | Organizations, Departments, Warehouses |
| `/branches` | Branches | Multi-branch location management |
| `/reports` | Reports | Sales, inventory, profit reports with date filters |
| `/ai-dashboard` | AI Dashboard | AI-powered insights and recommendations |
| `/barcodes` | Barcode Print | Generate and print product barcodes |
| `/audit` | Audit Log | Full event log with IP, entity, and change diff |
| `/users` | Users | User management with role assignment |
| `/settings` | Settings | Dark mode, language, store configuration |
| `/profile` | Profile | Personal profile and password change |

---

## 10. API Reference

### GraphQL Endpoint

```
POST http://localhost:4000/graphql
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
```

### Authentication

```graphql
mutation Login {
  login(email: "admin@store.com", password: "admin123") {
    token
    user { id name role email }
  }
}
```

### Key Queries

```graphql
# Dashboard stats
query { dashboardStats { totalProducts inventoryValue monthlyRevenue monthlyProfit } }

# Products with category and supplier
query { products { id name sku stock costPrice sellingPrice category { name } supplier { name } } }

# Purchase orders
query { purchaseOrders { id poNumber status totalCost supplier { name } items { quantity unitCost product { name } } } }

# Audit log with full details
query {
  activityLogs {
    id action details ipAddress entityType entityId
    oldValue newValue changes createdAt
    user { name email role }
  }
}

# Procurement requests
query { procurementRequests { id requestNumber priority status estimatedTotal items { description quantity estimatedUnitCost } } }

# Organizations with departments and warehouses
query {
  organizations { id name code type isActive }
  departments { id name code headOfDepartment organizationUnit { name } }
  warehouses { id name code type manager capacity }
}
```

### Key Mutations

```graphql
# Create product
mutation {
  createProduct(name:"Laptop",sku:"LAP-001",costPrice:30000,sellingPrice:45000,stock:10,categoryId:"...") { id }
}

# Create sale
mutation {
  createSale(items:[{productId:"...",quantity:1,price:45000}], paymentMethod:"CASH") { id invoiceNo totalAmount }
}

# Create purchase order
mutation {
  createPurchaseOrder(supplierId:"...", items:[{productId:"...",quantity:5,unitCost:30000}]) { id poNumber }
}

# Import products from CSV
mutation {
  importProducts(csvContent: "name,sku,category,stock,costPrice,sellingPrice\nLaptop,LAP-001,Electronics,10,30000,45000") {
    success
    summary { created updated failed stockChanges }
  }
}
```

### Other Endpoints

```
GET  http://localhost:4000/health    # Health check
GET  http://localhost:4000/metrics   # Server metrics (uptime, memory)
POST http://localhost:4000/upload    # File upload (requires auth)
GET  http://localhost:4000/download/:id  # File download
```

---

## 11. CSV / Excel Product Import

Navigate to **`/csv-import`** in the app.

### Supported formats
- `.csv` — Comma-separated values
- `.xlsx` — Excel 2007+ workbook
- `.xls` — Legacy Excel

### Required columns

| Column | Aliases | Required |
|---|---|---|
| `name` | `product_name`, `productname` | Yes |
| `sku` | `SKU` | Yes |
| `category` | — | No |
| `stock` | `quantity`, `current_stock` | No |
| `costPrice` | `cost_price`, `cost` | No |
| `sellingPrice` | `selling_price`, `price` | No |

### Optional columns
`barcode`, `margin`, `brand`

### Sample CSV (included as `sample-products.csv`)

```csv
name,sku,category,stock,costPrice,sellingPrice
Wireless Mouse,P001,Electronics,50,15.00,25.00
Notebook A5,P002,Stationery,200,1.50,3.50
Coffee Mug,P003,Kitchenware,30,5.00,12.00
```

### Full demo Excel file
`server/demo-data.xlsx` contains 5 sheets:
1. **Procurement Requests** — 5 requests with full item details
2. **Request Items** — 16 line items
3. **Tenders** — 4 tenders
4. **Contracts** — 4 supplier contracts
5. **Products (CSV Import)** — 10 products ready to import

### How it works
1. Select or drag-drop a file onto the import page
2. Click **Preview Import** — validation runs row-by-row
3. Review the results: valid rows show CREATE/UPDATE, invalid rows show errors
4. Click **Import N Valid Rows** — error rows are automatically skipped
5. Dashboard refreshes automatically after import

---

## 12. Audit Log

Every user action is recorded in the `ActivityLog` table.

### What is logged

| Field | Description |
|---|---|
| `action` | Event type (e.g. `SALE_COMPLETED`, `PRODUCT_UPDATED`) |
| `details` | Human-readable description |
| `ipAddress` | Client IP address |
| `entityType` | Affected record type (PRODUCT, SALE, USER, etc.) |
| `entityId` | UUID of the affected record |
| `oldValue` | JSON snapshot before the change |
| `newValue` | JSON snapshot after the change |
| `changes` | Field-level diff `{ field: { from, to } }` |
| `createdAt` | Timestamp |

### IP Address Detection

The audit log automatically classifies IP addresses:

| IP Pattern | Classification | Icon |
|---|---|---|
| `127.0.0.1`, `::1` | Localhost (local dev) | Server |
| `192.168.x.x`, `10.x.x.x` | LAN / Internal network | Smartphone |
| Public IP | External / Internet | Globe |

### Filters available

- **Search** — Searches across user name, email, IP, entity, action, details
- **Action Type** — Filter by category (Logins, Sales, Products, POs, etc.)
- **Entity Type** — Filter by affected record (PRODUCT, SALE, USER, etc.)
- **User** — Filter by specific user
- **IP Address** — Filter by specific IP

### Clicking any row opens a detail drawer showing:
- Full timestamp
- User profile (name, email, role)
- Network origin (IP + classification + API endpoint)
- Entity details (type + UUID)
- Change diff (field-by-field old → new)

---

## 13. Role-Based Access Control

| Feature | ADMIN | MANAGER | CASHIER |
|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ |
| View Products | ✅ | ✅ | ✅ |
| Create/Edit Products | ✅ | ✅ | ❌ |
| Delete Products | ✅ | ❌ | ❌ |
| Create Sales | ✅ | ✅ | ✅ |
| View Sales | ✅ | ✅ | ✅ |
| Purchase Orders | ✅ | ✅ | ❌ |
| CSV Import | ✅ | ✅ | ❌ |
| Procurement | ✅ | ✅ | ❌ |
| Organizations | ✅ | ✅ | ❌ |
| User Management | ✅ | ❌ | ❌ |
| Audit Log | ✅ | ✅ | ❌ |
| Reports | ✅ | ✅ | ❌ |
| Settings | ✅ | ✅ | ✅ (limited) |

---

## 14. Build for Production

### Backend

```bash
cd server
npm run build
# Output: dist/
npm start
# Runs: prisma db push + node dist/index.js
```

### Frontend

```bash
cd client
npm run build
# Output: dist/
npm run preview   # Preview the production build locally
```

Set `VITE_API_URL` in `client/.env.production` to your production backend URL before building.

---

## 15. Scripts Reference

### Server scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run production build (after `npm run build`) |
| `npm run seed` | Run main database seeder |
| `npx tsx scripts/seedPurchaseOrders.ts` | Seed 8 demo purchase orders |
| `npx tsx scripts/seedProcurement.ts` | Seed procurement + generate Excel |
| `npx tsx scripts/seedOrganizations.ts` | Seed org structure |
| `npx prisma studio` | Open visual database browser |
| `npx prisma db push` | Sync schema to database |
| `npx prisma db push --force-reset` | Reset database completely |
| `npx prisma generate` | Regenerate Prisma client |

### Client scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run oxlint |

---

## 16. Demo Data Summary

After running all seed scripts, the database contains:

### Users
| Name | Email | Role |
|---|---|---|
| Admin User | admin@store.com | ADMIN |
| Store Manager | manager@store.com | MANAGER |
| Cashier One | cashier@store.com | CASHIER |

### Products — 71 total
| Category | Count | Examples |
|---|---|---|
| Electronics | 15 | MacBook Pro, iPhone 15, Sony Headphones |
| Electronics (ELC) | 30 | LED Bulbs, Cables, Fans, Kettle, Router |
| Household & Shop | 30 | Buckets, Coffee, Spices, Pots, Notebooks |
| Clothing | 4 | T-Shirt, Jeans, Sneakers |
| Food & Beverages | 2 | Arabica Coffee, Green Tea |
| Furniture | 2 | Standing Desk, Office Chair |

### Sales — 8 invoices
Revenue: ~ETB 151,000 | Profit: ~ETB 39,000

### Purchase Orders — 8 POs
| Status | Count | Value (ETB) |
|---|---|---|
| RECEIVED | 3 | 351,800 |
| SENT | 2 | 644,650 |
| DRAFT | 2 | 110,800 |
| CANCELLED | 1 | 160,000 |

### Procurement
- 5 Requests (2 APPROVED · 2 SUBMITTED · 1 DRAFT)
- 4 Tenders (PUBLISHED · EVALUATION · AWARDED · DRAFT)
- 4 Contracts (3 ACTIVE · 1 DRAFT) — Total value: ETB 2,250,000

### Organizations
- 3 Organizations (StoreOS HQ · Hawassa Branch · Default)
- 4 Organization Units
- 8 Departments (Finance, HR, Retail, IT, Procurement, Logistics, etc.)
- 5 Warehouses (Central Bole · Retail Stock Room · Electronics · Hawassa · Cold Storage)

### Suppliers — 4
TechVision Ltd · FashionHub Inc · FreshFoods Co · Habesha Supplies

### Customers — 3
Abebe Girma · Tigist Haile · Mulugeta Alemu

---

## License

MIT — free to use, modify and distribute.

---

*StoreOS — Built for Ethiopian retail businesses.*
