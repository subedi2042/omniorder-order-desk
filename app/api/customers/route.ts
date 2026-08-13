import { requireSalesUser } from "../_auth";
import { postgres } from "../../../db/postgres";

type CustomerInput = { id: string; business: string; contact: string; email: string; phone: string; address: string; accessCode?: string; codeExpiresAt?: string };
const database = () => { const sql = postgres(); if (!sql) throw new Error("DATABASE_URL is not configured"); return sql; };

export async function GET(request: Request) {
  if (!await requireSalesUser(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try { const customers = await database()`SELECT id,business,contact,email,phone,address,access_code AS "accessCode",code_expires_at AS "codeExpiresAt" FROM customers ORDER BY business`; return Response.json({ customers }); }
  catch (error) { console.error("Customer load failed", error); return Response.json({ error: "Customer storage unavailable" }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!await requireSalesUser(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { customers } = await request.json() as { customers: CustomerInput[] };
  try { const sql = database(); for (const customer of customers) await sql`INSERT INTO customers (id,business,contact,email,phone,address,access_code,code_expires_at,updated_at) VALUES (${customer.id},${customer.business},${customer.contact},${customer.email},${customer.phone},${customer.address},${customer.accessCode || null},${customer.codeExpiresAt || null},${Date.now()}) ON CONFLICT(id) DO UPDATE SET business=excluded.business,contact=excluded.contact,email=excluded.email,phone=excluded.phone,address=excluded.address,access_code=excluded.access_code,code_expires_at=excluded.code_expires_at,updated_at=excluded.updated_at`; return Response.json({ saved: customers.length, storage: "postgres" }); }
  catch (error) { console.error("Customer save failed", error); return Response.json({ error: "Customers could not be saved" }, { status: 503 }); }
}

export async function DELETE(request: Request) {
  if (!await requireSalesUser(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await request.json() as { id?: string };
  if (!id) return Response.json({ error: "Customer id required" }, { status: 400 });
  try { await database()`DELETE FROM customers WHERE id = ${id}`; return Response.json({ deleted: id }); }
  catch (error) { console.error("Customer delete failed", error); return Response.json({ error: "Customer could not be deleted" }, { status: 503 }); }
}
