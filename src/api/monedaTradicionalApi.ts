import { getJson } from './httpClient'
import type { MonedaTradicional } from '../types/monedaTradicional'

export async function fetchAllFiatRates(): Promise<MonedaTradicional[]> {
  return getJson<MonedaTradicional[]>('/api/fiat')
}

export async function fetchFiatHistory(
  monedaBase: string,
  monedaObjetivo: string,
  limitDate: Date
): Promise<MonedaTradicional[]> {
  const today = new Date().toISOString().split('T')[0]
  const limit = limitDate.toISOString().split('T')[0]
  return getJson<MonedaTradicional[]>(
    `/api/fiat/historico/${encodeURIComponent(monedaBase)}/${encodeURIComponent(monedaObjetivo)}?start=${limit}&end=${today}`
  )
}

export async function convertFiatAmount(cantidad: number, monedaOrigen: string, monedaObjetivo: string): Promise<number> {
  const origen = encodeURIComponent(monedaOrigen)
  const objetivo = encodeURIComponent(monedaObjetivo)

  return getJson<number>(`/api/fiat/convertirCantidad/${cantidad}?monedaOrigen=${origen}&monedaObjetivo=${objetivo}`)
}

export async function fetchAllSymbols(): Promise<string[]> {
  return getJson<string[]>(`api/fiat/simbolos`)
}
