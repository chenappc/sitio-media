import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

const PAISES = {
  AR: { nombre: 'AR', geo: 'AR' },
  CL: { nombre: 'CL', geo: 'CL' },
  CO: { nombre: 'CO', geo: 'CO' },
  ES: { nombre: 'ES', geo: 'ES' },
  MX: { nombre: 'MX', geo: 'MX' },
  PE: { nombre: 'PE', geo: 'PE' },
  US: { nombre: 'US', geo: 'US', idioma: ['ES','ES-ES'] },
  IT: { nombre: 'IT(Spa)', geo: 'IT', idioma: ['ES','ES-ES'] },
  CA: { nombre: 'CA(Spa)', geo: 'CA', idioma: ['ES','ES-ES'] },
};

const EXPAT_BEHAVIOR_IDS = [
  '6018797127383','6019366943583','6019520122583','6019673525983',
  '6019673762183','6019673777983','6019673808383','6023676072183',
  '6025000826583','6025054896983','6026404871583','6027149008183',
  '6059793664583','6071248894383'
];

export async function POST(req: NextRequest) {
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

  const nombreCampana = `${paisConfig.nombre} - Sitio.media - Interacciones`;
  const nombreAdset = `${paisConfig.nombre} (55-65+) ${nota.titulo}`;
  const nombreAd = nota.titulo;

  try {
    const campanaRes = await fetch(`https://graph.facebook.com/v19.0/${adAccountId}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        name: `${paisConfig.nombre} - Sitio.media - Interacciones`,
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
    const fbCampaignId = campanaData.id;

    const targeting: Record<string, unknown> = {
      age_min: 55,
      geo_locations: { countries: [paisConfig.geo] },
      device_platforms: ['mobile'],
      facebook_positions: ['feed'],
      targeting_automation: { advantage_audience: 0 },
    };
    if ('idioma' in paisConfig) {
      targeting.behaviors = EXPAT_BEHAVIOR_IDS.map(id => ({ id, name: '' }));
      targeting.locales = [4, 24];
    }

    const adsetRes = await fetch(`https://graph.facebook.com/v19.0/${adAccountId}/adsets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nombreAdset,
        campaign_id: fbCampaignId,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'ENGAGEMENT',
        daily_budget: 100,
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        promoted_object: { page_id: process.env.FB_PAGE_ID ?? '100210801705114' },
        targeting,
        status: 'PAUSED',
        access_token: accessToken,
      }),
    });
    const adsetData = await adsetRes.json();
    if (adsetData.error) {
      console.error('FB error campana:', JSON.stringify(adsetData, null, 2));
      throw new Error(adsetData.error.message);
    }
    const fbAdsetId = adsetData.id;

    const creativeRes = await fetch(`https://graph.facebook.com/v19.0/${adAccountId}/adcreatives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nombreAd,
        object_story_id: `${pageId}_${nota.fb_post_id}`,
        access_token: accessToken,
      }),
    });
    const creativeData = await creativeRes.json();
    if (creativeData.error) {
      console.error('FB error campana:', JSON.stringify(creativeData, null, 2));
      throw new Error(creativeData.error.message);
    }

    const adRes = await fetch(`https://graph.facebook.com/v19.0/${adAccountId}/ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nombreAd,
        adset_id: fbAdsetId,
        creative: { creative_id: creativeData.id },
        status: 'PAUSED',
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : JSON.stringify(error) },
      { status: 500 }
    );
  }
}
