// Lee la planilla "Claroscuro Records - Panel Data" con la cuenta de servicio de Google (GSPAK).
// Es la fuente de verdad del panel de Claroscuro: si cambias un dato en la planilla, cambia en el panel.
// Busca cada tabla por sus encabezados, no por el nombre de la pestana, asi no se rompe si renombras pestanas.

import { google } from 'googleapis'

const SPREADSHEET_ID = '1fFIUmMVN8G7I_cTsdfUwacu_Yvy0H6bNpTbmWZAFPcs'

export const SERVICE_ACCOUNT_EMAIL = 'cc-smart@project-d633e93c-f44e-4050-ad9.iam.gserviceaccount.com'

export type Metrica = {
  metrica: string
  valor: string
  periodo: string
  fuente: string
  actualizado: string
}

export type VentaBandcamp = {
  fecha: string
  item: string
  tipo: string
  neto: number
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

export type ClaroscuroData = {
  ok: boolean
  error?: string
  leidoEn: string
  metricas: Metrica[]
  ventas: VentaBandcamp[]
  statements: Statement[]
  topTracks: TopTrack[]
  topTracksTitulo: string
  tiendas: TiendaRevenue[]
  tiendasTitulo: string
  resumen: {
    ventasBandcamp: number
    netoBandcamp: number
    porCobrarLabelEngine: number
    statementsPendientes: number
    releases: string | null
  }
}

// Convierte "25,28" o "81.96" o "1.234,50" en numero
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

// Busca en todas las pestanas una tabla cuyo encabezado contenga estas columnas
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
  releases: null
}

export async function getClaroscuroData(): Promise<ClaroscuroData> {
  const leidoEn = new Date().toISOString()
  try {
    const credentials = JSON.parse(process.env.GSPAK as string)
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    })
    const sheets = google.sheets({ version: 'v4', auth })

    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      fields: 'sheets.properties.title'
    })
    const titulos = (meta.data.sheets || [])
      .map(s => s.properties?.title)
      .filter((t): t is string => !!t)

    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: titulos.map(t => "'" + t.replace(/'/g, "''") + "'!A1:Z300")
    })
    const pestanas = (res.data.valueRanges || []).map(r => (r.values || []) as string[][])

    // Dashboard (pide tambien FUENTE para no confundirla con la tabla de Instagram): METRICA | VALOR | PERIODO | FUENTE | ULTIMA ACTUALIZACION
    const tDash = buscarTabla(pestanas, ['metrica', 'valor', 'fuente'])
    const metricas: Metrica[] = tDash
      ? tDash.datos.map(f => ({
          metrica: f[tDash.idx['metrica']] || '',
          valor: f[tDash.idx['valor']] || '',
          periodo: f[tDash.idx['periodo']] || '',
          fuente: f[tDash.idx['fuente']] || '',
          actualizado: f[tDash.idx['ultima actualizacion']] || ''
        }))
      : []

    // Ventas Bandcamp: fecha | comprador | item | tipo | ... | neto_usd
    const tVentas = buscarTabla(pestanas, ['fecha', 'item', 'neto_usd'])
    const ventas: VentaBandcamp[] = tVentas
      ? tVentas.datos.map(f => ({
          fecha: f[tVentas.idx['fecha']] || '',
          item: f[tVentas.idx['item']] || '',
          tipo: f[tVentas.idx['tipo']] || '',
          neto: num(f[tVentas.idx['neto_usd']])
        }))
      : []

    // Statements Label Engine: periodo | statement | monto_usd | estado
    const tStat = buscarTabla(pestanas, ['periodo', 'monto_usd', 'estado'])
    const statements: Statement[] = tStat
      ? tStat.datos.map(f => ({
          periodo: f[tStat.idx['periodo']] || '',
          monto: num(f[tStat.idx['monto_usd']]),
          estado: f[tStat.idx['estado']] || ''
        }))
      : []

    // Top tracks Label Engine: rank | isrc | artista | titulo | tienda | pais | streams | revenue_usd
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
          revenue: num(f[tTop.idx['revenue_usd']])
        }))
      : []

    // Revenue por tienda: tienda | revenue_usd | porcentaje | tipo
    const tTiendas = buscarTabla(pestanas, ['tienda', 'revenue_usd', 'porcentaje'])
    const tiendas: TiendaRevenue[] = tTiendas
      ? tTiendas.datos.map(f => ({
          tienda: f[tTiendas.idx['tienda']] || '',
          revenue: num(f[tTiendas.idx['revenue_usd']]),
          tipo: f[tTiendas.idx['tipo']] || ''
        }))
      : []

    const pendientes = statements.filter(s => norm(s.estado).startsWith('pendiente'))
    const releases = metricas.find(m => norm(m.metrica).startsWith('releases'))

    return {
      ok: true,
      leidoEn,
      metricas,
      ventas,
      statements,
      topTracks,
      topTracksTitulo: tTop?.titulo || '',
      tiendas,
      tiendasTitulo: tTiendas?.titulo || '',
      resumen: {
        ventasBandcamp: ventas.length,
        netoBandcamp: Math.round(ventas.reduce((a, v) => a + v.neto, 0) * 100) / 100,
        porCobrarLabelEngine: Math.round(pendientes.reduce((a, s) => a + s.monto, 0) * 100) / 100,
        statementsPendientes: pendientes.length,
        releases: releases ? releases.valor : null
      }
    }
  } catch (error) {
    console.error('[Panel Claroscuro] Error leyendo la planilla:', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      leidoEn,
      metricas: [],
      ventas: [],
      statements: [],
      topTracks: [],
      topTracksTitulo: '',
      tiendas: [],
      tiendasTitulo: '',
      resumen: VACIO
    }
  }
}
