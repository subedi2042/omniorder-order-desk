import { requireSalesUser } from "../_auth";
import { postgres } from "../../../db/postgres";

async function ensureTable(sql: NonNullable<ReturnType<typeof postgres>>) {
  await sql`CREATE TABLE IF NOT EXISTS order_list_drafts (sales_sub TEXT PRIMARY KEY, customer_id TEXT NOT NULL, skus JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`ALTER TABLE order_list_drafts ADD COLUMN IF NOT EXISTS quantities JSONB NOT NULL DEFAULT '{}'::jsonb`;
}

export async function GET(request: Request) {
  const user = await requireSalesUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const sql = postgres();
    if (!sql) throw new Error("DATABASE_URL is not configured");
    await ensureTable(sql);
    const draft = (await sql`SELECT d.customer_id AS "customerId",d.skus,d.quantities,d.updated_at AS "updatedAt",c.business AS "customerName" FROM order_list_drafts d LEFT JOIN customers c ON c.id=d.customer_id WHERE d.sales_sub=${user.sub} LIMIT 1`)[0] || null;
    return Response.json({ draft });
  } catch (error) { console.error("Draft load failed", error); return Response.json({ error: "Draft unavailable" }, { status: 503 }); }
}

export async function POST(request: Request) {
  const user = await requireSalesUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { customerId, skus, quantities } = await request.json() as { customerId?: string; skus?: string[]; quantities?: Record<string, number> };
  if (!customerId || !Array.isArray(skus)) return Response.json({ error: "Customer and products required" }, { status: 400 });
  try {
    const sql = postgres();
    if (!sql) throw new Error("DATABASE_URL is not configured");
    await ensureTable(sql);
    await sql`INSERT INTO order_list_drafts (sales_sub,customer_id,skus,quantities,updated_at) VALUES (${user.sub},${customerId},${JSON.stringify(skus)},${JSON.stringify(quantities || {})},NOW()) ON CONFLICT(sales_sub) DO UPDATE SET customer_id=excluded.customer_id,skus=excluded.skus,quantities=excluded.quantities,updated_at=NOW()`;
    return Response.json({ saved: true, updatedAt: new Date().toISOString() });
  } catch (error) { console.error("Draft save failed", error); return Response.json({ error: "Draft could not be saved" }, { status: 503 }); }
}

export async function DELETE(request: Request) {
  const user = await requireSalesUser(request);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const sql = postgres();
    if (!sql) throw new Error("DATABASE_URL is not configured");
    await ensureTable(sql);
    await sql`DELETE FROM order_list_drafts WHERE sales_sub=${user.sub}`;
    return Response.json({ deleted: true });
  } catch (error) { console.error("Draft delete failed", error); return Response.json({ error: "Draft could not be deleted" }, { status: 503 }); }
}
