export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Redis } from '@upstash/redis'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

const redis = Redis.fromEnv()

// Token del bot de Claroscuro (distinto al de Campo Capital)
const TELEGRAM_TOKEN = process.env.CLAROSCURO_BOT_TOKEN
const FER_TELEGRAM_ID = 1796093217
const MAX_HISTORY = 20

// Cajon propio de Claroscuro en Redis: todo lleva prefijo cr:
const CR_CONTEXT_KEY = 'cr:contexto_adicional'
const CR_CATALOGO_KEY = 'cr:catalogo'
const CR_CATALOGO_FECHA_KEY = 'cr:catalogo_fecha'

const SYSTEM_PROMPT = `# IDENTIDAD

Eres el cerebro operativo de Claroscuro Records, un sello de musica electronica minimal/techno operado por Fer desde Chile.

Solo hablas con Fer, el dueno del sello. Cada mensaje que recibes es Fer dandote una instruccion, una pregunta, o informacion nueva para que proceses.

Hablas en espanol neutro chileno, directo y sin relleno. Nunca usas voseo.

Cuando Fer te pida redactar algo en nombre del sello (un mensaje, un texto, una respuesta a alguien), usa la voz de Claroscuro: underground, calida, sin sonar corporativa, en el idioma que corresponda al destinatario.

# CONTEXTO

Claroscuro Records es un sello de musica electronica minimal y techno, activo desde 2016, operado por Fer bajo Breadman Studio.

Distribuye a traves de Label Engine y esta presente en Beatport, Apple Music, Bandcamp, Spotify y SoundCloud. La mayor parte del ingreso viene de Beatport y Apple Music. Las ventas directas ocurren en Beatport y Bandcamp; Spotify y Apple Music son principalmente streaming.

El catalogo usa codigos secuenciales tipo CLOS seguido de un numero. El ciclo normal de un release es: llega una demo, se aprueba, se firma, se masteriza, se prepara el artwork y las previews, se sube a Label Engine, y luego viene la promocion.

El sello publica un set o podcast mensual de un artista de la linea del sello, como gancho de trafico y comunidad.

# HERRAMIENTAS

Nunca simules una accion si la herramienta no esta conectada.

- Guardar contexto nuevo: OPERATIVA. Cuando Fer use palabras como guarda, anota o agrega, ordena la info y guardala sin preguntar.
- Consultar catalogo: OPERATIVA. Abajo tienes el catalogo oficial del sello, cargado desde el CSV de Label Engine (el distribuidor). Cada linea es un release: codigo, fecha de lanzamiento, artista y titulo, UPC, y sus tracks con mezcla, duracion e ISRC. Usalo para responder sobre releases, artistas, fechas, tracks, ISRC y UPC. No inventes datos que no esten ahi (por ejemplo links o ventas). Si el catalogo no esta cargado, dile a Fer que te envie el CSV de Label Engine como archivo.
- Generar pieza grafica: PENDIENTE. El motor existe pero aun no esta configurado para Claroscuro. Informa que no esta lista y no simules el resultado.
- Seguimiento del ciclo de un release en curso (demo, firma, master, artwork): PENDIENTE. El catalogo solo tiene lo ya distribuido.
- Consultar ingresos del mes: PENDIENTE. No esta conectado todavia.

# CRITERIO

Cuando Fer pida generar o ejecutar algo, revisa primero si esa herramienta esta conectada. Si no lo esta, dilo directamente.

Cuando Fer mande informacion nueva sobre el sello, guardala sin preguntar.

Cualquier accion real (publicar, confirmar un precio, una fecha de lanzamiento o un compromiso del sello) la preparas, pero no la das por hecha: Fer decide.

Cuando no estes seguro de que quiere Fer, pregunta en vez de asumir.

# GUARDAR INFO

Cuando Fer quiera guardar info, ayudalo a ordenarla y al final incluye en linea separada:
GUARDAR_INFO: la info limpia y ordenada`

type Message = {
  role: 'user' | 'assistant'
  content: string
}

function detectSaveIntent(text: string): boolean {
  const lower = text.toLowerCase()
  return (
    lower.includes('guarda') ||
    lower.includes('anota') ||
    lower.includes('registra') ||
    lower.includes('agrega') ||
    lower.includes('actualiza') ||
    lower.includes('nueva info') ||
    lower.includes('quiero que sepas') ||
    lower.includes('ten en cuenta')
  )
}

async function sendTelegram(chatId: number, text: string) {
  await fetch(
    'https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/sendMessage',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    }
  )
}

// ---------- Herramienta: catalogo desde el CSV de Label Engine ----------

// Lee un CSV respetando campos entre comillas (con comas o comillas adentro)
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const t = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(f => f.trim() !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some(f => f.trim() !== '')) rows.push(row)
  return rows
}

function numeroCatalogo(code: string): number {
  const m = code.match(/(\d+)\s*$/)
  return m ? parseInt(m[1], 10) : -1
}

type ResultadoCatalogo = {
  releases: number
  tracks: number
  codigosRaros: string[]
  numerosFaltantes: number[]
  texto: string
}

function construirCatalogo(csv: string): ResultadoCatalogo {
  const rows = parseCSV(csv)
  if (rows.length < 2) throw new Error('El CSV viene vacio')
  const header = rows[0].map(h => h.trim())
  const col = (name: string) => {
    const idx = header.indexOf(name)
    if (idx === -1) throw new Error('Falta la columna ' + name)
    return idx
  }
  const C = {
    catalogo: col('Catalog#'),
    fecha: col('Release Date'),
    relArtista: col('Release Artist'),
    relTitulo: col('Release Title'),
    upc: col('UPC#'),
    trArtista: col('Track Artist'),
    trTitulo: col('Track Title'),
    trMix: col('Track Mix'),
    isrc: col('ISRC'),
    min: col('Time in Minutes'),
    seg: col('Time in Seconds')
  }

  type Release = { codigo: string; fecha: string; titulo: string; upc: string; tracks: string[] }
  const releases = new Map<string, Release>()

  for (const r of rows.slice(1)) {
    const g = (i: number) => (r[i] || '').trim()
    const codigo = g(C.catalogo) || 'sin codigo'
    if (!releases.has(codigo)) {
      releases.set(codigo, {
        codigo,
        fecha: g(C.fecha),
        titulo: g(C.relArtista) + ' - ' + g(C.relTitulo),
        upc: g(C.upc),
        tracks: []
      })
    }
    const rel = releases.get(codigo)!
    const artistaTrack = g(C.trArtista) && g(C.trArtista) !== g(C.relArtista) ? g(C.trArtista) + ' - ' : ''
    const mix = g(C.trMix) ? ' (' + g(C.trMix) + ')' : ''
    const dur = g(C.min) ? ' ' + g(C.min) + ':' + g(C.seg).padStart(2, '0') : ''
    const isrc = g(C.isrc) ? ' [' + g(C.isrc) + ']' : ''
    rel.tracks.push(artistaTrack + g(C.trTitulo) + mix + dur + isrc)
  }

  const lista = Array.from(releases.values()).sort((a, b) => numeroCatalogo(b.codigo) - numeroCatalogo(a.codigo))

  const texto = lista.map(r =>
    [r.codigo, r.fecha, r.titulo, 'UPC ' + (r.upc || '-'), r.tracks.join(' / ')].join(' | ')
  ).join('\n')

  // Controles de calidad: codigos con formato distinto a CLOS000 y numeros que faltan
  const codigosRaros = lista.map(r => r.codigo).filter(c => !/^CLOS\d{3}$/.test(c))
  const numeros = new Set(lista.filter(r => r.codigo.startsWith('CLOS')).map(r => numeroCatalogo(r.codigo)))
  const maximo = Math.max(0, ...Array.from(numeros))
  const numerosFaltantes: number[] = []
  for (let n = 1; n <= maximo; n++) if (!numeros.has(n)) numerosFaltantes.push(n)

  return {
    releases: lista.length,
    tracks: rows.length - 1,
    codigosRaros,
    numerosFaltantes,
    texto
  }
}

async function descargarArchivoTelegram(fileId: string): Promise<string> {
  const info = await fetch(
    'https://api.telegram.org/bot' + TELEGRAM_TOKEN + '/getFile?file_id=' + fileId
  ).then(r => r.json())
  if (!info.ok) throw new Error('Telegram no entrego el archivo')
  const res = await fetch(
    'https://api.telegram.org/file/bot' + TELEGRAM_TOKEN + '/' + info.result.file_path
  )
  return await res.text()
}

async function cargarCatalogoDesdeCSV(chatId: number, fileId: string) {
  await sendTelegram(chatId, 'Recibi el CSV. Leyendo el catalogo...')
  try {
    const csv = await descargarArchivoTelegram(fileId)
    const r = construirCatalogo(csv)
    await redis.set(CR_CATALOGO_KEY, r.texto)
    await redis.set(CR_CATALOGO_FECHA_KEY, new Date().toISOString().slice(0, 10))

    let msg = 'Catalogo cargado: ' + r.releases + ' releases y ' + r.tracks + ' tracks.'
    if (r.codigosRaros.length > 0) {
      msg += '\n\nCodigos con formato distinto a CLOS000: ' + r.codigosRaros.join(', ')
    }
    if (r.numerosFaltantes.length > 0) {
      msg += '\n\nNumeros CLOS que no aparecen: ' +
        r.numerosFaltantes.map(n => 'CLOS' + String(n).padStart(3, '0')).join(', ')
    }
    await sendTelegram(chatId, msg)
  } catch (e) {
    console.error('[Catalogo] Error:', e)
    await sendTelegram(chatId, 'No pude leer el CSV: ' + (e instanceof Error ? e.message : 'error desconocido'))
  }
}

// ---------- Endpoint ----------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const message = body?.message
    if (!message) {
      return NextResponse.json({ ok: true })
    }

    const chatId = message.chat.id
    const userId = message.from?.id

    // Bot cerrado: si no es Fer, no responde, no gasta API y no guarda nada
    if (userId !== FER_TELEGRAM_ID) {
      return NextResponse.json({ ok: true })
    }

    // Si Fer envia un archivo CSV, se carga como catalogo (sin pasar por Claude)
    const doc = message.document
    if (doc) {
      const nombre = String(doc.file_name || '').toLowerCase()
      if (nombre.endsWith('.csv')) {
        await cargarCatalogoDesdeCSV(chatId, doc.file_id)
      } else {
        await sendTelegram(chatId, 'Por ahora solo se leer archivos CSV (el catalogo de Label Engine).')
      }
      return NextResponse.json({ ok: true })
    }

    const userText = message.text
    if (!userText) {
      return NextResponse.json({ ok: true })
    }

    // Historial con prefijo cr: para no chocar con el de Campo Capital
    const historyKey = 'cr:chat:' + chatId + ':history'
    let history: Message[] = []
    try {
      const stored = await redis.get<Message[]>(historyKey)
      if (stored) history = stored
    } catch (e) {}

    let extraContext = ''
    try {
      const saved = await redis.get<string>(CR_CONTEXT_KEY)
      if (saved) extraContext = '\n\n# INFO ADICIONAL GUARDADA POR FER\n' + saved
    } catch (e) {}

    let catalogoContext = '\n\n# CATALOGO\nNo cargado todavia.'
    try {
      const catalogo = await redis.get<string>(CR_CATALOGO_KEY)
      const fecha = await redis.get<string>(CR_CATALOGO_FECHA_KEY)
      if (catalogo) {
        catalogoContext = '\n\n# CATALOGO (cargado desde Label Engine el ' + (fecha || 'fecha desconocida') +
          ', del mas nuevo al mas antiguo)\n' + catalogo
      }
    } catch (e) {}

    const wantsToSave = detectSaveIntent(userText)

    const saveInstruction = wantsToSave
      ? '\n\nINSTRUCCION: Fer quiere guardar info. Ayudalo y al final incluye GUARDAR_INFO: seguido de la info ordenada.'
      : ''

    history.push({ role: 'user', content: userText })
    if (history.length > MAX_HISTORY) {
      history = history.slice(history.length - MAX_HISTORY)
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT + catalogoContext + extraContext + saveInstruction,
      messages: history
    })

    let replyText = response.content[0].type === 'text'
      ? response.content[0].text
      : 'Error procesando.'

    const allLines = replyText.split('\n')

    const saveIdx = allLines.findIndex(l => l.trim().startsWith('GUARDAR_INFO:'))
    if (saveIdx !== -1) {
      const newInfo = allLines[saveIdx].replace('GUARDAR_INFO:', '').trim()
      try {
        const existing = await redis.get<string>(CR_CONTEXT_KEY)
        const updated = existing ? existing + '\n- ' + newInfo : '- ' + newInfo
        await redis.set(CR_CONTEXT_KEY, updated)
        allLines.splice(saveIdx, 1)
        replyText = allLines.join('\n').trim() + '\n\nQuedo guardado.'
      } catch (e) {}
    }

    history.push({ role: 'assistant', content: replyText })
    await redis.set(historyKey, history, { ex: 86400 })
    await sendTelegram(chatId, replyText)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Cerebro Claroscuro] Error:', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
