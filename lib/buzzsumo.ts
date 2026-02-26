const BUZZSUMO_API_BASE = "https://api.buzzsumo.com";

export interface BuzzSumoArticle {
  title: string;
  url: string;
  total_shares: number;
  published_date?: string;
  image_url?: string;
  [key: string]: unknown;
}

export async function obtenerViralBuzzSumo(): Promise<BuzzSumoArticle[]> {
  const apiKey = process.env.BUZZSUMO_API_KEY;
  if (!apiKey) {
    throw new Error("BUZZSUMO_API_KEY no está definida");
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    language: "es",
    hours: "24",
    min_shares: "5000",
    num_results: "10",
    order_by: "total_shares",
  });

  const res = await fetch(`${BUZZSUMO_API_BASE}/trending/articles?${params}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`BuzzSumo API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { results?: BuzzSumoArticle[]; articles?: BuzzSumoArticle[] };
  const raw = Array.isArray(data) ? data : data.results ?? data.articles ?? [];

  const normalized = raw.slice(0, 10).map((a: Record<string, unknown>) => ({
    title: String(a.title ?? a.headline ?? ""),
    url: String(a.url ?? a.link ?? ""),
    total_shares: Number(a.total_shares ?? a.shares ?? a.engagement ?? 0),
    published_date: a.published_date ? String(a.published_date) : undefined,
    image_url: a.image_url ? String(a.image_url) : undefined,
    ...a,
  }));

  normalized.sort((a, b) => b.total_shares - a.total_shares);
  return normalized;
}
