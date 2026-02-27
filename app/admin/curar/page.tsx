"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./CurarPage.module.css";

const PAISES = [
  { value: "general", label: "General" },
  { value: "py", label: "Paraguay" },
  { value: "ar", label: "Argentina" },
  { value: "mx", label: "México" },
  { value: "co", label: "Colombia" },
  { value: "es", label: "España" },
] as const;

type CurarResult = {
  titulo: string;
  cuerpo: string;
  adcopy: string;
  imagenBase64: string | null;
  fuente_url: string;
  pais: string;
};

export default function CurarPage() {
  const [url, setUrl] = useState("");
  const [pais, setPais] = useState("general");
  const [adminSecret, setAdminSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CurarResult | null>(null);
  const [published, setPublished] = useState(false);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  const handleCurar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPreview(null);
    setLoading(true);
    try {
      const res = await fetch("/api/curar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({ url: url.trim(), pais }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`);
        return;
      }
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setLoading(false);
    }
  };

  const handlePublicar = async () => {
    if (!preview) return;
    setError(null);
    setPublishLoading(true);
    try {
      const entradilla =
        preview.adcopy.trim() ||
        preview.cuerpo.replace(/<[^>]+>/g, "").slice(0, 160).trim();
      let fuenteNombre = "Fuente";
      try {
        fuenteNombre = new URL(preview.fuente_url).hostname.replace(/^www\./, "");
      } catch {
        // keep default
      }
      const res = await fetch("/api/notas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret,
        },
        body: JSON.stringify({
          titulo: preview.titulo,
          entradilla,
          cuerpo: preview.cuerpo,
          imagenBase64: preview.imagenBase64 || undefined,
          imagen_alt: preview.titulo,
          fuente_nombre: fuenteNombre,
          fuente_url: preview.fuente_url,
          shares_buzzsumo: 0,
          pais: preview.pais,
          publicado: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`);
        return;
      }
      setCreatedSlug(data.slug ?? null);
      setPublished(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setPublishLoading(false);
    }
  };

  if (published) {
    return (
      <div className={styles.successWrap}>
        <p className={styles.successText}>Nota publicada correctamente.</p>
        {createdSlug && (
          <Link href={`/${createdSlug}`} className={styles.successLink}>
            Ver nota publicada
          </Link>
        )}
        <br />
        <Link href="/admin" className={styles.successLink}>
          Volver al admin
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <Link href="/admin" className={styles.back}>
        ← Admin
      </Link>
      <h1 className={styles.title}>Curar con IA</h1>
      <form onSubmit={handleCurar} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="adminSecret" className={styles.label}>
            Contraseña admin
          </label>
          <input
            id="adminSecret"
            type="password"
            required
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="url" className={styles.label}>
            URL del artículo viral
          </label>
          <input
            id="url"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="pais" className={styles.label}>
            País
          </label>
          <select
            id="pais"
            value={pais}
            onChange={(e) => setPais(e.target.value)}
            className={styles.select}
          >
            {PAISES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className={styles.btnPrimary}
        >
          {loading ? "Curando…" : "Curar con IA"}
        </button>
      </form>

      {preview && (
        <section className={styles.preview}>
          <h2 className={styles.previewTitle}>Vista previa</h2>
          <div className={styles.previewBlock}>
            <div className={styles.previewLabel}>Título curado</div>
            <div className={styles.previewTitulo}>{preview.titulo}</div>
          </div>
          <div className={styles.previewBlock}>
            <div className={styles.previewLabel}>Ad copy Facebook</div>
            <div className={styles.previewAdcopy}>{preview.adcopy}</div>
          </div>
          <div className={styles.previewBlock}>
            <div className={styles.previewLabel}>Cuerpo curado</div>
            <div
              className={styles.previewCuerpo}
              dangerouslySetInnerHTML={{ __html: preview.cuerpo }}
            />
          </div>
          {preview.imagenBase64 && (
            <div className={styles.previewBlock}>
              <div className={styles.previewLabel}>Imagen procesada</div>
              <img
                src={preview.imagenBase64}
                alt={preview.titulo}
                className={styles.previewImg}
              />
            </div>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              onClick={handlePublicar}
              disabled={publishLoading}
              className={styles.btnSuccess}
            >
              {publishLoading ? "Publicando…" : "Publicar"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
