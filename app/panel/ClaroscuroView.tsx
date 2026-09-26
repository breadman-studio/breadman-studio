'use client'
// Vista Claroscuro del panel: submenú de botones a la izquierda + métricas visuales (sin tablas largas).
import { useMemo, useState } from 'react'
import type { ClaroscuroData, VentaBandcamp, RedResumen, PostRed, Regalias, Catalogo, RegaliasAgg } from '@/lib/claroscuro-sheet'

const C = {
  bg: '#111111', surface: '#1a1a1a', border: '#2a2a2a',
  text: '#e8e8e8', muted: '#777777', dim: '#4a4a4a',
  gold: '#A68A64', bc: '#1DA0C3', le: '#9B7BF0', redes: '#E4577E', ok: '#22c55e', warn: '#f59e0b', error: '#ef4444',
}
const PALETA = [C.bc, C.gold, C.le, C.redes, C.ok, C.warn]

const SUB = [
  { id: 'resumen', label: 'Resumen', color: C.gold, icon: '◐' },
  { id: 'bandcamp', label: 'Bandcamp', color: C.bc, icon: '◎' },
  { id: 'regalias', label: 'Regalías', color: C.ok, icon: '◆' },
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
      <div style={{ fontSize: 13, color, marginTop: 8, fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase' }}>{label}</div>
      {sub && <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function Card({ title, color, children, right }: { title: string; color: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 12, padding: 16, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

function Vacio({ texto }: { texto: string }) {
  return <div style={{ fontSize: 14, color: C.muted, padding: '8px 0' }}>{texto}</div>
}

function Barras({ datos, color, formato }: { datos: { label: string; valor: number }[]; color: string; formato: (n: number) => string }) {
  const max = Math.max(1, ...datos.map(d => d.valor))
  const pocos = datos.length <= 12
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: pocos ? 6 : 3, height: 150, paddingTop: 18 }}>
      {datos.map((d, i) => (
        <div key={i} title={`${d.label}: ${formato(d.valor)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', minWidth: 0 }}>
          {pocos && <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, whiteSpace: 'nowrap' }}>{d.valor > 0 ? formato(d.valor) : ''}</div>}
          <div style={{ width: '100%', maxWidth: 34, height: `${Math.max(2, (d.valor / max) * 100)}%`, background: d.valor > 0 ? `linear-gradient(180deg, ${color}, ${color}55)` : C.border, borderRadius: '5px 5px 2px 2px' }} />
          <div style={{ fontSize: 11, color: C.dim, marginTop: 6, whiteSpace: 'nowrap', visibility: pocos || i % 5 === 0 ? 'visible' : 'hidden' }}>{d.label}</div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14, marginBottom: 4 }}>
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
          <div key={i.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
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
  return <div style={{ background: C.surface, border: '1px solid ' + C.error + '55', borderRadius: 12, padding: 16, fontSize: 14, color: C.muted }}><b style={{ color: C.error }}>Sin conexión. </b>{texto}</div>
}

// ---------- lógica Bandcamp por período ----------
function serie(ventas: VentaBandcamp[], periodo: PeriodoId, campo: 'ventas' | 'neto') {
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
    if (!v.fecha) continue
    const c = cubos.find(x => x.key === v.fecha.slice(0, largo))
    if (c) c.valor += campo === 'ventas' ? 1 : v.neto
  }
  return cubos
}

function BandcampSeccion({ ventasTodas }: { ventasTodas: VentaBandcamp[] }) {
  const [periodo, setPeriodo] = useState<PeriodoId>('mes')
  const dias = PERIODOS.find(p => p.id === periodo)!.dias
  const ventas = useMemo(() => {
    const desde = Date.now() - dias * 86400000
    return ventasTodas.filter(v => v.fecha && new Date(v.fecha).getTime() >= desde)
  }, [ventasTodas, dias])

  const neto = ventas.reduce((a, v) => a + v.neto, 0)
  const porItem = contar(ventas, v => v.item)
  const top = porItem[0]
  const topNeto = top ? ventas.filter(v => v.item === top.label).reduce((a, v) => a + v.neto, 0) : 0
  const topTipo = top ? ventas.find(v => v.item === top.label)?.tipo : ''
  const tipos = contar(ventas, v => v.tipo)
  const releases = new Set(ventas.map(v => v.item)).size

  const grid = (min: number) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 })

  return (<>
    {/* Selector de período */}
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {PERIODOS.map(p => {
        const act = p.id === periodo
        return (
          <button key={p.id} onClick={() => setPeriodo(p.id)} style={{ padding: '8px 16px', borderRadius: 20, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: 14, fontWeight: 700, background: act ? C.bc : C.bc + '14', color: act ? '#111' : C.bc, border: '1px solid ' + (act ? C.bc : C.bc + '40') }}>
            {p.label}
          </button>
        )
      })}
    </div>

    <div style={grid(140)}>
      <Kpi color={C.bc} value={ventas.length} label="Ventas" />
      <Kpi color={C.ok} value={money(neto)} label="Neto" />
      <Kpi color={C.gold} value={releases} label="Títulos vendidos" sub="distintos" />
      <Kpi color={C.le} value={ventas.length ? money(neto / ventas.length) : '—'} label="Ticket promedio" />
    </div>

    {/* Lo más vendido del período */}
    <div style={{ background: `linear-gradient(120deg, ${C.gold}33, ${C.surface} 65%)`, border: '1px solid ' + C.gold + '55', borderRadius: 12, padding: 18, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ fontSize: 30, color: C.gold }}>★</div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 13, color: C.gold, fontWeight: 700, letterSpacing: '0.5px' }}>LO MÁS VENDIDO · {PERIODOS.find(p => p.id === periodo)!.label.toUpperCase()}</div>
        <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>{top ? top.label : 'Sin ventas en este período'}</div>
        {top && <div style={{ fontSize: 14, color: C.muted, marginTop: 3 }}>{top.valor} {top.valor === 1 ? 'venta' : 'ventas'} · {money(topNeto)} · {TIPO_LABEL[topTipo || ''] || topTipo}</div>}
      </div>
    </div>

    <Card title={periodo === 'anio' ? 'Ventas por mes' : 'Ventas por día'} color={C.bc}>
      <Barras datos={serie(ventas, periodo, 'ventas')} color={C.bc} formato={n => String(n)} />
    </Card>

    <div style={grid(260)}>
      <Card title="Qué compran" color={C.le}>
        <Segmentos items={tipos.map((t, i) => ({ label: TIPO_LABEL[t.label] || t.label, valor: t.valor, color: [C.bc, C.le, C.gold, C.redes][i % 4] }))} />
      </Card>
      <Card title="Más vendidos" color={C.gold}>
        <Ranking color={C.gold} items={porItem.slice(0, 5).map(i => ({ ...i, extra: `${i.valor}` }))} />
      </Card>
    </div>

    <div style={{ fontSize: 13, color: C.dim }}>Datos del agente de ventas (cada 6 horas). Las reproducciones (plays) no están disponibles en la API de Bandcamp.</div>
  </>)
}

// ---------- Redes (agente Meta Stats) ----------
function RedesSeccion({ redes, posts }: { redes: RedResumen[]; posts: PostRed[] }) {
  const grid = (min: number) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 })
  const colorRed = (r: string) => /insta/i.test(r) ? C.redes : C.bc
  const sinMetricasFinas = posts.length > 0 && posts.every(p => !p.alcance && !p.vistas)

  if (redes.length === 0 && posts.length === 0) return <Vacio texto="Todavía no hay datos de redes en la planilla." />

  return (<>
    <div style={grid(170)}>
      {redes.map(r => {
        const primero = r.historial[0]
        const delta = primero && r.historial.length > 1 ? r.seguidores - primero.seguidores : null
        return (
          <Kpi key={r.red} color={colorRed(r.red)} value={r.seguidores.toLocaleString('es-CL')} label={'Seguidores ' + r.red}
            sub={delta !== null ? (delta >= 0 ? '+' : '') + delta + ' desde ' + new Date(primero.fecha).toLocaleDateString('es-CL') : (r.publicaciones !== null ? r.publicaciones + ' publicaciones' : undefined)} />
        )
      })}
      {posts.length > 0 && (
        <Kpi color={C.gold} value={posts.reduce((a, p) => a + p.meGusta, 0)} label="Me gusta" sub={'últimos ' + posts.length + ' posts'} />
      )}
    </div>

    <Card title="Últimos posts" color={C.redes}>
      {posts.length === 0 ? <Vacio texto="Sin posts registrados." /> : (
        <div style={grid(200)}>
          {posts.slice(0, 10).map(p => (
            <a key={p.postId} href={p.link || undefined} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: C.text, background: C.bg, borderRadius: 10, padding: 12, borderLeft: '3px solid ' + colorRed(p.red), display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, color: C.dim }}>{p.fechaPost ? new Date(p.fechaPost).toLocaleDateString('es-CL') : ''}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: colorRed(p.red), background: colorRed(p.red) + '1f', padding: '1px 7px', borderRadius: 10 }}>{p.red}</span>
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 15 }}>
                <span>♥ <b>{p.meGusta}</b></span>
                <span>💬 <b>{p.comentarios}</b></span>
                {p.compartidos > 0 && <span>↗ <b>{p.compartidos}</b></span>}
              </div>
              {(p.alcance > 0 || p.vistas > 0) && (
                <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>{p.alcance > 0 ? 'Alcance ' + p.alcance : ''}{p.alcance > 0 && p.vistas > 0 ? ' · ' : ''}{p.vistas > 0 ? 'Vistas ' + p.vistas : ''}</div>
              )}
            </a>
          ))}
        </div>
      )}
    </Card>

    {sinMetricasFinas && (
      <div style={{ fontSize: 13, color: C.warn }}>Alcance, vistas y guardados aparecerán cuando Meta apruebe el App Review (permisos instagram_manage_insights y pages_read_user_content).</div>
    )}
  </>)
}


// ---------- Regalías (reportes mensuales del distribuidor, cargados por el bot) ----------
function usd(n: number) {
  return n >= 1 ? money(n) : '$' + n.toFixed(3).replace('.', ',')
}

function RegaliasSeccion({ regalias, catalogo }: { regalias: Regalias; catalogo: Catalogo }) {
  const [alcance, setAlcance] = useState<'ultimo' | 'total'>('ultimo')
  const grid = (min: number) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 })

  if (!regalias.total) {
    return (
      <Card title="Sin reportes cargados" color={C.ok}>
        <div style={{ fontSize: 15, color: C.muted, lineHeight: 1.6 }}>
          Envía por Telegram al bot del sello el CSV mensual de regalías (<b>royalties_…csv</b>) y el catálogo
          (<b>publishing_export.csv</b>). El bot los carga en la planilla y esta sección se arma sola.
        </div>
      </Card>
    )
  }

  const a = (alcance === 'ultimo' ? regalias.ultimo : regalias.total) as RegaliasAgg
  const ult = regalias.reportes[regalias.reportes.length - 1]
  const fechaRep = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-CL', { month: 'short', year: 'numeric' }).replace('.', '')
  const top = a.tracks[0]
  const tiendaTop = a.tiendas[0]
  const unidadesTop = a.tiendas.slice().sort((x, y) => (y.unidades || 0) - (x.unidades || 0))[0]
  const recientes = a.anioLanzamiento.filter(x => x.label >= String(new Date().getFullYear() - 1)).reduce((s, x) => s + x.valor, 0)

  return (<>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {([['ultimo', 'Último reporte · ' + fechaRep(ult.fecha)], ['total', 'Acumulado · ' + regalias.reportes.length + (regalias.reportes.length === 1 ? ' reporte' : ' reportes')]] as const).map(([id, label]) => {
        const act = id === alcance
        return (
          <button key={id} onClick={() => setAlcance(id)} style={{ padding: '8px 16px', borderRadius: 20, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontSize: 13, fontWeight: 700, background: act ? C.ok : C.ok + '14', color: act ? '#111' : C.ok, border: '1px solid ' + (act ? C.ok : C.ok + '40') }}>
            {label}
          </button>
        )
      })}
    </div>

    <div style={grid(150)}>
      <Kpi color={C.ok} value={money(a.usd)} label="Ingresos netos" sub={alcance === 'ultimo' ? 'reporte ' + fechaRep(ult.fecha) : 'todos los reportes'} />
      <Kpi color={C.le} value={a.unidades.toLocaleString('es-CL')} label="Reproducciones y ventas" />
      <Kpi color={C.gold} value={a.tiendas.length} label="Tiendas" sub={tiendaTop ? 'principal: ' + tiendaTop.label : ''} />
      <Kpi color={C.bc} value={a.paises.length === 12 ? '12+' : a.paises.length} label="Países" sub={a.paises[0] ? 'principal: ' + a.paises[0].label : ''} />
    </div>

    {top && (
      <div style={{ background: `linear-gradient(120deg, ${C.ok}2e, ${C.surface} 65%)`, border: '1px solid ' + C.ok + '55', borderRadius: 12, padding: 18, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 30, color: C.ok }}>★</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, color: C.ok, fontWeight: 700, letterSpacing: '0.5px' }}>TRACK QUE MÁS GENERÓ</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{top.label}</div>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 3 }}>{top.artista}{top.catalogo ? ' · ' + top.catalogo : ''} · {usd(top.valor)} · {top.unidades} {top.unidades === 1 ? 'unidad' : 'unidades'}</div>
        </div>
      </div>
    )}

    {regalias.reportes.length > 1 && (
      <Card title="Ingresos por reporte" color={C.ok}>
        <Barras datos={regalias.reportes.map(r => ({ label: fechaRep(r.fecha), valor: r.usd }))} color={C.ok} formato={n => money(n)} />
      </Card>
    )}

    <div style={grid(280)}>
      <Card title="Por tienda" color={C.gold}>
        <Ranking color={C.gold} items={a.tiendas.slice(0, 8).map(t => ({ label: t.label, valor: t.valor, extra: usd(t.valor) + ' · ' + (t.unidades || 0).toLocaleString('es-CL') + ' u.' }))} />
      </Card>
      <Card title="Por país" color={C.bc}>
        <Ranking color={C.bc} items={a.paises.slice(0, 8).map(p => ({ label: p.label, valor: p.valor, extra: usd(p.valor) }))} />
      </Card>
    </div>

    <Card title="Top tracks" color={C.le}>
      <div style={grid(220)}>
        {a.tracks.slice(0, 9).map((t, i) => (
          <div key={t.label + t.artista} style={{ background: C.bg, borderRadius: 10, padding: 12, borderLeft: '3px solid ' + C.le }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 13, color: C.dim }}>#{i + 1}</span>
              {t.catalogo && <span style={{ fontSize: 12, fontWeight: 700, color: C.le, background: C.le + '1f', padding: '1px 7px', borderRadius: 10 }}>{t.catalogo}</span>}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.label}>{t.label}</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{t.artista}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 14 }}>
              <span style={{ color: C.muted }}>{(t.unidades || 0).toLocaleString('es-CL')} u.</span>
              <span style={{ fontWeight: 800, color: C.ok }}>{usd(t.valor)}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>

    <div style={grid(280)}>
      <Card title="Por artista" color={C.redes}>
        <Ranking color={C.redes} items={a.artistas.slice(0, 8).map(x => ({ label: x.label, valor: x.valor, extra: usd(x.valor) }))} />
      </Card>
      <Card title="Por release" color={C.gold}>
        <Ranking color={C.gold} items={a.releases.slice(0, 8).map(x => ({ label: x.catalogo + ' · ' + x.label, valor: x.valor, extra: usd(x.valor) }))} />
      </Card>
    </div>

    <div style={grid(280)}>
      <Card title="Catálogo antiguo vs. nuevo (por año de lanzamiento)" color={C.le}>
        <Barras datos={a.anioLanzamiento} color={C.le} formato={n => money(n)} />
        <div style={{ fontSize: 13, color: C.muted, marginTop: 10 }}>
          Releases de {new Date().getFullYear() - 1} en adelante: {a.usd ? Math.round((recientes / a.usd) * 100) : 0}% de los ingresos.
        </div>
      </Card>
      <Card title="Tipo de ingreso" color={C.bc}>
        <Segmentos items={a.tipos.map((t, i) => ({ label: t.label, valor: t.valor, color: [C.le, C.gold, C.redes, C.bc][i % 4], extra: usd(t.valor) + ' · ' + (t.unidades || 0).toLocaleString('es-CL') + ' u.' }))} />
        {tiendaTop && unidadesTop && tiendaTop.label !== unidadesTop.label && (
          <div style={{ fontSize: 13, color: C.muted, marginTop: 12, lineHeight: 1.5 }}>
            {tiendaTop.label} deja {usd(tiendaTop.valor)} con {(tiendaTop.unidades || 0).toLocaleString('es-CL')} u.; {unidadesTop.label} suma {(unidadesTop.unidades || 0).toLocaleString('es-CL')} u. y deja {usd(unidadesTop.valor)}.
          </div>
        )}
      </Card>
    </div>

    {catalogo.releases > 0 && (
      <Card title="Catálogo" color={C.gold}>
        <div style={grid(150)}>
          <Kpi color={C.gold} value={catalogo.releases} label="Releases" sub={catalogo.tracks + ' tracks'} />
          <Kpi color={C.redes} value={catalogo.artistas} label="Artistas" />
          <Kpi color={C.ok} value={catalogo.conVentasUltimoReporte + ' / ' + catalogo.releases} label="Releases con ingresos" sub={'reporte ' + fechaRep(ult.fecha)} />
          <Kpi color={C.le} value={catalogo.ultimo ? catalogo.ultimo.codigo : '—'} label="Último lanzamiento" sub={catalogo.ultimo ? catalogo.ultimo.titulo : ''} />
        </div>
        <div style={{ marginTop: 14 }}>
          <Barras datos={catalogo.porAnio} color={C.gold} formato={n => String(n)} />
          <div style={{ fontSize: 13, color: C.dim, marginTop: 6 }}>Releases por año</div>
        </div>
      </Card>
    )}

    <div style={{ fontSize: 13, color: C.dim }}>Reportes de regalías del distribuidor (Pressology / Label Engine), cargados por el bot. Montos netos en USD. Algunos reportes incluyen ventas atrasadas de meses anteriores.</div>
  </>)
}

// ---------- vista principal ----------
export default function ClaroscuroView({ data }: { data: ClaroscuroData }) {
  const [sub, setSub] = useState('resumen')
  const ventasBc = data.ok ? data.ventas : []
  const ig = data.ok ? data.redes.find(r => /insta/i.test(r.red)) : undefined
  const st = data.ok ? data.statements : []
  const pendiente = data.ok ? data.resumen.porCobrarLabelEngine : 0
  const pagado = st.filter(s => /pagad/i.test(s.estado)).reduce((a, s) => a + s.monto, 0)

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
                fontFamily: 'Outfit, sans-serif', fontSize: 15, fontWeight: act ? 700 : 500, textAlign: 'left',
                background: act ? s.color : s.color + '14', color: act ? '#111' : s.color,
                border: '1px solid ' + (act ? s.color : s.color + '40'), transition: 'all .15s',
              }}>
              <span style={{ fontSize: 15 }}>{s.icon}</span>{s.label}
            </button>
          )
        })}
      </nav>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {sub === 'resumen' && (<>
          <div style={grid(150)}>
            <Kpi color={C.bc} value={data.ok ? ventasBc.length : '—'} label="Ventas Bandcamp" sub="registradas" />
            <Kpi color={C.ok} value={data.ok ? money(neto12) : '—'} label="Neto Bandcamp" sub="registrado" />
            <Kpi color={C.le} value={money(pendiente)} label="Por cobrar LE" sub={data.ok ? data.resumen.statementsPendientes + ' statements' : ''} />
            <Kpi color={C.redes} value={ig ? ig.seguidores.toLocaleString('es-CL') : '—'} label="Seguidores IG" sub={ig ? '@claroscuro.records' : 'sin datos'} />
          </div>
          <div style={grid(280)}>
            <Card title="Ingresos Bandcamp por mes" color={C.bc}>
              {data.ok ? <Barras datos={serie(ventasBc, 'anio', 'neto')} color={C.bc} formato={n => '$' + Math.round(n)} /> : <Vacio texto="Sin conexión con la planilla" />}
            </Card>
            <Card title="Statements Label Engine" color={C.le}>
              <Barras datos={st.slice(0, 12).reverse().map(s => ({ label: s.periodo.split(' ')[0], valor: s.monto }))} color={C.le} formato={n => '$' + Math.round(n)} />
            </Card>
          </div>
        </>)}

        {sub === 'bandcamp' && (data.ok ? <BandcampSeccion ventasTodas={ventasBc} /> : <Aviso texto={data.error || 'No se pudo leer la planilla'} />)}

        {sub === 'regalias' && (data.ok ? <RegaliasSeccion regalias={data.regalias} catalogo={data.catalogo} /> : <Aviso texto={data.error || 'No se pudo leer la planilla'} />)}

        {sub === 'labelengine' && (data.ok ? (<>
          <div style={grid(150)}>
            <Kpi color={C.le} value={money(pendiente)} label="Por cobrar" sub={data.resumen.statementsPendientes + ' statements pendientes'} />
            <Kpi color={C.ok} value={money(pagado)} label="Ya pagado" />
            <Kpi color={C.gold} value={money(pendiente + pagado)} label="Total generado" sub={st.length + ' statements'} />
          </div>

          {data.regalias.total ? (
            <div style={{ fontSize: 14, color: C.muted, background: C.ok + '12', border: '1px solid ' + C.ok + '40', borderRadius: 10, padding: '12px 14px' }}>
              El detalle por tienda, país, track y artista ahora se calcula solo desde los reportes del distribuidor: sección <b style={{ color: C.ok }}>Regalías</b>.
            </div>
          ) : (<>
          <Card title={'Revenue por tienda' + (data.tiendasTitulo.match(/\w+ \d{4}/) ? ' · ' + data.tiendasTitulo.match(/\w+ \d{4}/)![0] : '')} color={C.gold}
            right={<div style={{ display: 'flex', gap: 12, fontSize: 13, color: C.muted }}>
              <span><span style={{ color: C.gold }}>■</span> venta</span><span><span style={{ color: C.le }}>■</span> stream</span><span><span style={{ color: C.bc }}>■</span> suscripción</span>
            </div>}>
            {data.tiendas.length === 0 ? <Vacio texto="No hay tabla de tiendas en la planilla" /> : (<>
              <Ranking items={data.tiendas.filter(t => !/^total/i.test(t.tienda)).map(t => ({ label: t.tienda, valor: t.revenue, extra: `${money(t.revenue)} · ${tiendasSuma ? Math.round((t.revenue / tiendasSuma) * 100) : 0}%` }))}
                colores={data.tiendas.filter(t => !/^total/i.test(t.tienda)).map(t => colorTipo(t.tipo))} />
              {tiendasNoCalza && <div style={{ fontSize: 13, color: C.warn, marginTop: 12 }}>Ojo: las tiendas suman {money(tiendasSuma)}, pero el statement del mes es ${tituloTotal}. Los porcentajes son sobre {money(tiendasSuma)}.</div>}
            </>)}
          </Card>

          <Card title={'Top tracks' + (data.topTracksTitulo.match(/\w+ \d{4}/) ? ' · ' + data.topTracksTitulo.match(/\w+ \d{4}/)![0] : '')} color={C.le}>
            {data.topTracks.length === 0 ? <Vacio texto="No hay tabla de top tracks en la planilla" /> : (
              <div style={grid(190)}>
                {data.topTracks.slice(0, 9).map((t, i) => (
                  <div key={t.isrc + i} style={{ background: C.bg, borderRadius: 10, padding: 12, borderLeft: '3px solid ' + colorTipo(/beatport|itunes/i.test(t.tienda) ? 'venta' : 'stream') }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 13, color: C.dim }}>#{t.rank || i + 1}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.le, background: C.le + '1f', padding: '1px 7px', borderRadius: 10 }}>{t.tienda}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.titulo}</div>
                    <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{t.artista} · {t.pais}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 14 }}>
                      <span style={{ color: C.muted }}>{t.streams} {/beatport|itunes/i.test(t.tienda) ? 'ventas' : 'streams'}</span>
                      <span style={{ fontWeight: 800, color: C.ok }}>{money(t.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          </>)}

          <div style={grid(260)}>
            {!data.regalias.total && (
              <Card title="Países (top tracks)" color={C.ok}>
                <Ranking color={C.ok} items={contar(data.topTracks, t => t.pais, t => t.revenue).slice(0, 6).map(p => ({ ...p, extra: money(p.valor) }))} />
              </Card>
            )}
            <Card title="Statements por mes" color={C.le} right={
              <div style={{ display: 'flex', gap: 12, fontSize: 13, color: C.muted }}>
                <span><span style={{ color: C.le }}>■</span> pendiente</span><span><span style={{ color: C.ok }}>■</span> pagado</span>
              </div>}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 150, paddingTop: 10 }}>
                {st.slice().reverse().map(s => {
                  const max = Math.max(1, ...st.map(x => x.monto))
                  const col = /pagad/i.test(s.estado) ? C.ok : C.le
                  return (
                    <div key={s.periodo} title={`${s.periodo}: ${money(s.monto)} (${s.estado})`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', minWidth: 0 }}>
                      <div style={{ width: '100%', maxWidth: 26, height: `${Math.max(3, (s.monto / max) * 100)}%`, background: `linear-gradient(180deg, ${col}, ${col}55)`, borderRadius: '5px 5px 2px 2px' }} />
                      <div style={{ fontSize: 11, color: C.dim, marginTop: 5, whiteSpace: 'nowrap' }}>{s.periodo.split(' ')[0]}</div>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
          <div style={{ fontSize: 13, color: C.dim }}>Label Engine no tiene API: estos datos se cargan a mano en la planilla del sello. Top tracks y tiendas corresponden a un solo mes.</div>
        </>) : <Aviso texto={data.error || 'No se pudo leer la planilla'} />)}

        {sub === 'redes' && (data.ok ? <RedesSeccion redes={data.redes} posts={data.posts} /> : <Aviso texto={data.error || 'No se pudo leer la planilla'} />)}

        <div style={{ fontSize: 13, color: C.dim }}>
          Planilla Claroscuro Records — Ventas y Redes · leída {new Date(data.leidoEn).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' })}
        </div>
      </div>
    </div>
  )
}
