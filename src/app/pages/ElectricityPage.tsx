import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { BarChart3, LineChart, Search, ChevronDown, Loader2 } from 'lucide-react'
import '../styles/electricity-page.css'
import '../styles/info-note.css'
import {
  fetchElectricityByDirectZone,
  fetchDirectSearchElectricityZones,
  fetchElectricity,
  fetchElectricityByZoneAnddateRange,
  fetchPersistedElectricityZones,
} from '../../api/electricityApi'
import { convertFiatAmount } from '../../api/monedaTradicionalApi'
import type { ElectricityItem } from '../../types/electricity'
import { InfoNote } from '../components/InfoNote'

type LineSeriesPoint = {
  timestamp: number
  label: string
  value: number
}

type LineSeries = {
  zone: string
  label: string
  color: string
  points: LineSeriesPoint[]
}

type BarSeries = {
  zone: string
  label: string
  color: string
  values: Array<number | null>
}

type BarChartData = {
  categories: string[]
  series: BarSeries[]
}

const LINE_SERIES_COLORS = ['#33d39f', '#4f7cff', '#f59e0b', '#ef4444']
const MAX_CHART_ZONES = 4
const COMPARISON_SLOTS = MAX_CHART_ZONES - 1
const CONVERTIBLE_CURRENCIES = ['USD', 'GBP', 'JPY', 'CNY', 'RUB', 'AUD', 'CAD', 'CHF', 'HKD', 'BRL'] as const
type DisplayCurrency = 'EUR' | (typeof CONVERTIBLE_CURRENCIES)[number]

const ZONE_DISPLAY_LABELS: Record<string, string> = {
  AT: 'Austria (AT)',
  BE: 'Bélgica (BE)',
  BG: 'Bulgaria (BG)',
  CH: 'Suiza (CH)',
  CZ: 'República Checa (CZ)',
  'DE-LU': 'Alemania-Luxemburgo (DE-LU)',
  'DE-AT-LU': 'Alemania-Austria-Luxemburgo (DE-AT-LU)',
  DK1: 'Dinamarca 1 (DK1)',
  DK2: 'Dinamarca 2 (DK2)',
  EE: 'Estonia (EE)',
  ES: 'España (ES)',
  FI: 'Finlandia (FI)',
  FR: 'Francia (FR)',
  GR: 'Grecia (GR)',
  HR: 'Croacia (HR)',
  HU: 'Hungría (HU)',
  'IT-Calabria': 'Italia Calabria (IT-Calabria)',
  'IT-Centre-North': 'Italia Centro-Norte (IT-Centre-North)',
  'IT-CENTRE-SOUTH': 'Italia Centro-Sur (IT-Centre-South)',
  'IT-North': 'Italia Norte (IT-North)',
  'IT-SACOAC': 'Italia SACOAC (IT-SACOAC)',
  'IT-SACODC': 'Italia SACODC (IT-SACODC)',
  'IT-Sardinia': 'Italia Cerdeña (IT-Sardinia)',
  'IT-Sicily': 'Italia Sicilia (IT-Sicily)',
  'IT-South': 'Italia Sur (IT-South)',
  LT: 'Lituania (LT)',
  LV: 'Letonia (LV)',
  ME: 'Montenegro (ME)',
  NL: 'Países Bajos (NL)',
  NO1: 'Noruega 1 (NO1)',
  NO2: 'Noruega 2 (NO2)',
  NO2NSL: 'Noruega 2 NSL (NO2NSL)',
  NO3: 'Noruega 3 (NO3)',
  NO4: 'Noruega 4 (NO4)',
  NO5: 'Noruega 5 (NO5)',
  PL: 'Polonia (PL)',
  PT: 'Portugal (PT)',
  RO: 'Rumanía (RO)',
  RS: 'Serbia (RS)',
  SE1: 'Suecia 1 (SE1)',
  SE2: 'Suecia 2 (SE2)',
  SE3: 'Suecia 3 (SE3)',
  SE4: 'Suecia 4 (SE4)',
  SI: 'Eslovenia (SI)',
  SK: 'Eslovaquia (SK)',
}

const ZONE_DISPLAY_LABELS_UPPER = Object.fromEntries(
  Object.entries(ZONE_DISPLAY_LABELS).map(([zone, label]) => [zone.toUpperCase(), label]),
) as Record<string, string>

function formatNumber(value: number, minimumFractionDigits: number, maximumFractionDigits: number): string {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping: true,
  }).format(value)
}

function formatPriceMwh(value: number, currency: DisplayCurrency): string {
  return `${formatNumber(value, 2, 2)} ${currency}/MWh`
}

function zoneLabel(value: string): string {
  const normalized = value.trim().toUpperCase()

  return ZONE_DISPLAY_LABELS_UPPER[normalized] ?? normalized
}

function toTimestamp(item: ElectricityItem): number {
  return Date.parse(item.fecha)
}

function buildRangeWindow(rangeDays: 30 | 90 | 180 | 365): { start: Date; end: Date } {
  const end = new Date()
  end.setHours(23, 59, 59, 999)

  const start = new Date(end)
  start.setDate(start.getDate() - rangeDays)
  start.setHours(0, 0, 0, 0)

  return { start, end }
}

function filterItemsByRange(items: ElectricityItem[], rangeDays: 30 | 90 | 180 | 365): ElectricityItem[] {
  const { start, end } = buildRangeWindow(rangeDays)
  const startTimestamp = start.getTime()
  const endTimestamp = end.getTime()

  return items.filter((item) => {
    const timestamp = toTimestamp(item)
    return Number.isFinite(timestamp) && timestamp >= startTimestamp && timestamp <= endTimestamp
  })
}

function toShortDateLabel(isoDate: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return 'N/D'

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(date)
}

function formatTooltipDate(timestamp: number): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'N/D'

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(date)
}

function normalizeZoneCacheKey(zone: string): string {
  return zone.trim().toUpperCase()
}

function getCachedExternalElectricityZones(): Record<string, ElectricityItem[]> {
  try {
    const raw = sessionStorage.getItem('externalElectricityZoneCache')
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function setCachedExternalElectricityZones(cache: Record<string, ElectricityItem[]>): void {
  try {
    sessionStorage.setItem('externalElectricityZoneCache', JSON.stringify(cache))
  } catch {
  }
}

function toMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  if (Number.isNaN(date.getTime())) return monthKey

  return new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit' }).format(date)
}

function SimpleLineChart({ series, caption }: { series: LineSeries[]; caption: string }) {
  const width = 900
  const height = 280
  const padding = { top: 20, right: 50, bottom: 46, left: 42 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const [hoveredPoints, setHoveredPoints] = useState<Array<{
    zone: string
    label: string
    color: string
    value: number
    x: number
    y: number
    timestamp: number
  }>>([])
  const [hoverClient, setHoverClient] = useState<{ clientX: number; clientY: number } | null>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const allPoints = series.flatMap((zoneSeries) => zoneSeries.points)

  if (series.length === 0 || allPoints.length < 2) {
    return <p className="electricity-chart__empty">No hay datos suficientes para dibujar la evolución.</p>
  }

  const values = allPoints.map((point) => point.value)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const valueSpan = Math.max(maxValue - minValue, 1)
  const timestamps = allPoints.map((point) => point.timestamp)
  const minTimestamp = Math.min(...timestamps)
  const maxTimestamp = Math.max(...timestamps)
  const timestampSpan = Math.max(maxTimestamp - minTimestamp, 1)

  const xFromTimestamp = (timestamp: number) => {
    const ratio = (timestamp - minTimestamp) / timestampSpan
    return padding.left + ratio * innerWidth
  }

  const yTicks = 4
  const yLabels = Array.from({ length: yTicks + 1 }, (_, index) => {
    const ratio = index / yTicks
    const value = maxValue - ratio * valueSpan
    const y = padding.top + ratio * innerHeight
    return { value, y }
  })

  const xTicks = [0, 1, 2, 3].map((step) => {
    const ratio = step / 3
    const timestamp = minTimestamp + ratio * timestampSpan
    const x = padding.left + ratio * innerWidth
    const label = toShortDateLabel(new Date(timestamp).toISOString())
    return { x, label, isFirst: step === 0, isLast: step === 3 }
  })

  const handleMouseMove = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return

    const rect = svgRef.current.getBoundingClientRect()
    const mouseX = (event.clientX - rect.left) * (width / rect.width)
    const mouseY = (event.clientY - rect.top) * (height / rect.height)

    if (mouseX < padding.left || mouseX > width - padding.right || mouseY < padding.top || mouseY > height - padding.bottom) {
      setHoveredPoints([])
      setHoverClient(null)
      setHoverX(null)
      return
    }

    const timestampAtMouse = minTimestamp + ((mouseX - padding.left) / innerWidth) * timestampSpan
    let minDistance = Infinity
    let targetTimestamp: number | null = null
    for (const zoneSeries of series) {
      for (const point of zoneSeries.points) {
        const distance = Math.abs(point.timestamp - timestampAtMouse)
        if (distance < minDistance) {
          minDistance = distance
          targetTimestamp = point.timestamp
        }
      }
    }

    if (targetTimestamp == null) {
      setHoveredPoints([])
      setHoverClient(null)
      setHoverX(null)
      return
    }

    // Enceuntra el punto más cercano para una fecha
    const pointsForTimestamp: Array<{ zone: string; label: string; color: string; value: number; timestamp: number; x: number; y: number }> = []
    for (const zoneSeries of series) {
      let best: { point: any; dist: number } | null = null
      for (const point of zoneSeries.points) {
        const dist = Math.abs(point.timestamp - targetTimestamp!)
        if (!best || dist < best.dist) best = { point, dist }
      }
      if (best && best.point) {
        const p = best.point
        pointsForTimestamp.push({
          zone: zoneSeries.zone,
          label: zoneSeries.label,
          color: zoneSeries.color,
          value: p.value,
          timestamp: p.timestamp,
          x: xFromTimestamp(p.timestamp),
          y: padding.top + ((maxValue - p.value) / valueSpan) * innerHeight,
        })
      }
    }

    setHoveredPoints(pointsForTimestamp)
    setHoverClient({ clientX: event.clientX, clientY: event.clientY })
    setHoverX(xFromTimestamp(targetTimestamp))
  }

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : width
  const tooltipMaxWidth = 250

  return (
    <div className="electricity-chart-frame">
      <div className="electricity-chart__caption">{caption}</div>
      <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        className="electricity-chart"
        viewBox={`0 0 ${width} ${height}`}
        aria-label="Evolución del precio por fecha"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setHoveredPoints([]); setHoverClient(null); setHoverX(null); }}
        style={{ display: 'block', cursor: 'default' }}
      >
        {yLabels.map((tick) => (
          <g key={`y-${tick.y}`}>
            <line x1={padding.left} y1={tick.y} x2={width - padding.right} y2={tick.y} className="electricity-chart__grid" />
            <text x={padding.left - 8} y={tick.y + 4} textAnchor="end" className="electricity-chart__axis-label">
              {formatNumber(tick.value, 0, 0)}
            </text>
          </g>
        ))}

        {series.map((zoneSeries) => {
          const polylinePoints = zoneSeries.points
            .map((point) => {
              const x = xFromTimestamp(point.timestamp)
              const y = padding.top + ((maxValue - point.value) / valueSpan) * innerHeight
              return `${x},${y}`
            })
            .join(' ')

          return (
            <polyline
              key={`line-${zoneSeries.zone}`}
              className="electricity-chart__line"
              points={polylinePoints}
              style={{ stroke: zoneSeries.color }}
            />
          )
        })}

        {hoverX != null && (
          <line x1={hoverX} y1={padding.top} x2={hoverX} y2={height - padding.bottom} stroke="rgba(100, 100, 100, 0.3)" strokeWidth="2" strokeDasharray="4,4" />
        )}
        {hoveredPoints.map((hp) => (
          <circle key={`hp-${hp.zone}`} cx={hp.x} cy={hp.y} r="5" fill={hp.color} />
        ))}

        {xTicks.map((tick) => {
          const anchor = tick.isFirst ? 'start' : tick.isLast ? 'end' : 'middle'
          return (
            <text key={`x-${tick.label}-${tick.x}`} x={tick.x} y={height - 10} textAnchor={anchor} className="electricity-chart__axis-label">
              {tick.label}
            </text>
          )
        })}

        <rect x={padding.left} y={padding.top} width={innerWidth} height={innerHeight} fill="transparent" />
      </svg>

      {hoverClient && hoveredPoints.length > 0 && (
        <>
          {(() => {
            const sideAssignment = hoveredPoints.map((_, i) => (i % 2 === 0 ? 'right' : 'left'))
            const leftIndices = sideAssignment.map((s, i) => (s === 'left' ? i : -1)).filter((i) => i !== -1)
            const rightIndices = sideAssignment.map((s, i) => (s === 'right' ? i : -1)).filter((i) => i !== -1)

            const baseXRight = 14
            const baseXLeft = 1
            const baseY = -42
            const verticalSpacing = 72

            return hoveredPoints.map((hp, idx) => {
              const side = sideAssignment[idx]
              const order = side === 'right' ? rightIndices.indexOf(idx) : leftIndices.indexOf(idx)
              const offY = baseY + order * verticalSpacing
              const availableWidth = side === 'right'
                ? viewportWidth - hoverClient.clientX - baseXRight - 18
                : hoverClient.clientX - baseXLeft - 18
              const maxWidth = Math.max(140, Math.min(tooltipMaxWidth, availableWidth))

              return (
                <div
                  key={`tip-${hp.zone}`}
                  style={{
                    position: 'fixed',
                    left: side === 'right' ? `${hoverClient.clientX + baseXRight}px` : 'auto',
                    right: side === 'left' ? `${Math.max(viewportWidth - hoverClient.clientX + baseXLeft, 12)}px` : 'auto',
                    top: `${hoverClient.clientY + offY}px`,
                    background: 'rgba(0,0,0,0.88)',
                    color: 'white',
                    padding: '6px 10px',
                    borderRadius: 6,
                    fontSize: 13,
                    pointerEvents: 'none',
                    zIndex: 10,
                    whiteSpace: 'normal',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                    maxWidth: `${maxWidth}px`,
                    width: 'max-content',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{hp.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(hp.value, 2, 2)}</div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>{formatTooltipDate(hp.timestamp)}</div>
                  </div>
                </div>
              )
            })
          })()}
        </>
      )}

      <div className="electricity-line-legend" aria-label="Leyenda de zonas en la gráfica histórica">
        {series.map((zoneSeries) => (
          <div key={`legend-${zoneSeries.zone}`} className="electricity-line-legend__item">
            <span className="electricity-line-legend__swatch" style={{ backgroundColor: zoneSeries.color }} aria-hidden="true" />
            <span>{zoneSeries.label}</span>
          </div>
        ))}
      </div>
      </div>
    </div>
  )
}

function SimpleBarChart({ data, caption }: { data: BarChartData; caption: string }) {
  const width = 900
  const height = 280
  const padding = { top: 20, right: 50, bottom: 46, left: 42 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const { categories, series } = data

  if (categories.length === 0 || series.length === 0) {
    return <p className="electricity-chart__empty">No hay datos mensuales para mostrar.</p>
  }

  const allValues = series.flatMap((zoneSeries) => zoneSeries.values.filter((value): value is number => value !== null))

  if (allValues.length === 0) {
    return <p className="electricity-chart__empty">No hay datos mensuales para mostrar.</p>
  }

  const maxValue = Math.max(...allValues, 1)
  const yTicks = 4
  const yLabels = Array.from({ length: yTicks + 1 }, (_, index) => {
    const ratio = index / yTicks
    const value = maxValue - ratio * maxValue
    const y = padding.top + ratio * innerHeight
    return { value, y }
  })

  const groupGap = 10
  const rawGroupWidth = (innerWidth - groupGap * (categories.length - 1)) / categories.length
  const groupWidth = Math.max(Math.min(rawGroupWidth, 110), 18)

  const barGap = 4
  const rawBarWidth = (groupWidth - barGap * (series.length - 1)) / series.length
  const barWidth = Math.max(Math.min(rawBarWidth, 24), 6)
  const plottedGroupWidth = barWidth * series.length + barGap * (series.length - 1)

  const groupsTotalWidth = categories.length * groupWidth + (categories.length - 1) * groupGap
  const groupsStartX = padding.left + Math.max((innerWidth - groupsTotalWidth) / 2, 0)

  return (
    <div className="electricity-chart-frame">
      <div className="electricity-chart__caption">{caption}</div>
      <>
      <svg className="electricity-chart" viewBox={`0 0 ${width} ${height}`} aria-label="Promedio mensual de precio comparado por zona">
        {yLabels.map((tick) => (
          <g key={`bar-y-${tick.y}`}>
            <line x1={padding.left} y1={tick.y} x2={width - padding.right} y2={tick.y} className="electricity-chart__grid" />
            <text x={padding.left - 8} y={tick.y + 4} textAnchor="end" className="electricity-chart__axis-label">
              {formatNumber(tick.value, 0, 0)}
            </text>
          </g>
        ))}

        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} className="electricity-chart__grid" />

        {categories.map((category, categoryIndex) => {
          const groupX = groupsStartX + categoryIndex * (groupWidth + groupGap)

          return (
            <g key={`group-${category}`}>
              {series.map((zoneSeries, seriesIndex) => {
                const value = zoneSeries.values[categoryIndex]

                if (value === null) {
                  return null
                }

                const x = groupX + seriesIndex * (barWidth + barGap)
                const barHeight = (value / maxValue) * innerHeight
                const y = height - padding.bottom - barHeight

                return (
                  <g key={`${zoneSeries.zone}-${category}`}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      className="electricity-chart__bar"
                      rx={4}
                      style={{ fill: zoneSeries.color }}
                    />
                    <text
                      x={x + barWidth / 2}
                      y={y - 6}
                      textAnchor="middle"
                      className="electricity-chart__bar-label"
                      style={{ fill: zoneSeries.color }}
                    >
                      {formatNumber(value, 1, 1)}
                    </text>
                  </g>
                )
              })}

              <text
                x={groupX + plottedGroupWidth / 2}
                y={height - 10}
                textAnchor="middle"
                className="electricity-chart__axis-label"
              >
                {category}
              </text>
            </g>
          )
        })}

      </svg>

      <div className="electricity-line-legend" aria-label="Leyenda de zonas en la comparativa mensual">
        {series.map((zoneSeries) => (
          <div key={`bar-legend-${zoneSeries.zone}`} className="electricity-line-legend__item">
            <span className="electricity-line-legend__swatch" style={{ backgroundColor: zoneSeries.color }} aria-hidden="true" />
            <span>{zoneSeries.label}</span>
          </div>
        ))}
      </div>
      </>
    </div>
  )
}

export function ElectricityPage() {
  const currencyMenuRef = useRef<HTMLDivElement | null>(null)
  const currencyButtonRef = useRef<HTMLButtonElement | null>(null)
  const [items, setItems] = useState<ElectricityItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedChartZone, setSelectedChartZone] = useState('')
  const [compareChartZones, setCompareChartZones] = useState<string[]>(Array.from({ length: COMPARISON_SLOTS }, () => ''))
  const [rangeDays, setRangeDays] = useState<30 | 90 | 180 | 365>(90)
  const [chartDataByZone, setChartDataByZone] = useState<Record<string, ElectricityItem[]>>({})
  const [currentPage, setCurrentPage] = useState(0)
  const [persistedZones, setPersistedZones] = useState<string[]>([])
  const [directSearchZones, setDirectSearchZones] = useState<string[]>([])
  const [directZoneInput, setDirectZoneInput] = useState('')
  const [isDirectZoneSearchOpen, setIsDirectZoneSearchOpen] = useState(false)
  const [isDirectZoneLoading, setIsDirectZoneLoading] = useState(false)
  const [directZoneError, setDirectZoneError] = useState<string | null>(null)
  const [selectedCurrency, setSelectedCurrency] = useState<DisplayCurrency>('EUR')
  const [isCurrencyMenuOpen, setIsCurrencyMenuOpen] = useState(false)
    // Cierre automático del menú de moneda al hacer click fuera
    useEffect(() => {
      if (!isCurrencyMenuOpen) return;
      function handleClickOutside(event: MouseEvent) {
        const menu = currencyMenuRef.current;
        const button = currencyButtonRef.current;
        if (
          menu &&
          !menu.contains(event.target as Node) &&
          button &&
          !button.contains(event.target as Node)
        ) {
          setIsCurrencyMenuOpen(false);
        }
      }
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isCurrencyMenuOpen]);
  const [isCurrencyLoading, setIsCurrencyLoading] = useState(false)
  const [currencyError, setCurrencyError] = useState<string | null>(null)
  const [currencyRate, setCurrencyRate] = useState(1)
  const [externalZoneCache, setExternalZoneCache] = useState<Record<string, ElectricityItem[]>>(() => getCachedExternalElectricityZones())
  const currencyRateCacheRef = useRef<Partial<Record<DisplayCurrency, number>>>({ EUR: 1 })

  const ITEMS_PER_PAGE = 10

  useEffect(() => {
    let isCancelled = false

    const loadElectricity = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const [data, persisted, direct] = await Promise.all([
          fetchElectricity(),
          fetchPersistedElectricityZones(),
          fetchDirectSearchElectricityZones(),
        ])

        if (!isCancelled) {
          setItems(data)
          setPersistedZones(persisted)
          setDirectSearchZones(direct)
        }
      } catch {
        if (!isCancelled) {
          setError('No se pudieron cargar los datos de electricidad.')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    loadElectricity()

    return () => {
      isCancelled = true
    }
  }, [])

  const zones = useMemo(() => {
    return Array.from(new Set(persistedZones)).filter(Boolean)
  }, [persistedZones])

  const persistedZonesSet = useMemo(() => new Set(persistedZones), [persistedZones])
  const directSearchZoneHints = useMemo(() => {
    return Array.from(new Set(directSearchZones))
      .map((zone) => zone.trim())
      .filter(Boolean)
      .filter((zone) => !persistedZonesSet.has(zone))
      .sort((a, b) => a.localeCompare(b))
  }, [directSearchZones, persistedZonesSet])

  const filteredDirectZoneHints = useMemo(() => {
    const term = directZoneInput.trim().toLowerCase()
    if (!term) {
      return directSearchZoneHints.slice(0, 12)
    }

    return directSearchZoneHints
      .filter((zone) => {
        const normalizedLabel = zoneLabel(zone).toLowerCase()
        return zone.toLowerCase().includes(term) || normalizedLabel.includes(term)
      })
      .slice(0, 12)
  }, [directZoneInput, directSearchZoneHints])

  useEffect(() => {
    let isCancelled = false

    const loadCurrencyRate = async () => {
      if (selectedCurrency === 'EUR') {
        setCurrencyRate(1)
        setCurrencyError(null)
        return
      }

      const cachedRate = currencyRateCacheRef.current[selectedCurrency]
      if (cachedRate) {
        setCurrencyRate(cachedRate)
        setCurrencyError(null)
        return
      }

      try {
        setIsCurrencyLoading(true)
        setCurrencyError(null)
        const converted = await convertFiatAmount(1, 'EUR', selectedCurrency)

        if (!isCancelled) {
          const safeRate = Number.isFinite(converted) && converted > 0 ? converted : 1
          currencyRateCacheRef.current[selectedCurrency] = safeRate
          setCurrencyRate(safeRate)
        }
      } catch {
        if (!isCancelled) {
          setCurrencyRate(1)
          setCurrencyError('No se pudo aplicar la conversión de moneda. Mostrando EUR.')
        }
      } finally {
        if (!isCancelled) {
          setIsCurrencyLoading(false)
        }
      }
    }

    loadCurrencyRate()

    return () => {
      isCancelled = true
    }
  }, [selectedCurrency])

  function convertToSelectedCurrency(value: number): number {
    return value * currencyRate
  }

  useEffect(() => {
    setCachedExternalElectricityZones(externalZoneCache)
  }, [externalZoneCache])

  const isExternalZoneSelected = Boolean(selectedChartZone) && !persistedZonesSet.has(selectedChartZone)

  const selectableChartZones = useMemo(() => {
    if (!selectedChartZone || persistedZonesSet.has(selectedChartZone)) {
      return zones
    }

    return [selectedChartZone, ...zones]
  }, [selectedChartZone, zones, persistedZonesSet])

  useEffect(() => {
    if (!selectedChartZone && zones.length > 0) {
      setSelectedChartZone(zones[0])
    }
  }, [selectedChartZone, zones])

  const activeChartZones = useMemo(() => {
    if (isExternalZoneSelected && selectedChartZone) {
      return [selectedChartZone]
    }

    const candidates = [selectedChartZone, ...compareChartZones].filter(Boolean)
    return Array.from(new Set(candidates)).slice(0, MAX_CHART_ZONES)
  }, [selectedChartZone, compareChartZones, isExternalZoneSelected])

  useEffect(() => {
    if (isExternalZoneSelected) {
      setCompareChartZones(Array.from({ length: COMPARISON_SLOTS }, () => ''))
      return
    }

    setCompareChartZones((prev) => {
      const valid = new Set(zones)
      const used = new Set<string>(selectedChartZone ? [selectedChartZone] : [])
      const next: string[] = []

      for (const zone of prev) {
        if (!zone || !valid.has(zone) || used.has(zone)) {
          next.push('')
          continue
        }

        used.add(zone)
        next.push(zone)
      }

      while (next.length < COMPARISON_SLOTS) {
        next.push('')
      }

      const normalized = next.slice(0, COMPARISON_SLOTS)
      return normalized.join('|') === prev.join('|') ? prev : normalized
    })
  }, [selectedChartZone, zones, isExternalZoneSelected])

  const latestByZone = useMemo(() => {
    const map = new Map<string, ElectricityItem>()

    for (const rawItem of items) {
      const item = {
        ...rawItem,
        precioMwh: convertToSelectedCurrency(rawItem.precioMwh),
      }
      const current = map.get(item.zona)
      if (!current || toTimestamp(item) > toTimestamp(current)) {
        map.set(item.zona, item)
      }
    }

    return map
  }, [items, currencyRate])

  const latestRows = useMemo(() => {
    const byZone = Array.from(latestByZone.values())
    return byZone.sort((left, right) => left.precioMwh - right.precioMwh)
  }, [latestByZone])

  const externalZoneSet = useMemo(() => {
    return new Set(Object.keys(externalZoneCache).map((zone) => normalizeZoneCacheKey(zone)))
  }, [externalZoneCache])

  const externalLatestRows = useMemo(() => {
    return Object.entries(externalZoneCache)
      .map(([, zoneRows]) => {
        const latest = [...zoneRows].sort((a, b) => toTimestamp(b) - toTimestamp(a))[0] ?? null
        if (!latest) {
          return null
        }

        return {
          ...latest,
          precioMwh: convertToSelectedCurrency(latest.precioMwh),
        }
      })
      .filter((row): row is ElectricityItem => row !== null)
  }, [externalZoneCache, currencyRate])

  const filteredLatestRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const mergedRows = [...externalLatestRows, ...latestRows]
    const uniqueRows = Array.from(new Map(mergedRows.map((row) => [normalizeZoneCacheKey(row.zona), row])).values())

    return uniqueRows.filter((row) => {
      const label = zoneLabel(row.zona).toLowerCase()

      if (term && !label.includes(term) && !row.zona.toLowerCase().includes(term)) {
        return false
      }

      return true
    })
  }, [latestRows, externalLatestRows, searchTerm])

  const totalPages = Math.ceil(filteredLatestRows.length / ITEMS_PER_PAGE)
  const paginatedRows = filteredLatestRows.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE,
  )

  useEffect(() => {
    setCurrentPage(0)
  }, [searchTerm])

  useEffect(() => {
    setCurrentPage(0)
  }, [filteredLatestRows.length])

  useEffect(() => {
    if (!selectedChartZone) {
      setChartDataByZone({})
      return
    }

    let isCancelled = false

    const loadChartData = async () => {
      try {
        const { start } = buildRangeWindow(rangeDays)
        const zonesToLoad = activeChartZones
        const entries = await Promise.all(
          zonesToLoad.map(async (zone) => {
            const normalizedZone = normalizeZoneCacheKey(zone)
            const isPersisted = persistedZonesSet.has(zone)

            let data: ElectricityItem[]
            if (isPersisted) {
              data = await fetchElectricityByZoneAnddateRange(start, zone)
            } else if (externalZoneCache[normalizedZone]) {
              data = externalZoneCache[normalizedZone]
            } else {
              data = await fetchElectricityByDirectZone(zone)
              setExternalZoneCache((current) => {
                if (current[normalizedZone]) {
                  return current
                }

                return {
                  ...current,
                  [normalizedZone]: data,
                }
              })
            }

            const filteredData = filterItemsByRange(data, rangeDays)

            return [zone, filteredData] as const
          }),
        )

        if (!isCancelled) {
          setChartDataByZone(Object.fromEntries(entries))
        }
      } catch {
        if (!isCancelled) {
          setChartDataByZone({})
        }
      }
    }

    loadChartData()

    return () => {
      isCancelled = true
    }
  }, [selectedChartZone, compareChartZones, rangeDays, activeChartZones, persistedZonesSet, externalZoneCache])

  async function handleDirectZoneSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const requestedZone = directZoneInput.trim().toUpperCase()
    if (!requestedZone) {
      return
    }

    setIsDirectZoneLoading(true)
    setDirectZoneError(null)

    try {
      const normalizedRequestedZone = normalizeZoneCacheKey(requestedZone)

      if (persistedZonesSet.has(requestedZone)) {
        setSelectedChartZone(requestedZone)
        return
      }

      const cached = externalZoneCache[normalizedRequestedZone] ?? externalZoneCache[requestedZone]
      const data = cached ?? await fetchElectricityByDirectZone(requestedZone)
      if (data.length === 0) {
        throw new Error('No data')
      }

      if (!cached) {
        setExternalZoneCache((current) => ({
          ...current,
          [normalizedRequestedZone]: data,
        }))
      }

      const resolvedZone = data[0]?.zona?.trim() || requestedZone
      const normalizedResolvedZone = normalizeZoneCacheKey(resolvedZone)

      if (normalizedResolvedZone !== normalizedRequestedZone && !externalZoneCache[normalizedResolvedZone]) {
        setExternalZoneCache((current) => ({
          ...current,
          [normalizedResolvedZone]: data,
        }))
      }

      setChartDataByZone((prev) => ({
        ...prev,
        [resolvedZone]: filterItemsByRange(data, rangeDays),
      }))
      setSelectedChartZone(resolvedZone)
      setCompareChartZones(Array.from({ length: COMPARISON_SLOTS }, () => ''))
      setDirectZoneInput(resolvedZone)
      setIsDirectZoneSearchOpen(false)
    } catch {
      setDirectZoneError(`No se pudo cargar la zona ${requestedZone}.`) 
    } finally {
      setIsDirectZoneLoading(false)
    }
  }

  const chartZoneOptions = useMemo(() => {
    return selectableChartZones.map((zone, index) => ({
      zone,
      label: zoneLabel(zone),
      color: LINE_SERIES_COLORS[index % LINE_SERIES_COLORS.length],
      persisted: persistedZonesSet.has(zone),
    }))
  }, [selectableChartZones, persistedZonesSet])

  const selectedChartLabel = selectedChartZone ? zoneLabel(selectedChartZone) : 'Zona seleccionada'
  const selectedChartCaption = `${selectedChartLabel} - ${selectedCurrency}/MWh`

  const lineSeries = useMemo<LineSeries[]>(() => {
    return activeChartZones
      .map((zone, index) => {
        const points = [...(chartDataByZone[zone] ?? [])]
          .sort((a, b) => toTimestamp(a) - toTimestamp(b))
          .map((item) => ({
            timestamp: toTimestamp(item),
            label: toShortDateLabel(item.fecha),
            value: convertToSelectedCurrency(item.precioMwh),
          }))
          .filter((point) => Number.isFinite(point.timestamp))

        if (points.length === 0) {
          return null
        }

        return {
          zone,
          label: zoneLabel(zone),
          color: LINE_SERIES_COLORS[index % LINE_SERIES_COLORS.length],
          points,
        }
      })
      .filter((series): series is LineSeries => series !== null)
  }, [chartDataByZone, activeChartZones, currencyRate])

  const monthlyComparisonData = useMemo<BarChartData>(() => {
    if (activeChartZones.length === 0) {
      return { categories: [], series: [] }
    }

    const zoneMonthlyMaps = activeChartZones.map((zone, index) => {
      const grouped = new Map<string, number[]>()

      for (const item of chartDataByZone[zone] ?? []) {
        const date = new Date(item.fecha)
        if (Number.isNaN(date.getTime())) continue

        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        const existing = grouped.get(monthKey) ?? []
        existing.push(convertToSelectedCurrency(item.precioMwh))
        grouped.set(monthKey, existing)
      }

      const averages = new Map<string, number>()
      for (const [month, prices] of grouped.entries()) {
        averages.set(month, prices.reduce((acc, value) => acc + value, 0) / prices.length)
      }

      return {
        zone,
        label: zoneLabel(zone),
        color: LINE_SERIES_COLORS[index % LINE_SERIES_COLORS.length],
        averages,
      }
    })

    const monthKeys = Array.from(new Set(zoneMonthlyMaps.flatMap((zoneMap) => Array.from(zoneMap.averages.keys()))))
      .sort((a, b) => (a < b ? -1 : 1))
      .slice(-12)

    const categories = monthKeys.map((monthKey) => toMonthLabel(monthKey))

    const series: BarSeries[] = zoneMonthlyMaps.map((zoneMap) => ({
      zone: zoneMap.zone,
      label: zoneMap.label,
      color: zoneMap.color,
      values: monthKeys.map((monthKey) => zoneMap.averages.get(monthKey) ?? null),
    }))

    return { categories, series }
  }, [activeChartZones, chartDataByZone, currencyRate])

  const latestValues = useMemo(() => {
    const latestRows = Array.from(latestByZone.values())
    if (latestRows.length === 0) {
      return {
        cheapest: null as ElectricityItem | null,
        mostExpensive: null as ElectricityItem | null,
        comparisonAverage: 0,
        comparisonCount: 0,
        selected: null as ElectricityItem | null,
      }
    }

    const sorted = [...latestRows].sort((a, b) => a.precioMwh - b.precioMwh)
    const selectedFromLatest = selectedChartZone ? latestByZone.get(selectedChartZone) ?? null : null
    const selectedFromChartData = selectedChartZone && !selectedFromLatest
      ? (() => {
          const latestFromChart = [...(chartDataByZone[selectedChartZone] ?? [])].sort((a, b) => toTimestamp(b) - toTimestamp(a))[0] ?? null
          return latestFromChart
            ? { ...latestFromChart, precioMwh: convertToSelectedCurrency(latestFromChart.precioMwh) }
            : null
        })()
      : null
    const selected = selectedFromLatest ?? selectedFromChartData

    const comparisonValues = activeChartZones
      .map((zone) => {
        const latestFromPersisted = latestByZone.get(zone)
        if (latestFromPersisted) {
          return latestFromPersisted.precioMwh
        }

        const latestFromChart = [...(chartDataByZone[zone] ?? [])].sort((a, b) => toTimestamp(b) - toTimestamp(a))[0] ?? null
        return latestFromChart ? convertToSelectedCurrency(latestFromChart.precioMwh) : null
      })
      .filter((value): value is number => value !== null && Number.isFinite(value))

    const comparisonAverage = comparisonValues.length > 0
      ? comparisonValues.reduce((acc, value) => acc + value, 0) / comparisonValues.length
      : 0

    return {
      cheapest: sorted[0],
      mostExpensive: sorted[sorted.length - 1],
      comparisonAverage,
      comparisonCount: comparisonValues.length,
      selected,
    }
  }, [latestByZone, selectedChartZone, chartDataByZone, activeChartZones, currencyRate])

  return (
    <section className="electricity-page">
      <header className="electricity-page__header">
        <h2>Precios de Electricidad</h2>
        <p>Seguimiento de costes energéticos por zona con evolución histórica.</p>
        {isLoading ? <p className="api-info">Cargando datos...</p> : null}
        {error ? <p className="api-info api-info--warning">{error}</p> : null}
      </header>

      <section className="electricity-stats">
        <article className="card electricity-stat">
          <span>Más barato</span>
          <strong>{latestValues.cheapest ? formatPriceMwh(latestValues.cheapest.precioMwh, selectedCurrency) : 'N/D'}</strong>
          <p>{latestValues.cheapest ? zoneLabel(latestValues.cheapest.zona) : '—'}</p>
        </article>
        <article className="card electricity-stat">
          <span>Promedio actual de zonas elegidas</span>
          <strong>{latestValues.comparisonAverage > 0 ? formatPriceMwh(latestValues.comparisonAverage, selectedCurrency) : 'N/D'}</strong>
          <p>
            {latestValues.comparisonCount > 0
              ? `${latestValues.comparisonCount} zona${latestValues.comparisonCount === 1 ? '' : 's'} en comparativa`
              : 'Selecciona una o más zonas'}
          </p>
        </article>
        <article className="card electricity-stat">
          <span>Más caro</span>
          <strong>{latestValues.mostExpensive ? formatPriceMwh(latestValues.mostExpensive.precioMwh, selectedCurrency) : 'N/D'}</strong>
          <p>{latestValues.mostExpensive ? zoneLabel(latestValues.mostExpensive.zona) : '—'}</p>
        </article>
        <article className="card electricity-stat">
          <span>Precio actual en la zona seleccionada</span>
          <strong>{latestValues.selected ? formatPriceMwh(latestValues.selected.precioMwh, selectedCurrency) : 'N/D'}</strong>
          <p>{latestValues.selected ? zoneLabel(latestValues.selected.zona) : 'Selecciona una zona'}</p>
        </article>
      </section>
      <section className="electricity-charts">
        <article className="card electricity-chart-card">
          <header>
            <div>
              <h3>
                <LineChart size={18} aria-hidden="true" /> Evolución histórica
              </h3>

              <div className="electricity-direct-zone-block">
                <form className="electricity-direct-zone" onSubmit={handleDirectZoneSearch} autoComplete="off">
                  <label className="search-field electricity-direct-zone__search-field" htmlFor="direct-zone-search">
                    <Search size={18} aria-hidden="true" />
                    <div className="electricity-direct-zone__input-wrap">
                      <input
                        id="direct-zone-search"
                        className="electricity-direct-zone__input"
                        type="text"
                        placeholder="¿Buscar otra zona? Ej: DE-AT-LU"
                        autoComplete="off"
                        value={directZoneInput}
                        onChange={(event) => setDirectZoneInput(event.target.value)}
                        onFocus={() => setIsDirectZoneSearchOpen(true)}
                        onBlur={() => setTimeout(() => setIsDirectZoneSearchOpen(false), 120)}
                        aria-label="Buscar zona externa"
                        aria-autocomplete="list"
                        aria-haspopup="listbox"
                        aria-controls="direct-zone-search-listbox"
                        disabled={isDirectZoneLoading}
                      />
                      {isDirectZoneSearchOpen && filteredDirectZoneHints.length > 0 ? (
                        <ul
                          id="direct-zone-search-listbox"
                          role="listbox"
                          className="electricity-direct-zone__dropdown-list"
                        >
                          {filteredDirectZoneHints.map((zone) => (
                            <li
                              key={zone}
                              role="option"
                              tabIndex={-1}
                              onMouseDown={() => {
                                setDirectZoneInput(zone)
                                setIsDirectZoneSearchOpen(false)
                              }}
                            >
                              <div className="electricity-direct-zone__dropdown-code">{zone}</div>
                              <div className="electricity-direct-zone__dropdown-label">{zoneLabel(zone)}</div>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </label>
                  <button type="submit" disabled={isDirectZoneLoading || !directZoneInput.trim()}>
                    {isDirectZoneLoading ? <Loader2 size={14} className="electricity-spinner" aria-hidden="true" /> : null}
                    <span>{isDirectZoneLoading ? 'Buscando...' : 'Buscar zona'}</span>
                  </button>
                </form>
                <p className="electricity-direct-zone__hint">
                  Las zonas que busques aquí se obtienen por llamada directa a nuestros proveedores, estos datos pueden tardar en cargar.
                </p>
                {directZoneError ? <p className="api-info api-info--warning">{directZoneError}</p> : null}
                {isExternalZoneSelected ? (
                  <p className="electricity-direct-zone__mode">Búsqueda directa: la comparativa múltiple se desactiva temporalmente.</p>
                ) : null}
              </div>
            </div>
            <div className="electricity-chart-card__controls">
              <div className="electricity-currency-picker" aria-label="Selector de moneda de visualización">
                <button
                  type="button"
                  className="electricity-currency-picker__trigger"
                  onClick={() => setIsCurrencyMenuOpen((prev) => !prev)}
                  ref={currencyButtonRef}
                  aria-expanded={isCurrencyMenuOpen}
                >
                  {selectedCurrency}
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className={`electricity-currency-picker__icon${isCurrencyMenuOpen ? ' is-open' : ''}`}
                  />
                </button>
                {isCurrencyMenuOpen ? (
                  <div
                    className="electricity-currency-picker__menu"
                    role="menu"
                    ref={currencyMenuRef}
                  >
                    {(['EUR', ...CONVERTIBLE_CURRENCIES] as DisplayCurrency[]).map((currencyCode) => (
                      <button
                        key={currencyCode}
                        type="button"
                        className={selectedCurrency === currencyCode ? 'is-active' : ''}
                        onClick={() => {
                          setSelectedCurrency(currencyCode)
                          setIsCurrencyMenuOpen(false)
                        }}
                      >
                        {currencyCode}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {isCurrencyLoading ? <p className="api-info">Convirtiendo importes a {selectedCurrency}...</p> : null}
              {currencyError ? <p className="api-info api-info--warning">{currencyError}</p> : null}

              <div className="electricity-select-grid">
                <div className="electricity-select-wrap">
                  <select
                    value={selectedChartZone}
                    onChange={(event) => {
                      setSelectedChartZone(event.target.value)
                      event.currentTarget.blur()
                    }}
                    aria-label="Seleccionar zona principal para gráfico"
                  >
                    {chartZoneOptions.map((zoneOption) => (
                      <option key={zoneOption.zone} value={zoneOption.zone}>
                        {zoneOption.persisted ? zoneOption.label : `${zoneOption.label} (externa)`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} aria-hidden="true" className="electricity-select-wrap__icon" />
                </div>

                {compareChartZones.map((compareZone, slotIndex) => {
                  const zonesUsedByOtherSlots = new Set(
                    compareChartZones.filter((zone, index) => index !== slotIndex && zone),
                  )

                  return (
                    <div key={`compare-slot-${slotIndex}`} className="electricity-select-wrap">
                      <select
                        value={compareZone}
                        disabled={isExternalZoneSelected}
                        onChange={(event) => {
                          const value = event.target.value
                          setCompareChartZones((prev) => {
                            const next = [...prev]
                            next[slotIndex] = value
                            return next
                          })
                          event.currentTarget.blur()
                        }}
                        aria-label={`Seleccionar zona de comparación ${slotIndex + 1} para gráfico`}
                      >
                        <option value="">Sin comparación</option>
                        {chartZoneOptions
                          .filter((zoneOption) => zoneOption.zone !== selectedChartZone)
                          .filter((zoneOption) => zoneOption.zone === compareZone || !zonesUsedByOtherSlots.has(zoneOption.zone))
                          .map((zoneOption) => (
                            <option key={`compare-${slotIndex}-${zoneOption.zone}`} value={zoneOption.zone}>
                              {zoneOption.label}
                            </option>
                          ))}
                      </select>
                      <ChevronDown size={16} aria-hidden="true" className="electricity-select-wrap__icon" />
                    </div>
                  )
                })}
              </div>

              <div className="electricity-range-buttons">
                {[
                  { value: 30, label: '1m' },
                  { value: 90, label: '3m' },
                  { value: 180, label: '6m' },
                  { value: 365, label: '1y' },
                ].map((rangeOption) => (
                  <button
                    key={rangeOption.value}
                    type="button"
                    className={rangeDays === rangeOption.value ? 'is-active' : ''}
                    onClick={() => setRangeDays(rangeOption.value as 30 | 90 | 180 | 365)}
                  >
                    {rangeOption.label}
                  </button>
                ))}
              </div>
            </div>
          </header>
          <SimpleLineChart series={lineSeries} caption={selectedChartCaption} />
        </article>

        <article className="card electricity-chart-card">
          <header>
            <div>
              <h3>
                <BarChart3 size={18} aria-hidden="true" /> Promedio mensual
              </h3>
              <p>
                Últimos {monthlyComparisonData.categories.length} meses
                {activeChartZones.length > 1 ? ' comparados por zona' : ' de la zona seleccionada'}
              </p>
            </div>
          </header>
          <SimpleBarChart data={monthlyComparisonData} caption={selectedChartCaption} />
        </article>
      </section>

      <section className="electricity-filters card">
        <div className="electricity-filters__top">
          <label className="search-field" htmlFor="electricity-search">
            <Search size={18} aria-hidden="true" />
            <input
              id="electricity-search"
              type="text"
              placeholder="Buscar zona"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="card electricity-table-card">
        <header>
          <h3 className="currencies-page__section-title"> Precios más recientes por zona</h3>
          <p>
            {filteredLatestRows.length} resultado{filteredLatestRows.length === 1 ? '' : 's'}
          </p>
        </header>

        {filteredLatestRows.length === 0 ? (
          <div className="no-results">No se encontraron zonas con la búsqueda seleccionada.</div>
        ) : (
          <>
            <div className="electricity-table">
              {paginatedRows.map((row) => (
                <article
                  key={row.zona}
                  className={`electricity-row ${externalZoneSet.has(normalizeZoneCacheKey(row.zona)) ? 'electricity-row--external' : ''}`}
                >
                  <div>
                    <strong>{zoneLabel(row.zona)}</strong>
                    {externalZoneSet.has(normalizeZoneCacheKey(row.zona)) ? (
                      <div className="electricity-row__meta">
                        <em className="electricity-row__tag" style={{marginLeft: -0.5}}>Zona obtenida de terceros</em>
                        <span>{toShortDateLabel(row.fecha)}</span>
                      </div>
                    ) : (
                      <span>{toShortDateLabel(row.fecha)}</span>
                    )}
                  </div>
                  <p>{formatPriceMwh(row.precioMwh, selectedCurrency)}</p>
                </article>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 0))}
                  disabled={currentPage === 0}
                >
                  ← Anterior
                </button>
                <span className="pagination__info">
                  Página {currentPage + 1} de {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages - 1))}
                  disabled={currentPage === totalPages - 1}
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <InfoNote
        ariaLabel="Aclaración sobre precios de la electricidad"
        message="Los precios mostrados en esta pantalla representan valores del mercado mayorista. El precio final para consumidores puede variar según factores como: país, comercializadora, impuestos, peajes y tipo de tarifa."
      />
    </section>
  )
}
