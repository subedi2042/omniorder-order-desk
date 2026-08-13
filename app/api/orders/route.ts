import { requireSalesUser } from "../_auth";
import { postgres } from "../../../db/postgres";

async function ensureTable(sql: NonNullable<ReturnType<typeof postgres>>) {
  await sql`CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,customer_snapshot JSONB NOT NULL,items JSONB NOT NULL,status TEXT NOT NULL DEFAULT 'request',source_token TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
}

export async function GET(request: Request) {
  if (!await requireSalesUser(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const sql = postgres();
    if (!sql) throw new Error("DATABASE_URL is not configured");
    await ensureTable(sql);
    const orders = await sql`SELECT id,customer_id AS "customerId",customer_snapshot AS customer,items,status,created_at AS "createdAt",updated_at AS "updatedAt" FROM orders ORDER BY created_at DESC`;
    return Response.json({ orders });
  } catch (error) { console.error("Order load failed", error); return Response.json({ error: "Orders unavailable" }, { status: 503 }); }
}

export async function POST(request: Request) {
  const body = await request.json() as { token?: string; accessCode?: string; customer?: Record<string, unknown>; items?: Array<{ sku?: string; quantity?: number }> };
  const customerId = String(body.customer?.id || "");
  const items = (body.items || []).map((item) => ({ sku: String(item.sku || "").trim(), quantity: Math.max(0, Math.floor(Number(item.quantity) || 0)) })).filter((item) => item.sku && item.quantity > 0);
  if (!customerId || !items.length) return Response.json({ error: "Customer and order items required" }, { status: 400 });
  try {
    const sql = postgres();
    if (!sql) throw new Error("DATABASE_URL is not configured");
    await ensureTable(sql);
    let authorized = false;
    if (body.token) {
      const share = (await sql`SELECT customer_id AS "customerId",skus FROM catalog_shares WHERE token=${body.token} AND expires_at>NOW() LIMIT 1`)[0];
      const allowed = new Set(Array.isArray(share?.skus) ? share.skus.map(String) : []);
      authorized = Boolean(share && share.customerId === customerId && items.every((item) => allowed.has(item.sku)));
    } else if (body.accessCode) {
      const customer = (await sql`SELECT id FROM customers WHERE id=${customerId} AND access_code=${String(body.accessCode).toUpperCase()} AND code_expires_at>NOW() LIMIT 1`)[0];
      authorized = Boolean(customer);
    }
    if (!authorized) return Response.json({ error: "Invalid or expired customer access" }, { status: 401 });
    const id = `OR-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    await sql`INSERT INTO orders (id,customer_id,customer_snapshot,items,status,source_token) VALUES (${id},${customerId},${JSON.stringify(body.customer)},${JSON.stringify(items)},'request',${body.token || null})`;
    return Response.json({ order: { id, customerId, customer: body.customer, items, status: "request", createdAt: new Date().toISOString() } });
  } catch (error) { console.error("Order save failed", error); return Response.json({ error: "Order could not be saved" }, { status: 503 }); }
}

export async function PUT(request: Request) {
  const user = await requireSalesUser(request);
  const { id, status, token } = await request.json() as { id?: string; status?: string; token?: string };
  if (!id || !["request", "proforma", "approved"].includes(String(status))) return Response.json({ error: "Order and valid status required" }, { status: 400 });
  try {
    const sql = postgres();
    if (!sql) throw new Error("DATABASE_URL is not configured");
    await ensureTable(sql);
    const order = (await sql`SELECT source_token AS "sourceToken" FROM orders WHERE id=${id} LIMIT 1`)[0];
    if (!order || (!user && (!token || token !== order.sourceToken))) return Response.json({ error: "Unauthorized" }, { status: 401 });
    await sql`UPDATE orders SET status=${status},updated_at=NOW() WHERE id=${id}`;
    return Response.json({ id, status });
  } catch (error) { console.error("Order status update failed", error); return Response.json({ error: "Order status could not be saved" }, { status: 503 }); }
}
