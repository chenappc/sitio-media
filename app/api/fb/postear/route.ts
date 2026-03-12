import { NextRequest, NextResponse } from "next/server";
import { getNotaById, updateNotaFbPost } from "@/lib/notas";

// SQL de referencia (ejecutar en Railway PostgreSQL si no existen las columnas):
// ALTER TABLE notas ADD COLUMN IF NOT EXISTS fb_post_id TEXT;
// ALTER TABLE notas ADD COLUMN IF NOT EXISTS fb_post_url TEXT;

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function auth(req: NextRequest): boolean {
  const secret = req.headers.get("x-admin-secret");
  return !!ADMIN_SECRET && secret === ADMIN_SECRET;
}

export async function POST(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const notaId = body.notaId;
    if (notaId == null || typeof notaId !== "number") {
      return NextResponse.json({ error: "Falta notaId" }, { status: 400 });
    }

    const nota = await getNotaById(notaId);
    if (!nota) {
      return NextResponse.json({ error: "Nota no encontrada" }, { status: 404 });
    }

    const pageId = process.env.FB_PAGE_ID;
    const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;

    console.log("FB TOKEN DEBUG:", {
      pageId,
      tokenStart: accessToken?.slice(0, 20),
      tokenEnd: accessToken?.slice(-10),
      tokenLength: accessToken?.length,
    });

    if (!pageId || !accessToken) {
      return NextResponse.json(
        { error: "FB_PAGE_ID o FB_PAGE_ACCESS_TOKEN no configurados" },
        { status: 503 }
      );
    }

    const link = `https://www.sitio.media/${nota.slug}`;
    const message = nota.entradilla ?? "";

    const params = new URLSearchParams({
      link,
      message,
      access_token: accessToken,
    });

    const fbRes = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/feed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      }
    );

    const fbData = (await fbRes.json().catch(() => ({}))) as {
      id?: string;
      error?: { message?: string; code?: number };
    };

    if (!fbRes.ok || fbData.error) {
      const errMsg =
        fbData.error?.message ?? `Facebook API: ${fbRes.status}`;
      console.log("FB POST DEBUG:", { status: fbRes.status, pageId, fbData });
      console.error("Facebook feed error:", fbData);
      return NextResponse.json(
        { error: errMsg },
        { status: fbRes.ok ? 502 : fbRes.status }
      );
    }

    const postId = fbData.id ?? "";
    const [fbPageId, storyFbid] = postId.split("_");
    const postUrl =
      fbPageId && storyFbid
        ? `https://www.facebook.com/${fbPageId}/posts/${storyFbid}`
        : postId
          ? `https://www.facebook.com/${postId}`
          : "";

    if (postId && postUrl) {
      await updateNotaFbPost(notaId, postId, postUrl);
    }

    return NextResponse.json({
      success: true,
      postId,
      postUrl,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al postear" },
      { status: 500 }
    );
  }
}
