import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Edge Function: send-push
 * Sends encrypted Web Push notifications (RFC 8291 / aes128gcm)
 * Input: { user_id, title, body, url?, tag? }
 */

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const VAPID_SUBJECT = "mailto:support@deal-buddy.app";

// ─── Helpers ────────────────────────────────────────────────────────────────

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const len = arrays.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(len);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ─── VAPID JWT ──────────────────────────────────────────────────────────────

function buildPkcs8(raw32: Uint8Array): ArrayBuffer {
  const prefix = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
    0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  const result = new Uint8Array(prefix.length + raw32.length);
  result.set(prefix);
  result.set(raw32, prefix.length);
  return result.buffer;
}

function derToRaw(der: Uint8Array): Uint8Array {
  if (der.length === 64) return der;
  if (der[0] !== 0x30) return der;
  let offset = 2;
  const rLen = der[offset + 1];
  offset += 2;
  const r = der.slice(offset, offset + rLen);
  offset += rLen;
  const sLen = der[offset + 1];
  offset += 2;
  const s = der.slice(offset, offset + sLen);
  const raw = new Uint8Array(64);
  raw.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
  raw.set(s.length > 32 ? s.slice(s.length - 32) : s, 64 - Math.min(s.length, 32));
  return raw;
}

async function createVapidJwt(endpoint: string): Promise<string> {
  const aud = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify({ aud, exp: now + 12 * 3600, sub: VAPID_SUBJECT })));
  const signingInput = `${header}.${payload}`;

  const rawKey = b64urlDecode(VAPID_PRIVATE_KEY);
  const keyData = rawKey.length === 32 ? buildPkcs8(rawKey) : rawKey.buffer;
  const key = await crypto.subtle.importKey("pkcs8", keyData, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64urlEncode(derToRaw(new Uint8Array(sig)))}`;
}

// ─── Web Push Encryption (RFC 8291 aes128gcm) ─────────────────────────────

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  // Extract
  const extractKey = await crypto.subtle.importKey("raw", salt.length ? salt : new Uint8Array(32), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", extractKey, ikm));
  // Expand
  const expandKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const okm = new Uint8Array(await crypto.subtle.sign("HMAC", expandKey, concat(info, new Uint8Array([1]))));
  return okm.slice(0, length);
}

async function encryptPayload(
  clientPublicKeyB64: string,
  clientAuthB64: string,
  payload: string
): Promise<Uint8Array> {
  const clientPublicKeyBytes = b64urlDecode(clientPublicKeyB64);
  const clientAuth = b64urlDecode(clientAuthB64);
  const payloadBytes = new TextEncoder().encode(payload);

  // Generate ephemeral ECDH key pair
  const serverKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const serverPublicKey = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeys.publicKey));

  // Import client public key
  const clientKey = await crypto.subtle.importKey("raw", clientPublicKeyBytes, { name: "ECDH", namedCurve: "P-256" }, false, []);

  // ECDH shared secret
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, serverKeys.privateKey, 256));

  // IKM via HKDF
  const authInfo = concat(new TextEncoder().encode("WebPush: info\0"), clientPublicKeyBytes, serverPublicKey);
  const ikm = await hkdf(clientAuth, sharedSecret, authInfo, 32);

  // Generate 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Derive CEK and nonce
  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");
  const cek = await hkdf(salt, ikm, cekInfo, 16);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  // Pad plaintext: payload + 0x02 delimiter (RFC 8188 single record)
  const paddedPayload = concat(payloadBytes, new Uint8Array([2]));

  // AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aesKey, paddedPayload));

  // Build aes128gcm body: salt(16) + rs(4) + idLen(1) + keyId(65) + ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);

  return concat(salt, rs, new Uint8Array([65]), serverPublicKey, ciphertext);
}

// ─── Main Handler ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  const corsHeaders = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Auth: accept both user JWTs and service_role calls
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ey")) {
      const token = authHeader.replace("Bearer ", "");
      const { error: authError } = await supabase.auth.getUser(token);
      if (authError) {
        return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
      }
    }

    const { user_id, title, body, url, tag } = await req.json();
    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: "Missing user_id or title" }), { status: 400, headers: corsHeaders });
    }

    // Rate limiting: max 30 push notifications per user per 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: recentPushCount } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user_id)
      .gte("created_at", fiveMinAgo);

    if ((recentPushCount || 0) >= 30) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded", sent: 0, failed: 0, total: 0 }), { status: 429, headers: corsHeaders });
    }

    // Get subscriptions
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth_key, subscription_json")
      .eq("user_id", user_id);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, failed: 0, total: 0 }), { headers: corsHeaders });
    }

    const pushPayload = JSON.stringify({
      title,
      body: body || "",
      url: url || "/app/home",
      tag: tag || "dealbuddy-notification",
      icon: "/icon-192.png",
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subs) {
      try {
        const subscription = sub.subscription_json ? JSON.parse(sub.subscription_json) : { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } };
        const p256dh = subscription.keys?.p256dh || sub.p256dh;
        const auth = subscription.keys?.auth || sub.auth_key;
        const endpoint = subscription.endpoint || sub.endpoint;

        if (!p256dh || !auth || !endpoint) { failed++; continue; }

        // Encrypt payload (RFC 8291)
        const encrypted = await encryptPayload(p256dh, auth, pushPayload);

        // Create VAPID JWT
        const jwt = await createVapidJwt(endpoint);

        // Send push
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            "Content-Length": String(encrypted.length),
            TTL: "86400",
            Urgency: "high",
            Authorization: `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
          },
          body: encrypted,
        });

        if (res.ok || res.status === 201) {
          sent++;
        } else if (res.status === 410 || res.status === 404) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
          failed++;
        } else {
          console.error(`Push failed: ${res.status} ${await res.text().catch(() => "")}`);
          failed++;
        }
      } catch (err) {
        console.error("Push send error:", err);
        failed++;
      }
    }

    return new Response(JSON.stringify({ sent, failed, total: subs.length }), { headers: corsHeaders });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("send-push error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
