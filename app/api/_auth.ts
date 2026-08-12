const encoder = new TextEncoder();
const decode = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")), (character) => character.charCodeAt(0));
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
async function sign(payload: string, secret: string) { const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return encode(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)))); }
export async function requireSalesUser(request: Request) {
  const secret = process.env.AUTH_SESSION_SECRET || "";
  const cookie = request.headers.get("cookie")?.split(";").map((value) => value.trim()).find((value) => value.startsWith("omniorder_sales_session="))?.slice("omniorder_sales_session=".length);
  if (!secret || !cookie) return null;
  const [payload, signature] = cookie.split("."); if (!payload || !signature || await sign(payload, secret) !== signature) return null;
  const user = JSON.parse(new TextDecoder().decode(decode(payload))) as { sub: string; email: string; name: string; exp: number };
  return user.exp > Date.now() / 1000 ? user : null;
}
