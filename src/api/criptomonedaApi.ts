import { getJson } from './httpClient'
import type { Criptomoneda, CriptomonedaPrecio } from '../types/criptomoneda'

export async function fetchAllCriptomonedas(): Promise<Criptomoneda[]> {
  return getJson<Criptomoneda[]>('/api/criptomonedas')
}

export async function fetchCriptomonedaByName(nombre: string): Promise<Criptomoneda> {
  return getJson<Criptomoneda>(`/api/criptomonedas/${encodeURIComponent(nombre)}`)
}

export async function fetchAllSimbolos(): Promise<string[]> {
  return getJson<string[]>('/api/criptomonedas/simbolos')
}

export async function fetchAllNombres(): Promise<string[]> {
  return getJson<string[]>('/api/criptomonedas/nombres')
}

export async function fetchCriptomonedaHistory(
  simbolo: string,
  start: string, 
  end: string  
): Promise<CriptomonedaPrecio[]> {
  return getJson<CriptomonedaPrecio[]>(
    `/api/criptomonedas/${encodeURIComponent(simbolo)}/history?start=${start}&end=${end}`
  )
}

export async function fetchDirectCriptomonedaHistory(
  simbolo: string,
): Promise<CriptomonedaPrecio[]> {
  return getJson<CriptomonedaPrecio[]>(
    `/api/criptomonedas/${encodeURIComponent(simbolo)}/direct/history`
  )
}