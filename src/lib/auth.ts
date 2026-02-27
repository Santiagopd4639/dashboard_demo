import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const SESSION_COOKIE_NAME = "roadside_session";

export type SessionPayload = {
  sub: string;
  email: string;
  rol: string;
};

type PublicTaller = {
  id: string;
  nombre: string;
  capacidades: Prisma.JsonValue;
  lat: number | null;
  lng: number | null;
  radioKm: number;
  activo: boolean;
};

export type AuthUser = {
  id: string;
  email: string;
  rol: string;
  activo: boolean;
  talleres: PublicTaller[];
};

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET no está configurado");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getAuthSecret());
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    if (!payload.sub || !payload.email || !payload.rol) {
      return null;
    }
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function attachSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function getSessionFromRequest(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function getSessionFromCookieStore() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function getAuthUserBySessionPayload(
  payload: SessionPayload,
): Promise<AuthUser | null> {
  const user = await db.usuario.findFirst({
    where: {
      id: payload.sub,
      activo: true,
    },
    select: {
      id: true,
      email: true,
      rol: true,
      activo: true,
      usuariosTalleres: {
        select: {
          taller: {
            select: {
              id: true,
              nombre: true,
              capacidades: true,
              lat: true,
              lng: true,
              radioKm: true,
              activo: true,
            },
          },
        },
      },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    rol: user.rol,
    activo: user.activo,
    talleres: user.usuariosTalleres.map((entry) => entry.taller),
  };
}

export async function getAuthUserFromRequest(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return null;
  return getAuthUserBySessionPayload(session);
}

export async function getAuthUserFromCookies() {
  const session = await getSessionFromCookieStore();
  if (!session) return null;
  return getAuthUserBySessionPayload(session);
}

export function isAdminRole(rol: string) {
  return rol === "admin";
}
