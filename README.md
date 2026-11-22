# VINTAGE CLOTHING STORE
### High-Speed Retail POS, FIFO Inventory & Profit/Loss Web App

A mobile-first billing, stock inventory, and profit/loss management application designed specifically for **VINTAGE CLOTHING STORE**. Built for 3 authorized shop phones with zero daily login friction, real-time live synchronization, atomic stock deductions, and instant 1-click WhatsApp bill sharing.

---

## 1. Application Identity
- **Store Name:** VINTAGE CLOTHING STORE
- **Business Type:** Clothing Retail Shop
- **Currency:** Indian Rupee (INR — ₹)
- **Timezone:** `Asia/Kolkata`
- **Primary Users:** Three Authorized Shop Phones (Billing Counter, Floor Staff, Manager)

---

## 2. Architecture & Tech Stack
- **Frontend:** React 18 + Vite + TypeScript
- **Styling:** Tailwind CSS (Mobile-First touch design, thermal receipt printing styles)
- **Backend/Database:** Supabase PostgreSQL with Row Level Security (RLS)
- **Live Sync:** Supabase Realtime Channels + BroadcastChannel multi-session fallback
- **Business Logic:** Atomic PostgreSQL RPC transactions (`create_bill_atomic`, `add_stock_purchase_atomic`, `cancel_or_return_bill_atomic`, `adjust_stock_atomic`)
- **Hosting Target:** Vercel-compatible SPA

---

## 3. Key Modules & Features

### ⚡ Fast Mobile POS Billing
- Mobile-first interface with large touch tiles, instant search, and category pills.
- Cart drawer with quantity controls, item-level discounts, and bill-level discounts.
- Flexible payment methods: **Cash, UPI, Split Payment, and Credit/Unpaid**.
- Quick cash tender buttons (`Exact`, `+₹100`, `+₹500`, `+₹2000`).
- Unique invoice numbering: `VCS-YYYYMMDD-0001`.
- **Idempotency Protection:** Double-tap and network retry safety prevents duplicate charges and stock drains.
- **Atomic Concurrency Protection:** Prevents two shop phones from selling the same last item simultaneously using PostgreSQL row-level locks.

### 📱 1-Click Instant WhatsApp Bill Sharing
- Opens directly via official WhatsApp click-to-chat API:
  `https://wa.me/91XXXXXXXXXX?text=ENCODED_MESSAGE`
- Validates 10-digit Indian phone numbers and pre-formats the full receipt text.
- Zero second fetch delay, no heavy blocking PDF generation before sharing.
- Print/Thermal printer (58mm/80mm) receipt view available on demand.

### 📦 FIFO Inventory & Stock Purchases
- Strict **First-In, First-Out (FIFO)** stock batch tracking.
- When recording purchases: supplier name, invoice ref, purchase date, cost price, selling price, and total amount.
- Option to automatically update retail selling prices when new stock arrives.
- Full purchase history and stock movement audit ledger (`PURCHASE_IN`, `SALE_OUT`, `DAMAGE_OUT`, `LOST_OUT`, `CANCEL_IN`).
- Prevents negative inventory.

### 📊 Profit & Loss (P&L) Management
- Realized Gross Profit = Sales Revenue − Actual FIFO Purchase Cost of sold units (COGS).
- Historical cost snapshots remain immutable even if later purchase batches arrive at different prices.
- Shop expense tracker: Shop Rent, Electricity, Transport, Staff Expenses, Packaging, Refreshments, Repairs & Maintenance, Other.
- Separate display of **Gross Profit, Gross Margin %, Expenses, Net Profit, and Net Margin %**.
- Date range filters: Today, Yesterday, Last 7 Days, This Month, and Custom Period.
- Category-wise sales and profit contribution analysis.

### 🔄 3-Phone Live Synchronization
- All 3 shop phones share the same central database.
- A sale or stock update on Phone 1 updates stock badges, dashboard numbers, and recent bills on Phone 2 and Phone 3 within 1–2 seconds.
- Live sync status indicator (`🟢 Live Sync`, `🟡 Connecting`, `🔴 Offline`).
- Offline cash drawer protection with reconnect synchronization.

### 🔐 Shop Device Security (No Daily Login)
- No daily passwords, emails, or PIN screens during busy shop billing.
- One-time device registration with shop master passcode (`VCS786`).
- Max 3 active shop phone slots.
- Manager can revoke any lost or replaced phone instantly in Settings.

---

## 4. Database Setup & Supabase Migrations
The complete PostgreSQL schema, constraints, RLS policies, indexes, and atomic RPC functions are provided in:
`supabase/migrations/20241122000000_init_vintage_store.sql`

To set up your Supabase database:
1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** in your Supabase dashboard.
3. Paste and run the entire SQL migration file:
   `supabase/migrations/20241122000000_init_vintage_store.sql`
4. Copy your **Project URL** and **Anon Public Key** from **Project Settings -> API**.
5. Add them to your environment variables (`.env` or Vercel Environment Variables):
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

---

## 5. Development & Testing
Install dependencies:
```bash
npm install
```

Run automated verification test suite:
```bash
npm test
```

Start development server:
```bash
npm run dev
```

Build production bundle:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

---

## 6. Commercial Hosting & Free Tier Transparency
- **Vercel Hobby Terms:** Vercel's Hobby plan is legally restricted to non-commercial, personal projects. For production deployment of an active retail shop, Vercel Pro ($20/mo) or independent hosting (such as a VPS, Cloudflare Pages, or Railway) is recommended for commercial compliance.
- **Supabase Free Plan:** Supabase Free databases pause automatically after 7 days of inactivity and do not include automated point-in-time backups.
- **Backup Strategy:** The application includes a 1-click **JSON Backup Export** in Settings to allow the shop owner to download offline backups of all products, stock batches, bills, and movements at any time.

---

## 7. License
Proprietary — Created for VINTAGE CLOTHING STORE.
