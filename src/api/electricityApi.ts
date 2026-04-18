import { getJson } from './httpClient'
import type { ElectricityItem } from '../types/electricity'

type RawElectricity = {
  zona?: string
  fecha?: string
  precioMwh?: number
}

function toElectricityItem(raw: RawElectricity): ElectricityItem {
  return {
    zona: raw.zona?.trim() || 'N/D',
    fecha: raw.fecha || '',
    precioMwh: raw.precioMwh ?? 0,
  }
}

export async function fetchElectricity(): Promise<ElectricityItem[]> {
  const items = await getJson<RawElectricity[]>('/api/electricidad')
  return items.map(toElectricityItem)
}

export async function fetchElectricityByZoneAnddateRange(limitDate: Date, zona: string): Promise<ElectricityItem[]> {
  const today = new Date().toISOString()
  const limit = limitDate.toISOString()
  const items = await getJson<RawElectricity[]>(`/api/electricidad/${encodeURIComponent(zona)}/historico?start=${limit}&end=${today}`)
  return items.map(toElectricityItem)
}

export async function fetchElectricityByDirectZone(zona: string): Promise<ElectricityItem[]> {
  const items = await getJson<RawElectricity[]>(`/api/electricidad/${encodeURIComponent(zona)}/busquedaDirecta`)
  return items.map(toElectricityItem)
}

export async function fetchPersistedElectricityZones(): Promise<string[]> {
  return getJson<string[]>('/api/electricidad/zonas')
}

export async function fetchDirectSearchElectricityZones(): Promise<string[]> {
  return getJson<string[]>('/api/electricidad/zonasDirecta')
}
