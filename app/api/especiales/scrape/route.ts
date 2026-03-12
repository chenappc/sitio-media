import { NextRequest, NextResponse } from "next/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function auth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return !!ADMIN_SECRET && secret === ADMIN_SECRET;
}

/** Stub: el scrape de especiales se implementará después. */
export async function POST(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json(
    { error: "Scrape de especiales no implementado aún. Endpoint listo para conectar." },
    { status: 501 }
  );
}
