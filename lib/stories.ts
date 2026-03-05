import pool from "./db";
import type { Story, StoryPagina } from "./types";

/** Devuelve todas las stories con id, slug, titulo, status, total_paginas, created_at. */
export async function getStories(): Promise<Story[]> {
  try {
    const res = await pool.query<Story>(
      `SELECT id, slug, titulo, status, total_paginas, created_at
       FROM stories
       ORDER BY updated_at DESC`
    );
    return res.rows;
  } catch {
    return [];
  }
}

/** Devuelve la story por slug con sus páginas ordenadas por numero. */
export async function getStoryBySlug(slug: string): Promise<{
  story: Story | null;
  paginas: StoryPagina[];
}> {
  try {
    const storyRes = await pool.query<Story>(
      `SELECT id, slug, titulo, status, total_paginas, created_at, updated_at
       FROM stories
       WHERE slug = $1`,
      [slug]
    );
    const story = storyRes.rows[0] ?? null;
    if (!story) return { story: null, paginas: [] };

    const paginasRes = await pool.query<StoryPagina & { parrafos: string }>(
      `SELECT id, story_id, numero, imagen_url, parrafos, created_at
       FROM story_paginas
       WHERE story_id = $1
       ORDER BY numero ASC`,
      [story.id]
    );
    const paginas: StoryPagina[] = paginasRes.rows.map((row) => ({
      ...row,
      parrafos: typeof row.parrafos === "string" ? JSON.parse(row.parrafos) : row.parrafos,
    }));

    return { story, paginas };
  } catch {
    return { story: null, paginas: [] };
  }
}

/** Devuelve la story y la página específica por slug y numero. */
export async function getStoryPagina(
  slug: string,
  numero: number
): Promise<{ story: Story | null; pagina: StoryPagina | null }> {
  try {
    const storyRes = await pool.query<Story>(
      `SELECT id, slug, titulo, status, total_paginas, created_at, updated_at
       FROM stories
       WHERE slug = $1`,
      [slug]
    );
    const story = storyRes.rows[0] ?? null;
    if (!story) return { story: null, pagina: null };

    const paginaRes = await pool.query<StoryPagina & { parrafos: string }>(
      `SELECT id, story_id, numero, imagen_url, parrafos, created_at
       FROM story_paginas
       WHERE story_id = $1 AND numero = $2`,
      [story.id, numero]
    );
    const row = paginaRes.rows[0];
    if (!row) return { story, pagina: null };

    const pagina: StoryPagina = {
      ...row,
      parrafos: typeof row.parrafos === "string" ? JSON.parse(row.parrafos) : row.parrafos,
    };
    return { story, pagina };
  } catch {
    return { story: null, pagina: null };
  }
}
