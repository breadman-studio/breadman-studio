// lib/bandcamp.ts
// Lee el reporte de ventas de Bandcamp del lado del servidor.
// Solo se usa desde app/panel/page.tsx (protegido por login).
// Al navegador llega un resumen: nunca nombres ni emails de compradores.

import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()
const K_ACCESS = 'cr:bc:access'
const K_REFRESH = 'cr:bc:refresh'
const K_BAND = 'cr:bc:band_id'

export type BandcampVenta = {
  fecha: string
  item: string
  artista: string
  tipo: string
  neto: number
  moneda: string
  pais: string
}

export type BandcampData =
  | {
      ok: true
      desde: string
      ventas: number
      neto: number
      moneda: string
      compradores: number
      topReleases: { item: string; ventas: number; neto: number }[]
      topPaises: { pais: string; ventas: number }[]
      recientes: BandcampVenta[]
      leidoEn: string
    }
  | { ok: false; error: string }

async function pedirToken(params: Record<string, string>) {
  const res = await fetch('https://bandcamp.com/oauth_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.BANDCAMP_CLIENT_ID || '',
      client_secret: process.env.BANDCAMP_CLIENT_SECRET || '',
      ...params,
    }),
    cache: 'no-store',
  })
  return res.json()
}

async function guardarTokens(t: { access_token: string; refresh_token: string; expires_in: number }) {
  await redis.set(K_ACCESS, t.access_token, { ex: Math.max(60, (t.expires_in || 3600) - 120) })
  await redis.set(K_REFRESH, t.refresh_token)
}

// Bandcamp solo permite UN grant activo: se pide con client_credentials una vez,
// y después se renueva siempre con el refresh_token guardado en Redis.
async function getAccessToken(): Promise<string> {
  const cached = await redis.get<string>(K_ACCESS)
  if (cached) return cached

  const refresh = await redis.get<string>(K_REFRESH)
  if (refresh) {
    const t = await pedirToken({ grant_type: 'refresh_token', refresh_token: refresh })
    if (t.ok && t.access_token) {
      await guardarTokens(t)
      return t.access_token
    }
  }

  const t = await pedirToken({ grant_type: 'client_credentials' })
  if (t.ok && t.access_token) {
    await guardarTokens(t)
    return t.access_token
  }
  if (t.error === 'duplicate_grant') {
    throw new Error('Bandcamp tiene un token activo que no quedó guardado. Hay que regenerar el cliente en Bandcamp → Configuración → Acceso de API y actualizar BANDCAMP_CLIENT_SECRET en Vercel.')
  }
  throw new Error(t.error_description || 'No se pudo obtener token de Bandcamp')
}

async function api(path: string, token: string, body: object) {
  const res = await fetch('https://bandcamp.com/api/' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  return res.json()
}

async function getBandId(token: string): Promise<number> {
  const cached = await redis.get<number>(K_BAND)
  if (cached) return cached
  const data = await api('account/1/my_bands', token, {})
  const bands: { band_id: number; subdomain: string }[] = data.bands || []
  const band = bands.find(b => b.subdomain === 'claroscurorec') || bands[0]
  if (!band) throw new Error('La cuenta de Bandcamp no tiene bandas asociadas')
  await redis.set(K_BAND, band.band_id)
  return band.band_id
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

export async function getBandcampData(): Promise<BandcampData> {
  try {
    if (!process.env.BANDCAMP_CLIENT_ID || !process.env.BANDCAMP_CLIENT_SECRET) {
      return { ok: false, error: 'Faltan BANDCAMP_CLIENT_ID / BANDCAMP_CLIENT_SECRET en Vercel' }
    }
    const token = await getAccessToken()
    const bandId = await getBandId(token)

    const desde = new Date()
    desde.setFullYear(desde.getFullYear() - 1)

    const data = await api('sales/4/sales_report', token, {
      band_id: bandId,
      start_time: fmt(desde),
    })
    if (data.error) throw new Error(data.error_message || 'Error en sales_report')

    const report: any[] = data.report || []
    // Solo pagos (los reembolsos traen bandcamp_related_transaction_id)
    const pagos = report.filter(r => !r.bandcamp_related_transaction_id)

    const neto = pagos.reduce((a, r) => a + (Number(r.net_amount) || 0), 0)
    const monedas = new Set(pagos.map(r => r.currency).filter(Boolean))
    const compradores = new Set(pagos.map(r => r.buyer_email).filter(Boolean)).size

    const porRelease = new Map<string, { ventas: number; neto: number }>()
    const porPais = new Map<string, number>()
    for (const r of pagos) {
      const k = r.item_name || 'Sin nombre'
      const cur = porRelease.get(k) || { ventas: 0, neto: 0 }
      cur.ventas += Number(r.quantity) || 1
      cur.neto += Number(r.net_amount) || 0
      porRelease.set(k, cur)
      const p = r.country || 'Desconocido'
      porPais.set(p, (porPais.get(p) || 0) + 1)
    }

    const recientes: BandcampVenta[] = pagos
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)
      .map(r => ({
        fecha: r.date,
        item: r.item_name || '',
        artista: r.artist || '',
        tipo: r.item_type || '',
        neto: Number(r.net_amount) || 0,
        moneda: r.currency || '',
        pais: r.country || '',
      }))

    return {
      ok: true,
      desde: desde.toISOString(),
      ventas: pagos.reduce((a, r) => a + (Number(r.quantity) || 1), 0),
      neto,
      moneda: monedas.size === 1 ? [...monedas][0] : 'mixta',
      compradores,
      topReleases: [...porRelease.entries()]
        .map(([item, v]) => ({ item, ...v }))
        .sort((a, b) => b.ventas - a.ventas)
        .slice(0, 5),
      topPaises: [...porPais.entries()]
        .map(([pais, ventas]) => ({ pais, ventas }))
        .sort((a, b) => b.ventas - a.ventas)
        .slice(0, 5),
      recientes,
      leidoEn: new Date().toISOString(),
    }
  } catch (e: any) {
    console.error('[Bandcamp]', e)
    return { ok: false, error: e?.message || 'Error leyendo Bandcamp' }
  }
}
