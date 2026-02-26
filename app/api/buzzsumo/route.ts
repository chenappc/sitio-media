import { NextResponse } from "next/server";
import { obtenerViralBuzzSumo } from "@/lib/buzzsumo";

export async function GET() {
  try {
    const resultados = await obtenerViralBuzzSumo();
    return NextResponse.json(resultados);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al obtener BuzzSumo" },
      { status: 500 }
    );
  }
}
