'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Lead {
  fecha_creacion: string
  nombre: string
  telefono: string
  clase_lead: string
  etapa: string
  proyecto: string
  presupuesto: string
  motivo_perdida: string
  fecha_visita: string
  notas: string
}

const ETAPAS = [
  'Contacto Inicial','Calificacion','Ficha Enviada','En Nutricion',
  'Visita Agendada','Visita Realizada','Procompra','Compra Realizada',
  'Postventa','Estancado','Perdido'
]

const CLASE_COLOR: Record<string, string> = {
  'A': '#BA5130',
  'B': '#00931b',
  'C': '#395D46',
}

const C_VERDE = '#00931b'
const C_TERRA = '#BA5130'
const C_TEXTO = '#EAE5DB'
const C_FONDO = '#060f07'
const C_CARD = '#0d180e'
const C_BORDE = '#1a2e1b'

// Logo CCsmart usando SVG inline con los colores exactos de Figma
function LogoCCSmart({ size = 1 }: { size?: number }) {
  return (
    <svg width={Math.round(210 * size)} height={Math.round(58 * size)} viewBox="0 0 210 58" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Primera C — verde */}
      <text x="0" y="50" fontSize={Math.round(58 * size)} fontWeight="900" fontFamily="Outfit, system-ui, sans-serif" fill={C_VERDE} letterSpacing="-2">C</text>
      {/* Segunda C — terracota */}
      <text x={Math.round(34 * size)} y="50" fontSize={Math.round(58 * size)} fontWeight="900" fontFamily="Outfit, system-ui, sans-serif" fill={C_TERRA} letterSpacing="-2">C</text>
      {/* smart — verde */}
      <text x={Math.round(75 * size)} y="50" fontSize={Math.round(58 * size)} fontWeight="900" fontFamily="Outfit, system-ui, sans-serif" fill={C_VERDE} letterSpacing="-2">smart</text>
    </svg>
  )
}

export default function CCSmartPanel() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [vista, setVista] = useState<'embudo'|'lista'>('embudo')
  const [etapaActiva, setEtapaActiva] = useState<string|null>(null)

  useEffect(() => { fetchLeads() }, [])

  async function fetchLeads() {
    try {
      const res = await fetch('/api/sheet-data')
      if (res.status === 401) { router.push('/panel/login?next=/panel/ccsmart'); return }
      const data = await res.json()
      const rows = (data.data || []).slice(1)
      setLeads(rows
        .filter((r: string[]) => r[0] && r[3] !== 'Claroscuro Records')
        .map((r: string[]) => ({
          fecha_creacion: r[0] || '', nombre: r[1] || '', telefono: r[2] || '',
          clase_lead: r[3] || '', etapa: r[4] || '', proyecto: r[5] || '',
          presupuesto: r[7] || '', motivo_perdida: r[8] || '',
          fecha_visita: r[9] || '', notas: r[10] || '',
        })))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const filtrados = leads.filter(l =>
    !busqueda || l.nombre.toLowerCase().includes(busqueda.toLowerCase()) || l.telefono.includes(busqueda)
  )

  const porEtapa = (etapa: string) => filtrados.filter(l =>
    l.etapa === etapa || (etapa === 'Calificacion' && !l.etapa)
  )

  const metricas = [
    { label: 'TOTAL LEADS', val: leads.length, color: C_TEXTO },
    { label: 'CALIENTES', val: leads.filter(l => l.clase_lead === 'A').length, color: C_TERRA },
    { label: 'VISITAS', val: leads.filter(l => l.etapa === 'Visita Agendada').length, color: C_VERDE },
    { label: 'COMPRAS', val: leads.filter(l => l.etapa === 'Compra Realizada').length, color: '#22c55e' },
  ]

  const etapasFiltradas = etapaActiva ? [etapaActiva] : ETAPAS

  return (
    <div style={{ minHeight: '100vh', backgroundColor: C_FONDO, color: C_TEXTO, fontFamily: 'Outfit, system-ui, sans-serif' }}>

      {/* HEADER */}
      <div style={{ backgroundColor: '#091009', borderBottom: '1px solid ' + C_BORDE, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <LogoCCSmart size={0.55} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar lead..."
            style={{ backgroundColor: C_CARD, border: '1px solid ' + C_BORDE, color: C_TEXTO, padding: '7px 14px', borderRadius: '6px', fontSize: '15px', width: '180px', fontFamily: 'Outfit, sans-serif', outline: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: C_VERDE }} />
            <span style={{ fontSize: '13px', color: C_VERDE, letterSpacing: '1px', fontWeight: 700 }}>ONLINE</span>
          </div>
          <button onClick={() => fetch('/api/panel/logout', { method: 'POST' }).then(() => router.push('/panel/login'))}
            style={{ background: 'none', border: '1px solid ' + C_BORDE, color: '#555', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontFamily: 'Outfit, sans-serif', letterSpacing: '1px' }}>
            SALIR
          </button>
        </div>
      </div>

      {/* NAV */}
      <div style={{ backgroundColor: '#091009', borderBottom: '1px solid ' + C_BORDE, padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', minHeight: '44px' }}>
        <div style={{ display: 'flex', gap: '28px' }}>
          {[['embudo','EMBUDO'],['lista','LISTA']].map(([v, label]) => (
            <button key={v} onClick={() => setVista(v as 'embudo'|'lista')}
              style={{ background: 'none', border: 'none', color: vista === v ? C_TERRA : '#444', cursor: 'pointer', fontSize: '13px', letterSpacing: '2px', fontWeight: 700, fontFamily: 'Outfit, sans-serif', borderBottom: vista === v ? '2px solid ' + C_TERRA : '2px solid transparent', height: '44px', padding: '0 2px' }}>
              {label}
            </button>
          ))}
        </div>
        <button style={{ backgroundColor: C_TERRA, border: 'none', color: '#fff', padding: '7px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, fontFamily: 'Outfit, sans-serif', letterSpacing: '1px', margin: '4px 0' }}>
          + NUEVO LEAD
        </button>
      </div>

      {/* METRICAS */}
      <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
        {metricas.map((m, i) => (
          <div key={i} style={{ backgroundColor: C_CARD, border: '1px solid ' + C_BORDE, borderRadius: '10px', padding: '20px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '44px', fontWeight: 900, color: m.color, lineHeight: 1, marginBottom: '6px' }}>{m.val}</div>
            <div style={{ fontSize: '12px', letterSpacing: '2px', color: '#555', fontWeight: 700 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* TITULO + FILTRO ETAPA MOBILE */}
      <div style={{ padding: '0 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '13px', color: '#333', letterSpacing: '2px', marginBottom: '4px' }}>PIPELINE / DATOS EN VIVO</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: C_TEXTO }}>{vista === 'embudo' ? 'Embudo de leads' : 'Lista de leads'}</div>
        </div>
        {vista === 'embudo' && (
          <select value={etapaActiva || ''} onChange={e => setEtapaActiva(e.target.value || null)}
            style={{ backgroundColor: C_CARD, border: '1px solid ' + C_BORDE, color: C_TEXTO, padding: '8px 12px', borderRadius: '6px', fontSize: '15px', fontFamily: 'Outfit, sans-serif' }}>
            <option value="">Todas las etapas</option>
            {ETAPAS.map(e => <option key={e} value={e}>{e} ({porEtapa(e).length})</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px', color: '#333', fontSize: '13px', letterSpacing: '3px' }}>CARGANDO...</div>
      ) : vista === 'embudo' ? (
        /* VISTA EMBUDO — columnas apiladas en mobile */
        <div style={{ padding: '0 20px 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
          {etapasFiltradas.map((etapa, idx) => {
            const etapaLeads = porEtapa(etapa)
            const numEtapa = ETAPAS.indexOf(etapa) + 1
            return (
              <div key={etapa}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: '#333', fontWeight: 700 }}>{String(numEtapa).padStart(2,'0')} </span>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: C_TEXTO }}>{etapa}</span>
                  </div>
                  <span style={{ fontSize: '16px', fontWeight: 900, color: etapaLeads.length > 0 ? C_TERRA : '#333' }}>{etapaLeads.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {etapaLeads.length === 0 ? (
                    <div style={{ border: '1px dashed ' + C_BORDE, borderRadius: '8px', padding: '16px', textAlign: 'center', color: '#222', fontSize: '13px' }}>vacio</div>
                  ) : etapaLeads.map((lead, i) => (
                    <div key={i} style={{ backgroundColor: C_CARD, border: '1px solid ' + C_BORDE, borderRadius: '8px', padding: '14px', borderLeft: '3px solid ' + (CLASE_COLOR[lead.clase_lead] || C_BORDE) }}>
                      <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '6px', color: C_TEXTO }}>{lead.nombre || 'Sin nombre'}</div>
                      {lead.telefono && <div style={{ fontSize: '14px', color: '#555', marginBottom: '4px' }}>{lead.telefono}</div>}
                      {lead.notas && <div style={{ fontSize: '14px', color: '#444', marginBottom: '8px', lineHeight: '1.4' }}>{lead.notas.slice(0,70)}{lead.notas.length > 70 ? '...' : ''}</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#333' }}>
                        <span style={{ color: lead.clase_lead === 'A' ? C_TERRA : lead.clase_lead === 'B' ? C_VERDE : '#444', fontWeight: 700 }}>Clase {lead.clase_lead}</span>
                        <span>{lead.fecha_creacion ? new Date(lead.fecha_creacion).toLocaleDateString('es-CL') : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* VISTA LISTA */
        <div style={{ padding: '0 20px 32px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px', minWidth: '500px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid ' + C_BORDE }}>
                {['','Nombre','Telefono','Proyecto','Etapa','Fecha'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#444', fontSize: '12px', letterSpacing: '2px', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((lead, i) => (
                <tr key={i} style={{ borderBottom: '1px solid ' + C_BORDE }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: CLASE_COLOR[lead.clase_lead] || '#333' }} />
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: C_TEXTO }}>{lead.nombre || '-'}</td>
                  <td style={{ padding: '12px 14px', color: '#555' }}>{lead.telefono || '-'}</td>
                  <td style={{ padding: '12px 14px', color: C_VERDE }}>{lead.proyecto || '-'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: C_CARD, color: C_TEXTO, fontSize: '14px', border: '1px solid ' + C_BORDE }}>{lead.etapa || '-'}</span>
                  </td>
                  <td style={{ padding: '12px 14px', color: '#444', fontSize: '14px' }}>{lead.fecha_creacion ? new Date(lead.fecha_creacion).toLocaleDateString('es-CL') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ borderTop: '1px solid ' + C_BORDE, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#333', letterSpacing: '1px', flexWrap: 'wrap', gap: '8px' }}>
        <span>SMART CC / GESTION OPERATIVA</span>
        <span>© BREADMAN STUDIO IA</span>
      </div>
    </div>
  )
}