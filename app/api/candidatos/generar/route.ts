import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

const ADMIN_SECRET = process.env.ADMIN_SECRET;
const BUZZSUMO_API_BASE = "https://api.buzzsumo.com";
const EVAL_PROMPT = `Evaluá si este artículo es apto para un portal de noticias hispanohablante dirigido a personas de 50+ años. Debe ser apto para Facebook y AdSense. Respondé SOLO con JSON sin markdown: {"apto": true/false, "razon": "breve razón"}

Rechazá SOLO si:
- Es sobre un famoso reconocido internacionalmente (actor, cantante, político, deportista profesional)
- Es sobre crimen violento, muerte o catástrofes
- Es contenido político partidario
- La URL es de YouTube, TikTok, Instagram, Twitter o Facebook
- Es claramente un anuncio o spam
- Es una recomendación de película, serie o contenido de streaming (Netflix, HBO, Disney+, etc.)

Aprobá si:
- Es una historia humana emotiva, curiosa, polémica o inspiradora
- Es sobre ciencia, naturaleza, animales, historia o curiosidades
- Es sobre personas comunes en situaciones extraordinarias
- Puede ser controversial o polémico pero sin violencia ni política
- El tema es interesante para personas de 50+

Título: [titulo]
URL: [url]`;

const KEYWORDS = [
  "viral",
  "emotivo OR conmovedor",
  "abuelito OR abuelita OR anciano",
];

function auth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return !!ADMIN_SECRET && secret === ADMIN_SECRET;
}

async function buscarBuzzSumo(
  q: string,
  apiKey: string,
  numResults: number = 10,
  meses: number = 24
): Promise<{ title?: string; url?: string; thumbnail?: string; total_facebook_shares?: number }[]> {
  const ahora = Math.floor(Date.now() / 1000);
  const segundosPorMes = 30 * 24 * 60 * 60;
  const desde = ahora - Math.max(1, Math.min(120, meses)) * segundosPorMes;
  const hasta = ahora;
  const params = new URLSearchParams({
    api_key: apiKey,
    q,
    num_results: String(Math.min(100, Math.max(1, numResults))),
    language: "es",
    sort_type: "facebook_shares",
    video: "0",
    general_article: "1",
    begin_date: String(desde),
    end_date: String(hasta),
  });
  const res = await fetch(`${BUZZSUMO_API_BASE}/search/articles.json?${params}`);
  const data = (await res.json()) as { results?: { title?: string; url?: string; thumbnail?: string; total_facebook_shares?: number }[] };
  console.log("CANDIDATOS DEBUG BuzzSumo response status:", res.status);
  console.log("CANDIDATOS DEBUG BuzzSumo response body:", JSON.stringify(data).slice(0, 500));
  if (!res.ok) return [];
  const articles = data.results ?? [];
  console.log("CANDIDATOS DEBUG resultados BuzzSumo por keyword:", { keyword: q, total: articles.length });
  return articles;
}

async function evaluarConClaude(titulo: string, url: string, apiKey: string): Promise<{ apto?: boolean; razon?: string; raw?: string; error?: string }> {
  const prompt = EVAL_PROMPT.replace("[titulo]", titulo).replace("[url]", url);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { content?: { text?: string }[]; error?: { message?: string } };
    const text = data.content?.[0]?.text?.trim() ?? data.error?.message ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { apto?: boolean; razon?: string };
      return parsed;
    }
    return { raw: text };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error" };
  }
}

export async function POST(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const buzzsumoKey = process.env.BUZZSUMO_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!buzzsumoKey || !anthropicKey) {
    return NextResponse.json(
      { error: "BUZZSUMO_API_KEY o ANTHROPIC_API_KEY no configuradas" },
      { status: 503 }
    );
  }
  let limit = 10;
  let minShares = 500;
  let keywords: string[] = KEYWORDS;
  let meses = 24;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      limit?: number;
      minShares?: number;
      keywords?: string[];
      meses?: number;
    };
    if (typeof body.limit === "number" && [10, 20, 40].includes(body.limit)) limit = body.limit;
    else {
      const limitParam = req.nextUrl.searchParams.get("limit");
      const limitRaw = limitParam ? parseInt(limitParam, 10) : 10;
      limit = [10, 20, 40].includes(limitRaw) ? limitRaw : 10;
    }
    if (typeof body.minShares === "number" && body.minShares >= 0) minShares = body.minShares;
    if (Array.isArray(body.keywords) && body.keywords.length > 0) {
      keywords = body.keywords.filter((k) => typeof k === "string" && k.trim() !== "").map((k) => k.trim());
      if (keywords.length === 0) keywords = KEYWORDS;
    }
    if (typeof body.meses === "number" && body.meses >= 1 && body.meses <= 120) meses = body.meses;
  } catch {
    // keep defaults
  }

  console.log("CANDIDATOS DEBUG minShares recibido:", minShares);
  console.log("CANDIDATOS DEBUG keywords recibidas:", keywords);

  const numPerKeyword = Math.min(20, Math.max(1, Math.ceil(limit / Math.max(1, keywords.length))));

  try {
    const { rows: existingRows } = await pool.query<{ url: string }>("SELECT url FROM candidatos_buzzsumo");
    const existingUrls = new Set(existingRows.map((r) => r.url?.toLowerCase?.() ?? ""));

    let added = 0;
    const seenUrls = new Set<string>();

    for (const kw of keywords) {
      const results = await buscarBuzzSumo(kw, buzzsumoKey, numPerKeyword, meses);
      console.log("CANDIDATOS DEBUG antes de filtro shares:", { keyword: kw, total: results.length, primerShares: results[0]?.total_facebook_shares });
      const articulosFiltrados = results.filter((a) => (a.total_facebook_shares ?? 0) > minShares);
      console.log("CANDIDATOS DEBUG pasaron filtro shares:", articulosFiltrados.length);
      const filtered = articulosFiltrados
        .filter((a) => {
          const u = (a.url ?? "").toLowerCase();
          return !["youtube.com", "tiktok.com", "instagram.com", "twitter.com", "facebook.com"].some((d) => u.includes(d));
        })
        .filter((a) => !(a.url ?? "").match(/\/videos?\//i));

      for (const a of filtered) {
        const url = (a.url ?? "").trim();
        const urlNorm = url.toLowerCase();
        if (!url || existingUrls.has(urlNorm) || seenUrls.has(urlNorm)) continue;
        seenUrls.add(urlNorm);

        const evalResult = await evaluarConClaude(a.title ?? "", url, anthropicKey);
        console.log("CANDIDATOS DEBUG evaluacion Claude:", { titulo: a.title ?? "", apto: evalResult.apto });
        if (evalResult.error || evalResult.apto !== true) continue;

        const insertRes = await pool.query(
          `INSERT INTO candidatos_buzzsumo (titulo, url, thumbnail, total_facebook_shares, keyword)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (url) DO NOTHING`,
          [a.title ?? "", url, a.thumbnail ?? null, a.total_facebook_shares ?? 0, kw]
        );
        if ((insertRes.rowCount ?? 0) > 0) {
          added++;
          existingUrls.add(urlNorm);
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      await new Promise((r) => setTimeout(r, 600));
    }

    return NextResponse.json({ ok: true, added, message: `Se encontraron ${added} candidatos nuevos.` });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al generar candidatos" },
      { status: 500 }
    );
  }
}
