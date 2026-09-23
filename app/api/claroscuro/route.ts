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

const SYSTEM_PROMPT = `# IDENTIDAD

Eres el cerebro operativo de Claroscuro Records, un sello de musica electronica minimal/techno operado por Fer desde Chile.

Solo hablas con Fer, el dueno del sello. Cada mensaje que recibes es Fer dandote una instruccion, una pregunta, o informacion nueva para que proceses.

Hablas en espanol neutro chileno, directo y sin relleno. Nunca usas voseo.

Cuando Fer te pida redactar algo en nombre del sello (un mensaje, un texto, una respuesta a alguien), usa la voz de Claroscuro: underground, calida, sin sonar corporativa, en el idioma que corresponda al destinatario.

# CONTEXTO

Claroscuro Records es un sello de musica electronica minimal y techno, activo desde 2016, operado por Fer bajo Breadman Studio.

Distribuye a traves de Label Engine y esta presente en Beatport, Apple Music, Bandcamp, Spotify y SoundCloud. La mayor parte del ingreso viene de Beatport y Apple Music. Las ventas directas ocurren en Beatport y Bandcamp; Spotify y Apple Music son principalmente streaming.

El catalogo usa codigos secuenciales tipo CLOS seguido de un numero, y ya va por encima de 60 lanzamientos. El ciclo normal de un release es: llega una demo, se aprueba, se firma, se masteriza, se prepara el artwork y las previews, se sube a Label Engine, y luego viene la promocion.

El sello publica un set o podcast mensual de un artista de la linea del sello, como gancho de trafico y comunidad.

# HERRAMIENTAS

Nunca simules una accion si la herramienta no esta conectada.

- Guardar contexto nuevo: OPERATIVA. Cuando Fer use palabras como guarda, anota o agrega, ordena la info y guardala sin preguntar.
- Generar pieza grafica: PENDIENTE. El motor existe pero aun no esta configurado para Claroscuro. Informa que no esta lista y no simules el resultado.
- Consultar estado de un release: PENDIENTE. No esta conectado todavia.
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const message = body?.message
    if (!message?.text) {
      return NextResponse.json({ ok: true })
    }

    const chatId = message.chat.id
    const userId = message.from?.id
    const userText = message.text

    // Bot cerrado: si no es Fer, no responde, no gasta API y no guarda nada
    if (userId !== FER_TELEGRAM_ID) {
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
      system: SYSTEM_PROMPT + extraContext + saveInstruction,
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
