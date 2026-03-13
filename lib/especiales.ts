import pool from "./db";
import type { Especial, EspecialPagina, Bloque } from "./types";

export type EspecialRow = {
  id: number;
  slug: string;
  titulo: string;
  status: string;
  total_paginas: number;
  created_at?: Date;
};

/** Devuelve todos los especiales ordenados por created_at DESC (campos listados). */
export async function getAllEspeciales(): Promise<EspecialRow[]> {
  try {
    const res = await pool.query<EspecialRow>(
      `SELECT id, slug, titulo, status, total_paginas, created_at
       FROM especiales
       ORDER BY created_at DESC`
    );
    return res.rows;
  } catch {
    return [];
  }
}

/** @deprecated Use getAllEspeciales. */
export async function getEspeciales(): Promise<EspecialRow[]> {
  return getAllEspeciales();
}

/** Devuelve el especial por slug con sus páginas ordenadas por numero. No filtra por status (draft o published; igual que getStoryPagina). */
export async function getEspecialBySlug(slug: string): Promise<{
  especial: Especial | null;
  paginas: EspecialPagina[];
}> {
  try {
    const especialRes = await pool.query<Especial>(
      `SELECT id, slug, titulo, status, total_paginas, url_base, idioma, usar_imagenes_ia, created_at, updated_at
       FROM especiales WHERE slug = $1`,
      [slug]
    );
    const especial = especialRes.rows[0] ?? null;
    if (!especial) return { especial: null, paginas: [] };

    const paginasRes = await pool.query<
      EspecialPagina & { parrafos: string; bloques: string | Bloque[] }
    >(
      `SELECT id, especial_id, numero, titulo_item, imagen_url, imagen_original_url, parrafos, COALESCE(bloques, '[]'::jsonb) as bloques, created_at
       FROM especial_paginas WHERE especial_id = $1 ORDER BY numero ASC`,
      [especial.id]
    );
    const paginas: EspecialPagina[] = paginasRes.rows.map((row) => ({
      ...row,
      parrafos: typeof row.parrafos === "string" ? JSON.parse(row.parrafos) : row.parrafos,
      bloques: Array.isArray(row.bloques) ? row.bloques : (typeof row.bloques === "string" ? JSON.parse(row.bloques) : []),
    }));
    return { especial, paginas };
  } catch {
    return { especial: null, paginas: [] };
  }
}

/** Crea un especial y devuelve su id. */
export async function createEspecial(
  slug: string,
  titulo: string,
  totalPaginas: number,
  urlBase: string | null,
  idioma: string,
  usarImagenesIa: boolean
): Promise<number> {
  const res = await pool.query<{ id: number }>(
    `INSERT INTO especiales (slug, titulo, status, total_paginas, url_base, idioma, usar_imagenes_ia)
     VALUES ($1, $2, 'draft', $3, $4, $5, $6)
     RETURNING id`,
    [slug, titulo, totalPaginas, urlBase, idioma, usarImagenesIa]
  );
  return res.rows[0].id;
}

/** Inserta una página de un especial. Parrafos se deriva de bloques si no se pasa. */
export async function addEspecialPagina(
  especialId: number,
  numero: number,
  tituloItem: string | null,
  imagenUrl: string | null,
  imagenOriginalUrl: string | null,
  parrafos: unknown[],
  bloques?: Bloque[]
): Promise<void> {
  const bloquesJson = JSON.stringify(bloques ?? []);
  const parrafosVal = parrafos.length > 0 ? parrafos : (bloques ?? []).filter((b): b is { tipo: "parrafo"; texto: string } => b.tipo === "parrafo").map((b) => b.texto);
  await pool.query(
    `INSERT INTO especial_paginas (especial_id, numero, titulo_item, imagen_url, imagen_original_url, parrafos, bloques)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [especialId, numero, tituloItem, imagenUrl, imagenOriginalUrl, JSON.stringify(parrafosVal), bloquesJson]
  );
}
