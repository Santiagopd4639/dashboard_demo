import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUserFromRequest, isAdminRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";

const inputSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  rol: z.enum(["admin", "usuario"]).default("usuario"),
  activo: z.boolean().default(true),
  tallerId: z.string().uuid().nullable(),
});

function normalizeBody(raw: unknown) {
  const obj = (raw ?? {}) as Record<string, unknown>;

  const email = String(obj.email ?? "").trim();
  const password = String(obj.password ?? "");
  const rol = String(obj.rol ?? "usuario");

  const activoRaw = obj.activo;
  const activo =
    typeof activoRaw === "boolean"
      ? activoRaw
      : typeof activoRaw === "string"
        ? activoRaw === "true" || activoRaw === "on" || activoRaw === "1"
        : Boolean(activoRaw);

  let tallerId: string | null = null;
  if (typeof obj.tallerId === "string" && obj.tallerId.trim()) {
    tallerId = obj.tallerId.trim();
  } else if (Array.isArray(obj.tallerIds) && obj.tallerIds.length > 0) {
    const first = obj.tallerIds[0];
    if (typeof first === "string" && first.trim()) {
      tallerId = first.trim();
    }
  }

  return { email, password, rol, activo, tallerId };
}

async function readRequestBody(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    try {
      const form = await req.formData();
      const all = Object.fromEntries(form.entries());
      const tallerIds = form.getAll("tallerIds").map(String).filter(Boolean);
      if (tallerIds.length > 0) {
        return {
          ...all,
          tallerIds,
        };
      }
      return all;
    } catch {
      return null;
    }
  }
}

export async function GET(req: NextRequest) {
  const user = await getAuthUserFromRequest(req);
  if (!user) return jsonError("No autenticado", 401);
  if (!isAdminRole(user.rol)) return jsonError("Solo admin", 403);

  const items = await db.usuario.findMany({
    select: {
      id: true,
      email: true,
      rol: true,
      activo: true,
      creadoEn: true,
      usuariosTalleres: {
        include: {
          taller: {
            select: { id: true, nombre: true, activo: true },
          },
        },
      },
    },
    orderBy: { creadoEn: "desc" },
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUserFromRequest(req);
  if (!user) return jsonError("No autenticado", 401);
  if (!isAdminRole(user.rol)) return jsonError("Solo admin", 403);

  const raw = await readRequestBody(req);
  const normalized = normalizeBody(raw);
  const parsed = inputSchema.safeParse(normalized);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Body invalido",
        details: parsed.error.flatten(),
        normalized,
      },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  try {
    const created = await db.usuario.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        passwordHash,
        rol: parsed.data.rol,
        activo: parsed.data.activo,
        ...(parsed.data.tallerId
          ? {
              usuariosTalleres: {
                create: {
                  tallerId: parsed.data.tallerId,
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        rol: true,
        activo: true,
        creadoEn: true,
      },
    });

    return NextResponse.json({ user: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo crear el usuario",
        detail: String(error),
      },
      { status: 400 },
    );
  }
}
