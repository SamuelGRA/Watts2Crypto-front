import { getJson } from './httpClient'

export type MaintenanceStatus = {
  maintenanceMode: boolean
  message: string | null
  activeRefreshes: string[]
}

export async function fetchMaintenanceStatus(): Promise<MaintenanceStatus> {
  return getJson<MaintenanceStatus>('/api/maintenance')
}