"use client";

import { useState } from "react";
import Link from "next/link";
import { getAdminSecret } from "@/app/admin/CerrarSesionBtn";

type IdiomaOption = "es" | "en" | "original";

const IDIOMA_LABELS: Record<IdiomaOption, string> = {
  es: "Español neutro",
  en: "Inglés",
  original: "Idioma original",
};

export default function AdminEspecialesNuevoPage() {
  const [urlFuente, setUrlFuente] = useState("");
  const [idioma, setIdioma] = useState<IdiomaOption>("es");
  const [usarImagenesIa, setUsarImagenesIa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const handleGenerar = async () => {
    const url = urlFuente.trim();
    if (!url) {
      setMessage({ text: "Completá la URL del artículo fuente.", error: true });
      return;
    }
    const secret = getAdminSecret();
    if (!secret) {
      setMessage({ text: "Ingresá la contraseña admin (en /admin) primero.", error: true });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/especiales/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({
          urlBase: url,
          idioma,
          usarImagenesIa,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ text: data.error ?? "Error al generar especial", error: true });
        return;
      }
      setMessage({ text: "Especial generado correctamente." });
    } catch (e) {
      setMessage({
        text: e instanceof Error ? e.message : "Error al generar especial",
        error: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Nuevo Especial</h1>
        <Link
          href="/admin-especiales"
          className="rounded border border-[var(--negro)]/20 px-4 py-2 text-sm font-medium text-[var(--negro)] hover:bg-[var(--negro)]/5 no-underline"
        >
          ← Admin Especiales
        </Link>
      </div>

      <section className="rounded-lg border border-[var(--negro)]/10 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Generar especial desde artículo</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-[var(--negro)]/70">URL del artículo fuente</label>
            <input
              type="url"
              value={urlFuente}
              onChange={(e) => setUrlFuente(e.target.value)}
              placeholder="https://ejemplo.com/articulo"
              className="w-full rounded border border-[var(--negro)]/20 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-[var(--negro)]/70">Idioma</label>
            <select
              value={idioma}
              onChange={(e) => setIdioma(e.target.value as IdiomaOption)}
              className="w-full max-w-xs rounded border border-[var(--negro)]/20 px-3 py-2 text-sm"
            >
              {(Object.entries(IDIOMA_LABELS) as [IdiomaOption, string][]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="usar-imagenes-ia"
              checked={usarImagenesIa}
              onChange={(e) => setUsarImagenesIa(e.target.checked)}
              className="rounded border-[var(--negro)]/20"
            />
            <label htmlFor="usar-imagenes-ia" className="text-sm text-[var(--negro)]/80">
              Generar imágenes con IA
            </label>
          </div>

          <button
            type="button"
            onClick={handleGenerar}
            disabled={loading}
            className="rounded bg-[var(--rojo)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Generando…" : "Generar Especial"}
          </button>

          {message && (
            <p className={`text-sm ${message.error ? "text-red-600" : "text-[var(--negro)]/80"}`}>
              {message.text}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
