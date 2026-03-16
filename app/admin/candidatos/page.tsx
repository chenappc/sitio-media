"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { getAdminSecret } from "../CerrarSesionBtn";

const PER_PAGE = 20;

type Candidato = {
  id: number;
  titulo: string;
  url: string;
  thumbnail: string | null;
  total_facebook_shares: number;
  keyword: string | null;
  status: string;
  nota_id: number | null;
  created_at: string;
};

export default function CandidatosPage() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [countPendientes, setCountPendientes] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [descartandoId, setDescartandoId] = useState<number | null>(null);
  const [generando, setGenerando] = useState(false);
  const [progresoGenerar, setProgresoGenerar] = useState(0);
  const [mensajeGenerar, setMensajeGenerar] = useState<string | null>(null);
  const progresoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [mostrarDescartados, setMostrarDescartados] = useState(false);
  const [limitGenerar, setLimitGenerar] = useState(10);
  const [minShares, setMinShares] = useState(500);
  const [keyword1, setKeyword1] = useState("viral");
  const [keyword2, setKeyword2] = useState("emotivo OR conmovedor");
  const [keyword3, setKeyword3] = useState("abuelito OR abuelita OR anciano");
  const [meses, setMeses] = useState(24);
  const [page, setPage] = useState(1);

  const fetchCount = async () => {
    const secret = getAdminSecret();
    if (!secret) return;
    try {
      const res = await fetch("/api/candidatos?count=true", {
        headers: { "x-admin-secret": secret },
      });
      if (res.ok) {
        const data = await res.json();
        setCountPendientes(typeof data?.count === "number" ? data.count : 0);
      }
    } catch {
      setCountPendientes(null);
    }
  };

  const fetchCandidatos = async () => {
    const secret = getAdminSecret();
    if (!secret) {
      setError("Ingresá la contraseña admin en /admin primero.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setMensajeGenerar(null);
    try {
      const url = mostrarDescartados ? "/api/candidatos?incluirDescartados=true" : "/api/candidatos";
      const res = await fetch(url, {
        headers: { "x-admin-secret": secret },
      });
      if (!res.ok) {
        if (res.status === 401) setError("No autorizado");
        else setError("Error al cargar candidatos");
        setCandidatos([]);
        return;
      }
      const data = await res.json();
      setCandidatos(Array.isArray(data) ? data : []);
      setPage(1);
      await fetchCount();
    } catch {
      setError("Error al cargar candidatos");
      setCandidatos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidatos();
  }, [mostrarDescartados]);

  const descartar = async (id: number) => {
    const secret = getAdminSecret();
    if (!secret) {
      alert("Ingresá la contraseña admin primero.");
      return;
    }
    setDescartandoId(id);
    try {
      const res = await fetch(`/api/candidatos/${id}`, {
        method: "DELETE",
        headers: { "x-admin-secret": secret },
      });
      if (res.ok) {
        if (mostrarDescartados) {
          setCandidatos((prev) => prev.map((c) => (c.id === id ? { ...c, status: "descartado" } : c)));
        } else {
          setCandidatos((prev) => prev.filter((c) => c.id !== id));
        }
        fetchCount();
      } else {
        alert("Error al descartar");
      }
    } catch {
      alert("Error al descartar");
    } finally {
      setDescartandoId(null);
    }
  };

  const generarMas = async () => {
    const secret = getAdminSecret();
    if (!secret) {
      alert("Ingresá la contraseña admin primero.");
      return;
    }
    setGenerando(true);
    setMensajeGenerar(null);
    setProgresoGenerar(0);
    if (progresoIntervalRef.current) clearInterval(progresoIntervalRef.current);
    progresoIntervalRef.current = setInterval(() => {
      setProgresoGenerar((p) => {
        if (p >= 90) {
          if (progresoIntervalRef.current) {
            clearInterval(progresoIntervalRef.current);
            progresoIntervalRef.current = null;
          }
          return 90;
        }
        return p + 4;
      });
    }, 200);

    try {
      const keywords = [keyword1.trim(), keyword2.trim(), keyword3.trim()].filter(Boolean);
      const res = await fetch("/api/candidatos/generar", {
        method: "POST",
        headers: {
          "x-admin-secret": secret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          limit: limitGenerar,
          minShares: Math.max(0, minShares),
          keywords: keywords.length > 0 ? keywords : ["viral", "emotivo OR conmovedor", "abuelito OR abuelita OR anciano"],
          meses: Math.max(1, Math.min(120, meses)),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (progresoIntervalRef.current) {
        clearInterval(progresoIntervalRef.current);
        progresoIntervalRef.current = null;
      }
      setProgresoGenerar(100);
      if (res.ok && data?.ok) {
        const added = data.added ?? 0;
        setMensajeGenerar(added === 0 ? "No se encontraron candidatos nuevos." : `${added} candidatos nuevos encontrados.`);
        fetchCandidatos();
      } else {
        setMensajeGenerar(data?.error ?? "Error al generar candidatos");
      }
    } catch {
      if (progresoIntervalRef.current) {
        clearInterval(progresoIntervalRef.current);
        progresoIntervalRef.current = null;
      }
      setProgresoGenerar(100);
      setMensajeGenerar("Error al generar candidatos");
    } finally {
      setGenerando(false);
      setTimeout(() => setProgresoGenerar(0), 400);
    }
  };

  const total = candidatos.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PER_PAGE;
  const pageCandidatos = candidatos.slice(start, start + PER_PAGE);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="text-[var(--negro)]/70 hover:text-[var(--negro)] text-sm font-medium"
          >
            ← Admin Notas
          </Link>
          <h1 className="font-serif text-2xl font-bold">Candidatos via API</h1>
          {countPendientes !== null && (
            <span className="rounded bg-[var(--negro)]/10 px-2 py-0.5 text-sm font-medium text-[var(--negro)]/80">
              {countPendientes} pendientes
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--negro)]/70">
            <input
              type="checkbox"
              checked={mostrarDescartados}
              onChange={(e) => setMostrarDescartados(e.target.checked)}
              className="rounded border-[var(--negro)]/30"
            />
            Mostrar descartados
          </label>
          <label className="flex flex-col gap-0.5 text-sm text-[var(--negro)]/70">
            <span>Shares mínimos</span>
            <input
              type="number"
              min={0}
              value={minShares}
              onChange={(e) => setMinShares(Number(e.target.value) || 0)}
              className="w-20 rounded border border-[var(--negro)]/30 bg-white px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-sm text-[var(--negro)]/70">
            <span>Keyword 1</span>
            <input
              type="text"
              value={keyword1}
              onChange={(e) => setKeyword1(e.target.value)}
              placeholder="viral"
              className="w-40 rounded border border-[var(--negro)]/30 bg-white px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-sm text-[var(--negro)]/70">
            <span>Keyword 2</span>
            <input
              type="text"
              value={keyword2}
              onChange={(e) => setKeyword2(e.target.value)}
              placeholder="emotivo OR conmovedor"
              className="w-48 rounded border border-[var(--negro)]/30 bg-white px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-sm text-[var(--negro)]/70">
            <span>Keyword 3</span>
            <input
              type="text"
              value={keyword3}
              onChange={(e) => setKeyword3(e.target.value)}
              placeholder="abuelito OR abuelita OR anciano"
              className="w-52 rounded border border-[var(--negro)]/30 bg-white px-2 py-1 text-sm"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-sm text-[var(--negro)]/70">
            <span>Rango (meses)</span>
            <input
              type="number"
              min={1}
              max={120}
              value={meses}
              onChange={(e) => setMeses(Number(e.target.value) || 24)}
              className="w-16 rounded border border-[var(--negro)]/30 bg-white px-2 py-1 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--negro)]/70">
            <span>Generar:</span>
            <select
              value={limitGenerar}
              onChange={(e) => setLimitGenerar(Number(e.target.value))}
              className="rounded border border-[var(--negro)]/30 bg-white px-2 py-1 text-sm"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={40}>40</option>
            </select>
          </label>
          <button
            type="button"
            onClick={generarMas}
            disabled={generando}
            className="rounded border border-[var(--rojo)]/60 bg-[var(--rojo)]/10 px-3 py-1.5 text-sm font-medium text-[var(--rojo)] hover:bg-[var(--rojo)]/20 disabled:opacity-50"
          >
            {generando ? "Buscando..." : "Generar más candidatos"}
          </button>
        </div>
      </div>

      {generando && (
        <div className="mb-4">
          <p className="mb-1.5 text-sm text-[var(--negro)]/70">Buscando candidatos...</p>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-[var(--negro)]/10"
            role="progressbar"
            aria-valuenow={progresoGenerar}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-[var(--rojo)] transition-[width] duration-300 ease-out"
              style={{ width: `${progresoGenerar}%` }}
            />
          </div>
        </div>
      )}

      {loading && (
        <p className="text-[var(--negro)]/60 mb-4">Cargando candidatos...</p>
      )}

      {error && (
        <p className="text-red-600 mb-4">{error}</p>
      )}

      {mensajeGenerar && !generando && (
        <p className="mb-4 text-sm text-[var(--negro)]/80">{mensajeGenerar}</p>
      )}

      {!loading && !error && (
        <>
          <p className="text-[var(--negro)]/70 mb-4">
            {mostrarDescartados ? `${total} candidatos (pendientes + descartados)` : `${total} candidatos pendientes`}
          </p>

          {total === 0 ? (
            <p className="text-[var(--negro)]/60">
              {mostrarDescartados ? "No hay candidatos (pendientes ni descartados)." : "No hay candidatos pendientes."}
            </p>
          ) : (
            <>
              <ul className="space-y-4">
                {pageCandidatos.map((c) => (
                  <li
                    key={c.id}
                    className={`flex flex-wrap items-start gap-3 rounded border p-3 ${c.status === "descartado" ? "border-amber-200 bg-amber-50/50" : "border-[var(--negro)]/15 bg-white"}`}
                  >
                    {c.thumbnail ? (
                      <img
                        src={c.thumbnail}
                        alt=""
                        className="w-16 h-16 object-cover rounded flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded bg-[var(--negro)]/10 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--negro)] line-clamp-2">
                        {c.titulo}
                      </p>
                      <p className="text-sm text-[var(--negro)]/60 mt-0.5">
                        {c.total_facebook_shares.toLocaleString()} FB · {c.keyword ?? "—"} ·{" "}
                        {formatDistanceToNow(new Date(c.created_at), {
                          addSuffix: true,
                          locale: es,
                        })}
                        {c.status === "descartado" && (
                          <span className="ml-2 rounded bg-amber-200/80 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                            Descartado
                          </span>
                        )}
                      </p>
                    </div>
                    {c.status === "pendiente" && (
                      <div className="flex gap-2 flex-shrink-0">
                        <Link
                          href={`/admin/curar?url=${encodeURIComponent(c.url)}`}
                          className="rounded border border-[var(--rojo)]/60 px-3 py-1.5 text-sm font-medium text-[var(--rojo)] hover:bg-[var(--rojo)]/10"
                        >
                          Curar
                        </Link>
                        <button
                          type="button"
                          onClick={() => descartar(c.id)}
                          disabled={descartandoId === c.id}
                          className="rounded border border-[var(--negro)]/30 px-3 py-1.5 text-sm font-medium text-[var(--negro)]/70 hover:bg-[var(--negro)]/5 disabled:opacity-50"
                        >
                          {descartandoId === c.id ? "..." : "Descartar"}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="rounded border border-[var(--negro)]/30 px-3 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-[var(--negro)]/70">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="rounded border border-[var(--negro)]/30 px-3 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
