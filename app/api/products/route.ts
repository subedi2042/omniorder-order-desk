import { requireSalesUser } from "../_auth";
import { postgres } from "../../../db/postgres";

type ProductInput = { sku: string; name: string; category: string; pack: string; price: number; stock: number; published: boolean };

function database() {
  const sql = postgres();
  if (!sql) throw new Error("DATABASE_URL is not configured");
  return sql;
}

export async function GET(request: Request) {
  if (!await requireSalesUser(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const results = await database()`SELECT sku,name,category,pack,price_cents,stock,published FROM products ORDER BY CASE WHEN BTRIM(sku) ~ '^[0-9]+$' THEN BTRIM(sku)::numeric END NULLS LAST, BTRIM(sku)`;
    return Response.json({ products: results.map((product: any) => ({ ...product, price: Number(product.price_cents) / 100, stock: Number(product.stock), published: Boolean(product.published) })) });
  } catch (error) { console.error("Product load failed", error); return Response.json({ error: "Catalog storage unavailable" }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!await requireSalesUser(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json() as { products?: ProductInput[]; replaceAll?: boolean };
  const products = (body.products || []).map((product) => ({ ...product, sku: String(product.sku || "").trim(), name: String(product.name || "").trim(), category: String(product.category || "").trim(), pack: String(product.pack || "Each").trim(), price: Math.max(0, Number(product.price) || 0), stock: Math.max(0, Math.floor(Number(product.stock) || 0)), published: Boolean(product.published) })).filter((product) => product.sku && product.name && product.category);
  if (!products.length) return Response.json({ error: "At least one valid product is required" }, { status: 400 });
  try {
    const sql = database();
    if (body.replaceAll) {
      const catalogJson = JSON.stringify(products);
      await sql.transaction([
        sql`DELETE FROM products`,
        sql`INSERT INTO products (sku,name,category,pack,price_cents,stock,published,updated_at)
            SELECT item.sku,item.name,item.category,item.pack,ROUND(item.price * 100)::integer,item.stock,item.published,${Date.now()}
            FROM jsonb_to_recordset(${catalogJson}::jsonb)
            AS item(sku text,name text,category text,pack text,price numeric,stock integer,published boolean)`
      ]);
      return Response.json({ saved: products.length, replacedCatalog: true, storage: "postgres" });
    }
    for (const product of products) await sql`INSERT INTO products (sku,name,category,pack,price_cents,stock,published,updated_at) VALUES (${product.sku},${product.name},${product.category},${product.pack},${Math.round(product.price * 100)},${product.stock},${product.published},${Date.now()}) ON CONFLICT(sku) DO UPDATE SET name=excluded.name,category=excluded.category,pack=excluded.pack,price_cents=excluded.price_cents,stock=excluded.stock,published=excluded.published,updated_at=excluded.updated_at`;
    return Response.json({ saved: products.length, replacedBySku: true, storage: "postgres" });
  } catch (error) { console.error("Product save failed", error); return Response.json({ error: "Catalog could not be saved" }, { status: 503 }); }
}

export async function DELETE(request: Request) {
  if (!await requireSalesUser(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { sku, all } = await request.json() as { sku?: string; all?: boolean };
  try {
    const sql = database();
    if (all) { await sql`DELETE FROM products`; return Response.json({ cleared: true }); }
    if (!sku?.trim()) return Response.json({ error: "Product SKU required" }, { status: 400 });
    await sql`DELETE FROM products WHERE sku = ${sku.trim()}`;
    return Response.json({ deleted: sku.trim() });
  } catch (error) { console.error("Product delete failed", error); return Response.json({ error: "Catalog could not be updated" }, { status: 503 }); }
}
