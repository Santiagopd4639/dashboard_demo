import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUserFromRequest, isAdminRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";

const updateSchema = z.object({
  rol: z.enum(["admin", "usuario"]).optional(),
  activo: z.boolean().optional(),
  password: z.string().min(8).optional(),
  tallerIds: z.array(z.string().uuid()).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUserFromRequest(req);
  if (!user) return jsonError("No autenticado", 401);
  if (!isAdminRole(user.rol)) return jsonError("Solo admin", 403);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError("Body inválido", 400);

  const data = parsed.data;
  const userData: {
    rol?: "admin" | "usuario";
    activo?: boolean;
    passwordHash?: string;
  } = {};

  if (data.rol) userData.rol = data.rol;
  if (typeof data.activo === "boolean") userData.activo = data.activo;
  if (data.password) {
    userData.passwordHash = await bcrypt.hash(data.password, 10);
  }

  try {
    await db.$transaction(async (tx) => {
      if (Object.keys(userData).length > 0) {
        await tx.usuario.update({
          where: { id },
          data: userData,
        });
      }

      if (data.tallerIds) {
        await tx.usuarioTaller.deleteMany({
          where: { usuarioId: id },
        });
        if (data.tallerIds.length > 0) {
          await tx.usuarioTaller.createMany({
            data: data.tallerIds.map((tallerId) => ({
              usuarioId: id,
              tallerId,
            })),
            skipDuplicates: true,
          });
        }
      }
    });
  } catch {
    return jsonError("No se pudo actualizar el usuario", 400);
  }

  const updated = await db.usuario.findUnique({
    where: { id },
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
  });

  return NextResponse.json({ user: updated });
}
