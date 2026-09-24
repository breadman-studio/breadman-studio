'use client'
// Vista Claroscuro del panel: submenú de botones a la izquierda + contenido visual (sin tablas largas).
import { useState } from 'react'
import type { ClaroscuroData } from '@/lib/claroscuro-sheet'
import type { BandcampData } from '@/lib/bandcamp'

const C = {
  bg: '#111111', surface: '#1a1a1a', border: '#2a2a2a',
  text: '#e8e8e8', muted: '#777777', dim: '#4a4a4a',
  gold: '#A68A64', bc: '#1DA0C3', le: '#9B7BF0', redes: '#E4577E', ok: '#22c55e', warn: '#f59e0b', error: '#ef4444',
}

const SUB = [
  { id: 'resumen', label: 'Resumen', color: C.gold, icon: '◐' },
  { id: 'bandcamp', label: 'Bandcamp', color: C.bc, icon: '◎' },
  { id: 'labelengine', label: 'Label Engine', color: C.le, icon: '◇' },
  { id: 'redes', label: 'Redes', color: C.redes, icon: '◈' },
]

function money(n: number) { return '$' + n.toFixed(2).replace('.', ',') }
function mesCorto(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-CL', { month: 'short' }).replace('.', '')
}

function Kpi({ value, label, sub, color }: { value: string | number; label: string; sub?: string; color: string }) {
  return (
    <div style={{ background: `linear-gradient(160deg, ${color}26 0%, ${C.surface} 70%)`, border: '1px solid ' + color + '40', borderRadius: 12, padding: '18px 16px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }} />
      <div style={{ fontSize: 28, fontWeight: 800, color: C.text, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color, marginTop: 8, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function Card({ title, color, children, right }: { title: string; color: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

// Barras verticales por mes (sin librerías)
function BarrasMes({ datos, color, formato }: { datos: { mes: string; valor: number }[]; color: string; formato: (n: number) => string }) {
  const max = Math.max(1, ...datos.map(d => d.valor))
  if (datos.length === 0) return <div style={{ fontSize: 12, color: C.muted }}>Sin datos en el período</div>
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 150, paddingTop: 18 }}>
      {datos.map(d => (
        <div key={d.mes} title={formato(d.valor)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', minWidth: 0 }}>
          <div style={{ fontSize: 9, color: C.muted, marginBottom: 4, whiteSpace: 'nowrap' }}>{d.valor > 0 ? formato(d.valor) : ''}</div>
          <div style={{ width: '100%', maxWidth: 34, height: `${Math.max(3, (d.valor / max) * 100)}%`, background: `linear-gradient(180deg, ${color}, ${color}55)`, borderRadius: '6px 6px 2px 2px' }} />
          <div style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>{mesCorto(d.mes)}</div>
        </div>
      ))}
    </div>
  )
}

// Barras horizontales tipo ranking
function Ranking({ items, color }: { items: { label: string; valor: number; extra?: string }[]; color: string }) {
  const max = Math.max(1, ...items.map(i => i.valor))
  if (items.length === 0) return <div style={{ fontSize: 12, color: C.muted }}>Sin datos</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map(i => (
        <div key={i.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.label}</span>
            <span style={{ color: C.muted, flexShrink: 0 }}>{i.extra ?? i.valor}</span>
          </div>
          <div style={{ height: 6, background: C.bg, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${(i.valor / max) * 100}%`, height: '100%', background: color, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Aviso({ texto }: { texto: string }) {
  return <div style={{ background: C.surface, border: '1px solid ' + C.error + '55', borderRadius: 12, padding: 16, fontSize: 12, color: C.muted }}><b style={{ color: C.error }}>Sin conexión. </b>{texto}</div>
}

export default function ClaroscuroView({ data, bandcamp }: { data: ClaroscuroData; bandcamp: BandcampData }) {
  const [sub, setSub] = useState('resumen')
  const bc = bandcamp.ok ? bandcamp : null
  const st = data.ok ? data.statements : []
  const pendiente = data.ok ? data.resumen.porCobrarLabelEngine : 0
  const pagado = st.filter(s => /pagad/i.test(s.estado)).reduce((a, s) => a + s.monto, 0)
  const metricasRedes = data.ok ? data.metricas.filter(m => /instagram|facebook|meta|seguidor|spotify|soundcloud/i.test(m.metrica + ' ' + m.fuente)) : []

  const grid = (min: number) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 })

  return (
    <div className="cr-wrap" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', paddingBottom: 90 }}>
      <style>{`
        .cr-sub { display:flex; flex-direction:column; gap:6px; width:170px; flex-shrink:0; position:sticky; top:12px; }
        .cr-btn:hover { filter: brightness(1.2); }
        @media (max-width: 760px) {
          .cr-wrap { flex-direction: column; }
          .cr-sub { flex-direction:row; width:100%; overflow-x:auto; position:static; padding-bottom:4px; }
          .cr-btn { flex-shrink:0; }
        }
      `}</style>

      {/* SUBMENÚ */}
      <nav className="cr-sub">
        {SUB.map(s => {
          const act = sub === s.id
          return (
            <button key={s.id} className="cr-btn" onClick={() => setSub(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif', fontSize: 13, fontWeight: act ? 700 : 500, textAlign: 'left',
                background: act ? s.color : s.color + '14', color: act ? '#111' : s.color,
                border: '1px solid ' + (act ? s.color : s.color + '40'), transition: 'all .15s',
              }}>
              <span style={{ fontSize: 14 }}>{s.icon}</span>{s.label}
            </button>
          )
        })}
      </nav>

      {/* CONTENIDO */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {sub === 'resumen' && (<>
          <div style={grid(150)}>
            <Kpi color={C.bc} value={bc ? bc.ventas : (data.ok ? data.resumen.ventasBandcamp : '—')} label="Ventas Bandcamp" sub="últimos 12 meses" />
            <Kpi color={C.ok} value={bc ? money(bc.neto) : (data.ok ? money(data.resumen.netoBandcamp) : '—')} label="Neto Bandcamp" sub={bc ? bc.moneda : ''} />
            <Kpi color={C.le} value={money(pendiente)} label="Por cobrar LE" sub={data.ok ? data.resumen.statementsPendientes + ' statements' : ''} />
            <Kpi color={C.gold} value={data.ok ? (data.resumen.releases || '—') : '—'} label="Releases" sub="catálogo CLOS" />
          </div>
          <div style={grid(280)}>
            <Card title="Ingresos Bandcamp por mes" color={C.bc}>
              {bc ? <BarrasMes datos={bc.porMes.map(m => ({ mes: m.mes, valor: m.neto }))} color={C.bc} formato={n => '$' + Math.round(n)} /> : <div style={{ fontSize: 12, color: C.muted }}>Bandcamp sin conexión</div>}
            </Card>
            <Card title="Lo más vendido" color={C.gold}>
              {bc ? <Ranking color={C.gold} items={bc.topReleases.slice(0, 4).map(r => ({ label: r.item, valor: r.ventas, extra: r.ventas + ' ventas' }))} /> : <div style={{ fontSize: 12, color: C.muted }}>Sin datos</div>}
            </Card>
          </div>
        </>)}

        {sub === 'bandcamp' && (bc ? (<>
          <div style={grid(150)}>
            <Kpi color={C.bc} value={bc.ventas} label="Ventas" sub="últimos 12 meses" />
            <Kpi color={C.ok} value={money(bc.neto)} label="Neto" sub={bc.moneda} />
            <Kpi color={C.gold} value={bc.compradores} label="Compradores" sub="únicos" />
            <Kpi color={C.le} value={bc.ventas ? money(bc.neto / bc.ventas) : '—'} label="Ticket promedio" />
          </div>
          <Card title="Ventas por mes" color={C.bc}>
            <BarrasMes datos={bc.porMes.map(m => ({ mes: m.mes, valor: m.ventas }))} color={C.bc} formato={n => String(n)} />
          </Card>
          <div style={grid(280)}>
            <Card title="Releases más vendidos" color={C.gold}>
              <Ranking color={C.gold} items={bc.topReleases.map(r => ({ label: r.item, valor: r.ventas, extra: `${r.ventas} · ${money(r.neto)}` }))} />
            </Card>
            <Card title="Países" color={C.redes}>
              <Ranking color={C.redes} items={bc.topPaises.map(p => ({ label: p.pais, valor: p.ventas }))} />
            </Card>
          </div>
          <Card title="Últimas ventas" color={C.ok}>
            <div style={grid(170)}>
              {bc.recientes.slice(0, 6).map((s, i) => (
                <div key={i} style={{ background: C.bg, borderRadius: 10, padding: 12, borderLeft: '3px solid ' + C.bc }}>
                  <div style={{ fontSize: 12, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.item}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{s.pais} · {new Date(s.fecha).toLocaleDateString('es-CL')}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.ok, marginTop: 6 }}>{money(s.neto)}</div>
                </div>
              ))}
            </div>
          </Card>
        </>) : <Aviso texto={bandcamp.ok ? '' : bandcamp.error} />)}

        {sub === 'labelengine' && (data.ok ? (<>
          <div style={grid(150)}>
            <Kpi color={C.le} value={money(pendiente)} label="Por cobrar" sub={data.resumen.statementsPendientes + ' statements pendientes'} />
            <Kpi color={C.ok} value={money(pagado)} label="Ya pagado" />
            <Kpi color={C.gold} value={money(pendiente + pagado)} label="Total generado" sub={st.length + ' statements'} />
          </div>
          <Card title="Statements por mes" color={C.le} right={
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.muted }}>
              <span><span style={{ color: C.le }}>■</span> pendiente</span><span><span style={{ color: C.ok }}>■</span> pagado</span>
            </div>}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160, paddingTop: 18 }}>
              {st.slice().reverse().map(s => {
                const max = Math.max(1, ...st.map(x => x.monto))
                const col = /pagad/i.test(s.estado) ? C.ok : C.le
                return (
                  <div key={s.periodo} title={`${s.periodo}: ${money(s.monto)} (${s.estado})`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', minWidth: 0 }}>
                    <div style={{ width: '100%', maxWidth: 30, height: `${Math.max(3, (s.monto / max) * 100)}%`, background: `linear-gradient(180deg, ${col}, ${col}55)`, borderRadius: '6px 6px 2px 2px' }} />
                    <div style={{ fontSize: 9, color: C.dim, marginTop: 6, whiteSpace: 'nowrap' }}>{s.periodo.split(' ')[0]}</div>
                  </div>
                )
              })}
            </div>
          </Card>
          <div style={{ fontSize: 11, color: C.dim }}>Label Engine no tiene API: estos datos vienen de la planilla Panel Data.</div>
        </>) : <Aviso texto={data.error || 'No se pudo leer la planilla'} />)}

        {sub === 'redes' && (data.ok ? (
          metricasRedes.length ? (
            <div style={grid(180)}>
              {metricasRedes.map((m, i) => (
                <Kpi key={m.metrica} color={[C.redes, C.bc, C.le, C.gold][i % 4]} value={m.valor} label={m.metrica} sub={`${m.fuente} · ${m.periodo}`} />
              ))}
            </div>
          ) : <div style={{ fontSize: 12, color: C.muted }}>No hay métricas de redes en la planilla.</div>
        ) : <Aviso texto={data.error || 'No se pudo leer la planilla'} />)}

        <div style={{ fontSize: 11, color: C.dim }}>
          {bc ? 'Bandcamp en vivo · ' : ''}Planilla Panel Data · actualizado {new Date(data.leidoEn).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' })}
        </div>
      </div>
    </div>
  )
}
