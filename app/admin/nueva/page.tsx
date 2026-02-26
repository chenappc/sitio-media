"use client";

import { useState } from "react";
import Link from "next/link";

const PAISES = [
  { value: "general", label: "General" },
  { value: "ar", label: "Argentina" },
  { value: "mx", label: "México" },
  { value: "co", label: "Colombia" },
  { value: "cl", label: "Chile" },
  { value: "es", label: "España" },
  { value: "pe", label: "Perú" },
] as const;

export default function NuevaNotaPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [form, setForm] = useState({
    adminSecret: "",
    titulo: "",
    entradilla: "",
    cuerpo: "",
    imagen_url: "",
    imagen_alt: "",
    fuente_nombre: "",
    fuente_url: "",
    shares_buzzsumo: "",
    pais: "general",
    publicado: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/notas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": form.adminSecret,
        },
        body: JSON.stringify({
          titulo: form.titulo,
          entradilla: form.entradilla,
          cuerpo: form.cuerpo,
          imagen_url: form.imagen_url || undefined,
          imagen_alt: form.imagen_alt || undefined,
          fuente_nombre: form.fuente_nombre,
          fuente_url: form.fuente_url,
          shares_buzzsumo: Number(form.shares_buzzsumo) || 0,
          pais: form.pais,
          publicado: form.publicado,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`);
        return;
      }
      setOk(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setLoading(false);
    }
  };

  if (ok) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-lg text-green-700">Nota creada correctamente.</p>
        <Link href="/admin" className="mt-4 inline-block text-[var(--rojo)] underline">
          Volver al admin
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link href="/admin" className="mb-4 inline-block text-sm text-[var(--negro)]/60 hover:text-[var(--rojo)]">
        ← Admin
      </Link>
      <h1 className="font-serif text-2xl font-bold">Nueva nota</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="adminSecret" className="block text-sm font-medium text-[var(--negro)]/80">
            Contraseña admin
          </label>
          <input
            id="adminSecret"
            type="password"
            required
            value={form.adminSecret}
            onChange={(e) => setForm((f) => ({ ...f, adminSecret: e.target.value }))}
            className="mt-1 w-full rounded border border-[var(--negro)]/20 px-3 py-2 text-[var(--negro)]"
          />
        </div>
        <div>
          <label htmlFor="titulo" className="block text-sm font-medium text-[var(--negro)]/80">
            Título
          </label>
          <input
            id="titulo"
            type="text"
            required
            value={form.titulo}
            onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            className="mt-1 w-full rounded border border-[var(--negro)]/20 px-3 py-2 text-[var(--negro)]"
          />
        </div>
        <div>
          <label htmlFor="entradilla" className="block text-sm font-medium text-[var(--negro)]/80">
            Entradilla
          </label>
          <textarea
            id="entradilla"
            required
            rows={2}
            value={form.entradilla}
            onChange={(e) => setForm((f) => ({ ...f, entradilla: e.target.value }))}
            className="mt-1 w-full rounded border border-[var(--negro)]/20 px-3 py-2 text-[var(--negro)]"
          />
        </div>
        <div>
          <label htmlFor="cuerpo" className="block text-sm font-medium text-[var(--negro)]/80">
            Cuerpo (HTML)
          </label>
          <textarea
            id="cuerpo"
            required
            rows={10}
            value={form.cuerpo}
            onChange={(e) => setForm((f) => ({ ...f, cuerpo: e.target.value }))}
            className="mt-1 w-full rounded border border-[var(--negro)]/20 px-3 py-2 font-mono text-sm text-[var(--negro)]"
          />
        </div>
        <div>
          <label htmlFor="imagen_url" className="block text-sm font-medium text-[var(--negro)]/80">
            URL de imagen
          </label>
          <input
            id="imagen_url"
            type="url"
            value={form.imagen_url}
            onChange={(e) => setForm((f) => ({ ...f, imagen_url: e.target.value }))}
            className="mt-1 w-full rounded border border-[var(--negro)]/20 px-3 py-2 text-[var(--negro)]"
          />
        </div>
        <div>
          <label htmlFor="imagen_alt" className="block text-sm font-medium text-[var(--negro)]/80">
            Alt de imagen
          </label>
          <input
            id="imagen_alt"
            type="text"
            value={form.imagen_alt}
            onChange={(e) => setForm((f) => ({ ...f, imagen_alt: e.target.value }))}
            className="mt-1 w-full rounded border border-[var(--negro)]/20 px-3 py-2 text-[var(--negro)]"
          />
        </div>
        <div>
          <label htmlFor="fuente_nombre" className="block text-sm font-medium text-[var(--negro)]/80">
            Nombre de la fuente
          </label>
          <input
            id="fuente_nombre"
            type="text"
            required
            value={form.fuente_nombre}
            onChange={(e) => setForm((f) => ({ ...f, fuente_nombre: e.target.value }))}
            className="mt-1 w-full rounded border border-[var(--negro)]/20 px-3 py-2 text-[var(--negro)]"
          />
        </div>
        <div>
          <label htmlFor="fuente_url" className="block text-sm font-medium text-[var(--negro)]/80">
            URL de la fuente
          </label>
          <input
            id="fuente_url"
            type="url"
            required
            value={form.fuente_url}
            onChange={(e) => setForm((f) => ({ ...f, fuente_url: e.target.value }))}
            className="mt-1 w-full rounded border border-[var(--negro)]/20 px-3 py-2 text-[var(--negro)]"
          />
        </div>
        <div>
          <label htmlFor="shares_buzzsumo" className="block text-sm font-medium text-[var(--negro)]/80">
            Shares BuzzSumo (número)
          </label>
          <input
            id="shares_buzzsumo"
            type="number"
            min={0}
            value={form.shares_buzzsumo}
            onChange={(e) => setForm((f) => ({ ...f, shares_buzzsumo: e.target.value }))}
            className="mt-1 w-full rounded border border-[var(--negro)]/20 px-3 py-2 text-[var(--negro)]"
          />
        </div>
        <div>
          <label htmlFor="pais" className="block text-sm font-medium text-[var(--negro)]/80">
            País
          </label>
          <select
            id="pais"
            value={form.pais}
            onChange={(e) => setForm((f) => ({ ...f, pais: e.target.value }))}
            className="mt-1 w-full rounded border border-[var(--negro)]/20 px-3 py-2 text-[var(--negro)]"
          >
            {PAISES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="publicado"
            type="checkbox"
            checked={form.publicado}
            onChange={(e) => setForm((f) => ({ ...f, publicado: e.target.checked }))}
            className="h-4 w-4 rounded border-[var(--negro)]/30"
          />
          <label htmlFor="publicado" className="text-sm font-medium text-[var(--negro)]/80">
            Publicado
          </label>
        </div>
        {error && (
          <p className="text-sm text-[var(--rojo)]">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-[var(--rojo)] px-4 py-2 font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Guardando…" : "Crear nota"}
        </button>
      </form>
    </div>
  );
}
