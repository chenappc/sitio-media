import pool from "@/lib/db";

const KEY_PAGE_ACCESS_TOKEN = "page_access_token";

/**
 * Obtiene un token de página de Facebook fresco: lee de fb_config, intenta renovarlo
 * (exchange → long-lived user token → page token) y persiste el renovado en DB.
 * Fallback: process.env.FB_PAGE_ACCESS_TOKEN.
 */
export async function getFreshFBToken(): Promise<string | null> {
  const appId = process.env.FB_APP_ID;
  const appSecret = process.env.FB_APP_SECRET;
  const pageId = process.env.FB_PAGE_ID;

  let currentToken: string | null = null;
  const { rows } = await pool.query<{ value: string }>(
    "SELECT value FROM fb_config WHERE key = $1",
    [KEY_PAGE_ACCESS_TOKEN]
  );
  if (rows[0]?.value?.trim()) {
    currentToken = rows[0].value.trim();
  }
  if (!currentToken) {
    currentToken = process.env.FB_PAGE_ACCESS_TOKEN?.trim() ?? null;
  }
  if (!currentToken) {
    return null;
  }

  if (!appId || !appSecret || !pageId) {
    return currentToken;
  }

  try {
    const exchangeUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    exchangeUrl.searchParams.set("grant_type", "fb_exchange_token");
    exchangeUrl.searchParams.set("client_id", appId);
    exchangeUrl.searchParams.set("client_secret", appSecret);
    exchangeUrl.searchParams.set("fb_exchange_token", currentToken);

    const exchangeRes = await fetch(exchangeUrl.toString());
    const exchangeData = (await exchangeRes.json().catch(() => ({}))) as {
      access_token?: string;
      error?: { message?: string };
    };
    console.log("FB token exchange resultado:", exchangeRes.status, exchangeData);

    if (!exchangeRes.ok || !exchangeData.access_token) {
      return currentToken;
    }

    const longLivedUserToken = exchangeData.access_token;
    const pageTokenUrl = new URL(`https://graph.facebook.com/v19.0/${pageId}`);
    pageTokenUrl.searchParams.set("fields", "access_token");
    pageTokenUrl.searchParams.set("access_token", longLivedUserToken);

    const pageTokenRes = await fetch(pageTokenUrl.toString());
    const pageTokenData = (await pageTokenRes.json().catch(() => ({}))) as {
      access_token?: string;
      error?: { message?: string };
    };
    console.log("FB page token resultado:", pageTokenRes.status, pageTokenData);

    if (pageTokenRes.ok && pageTokenData.access_token) {
      const newToken = pageTokenData.access_token;
      await pool.query(
        `INSERT INTO fb_config (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [KEY_PAGE_ACCESS_TOKEN, newToken]
      );
      return newToken;
    }
  } catch (err) {
    console.error("FB token refresh error:", err);
  }

  return currentToken;
}
