import {
  adminCookie,
  isAdmin,
  passcodeMatches,
  setAdminCookie,
} from "../../../../lib/admin.js";
import { NextResponse } from "next/server";

export async function GET() {
  return Response.json({ admin: await isAdmin() });
}

export async function POST(request) {
  const { passcode } = await request.json();
  if (!passcodeMatches(passcode))
    return Response.json({ error: "Incorrect passcode." }, { status: 401 });
  return setAdminCookie(NextResponse.json({ admin: true }), adminCookie());
}

export async function DELETE() {
  return setAdminCookie(NextResponse.json({ admin: false }), "", 0);
}
