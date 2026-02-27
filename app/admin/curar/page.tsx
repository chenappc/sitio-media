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
  imagen2_url: string | null;
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
  const [manualImageBase64, setManualImageBase64] = useState<string | null>(null);
  const [manualImage2Base64, setManualImage2Base64] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInput2Ref = useRef<HTMLInputElement>(null);

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
    setManualImageBase64(null);
    setManualImage2Base64(null);
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
      setError(null);
      saveAdminSecretToStorage(secret);
      setPreview(data);
      setManualImageBase64(null);
      setManualImage2Base64(null);
      setTimeout(() => setLoading(false), 500);
    } catch (err) {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
      setProgressStep(4);
      setError(err instanceof Error ? err.message : "Error de red");
      setTimeout(() => setLoading(false), 500);
    }
  };

  const hasFoto1 = !!(preview?.imagen_url || manualImageBase64);

  const handleManualImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setManualImageBase64(typeof dataUrl === "string" ? dataUrl : null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleManualImage2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!hasFoto1) {
      setError("Tenés que subir la Foto 1 (principal) antes de la Foto 2.");
      return;
    }
    setError(null);
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setManualImage2Base64(typeof dataUrl === "string" ? dataUrl : null);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
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
      const body: Record<string, unknown> = {
        titulo: preview.titulo,
        entradilla,
        cuerpo: preview.cuerpo,
        imagen_alt: preview.titulo,
        fuente_nombre: fuenteNombre,
        fuente_url: preview.fuente_url,
        shares_buzzsumo: 0,
        pais: preview.pais,
        publicado: true,
      };
      if (manualImageBase64) {
        body.imagenBase64 = manualImageBase64;
      } else {
        body.imagen_url = preview.imagen_url || undefined;
      }
      if (manualImage2Base64) {
        body.imagen2Base64 = manualImage2Base64;
      }
      const res = await fetch("/api/notas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify(body),
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
        {error && (
          <p
            className={
              error.includes("No fue posible extraer")
                ? `${styles.error} ${styles.errorBlock}`
                : styles.error
            }
            role="alert"
          >
            {error}
          </p>
        )}
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
          {preview.imagen_url ? (
            <div className={styles.previewBlock}>
              <div className={styles.previewLabel}>Foto 1 – Principal (portada y preview Facebook)</div>
              <img
                src={preview.imagen_url}
                alt={preview.titulo}
                className={styles.previewImg}
              />
            </div>
          ) : (
            <div className={styles.previewBlock}>
              <div className={styles.previewLabel}>Foto 1 – Principal (portada y preview Facebook)</div>
              <p className={styles.previewHint}>No se encontró og:image. Subí una imagen manualmente.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleManualImageChange}
                className={styles.input}
                style={{ marginTop: 8 }}
              />
              {manualImageBase64 && (
                <img
                  src={manualImageBase64}
                  alt="Vista previa Foto 1"
                  className={styles.previewImg}
                  style={{ marginTop: 12 }}
                />
              )}
            </div>
          )}
          <div className={styles.previewBlock}>
            <div className={styles.previewLabel}>Foto 2 – Interior (opcional, se inserta en el centro de la nota)</div>
            {!hasFoto1 && (
              <p className={styles.previewHint}>Subí primero la Foto 1 para poder agregar la Foto 2.</p>
            )}
            <input
              ref={fileInput2Ref}
              type="file"
              accept="image/*"
              onChange={handleManualImage2Change}
              className={styles.input}
              style={{ marginTop: 8 }}
              disabled={!hasFoto1}
            />
            {manualImage2Base64 && (
              <img
                src={manualImage2Base64}
                alt="Vista previa Foto 2"
                className={styles.previewImg}
                style={{ marginTop: 12 }}
              />
            )}
          </div>
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
