import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function auth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return !!ADMIN_SECRET && secret === ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const countOnly = req.nextUrl.searchParams.get("count") === "true";
  try {
    if (countOnly) {
      const { rows } = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM candidatos_buzzsumo WHERE status = 'pendiente'`
      );
      return NextResponse.json({ count: Number(rows[0]?.count ?? 0) });
    }
    const { rows } = await pool.query(
      `SELECT id, titulo, url, thumbnail, total_facebook_shares, keyword, status, nota_id, created_at
       FROM candidatos_buzzsumo
       WHERE status = 'pendiente'
       ORDER BY total_facebook_shares DESC`
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al listar candidatos" },
      { status: 500 }
    );
  }
}
