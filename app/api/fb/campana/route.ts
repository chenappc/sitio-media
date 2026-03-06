import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

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

const LATAM = ['AR', 'CL', 'CO', 'MX', 'PE'];

const EXPAT_BEHAVIOR_IDS = [
  '6018797127383','6019366943583','6019520122583','6019673525983',
  '6019673762183','6019673777983','6019673808383','6023676072183',
  '6025000826583','6025054896983','6026404871583','6027149008183',
  '6059793664583','6071248894383'
];

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
    const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;
    const pageId = process.env.FB_PAGE_ID;
    const paisConfig = PAISES[pais as keyof typeof PAISES];
    if (!paisConfig) return NextResponse.json({ error: 'País no válido' }, { status: 400 });

    const existingRes = await pool.query(
      'SELECT * FROM campanas WHERE nota_id = $1 AND pais = $2',
      [notaId, pais]
    );
    const registro = existingRes.rows[0];
    if (registro?.fb_campaign_id) {
      return NextResponse.json({ ok: true, already_exists: true, campana: registro });
    }

    const nombreCampana = `${paisConfig.nombre} - Sitio.media - Interacciones`;
    const nombreAdset = `${paisConfig.nombre} (55-65+) ${nota.titulo}`;
    const nombreAd = nota.titulo;

    const campaignName = `${paisConfig.nombre} - Sitio.media - Interacciones`;
    const filterJson = JSON.stringify([
      { field: 'name', operator: 'EQUAL', value: campaignName },
    ]);
    const listUrl = `https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=id,name&filtering=${encodeURIComponent(filterJson)}&access_token=${encodeURIComponent(accessToken ?? '')}`;
    const listRes = await fetch(listUrl);
    const listData = (await listRes.json()) as { data?: { id: string }[]; error?: { message: string } };
    let fbCampaignId: string;
    if (listData.error) {
      console.error('FB error campana list:', JSON.stringify(listData, null, 2));
      throw new Error(listData.error.message);
    }
    if (listData.data && listData.data.length > 0) {
      fbCampaignId = listData.data[0].id;
    } else {
      const campanaRes = await fetch(`https://graph.facebook.com/v19.0/${adAccountId}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          name: campaignName,
          objective: 'OUTCOME_ENGAGEMENT',
          status: 'PAUSED',
          special_ad_categories: '[]',
          is_adset_budget_sharing_enabled: 'false',
          access_token: process.env.FB_PAGE_ACCESS_TOKEN ?? '',
        }),
      });
      const campanaData = await campanaRes.json();
      if (campanaData.error) {
        console.error('FB error campana:', JSON.stringify(campanaData, null, 2));
        throw new Error(campanaData.error.message);
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

    const isLatam = LATAM.includes(paisConfig.geo);
    const adsetBody: Record<string, unknown> = {
      name: nombreAdset,
      campaign_id: fbCampaignId,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'POST_ENGAGEMENT',
      destination_type: 'ON_POST',
      daily_budget: 100,
      bid_strategy: isLatam ? 'LOWEST_COST_WITH_BID_CAP' : 'LOWEST_COST_WITHOUT_CAP',
      targeting,
      status: 'ACTIVE',
      access_token: accessToken,
    };
    if (isLatam) adsetBody.bid_amount = '1';

    console.log('Usando campaign_id:', fbCampaignId);
    const adsetRes = await fetch(`https://graph.facebook.com/v19.0/${adAccountId}/adsets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adsetBody),
    });
    const adsetData = await adsetRes.json();
    if (adsetData.error) {
      console.error('FB error campana:', JSON.stringify(adsetData, null, 2));
      throw new Error(adsetData.error.message);
    }
    const fbAdsetId = adsetData.id;

    const adRes = await fetch(`https://graph.facebook.com/v19.0/${adAccountId}/ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nombreAd,
        adset_id: fbAdsetId,
        creative: { object_story_id: `${pageId}_${nota.fb_post_id}` },
        status: 'ACTIVE',
        access_token: accessToken,
      }),
    });
    const adData = await adRes.json();
    if (adData.error) {
      console.error('FB error campana:', JSON.stringify(adData, null, 2));
      throw new Error(adData.error.message);
    }
    const fbAdId = adData.id;

    await pool.query(`
      INSERT INTO campanas (nota_id, pais, fb_campaign_id, fb_adset_id, fb_ad_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (nota_id, pais) DO UPDATE SET
        fb_campaign_id = $3, fb_adset_id = $4, fb_ad_id = $5, updated_at = NOW()
    `, [notaId, pais, fbCampaignId, fbAdsetId, fbAdId]);

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
