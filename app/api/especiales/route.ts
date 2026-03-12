import { NextRequest, NextResponse } from "next/server";
import { getEspeciales } from "@/lib/especiales";
import pool from "@/lib/db";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function auth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return !!ADMIN_SECRET && secret === ADMIN_SECRET;
}

export async function GET() {
  try {
    const especiales = await getEspeciales();
    return NextResponse.json(especiales);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al listar especiales" },
      { status: 500 }
    );
  }
}

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
    const titulo = typeof body.titulo === "string" ? body.titulo.trim() : undefined;
    const status = typeof body.status === "string" ? body.status.trim() : undefined;
    if (titulo !== undefined) {
      await pool.query("UPDATE especiales SET titulo = $1, updated_at = NOW() WHERE id = $2", [titulo, id]);
    }
    if (status !== undefined && ["draft", "published"].includes(status)) {
      await pool.query("UPDATE especiales SET status = $1, updated_at = NOW() WHERE id = $2", [status, id]);
    }
    if (titulo === undefined && (!status || !["draft", "published"].includes(status))) {
      return NextResponse.json({ error: "titulo o status (draft|published) requerido" }, { status: 400 });
    }
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
