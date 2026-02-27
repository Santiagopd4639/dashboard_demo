import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest, isAdminRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";

const COMPLETED_STATES = new Set([
  "completada",
  "completado",
  "finalizada",
  "finalizado",
  "cerrada",
  "cerrado",
  "resuelta",
  "resuelto",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: incidenciaId } = await params;
    const body = await req.json().catch(() => null);
    const incidenciaReview =
      typeof body?.incidenciaReview === "string" ? body.incidenciaReview.trim() : "";
    if (!incidenciaReview) {
      return jsonError("Debes indicar como se ha resuelto la incidencia", 400);
    }

    const user = await getAuthUserFromRequest(req);
    if (!user) return jsonError("No autenticado", 401);
    if (isAdminRole(user.rol)) return jsonError("Solo usuario de taller puede cerrar", 403);

    const incidencia = await db.incidencia.findUnique({
      where: { id: incidenciaId },
      include: {
        aceptacionIncidencia: {
          include: {
            taller: {
              select: {
                id: true,
                nombre: true,
              },
            },
          },
        },
      },
    });
    if (!incidencia) return jsonError("Incidencia no encontrada", 404);
    if (!incidencia.aceptacionIncidencia) {
      return jsonError("La incidencia no esta aceptada", 409);
    }

    const acceptedByMine = user.talleres.some(
      (t) => t.id === incidencia.aceptacionIncidencia?.tallerId,
    );
    if (!acceptedByMine) return jsonError("Solo el taller que acepto puede cerrarla", 403);

    const estado = incidencia.estado.toLowerCase();
    if (COMPLETED_STATES.has(estado)) {
      return NextResponse.json({ ok: true, alreadyCompleted: true });
    }
    if (estado !== "aceptada") {
      return jsonError("Solo se puede cerrar una incidencia en estado aceptada", 409);
    }

    const completadoEn = new Date();
    await db.$executeRaw`
    UPDATE incidencias
    SET estado = 'completada',
        completado_en = ${completadoEn},
        incidencia_review = ${incidenciaReview}
    WHERE id = CAST(${incidenciaId} AS uuid)
  `;

    let warning: string | undefined;
    const webhookUrl = process.env.N8N_CLOSE_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        const webhookResponse = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            incidenciaId,
            telefono: incidencia.telefono,
            tallerId: incidencia.aceptacionIncidencia.taller.id,
            tallerNombre: incidencia.aceptacionIncidencia.taller.nombre,
            mensaje: "incidencia cerrada",
          }),
        });
        if (!webhookResponse.ok) {
          throw new Error(`Webhook status ${webhookResponse.status}`);
        }
      } catch (error) {
        warning = "Cierre guardado, pero fallo el webhook de n8n.";
        console.error("[close-webhook-error]", error);
      }
    }

    return NextResponse.json({
      ok: true,
      warning,
      incidencia: {
        id: incidenciaId,
        estado: "completada",
        completadoEn,
      },
    });
  } catch (error) {
    console.error("[close-error]", error);
    return jsonError("Error interno al cerrar incidencia", 500);
  }
}
