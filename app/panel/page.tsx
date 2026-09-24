// Pagina del panel (servidor): lee la planilla de Claroscuro y las ventas de Bandcamp.
// Se ejecuta en el servidor en cada visita; el middleware protege /panel,
// asi que estos datos solo los ve quien inicio sesion.

import { getClaroscuroData } from '@/lib/claroscuro-sheet'
import { getBandcampData } from '@/lib/bandcamp'
import PanelClient from './PanelClient'

export const dynamic = 'force-dynamic'

export default async function PanelPage() {
  const [claroscuro, bandcamp] = await Promise.all([getClaroscuroData(), getBandcampData()])
  return <PanelClient claroscuro={claroscuro} bandcamp={bandcamp} />
}
