import { getJson } from './httpClient'

export async function convertFiatAmount(cantidad: number, monedaOrigen: string, monedaObjetivo: string): Promise<number> {
  const origen = encodeURIComponent(monedaOrigen)
  const objetivo = encodeURIComponent(monedaObjetivo)

  return getJson<number>(`/api/fiat/convertirCantidad/${cantidad}?monedaOrigen=${origen}&monedaObjetivo=${objetivo}`)
}
