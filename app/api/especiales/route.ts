import { NextResponse } from "next/server";
import { getEspeciales } from "@/lib/especiales";

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
