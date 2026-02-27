import { redirect } from "next/navigation";
import { getAuthUserFromCookies, isAdminRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminUsersPanel } from "@/components/admin-users-panel";

export default async function UsuariosPage() {
  const user = await getAuthUserFromCookies();
  if (!user) return null;
  if (!isAdminRole(user.rol)) {
    redirect("/dashboard");
  }

  const [usuarios, talleres] = await Promise.all([
    db.usuario.findMany({
      select: {
        id: true,
        email: true,
        rol: true,
        activo: true,
        creadoEn: true,
        usuariosTalleres: {
          include: { taller: true },
        },
      },
      orderBy: { creadoEn: "desc" },
    }),
    db.taller.findMany({
      select: { id: true, nombre: true, activo: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Usuarios (Admin)</h2>
        <p className="text-sm text-slate-600">Gestion completa de usuarios, roles, password y asignaciones.</p>
      </header>
      <AdminUsersPanel
        initialUsers={usuarios.map((u) => ({
          ...u,
          rol: u.rol as "admin" | "usuario",
          creadoEn: u.creadoEn.toISOString(),
        }))}
        talleres={talleres}
      />
    </section>
  );
}
