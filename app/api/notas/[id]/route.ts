import { NextRequest, NextResponse } from "next/server";
import { getNotaById, updateNota, deleteNota } from "@/lib/notas";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function auth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return !!ADMIN_SECRET && secret === ADMIN_SECRET;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  req: NextRequest,
  context: RouteContext
) {
  if (!auth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await context.params;
  const idNum = parseInt(id, 10);
  if (Number.isNaN(idNum)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  try {
    const nota = await getNotaById(idNum);
    if (!nota) {
      return NextResponse.json({ error: "Nota no encontrada" }, { status: 404 });
    }
    return NextResponse.json(nota);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al obtener nota" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: RouteContext
) {
  if (!auth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await context.params;
  const idNum = parseInt(id, 10);
  if (Number.isNaN(idNum)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  try {
    const body = await req.json();
    const {
      titulo,
      entradilla,
      cuerpo,
      imagen_url,
      imagen_alt,
      fuente_nombre,
      fuente_url,
      shares_buzzsumo,
      pais,
      publicado,
    } = body;
    if (!titulo || !entradilla || !cuerpo || !fuente_nombre || !fuente_url) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: titulo, entradilla, cuerpo, fuente_nombre, fuente_url" },
        { status: 400 }
      );
    }
    const nota = await updateNota(idNum, {
      titulo: String(titulo).trim(),
      entradilla: String(entradilla).trim(),
      cuerpo: String(cuerpo).trim(),
      imagen_url: imagen_url != null ? String(imagen_url).trim() || null : null,
      imagen_alt: imagen_alt != null ? String(imagen_alt).trim() || null : null,
      fuente_nombre: String(fuente_nombre).trim(),
      fuente_url: String(fuente_url).trim(),
      shares_buzzsumo: Number(shares_buzzsumo) || 0,
      pais: String(pais || "general").trim(),
      publicado: Boolean(publicado),
    });
    if (!nota) {
      return NextResponse.json({ error: "Nota no encontrada" }, { status: 404 });
    }
    return NextResponse.json(nota);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al actualizar nota" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: RouteContext
) {
  if (!auth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await context.params;
  const idNum = parseInt(id, 10);
  if (Number.isNaN(idNum)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  try {
    const deleted = await deleteNota(idNum);
    if (!deleted) {
      return NextResponse.json({ error: "Nota no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al borrar nota" },
      { status: 500 }
    );
  }
}
