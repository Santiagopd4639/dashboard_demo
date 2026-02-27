import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUserFromRequest, isAdminRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";

const createTallerSchema = z.object({
  nombre: z.string().min(2),
  capacidades: z.array(z.string()).default(["pinchazo"]),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  radioKm: z.number().positive().default(20),
  activo: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const user = await getAuthUserFromRequest(req);
  if (!user) return jsonError("No autenticado", 401);

  if (isAdminRole(user.rol)) {
    const talleres = await db.taller.findMany({
      orderBy: { creadoEn: "desc" },
    });
    return NextResponse.json({ items: talleres });
  }

  return NextResponse.json({ items: user.talleres });
}

export async function POST(req: NextRequest) {
  const user = await getAuthUserFromRequest(req);
  if (!user) return jsonError("No autenticado", 401);
  if (!isAdminRole(user.rol)) return jsonError("Solo admin", 403);

  const body = await req.json().catch(() => null);
  const parsed = createTallerSchema.safeParse(body);
  if (!parsed.success) return jsonError("Body invalido", 400);

  const taller = await db.taller.create({
    data: {
      nombre: parsed.data.nombre,
      capacidades: parsed.data.capacidades,
      lat: parsed.data.lat ?? null,
      lng: parsed.data.lng ?? null,
      radioKm: parsed.data.radioKm,
      activo: parsed.data.activo,
    },
  });

  return NextResponse.json({ item: taller }, { status: 201 });
}
