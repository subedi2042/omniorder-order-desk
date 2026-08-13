import { postgres } from "../../../../db/postgres";

const encoder = new TextEncoder();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const decode = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")), (character) => character.charCodeAt(0));

async function hashPassword(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return encode(new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 210000 }, material, 256)));
}

async function sign(payload: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return encode(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))));
}

async function sessionCookie(user: { id: string; email: string; name: string }, secret: string) {
  const payload = encode(encoder.encode(JSON.stringify({ sub: user.id, email: user.email, name: user.name, picture: "", exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 })));
  return `omniorder_sales_session=${payload}.${await sign(payload, secret)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

async function prepareDatabase() {
  const sql = postgres();
  if (!sql) throw new Error("DATABASE_URL is not configured");
  await sql`CREATE TABLE IF NOT EXISTS sales_users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at BIGINT NOT NULL
  )`;
  return sql;
}

export async function POST(request: Request) {
  try {
    const secret = process.env.AUTH_SESSION_SECRET || "";
    if (!secret) return Response.json({ error: "Sales authentication is not configured." }, { status: 503 });
    const body = await request.json() as { action?: "register" | "login"; email?: string; password?: string; name?: string };
    const email = body.email?.trim().toLowerCase() || "";
    const password = body.password || "";
    if (!emailPattern.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    if (password.length < 8) return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    const sql = await prepareDatabase();
    if (body.action === "register") {
      const name = body.name?.trim() || "";
      if (name.length < 2) return Response.json({ error: "Enter your full name." }, { status: 400 });
      const existing = await sql`SELECT id FROM sales_users WHERE email = ${email} LIMIT 1`;
      if (existing.length) return Response.json({ error: "An account already exists for this email. Sign in instead." }, { status: 409 });
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const user = { id: crypto.randomUUID(), email, name };
      await sql`INSERT INTO sales_users (id, email, name, password_hash, password_salt, created_at) VALUES (${user.id}, ${email}, ${name}, ${await hashPassword(password, salt)}, ${encode(salt)}, ${Date.now()})`;
      return Response.json({ user: { sub: user.id, email, name } }, { headers: { "Set-Cookie": await sessionCookie(user, secret) } });
    }
    const records = await sql`SELECT id, email, name, password_hash, password_salt FROM sales_users WHERE email = ${email} LIMIT 1`;
    const record = records[0] as { id: string; email: string; name: string; password_hash: string; password_salt: string } | undefined;
    if (!record || await hashPassword(password, decode(record.password_salt)) !== record.password_hash) return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
    return Response.json({ user: { sub: record.id, email: record.email, name: record.name } }, { headers: { "Set-Cookie": await sessionCookie(record, secret) } });
  } catch {
    return Response.json({ error: "Sales authentication is temporarily unavailable." }, { status: 500 });
  }
}
