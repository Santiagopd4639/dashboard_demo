"use client";

import { FormEvent, useMemo, useState } from "react";

type TallerOption = {
  id: string;
  nombre: string;
  activo: boolean;
};

type UserRow = {
  id: string;
  email: string;
  rol: "admin" | "usuario";
  activo: boolean;
  creadoEn: string;
  usuariosTalleres: { taller: { id: string; nombre: string; activo: boolean } }[];
};

type Props = {
  initialUsers: UserRow[];
  talleres: TallerOption[];
};

export function AdminUsersPanel({ initialUsers, talleres }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [message, setMessage] = useState("");

  const activeTalleres = useMemo(() => talleres.filter((t) => t.activo), [talleres]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    setMessage("");
    setLoadingCreate(true);
    const form = new FormData(formEl);
    const tallerIdRaw = String(form.get("tallerId") ?? "").trim();

    const body = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      rol: String(form.get("rol") ?? "usuario"),
      activo: Boolean(form.get("activo")),
      tallerId: tallerIdRaw || null,
    };

    const response = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const details = data.details?.fieldErrors
        ? JSON.stringify(data.details.fieldErrors)
        : "";
      setMessage(`${data.error ?? "No se pudo crear"} ${details}`.trim());
      setLoadingCreate(false);
      return;
    }

    const listResponse = await fetch("/api/usuarios");
    const listData = await listResponse.json();
    setUsers(listData.items ?? []);
    setMessage("Usuario creado.");
    formEl.reset();
    setLoadingCreate(false);
  }

  async function updateUser(event: FormEvent<HTMLFormElement>, userId: string) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      rol: String(form.get("rol") ?? "usuario"),
      activo: Boolean(form.get("activo")),
      password: String(form.get("password") ?? "") || undefined,
      tallerIds: form.getAll("tallerIds").map(String),
    };

    const response = await fetch(`/api/usuarios/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo actualizar");
      return;
    }

    setUsers((prev) =>
      prev.map((item) =>
        item.id === userId
          ? {
              ...item,
              rol: payload.rol as "admin" | "usuario",
              activo: payload.activo,
              usuariosTalleres: talleres
                .filter((t) => payload.tallerIds.includes(t.id))
                .map((t) => ({ taller: t })),
            }
          : item,
      ),
    );
    setMessage(`Usuario actualizado: ${data.user?.email ?? userId}`);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={createUser} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-6">
        <input name="email" type="email" required placeholder="email@demo.com" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input name="password" type="text" required minLength={8} placeholder="Password" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <select name="rol" defaultValue="usuario" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="usuario">usuario</option>
          <option value="admin">admin</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="activo" defaultChecked />
          Activo
        </label>
        <select name="tallerId" className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">Sin taller</option>
          {activeTalleres.map((taller) => (
            <option key={taller.id} value={taller.id}>
              {taller.nombre}
            </option>
          ))}
        </select>
        <button type="submit" disabled={loadingCreate} className="rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-60">
          {loadingCreate ? "Creando..." : "Crear usuario"}
        </button>
      </form>
      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
      <div className="space-y-3">
        {users.map((user) => (
          <form
            key={user.id}
            onSubmit={(event) => updateUser(event, user.id)}
            className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-7"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">{user.email}</p>
              <p className="text-xs text-slate-500">{new Date(user.creadoEn).toLocaleString()}</p>
            </div>
            <select name="rol" defaultValue={user.rol} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="usuario">usuario</option>
              <option value="admin">admin</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input name="activo" type="checkbox" defaultChecked={user.activo} />
              Activo
            </label>
            <input
              name="password"
              type="text"
              minLength={8}
              placeholder="Reset password (opcional)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              name="tallerIds"
              multiple
              defaultValue={user.usuariosTalleres.map((item) => item.taller.id)}
              className="min-h-20 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {talleres.map((taller) => (
                <option key={taller.id} value={taller.id}>
                  {taller.nombre}
                </option>
              ))}
            </select>
            <div className="text-xs text-slate-500">
              Talleres actuales:{" "}
              {user.usuariosTalleres.length
                ? user.usuariosTalleres.map((item) => item.taller.nombre).join(", ")
                : "ninguno"}
            </div>
            <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              Guardar cambios
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
