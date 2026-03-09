"use client";
import { useState } from "react";
import Image from "next/image";

export default function TestImagenesPage() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [dalleUrl, setDalleUrl] = useState<string | null>(null);
  const [geminiUrl, setGeminiUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setDalleUrl(null);
    setGeminiUrl(null);
    try {
      const res = await fetch("/api/admin/test-imagenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setDalleUrl(data.dalle_url ?? null);
        setGeminiUrl(data.gemini_url ?? null);
      }
    } catch {
      setError("Error al generar imágenes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-serif text-2xl font-bold mb-6">Test: DALL-E vs Gemini</h1>
      <textarea
        className="w-full border border-gray-300 rounded p-3 text-sm mb-4 h-32"
        placeholder="Describí la escena que querés generar..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <button
        onClick={handleTest}
        disabled={loading || !prompt.trim()}
        className="rounded bg-[var(--rojo)] px-6 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Generando (puede tardar 1-2 min)..." : "Generar con ambos"}
      </button>
      {error && <p className="text-red-600 mt-4">{error}</p>}
      {(dalleUrl || geminiUrl) && (
        <div className="mt-8 grid grid-cols-2 gap-6">
          <div>
            <h2 className="font-bold text-lg mb-2">DALL-E 3</h2>
            {dalleUrl ? (
              <img src={dalleUrl} alt="DALL-E" className="w-full rounded" />
            ) : (
              <p className="text-gray-500 text-sm">No disponible</p>
            )}
          </div>
          <div>
            <h2 className="font-bold text-lg mb-2">Gemini 2.0</h2>
            {geminiUrl ? (
              <img src={geminiUrl} alt="Gemini" className="w-full rounded" />
            ) : (
              <p className="text-gray-500 text-sm">No disponible</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
