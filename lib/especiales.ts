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
