"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import styles from "./CurarPage.module.css";
import {
  getAdminSecret as getStoredAdminSecret,
  setAdminSecret as saveAdminSecretToStorage,
} from "../CerrarSesionBtn";
import CerrarSesionBtn from "../CerrarSesionBtn";

const PAISES = [
  { value: "general", label: "General" },
  { value: "py", label: "Paraguay" },
  { value: "ar", label: "Argentina" },
  { value: "mx", label: "México" },
  { value: "co", label: "Colombia" },
  { value: "es", label: "España" },
] as const;

const PROGRESS_STEPS: { label: string; percent: number }[] = [
  { label: "Obteniendo artículo...", percent: 25 },
  { label: "Analizando contenido...", percent: 50 },
  { label: "Curando con IA...", percent: 75 },
  { label: "Procesando imagen...", percent: 90 },
  { label: "¡Listo!", percent: 100 },
];

type CurarResult = {
  titulo: string;
  cuerpo: string;
  adcopy: string;
  imagen_url: string | null;
  fuente_url: string;
  pais: string;
};

export default function CurarPage() {
  const [url, setUrl] = useState("");
  const [pais, setPais] = useState("general");
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [publishLoading, setPublishLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CurarResult | null>(null);
  const [published, setPublished] = useState(false);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  useEffect(() => {
    const saved = getStoredAdminSecret();
    if (saved) setSecret(saved);
  }, []);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, []);

  const runProgressSimulation = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setProgressStep(0);
    const t1 = setTimeout(() => setProgressStep(1), 600);
    const t2 = setTimeout(() => setProgressStep(2), 2200);
    const t3 = setTimeout(() => setProgressStep(3), 4200);
    timeoutsRef.current = [t1, t2, t3];
  };

  const handleCurar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPreview(null);
    setLoading(true);
    runProgressSimulation();
    try {
      const res = await fetch("/api/curar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ url: url.trim(), pais }),
      });
      const data = await res.json().catch(() => ({}));
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
      setProgressStep(4);
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`);
        setTimeout(() => setLoading(false), 500);
        return;
      }
      saveAdminSecretToStorage(secret);
      setPreview(data);
      setTimeout(() => setLoading(false), 500);
    } catch (err) {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
      setProgressStep(4);
      setError(err instanceof Error ? err.message : "Error de red");
      setTimeout(() => setLoading(false), 500);
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
          "x-admin-secret": secret,
        },
        body: JSON.stringify({
          titulo: preview.titulo,
          entradilla,
          cuerpo: preview.cuerpo,
          imagen_url: preview.imagen_url || undefined,
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
      saveAdminSecretToStorage(secret);
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
      <div className={styles.headerRow}>
        <Link href="/admin" className={styles.back}>
          ← Admin
        </Link>
        <CerrarSesionBtn />
      </div>
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
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
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

      {loading && (
        <div className={styles.progressWrap}>
          <p className={styles.progressLabel}>
            {PROGRESS_STEPS[progressStep].label}
          </p>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressBar}
              style={{ width: `${PROGRESS_STEPS[progressStep].percent}%` }}
            />
          </div>
          <p className={styles.progressPercent}>
            {PROGRESS_STEPS[progressStep].percent}%
          </p>
        </div>
      )}

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
          {preview.imagen_url && (
            <div className={styles.previewBlock}>
              <div className={styles.previewLabel}>Imagen procesada</div>
              <img
                src={preview.imagen_url}
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
