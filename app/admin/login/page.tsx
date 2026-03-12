"use client";

import { useState } from "react";
import { setAdminSecret } from "@/app/admin/CerrarSesionBtn";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = password.trim();
    if (!value) return;
    setAdminSecret(value);
    window.location.href = "/admin";
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-xs rounded-lg border border-[var(--negro)]/10 bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-center font-serif text-xl font-bold text-[var(--negro)]">
          sitio<span className="text-[var(--rojo)]">.</span>media
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="admin-password" className="mb-1 block text-sm text-[var(--negro)]/70">
              Contraseña admin
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full rounded border border-[var(--negro)]/20 px-3 py-2 text-sm"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded bg-[var(--rojo)] py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
}
