// Pagina del panel (servidor): lee la planilla de Claroscuro y se la pasa al panel.
// Se ejecuta en el servidor en cada visita, asi los numeros siempre estan al dia.
// El middleware ya protege /panel, asi que estos datos solo los ve quien inicio sesion.

import { getClaroscuroData } from '@/lib/claroscuro-sheet'
import PanelClient from './PanelClient'

export const dynamic = 'force-dynamic'

export default async function PanelPage() {
  const claroscuro = await getClaroscuroData()
  return <PanelClient claroscuro={claroscuro} />
}
