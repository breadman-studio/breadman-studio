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

export type Item = { label: string; valor: number; unidades?: number; extra?: string }

export type RegaliasAgg = {
  usd: number
  unidades: number
  lineas: number
  tiendas: Item[]
  paises: Item[]
  artistas: Item[]
  tracks: (Item & { artista: string; catalogo: string })[]
  releases: (Item & { catalogo: string })[]
  tipos: Item[]
  anioLanzamiento: Item[]
  mesesVenta: Item[]
}

export type Regalias = {
  reportes: { id: string; fecha: string; usd: number; lineas: number }[]
  ultimo: RegaliasAgg | null
  doce: RegaliasAgg | null      // últimos 12 statements
  total: RegaliasAgg | null     // historia completa
  porAnio: Item[]               // ingresos por año de venta (historia completa)
}

export type Catalogo = {
  releases: number
  tracks: number
  artistas: number
  ultimo: { codigo: string; fecha: string; titulo: string } | null
  porAnio: Item[]
  conVentasUltimoReporte: number
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
  regalias: Regalias
  catalogo: Catalogo
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
    regalias: { reportes: [], ultimo: null, doce: null, total: null, porAnio: [] },
    catalogo: { releases: 0, tracks: 0, artistas: 0, ultimo: null, porAnio: [], conVentasUltimoReporte: 0 },
    ultimaVentaLeida: null, resumen: VACIO,
  }
}

// ---------- Regalías (reportes mensuales de Label Engine / Pressology) ----------
// Pestaña "Regalias" (la llena el bot del sello): reporte_id | reporte_fecha | mes_venta | isrc | upc |
// artista | titulo | mix | tienda | pais | tipo | cantidad | usd
// Pestaña "Catalogo" (la llena el bot con el publishing export): catalogo | fecha_lanzamiento | upc |
// artista_release | titulo_release | isrc | artista_track | titulo_track | mix

const TABS_GRANDES = ['Regalias', 'Catalogo']

type FilaRegalia = { rid: string; rfecha: string; mes: string; isrc: string; artista: string; titulo: string; mix: string; tienda: string; pais: string; tipo: string; cant: number; usd: number }
type FilaCatalogo = { codigo: string; fecha: string; artista: string; titulo: string; isrc: string }

// CLOS41 -> CLOS041 (hay códigos mal escritos en el distribuidor)
function codigoNormal(c: string) {
  const m = c.match(/^CLOS(\d{1,2})$/i)
  return m ? 'CLOS' + m[1].padStart(3, '0') : c
}

const TIPO_REGALIA: Record<string, string> = { Streaming: 'Streaming', Download: 'Descargas', 'Ad-Revenue': 'Publicidad (YouTube)' }

function top(mapa: Map<string, { valor: number; unidades: number }>, n: number): Item[] {
  return [...mapa.entries()]
    .map(([label, v]) => ({ label, valor: Math.round(v.valor * 10000) / 10000, unidades: v.unidades }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, n)
}

function sumar(mapa: Map<string, { valor: number; unidades: number }>, k: string, usd: number, cant: number) {
  const v = mapa.get(k) || { valor: 0, unidades: 0 }
  v.valor += usd
  v.unidades += cant
  mapa.set(k, v)
}

function agregar(filas: FilaRegalia[], cat: Map<string, FilaCatalogo>): RegaliasAgg {
  const tiendas = new Map(), paises = new Map(), artistas = new Map(), tipos = new Map(), anios = new Map(), meses = new Map()
  const tracks = new Map<string, { valor: number; unidades: number }>()
  const tracksInfo = new Map<string, { artista: string; catalogo: string }>()
  const releases = new Map<string, { valor: number; unidades: number }>()
  const releasesInfo = new Map<string, string>()
  let usd = 0, unidades = 0
  for (const f of filas) {
    usd += f.usd
    unidades += f.cant
    const c = cat.get(f.isrc)
    sumar(tiendas, f.tienda || 'Otra', f.usd, f.cant)
    sumar(paises, f.pais || 'Sin país', f.usd, f.cant)
    sumar(artistas, f.artista || 'Sin artista', f.usd, f.cant)
    sumar(tipos, TIPO_REGALIA[f.tipo] || f.tipo || 'Otro', f.usd, f.cant)
    sumar(meses, f.mes, f.usd, f.cant)
    sumar(anios, c?.fecha ? c.fecha.slice(0, 4) : 'Sin dato', f.usd, f.cant)
    const kTrack = f.titulo + (f.mix ? ' (' + f.mix + ')' : '')
    sumar(tracks, kTrack + '||' + f.artista, f.usd, f.cant)
    tracksInfo.set(kTrack + '||' + f.artista, { artista: f.artista, catalogo: c ? c.codigo : '' })
    if (c) {
      sumar(releases, c.codigo, f.usd, f.cant)
      releasesInfo.set(c.codigo, c.artista + ' - ' + c.titulo)
    }
  }
  return {
    usd: Math.round(usd * 100) / 100,
    unidades,
    lineas: filas.length,
    tiendas: top(tiendas, 12),
    paises: top(paises, 12),
    artistas: top(artistas, 10),
    tracks: top(tracks, 12).map(t => ({ ...t, label: t.label.split('||')[0], ...tracksInfo.get(t.label)! })),
    releases: top(releases, 10).map(r => ({ ...r, catalogo: r.label, label: releasesInfo.get(r.label) || r.label })),
    tipos: top(tipos, 6),
    anioLanzamiento: [...anios.entries()].map(([label, v]) => ({ label, valor: Math.round(v.valor * 100) / 100 })).sort((a, b) => a.label.localeCompare(b.label)),
    mesesVenta: [...meses.entries()].map(([label, v]) => ({ label, valor: Math.round(v.valor * 100) / 100 })).sort((a, b) => a.label.localeCompare(b.label)),
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

    const generales = titulos.filter(t => !TABS_GRANDES.includes(t))
    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: generales.map(t => "'" + t.replace(/'/g, "''") + "'!A1:Z2000"),
    })
    const pestanas = (res.data.valueRanges || []).map(r => (r.values || []) as string[][])

    // Regalías y catálogo: pestañas propias, leídas completas
    const grandes = TABS_GRANDES.filter(t => titulos.includes(t))
    const resG = grandes.length
      ? await sheets.spreadsheets.values.batchGet({
          spreadsheetId: SPREADSHEET_ID,
          ranges: grandes.map(t => "'" + t + "'!A2:M100000"),
          // valores sin formato: la planilla usa formato chileno (3.315 = tres mil), que se leería mal
          valueRenderOption: 'UNFORMATTED_VALUE',
        })
      : null
    const valoresDe = (t: string) => {
      const i = grandes.indexOf(t)
      const filas = (resG?.data.valueRanges?.[i]?.values || []) as unknown[][]
      return i === -1 ? [] : filas.map(r => r.map(v => (v === null || v === undefined ? '' : String(v))))
    }

    const catMap = new Map<string, FilaCatalogo>()
    for (const r of valoresDe('Catalogo')) {
      const isrc = (r[5] || '').trim()
      if (!isrc) continue
      catMap.set(isrc, { codigo: codigoNormal((r[0] || '').trim()), fecha: r[1] || '', artista: r[3] || '', titulo: r[4] || '', isrc })
    }
    const filasReg: FilaRegalia[] = valoresDe('Regalias').map(r => ({
      rid: r[0] || '', rfecha: r[1] || '', mes: r[2] || '', isrc: (r[3] || '').trim(), artista: r[5] || '', titulo: r[6] || '',
      mix: r[7] || '', tienda: r[8] || '', pais: r[9] || '', tipo: r[10] || '', cant: Number(r[11]) || 0, usd: Number(r[12]) || 0,
    })).filter(f => f.rid)

    const porReporte = new Map<string, { id: string; fecha: string; usd: number; lineas: number }>()
    for (const f of filasReg) {
      const x = porReporte.get(f.rid) || { id: f.rid, fecha: f.rfecha, usd: 0, lineas: 0 }
      x.usd += f.usd
      x.lineas++
      porReporte.set(f.rid, x)
    }
    const reportes = [...porReporte.values()].map(r => ({ ...r, usd: Math.round(r.usd * 100) / 100 })).sort((a, b) => a.fecha.localeCompare(b.fecha))
    const ultimoRep = reportes[reportes.length - 1]
    const filasUltimo = ultimoRep ? filasReg.filter(f => f.rid === ultimoRep.id) : []
    const idsDoce = new Set(reportes.slice(-12).map(r => r.id))
    const porAnioMap = new Map<string, number>()
    for (const f of filasReg) {
      const anio = (f.mes || f.rfecha).slice(0, 4)
      if (anio) porAnioMap.set(anio, (porAnioMap.get(anio) || 0) + f.usd)
    }
    const regalias: Regalias = {
      reportes,
      ultimo: ultimoRep ? agregar(filasUltimo, catMap) : null,
      doce: reportes.length ? agregar(filasReg.filter(f => idsDoce.has(f.rid)), catMap) : null,
      total: reportes.length ? agregar(filasReg, catMap) : null,
      porAnio: [...porAnioMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, v]) => ({ label, valor: Math.round(v * 100) / 100 })),
    }

    const catRel = new Map<string, FilaCatalogo>()
    for (const c of catMap.values()) if (!catRel.has(c.codigo)) catRel.set(c.codigo, c)
    const relOrden = [...catRel.values()].sort((a, b) => b.fecha.localeCompare(a.fecha))
    const porAnio = new Map<string, number>()
    for (const r of relOrden) porAnio.set(r.fecha.slice(0, 4), (porAnio.get(r.fecha.slice(0, 4)) || 0) + 1)
    const conVentas = new Set(filasUltimo.map(f => catMap.get(f.isrc)?.codigo).filter(Boolean))
    const catalogo: Catalogo = {
      releases: catRel.size,
      tracks: catMap.size,
      artistas: new Set(relOrden.map(r => r.artista)).size,
      ultimo: relOrden[0] ? { codigo: relOrden[0].codigo, fecha: relOrden[0].fecha, titulo: relOrden[0].artista + ' - ' + relOrden[0].titulo } : null,
      porAnio: [...porAnio.entries()].map(([label, valor]) => ({ label, valor })).sort((a, b) => a.label.localeCompare(b.label)),
      conVentasUltimoReporte: conVentas.size,
    }

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
      regalias,
      catalogo,
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
