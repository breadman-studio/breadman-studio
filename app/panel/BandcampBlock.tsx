'use client'
// Bloque Bandcamp dentro de la sección Claroscuro del panel.
import type { BandcampData } from '@/lib/bandcamp'

const T = {
  surface: '#1a1a1a', border: '#2a2a2a', text: '#e8e8e8',
  textMuted: '#666666', textDim: '#444444', ok: '#22c55e', error: '#ef4444',
  bc: '#1DA0C3',
}

function money(n: number, moneda: string) {
  return (moneda && moneda !== 'mixta' ? moneda + ' ' : '$') + n.toFixed(2).replace('.', ',')
}

export default function BandcampBlock({ data }: { data: BandcampData }) {
  const card = { backgroundColor: T.surface, border: '1px solid ' + T.border, borderRadius: '8px', marginBottom: '16px', overflow: 'hidden' as const }
  const head = { padding: '12px 16px', borderBottom: '1px solid ' + T.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }

  if (!data.ok) {
    return (
      <div style={{ ...card, padding: '16px' }}>
        <div style={{ fontWeight: 700, color: T.error, marginBottom: '6px', fontSize: '13px' }}>No se pudo leer Bandcamp</div>
        <div style={{ fontSize: '12px', color: T.textMuted }}>{data.error}</div>
      </div>
    )
  }

  return (
    <>
      <div style={{ margin: '24px 0 8px', fontSize: '11px', color: T.textMuted, letterSpacing: '0.5px' }}>
        BANDCAMP · ÚLTIMOS 12 MESES
      </div>

      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {[
            { v: data.ventas, l: 'VENTAS', c: T.text },
            { v: money(data.neto, data.moneda), l: 'NETO', c: T.ok },
            { v: data.compradores, l: 'COMPRADORES', c: T.text },
          ].map((m, i) => (
            <div key={m.l} style={{ padding: '16px 8px', textAlign: 'center', borderRight: i < 2 ? '1px solid ' + T.border : 'none' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: m.c, lineHeight: 1 }}>{m.v}</div>
              <div style={{ fontSize: '10px', color: T.textMuted, marginTop: '6px', letterSpacing: '0.3px' }}>{m.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        <div style={card}>
          <div style={head}><span style={{ fontSize: '13px', fontWeight: 600 }}>Releases más vendidos</span></div>
          {data.topReleases.length === 0 && <div style={{ padding: '16px', fontSize: '12px', color: T.textMuted }}>Sin ventas en el período</div>}
          {data.topReleases.map((r, i) => (
            <div key={r.item} style={{ padding: '10px 16px', borderBottom: i < data.topReleases.length - 1 ? '1px solid ' + T.border : 'none', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ fontSize: '12px', color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.item}</span>
              <span style={{ fontSize: '12px', color: T.textMuted, flexShrink: 0 }}>{r.ventas} · {money(r.neto, data.moneda)}</span>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={head}><span style={{ fontSize: '13px', fontWeight: 600 }}>Países</span></div>
          {data.topPaises.length === 0 && <div style={{ padding: '16px', fontSize: '12px', color: T.textMuted }}>Sin datos</div>}
          {data.topPaises.map((p, i) => (
            <div key={p.pais} style={{ padding: '10px 16px', borderBottom: i < data.topPaises.length - 1 ? '1px solid ' + T.border : 'none', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: T.text }}>{p.pais}</span>
              <span style={{ fontSize: '12px', color: T.textMuted }}>{p.ventas}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={head}><span style={{ fontSize: '13px', fontWeight: 600 }}>Ventas recientes</span></div>
        {data.recientes.length === 0 && <div style={{ padding: '16px', fontSize: '12px', color: T.textMuted }}>Sin ventas en el período</div>}
        {data.recientes.map((s, i) => (
          <div key={i} style={{ padding: '10px 16px', borderBottom: i < data.recientes.length - 1 ? '1px solid ' + T.border : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.item}</div>
              <div style={{ fontSize: '11px', color: T.textMuted, marginTop: '2px' }}>{s.artista} · {s.tipo} · {s.pais}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: T.ok }}>{money(s.neto, s.moneda)}</div>
              <div style={{ fontSize: '10px', color: T.textDim, marginTop: '2px' }}>{new Date(s.fecha).toLocaleDateString('es-CL')}</div>
            </div>
          </div>
        ))}
        <div style={{ padding: '10px 16px', borderTop: '1px solid ' + T.border, fontSize: '11px', color: T.textDim }}>
          Fuente: API de Bandcamp · leído {new Date(data.leidoEn).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' })}
        </div>
      </div>
    </>
  )
}
