// app/api/bandcamp/route.ts
// Proxy seguro para la API de Bandcamp — el client_secret nunca llega al browser

import { NextResponse } from 'next/server'

const CLIENT_ID = process.env.BANDCAMP_CLIENT_ID!
const CLIENT_SECRET = process.env.BANDCAMP_CLIENT_SECRET!
const BAND_ID = '1922668780' // ID de claroscurorec en Bandcamp

async function getBandcampToken() {
  const res = await fetch('https://bandcamp.com/oauth_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  })
  const data = await res.json()
  return data.access_token as string
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const endpoint = searchParams.get('endpoint') || 'sales'

    const token = await getBandcampToken()

    let url = ''
    let body: Record<string, unknown> = {}

    if (endpoint === 'sales') {
      url = 'https://bandcamp.com/api/sales/1/sales_report'
      const end = new Date()
      const start = new Date()
      start.setMonth(start.getMonth() - 3) // últimos 3 meses
      body = {
        band_id: parseInt(BAND_ID),
        member_band_id: parseInt(BAND_ID),
        start_time: start.toISOString().split('T')[0] + ' 00:00:00',
        end_time: end.toISOString().split('T')[0] + ' 23:59:59',
        format: 'json',
      }
    } else if (endpoint === 'fans') {
      url = 'https://bandcamp.com/api/fans/1/collection_items'
      body = { band_id: parseInt(BAND_ID), count: 50 }
    } else if (endpoint === 'band') {
      url = 'https://bandcamp.com/api/account/1/my_bands'
      body = {}
    }

    const apiRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })

    const data = await apiRes.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[Bandcamp API]', err)
    return NextResponse.json({ error: 'Error conectando con Bandcamp' }, { status: 500 })
  }
}
