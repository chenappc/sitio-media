import { NextResponse } from "next/server";
import { getStories } from "@/lib/stories";

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
