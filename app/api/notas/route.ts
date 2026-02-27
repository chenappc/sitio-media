import { NextRequest, NextResponse } from "next/server";
import { getTodasNotas, createNota } from "@/lib/notas";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function auth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return !!ADMIN_SECRET && secret === ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const notas = await getTodasNotas();
    return NextResponse.json(notas);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al listar notas" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
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
    const nota = await createNota({
      titulo: String(titulo).trim(),
      entradilla: String(entradilla).trim(),
      cuerpo: String(cuerpo).trim(),
      imagen_url: imagen_url ? String(imagen_url).trim() : undefined,
      imagen_alt: imagen_alt ? String(imagen_alt).trim() : undefined,
      fuente_nombre: String(fuente_nombre).trim(),
      fuente_url: String(fuente_url).trim(),
      shares_buzzsumo: Number(shares_buzzsumo) || 0,
      pais: String(pais || "general").trim(),
      publicado: Boolean(publicado),
    });
    return NextResponse.json(nota);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear nota" },
      { status: 500 }
    );
  }
}
