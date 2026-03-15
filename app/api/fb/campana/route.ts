import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// SQL de referencia (ejecutar en Railway PostgreSQL si no existen las columnas en notas):
// ALTER TABLE notas ADD COLUMN IF NOT EXISTS fb_ad_id TEXT;
// ALTER TABLE notas ADD COLUMN IF NOT EXISTS fb_adset_id TEXT;

const PAISES = {
  AR: { nombre: 'AR', geo: 'AR' },
  CL: { nombre: 'CL', geo: 'CL' },
  CO: { nombre: 'CO', geo: 'CO' },
  ES: { nombre: 'ES', geo: 'ES' },
  MX: { nombre: 'MX', geo: 'MX' },
  PE: { nombre: 'PE', geo: 'PE' },
  US: { nombre: 'US(Spa)', geo: 'US', idioma: ['ES','ES-ES'] },
  IT: { nombre: 'IT(Spa)', geo: 'IT', idioma: ['ES','ES-ES'] },
  CA: { nombre: 'CA(Spa)', geo: 'CA', idioma: ['ES','ES-ES'] },
};

const EXPAT_BEHAVIOR_IDS = [
  '6018797127383','6019366943583','6019520122583','6019673525983',
  '6019673762183','6019673777983','6019673808383','6023676072183',
  '6025000826583','6025054896983','6026404871583','6027149008183',
  '6059793664583','6071248894383'
];

const ADSET_NAME_PREFIX = 'Notas virales - ';
const MAX_ADS_PER_ADSET = 6;

const AD_EFFECTIVE_STATUSES_NON_DELETED = [
  'ACTIVE', 'PAUSED', 'IN_REVIEW', 'PENDING_REVIEW', 'DISAPPROVED',
  'ADSET_PAUSED', 'CAMPAIGN_PAUSED', 'PREAPPROVED',
];

async function countAdsInAdset(adsetId: string, accessToken: string): Promise<number> {
  const filter = JSON.stringify([
    { field: 'effective_status', operator: 'IN', value: AD_EFFECTIVE_STATUSES_NON_DELETED },
  ]);
  const url = `https://graph.facebook.com/v19.0/${adsetId}/ads?fields=id,effective_status&filtering=${encodeURIComponent(filter)}&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const data = (await res.json()) as { data?: { id: string }[]; error?: { message: string } };
  if (data.error) throw new Error(data.error.message);
  console.log('FB CAMPANA DEBUG [countAdsInAdset] ads:', data.data);
  const count = data.data?.length ?? 0;
  console.log('FB CAMPANA DEBUG [countAdsInAdset]', { adsetId, count });
  return count;
}

async function listCampaignAdsets(campaignId: string, accessToken: string): Promise<{ id: string; name: string; status?: string }[]> {
  const url = `https://graph.facebook.com/v19.0/${campaignId}/adsets?fields=id,name,status&limit=100&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  const data = (await res.json()) as { data?: { id: string; name: string; status?: string }[]; error?: { message: string } };
  if (data.error) throw new Error(data.error.message);
  return data.data ?? [];
}

function parseAdsetNumber(name: string): number | null {
  if (!name.includes(ADSET_NAME_PREFIX)) return null;
  const part = name.split(ADSET_NAME_PREFIX)[1];
  if (!part) return null;
  const num = parseInt(part.trim(), 10);
  return Number.isNaN(num) ? null : num;
}

export async function POST(req: NextRequest) {
  try {
    const adminSecret = req.headers.get('x-admin-secret');
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { notaId, pais } = await req.json();
    if (!notaId || !pais) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const notaRes = await pool.query('SELECT * FROM notas WHERE id = $1', [notaId]);
    const nota = notaRes.rows[0];
    if (!nota) return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 });
    if (!nota.fb_post_id) return NextResponse.json({ error: 'La nota no tiene post de Facebook' }, { status: 400 });

    const adAccountId = process.env.FB_AD_ACCOUNT_ID;
    let accessToken = process.env.FB_PAGE_ACCESS_TOKEN;
    const pageId = process.env.FB_PAGE_ID;
    const appId = process.env.FB_APP_ID;
    const appSecret = process.env.FB_APP_SECRET;
    const paisConfig = PAISES[pais as keyof typeof PAISES];
    if (!paisConfig) return NextResponse.json({ error: 'País no válido' }, { status: 400 });
    if (!adAccountId || !accessToken) {
      return NextResponse.json({ error: 'FB_AD_ACCOUNT_ID o FB_PAGE_ACCESS_TOKEN no configurados' }, { status: 503 });
    }

    // Renovación opcional (si falla, se usa el token original)
    // Paso 1: intercambiar a long-lived user token con fb_exchange_token
    // Paso 2: con ese token, obtener el Page Access Token via /{pageId}?fields=access_token
    if (appId && appSecret && pageId) {
      try {
        const exchangeUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
        exchangeUrl.searchParams.set('grant_type', 'fb_exchange_token');
        exchangeUrl.searchParams.set('client_id', appId);
        exchangeUrl.searchParams.set('client_secret', appSecret);
        exchangeUrl.searchParams.set('fb_exchange_token', accessToken);

        const exchangeRes = await fetch(exchangeUrl.toString());
        const exchangeData = (await exchangeRes.json().catch(() => ({}))) as {
          access_token?: string;
          error?: { message?: string };
        };
        console.log('FB CAMPANA token exchange resultado:', exchangeRes.status, exchangeData);

        if (exchangeRes.ok && exchangeData.access_token) {
          const longLivedUserToken = exchangeData.access_token;

          try {
            const pageTokenUrl = new URL(`https://graph.facebook.com/v19.0/${pageId}`);
            pageTokenUrl.searchParams.set('fields', 'access_token');
            pageTokenUrl.searchParams.set('access_token', longLivedUserToken);

            const pageTokenRes = await fetch(pageTokenUrl.toString());
            const pageTokenData = (await pageTokenRes.json().catch(() => ({}))) as {
              access_token?: string;
              error?: { message?: string };
            };
            console.log('FB CAMPANA page token resultado:', pageTokenRes.status, pageTokenData);

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
    console.log('FB CAMPANA usando token renovado:', accessToken !== process.env.FB_PAGE_ACCESS_TOKEN);

    const existingRes = await pool.query(
      'SELECT * FROM campanas WHERE nota_id = $1 AND pais = $2',
      [notaId, pais]
    );
    const registro = existingRes.rows[0];
    if (registro?.fb_ad_id) {
      return NextResponse.json({ ok: true, already_exists: true, campana: registro });
    }

    const campaignName = `${paisConfig.nombre} - Notas virales - Vahica.com - Interacciones`;
    const nombreAd = nota.titulo;
    const filterJson = JSON.stringify([
      { field: 'name', operator: 'EQUAL', value: campaignName },
    ]);
    const listUrl = `https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=id,name,account_id&filtering=${encodeURIComponent(filterJson)}&access_token=${encodeURIComponent(accessToken ?? '')}`;
    console.log('FB CAMPANA DEBUG [list campaigns] request:', { url: listUrl.replace(accessToken ?? '', '[TOKEN]') });
    const listRes = await fetch(listUrl);
    const listData = (await listRes.json()) as { data?: { id: string; name?: string; account_id?: string }[]; error?: { message: string } };
    console.log('FB CAMPANA DEBUG [list campaigns] response:', { status: listRes.status, body: listData });
    let fbCampaignId: string;
    if (listData.error) {
      const err = listData.error as { message?: string; code?: number; error_subcode?: number };
      console.error('FB error campana list:', {
        message: err.message,
        code: err.code,
        error_subcode: err.error_subcode,
        fullResponse: listData,
      });
      throw new Error(err.message ?? 'Error listando campañas');
    }
    const normalizeAccountId = (id: string | undefined) => String(id ?? '').replace(/^act_/i, '');
    const ourAccountId = normalizeAccountId(adAccountId);
    const campaignsInOurAccount = (listData.data ?? []).filter(
      (c) => normalizeAccountId(c.account_id) === ourAccountId
    );
    if (campaignsInOurAccount.length > 0) {
      fbCampaignId = campaignsInOurAccount[0].id;
    } else {
      const campaignBody = new URLSearchParams({
        name: campaignName,
        objective: 'OUTCOME_ENGAGEMENT',
        status: 'PAUSED',
        special_ad_categories: '[]',
        is_adset_budget_sharing_enabled: 'false',
        access_token: process.env.FB_PAGE_ACCESS_TOKEN ?? '',
      });
      console.log('FB CAMPANA DEBUG [create campaign] request:', { url: `https://graph.facebook.com/v19.0/${adAccountId}/campaigns`, body: Object.fromEntries(campaignBody) });
      const campanaRes = await fetch(`https://graph.facebook.com/v19.0/${adAccountId}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: campaignBody,
      });
      const campanaData = await campanaRes.json();
      console.log('FB CAMPANA DEBUG [create campaign] response:', { status: campanaRes.status, body: campanaData });
      if (campanaData.error) {
        const err = campanaData.error as { message?: string; code?: number; error_subcode?: number };
        console.error('FB error crear campaña:', {
          message: err.message,
          code: err.code,
          error_subcode: err.error_subcode,
          fullResponse: campanaData,
        });
        throw new Error(err.message ?? 'Error creando campaña');
      }
      fbCampaignId = campanaData.id;
    }

    const targeting: Record<string, unknown> = {
      age_min: 55,
      age_max: 65,
      geo_locations: { countries: [paisConfig.geo], location_types: ['home', 'recent'] },
      publisher_platforms: ['facebook'],
      facebook_positions: ['feed'],
      device_platforms: ['mobile'],
      targeting_automation: { advantage_audience: 0 },
    };
    if ('idioma' in paisConfig) {
      targeting.behaviors = EXPAT_BEHAVIOR_IDS.map(id => ({ id, name: '' }));
      targeting.locales = [1002];
    }

    let fbAdsetId!: string;

    console.log('FB CAMPANA DEBUG campaign_id usado:', fbCampaignId);

    const existingAdsetRes = await pool.query(
      'SELECT fb_adset_id FROM campanas WHERE nota_id = $1 AND fb_adset_id IS NOT NULL LIMIT 1',
      [notaId]
    );
    const existingAdsetRow = existingAdsetRes.rows[0];
    let adsetReused = false;
    if (existingAdsetRow?.fb_adset_id) {
      const candidateAdsetId = existingAdsetRow.fb_adset_id;
      console.log('FB CAMPANA DEBUG [reuse adset] verificando adset guardado:', candidateAdsetId);
      try {
        const adsetCheckUrl = `https://graph.facebook.com/v19.0/${candidateAdsetId}?fields=id,campaign_id,account_id&access_token=${encodeURIComponent(accessToken ?? '')}`;
        const adsetCheckRes = await fetch(adsetCheckUrl);
        const adsetCheckData = (await adsetCheckRes.json()) as { id?: string; campaign_id?: string; account_id?: string; error?: { message?: string } };
        if (!adsetCheckData.error && adsetCheckData.account_id && normalizeAccountId(adsetCheckData.account_id) === ourAccountId) {
          fbAdsetId = candidateAdsetId;
          adsetReused = true;
          console.log('FB CAMPANA DEBUG [reuse adset] reutilizando adset (account_id OK):', fbAdsetId);
        }
      } catch (_) {
        // Si falla el GET, seguir con búsqueda normal
      }
    }
    if (!adsetReused) {
      const adsets = await listCampaignAdsets(fbCampaignId, accessToken ?? '');
      const adsetsWithCount: { id: string; name: string; count: number }[] = [];
      for (const aset of adsets) {
        if (aset.status !== 'ACTIVE') continue;
        const count = await countAdsInAdset(aset.id, accessToken ?? '');
        adsetsWithCount.push({ id: aset.id, name: aset.name, count });
      }
      adsetsWithCount.sort((a, b) => b.id.localeCompare(a.id));

      const withSpace = adsetsWithCount.find((a) => a.count < MAX_ADS_PER_ADSET);
      if (withSpace) {
        fbAdsetId = withSpace.id;
        console.log('FB CAMPANA DEBUG [reuse adset] adset con espacio:', { id: fbAdsetId, name: withSpace.name, count: withSpace.count });
      } else {
        const numbers = adsetsWithCount
          .map((a) => parseAdsetNumber(a.name))
          .filter((n): n is number => n !== null);
        const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
        const adsetNumberStr = String(nextNum).padStart(2, '0');
        const nombreAdset = `${paisConfig.nombre} (55-65+) ${ADSET_NAME_PREFIX}${adsetNumberStr}`;

        const adsetBody: Record<string, unknown> = {
          name: nombreAdset,
          campaign_id: fbCampaignId,
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'POST_ENGAGEMENT',
          destination_type: 'ON_POST',
          daily_budget: 500,
          bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
          targeting,
          status: 'ACTIVE',
          dsa_beneficiary: 'Vahica.com',
          dsa_payor: 'Vahica.com',
          access_token: accessToken,
        };

        console.log('FB CAMPANA DEBUG [create adset] request:', { url: `https://graph.facebook.com/v19.0/${adAccountId}/adsets`, body: adsetBody });
        const adsetRes = await fetch(`https://graph.facebook.com/v19.0/${adAccountId}/adsets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(adsetBody),
        });
        const adsetData = await adsetRes.json();
        console.log('FB CAMPANA DEBUG [create adset] response:', { status: adsetRes.status, body: adsetData });
        if (adsetData.error) {
          const err = adsetData.error as { message?: string; code?: number; error_subcode?: number };
          console.error('FB error crear adset:', {
            message: err.message,
            code: err.code,
            error_subcode: err.error_subcode,
            fullResponse: adsetData,
          });
          throw new Error(err.message ?? 'Error creando ad set');
        }
        fbAdsetId = adsetData.id;
      }
    }

    const adBody = {
      name: nombreAd,
      adset_id: fbAdsetId,
      creative: { object_story_id: nota.fb_post_id },
      status: 'ACTIVE',
      access_token: accessToken,
    };
    console.log('FB CAMPANA DEBUG [create ad] request:', { url: `https://graph.facebook.com/v19.0/${adAccountId}/ads`, body: adBody });
    const adRes = await fetch(`https://graph.facebook.com/v19.0/${adAccountId}/ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adBody),
    });
    const adData = await adRes.json();
    console.log('FB CAMPANA DEBUG [create ad] response:', { status: adRes.status, body: adData });
    if (adData.error) {
      const err = adData.error as { message?: string; code?: number; error_subcode?: number };
      console.error('FB error crear ad:', {
        message: err.message,
        code: err.code,
        error_subcode: err.error_subcode,
        fullResponse: adData,
      });
      throw new Error(err.message ?? 'Error creando anuncio');
    }
    const fbAdId = adData.id;

    await pool.query(`
      INSERT INTO campanas (nota_id, pais, fb_campaign_id, fb_adset_id, fb_ad_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (nota_id, pais) DO UPDATE SET
        fb_campaign_id = $3, fb_adset_id = $4, fb_ad_id = $5, updated_at = NOW()
    `, [notaId, pais, fbCampaignId, fbAdsetId, fbAdId]);

    await pool.query(
      'UPDATE notas SET fb_ad_id = $1, fb_adset_id = $2 WHERE id = $3',
      [fbAdId, fbAdsetId, notaId]
    );

    return NextResponse.json({ success: true, fbCampaignId, fbAdsetId, fbAdId });

  } catch (error: unknown) {
    console.error('Error general en campana route:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const adminSecret = req.headers.get('x-admin-secret');
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const notaId = searchParams.get('notaId');
  const pais = searchParams.get('pais');
  if (!notaId || !pais) {
    return NextResponse.json({ error: 'Faltan notaId o pais' }, { status: 400 });
  }
  const notaIdNum = parseInt(notaId, 10);
  if (Number.isNaN(notaIdNum)) {
    return NextResponse.json({ error: 'notaId inválido' }, { status: 400 });
  }
  await pool.query('DELETE FROM campanas WHERE nota_id = $1 AND pais = $2', [notaIdNum, pais]);
  return NextResponse.json({ ok: true });
}
