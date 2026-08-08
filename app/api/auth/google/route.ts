const encoder = new TextEncoder();

type GoogleClaims = {
  aud: string | string[];
  email: string;
  email_verified: boolean;
  exp: number;
  iss: string;
  name?: string;
  picture?: string;
  sub: string;
};

const base64UrlDecode = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
};

const base64UrlEncode = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

async function verifyGoogleCredential(credential: string, clientId: string): Promise<GoogleClaims> {
  const parts = credential.split(".");
  if (parts.length !== 3) throw new Error("Malformed Google credential");
  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0]))) as { alg?: string; kid?: string };
  const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1]))) as GoogleClaims;
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported Google credential");
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!response.ok) throw new Error("Google signing keys are unavailable");
  const { keys } = await response.json() as { keys: JsonWebKey[] };
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("Google signing key was not found");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const validSignature = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, base64UrlDecode(parts[2]), encoder.encode(`${parts[0]}.${parts[1]}`));
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!validSignature || !audience.includes(clientId) || !["accounts.google.com", "https://accounts.google.com"].includes(claims.iss) || claims.exp <= Date.now() / 1000 || !claims.email_verified) throw new Error("Google credential validation failed");
  return claims;
}

async function signSession(payload: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64UrlEncode(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload))));
}

async function createSession(claims: GoogleClaims, secret: string) {
  const payload = base64UrlEncode(encoder.encode(JSON.stringify({ sub: claims.sub, email: claims.email, name: claims.name || claims.email, picture: claims.picture || "", exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 })));
  return `${payload}.${await signSession(payload, secret)}`;
}

async function readSession(request: Request, secret: string) {
  const cookie = request.headers.get("cookie")?.split(";").map((value) => value.trim()).find((value) => value.startsWith("omniorder_sales_session="))?.split("=")[1];
  if (!cookie) return null;
  const [payload, signature] = cookie.split(".");
  if (!payload || !signature || await signSession(payload, secret) !== signature) return null;
  const user = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as { sub: string; email: string; name: string; picture: string; exp: number };
  return user.exp > Date.now() / 1000 ? user : null;
}

const configuration = () => ({ clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "", secret: process.env.AUTH_SESSION_SECRET || "" });

export async function GET(request: Request) {
  const { secret } = configuration();
  if (!secret) return Response.json({ user: null });
  return Response.json({ user: await readSession(request, secret) });
}

export async function POST(request: Request) {
  try {
    const { clientId, secret } = configuration();
    if (!clientId || !secret) return Response.json({ error: "Google sign-in is not configured." }, { status: 503 });
    const { credential } = await request.json() as { credential?: string };
    if (!credential) return Response.json({ error: "Google did not return a credential." }, { status: 400 });
    const claims = await verifyGoogleCredential(credential, clientId);
    const session = await createSession(claims, secret);
    const user = { sub: claims.sub, email: claims.email, name: claims.name || claims.email, picture: claims.picture || "" };
    return Response.json({ user }, { headers: { "Set-Cookie": `omniorder_sales_session=${session}; HttpOnly; Path=/; SameSite=Lax; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}` } });
  } catch {
    return Response.json({ error: "Google sign-in could not be verified." }, { status: 401 });
  }
}

export async function DELETE() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": "omniorder_sales_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0" } });
}
