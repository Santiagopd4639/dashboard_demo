import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUserFromRequest, isAdminRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateDistanceKm, deduceAveriaType, isCompatible } from "@/lib/incidencias";
import { jsonError } from "@/lib/http";

const bodySchema = z.object({
  tallerId: z.string().uuid(),
});

function isOpenAcceptanceState(estado: string) {
  const normalized = estado.trim().toLowerCase().replaceAll("_", " ");
  return normalized === "aceptacion" || normalized === "en aceptacion" || normalized === "pendiente";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: incidenciaId } = await params;
    const user = await getAuthUserFromRequest(req);
    if (!user) return jsonError("No autenticado", 401);
    if (isAdminRole(user.rol)) return jsonError("Solo usuarios de taller pueden aceptar", 403);

    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return jsonError("Body invalido", 400);

    const taller = user.talleres.find((t) => t.id === parsed.data.tallerId);
    if (!taller) return jsonError("El taller no pertenece al usuario", 403);
    if (!taller.activo) return jsonError("El taller esta inactivo", 400);

    const incidencia = await db.incidencia.findUnique({
      where: { id: incidenciaId },
      include: { aceptacionIncidencia: true },
    });
    if (!incidencia) return jsonError("Incidencia no encontrada", 404);
    if (incidencia.aceptacionIncidencia) return jsonError("La incidencia ya fue aceptada", 409);
    if (!isOpenAcceptanceState(incidencia.estado)) {
      return jsonError("Solo se pueden aceptar incidencias en estado de aceptacion/pendiente", 409);
    }
    if (incidencia.lat === null || incidencia.lng === null) {
      return jsonError("Incidencia sin ubicacion valida", 400);
    }

    const averia = deduceAveriaType(incidencia.datos);
    if (!isCompatible(taller.capacidades as Prisma.JsonValue, averia)) {
      return jsonError("El taller no es compatible", 400);
    }
    const distance = calculateDistanceKm(incidencia, taller);
    if (distance === null || distance > taller.radioKm) {
      return jsonError("La incidencia esta fuera del radio del taller", 400);
    }

    await db.$transaction(async (tx) => {
      await tx.aceptacionIncidencia.create({
        data: {
          incidenciaId,
          tallerId: taller.id,
        },
      });
      await tx.incidencia.update({
        where: { id: incidenciaId },
        data: {
          estado: "aceptada",
          idTaller: taller.id,
        },
      });
    });

    let warning: string | undefined;
    const webhookUrl = process.env.N8N_ACCEPT_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        const webhookResponse = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            incidenciaId,
            telefono: incidencia.telefono,
            tallerId: taller.id,
            tallerNombre: taller.nombre,
            mensaje: "incidencia aceptada",
          }),
        });
        if (!webhookResponse.ok) {
          throw new Error(`Webhook status ${webhookResponse.status}`);
        }
      } catch (error) {
        warning = "Aceptacion guardada, pero fallo el webhook de n8n.";
        console.error("[accept-webhook-error]", error);
      }
    }

    return NextResponse.json({ ok: true, warning });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("La incidencia ya fue aceptada", 409);
    }
    console.error("[accept-error]", error);
    return jsonError("Error interno al aceptar incidencia", 500);
  }
}
