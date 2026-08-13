import { postgres } from "../../../db/postgres";

export async function POST(request: Request) {
  const { code } = await request.json() as { code?: string };
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return Response.json({ error: "Code required" }, { status: 400 });
  try {
    const sql = postgres();
    if (!sql) throw new Error("DATABASE_URL is not configured");
    const customer = (await sql`SELECT id,business,contact,email,phone,address,access_code AS "accessCode",code_expires_at AS "codeExpiresAt" FROM customers WHERE access_code = ${normalized} LIMIT 1`)[0];
    if (!customer || !customer.codeExpiresAt || new Date(String(customer.codeExpiresAt)).getTime() <= Date.now()) return Response.json({ error: "Invalid or expired code" }, { status: 401 });
    return Response.json({ customer });
  } catch (error) { console.error("Access verification failed", error); return Response.json({ error: "Access verification unavailable" }, { status: 503 }); }
}

export async function PUT(request: Request) {
  const body = await request.json() as { code?: string; customer?: Record<string, unknown> };
  const normalized = String(body.code || "").trim().toUpperCase();
  const input = body.customer || {};
  const customer = { id: String(input.id || "").trim(), business: String(input.business || "").trim(), contact: String(input.contact || "").trim(), email: String(input.email || "").trim(), phone: String(input.phone || "").trim(), address: String(input.address || "").trim() };
  if (!normalized) return Response.json({ error: "Code required" }, { status: 400 });
  if (!customer.id || !customer.business || !customer.contact || !customer.email || !customer.phone || !customer.address) return Response.json({ error: "Complete customer details required" }, { status: 400 });
  try {
    const sql = postgres();
    if (!sql) throw new Error("DATABASE_URL is not configured");
    const existing = (await sql`SELECT id,code_expires_at AS "codeExpiresAt" FROM customers WHERE id=${customer.id} AND access_code=${normalized} LIMIT 1`)[0];
    if (!existing || !existing.codeExpiresAt || new Date(String(existing.codeExpiresAt)).getTime() <= Date.now()) return Response.json({ error: "Invalid or expired code" }, { status: 401 });
    await sql`UPDATE customers SET business=${customer.business},contact=${customer.contact},email=${customer.email},phone=${customer.phone},address=${customer.address},updated_at=${Date.now()} WHERE id=${customer.id}`;
    return Response.json({ customer: { ...customer, accessCode: normalized, codeExpiresAt: existing.codeExpiresAt } });
  } catch (error) { console.error("Customer update failed", error); return Response.json({ error: "Customer update unavailable" }, { status: 503 }); }
}
