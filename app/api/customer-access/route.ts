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
