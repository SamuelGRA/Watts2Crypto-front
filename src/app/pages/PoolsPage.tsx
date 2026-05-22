import { useEffect, useMemo, useState } from 'react'
import { Filter, Search, X } from 'lucide-react'
import '../styles/pools-page.css'
import { fetchPools } from '../../api/poolApi'
import type { PoolItem } from '../../types/pool'

const PAYMENT_SCHEMES_INFO = [
  {
    id: 'PPS',
    title: 'PPS (Pay Per Share)',
    description:
      'Pago fijo por cada share enviado, independientemente de si el pool encuentra un bloque.',
    risk: 'Bajo',
    variance: 'Muy baja',
    idealFor: 'Mineros que priorizan ingresos estables',
  },
  {
    id: 'PPLNS',
    title: 'PPLNS (Pay Per Last N Shares)',
    description:
      'Pago basado en las últimas N shares cuando la pool encuentra bloque.',
    risk: 'Medio',
    variance: 'Media',
    idealFor: 'Mineros a largo plazo que buscan mayor rentabilidad',
  },
  {
    id: 'PPS_PLUS',
    title: 'PPS+',
    description:
      'Combina pago base PPS con recompensa adicional por comisiones de transacción.',
    risk: 'Bajo-Medio',
    variance: 'Baja',
    idealFor: 'Quien busca equilibrio entre estabilidad y beneficio extra',
  },
  {
    id: 'FPPS',
    title: 'FPPS',
    description:
      'Variante de PPS que incluye también comisiones de transacción de forma más completa.',
    risk: 'Bajo',
    variance: 'Baja',
    idealFor: 'Mineros que priorizan previsibilidad con mejor retorno efectivo',
  },
  {
    id: 'SOLO',
    title: 'SOLO',
    description:
      'Minería individual: solo cobras cuando encuentras un bloque por tu cuenta.',
    risk: 'Muy alto',
    variance: 'Muy alta',
    idealFor: 'Hasrate muy alto o perfiles que aceptan alta volatilidad',
  },
  {
    id: 'PROP',
    title: 'PROP',
    description:
      'Reparte las recompensas según las shares aportadas durante la ronda activa.',
    risk: 'Alto',
    variance: 'Alta',
    idealFor: 'Mineros que quieren pago proporcional por ronda',
  },
  {
    id: 'PPLNSBF',
    title: 'PPLNSBF',
    description:
      'Variante de PPLNS con una fórmula específica impuesta por la pool para el reparto.',
    risk: 'Medio',
    variance: 'Media',
    idealFor: 'Mineros que aceptan reglas particulares de reparto',
  },
]

function formatCommission(value: number): string {
  return `${Number(value).toFixed(2)}%`
}

function formatRegionLabel(value: string): string {
  const normalized = value.trim().toUpperCase()

  if (normalized === 'ASIA') {
    return 'Asia'
  }

  if (normalized === 'US') {
    return 'EEUU'
  }

  if (normalized === 'EU') {
    return 'Europa'
  }

  return normalized.charAt(0) + normalized.slice(1).toLowerCase()
}

function formatPaymentSchemeLabel(value: string): string {
  const normalized = value.trim().toUpperCase()

  if (normalized === 'PPS_PLUS') {
    return 'PPS+'
  }

  if (normalized === 'PPLNS') {
    return 'PPLNS'
  }

  if (normalized === 'PPLNSBF') {
    return 'PPLNSBF'
  }

  if (normalized === 'FPPS') {
    return 'FPPS'
  }

  if (normalized === 'PROP') {
    return 'PROP'
  }

  if (normalized === 'PPS') {
    return 'PPS'
  }

  if (normalized === 'SOLO') {
    return 'Solo'
  }

  return normalized.charAt(0) + normalized.slice(1).toLowerCase()
}

function formatRegions(regiones: string[]): string {
  if (!regiones || regiones.length === 0) {
    return 'N/D'
  }

  return regiones.map(formatRegionLabel).join(', ')
}

function formatCommissionDetailLabel(moneda: string, comision: number): string {
  return `${moneda} - ${formatCommission(comision)}`
}

function getCommissionForCurrency(currency: string, detalles: Array<{ moneda: string; comision: number }>): number | null {
  const detail = detalles.find((d) => d.moneda === currency)
  return detail ? detail.comision : null
}

function calculateAverageCommission(detalles: Array<{ moneda: string; comision: number }>): number | null {
  if (!detalles || detalles.length === 0) {
    return null
  }
  const sum = detalles.reduce((acc, detail) => acc + detail.comision, 0)
  return sum / detalles.length
}


export function PoolsPage() {
  const [poolItems, setPoolItems] = useState<PoolItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [selectedPaymentSchemes, setSelectedPaymentSchemes] = useState<string[]>([])
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(0)

  const ITEMS_PER_PAGE = 10

  useEffect(() => {
    let isCancelled = false

    const loadPools = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const apiData = await fetchPools()

        if (!isCancelled) {
          setPoolItems(apiData)
        }
      } catch {
        if (!isCancelled) {
          setError('No se pudieron cargar las pools de minería.')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    loadPools()

    return () => {
      isCancelled = true
    }
  }, [])

  const regionOptions = useMemo(() => {
    return Array.from(new Set(poolItems.flatMap((item) => item.regiones))).sort()
  }, [poolItems])

  const paymentSchemeOptions = useMemo(() => {
    return Array.from(new Set(poolItems.flatMap((item) => item.esquemaDePago))).sort()
  }, [poolItems])

  const currencyOptions = useMemo(() => {
    return Array.from(new Set(poolItems.flatMap((item) => item.monedas))).sort()
  }, [poolItems])

  const filteredPools = useMemo(() => {
    return poolItems.filter((item) => {
      if (searchTerm && !item.nombre.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }

      if (selectedRegions.length > 0 && !item.regiones.some((region) => selectedRegions.includes(region))) {
        return false
      }

      if (
        selectedPaymentSchemes.length > 0 &&
        !item.esquemaDePago.some((scheme) => selectedPaymentSchemes.includes(scheme))
      ) {
        return false
      }

      if (selectedCurrencies.length > 0 && !item.monedas.some((currency) => selectedCurrencies.includes(currency))) {
        return false
      }

      return true
    })
  }, [searchTerm, selectedRegions, selectedPaymentSchemes, selectedCurrencies, poolItems])

  const totalPages = Math.ceil(filteredPools.length / ITEMS_PER_PAGE)
  const paginatedPools = filteredPools.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE)

  useEffect(() => {
    setCurrentPage(0)
  }, [searchTerm, selectedRegions, selectedPaymentSchemes, selectedCurrencies])

  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    selectedRegions.length > 0 ||
    selectedPaymentSchemes.length > 0 ||
    selectedCurrencies.length > 0

  const toggleRegion = (region: string) => {
    setSelectedRegions((prev) =>
      prev.includes(region)
        ? prev.filter((item) => item !== region)
        : [...prev, region],
    )
  }

  const togglePaymentScheme = (scheme: string) => {
    setSelectedPaymentSchemes((prev) =>
      prev.includes(scheme)
        ? prev.filter((item) => item !== scheme)
        : [...prev, scheme],
    )
  }

  const toggleCurrency = (currency: string) => {
    setSelectedCurrencies((prev) =>
      prev.includes(currency)
        ? prev.filter((item) => item !== currency)
        : [...prev, currency],
    )
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedRegions([])
    setSelectedPaymentSchemes([])
    setSelectedCurrencies([])
  }

  return (
    <section className="software-page">
      <header className="software-page__header">
        <h2>Pools de Minería</h2>
        <p>Listado de pools conocidas para minería de criptomonedas.</p>
        {isLoading ? <p className="api-info">Cargando datos...</p> : null}
        {error ? <p className="api-info api-info--warning">{error}</p> : null}
      </header>

      <section className="card pool-schemes-info" aria-label="Esquemas de pago en pools de minería">
        <h3>Esquemas de Pago</h3>
        <div className="pool-schemes-info__grid">
          {PAYMENT_SCHEMES_INFO.map((scheme) => (
            <article key={scheme.id} className="pool-scheme-card">
              <h4>{scheme.title}</h4>
              <p>{scheme.description}</p>
              <dl>
                <div>
                  <dt>Riesgo:</dt>
                  <dd>{scheme.risk}</dd>
                </div>
                <div>
                  <dt>Varianza:</dt>
                  <dd>{scheme.variance}</dd>
                </div>
              </dl>
              <p className="pool-scheme-card__ideal">
                <strong>Ideal para:</strong> {scheme.idealFor}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="software-filters card">
        <div className="software-filters__top">
          <label className="search-field" htmlFor="pool-search">
            <Search size={18} aria-hidden="true" />
            <input
              id="pool-search"
              type="text"
              placeholder="Buscar pool por nombre"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>

          <button
            type="button"
            className={`filter-toggle${showFilters || hasActiveFilters ? ' filter-toggle--active' : ''}`}
            onClick={() => setShowFilters((value) => !value)}
          >
            <Filter size={17} aria-hidden="true" />
            Filtros
          </button>
        </div>

        {showFilters && (
          <div className="software-filters__panel">
            <div>
              <p className="filter-label">Región</p>
              <div className="chip-group">
                {regionOptions.map((region) => (
                  <button
                    key={region}
                    type="button"
                    className={`filter-chip${selectedRegions.includes(region) ? ' filter-chip--active' : ''}`}
                    onClick={() => toggleRegion(region)}
                  >
                    {formatRegionLabel(region)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="filter-label">Esquema de pago</p>
              <div className="chip-group">
                {paymentSchemeOptions.map((scheme) => (
                  <button
                    key={scheme}
                    type="button"
                    className={`filter-chip${selectedPaymentSchemes.includes(scheme) ? ' filter-chip--active' : ''}`}
                    onClick={() => togglePaymentScheme(scheme)}
                  >
                    {formatPaymentSchemeLabel(scheme)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="filter-label">Moneda</p>
              <div className="chip-group">
                {currencyOptions.map((currency) => (
                  <button
                    key={currency}
                    type="button"
                    className={`filter-chip${selectedCurrencies.includes(currency) ? ' filter-chip--active' : ''}`}
                    onClick={() => toggleCurrency(currency)}
                  >
                    {currency}
                  </button>
                ))}
              </div>
            </div>

            {hasActiveFilters && (
              <button type="button" className="clear-filters" onClick={clearFilters}>
                <X size={14} aria-hidden="true" />
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </section>

      {hasActiveFilters && filteredPools.length === 0 ? (
        <div className="card no-results">
          No se encontraron pools con los filtros seleccionados.
        </div>
      ) : (
        <>
          <section className="software-grid">
            {paginatedPools.map((item) => (
              <article key={item.nombre} className="card software-card pool-card">
                <header className="software-card__header pool-card__header">
                  <div>
                    <h3 style={{fontSize: 22}}>{item.nombre}</h3>
                  </div>
                  <div className="software-card__commission pool-card__commission">
                    <strong>
                      {item.detallesMonedaComision.length > 0
                        ? formatCommission(calculateAverageCommission(item.detallesMonedaComision) ?? 0)
                        : formatCommission(item.comision)}
                    </strong>
                    <span>{item.detallesMonedaComision.length > 0 ? 'Comisión media' : 'Comisión'}</span>
                  </div>
                </header>

                <div className="pool-card__stats">
                  <div className="pool-card__stat">
                    <span>Esquema de pago</span>
                    <strong>
                      {item.esquemaDePago.length > 0
                        ? item.esquemaDePago.map(formatPaymentSchemeLabel).join(' / ')
                        : 'N/D'}
                    </strong>
                  </div>

                  <div className="pool-card__stat">
                    <span>Servidores</span>
                    <strong>{formatRegions(item.regiones ?? [])}</strong>
                  </div>
                </div>

                <div className="software-card__algorithms-block pool-card__chip-block">
                  <span>Monedas soportadas</span>
                  <div className="software-tag-group">
                    {(item.monedas ?? []).length > 0 ? (
                      (item.monedas ?? []).map((currency) => {
                        const commission = getCommissionForCurrency(currency, item.detallesMonedaComision)
                        return (
                          <span key={`${item.nombre}-currency-${currency}`} className="software-algorithm-tag pool-card__currency-tag">
                            {commission !== null ? formatCommissionDetailLabel(currency, commission) : currency}
                          </span>
                        )
                      })
                    ) : (
                      <span className="software-algorithm-tag">N/D</span>
                    )}
                  </div>
                </div>

              </article>
            ))}
          </section>

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
  )
}
