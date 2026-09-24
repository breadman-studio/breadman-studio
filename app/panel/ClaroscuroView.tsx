'use client'
// Vista Claroscuro del panel: submenú de botones a la izquierda + métricas visuales (sin tablas largas).
import { useMemo, useState } from 'react'
import type { ClaroscuroData } from '@/lib/claroscuro-sheet'
import type { BandcampData, BandcampVenta } from '@/lib/bandcamp'

const C = {
  bg: '#111111', surface: '#1a1a1a', border: '#2a2a2a',
  text: '#e8e8e8', muted: '#777777', dim: '#4a4a4a',
  gold: '#A68A64', bc: '#1DA0C3', le: '#9B7BF0', redes: '#E4577E', ok: '#22c55e', warn: '#f59e0b', error: '#ef4444',
}
const PALETA = [C.bc, C.gold, C.le, C.redes, C.ok, C.warn]

const SUB = [
  { id: 'resumen', label: 'Resumen', color: C.gold, icon: '◐' },
  { id: 'bandcamp', label: 'Bandcamp', color: C.bc, icon: '◎' },
  { id: 'labelengine', label: 'Label Engine', color: C.le, icon: '◇' },
  { id: 'redes', label: 'Redes', color: C.redes, icon: '◈' },
]

const PERIODOS = [
  { id: '7d', label: '7 días', dias: 7 },
  { id: 'mes', label: 'Mes', dias: 30 },
  { id: 'anio', label: 'Año', dias: 365 },
] as const
type PeriodoId = typeof PERIODOS[number]['id']

const TIPO_LABEL: Record<string, string> = { track: 'Tracks', album: 'Álbumes / EPs', package: 'Merch / físico' }

function money(n: number) { return '$' + n.toFixed(2).replace('.', ',') }
function mesCorto(d: Date) { return d.toLocaleDateString('es-CL', { month: 'short' }).replace('.', '') }

// Normaliza el "referer" de Bandcamp a algo legible
function origenLegible(o: string) {
  const s = (o || '').toLowerCase()
  if (!s) return 'Directo / sin dato'
  if (s.includes('search')) return 'Búsqueda en Bandcamp'
  if (s.includes('discover')) return 'Bandcamp Discover'
  if (s.includes('fan') || s.includes('collection')) return 'Colección de otro fan'
  if (s.includes('feed') || s.includes('follow')) return 'Feed / seguidores'
  if (s.includes('daily') || s.includes('editorial')) return 'Bandcamp Daily'
  if (s.includes('bandcamp')) return 'Dentro de Bandcamp'
  return o.length > 30 ? o.slice(0, 30) + '…' : o
}

function contar<T>(arr: T[], key: (x: T) => string, val: (x: T) => number = () => 1) {
  const m = new Map<string, number>()
  for (const x of arr) m.set(key(x), (m.get(key(x)) || 0) + val(x))
  return [...m.entries()].map(([label, valor]) => ({ label, valor })).sort((a, b) => b.valor - a.valor)
}

// ---------- componentes visuales ----------
function Kpi({ value, label, sub, color }: { value: string | number; label: string; sub?: string; color: string }) {
  return (
    <div style={{ background: `linear-gradient(160deg, ${color}26 0%, ${C.surface} 70%)`, border: '1px solid ' + color + '40', borderRadius: 12, padding: '18px 16px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }} />
      <div style={{ fontSize: 26, fontWeight: 800, color: C.text, lineHeight: 1.05, wordBreak: 'break-word' }}>{value}</div>
      <div style={{ fontSize: 11, color, marginTop: 8, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function Card({ title, color, children, right }: { title: string; color: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, padding: 16, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
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

function Vacio({ texto }: { texto: string }) {
  return <div style={{ fontSize: 12, color: C.muted, padding: '8px 0' }}>{texto}</div>
}

function Barras({ datos, color, formato }: { datos: { label: string; valor: number }[]; color: string; formato: (n: number) => string }) {
  const max = Math.max(1, ...datos.map(d => d.valor))
  const pocos = datos.length <= 12
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: pocos ? 6 : 3, height: 150, paddingTop: 18 }}>
      {datos.map((d, i) => (
        <div key={i} title={`${d.label}: ${formato(d.valor)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', minWidth: 0 }}>
          {pocos && <div style={{ fontSize: 9, color: C.muted, marginBottom: 4, whiteSpace: 'nowrap' }}>{d.valor > 0 ? formato(d.valor) : ''}</div>}
          <div style={{ width: '100%', maxWidth: 34, height: `${Math.max(2, (d.valor / max) * 100)}%`, background: d.valor > 0 ? `linear-gradient(180deg, ${color}, ${color}55)` : C.border, borderRadius: '5px 5px 2px 2px' }} />
          <div style={{ fontSize: 9, color: C.dim, marginTop: 6, whiteSpace: 'nowrap', visibility: pocos || i % 5 === 0 ? 'visible' : 'hidden' }}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}

function Ranking({ items, color, colores }: { items: { label: string; valor: number; extra?: string }[]; color?: string; colores?: string[] }) {
  const max = Math.max(1, ...items.map(i => i.valor))
  if (items.length === 0) return <Vacio texto="Sin datos en este período" />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((i, n) => (
        <div key={i.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.label}</span>
            <span style={{ color: C.muted, flexShrink: 0 }}>{i.extra ?? i.valor}</span>
          </div>
          <div style={{ height: 6, background: C.bg, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${(i.valor / max) * 100}%`, height: '100%', background: colores ? colores[n % colores.length] : color, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Barra segmentada (ej. tipo de compra)
function Segmentos({ items }: { items: { label: string; valor: number; color: string; extra?: string }[] }) {
  const total = items.reduce((a, i) => a + i.valor, 0)
  if (!total) return <Vacio texto="Sin datos en este período" />
  return (
    <div>
      <div style={{ display: 'flex', height: 14, borderRadius: 8, overflow: 'hidden', background: C.bg }}>
        {items.map(i => <div key={i.label} title={i.label} style={{ width: `${(i.valor / total) * 100}%`, background: i.color }} />)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 12 }}>
        {items.map(i => (
          <div key={i.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: i.color }} />
            <span style={{ color: C.text }}>{i.label}</span>
            <span style={{ color: C.muted }}>{i.extra ?? i.valor} · {Math.round((i.valor / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Aviso({ texto }: { texto: string }) {
  return <div style={{ background: C.surface, border: '1px solid ' + C.error + '55', borderRadius: 12, padding: 16, fontSize: 12, color: C.muted }}><b style={{ color: C.error }}>Sin conexión. </b>{texto}</div>
}

// ---------- lógica Bandcamp por período ----------
function serie(ventas: BandcampVenta[], periodo: PeriodoId, campo: 'ventas' | 'neto') {
  const hoy = new Date()
  const cubos: { label: string; key: string; valor: number }[] = []
  if (periodo === 'anio') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
      cubos.push({ label: mesCorto(d), key: d.toISOString().slice(0, 7), valor: 0 })
    }
  } else {
    const n = periodo === '7d' ? 7 : 30
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(hoy); d.setDate(d.getDate() - i)
      cubos.push({ label: periodo === '7d' ? d.toLocaleDateString('es-CL', { weekday: 'short' }).replace('.', '') : String(d.getDate()), key: d.toISOString().slice(0, 10), valor: 0 })
    }
  }
  const largo = periodo === 'anio' ? 7 : 10
  for (const v of ventas) {
    const c = cubos.find(x => x.key === v.fecha.slice(0, largo))
    if (c) c.valor += campo === 'ventas' ? 1 : v.neto
  }
  return cubos
}

function BandcampSeccion({ ventasTodas }: { ventasTodas: BandcampVenta[] }) {
  const [periodo, setPeriodo] = useState<PeriodoId>('mes')
  const dias = PERIODOS.find(p => p.id === periodo)!.dias
  const ventas = useMemo(() => {
    const desde = Date.now() - dias * 86400000
    return ventasTodas.filter(v => new Date(v.fecha).getTime() >= desde)
  }, [ventasTodas, dias])

  const neto = ventas.reduce((a, v) => a + v.neto, 0)
  const compradores = new Set(ventas.map(v => v.comprador).filter(Boolean)).size
  const conExtra = ventas.filter(v => v.extra > 0)
  const porItem = contar(ventas, v => v.item)
  const top = porItem[0]
  const topNeto = top ? ventas.filter(v => v.item === top.label).reduce((a, v) => a + v.neto, 0) : 0
  const topTipo = top ? ventas.find(v => v.item === top.label)?.tipo : ''
  const tipos = contar(ventas, v => v.tipo)

  const grid = (min: number) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 })

  return (<>
    {/* Selector de período */}
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {PERIODOS.map(p => {
        const act = p.id === periodo
        return (
          <button key={p.id} onClick={() => setPeriodo(p.id)} style={{ padding: '8px 16px', borderRadius: 20, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: 12, fontWeight: 700, background: act ? C.bc : C.bc + '14', color: act ? '#111' : C.bc, border: '1px solid ' + (act ? C.bc : C.bc + '40') }}>
            {p.label}
          </button>
        )
      })}
    </div>

    <div style={grid(140)}>
      <Kpi color={C.bc} value={ventas.length} label="Ventas" />
      <Kpi color={C.ok} value={money(neto)} label="Neto" />
      <Kpi color={C.gold} value={compradores} label="Compradores" sub="únicos" />
      <Kpi color={C.le} value={ventas.length ? money(neto / ventas.length) : '—'} label="Ticket promedio" />
    </div>

    {/* Lo más vendido del período */}
    <div style={{ background: `linear-gradient(120deg, ${C.gold}33, ${C.surface} 65%)`, border: '1px solid ' + C.gold + '55', borderRadius: 12, padding: 18, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ fontSize: 30, color: C.gold }}>★</div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, letterSpacing: '0.5px' }}>LO MÁS VENDIDO · {PERIODOS.find(p => p.id === periodo)!.label.toUpperCase()}</div>
        <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>{top ? top.label : 'Sin ventas en este período'}</div>
        {top && <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{top.valor} {top.valor === 1 ? 'venta' : 'ventas'} · {money(topNeto)} · {TIPO_LABEL[topTipo || ''] || topTipo}</div>}
      </div>
    </div>

    <Card title={periodo === 'anio' ? 'Ventas por mes' : 'Ventas por día'} color={C.bc}>
      <Barras datos={serie(ventas, periodo, 'ventas')} color={C.bc} formato={n => String(n)} />
    </Card>

    <div style={grid(260)}>
      <Card title="Qué compran" color={C.le}>
        <Segmentos items={tipos.map((t, i) => ({ label: TIPO_LABEL[t.label] || t.label, valor: t.valor, color: [C.bc, C.le, C.gold, C.redes][i % 4] }))} />
      </Card>
      <Card title="Pagaron más de lo pedido" color={C.redes}>
        {conExtra.length === 0 ? <Vacio texto="Nadie pagó extra en este período" /> : (<>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{conExtra.length} <span style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}>compras · +{money(conExtra.reduce((a, v) => a + v.extra, 0))} extra</span></div>
          <div style={{ fontSize: 11, color: C.muted, margin: '4px 0 12px' }}>Señal fuerte de que el release les gustó</div>
          <Ranking color={C.redes} items={contar(conExtra, v => v.item).slice(0, 3)} />
        </>)}
      </Card>
    </div>

    <div style={grid(260)}>
      <Card title="Más vendidos" color={C.gold}>
        <Ranking color={C.gold} items={porItem.slice(0, 5).map(i => ({ ...i, extra: `${i.valor}` }))} />
      </Card>
      <Card title="Cómo llegaron" color={C.bc}>
        <Ranking colores={PALETA} items={contar(ventas, v => origenLegible(v.origen)).slice(0, 5)} />
      </Card>
      <Card title="Países" color={C.ok}>
        <Ranking color={C.ok} items={contar(ventas, v => v.pais).slice(0, 5)} />
      </Card>
    </div>

    <div style={{ fontSize: 11, color: C.dim }}>Las reproducciones (plays) no están disponibles en la API de Bandcamp; solo se ven en su panel de estadísticas.</div>
  </>)
}

// ---------- vista principal ----------
export default function ClaroscuroView({ data, bandcamp }: { data: ClaroscuroData; bandcamp: BandcampData }) {
  const [sub, setSub] = useState('resumen')
  const ventasBc = bandcamp.ok ? bandcamp.ventas : []
  const st = data.ok ? data.statements : []
  const pendiente = data.ok ? data.resumen.porCobrarLabelEngine : 0
  const pagado = st.filter(s => /pagad/i.test(s.estado)).reduce((a, s) => a + s.monto, 0)
  const metricasRedes = data.ok ? data.metricas.filter(m => /instagram|facebook|meta|seguidor|spotify|soundcloud/i.test(m.metrica + ' ' + m.fuente)) : []

  const neto12 = ventasBc.reduce((a, v) => a + v.neto, 0)
  const tiendasSuma = data.ok ? data.tiendas.reduce((a, t) => a + t.revenue, 0) : 0
  const tituloTotal = data.ok ? (data.tiendasTitulo.match(/\$\s*([\d.,]+)/)?.[1] || '') : ''
  const tituloTotalNum = parseFloat(tituloTotal.replace(',', '.')) || 0
  const tiendasNoCalza = tituloTotalNum > 0 && Math.abs(tituloTotalNum - tiendasSuma) > 0.05
  const colorTipo = (t: string) => /venta/i.test(t) ? C.gold : /suscrip/i.test(t) ? C.bc : C.le

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

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {sub === 'resumen' && (<>
          <div style={grid(150)}>
            <Kpi color={C.bc} value={bandcamp.ok ? ventasBc.length : '—'} label="Ventas Bandcamp" sub="últimos 12 meses" />
            <Kpi color={C.ok} value={bandcamp.ok ? money(neto12) : '—'} label="Neto Bandcamp" sub="últimos 12 meses" />
            <Kpi color={C.le} value={money(pendiente)} label="Por cobrar LE" sub={data.ok ? data.resumen.statementsPendientes + ' statements' : ''} />
            <Kpi color={C.gold} value={data.ok ? (data.resumen.releases || '—') : '—'} label="Releases" sub="catálogo CLOS" />
          </div>
          <div style={grid(280)}>
            <Card title="Ingresos Bandcamp por mes" color={C.bc}>
              {bandcamp.ok ? <Barras datos={serie(ventasBc, 'anio', 'neto')} color={C.bc} formato={n => '$' + Math.round(n)} /> : <Vacio texto="Bandcamp sin conexión" />}
            </Card>
            <Card title="Statements Label Engine" color={C.le}>
              <Barras datos={st.slice(0, 12).reverse().map(s => ({ label: s.periodo.split(' ')[0], valor: s.monto }))} color={C.le} formato={n => '$' + Math.round(n)} />
            </Card>
          </div>
        </>)}

        {sub === 'bandcamp' && (bandcamp.ok ? <BandcampSeccion ventasTodas={ventasBc} /> : <Aviso texto={bandcamp.error} />)}

        {sub === 'labelengine' && (data.ok ? (<>
          <div style={grid(150)}>
            <Kpi color={C.le} value={money(pendiente)} label="Por cobrar" sub={data.resumen.statementsPendientes + ' statements pendientes'} />
            <Kpi color={C.ok} value={money(pagado)} label="Ya pagado" />
            <Kpi color={C.gold} value={money(pendiente + pagado)} label="Total generado" sub={st.length + ' statements'} />
          </div>

          <Card title={'Revenue por tienda' + (data.tiendasTitulo.match(/\w+ \d{4}/) ? ' · ' + data.tiendasTitulo.match(/\w+ \d{4}/)![0] : '')} color={C.gold}
            right={<div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.muted }}>
              <span><span style={{ color: C.gold }}>■</span> venta</span><span><span style={{ color: C.le }}>■</span> stream</span><span><span style={{ color: C.bc }}>■</span> suscripción</span>
            </div>}>
            {data.tiendas.length === 0 ? <Vacio texto="No hay tabla de tiendas en la planilla" /> : (<>
              <Ranking items={data.tiendas.filter(t => !/^total/i.test(t.tienda)).map(t => ({ label: t.tienda, valor: t.revenue, extra: `${money(t.revenue)} · ${tiendasSuma ? Math.round((t.revenue / tiendasSuma) * 100) : 0}%` }))}
                colores={data.tiendas.filter(t => !/^total/i.test(t.tienda)).map(t => colorTipo(t.tipo))} />
              {tiendasNoCalza && <div style={{ fontSize: 11, color: C.warn, marginTop: 12 }}>Ojo: las tiendas suman {money(tiendasSuma)}, pero el statement del mes es ${tituloTotal}. Los porcentajes son sobre {money(tiendasSuma)}.</div>}
            </>)}
          </Card>

          <Card title={'Top tracks' + (data.topTracksTitulo.match(/\w+ \d{4}/) ? ' · ' + data.topTracksTitulo.match(/\w+ \d{4}/)![0] : '')} color={C.le}>
            {data.topTracks.length === 0 ? <Vacio texto="No hay tabla de top tracks en la planilla" /> : (
              <div style={grid(190)}>
                {data.topTracks.slice(0, 9).map((t, i) => (
                  <div key={t.isrc + i} style={{ background: C.bg, borderRadius: 10, padding: 12, borderLeft: '3px solid ' + colorTipo(/beatport|itunes/i.test(t.tienda) ? 'venta' : 'stream') }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 11, color: C.dim }}>#{t.rank || i + 1}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: C.le, background: C.le + '1f', padding: '1px 7px', borderRadius: 10 }}>{t.tienda}</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titulo}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{t.artista} · {t.pais}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12 }}>
                      <span style={{ color: C.muted }}>{t.streams} {/beatport|itunes/i.test(t.tienda) ? 'ventas' : 'streams'}</span>
                      <span style={{ fontWeight: 800, color: C.ok }}>{money(t.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div style={grid(260)}>
            <Card title="Países (top tracks)" color={C.ok}>
              <Ranking color={C.ok} items={contar(data.topTracks, t => t.pais, t => t.revenue).slice(0, 6).map(p => ({ ...p, extra: money(p.valor) }))} />
            </Card>
            <Card title="Statements por mes" color={C.le} right={
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.muted }}>
                <span><span style={{ color: C.le }}>■</span> pendiente</span><span><span style={{ color: C.ok }}>■</span> pagado</span>
              </div>}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 150, paddingTop: 10 }}>
                {st.slice().reverse().map(s => {
                  const max = Math.max(1, ...st.map(x => x.monto))
                  const col = /pagad/i.test(s.estado) ? C.ok : C.le
                  return (
                    <div key={s.periodo} title={`${s.periodo}: ${money(s.monto)} (${s.estado})`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', minWidth: 0 }}>
                      <div style={{ width: '100%', maxWidth: 26, height: `${Math.max(3, (s.monto / max) * 100)}%`, background: `linear-gradient(180deg, ${col}, ${col}55)`, borderRadius: '5px 5px 2px 2px' }} />
                      <div style={{ fontSize: 8, color: C.dim, marginTop: 5, whiteSpace: 'nowrap' }}>{s.periodo.split(' ')[0]}</div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
          <div style={{ fontSize: 11, color: C.dim }}>Label Engine no tiene API: estos datos vienen de la planilla Panel Data. Top tracks y tiendas corresponden a un solo mes.</div>
        </>) : <Aviso texto={data.error || 'No se pudo leer la planilla'} />)}

        {sub === 'redes' && (data.ok ? (
          metricasRedes.length ? (
            <div style={grid(180)}>
              {metricasRedes.map((m, i) => (
                <Kpi key={m.metrica} color={[C.redes, C.bc, C.le, C.gold][i % 4]} value={m.valor} label={m.metrica} sub={`${m.fuente} · ${m.periodo}`} />
              ))}
            </div>
          ) : <Vacio texto="No hay métricas de redes en la planilla." />
        ) : <Aviso texto={data.error || 'No se pudo leer la planilla'} />)}

        <div style={{ fontSize: 11, color: C.dim }}>
          {bandcamp.ok ? 'Bandcamp en vivo · ' : ''}Planilla Panel Data · actualizado {new Date(data.leidoEn).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' })}
        </div>
      </div>
    </div>
  )
}
