'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ClaroscuroData } from '@/lib/claroscuro-sheet'
import type { BandcampData } from '@/lib/bandcamp'
import BandcampBlock from './BandcampBlock'

const T = {
  bg: '#111111', surface: '#1a1a1a', surfaceHover: '#202020',
  border: '#2a2a2a', borderLight: '#333333',
  text: '#e8e8e8', textMuted: '#666666', textDim: '#444444',
  cc: '#395D46', claroscuro: '#A68A64', breadman: '#BA5130',
  ok: '#22c55e', warn: '#f59e0b', error: '#ef4444',
}

const AGENTS = [
  { id:'01', name:'Captacion', status:'standby' },
  { id:'02', name:'Ventas', status:'standby' },
  { id:'03', name:'Estrategia', status:'standby' },
  { id:'04', name:'Publicidad', status:'standby' },
  { id:'05', name:'Servicio', status:'standby' },
  { id:'06', name:'Contenido', status:'standby' },
  { id:'07', name:'Integracion', status:'standby' },
  { id:'08', name:'Analytics', status:'standby' },
  { id:'09', name:'Marketing', status:'standby' },
  { id:'10', name:'Retencion', status:'standby' },
  { id:'11', name:'Arte', status:'active' },
  { id:'12', name:'Operaciones', status:'standby' },
]

const ACTIVITY = [
  { label:'Pieza generada — Campo Capital', time:'hace 2h', color:T.cc },
  { label:'Lead nuevo — Campo Capital', time:'hace 3h', color:T.cc },
  { label:'Venta — Claroscuro Records', time:'hace 5h', color:T.claroscuro },
  { label:'Bot Telegram — respuesta enviada', time:'hace 6h', color:T.breadman },
]

function Badge({ label, color }: { label:string, color:string }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:'4px', border:'1px solid '+color+'44', backgroundColor:color+'14', color:color, fontSize:'10px', fontWeight:700, letterSpacing:'0.8px', whiteSpace:'nowrap' }}>
      {label}
    </span>
  )
}

function MetricCard({ value, label, sub }: { value:string|number, label:string, sub?:string }) {
  return (
    <div style={{ textAlign:'center', padding:'14px 8px' }}>
      <div style={{ fontSize:'28px', fontWeight:800, color:T.text, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:'10px', color:T.textMuted, marginTop:'4px', letterSpacing:'0.3px' }}>{label}</div>
      {sub && <div style={{ fontSize:'10px', color:T.textDim, marginTop:'2px' }}>{sub}</div>}
    </div>
  )
}

function usd(n: number) {
  return '$' + n.toFixed(2).replace('.', ',')
}

function horaCL(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit', timeZone:'America/Santiago' })
}

function Tabla({ titulo, columnas, filas, vacio }: { titulo:string, columnas:string[], filas:(string|number)[][], vacio:string }) {
  return (
    <div style={{ backgroundColor:T.surface, border:'1px solid '+T.border, borderRadius:'8px', marginBottom:'16px', overflow:'hidden' }}>
      <div style={{ padding:'12px 16px', borderBottom:'1px solid '+T.border }}>
        <span style={{ fontSize:'13px', fontWeight:600 }}>{titulo}</span>
      </div>
      {filas.length === 0 ? (
        <div style={{ padding:'14px 16px', fontSize:'12px', color:T.textMuted }}>{vacio}</div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
            <thead>
              <tr>
                {columnas.map(c => (
                  <th key={c} style={{ textAlign:'left', padding:'8px 16px', color:T.textDim, fontWeight:600, fontSize:'10px', letterSpacing:'0.8px', borderBottom:'1px solid '+T.border, whiteSpace:'nowrap' }}>{c.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={i}>
                  {f.map((v, j) => (
                    <td key={j} style={{ padding:'9px 16px', color: j === 0 ? T.text : T.textMuted, borderBottom: i < filas.length - 1 ? '1px solid '+T.border : 'none', whiteSpace: j === 0 ? 'normal' : 'nowrap' }}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ClaroscuroView({ data }: { data: ClaroscuroData }) {
  if (!data.ok) {
    return (
      <div style={{ backgroundColor:T.surface, border:'1px solid '+T.error+'60', borderRadius:'8px', padding:'16px', fontSize:'13px', lineHeight:1.6 }}>
        <div style={{ fontWeight:700, color:T.error, marginBottom:'6px' }}>No se pudo leer la planilla de Claroscuro</div>
        <div style={{ color:T.textMuted }}>Revisa que la planilla Panel Data este compartida como Lector con la cuenta de servicio de Google.</div>
        <div style={{ color:T.textDim, fontSize:'11px', marginTop:'8px' }}>Detalle: {data.error}</div>
      </div>
    )
  }
  const r = data.resumen
  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:'10px', marginBottom:'16px' }}>
        {[
          { v: r.ventasBandcamp, l: 'Ventas Bandcamp' },
          { v: usd(r.netoBandcamp), l: 'Neto Bandcamp' },
          { v: usd(r.porCobrarLabelEngine), l: 'Por cobrar Label Engine', s: r.statementsPendientes + ' statements' },
          { v: r.releases || '-', l: 'Releases (planilla)' },
        ].map(m => (
          <div key={m.l} style={{ backgroundColor:T.surface, border:'1px solid '+T.border, borderRadius:'8px' }}>
            <MetricCard value={m.v} label={m.l} sub={m.s} />
          </div>
        ))}
      </div>

      <Tabla
        titulo="Ultimas ventas Bandcamp"
        columnas={['item', 'fecha', 'tipo', 'neto']}
        filas={data.ventas.slice().reverse().slice(0, 10).map(v => [v.item, v.fecha, v.tipo, usd(v.neto)])}
        vacio="No hay ventas en la planilla."
      />

      <Tabla
        titulo="Statements Label Engine"
        columnas={['periodo', 'monto', 'estado']}
        filas={data.statements.map(st => [st.periodo, usd(st.monto), st.estado])}
        vacio="No hay statements en la planilla."
      />

      <Tabla
        titulo="Metricas del dashboard"
        columnas={['metrica', 'valor', 'periodo', 'fuente']}
        filas={data.metricas.map(m => [m.metrica, m.valor, m.periodo, m.fuente])}
        vacio="No hay metricas en la planilla."
      />

      <div style={{ fontSize:'11px', color:T.textDim, marginBottom:'80px' }}>
        Fuente: planilla Claroscuro Records {'\u2014'} Panel Data {'\u00b7'} leida a las {horaCL(data.leidoEn)}
      </div>
    </div>
  )
}

const NAV = [
  { id:'dashboard', label:'Inicio', icon:'⊞' },
  { id:'ccsmart', label:'CC Smart', icon:'◉', color:T.cc, badge:'ACTIVO', route:'/panel/ccsmart' },
  { id:'claroscuro', label:'Claroscuro', icon:'◉', color:T.claroscuro, badge:'ACTIVO' },
  { id:'austral', label:'Austral', icon:'○', color:T.textDim, badge:'PRONTO' },
  { id:'agentes', label:'Agentes', icon:'⬡', sub:'1/12' },
  { id:'disenos', label:'Disenos', icon:'◈' },
  { id:'config', label:'Config', icon:'⊙' },
]

export default function PanelClient({ claroscuro, bandcamp }: { claroscuro: ClaroscuroData, bandcamp: BandcampData }) {
  const router = useRouter()
  const [time, setTime] = useState('')
  const [seccion, setSeccion] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}))
    tick(); const id = setInterval(tick,60000); return () => clearInterval(id)
  }, [])

  function navTo(item: typeof NAV[0]) {
    if (item.route) { router.push(item.route); return }
    setSeccion(item.id); setMenuOpen(false)
  }

  return (
    <div style={{ minHeight:'100vh', backgroundColor:T.bg, color:T.text, fontFamily:'Outfit, system-ui, sans-serif', display:'flex', flexDirection:'column' }}>

      {/* TOPBAR */}
      <div style={{ height:'48px', borderBottom:'1px solid '+T.border, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', backgroundColor:T.bg, flexShrink:0, position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
          {/* Hamburger mobile */}
          <button onClick={() => setMenuOpen(!menuOpen)}
            style={{ display:'flex', flexDirection:'column', gap:'4px', background:'none', border:'none', cursor:'pointer', padding:'6px', marginRight:'4px' }}
            className="md-hide">
            {[0,1,2].map(i => <div key={i} style={{ width:'16px', height:'1.5px', backgroundColor:T.textMuted }} />)}
          </button>
          <span style={{ fontSize:'15px', fontWeight:800, color:T.text, letterSpacing:'-0.5px' }}>Breadman</span>
          <span style={{ fontSize:'15px', fontWeight:300, color:T.textMuted }}>Studio</span>
          <span style={{ color:T.border, margin:'0 4px' }}>/</span>
          <span style={{ fontSize:'12px', color:T.textMuted, display:'none' }} id="breadcrumb">Dashboard</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <span style={{ fontSize:'11px', color:T.textDim }}>{time}</span>
          <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
            <div style={{ width:'6px', height:'6px', borderRadius:'50%', backgroundColor:T.ok }} />
            <span style={{ fontSize:'10px', color:T.ok, fontWeight:700, letterSpacing:'0.5px' }}>ONLINE</span>
          </div>
          <button onClick={() => fetch('/api/panel/logout',{method:'POST'}).then(()=>router.push('/panel/login'))}
            style={{ background:'none', border:'1px solid '+T.border, color:T.textDim, padding:'4px 10px', borderRadius:'5px', cursor:'pointer', fontSize:'11px', fontFamily:'Outfit, sans-serif' }}>
            Salir
          </button>
        </div>
      </div>

      <div style={{ display:'flex', flex:1, overflow:'hidden', position:'relative' }}>

        {/* OVERLAY mobile */}
        {menuOpen && (
          <div onClick={() => setMenuOpen(false)}
            style={{ position:'fixed', inset:0, backgroundColor:'#000a', zIndex:40 }} />
        )}

        {/* SIDEBAR */}
        <div style={{
          width:'220px', borderRight:'1px solid '+T.border, padding:'12px 0',
          display:'flex', flexDirection:'column', flexShrink:0, backgroundColor:T.bg,
          position: menuOpen ? 'fixed' : 'relative',
          left: menuOpen ? 0 : undefined,
          top: menuOpen ? '48px' : undefined,
          bottom: menuOpen ? 0 : undefined,
          zIndex: menuOpen ? 50 : undefined,
          transform: menuOpen ? 'translateX(0)' : undefined,
        }}>
          <div style={{ padding:'0 14px 12px', borderBottom:'1px solid '+T.border, marginBottom:'6px' }}>
            <div style={{ fontSize:'10px', color:T.textDim, letterSpacing:'1.5px', fontWeight:700 }}>ESPACIOS</div>
          </div>
          {NAV.map(item => (
            <button key={item.id} onClick={() => navTo(item)}
              style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'8px 14px', background:'none', border:'none', cursor:'pointer',
                color: seccion===item.id ? T.text : T.textMuted,
                backgroundColor: seccion===item.id ? T.surface : 'transparent',
                borderLeft: seccion===item.id ? '2px solid '+T.breadman : '2px solid transparent',
                fontSize:'13px', fontFamily:'Outfit, sans-serif', textAlign:'left', width:'100%',
              }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                {item.color
                  ? <div style={{ width:'6px', height:'6px', borderRadius:'50%', backgroundColor:item.badge==='ACTIVO'?item.color:T.textDim, flexShrink:0 }} />
                  : <span style={{ fontSize:'11px', color:T.textDim }}>{item.icon}</span>
                }
                <div>
                  <div style={{ fontWeight:seccion===item.id?600:400 }}>{item.label}</div>
                  {item.sub && <div style={{ fontSize:'10px', color:T.textDim }}>{item.sub}</div>}
                </div>
              </div>
              {item.badge && (
                <span style={{ fontSize:'9px', fontWeight:700, padding:'1px 6px', borderRadius:'3px',
                  backgroundColor:item.badge==='ACTIVO'?(item.color+'20'):T.surface,
                  color:item.badge==='ACTIVO'?item.color:T.textDim,
                  border:'1px solid '+(item.badge==='ACTIVO'?item.color+'40':T.border) }}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
          <div style={{ flex:1 }} />
          <div style={{ padding:'12px 14px', borderTop:'1px solid '+T.border, display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'28px', height:'28px', borderRadius:'50%', backgroundColor:T.breadman+'20', border:'1px solid '+T.breadman+'40', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:700, color:T.breadman, flexShrink:0 }}>F</div>
            <div>
              <div style={{ fontSize:'12px', fontWeight:600, color:T.text }}>Fernando</div>
              <div style={{ fontSize:'10px', color:T.textDim }}>Director</div>
            </div>
          </div>
        </div>

        {/* MAIN */}
        <div style={{ flex:1, overflow:'auto', padding:'20px 16px' }}>

          <div style={{ marginBottom:'20px' }}>
            <div style={{ fontSize:'18px', fontWeight:700 }}>{seccion === 'claroscuro' ? 'Claroscuro Records' : 'Dashboard'}</div>
            <div style={{ fontSize:'12px', color:T.textMuted, marginTop:'2px' }}>{seccion === 'claroscuro' ? 'Sello electronico — datos de la planilla Panel Data' : 'Vision general — Breadman Studio'}</div>
          </div>

          {seccion === 'claroscuro' ? <><ClaroscuroView data={claroscuro} /><BandcampBlock data={bandcamp} /></> : (<>

          {/* CLIENTES */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'14px', marginBottom:'20px' }}>

            {/* Campo Capital */}
            <div style={{ backgroundColor:T.surface, border:'1px solid '+T.border, borderRadius:'8px', overflow:'hidden' }}>
              <div style={{ padding:'14px 16px', borderBottom:'1px solid '+T.border, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ width:'3px', height:'30px', borderRadius:'2px', backgroundColor:T.cc }} />
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:700 }}>Campo Capital</div>
                    <div style={{ fontSize:'11px', color:T.textMuted }}>Terrenos certificados</div>
                  </div>
                </div>
                <Badge label="CC SMART" color={T.cc} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', borderBottom:'1px solid '+T.border }}>
                <MetricCard value={0} label="Leads semana" />
                <div style={{ borderLeft:'1px solid '+T.border, borderRight:'1px solid '+T.border }}>
                  <MetricCard value={0} label="Calientes" />
                </div>
                <MetricCard value={0} label="Visitas" />
              </div>
              <div style={{ padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:'11px', color:T.textDim }}>Ultima pieza: hace 2h</span>
                <button onClick={() => router.push('/panel/ccsmart')}
                  style={{ background:'none', border:'1px solid '+T.cc+'60', color:T.cc, padding:'4px 12px', borderRadius:'5px', cursor:'pointer', fontSize:'11px', fontFamily:'Outfit, sans-serif', fontWeight:600 }}>
                  Ver →
                </button>
              </div>
            </div>

            {/* Claroscuro */}
            <div style={{ backgroundColor:T.surface, border:'1px solid '+T.border, borderRadius:'8px', overflow:'hidden' }}>
              <div style={{ padding:'14px 16px', borderBottom:'1px solid '+T.border, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ width:'3px', height:'30px', borderRadius:'2px', backgroundColor:T.claroscuro }} />
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:700 }}>Claroscuro Records</div>
                    <div style={{ fontSize:'11px', color:T.textMuted }}>Sello electronico</div>
                  </div>
                </div>
                <Badge label="SELLO" color={T.claroscuro} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', borderBottom:'1px solid '+T.border }}>
                <MetricCard value={claroscuro.ok ? claroscuro.resumen.ventasBandcamp : '-'} label="Ventas Bandcamp" />
                <div style={{ borderLeft:'1px solid '+T.border, borderRight:'1px solid '+T.border }}>
                  <MetricCard value={claroscuro.ok ? usd(claroscuro.resumen.netoBandcamp) : '-'} label="Neto Bandcamp" />
                </div>
                <MetricCard value={claroscuro.ok ? usd(claroscuro.resumen.porCobrarLabelEngine) : '-'} label="Por cobrar LE" />
              </div>
              <div style={{ padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:'11px', color: claroscuro.ok ? T.textDim : T.error }}>
                  {claroscuro.ok ? 'Planilla Panel Data · ' + horaCL(claroscuro.leidoEn) : 'Sin conexion con la planilla'}
                </span>
                <button onClick={() => setSeccion('claroscuro')} style={{ background:'none', border:'1px solid '+T.claroscuro+'60', color:T.claroscuro, padding:'4px 12px', borderRadius:'5px', cursor:'pointer', fontSize:'11px', fontFamily:'Outfit, sans-serif', fontWeight:600 }}>
                  Ver →
                </button>
              </div>
            </div>

          </div>

          {/* AGENTES */}
          <div style={{ backgroundColor:T.surface, border:'1px solid '+T.border, borderRadius:'8px', marginBottom:'16px' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid '+T.border, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <span style={{ fontSize:'13px', fontWeight:600 }}>Agentes IA</span>
                <span style={{ fontSize:'11px', color:T.textMuted, marginLeft:'8px' }}>1 de 12 activos</span>
              </div>
              <Badge label="ECOSISTEMA" color={T.breadman} />
            </div>
            <div style={{ padding:'14px 16px', display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px, 1fr))', gap:'8px' }}>
              {AGENTS.map(a => (
                <div key={a.id} style={{ backgroundColor:T.bg, border:'1px solid '+(a.status==='active'?T.ok+'40':T.border), borderRadius:'6px', padding:'8px 10px', display:'flex', alignItems:'center', gap:'7px' }}>
                  <div style={{ width:'5px', height:'5px', borderRadius:'50%', backgroundColor:a.status==='active'?T.ok:T.textDim, flexShrink:0 }} />
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:'10px', color:T.textDim }}>{a.id}</div>
                    <div style={{ fontSize:'11px', fontWeight:600, color:a.status==='active'?T.text:T.textMuted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ACTIVIDAD */}
          <div style={{ backgroundColor:T.surface, border:'1px solid '+T.border, borderRadius:'8px' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid '+T.border }}>
              <span style={{ fontSize:'13px', fontWeight:600 }}>Actividad reciente</span>
            </div>
            {ACTIVITY.map((a, i) => (
              <div key={i} style={{ padding:'11px 16px', borderBottom:i<ACTIVITY.length-1?'1px solid '+T.border:'none', display:'flex', alignItems:'center', gap:'12px' }}>
                <div style={{ width:'5px', height:'5px', borderRadius:'50%', backgroundColor:a.color, flexShrink:0 }} />
                <span style={{ fontSize:'13px', color:T.text, flex:1 }}>{a.label}</span>
                <span style={{ fontSize:'11px', color:T.textDim, whiteSpace:'nowrap' }}>{a.time}</span>
              </div>
            ))}
          </div>

          </>)}

          {/* BOTTOM NAV MOBILE */}
          <div style={{ display:'none' }} id="mobile-nav" />

        </div>
      </div>

      {/* BARRA INFERIOR MOBILE */}
      <style>{
        '@media (max-width: 640px) { #mobile-nav { display: block !important; } }'
      }</style>
      <div id="mobile-nav" style={{ position:'fixed', bottom:0, left:0, right:0, height:'60px', backgroundColor:T.surface, borderTop:'1px solid '+T.border, display:'flex', alignItems:'center', justifyContent:'space-around', zIndex:50 }}>
        {[
          { id:'dashboard', label:'Inicio', icon:'⊞' },
          { id:'ccsmart', label:'CC Smart', icon:'◉', color:T.cc, route:'/panel/ccsmart' },
          { id:'claroscuro', label:'Claroscuro', icon:'◉', color:T.claroscuro },
          { id:'agentes', label:'Agentes', icon:'⬡' },
          { id:'config', label:'Config', icon:'⊙' },
        ].map(item => (
          <button key={item.id} onClick={() => item.route ? router.push(item.route) : setSeccion(item.id)}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', background:'none', border:'none', cursor:'pointer', padding:'8px 12px', flex:1, fontFamily:'Outfit, sans-serif' }}>
            <span style={{ fontSize:'16px', color:seccion===item.id?(item.color||T.breadman):T.textDim }}>{item.icon}</span>
            <span style={{ fontSize:'9px', letterSpacing:'0.3px', color:seccion===item.id?(item.color||T.text):T.textDim, fontWeight:seccion===item.id?700:400 }}>{item.label}</span>
          </button>
        ))}
      </div>

    </div>
  )
}
