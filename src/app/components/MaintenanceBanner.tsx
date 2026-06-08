import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { fetchMaintenanceStatus } from '../../api/maintenanceApi'
import '../styles/maintenance-banner.css'

type MaintenanceRoute = '/' | '/hardware' | '/software' | '/electricity' | '/currencies' | '/pools'

const routeMaintenanceMap: Record<MaintenanceRoute, string[]> = {
  '/': [
    'refresh-fiat',
    'refresh-fiat-symbols',
    'refresh-criptomonedas',
    'refresh-gpus',
    'refresh-asics',
    'refresh-cpus',
    'refresh-metricas-minado',
    'refresh-pools',
    'refresh-software',
    'refresh-electricidad',
  ],
  '/hardware': ['refresh-gpus', 'refresh-asics', 'refresh-cpus'],
  '/software': ['refresh-software'],
  '/electricity': ['refresh-electricidad'],
  '/currencies': ['refresh-fiat', 'refresh-fiat-symbols'],
  '/pools': ['refresh-pools'],
}

function getRouteKey(pathname: string): MaintenanceRoute | null {
  if (pathname === '/') {
    return '/'
  }

  if (pathname.startsWith('/hardware')) {
    return '/hardware'
  }

  if (pathname.startsWith('/software')) {
    return '/software'
  }

  if (pathname.startsWith('/electricity')) {
    return '/electricity'
  }

  if (pathname.startsWith('/currencies')) {
    return '/currencies'
  }

  if (pathname.startsWith('/pools')) {
    return '/pools'
  }

  return null
}

export function MaintenanceBanner() {
  const location = useLocation()
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [activeRefreshes, setActiveRefreshes] = useState<string[]>([])

  useEffect(() => {
    let isCancelled = false

    const loadStatus = async () => {
      try {
        const status = await fetchMaintenanceStatus()

        if (!isCancelled) {
          const routeKey = getRouteKey(location.pathname)
          const routeRefreshes = routeKey ? routeMaintenanceMap[routeKey] : []
          const shouldShowBanner =
            status.maintenanceMode &&
            routeRefreshes.length > 0 &&
            status.activeRefreshes.some((refresh) => routeRefreshes.includes(refresh))

          setIsMaintenanceMode(shouldShowBanner)
          setMessage(status.message)
          setActiveRefreshes(status.activeRefreshes)
        }
      } catch {
        if (!isCancelled) {
          setIsMaintenanceMode(false)
          setMessage(null)
          setActiveRefreshes([])
        }
      }
    }

    loadStatus()
    const intervalId = window.setInterval(loadStatus, 15000)

    return () => {
      isCancelled = true
      window.clearInterval(intervalId)
    }
  }, [location.pathname])

  if (!isMaintenanceMode) {
    return null
  }

  const routeKey = getRouteKey(location.pathname)
  const isCalculator = routeKey === '/'
  const hasFiatMaintenance = activeRefreshes.some((refresh) =>
    ['refresh-fiat', 'refresh-fiat-symbols'].includes(refresh),
  )

  return (
    <div className="maintenance-banner" role="alert" aria-live="polite">
      <div className="maintenance-banner__card card">
        <div className="maintenance-banner__icon">
          <AlertTriangle size={22} aria-hidden="true" />
        </div>

        <div className="maintenance-banner__content">
          <h2>
            {isCalculator && hasFiatMaintenance
              ? 'Estamos actualizando los datos necesarios para el cálculo'
              : 'Estamos actualizando nuestros datos'}
          </h2>
          <p>{message ?? 'Intente acceder más tarde.'}</p>
          <div className="maintenance-banner__status">
            <RefreshCw size={16} className="maintenance-banner__spin" aria-hidden="true" />
            <span>La aplicación volverá a estar disponible en cuanto finalice la actualización.</span>
          </div>
        </div>
      </div>
    </div>
  )
}