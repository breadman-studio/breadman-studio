// lib/claroscuro-sheet.ts
// Lee TODA la data de Claroscuro Records desde su propia planilla:
//   "Claroscuro Records — Ventas y Redes" (del sello, no de Breadman).
//
// Quién escribe cada pestaña:
//   - Ventas Claroscuro   -> agente Bandcamp  (repo claroscuro-records, cada 6 h)
//   - Estadisticas Redes  -> agente Meta Stats (repo claroscuro-records, cada 5 h)
//   - Resumen Redes       -> agente Meta Stats
//   - Label Engine (statements, top tracks, tiendas) -> carga manual (Label Engine no tiene API)
//
// Quién lee: el panel de Breadman, con su PROPIA cuenta de solo lectura
//   (breadman-panel@breadman-studio-panel), variable BREADMAN_PANEL_GSA en Vercel.
//   Breadman mira, no guarda credenciales del sello. No llama a Bandcamp ni a Meta en vivo.
//
// Las tablas se buscan por sus encabezados, no por el nombre de la pestaña,
// así renombrar pestañas no rompe el panel.

import { google } from 'googleapis'

const SPREADSHEET_ID = '1AwwzLc8gugZAY-UdzDJBDbURJ0Uy6Ucehf6in-cdPBA'

export const SERVICE_ACCOUNT_EMAIL = 'breadman-panel@breadman-studio-panel.iam.gserviceaccount.com'

export type VentaBandcamp = {
  fecha: string      // ISO
  item: string
  tipo: string       // track | album | package ...
  precio: number
  total: number
  neto: number
  moneda: string
  url: string
  id: string         // transaction_item_id
}

export type Statement = {
  periodo: string
  monto: number
  estado: string
}

export type TopTrack = {
  rank: number
  isrc: string
  artista: string
  titulo: string
  tienda: string
  pais: string
  streams: number
  revenue: number
}

export type TiendaRevenue = {
  tienda: string
  revenue: number
  tipo: string
}

export type RedResumen = {
  red: string              // Instagram | Facebook
  seguidores: number
  publicaciones: number | null
  fecha: string            // ISO de la última consulta
  historial: { fecha: string; seguidores: number }[]
}

export type PostRed = {
  red: string
  postId: string
  fechaPost: string
  meGusta: number
  comentarios: number
  compartidos: number
  alcance: number
  vistas: number
  guardados: number
  link: string
  fechaConsulta: string
}

export type ClaroscuroData = {
  ok: boolean
  error?: string
  leidoEn: string
  ventas: VentaBandcamp[]
  statements: Statement[]
  topTracks: TopTrack[]
  topTracksTitulo: string
  tiendas: TiendaRevenue[]
  tiendasTitulo: string
  redes: RedResumen[]
  posts: PostRed[]
  ultimaVentaLeida: string | null   // fecha de la venta más reciente en la planilla
  resumen: {
    ventasBandcamp: number
    netoBandcamp: number
    porCobrarLabelEngine: number
    statementsPendientes: number
  }
}

// Convierte "25,28" o "81.96" o "1.234,50" en número
function num(v: string | undefined): number {
  if (!v) return 0
  let s = String(v).replace(/[^\d,.-]/g, '')
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

function norm(v: string | undefined): string {
  return String(v || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// Fechas de Bandcamp vienen como "04 Sep 2026 09:22:37 GMT"; las pasamos a ISO
function iso(v: string | undefined): string {
  const d = new Date(String(v || ''))
  return isNaN(d.getTime()) ? '' : d.toISOString()
}

// Busca en todas las pestañas una tabla cuyo encabezado contenga estas columnas
function buscarTabla(pestanas: string[][][], columnas: string[]) {
  for (const filas of pestanas) {
    for (let i = 0; i < filas.length; i++) {
      const header = (filas[i] || []).map(norm)
      if (columnas.every(c => header.includes(c))) {
        const idx: Record<string, number> = {}
        header.forEach((h, j) => { if (h) idx[h] = j })
        const datos: string[][] = []
        for (let k = i + 1; k < filas.length; k++) {
          const fila = filas[k] || []
          const primera = norm(fila[0])
          if (!primera || primera.startsWith('total')) break
          datos.push(fila)
        }
        const titulo = String((filas[i - 1] || [])[0] || '')
        return { idx, datos, titulo }
      }
    }
  }
  return null
}

const VACIO: ClaroscuroData['resumen'] = {
  ventasBandcamp: 0,
  netoBandcamp: 0,
  porCobrarLabelEngine: 0,
  statementsPendientes: 0,
}

function vacio(leidoEn: string, error: string): ClaroscuroData {
  return {
    ok: false, error, leidoEn,
    ventas: [], statements: [], topTracks: [], topTracksTitulo: '',
    tiendas: [], tiendasTitulo: '', redes: [], posts: [],
    ultimaVentaLeida: null, resumen: VACIO,
  }
}

export async function getClaroscuroData(): Promise<ClaroscuroData> {
  const leidoEn = new Date().toISOString()
  try {
    const raw = process.env.BREADMAN_PANEL_GSA
    if (!raw) return vacio(leidoEn, 'Falta la variable BREADMAN_PANEL_GSA en Vercel (cuenta breadman-panel).')

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(raw),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
    const sheets = google.sheets({ version: 'v4', auth })

    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      fields: 'sheets.properties.title',
    })
    const titulos = (meta.data.sheets || [])
      .map(s => s.properties?.title)
      .filter((t): t is string => !!t)

    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: titulos.map(t => "'" + t.replace(/'/g, "''") + "'!A1:Z2000"),
    })
    const pestanas = (res.data.valueRanges || []).map(r => (r.values || []) as string[][])

    // ---------- Ventas Bandcamp (agente) ----------
    // fecha | item_name | item_type | currency | item_price | item_total | amount_you_received | net_amount | package | item_url | transaction_item_id
    const tVentas = buscarTabla(pestanas, ['item_name', 'item_type', 'net_amount', 'transaction_item_id'])
    const vistos = new Set<string>()
    const ventas: VentaBandcamp[] = []
    for (const f of tVentas?.datos || []) {
      const x = tVentas!.idx
      const tipo = norm(f[x['item_type']])
      const neto = num(f[x['net_amount']])
      const id = String(f[x['transaction_item_id']] || '').trim()
      // Solo ventas reales: fuera payouts y filas sin monto neto
      if (tipo === 'payout' || neto <= 0) continue
      // Defensa contra duplicados en la planilla
      if (id && vistos.has(id)) continue
      if (id) vistos.add(id)
      ventas.push({
        fecha: iso(f[x['fecha']]),
        item: f[x['item_name']] || 'Sin nombre',
        tipo: tipo || 'otro',
        precio: num(f[x['item_price']]),
        total: num(f[x['item_total']]),
        neto,
        moneda: f[x['currency']] || '',
        url: f[x['item_url']] || '',
        id,
      })
    }
    ventas.sort((a, b) => b.fecha.localeCompare(a.fecha))

    // ---------- Label Engine (manual) ----------
    const tStat = buscarTabla(pestanas, ['periodo', 'monto_usd', 'estado'])
    const statements: Statement[] = tStat
      ? tStat.datos.map(f => ({
          periodo: f[tStat.idx['periodo']] || '',
          monto: num(f[tStat.idx['monto_usd']]),
          estado: f[tStat.idx['estado']] || '',
        }))
      : []

    const tTop = buscarTabla(pestanas, ['isrc', 'tienda', 'revenue_usd'])
    const topTracks: TopTrack[] = tTop
      ? tTop.datos.map(f => ({
          rank: num(f[tTop.idx['rank']]),
          isrc: f[tTop.idx['isrc']] || '',
          artista: f[tTop.idx['artista']] || '',
          titulo: f[tTop.idx['titulo']] || '',
          tienda: f[tTop.idx['tienda']] || '',
          pais: f[tTop.idx['pais']] || '',
          streams: num(f[tTop.idx['streams']]),
          revenue: num(f[tTop.idx['revenue_usd']]),
        }))
      : []

    const tTiendas = buscarTabla(pestanas, ['tienda', 'revenue_usd', 'porcentaje'])
    const tiendas: TiendaRevenue[] = tTiendas
      ? tTiendas.datos.map(f => ({
          tienda: f[tTiendas.idx['tienda']] || '',
          revenue: num(f[tTiendas.idx['revenue_usd']]),
          tipo: f[tTiendas.idx['tipo']] || '',
        }))
      : []

    // ---------- Redes: resumen por red (agente Meta Stats) ----------
    // fecha_consulta | cliente | red | seguidores | publicaciones
    const tRes = buscarTabla(pestanas, ['fecha_consulta', 'red', 'seguidores'])
    const porRed = new Map<string, RedResumen>()
    for (const f of tRes?.datos || []) {
      const x = tRes!.idx
      const red = f[x['red']] || ''
      const fecha = f[x['fecha_consulta']] || ''
      const seguidores = num(f[x['seguidores']])
      const pubRaw = f[x['publicaciones']]
      if (!red) continue
      const r = porRed.get(red) || { red, seguidores: 0, publicaciones: null, fecha: '', historial: [] }
      r.historial.push({ fecha, seguidores })
      if (fecha >= r.fecha) {
        r.fecha = fecha
        r.seguidores = seguidores
        r.publicaciones = pubRaw ? num(pubRaw) : null
      }
      porRed.set(red, r)
    }
    const redes = [...porRed.values()].map(r => ({ ...r, historial: r.historial.sort((a, b) => a.fecha.localeCompare(b.fecha)) }))

    // ---------- Redes: posts (última consulta de cada post) ----------
    // fecha_consulta | cliente | red | post_id | fecha_post | visualizaciones | interacciones | clics | me_gusta | comentarios | compartidos | alcance | guardados | permalink
    const tPosts = buscarTabla(pestanas, ['fecha_consulta', 'post_id', 'me_gusta'])
    const ultimoPorPost = new Map<string, PostRed>()
    for (const f of tPosts?.datos || []) {
      const x = tPosts!.idx
      const postId = f[x['post_id']] || ''
      const fechaConsulta = f[x['fecha_consulta']] || ''
      if (!postId) continue
      const previo = ultimoPorPost.get(postId)
      if (previo && previo.fechaConsulta > fechaConsulta) continue
      ultimoPorPost.set(postId, {
        red: f[x['red']] || '',
        postId,
        fechaPost: f[x['fecha_post']] || '',
        meGusta: num(f[x['me_gusta']]),
        comentarios: num(f[x['comentarios']]),
        compartidos: num(f[x['compartidos']]),
        alcance: num(f[x['alcance']]),
        vistas: num(f[x['visualizaciones']]),
        guardados: num(f[x['guardados']]),
        link: f[x['permalink']] || previo?.link || '',
        fechaConsulta,
      })
    }
    const posts = [...ultimoPorPost.values()].sort((a, b) => b.fechaPost.localeCompare(a.fechaPost))

    const pendientes = statements.filter(s => norm(s.estado).startsWith('pendiente'))

    return {
      ok: true,
      leidoEn,
      ventas,
      statements,
      topTracks,
      topTracksTitulo: tTop?.titulo || '',
      tiendas,
      tiendasTitulo: tTiendas?.titulo || '',
      redes,
      posts,
      ultimaVentaLeida: ventas[0]?.fecha || null,
      resumen: {
        ventasBandcamp: ventas.length,
        netoBandcamp: Math.round(ventas.reduce((a, v) => a + v.neto, 0) * 100) / 100,
        porCobrarLabelEngine: Math.round(pendientes.reduce((a, s) => a + s.monto, 0) * 100) / 100,
        statementsPendientes: pendientes.length,
      },
    }
  } catch (error) {
    console.error('[Panel Claroscuro] Error leyendo la planilla:', error)
    return vacio(leidoEn, error instanceof Error ? error.message : 'Error desconocido')
  }
}
