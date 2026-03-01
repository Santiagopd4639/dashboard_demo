import Link from "next/link";
import Image from "next/image";
import { ReactNode } from "react";
import { AuthUser, isAdminRole } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";

type Props = {
  user: AuthUser;
  children: ReactNode;
};

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-300/40 px-3 py-2 text-sm font-medium tracking-wide text-slate-700 transition hover:bg-slate-200"
    >
      {label}
    </Link>
  );
}

export function DashboardShell({ user, children }: Props) {
  const isAdmin = isAdminRole(user.rol);
  return (
    <div className="dashboard-theme min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-[1480px] grid-cols-1 gap-4 p-4 md:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 md:sticky md:top-4 md:h-[calc(100vh-2rem)]">
          <div className="mb-6">
            <Image
              src="/recacor-logo.png"
              alt="Recacor"
              width={220}
              height={56}
              priority
              className="h-auto w-auto max-w-[220px]"
            />
            <h1 className="text-2xl font-semibold leading-tight text-slate-900">Control Center</h1>
          </div>
          <nav className="flex flex-col gap-2">
            <NavLink href="/dashboard" label="Resumen" />
            <NavLink href="/dashboard/incidencias" label="Incidencias" />
            <NavLink href="/dashboard/talleres" label="Talleres" />
            {isAdmin ? <NavLink href="/dashboard/usuarios" label="Usuarios" /> : null}
          </nav>
        </aside>
        <div className="flex min-h-screen flex-col gap-4">
          <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 md:px-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{user.rol}</p>
              <p className="text-sm font-semibold text-slate-900">{user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LogoutButton />
            </div>
          </header>
          <main className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
