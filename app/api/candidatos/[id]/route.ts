import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function auth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return !!ADMIN_SECRET && secret === ADMIN_SECRET;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, context: RouteContext) {
  if (!auth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await context.params;
  const idNum = parseInt(id, 10);
  if (Number.isNaN(idNum)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  try {
    await pool.query(
      "UPDATE candidatos_buzzsumo SET status = 'descartado' WHERE id = $1",
      [idNum]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al descartar candidato" },
      { status: 500 }
    );
  }
}
