"use client";

import { useState } from "react";
import Link from "next/link";

export default function ContactoPage() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      const res = await fetch("/api/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), email: email.trim(), mensaje: mensaje.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`);
        return;
      }
      setSuccess(true);
      setNombre("");
      setEmail("");
      setMensaje("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-serif text-2xl font-bold md:text-3xl">Contacto</h1>
      <p className="mt-2 text-[var(--negro)]/80">
        Escribinos y te responderemos lo antes posible.
      </p>

      {success && (
        <div className="mt-6 rounded-lg border border-green-600/30 bg-green-50 px-4 py-3 text-green-800" role="alert">
          Mensaje enviado correctamente. Gracias por contactarnos.
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-lg border border-red-600/30 bg-red-50 px-4 py-3 text-red-800" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-[var(--negro)]/80">
            Nombre
          </label>
          <input
            id="nombre"
            type="text"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--negro)]/20 px-3 py-2 text-[var(--negro)] focus:border-[var(--rojo)] focus:outline-none focus:ring-1 focus:ring-[var(--rojo)]"
            placeholder="Tu nombre"
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[var(--negro)]/80">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--negro)]/20 px-3 py-2 text-[var(--negro)] focus:border-[var(--rojo)] focus:outline-none focus:ring-1 focus:ring-[var(--rojo)]"
            placeholder="tu@email.com"
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="mensaje" className="block text-sm font-medium text-[var(--negro)]/80">
            Mensaje
          </label>
          <textarea
            id="mensaje"
            required
            rows={5}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            className="mt-1 w-full resize-y rounded-md border border-[var(--negro)]/20 px-3 py-2 text-[var(--negro)] focus:border-[var(--rojo)] focus:outline-none focus:ring-1 focus:ring-[var(--rojo)]"
            placeholder="Escribí tu mensaje..."
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-[var(--rojo)] px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Enviando…" : "Enviar"}
        </button>
      </form>

      <p className="mt-10 pt-6 border-t border-[var(--negro)]/10">
        <Link href="/" className="text-[var(--rojo)] underline hover:no-underline">
          ← Volver al inicio
        </Link>
      </p>
    </div>
  );
}
