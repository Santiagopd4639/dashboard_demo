import { getAuthUserFromCookies, isAdminRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { CreateTallerForm } from "@/components/create-taller-form";

export default async function TalleresPage() {
  const user = await getAuthUserFromCookies();
  if (!user) return null;
  const admin = isAdminRole(user.rol);

  const talleres = admin
    ? await db.taller.findMany({ orderBy: { creadoEn: "desc" } })
    : user.talleres;

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Talleres</h2>
        <p className="text-sm text-slate-600">
          {admin ? "Listado completo de talleres." : "Talleres asignados a tu usuario."}
        </p>
      </header>
      {admin ? <CreateTallerForm /> : null}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Capacidades</th>
              <th className="px-3 py-2">Ubicación</th>
              <th className="px-3 py-2">Radio (km)</th>
              <th className="px-3 py-2">Activo</th>
            </tr>
          </thead>
          <tbody>
            {talleres.map((taller) => (
              <tr key={taller.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{taller.nombre}</td>
                <td className="px-3 py-2">{JSON.stringify(taller.capacidades)}</td>
                <td className="px-3 py-2">{taller.lat ?? "-"}, {taller.lng ?? "-"}</td>
                <td className="px-3 py-2">{taller.radioKm}</td>
                <td className="px-3 py-2">{taller.activo ? "Sí" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
  
}
