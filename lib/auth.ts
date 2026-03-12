const COOKIE_NAME = "fmpj-auth";

/**
 * HMAC-SHA256 署名を Web Crypto API で生成する（Edge Runtime 対応）
 */
async function hmacSign(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * セッショントークンを生成する。
 * ランダムなセッションIDをHMAC-SHA256で署名し、`sessionId.signature` 形式で返す。
 * APP_PASSWORD を秘密鍵として使用するため、外部から偽造不可能。
 */
export async function createSessionToken(secret: string): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const sessionId = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const signature = await hmacSign(secret, sessionId);
  return `${sessionId}.${signature}`;
}

/**
 * セッショントークンの署名を検証する。
 * @returns トークンが正当な場合 true
 */
export async function verifySessionToken(
  token: string,
  secret: string
): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [sessionId, signature] = parts;
  if (!sessionId || !signature) return false;

  const expected = await hmacSign(secret, sessionId);

  // タイミング攻撃対策: 定数時間比較
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * APIルートで使用する認証チェックヘルパー。
 * cookieからトークンを取得し、署名を検証する。
 * @returns 認証成功時 true
 */
export async function verifyAuth(): Promise<boolean> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const auth = cookieStore.get(COOKIE_NAME);
  const secret = process.env.APP_PASSWORD;
  if (!auth || !secret) return false;
  return verifySessionToken(auth.value, secret);
}

export { COOKIE_NAME };
