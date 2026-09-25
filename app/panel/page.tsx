// Pagina del panel (servidor): lee la planilla de Claroscuro Records.
// Toda la data del sello (ventas Bandcamp, redes, Label Engine) vive en SU planilla;
// el panel solo la lee con la cuenta breadman-panel (solo lectura). No llama APIs externas en vivo.
// El middleware protege /panel, asi que estos datos solo los ve quien inicio sesion.

import { getClaroscuroData } from '@/lib/claroscuro-sheet'
import PanelClient from './PanelClient'

export const dynamic = 'force-dynamic'

export default async function PanelPage() {
  const claroscuro = await getClaroscuroData()
  return <PanelClient claroscuro={claroscuro} />
}
