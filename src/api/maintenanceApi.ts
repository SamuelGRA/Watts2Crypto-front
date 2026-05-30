import { getJson } from './httpClient'

export type MaintenanceStatus = {
  maintenanceMode: boolean
  message: string | null
  activeRefreshes: string[]
  directCryptoAvailable: boolean
}

export async function fetchMaintenanceStatus(): Promise<MaintenanceStatus> {
  return getJson<MaintenanceStatus>('/api/maintenance')
}