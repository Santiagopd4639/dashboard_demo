import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { attachSessionCookie, signSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return jsonError("Datos inválidos", 400);

  const email = parsed.data.email.toLowerCase().trim();

  const user = await db.usuario.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      rol: true,
      activo: true,
      passwordHash: true,
    },
  });

  if (!user || !user.activo) {
    return jsonError("Credenciales inválidas", 401);
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    return jsonError("Credenciales inválidas", 401);
  }

  const token = await signSession({
    sub: user.id,
    email: user.email,
    rol: user.rol,
  });
  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      rol: user.rol,
    },
  });
  attachSessionCookie(response, token);
  return response;
}
