import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Filter, Search, TrendingUp, X, Info } from 'lucide-react'
import '../styles/hardware-page.css'
import '../styles/info-note.css'
import { fetchHardwareByType } from '../../api/hardwareApi'
import type { HardwareItem, HardwareType } from '../../types/hardware'
import { InfoNote } from '../components/InfoNote'

const typeLabels: Record<HardwareType, string> = {
  gpu: 'GPU',
  cpu: 'CPU',
  asic: 'ASIC',
}

function detectBrand(name: string): string {
  if (name.toLowerCase().includes('geforce')) return 'NVIDIA'
  if (name.toLowerCase().includes('rtx')) return 'NVIDIA'
  if (name.toLowerCase().includes('gtx')) return 'NVIDIA'
  if (name.toLowerCase().includes('rx')) return 'AMD'
  if (name.toLowerCase().includes('amd')) return 'AMD'
  if (name.toLowerCase().includes('intel')) return 'Intel'
  if (name.toLowerCase().includes('antminer')) return 'Antminer'
  if (name.toLowerCase().includes('whatsminer')) return 'WhatsMiner'
  if (name.toLowerCase().includes('goldshell')) return 'Goldshell'
  return 'Otros'
}

export function HardwarePage() {
  const [activeTab, setActiveTab] = useState<HardwareType>('gpu')
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [apiDataByType, setApiDataByType] = useState<Partial<Record<HardwareType, HardwareItem[]>>>({})
  const [isLoadingApiData, setIsLoadingApiData] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [algorithmModalHardware, setAlgorithmModalHardware] = useState<HardwareItem | null>(null)
  const [currentPage, setCurrentPage] = useState(0)

  const ITEMS_PER_PAGE = 10

  useEffect(() => {
    if (apiDataByType[activeTab]) {
      return
    }

    let isCancelled = false

    const loadHardwareData = async () => {
      try {
        setIsLoadingApiData(true)
        setApiError(null)
        const apiData = await fetchHardwareByType(activeTab)

        if (!isCancelled) {
          setApiDataByType((previous) => ({
            ...previous,
            [activeTab]: apiData,
          }))
        }
      } catch {
        if (!isCancelled) {
          setApiError('No se pudieron cargar los datos.')
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingApiData(false)
        }
      }
    }

    loadHardwareData()

    return () => {
      isCancelled = true
    }
  }, [activeTab, apiDataByType])

  useEffect(() => {
    setAlgorithmModalHardware(null)
    setCurrentPage(0)
  }, [activeTab])

  useEffect(() => {
    setAlgorithmModalHardware(null)
    setCurrentPage(0)
  }, [searchTerm, selectedBrands])

  useEffect(() => {
    if (!algorithmModalHardware) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAlgorithmModalHardware(null)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [algorithmModalHardware])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow

    if (algorithmModalHardware) {
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [algorithmModalHardware])

  const currentData = apiDataByType[activeTab] ?? []

  const brands = useMemo(() => {
    const uniqueBrands = new Set(currentData.map((item) => detectBrand(item.name)))
    return Array.from(uniqueBrands)
  }, [currentData])

  const filteredData = useMemo(() => {
    return currentData.filter((item) => {
      if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }

      if (selectedBrands.length > 0) {
        const itemBrand = detectBrand(item.name)
        if (!selectedBrands.includes(itemBrand)) {
          return false
        }
      }

      return true
    })
  }, [currentData, searchTerm, selectedBrands])

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE)
  const paginatedData = filteredData.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE,
  )

  const hasActiveFilters = searchTerm.trim().length > 0 || selectedBrands.length > 0
  const isCpuTab = activeTab === 'cpu'

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((item) => item !== brand) : [...prev, brand],
    )
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedBrands([])
  }

  return (
    <section className="hardware-page">
      <header className="hardware-page__header">
        <h2>Hardware de Minería</h2>
        <p>Comparativa del hardware más rentable para minar criptomonedas.</p>
        {isLoadingApiData ? <p className="api-info">Cargando datos...</p> : null}
        {apiError ? <p className="api-info api-info--warning">{apiError}</p> : null}
      </header>

      {isCpuTab && (
        <aside className="card hardware-cpu-info" role="status">
          <Info size={18} />
          Todos los datos de CPUs son relativos al algoritmo de minado RandomX.
        </aside>
      )}

      <div className="hardware-tabs" role="tablist" aria-label="Tipo de hardware">
        {(['gpu', 'cpu', 'asic'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`hardware-tab${activeTab === tab ? ' hardware-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {typeLabels[tab]}
          </button>
        ))}
      </div>

      <section className="hardware-filters card">
        <div className="hardware-filters__top">
          <label className="search-field" htmlFor="hardware-search">
            <Search size={18} aria-hidden="true" />
            <input
              id="hardware-search"
              type="text"
              placeholder="Buscar hardware por nombre"
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
          <div className="hardware-filters__panel">
            <div>
              <p className="filter-label">Fabricante</p>
              <div className="chip-group">
                {brands.map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    className={`filter-chip${selectedBrands.includes(brand) ? ' filter-chip--active' : ''}`}
                    onClick={() => toggleBrand(brand)}
                  >
                    {brand}
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

      {hasActiveFilters && filteredData.length === 0 ? (
        <div className="card no-results">
          No se encontraron resultados con los filtros seleccionados.
        </div>
      ) : (
        <>
          <section className="hardware-grid">
            {paginatedData.map((item) => (
              <article key={item.name} className="card hardware-card">
              <header className="hardware-card__header">
                <div>
                  <h3>{item.name}</h3>
                  {!isCpuTab && (
                    <p className="profitable-algorithm profitable-algorithm--compact">
                      <TrendingUp size={15} aria-hidden="true" />
                      {item.algorithm}
                    </p>
                  )}
                </div>
              </header>

              <div className="spec-grid">
                {isCpuTab ? (
                  <>
                    <div>
                      <span>Hashrate</span>
                      <strong>{item.hashrate}</strong>
                    </div>
                    <div>
                      <span>Consumo</span>
                      <strong>{item.power}</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span>Hashrate promedio</span>
                      <strong>{item.hashrate}</strong>
                    </div>
                    <div>
                      <span>Consumo promedio</span>
                      <strong>{item.power}</strong>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                className={`algorithm-toggle${algorithmModalHardware?.name === item.name ? ' algorithm-toggle--active' : ''}`}
                onClick={() => setAlgorithmModalHardware(item)}
              >
                <span>Ver algoritmos soportados</span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
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

      {algorithmModalHardware && (
        <div
          className="algorithm-modal-backdrop"
          role="presentation"
          onClick={() => setAlgorithmModalHardware(null)}
        >
          <section
            className="algorithm-modal card"
            role="dialog"
            aria-modal="true"
            aria-label={`Algoritmos soportados por ${algorithmModalHardware.name}`}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="algorithm-modal__header">
              <div>
                <h3>Algoritmos soportados por {algorithmModalHardware.name}</h3>
              </div>
              <button
                type="button"
                className="algorithm-modal__close"
                onClick={() => setAlgorithmModalHardware(null)}
                aria-label="Cerrar algoritmos soportados"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </header>

            {algorithmModalHardware.algorithms.length === 0 ? (
              <p className="algorithm-empty">No hay algoritmos disponibles.</p>
            ) : (
              <ul className="algorithm-list">
                {algorithmModalHardware.algorithms.map((algorithmItem) => (
                  <li
                    key={`${algorithmModalHardware.name}-${algorithmItem.name}`}
                    className={algorithmItem.name === algorithmModalHardware.algorithm ? 'algorithm-list__item--best' : ''}
                  >
                    <strong>{algorithmItem.name}</strong>
                    <span>Hashrate: {algorithmItem.hashrate}</span>
                    <span>Consumo: {algorithmItem.power}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <InfoNote message="Las cifras son estimaciones basadas en condiciones actuales del mercado y coste energético medio. Verifica precios y disponibilidad antes de decidir." />
    </section>
  )
}
