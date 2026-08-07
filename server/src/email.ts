import nodemailer from 'nodemailer';

// ── Transporter ────────────────────────────────────────────────────────────────
// Configure via .env:
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=587
//   SMTP_USER=you@gmail.com
//   SMTP_PASS=your-app-password
//   SMTP_FROM=StoreOS <you@gmail.com>
//   STORE_ADMIN_EMAIL=admin@yourstore.com  (where to send low-stock alerts)
//
// For Gmail use an App Password (not your regular password).
// For testing with no SMTP set up, emails are silently skipped.

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user, pass },
  });
}

const FROM = process.env.SMTP_FROM || 'StoreOS <noreply@storeos.et>';
const ADMIN_EMAIL = process.env.STORE_ADMIN_EMAIL || process.env.SMTP_USER || '';

// ── Send sale receipt to customer ─────────────────────────────────────────────

export async function sendSaleReceipt(sale: {
  invoiceNo: string;
  totalAmount: number;
  createdAt: string;
  customer?: { name: string; email?: string | null } | null;
  user?: { name: string } | null;
  items: { quantity: number; price: number; product?: { name: string; sku: string } | null }[];
}) {
  const transporter = createTransporter();
  if (!transporter) return; // SMTP not configured — skip silently

  const customerEmail = sale.customer?.email;
  if (!customerEmail) return; // no email address to send to

  const subtotal = sale.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const rows = sale.items.map(i =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${i.product?.name || 'Unknown'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${i.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right">ETB ${i.price.toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right">ETB ${(i.price * i.quantity).toFixed(2)}</td>
    </tr>`
  ).join('');

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#1d4ed8,#1e40af);padding:24px 32px">
        <h1 style="color:#fff;margin:0;font-size:22px">StoreOS</h1>
        <p style="color:#93c5fd;margin:4px 0 0;font-size:13px">🇪🇹 Ethiopian Store Management</p>
      </div>
      <div style="padding:28px 32px">
        <h2 style="font-size:18px;margin:0 0 4px;color:#111">Receipt — ${sale.invoiceNo}</h2>
        <p style="color:#6b7280;font-size:13px;margin:0 0 24px">
          ${new Date(sale.createdAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
          · Cashier: ${sale.user?.name || '—'}
        </p>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#f9fafb;font-size:11px;text-transform:uppercase;color:#6b7280">
              <th style="padding:8px 12px;text-align:left">Item</th>
              <th style="padding:8px 12px;text-align:center">Qty</th>
              <th style="padding:8px 12px;text-align:right">Unit</th>
              <th style="padding:8px 12px;text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="border-top:2px solid #e5e7eb;margin-top:12px;padding-top:12px;text-align:right">
          <span style="font-size:18px;font-weight:bold;color:#1d4ed8">Total: ETB ${subtotal.toFixed(2)}</span>
        </div>
        <p style="margin:24px 0 0;color:#6b7280;font-size:13px;text-align:center">Thank you for shopping with us, ${sale.customer?.name || 'valued customer'}!</p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: FROM,
      to: customerEmail,
      subject: `Your receipt — ${sale.invoiceNo} · StoreOS`,
      html,
    });
    console.log(`[Email] Receipt sent to ${customerEmail}`);
  } catch (err) {
    console.error('[Email] Failed to send receipt:', err);
  }
}

// ── Send low-stock alert to admin ─────────────────────────────────────────────

export async function sendLowStockAlert(products: {
  name: string;
  sku: string;
  stock: number;
  minStockLevel: number;
}[]) {
  const transporter = createTransporter();
  if (!transporter || !ADMIN_EMAIL) return;

  const outOfStock = products.filter(p => p.stock === 0);
  const lowStock   = products.filter(p => p.stock > 0 && p.stock <= p.minStockLevel);

  if (!products.length) return;

  const section = (title: string, items: typeof products, color: string) =>
    items.length === 0 ? '' : `
      <h3 style="font-size:14px;color:${color};margin:16px 0 8px">${title} (${items.length})</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#f9fafb;color:#6b7280;font-size:11px;text-transform:uppercase">
          <th style="padding:6px 10px;text-align:left">Product</th>
          <th style="padding:6px 10px;text-align:left">SKU</th>
          <th style="padding:6px 10px;text-align:center">Stock</th>
          <th style="padding:6px 10px;text-align:center">Min</th>
        </tr></thead>
        <tbody>${items.map(p => `
          <tr>
            <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0">${p.name}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;font-family:monospace;color:#6b7280">${p.sku}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:bold;color:${color}">${p.stock}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;text-align:center;color:#9ca3af">${p.minStockLevel}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <div style="background:#dc2626;padding:20px 28px">
        <h1 style="color:#fff;margin:0;font-size:20px">⚠ Stock Alert — StoreOS</h1>
        <p style="color:#fca5a5;margin:4px 0 0;font-size:13px">${new Date().toLocaleString('en-US', { dateStyle: 'full' })}</p>
      </div>
      <div style="padding:24px 28px">
        <p style="color:#374151;margin:0 0 16px">${products.length} product(s) require attention in your inventory.</p>
        ${section('Out of Stock', outOfStock, '#dc2626')}
        ${section('Low Stock',    lowStock,   '#d97706')}
        <div style="margin-top:24px;padding:12px 16px;background:#eff6ff;border-radius:8px;border-left:4px solid #1d4ed8">
          <p style="margin:0;font-size:13px;color:#1d4ed8">
            <strong>Action needed:</strong> Visit the Purchase Orders section in StoreOS to create restock orders.
          </p>
        </div>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: FROM,
      to: ADMIN_EMAIL,
      subject: `⚠ Stock Alert: ${outOfStock.length} out of stock, ${lowStock.length} low — StoreOS`,
      html,
    });
    console.log(`[Email] Low-stock alert sent to ${ADMIN_EMAIL}`);
  } catch (err) {
    console.error('[Email] Failed to send stock alert:', err);
  }
}

// ── Daily stock check (call this from a cron or on server start) ──────────────

export async function checkAndAlertLowStock(prisma: any) {
  const products = await prisma.product.findMany();
  const alerts = products.filter((p: any) => p.stock <= p.minStockLevel);
  if (alerts.length) await sendLowStockAlert(alerts);
}
