import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug")?.trim();
    if (!slug) {
      return NextResponse.json({ error: "slug es requerido" }, { status: 400 });
    }

    const excluirRaw = searchParams.get("excluir") ?? "";
    const extra = excluirRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const excluidos = [...new Set([slug, ...extra])];

    const limitRaw = searchParams.get("limit");
    const limit =
      limitRaw != null && limitRaw !== ""
        ? Math.max(1, parseInt(limitRaw, 10) || 1)
        : 1;

    const idiomaParam = searchParams.get("idioma")?.trim().toLowerCase();
    const idioma = idiomaParam === "en" ? "en" : "es";

    const res = await pool.query(
      `SELECT id, slug, titulo, entradilla, cuerpo, imagen_url, imagen2_url, imagen_alt, fuente_nombre, fuente_url, pais, fecha
       FROM notas
       WHERE publicado = true AND (idioma = $1 OR ($1 = 'es' AND idioma IS NULL)) AND slug != ALL($2::text[])
       ORDER BY visitas DESC
       LIMIT $3`,
      [idioma, excluidos, limit]
    );

    return NextResponse.json(res.rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al obtener notas" },
      { status: 500 }
    );
  }
}
