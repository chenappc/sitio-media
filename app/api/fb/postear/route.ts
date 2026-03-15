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
    let accessToken = process.env.FB_PAGE_ACCESS_TOKEN;

    const appId = process.env.FB_APP_ID;
    const appSecret = process.env.FB_APP_SECRET;

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

    // Renovación opcional (si falla, se usa el token original)
    // Paso 1: intercambiar a long-lived user token con fb_exchange_token
    // Paso 2: con ese token, obtener el Page Access Token via /{pageId}?fields=access_token
    if (appId && appSecret) {
      try {
        const exchangeUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
        exchangeUrl.searchParams.set("grant_type", "fb_exchange_token");
        exchangeUrl.searchParams.set("client_id", appId);
        exchangeUrl.searchParams.set("client_secret", appSecret);
        exchangeUrl.searchParams.set("fb_exchange_token", accessToken);

        const exchangeRes = await fetch(exchangeUrl.toString());
        const exchangeData = (await exchangeRes.json().catch(() => ({}))) as {
          access_token?: string;
          error?: { message?: string };
        };
        console.log('FB token exchange resultado:', exchangeRes.status, exchangeData);

        if (exchangeRes.ok && exchangeData.access_token) {
          const longLivedUserToken = exchangeData.access_token;

          try {
            const pageTokenUrl = new URL(`https://graph.facebook.com/v19.0/${pageId}`);
            pageTokenUrl.searchParams.set("fields", "access_token");
            pageTokenUrl.searchParams.set("access_token", longLivedUserToken);

            const pageTokenRes = await fetch(pageTokenUrl.toString());
            const pageTokenData = (await pageTokenRes.json().catch(() => ({}))) as {
              access_token?: string;
              error?: { message?: string };
            };
            console.log('FB page token resultado:', pageTokenRes.status, pageTokenData);

            if (pageTokenRes.ok && pageTokenData.access_token) {
              accessToken = pageTokenData.access_token;
            }
          } catch (_) {
            // Si falla obtener page access token, se sigue con el token actual
          }
        }
      } catch (_) {
        // Si falla el exchange, se sigue con el token original
      }
    }
    console.log('FB usando token renovado:', accessToken !== process.env.FB_PAGE_ACCESS_TOKEN);

    const link = `https://www.vahica.com/${nota.slug}`;
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
