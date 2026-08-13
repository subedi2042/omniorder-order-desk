import { requireSalesUser } from "../_auth";
import { postgres } from "../../../db/postgres";

async function ensureTable(sql: NonNullable<ReturnType<typeof postgres>>) {
  await sql`CREATE TABLE IF NOT EXISTS catalog_shares (token TEXT PRIMARY KEY, customer_id TEXT NOT NULL, skus JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`ALTER TABLE catalog_shares ADD COLUMN IF NOT EXISTS quantities JSONB NOT NULL DEFAULT '{}'::jsonb`;
}

export async function POST(request: Request) {
  if (!await requireSalesUser(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { customerId, skus, quantities } = await request.json() as { customerId?: string; skus?: string[]; quantities?: Record<string, number> };
  if (!customerId || !Array.isArray(skus) || !skus.length) return Response.json({ error: "Customer and products required" }, { status: 400 });
  try {
    const sql = postgres();
    if (!sql) throw new Error("DATABASE_URL is not configured");
    await ensureTable(sql);
    const token = `dk_${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await sql`INSERT INTO catalog_shares (token,customer_id,skus,quantities,expires_at) VALUES (${token},${customerId},${JSON.stringify(skus)},${JSON.stringify(quantities || {})},${expiresAt})`;
    await sql`CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,customer_snapshot JSONB NOT NULL,items JSONB NOT NULL,status TEXT NOT NULL DEFAULT 'request',source_token TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    const customer = (await sql`SELECT id,business,contact,email,phone,address FROM customers WHERE id=${customerId} LIMIT 1`)[0];
    const orderId = `OR-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const items = skus.map((sku) => ({ sku, quantity: Math.max(1, Math.floor(Number(quantities?.[sku]) || 1)) }));
    await sql`INSERT INTO orders (id,customer_id,customer_snapshot,items,status,source_token) VALUES (${orderId},${customerId},${JSON.stringify(customer || { id: customerId })},${JSON.stringify(items)},'request',${token})`;
    return Response.json({ token, expiresAt, orderId, selectedCount: items.length });
  } catch (error) { console.error("Catalog share creation failed", error); return Response.json({ error: "Secure link could not be created" }, { status: 503 }); }
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  try {
    const sql = postgres();
    if (!sql) throw new Error("DATABASE_URL is not configured");
    await ensureTable(sql);
    const share = (await sql`SELECT customer_id AS "customerId",skus,quantities,expires_at AS "expiresAt" FROM catalog_shares WHERE token=${token} AND expires_at>NOW() LIMIT 1`)[0];
    if (!share) return Response.json({ error: "Invalid or expired secure link" }, { status: 404 });
    const customer = (await sql`SELECT id,business,contact,email,phone,address FROM customers WHERE id=${share.customerId} LIMIT 1`)[0];
    const allowed = new Set(Array.isArray(share.skus) ? share.skus.map(String) : []);
    const rows = await sql`SELECT sku,name,category,pack,stock,published FROM products WHERE published=TRUE ORDER BY CASE WHEN BTRIM(sku) ~ '^[0-9]+$' THEN BTRIM(sku)::numeric END NULLS LAST,BTRIM(sku)`;
    return Response.json({ customer: customer ? { ...customer, shareToken: token } : null, products: rows.filter((product: any) => allowed.has(String(product.sku))), initialQuantities: share.quantities || {}, expiresAt: share.expiresAt });
  } catch (error) { console.error("Catalog share load failed", error); return Response.json({ error: "Secure catalog unavailable" }, { status: 503 }); }
}

export async function PUT(request: Request) {
  const { token, customer } = await request.json() as { token?: string; customer?: Record<string, unknown> };
  if (!token || !customer?.id) return Response.json({ error: "Secure link and customer required" }, { status: 400 });
  try {
    const sql = postgres();
    if (!sql) throw new Error("DATABASE_URL is not configured");
    await ensureTable(sql);
    const share = (await sql`SELECT customer_id AS "customerId" FROM catalog_shares WHERE token=${token} AND expires_at>NOW() LIMIT 1`)[0];
    if (!share || share.customerId !== String(customer.id)) return Response.json({ error: "Invalid or expired secure link" }, { status: 401 });
    const business=String(customer.business||"").trim(),contact=String(customer.contact||"").trim(),email=String(customer.email||"").trim(),phone=String(customer.phone||"").trim(),address=String(customer.address||"").trim();
    if (!business || !contact || !email || !phone || !address) return Response.json({ error: "Complete customer details required" }, { status: 400 });
    await sql`UPDATE customers SET business=${business},contact=${contact},email=${email},phone=${phone},address=${address},updated_at=${Date.now()} WHERE id=${String(customer.id)}`;
    return Response.json({ saved: true });
  } catch (error) { console.error("Shared customer update failed", error); return Response.json({ error: "Customer update unavailable" }, { status: 503 }); }
}
