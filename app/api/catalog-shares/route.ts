import { requireSalesUser } from "../_auth";
import { postgres } from "../../../db/postgres";

async function ensureTable(sql: NonNullable<ReturnType<typeof postgres>>) {
  await sql`CREATE TABLE IF NOT EXISTS catalog_shares (token TEXT PRIMARY KEY, customer_id TEXT NOT NULL, skus JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
}

export async function POST(request: Request) {
  if (!await requireSalesUser(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { customerId, skus } = await request.json() as { customerId?: string; skus?: string[] };
  if (!customerId || !Array.isArray(skus) || !skus.length) return Response.json({ error: "Customer and products required" }, { status: 400 });
  try {
    const sql = postgres();
    if (!sql) throw new Error("DATABASE_URL is not configured");
    await ensureTable(sql);
    const token = `dk_${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await sql`INSERT INTO catalog_shares (token,customer_id,skus,expires_at) VALUES (${token},${customerId},${JSON.stringify(skus)},${expiresAt})`;
    return Response.json({ token, expiresAt });
  } catch (error) { console.error("Catalog share creation failed", error); return Response.json({ error: "Secure link could not be created" }, { status: 503 }); }
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  try {
    const sql = postgres();
    if (!sql) throw new Error("DATABASE_URL is not configured");
    await ensureTable(sql);
    const share = (await sql`SELECT customer_id AS "customerId",skus,expires_at AS "expiresAt" FROM catalog_shares WHERE token=${token} AND expires_at>NOW() LIMIT 1`)[0];
    if (!share) return Response.json({ error: "Invalid or expired secure link" }, { status: 404 });
    const customer = (await sql`SELECT id,business,contact,email,phone,address FROM customers WHERE id=${share.customerId} LIMIT 1`)[0];
    const allowed = new Set(Array.isArray(share.skus) ? share.skus.map(String) : []);
    const rows = await sql`SELECT sku,name,category,pack,stock,published FROM products WHERE published=TRUE ORDER BY CASE WHEN BTRIM(sku) ~ '^[0-9]+$' THEN BTRIM(sku)::numeric END NULLS LAST,BTRIM(sku)`;
    return Response.json({ customer: customer ? { ...customer, shareToken: token } : null, products: rows.filter((product: any) => allowed.has(String(product.sku))), expiresAt: share.expiresAt });
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
    await sql`UPDATE customers SET business=${business},contact=${contact},email=${email},phone=${phone},address=${address},updated_at=NOW() WHERE id=${String(customer.id)}`;
    return Response.json({ saved: true });
  } catch (error) { console.error("Shared customer update failed", error); return Response.json({ error: "Customer update unavailable" }, { status: 503 }); }
}
