import { env } from "cloudflare:workers";

export async function POST(request: Request) {
  const { code } = await request.json() as { code?: string };
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return Response.json({ error: "Code required" }, { status: 400 });
  try {
    const customer = await env.DB.prepare("SELECT id, business, contact, email, phone, address, access_code AS accessCode, code_expires_at AS codeExpiresAt FROM customers WHERE access_code = ? LIMIT 1").bind(normalized).first();
    if (!customer || !customer.codeExpiresAt || new Date(String(customer.codeExpiresAt)).getTime() <= Date.now()) return Response.json({ error: "Invalid or expired code" }, { status: 401 });
    return Response.json({ customer });
  } catch {
    return Response.json({ error: "Access verification unavailable" }, { status: 503 });
  }
}
