import { NextRequest, NextResponse } from "next/server";
import { getStories } from "@/lib/stories";
import pool from "@/lib/db";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function auth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return !!ADMIN_SECRET && secret === ADMIN_SECRET;
}

export async function GET() {
  try {
    const stories = await getStories();
    return NextResponse.json(stories);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al listar stories" },
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
    const status = String(body.status ?? "").trim();
    if (Number.isNaN(id) || !id || !["draft", "published"].includes(status)) {
      return NextResponse.json({ error: "id y status (draft|published) requeridos" }, { status: 400 });
    }
    await pool.query("UPDATE stories SET status = $1, updated_at = NOW() WHERE id = $2", [status, id]);
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
    await pool.query("DELETE FROM story_paginas WHERE story_id = $1", [id]);
    await pool.query("DELETE FROM stories WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al borrar" },
      { status: 500 }
    );
  }
}
