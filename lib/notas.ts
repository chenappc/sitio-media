import pool from "./db";
import type { Nota } from "./types";

export async function getNotasPublicadas(limite: number): Promise<Nota[]> {
  try {
    const res = await pool.query<Nota>(
    `SELECT id, slug, titulo, entradilla, cuerpo, imagen_url, imagen2_url, imagen_alt,
            fuente_nombre, fuente_url, shares_buzzsumo, pais, publicado, fecha
     FROM notas
     WHERE publicado = true
     ORDER BY fecha DESC
     LIMIT $1`,
    [limite]
  );
    return res.rows;
  } catch {
    return [];
  }
}

export async function getNotaBySlug(slug: string): Promise<Nota | null> {
  try {
    const res = await pool.query<Nota>(
    `SELECT id, slug, titulo, entradilla, cuerpo, imagen_url, imagen2_url, imagen_alt,
            fuente_nombre, fuente_url, shares_buzzsumo, pais, publicado, fecha
     FROM notas
     WHERE slug = $1 AND publicado = true`,
    [slug]
  );
    return res.rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function getTodasNotas(): Promise<Nota[]> {
  try {
    const res = await pool.query<Nota>(
      `SELECT id, slug, titulo, entradilla, shares_buzzsumo, publicado, fecha
       FROM notas
       ORDER BY fecha DESC`
    );
    return res.rows;
  } catch {
    return [];
  }
}

export async function getNotaById(id: number): Promise<Nota | null> {
  try {
    const res = await pool.query<Nota>(
      `SELECT id, slug, titulo, entradilla, cuerpo, imagen_url, imagen2_url, imagen_alt,
              fuente_nombre, fuente_url, shares_buzzsumo, pais, publicado, fecha
       FROM notas
       WHERE id = $1`,
      [id]
    );
    return res.rows[0] ?? null;
  } catch {
    return null;
  }
}

export interface ActualizarNotaInput {
  titulo: string;
  entradilla: string;
  cuerpo: string;
  imagen_url?: string | null;
  imagen_alt?: string | null;
  fuente_nombre: string;
  fuente_url: string;
  shares_buzzsumo: number;
  pais: string;
  publicado: boolean;
}

export async function updateNota(id: number, input: ActualizarNotaInput): Promise<Nota | null> {
  try {
    const res = await pool.query<Nota>(
      `UPDATE notas
       SET titulo = $1, entradilla = $2, cuerpo = $3, imagen_url = $4, imagen_alt = $5,
           fuente_nombre = $6, fuente_url = $7, shares_buzzsumo = $8, pais = $9, publicado = $10
       WHERE id = $11
       RETURNING id, slug, titulo, entradilla, cuerpo, imagen_url, imagen_alt, fuente_nombre, fuente_url, shares_buzzsumo, pais, publicado, fecha`,
      [
        input.titulo.trim(),
        input.entradilla.trim(),
        input.cuerpo.trim(),
        input.imagen_url ?? null,
        input.imagen_alt ?? null,
        input.fuente_nombre.trim(),
        input.fuente_url.trim(),
        input.shares_buzzsumo,
        input.pais.trim(),
        input.publicado,
        id,
      ]
    );
    return res.rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function deleteNota(id: number): Promise<boolean> {
  try {
    const res = await pool.query("DELETE FROM notas WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

export interface CrearNotaInput {
  titulo: string;
  entradilla: string;
  cuerpo: string;
  imagen_url?: string;
  imagen2_url?: string | null;
  imagen_alt?: string;
  fuente_nombre: string;
  fuente_url: string;
  shares_buzzsumo: number;
  pais: string;
  publicado: boolean;
}

export async function createNota(input: CrearNotaInput): Promise<Nota> {
  const slugify = (await import("slugify")).default;
  const baseSlug = slugify(input.titulo, { lower: true, strict: true });
  let slug = baseSlug;
  let n = 0;
  while (true) {
    const exists = await pool.query("SELECT 1 FROM notas WHERE slug = $1", [slug]);
    if (exists.rows.length === 0) break;
    n += 1;
    slug = `${baseSlug}-${n}`;
  }

  const res = await pool.query<Nota>(
    `INSERT INTO notas (slug, titulo, entradilla, cuerpo, imagen_url, imagen2_url, imagen_alt, fuente_nombre, fuente_url, shares_buzzsumo, pais, publicado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id, slug, titulo, entradilla, cuerpo, imagen_url, imagen2_url, imagen_alt, fuente_nombre, fuente_url, shares_buzzsumo, pais, publicado, fecha`,
    [
      slug,
      input.titulo,
      input.entradilla,
      input.cuerpo,
      input.imagen_url ?? null,
      input.imagen2_url ?? null,
      input.imagen_alt ?? null,
      input.fuente_nombre,
      input.fuente_url,
      input.shares_buzzsumo,
      input.pais,
      input.publicado,
    ]
  );
  return res.rows[0];
}
