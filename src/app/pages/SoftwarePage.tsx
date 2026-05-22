import { useEffect, useMemo, useState } from 'react'
import { Filter, Search, X } from 'lucide-react'
import '../styles/software-page.css'
import { fetchSoftware } from '../../api/softwareApi'
import type { SoftwareItem } from '../../types/software'

function formatCommission(value: number): string {
  return `${Number(value).toFixed(2)}%`
}

function formatCommissionDetailLabel(moneda: string, comision: number): string {
  return `${moneda} - ${formatCommission(comision)}`
}

function calculateAverageCommission(detalles: Array<{ moneda: string; algoritmo: string; comision: number }>): number | null {
  if (!detalles || detalles.length === 0) {
    return null
  }

  const sum = detalles.reduce((acc, detail) => acc + detail.comision, 0)
  return sum / detalles.length
}

function getCommissionByCurrency(
  moneda: string,
  detalles: Array<{ moneda: string; algoritmo: string; comision: number }>,
): number | null {
  const matchingDetails = detalles.filter((detail) => detail.moneda === moneda)

  if (matchingDetails.length === 0) {
    return null
  }

  const sum = matchingDetails.reduce((acc, detail) => acc + detail.comision, 0)
  return sum / matchingDetails.length
}

function formatSystemLabel(value: string): string {
  const normalized = value.trim().toUpperCase()

  if (normalized === 'WINDOWS') {
    return 'Windows'
  }

  if (normalized === 'LINUX') {
    return 'Linux'
  }

  if (normalized === 'MACOS') {
    return 'macOS'
  }

  return normalized.charAt(0) + normalized.slice(1).toLowerCase()
}

export function SoftwarePage() {
  const [softwareItems, setSoftwareItems] = useState<SoftwareItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedHardware, setSelectedHardware] = useState<string[]>([])
  const [selectedSystems, setSelectedSystems] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(0)

  const ITEMS_PER_PAGE = 10

  useEffect(() => {
    let isCancelled = false

    const loadSoftware = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const apiData = await fetchSoftware()

        if (!isCancelled) {
          setSoftwareItems(apiData)
        }
      } catch {
        if (!isCancelled) {
          setError('No se pudo cargar el software de minería.')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    loadSoftware()

    return () => {
      isCancelled = true
    }
  }, [])

  const hardwareOptions = useMemo(() => {
    return Array.from(new Set(softwareItems.flatMap((item) => item.hardwareUsable))).sort()
  }, [softwareItems])

  const systemOptions = useMemo(() => {
    return Array.from(new Set(softwareItems.flatMap((item) => item.sistemas))).sort()
  }, [softwareItems])

  const filteredSoftware = useMemo(() => {
    return softwareItems.filter((item) => {
      if (searchTerm && !item.nombre.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }

      if (selectedHardware.length > 0 && !item.hardwareUsable.some((hw) => selectedHardware.includes(hw))) {
        return false
      }

      if (selectedSystems.length > 0 && !item.sistemas.some((os) => selectedSystems.includes(os))) {
        return false
      }

      return true
    })
  }, [searchTerm, selectedHardware, selectedSystems, softwareItems])

  const totalPages = Math.ceil(filteredSoftware.length / ITEMS_PER_PAGE)
  const paginatedSoftware = filteredSoftware.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE,
  )

  useEffect(() => {
    setCurrentPage(0)
  }, [searchTerm, selectedHardware, selectedSystems])

  const hasActiveFilters =
    searchTerm.trim().length > 0 || selectedHardware.length > 0 || selectedSystems.length > 0

  const getCurrencyOptionsForItem = (item: SoftwareItem): string[] => {
    return Array.from(new Set((item.detallesAlgoritmoMoneda ?? []).map((detail) => detail.moneda))).sort()
  }

  const toggleHardware = (hardware: string) => {
    setSelectedHardware((prev) =>
      prev.includes(hardware) ? prev.filter((item) => item !== hardware) : [...prev, hardware],
    )
  }

  const toggleSystem = (system: string) => {
    setSelectedSystems((prev) =>
      prev.includes(system) ? prev.filter((item) => item !== system) : [...prev, system],
    )
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedHardware([])
    setSelectedSystems([])
  }

  return (
    <section className="software-page">
      <header className="software-page__header">
        <h2>Software de Minería</h2>
        <p>Listado de softwares conocidos para minería de criptomonedas.</p>
        {isLoading ? <p className="api-info">Cargando datos...</p> : null}
        {error ? <p className="api-info api-info--warning">{error}</p> : null}
      </header>

      <section className="software-filters card">
        <div className="software-filters__top">
          <label className="search-field" htmlFor="software-search">
            <Search size={18} aria-hidden="true" />
            <input
              id="software-search"
              type="text"
              placeholder="Buscar software por nombre"
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
              <p className="filter-label">Hardware</p>
              <div className="chip-group">
                {hardwareOptions.map((hardware) => (
                  <button
                    key={hardware}
                    type="button"
                    className={`filter-chip${selectedHardware.includes(hardware) ? ' filter-chip--active' : ''}`}
                    onClick={() => toggleHardware(hardware)}
                  >
                    {hardware}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="filter-label">Sistema operativo</p>
              <div className="chip-group">
                {systemOptions.map((system) => (
                  <button
                    key={system}
                    type="button"
                    className={`filter-chip${selectedSystems.includes(system) ? ' filter-chip--active' : ''}`}
                    onClick={() => toggleSystem(system)}
                  >
                    {formatSystemLabel(system)}
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

      {hasActiveFilters && filteredSoftware.length === 0 ? (
        <div className="card no-results">
          No se encontraron softwares con los filtros seleccionados.
        </div>
      ) : (
        <>
          <section className="software-grid">
            {paginatedSoftware.map((item) => (
              <article key={item.nombre} className="card software-card">
                <header className="software-card__header">
                  <div>
                    <h3 style={{fontSize: 22}}>{item.nombre}</h3>
                  </div>
                  <div className="software-card__commission">
                    <strong style={{fontSize: 24}}>
                      {item.detallesAlgoritmoMoneda.length > 0
                        ? formatCommission(calculateAverageCommission(item.detallesAlgoritmoMoneda) ?? item.comision)
                        : formatCommission(item.comision)}
                    </strong>
                    <span>{item.detallesAlgoritmoMoneda.length > 0 ? 'Comisión media' : 'Comisión'}</span>
                  </div>
                </header>

                <div className="software-card__stats">
                  <div className="software-card__stat">
                    <span>Hardware compatible</span>
                    <strong>
                      {(item.hardwareUsable ?? []).length > 0 ? item.hardwareUsable.join(', ') : 'N/D'}
                    </strong>
                  </div>

                  <div className="software-card__stat">
                    <span>Sistemas operativos compatibles</span>
                    <strong>
                      {(item.sistemas ?? []).length > 0
                        ? item.sistemas.map(formatSystemLabel).join(', ')
                        : 'N/D'}
                    </strong>
                  </div>
                </div>

                <div className="software-card__algorithms-block">
                  <span>Monedas soportadas</span>
                  <div className="software-algorithm-group">
                    {getCurrencyOptionsForItem(item).length > 0 ? (
                      getCurrencyOptionsForItem(item).map((moneda) => {
                        const commission = getCommissionByCurrency(moneda, item.detallesAlgoritmoMoneda)

                        return (
                          <span key={`${item.nombre}-moneda-${moneda}`} className="software-algorithm-tag">
                            {commission !== null ? formatCommissionDetailLabel(moneda, commission) : moneda}
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
