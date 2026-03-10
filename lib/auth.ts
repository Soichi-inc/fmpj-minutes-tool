import { randomBytes, createHmac } from "crypto";

const COOKIE_NAME = "fmpj-auth";

/**
 * セッショントークンを生成する。
 * ランダムなセッションIDをHMAC-SHA256で署名し、`sessionId.signature` 形式で返す。
 * APP_PASSWORD を秘密鍵として使用するため、外部から偽造不可能。
 */
export function createSessionToken(secret: string): string {
  const sessionId = randomBytes(32).toString("hex");
  const signature = createHmac("sha256", secret)
    .update(sessionId)
    .digest("hex");
  return `${sessionId}.${signature}`;
}

/**
 * セッショントークンの署名を検証する。
 * @returns トークンが正当な場合 true
 */
export function verifySessionToken(token: string, secret: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [sessionId, signature] = parts;
  if (!sessionId || !signature) return false;

  const expected = createHmac("sha256", secret)
    .update(sessionId)
    .digest("hex");

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
  // Dynamic import to avoid importing cookies() in middleware context
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const auth = cookieStore.get(COOKIE_NAME);
  const secret = process.env.APP_PASSWORD;
  if (!auth || !secret) return false;
  return verifySessionToken(auth.value, secret);
}

export { COOKIE_NAME };
