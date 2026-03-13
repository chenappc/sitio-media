import { NextRequest, NextResponse } from "next/server";
import { getAllEspeciales } from "@/lib/especiales";
import pool from "@/lib/db";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function auth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return !!ADMIN_SECRET && secret === ADMIN_SECRET;
}

/** GET: todos los especiales ordenados por created_at DESC (id, slug, titulo, status, total_paginas, created_at). */
export async function GET() {
  try {
    const especiales = await getAllEspeciales();
    return NextResponse.json(especiales);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al listar especiales" },
      { status: 500 }
    );
  }
}

/** PATCH: { id, status }. Requiere x-admin-secret. */
export async function PATCH(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const id = typeof body.id === "number" ? body.id : parseInt(String(body.id ?? ""), 10);
    if (Number.isNaN(id) || !id) {
      return NextResponse.json({ error: "id requerido" }, { status: 400 });
    }
    const status = typeof body.status === "string" ? body.status.trim() : "";
    if (!["draft", "published"].includes(status)) {
      return NextResponse.json({ error: "status debe ser draft o published" }, { status: 400 });
    }
    await pool.query("UPDATE especiales SET status = $1, updated_at = NOW() WHERE id = $2", [status, id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al actualizar" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const id = typeof body.id === "number" ? body.id : parseInt(String(body.id ?? ""), 10);
    if (Number.isNaN(id) || !id) {
      return NextResponse.json({ error: "id requerido" }, { status: 400 });
    }
    await pool.query("DELETE FROM especial_paginas WHERE especial_id = $1", [id]);
    await pool.query("DELETE FROM especiales WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al borrar" },
      { status: 500 }
    );
  }
}
