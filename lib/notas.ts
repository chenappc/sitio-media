import pool from "./db";
import type { Nota } from "./types";

/** Cantidad total de notas publicadas (para paginación). */
export async function getTotalNotasPublicadas(): Promise<number> {
  try {
    const res = await pool.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM notas WHERE publicado = true AND (idioma = 'es' OR idioma IS NULL)"
    );
    return parseInt(res.rows[0]?.count ?? "0", 10);
  } catch {
    return 0;
  }
}

export async function getNotasPublicadas(opts: {
  limit: number;
  offset?: number;
}): Promise<Nota[]> {
  try {
    const { limit, offset = 0 } = opts;
    const res = await pool.query<Nota>(
      `SELECT id, slug, titulo, entradilla, cuerpo, imagen_url, imagen2_url, imagen_alt,
              fuente_nombre, fuente_url, shares_buzzsumo, pais, publicado, fecha
       FROM notas
       WHERE publicado = true AND (idioma = 'es' OR idioma IS NULL)
       ORDER BY fecha DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.rows;
  } catch {
    return [];
  }
}

/** Notas publicadas con un idioma concreto (p. ej. feed en inglés). */
export async function getTotalNotasPublicadasPorIdioma(idioma: string): Promise<number> {
  try {
    const res = await pool.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM notas WHERE publicado = true AND idioma = $1",
      [idioma]
    );
    return parseInt(res.rows[0]?.count ?? "0", 10);
  } catch {
    return 0;
  }
}

export async function getNotasPublicadasPorIdioma(opts: {
  limit: number;
  offset?: number;
  idioma: string;
}): Promise<Nota[]> {
  try {
    const { limit, offset = 0, idioma } = opts;
    const res = await pool.query<Nota>(
      `SELECT id, slug, titulo, entradilla, cuerpo, imagen_url, imagen2_url, imagen_alt,
              fuente_nombre, fuente_url, shares_buzzsumo, pais, publicado, fecha, idioma
       FROM notas
       WHERE publicado = true AND idioma = $3
       ORDER BY fecha DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset, idioma]
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

/** Nota por slug solo si coincide el idioma (p. ej. ruta /en/[slug]). */
export async function getNotaBySlugYIdioma(slug: string, idioma: string): Promise<Nota | null> {
  try {
    const res = await pool.query<Nota>(
      `SELECT id, slug, titulo, entradilla, cuerpo, imagen_url, imagen2_url, imagen_alt,
              fuente_nombre, fuente_url, shares_buzzsumo, pais, publicado, fecha, idioma
       FROM notas
       WHERE slug = $1 AND publicado = true AND idioma = $2`,
      [slug, idioma]
    );
    return res.rows[0] ?? null;
  } catch {
    return null;
  }
}

export type NotaRelacionada = {
  id: number;
  slug: string;
  titulo: string;
  imagen_url: string | null;
  fecha: Date;
};

/** Extrae palabras de más de 4 caracteres del título (sin acentos/símbolos) para búsqueda. */
function extraerPalabrasTitulo(titulo: string): string[] {
  const palabras = titulo
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/\s+/)
    .map((w) => w.replace(/\W/g, "").toLowerCase())
    .filter((w) => w.length > 4);
  return [...new Set(palabras)].slice(0, 10);
}

/** Incrementa el contador de visitas de una nota. */
export async function incrementarVisitas(id: number): Promise<void> {
  await pool.query("UPDATE notas SET visitas = COALESCE(visitas, 0) + 1 WHERE id = $1", [id]);
}

/** Mix: 2 con más visitas + 2 más relevantes por título; sin repetir ni incluir la nota actual. Completa con recientes hasta limit. */
export async function getNotasRelacionadas(
  slug: string,
  titulo: string,
  limit = 4
): Promise<NotaRelacionada[]> {
  try {
    const palabras = extraerPalabrasTitulo(titulo);
    const seenIds = new Set<number>();

    const byVisitas = await pool.query<NotaRelacionada>(
      `SELECT id, slug, titulo, imagen_url, fecha
       FROM notas
       WHERE publicado = true AND slug != $1
       ORDER BY COALESCE(visitas, 0) DESC, fecha DESC
       LIMIT 2`,
      [slug]
    );
    const rows: NotaRelacionada[] = byVisitas.rows.map((r) => {
      seenIds.add(r.id);
      return { id: r.id, slug: r.slug, titulo: r.titulo, imagen_url: r.imagen_url, fecha: r.fecha };
    });

    let byRelevance: NotaRelacionada[] = [];
    if (palabras.length > 0) {
      const excludeIds = rows.length > 0 ? [slug, palabras, [...seenIds]] as const : [slug, palabras];
      const relevanceRes = await pool.query<NotaRelacionada & { match_count: string }>(
        `SELECT id, slug, titulo, imagen_url, fecha,
                (SELECT count(*) FROM unnest($2::text[]) w WHERE n.titulo ILIKE '%' || w || '%') AS match_count
         FROM notas n
         WHERE n.publicado = true AND n.slug != $1
           AND (SELECT count(*) FROM unnest($2::text[]) w WHERE n.titulo ILIKE '%' || w || '%') > 0
           ${rows.length > 0 ? "AND n.id != ALL($3::int[])" : ""}
         ORDER BY match_count DESC, n.fecha DESC
         LIMIT 2`,
        excludeIds.length === 3 ? [slug, palabras, excludeIds[2]] : [slug, palabras]
      );
      byRelevance = relevanceRes.rows
        .filter((r) => !seenIds.has(r.id))
        .map((r) => {
          seenIds.add(r.id);
          return { id: r.id, slug: r.slug, titulo: r.titulo, imagen_url: r.imagen_url, fecha: r.fecha };
        });
    }
    const merged = [...rows, ...byRelevance];

    if (merged.length < limit) {
      const restIds = merged.length > 0 ? [slug, [...seenIds], limit - merged.length] : [slug, limit - merged.length];
      const restQuery =
        merged.length > 0
          ? `SELECT id, slug, titulo, imagen_url, fecha
             FROM notas
             WHERE publicado = true AND slug != $1 AND id != ALL($2::int[])
             ORDER BY fecha DESC
             LIMIT $3`
          : `SELECT id, slug, titulo, imagen_url, fecha
             FROM notas
             WHERE publicado = true AND slug != $1
             ORDER BY fecha DESC
             LIMIT $2`;
      const restRes = await pool.query<NotaRelacionada>(
        restQuery,
        merged.length > 0 ? restIds : [slug, limit - merged.length]
      );
      merged.push(...restRes.rows);
    }

    return merged.slice(0, limit);
  } catch {
    return [];
  }
}

/** Igual que getNotasRelacionadas pero solo notas del mismo idioma. */
export async function getNotasRelacionadasPorIdioma(
  slug: string,
  titulo: string,
  idioma: string,
  limit = 4
): Promise<NotaRelacionada[]> {
  try {
    const palabras = extraerPalabrasTitulo(titulo);
    const seenIds = new Set<number>();

    const byVisitas = await pool.query<NotaRelacionada>(
      `SELECT id, slug, titulo, imagen_url, fecha
       FROM notas
       WHERE publicado = true AND slug != $1 AND idioma = $2
       ORDER BY COALESCE(visitas, 0) DESC, fecha DESC
       LIMIT 2`,
      [slug, idioma]
    );
    const rows: NotaRelacionada[] = byVisitas.rows.map((r) => {
      seenIds.add(r.id);
      return { id: r.id, slug: r.slug, titulo: r.titulo, imagen_url: r.imagen_url, fecha: r.fecha };
    });

    let byRelevance: NotaRelacionada[] = [];
    if (palabras.length > 0) {
      const relevanceRes = await pool.query<NotaRelacionada & { match_count: string }>(
        rows.length > 0
          ? `SELECT id, slug, titulo, imagen_url, fecha,
                (SELECT count(*) FROM unnest($2::text[]) w WHERE n.titulo ILIKE '%' || w || '%') AS match_count
         FROM notas n
         WHERE n.publicado = true AND n.slug != $1 AND n.idioma = $4
           AND (SELECT count(*) FROM unnest($2::text[]) w WHERE n.titulo ILIKE '%' || w || '%') > 0
           AND n.id != ALL($3::int[])
         ORDER BY match_count DESC, n.fecha DESC
         LIMIT 2`
          : `SELECT id, slug, titulo, imagen_url, fecha,
                (SELECT count(*) FROM unnest($2::text[]) w WHERE n.titulo ILIKE '%' || w || '%') AS match_count
         FROM notas n
         WHERE n.publicado = true AND n.slug != $1 AND n.idioma = $3
           AND (SELECT count(*) FROM unnest($2::text[]) w WHERE n.titulo ILIKE '%' || w || '%') > 0
         ORDER BY match_count DESC, n.fecha DESC
         LIMIT 2`,
        rows.length > 0 ? [slug, palabras, [...seenIds], idioma] : [slug, palabras, idioma]
      );
      byRelevance = relevanceRes.rows
        .filter((r) => !seenIds.has(r.id))
        .map((r) => {
          seenIds.add(r.id);
          return { id: r.id, slug: r.slug, titulo: r.titulo, imagen_url: r.imagen_url, fecha: r.fecha };
        });
    }
    const merged = [...rows, ...byRelevance];

    if (merged.length < limit) {
      const restIds =
        merged.length > 0 ? [slug, [...seenIds], limit - merged.length, idioma] : [slug, limit - merged.length, idioma];
      const restQuery =
        merged.length > 0
          ? `SELECT id, slug, titulo, imagen_url, fecha
             FROM notas
             WHERE publicado = true AND slug != $1 AND id != ALL($2::int[]) AND idioma = $4
             ORDER BY fecha DESC
             LIMIT $3`
          : `SELECT id, slug, titulo, imagen_url, fecha
             FROM notas
             WHERE publicado = true AND slug != $1 AND idioma = $3
             ORDER BY fecha DESC
             LIMIT $2`;
      const restRes = await pool.query<NotaRelacionada>(
        restQuery,
        merged.length > 0 ? restIds : [slug, limit - merged.length, idioma]
      );
      merged.push(...restRes.rows);
    }

    return merged.slice(0, limit);
  } catch {
    return [];
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

/** Cuenta total de notas. */
export async function getTotalNotas(): Promise<number> {
  try {
    const res = await pool.query<{ count: string }>("SELECT COUNT(*) AS count FROM notas");
    return parseInt(res.rows[0]?.count ?? "0", 10);
  } catch {
    return 0;
  }
}

/** Trae notas (publicadas y no publicadas) ordenadas por fecha descendente. Con { limit, offset } para paginación. */
export async function getTodasLasNotas(opts?: {
  limit?: number;
  offset?: number;
}): Promise<Nota[]> {
  try {
    const limit = opts?.limit;
    const offset = opts?.offset ?? 0;
    const hasPagination =
      typeof limit === "number" && limit > 0 && typeof offset === "number" && offset >= 0;
    const query = hasPagination
      ? `SELECT id, slug, titulo, entradilla, shares_buzzsumo, publicado, fecha, fb_post_id, fb_post_url, COALESCE(visitas, 0) AS visitas
         FROM notas
         ORDER BY fecha DESC
         LIMIT $1 OFFSET $2`
      : `SELECT id, slug, titulo, entradilla, shares_buzzsumo, publicado, fecha, fb_post_id, fb_post_url, COALESCE(visitas, 0) AS visitas
         FROM notas
         ORDER BY fecha DESC`;
    const res = await pool.query<Nota>(query, hasPagination ? [limit, offset] : []);
    return res.rows;
  } catch {
    return [];
  }
}

export async function getNotaById(id: number): Promise<Nota | null> {
  try {
    const res = await pool.query<Nota>(
      `SELECT id, slug, titulo, entradilla, cuerpo, imagen_url, imagen2_url, imagen_alt,
              fuente_nombre, fuente_url, shares_buzzsumo, pais, publicado, fecha, fb_post_id, fb_post_url, idioma
       FROM notas
       WHERE id = $1`,
      [id]
    );
    return res.rows[0] ?? null;
  } catch {
    return null;
  }
}

/** Actualiza fb_post_id y fb_post_url de una nota después de postear en Facebook. */
export async function updateNotaFbPost(
  notaId: number,
  fbPostId: string,
  fbPostUrl: string
): Promise<void> {
  await pool.query(
    "UPDATE notas SET fb_post_id = $1, fb_post_url = $2 WHERE id = $3",
    [fbPostId, fbPostUrl, notaId]
  );
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

export async function updateNotaImagenUrl(id: number, imagen_url: string): Promise<boolean> {
  try {
    const res = await pool.query("UPDATE notas SET imagen_url = $1 WHERE id = $2", [
      imagen_url,
      id,
    ]);
    return (res.rowCount ?? 0) > 0;
  } catch {
    return false;
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
  /** Default "es" si la columna existe */
  idioma?: string;
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

  let idioma = String(input.idioma ?? "es").trim().toLowerCase();
  if (idioma !== "es" && idioma !== "en" && idioma !== "original") idioma = "es";

  const res = await pool.query<Nota>(
    `INSERT INTO notas (slug, titulo, entradilla, cuerpo, imagen_url, imagen2_url, imagen_alt, fuente_nombre, fuente_url, shares_buzzsumo, pais, publicado, idioma)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id, slug, titulo, entradilla, cuerpo, imagen_url, imagen2_url, imagen_alt, fuente_nombre, fuente_url, shares_buzzsumo, pais, publicado, idioma, fecha`,
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
      idioma,
    ]
  );
  return res.rows[0];
}
