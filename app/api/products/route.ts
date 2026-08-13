import { env } from "cloudflare:workers";
import { requireSalesUser } from "../_auth";
import { postgres } from "../../../db/postgres";

async function ensureTable() { await env.DB.prepare("CREATE TABLE IF NOT EXISTS products (sku TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, pack TEXT NOT NULL, price_cents INTEGER NOT NULL, stock INTEGER NOT NULL, published INTEGER NOT NULL, updated_at INTEGER NOT NULL)").run(); }
export async function GET(request: Request) { if (!await requireSalesUser(request)) return Response.json({ error: "Unauthorized" }, { status: 401 }); const sql = postgres(); const results = sql ? await sql`SELECT sku,name,category,pack,price_cents,stock,published FROM products ORDER BY name` : (await (async () => { await ensureTable(); return env.DB.prepare("SELECT sku,name,category,pack,price_cents,stock,published FROM products ORDER BY name").all(); })()).results; return Response.json({ products: results.map((product: any) => ({ ...product, price: Number(product.price_cents) / 100, stock: Number(product.stock), published: Boolean(product.published) })) }); }
export async function POST(request: Request) {
  if (!await requireSalesUser(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as { products?: Array<{ sku: string; name: string; category: string; pack: string; price: number; stock: number; published: boolean }> };
  const products = (body.products || []).map((product) => ({ ...product, sku: String(product.sku || "").trim(), name: String(product.name || "").trim(), category: String(product.category || "Imported").trim(), pack: String(product.pack || "Each").trim(), price: Math.max(0, Number(product.price) || 0), stock: Math.max(0, Math.floor(Number(product.stock) || 0)), published: Boolean(product.published) })).filter((product) => product.sku && product.name);
  if (!products.length) return Response.json({ error: "At least one valid product is required" }, { status: 400 });
  const sql = postgres();
  if (sql) {
    for (const product of products) await sql`INSERT INTO products (sku,name,category,pack,price_cents,stock,published,updated_at) VALUES (${product.sku},${product.name},${product.category},${product.pack},${Math.round(product.price * 100)},${product.stock},${product.published},${Date.now()}) ON CONFLICT(sku) DO UPDATE SET name=excluded.name,category=excluded.category,pack=excluded.pack,price_cents=excluded.price_cents,stock=excluded.stock,published=excluded.published,updated_at=excluded.updated_at`;
    return Response.json({ saved: products.length, replacedBySku: true, storage: "postgres" });
  }
  await ensureTable();
  const statement = "INSERT INTO products (sku,name,category,pack,price_cents,stock,published,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(sku) DO UPDATE SET name=excluded.name,category=excluded.category,pack=excluded.pack,price_cents=excluded.price_cents,stock=excluded.stock,published=excluded.published,updated_at=excluded.updated_at";
  for (let index = 0; index < products.length; index += 100) {
    await env.DB.batch(products.slice(index, index + 100).map((product) => env.DB.prepare(statement).bind(product.sku, product.name, product.category, product.pack, Math.round(product.price * 100), product.stock, product.published ? 1 : 0, Date.now())));
  }
  return Response.json({ saved: products.length, replacedBySku: true });
}
export async function DELETE(request: Request) {
  if (!await requireSalesUser(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { sku, all } = await request.json() as { sku?: string; all?: boolean };
  const sql = postgres();
  if (all) { if (sql) await sql`DELETE FROM products`; else { await ensureTable(); await env.DB.prepare("DELETE FROM products").run(); } return Response.json({ cleared: true }); }
  if (!sku?.trim()) return Response.json({ error: "Product SKU required" }, { status: 400 });
  if (sql) await sql`DELETE FROM products WHERE sku = ${sku.trim()}`; else { await ensureTable(); await env.DB.prepare("DELETE FROM products WHERE sku = ?").bind(sku.trim()).run(); }
  return Response.json({ deleted: sku.trim() });
}
