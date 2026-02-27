import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getAuthUserFromCookies } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function LoginPage() {
  const user = await getAuthUserFromCookies();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="auth-theme flex min-h-screen items-center justify-center px-4">
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="auth-card w-full max-w-md rounded-3xl p-7">
        <h1 className="mb-1 text-3xl font-semibold text-slate-100">Recacor Demo</h1>
        <p className="mb-6 text-sm text-sky-200">Inicia sesion para entrar al dashboard.</p>
        <LoginForm />
      </div>
    </div>
  );
}
