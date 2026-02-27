import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/auth";
import { jsonError } from "@/lib/http";

export async function GET(req: NextRequest) {
  const user = await getAuthUserFromRequest(req);
  if (!user) return jsonError("No autenticado", 401);
  return NextResponse.json({ user });
}
