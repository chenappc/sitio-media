import pool from "./db";
import type { Especial } from "./types";

/** Devuelve todos los especiales ordenados por updated_at DESC. */
export async function getEspeciales(): Promise<Especial[]> {
  try {
    const res = await pool.query<Especial>(
      `SELECT id, slug, titulo, status, total_paginas, url_base, idioma, usar_imagenes_ia, created_at, updated_at
       FROM especiales
       ORDER BY updated_at DESC`
    );
    return res.rows;
  } catch {
    return [];
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

/** Inserta una página de un especial. */
export async function addEspecialPagina(
  especialId: number,
  numero: number,
  tituloItem: string | null,
  imagenUrl: string | null,
  imagenOriginalUrl: string | null,
  parrafos: unknown[]
): Promise<void> {
  await pool.query(
    `INSERT INTO especial_paginas (especial_id, numero, titulo_item, imagen_url, imagen_original_url, parrafos)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [especialId, numero, tituloItem, imagenUrl, imagenOriginalUrl, JSON.stringify(parrafos)]
  );
}
