// lib/bandcamp.ts
// Lee el reporte de ventas de Bandcamp del lado del servidor.
// Solo se usa desde app/panel/page.tsx (protegido por login).
// Al navegador llegan las ventas SIN nombres ni emails: el comprador va como un código anónimo.

import { Redis } from '@upstash/redis'
import { createHash } from 'crypto'

const redis = Redis.fromEnv()
const K_ACCESS = 'cr:bc:access'
const K_REFRESH = 'cr:bc:refresh'
const K_BAND = 'cr:bc:band_id'

export type BandcampVenta = {
  fecha: string      // ISO
  item: string
  artista: string
  tipo: string       // track | album | package (merch) | ...
  paquete: string
  precio: number
  extra: number      // lo que el fan pagó por sobre el precio
  neto: number
  moneda: string
  pais: string
  origen: string     // de dónde llegó (referer)
  comprador: string  // código anónimo para contar compradores únicos
}

export type BandcampData =
  | { ok: true; ventas: BandcampVenta[]; leidoEn: string }
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

// Bandcamp solo permite UN grant activo: se pide con client_credentials una vez
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

function anonimo(email: string) {
  return email ? createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 12) : ''
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

    const data = await api('sales/4/sales_report', token, { band_id: bandId, start_time: fmt(desde) })
    if (data.error) throw new Error(data.error_message || 'Error en sales_report')

    const report: any[] = data.report || []
    // Solo ventas reales: fuera payouts (transferencias de Bandcamp) y reembolsos/reversos
    const ventas: BandcampVenta[] = report
      .filter(r => r.item_type !== 'payout' && !r.bandcamp_related_transaction_id && (Number(r.net_amount) || 0) > 0)
      .map(r => ({
        fecha: new Date(r.date).toISOString(),
        item: r.item_name || 'Sin nombre',
        artista: r.artist || '',
        tipo: r.item_type || 'otro',
        paquete: r.package || '',
        precio: Number(r.item_price) || 0,
        extra: Number(r.additional_fan_contribution) || 0,
        neto: Number(r.net_amount) || 0,
        moneda: r.currency || '',
        pais: r.country || 'Desconocido',
        origen: r.referer || '',
        comprador: anonimo(r.buyer_email || ''),
      }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))

    return { ok: true, ventas, leidoEn: new Date().toISOString() }
  } catch (e: any) {
    console.error('[Bandcamp]', e)
    return { ok: false, error: e?.message || 'Error leyendo Bandcamp' }
  }
}
