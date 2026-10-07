import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "rotw_admin";
const DURATION = 7 * 24 * 60 * 60 * 1000;

function secret() {
  if (
    !process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET.length < 32
  ) {
    throw new Error("ADMIN_SESSION_SECRET must be at least 32 characters.");
  }
  return process.env.ADMIN_SESSION_SECRET;
}

function sign(value) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

export function passcodeMatches(value) {
  const expected = process.env.ADMIN_PASSCODE;
  if (!expected || expected.length < 12 || typeof value !== "string")
    return false;
  const a = crypto.createHash("sha256").update(value).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function adminCookie() {
  const expiry = Date.now() + DURATION;
  const payload = String(expiry);
  return `${payload}.${sign(payload)}`;
}

export function setAdminCookie(response, value, maxAge = DURATION / 1000) {
  response.cookies.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return response;
}

export async function isAdmin() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return false;
  const [expiry, signature] = token.split(".");
  if (
    !expiry ||
    !signature ||
    !/^\d+$/.test(expiry) ||
    Number(expiry) < Date.now()
  )
    return false;
  const expected = sign(expiry);
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export async function requireAdmin() {
  if (!(await isAdmin()))
    return Response.json(
      { error: "Admin passcode required." },
      { status: 401 },
    );
  return null;
}
