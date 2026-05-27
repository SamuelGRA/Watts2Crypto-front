import { useEffect, useMemo, useRef, useState } from 'react'
import { TrendingUp, TrendingDown, ChevronUp, ChevronDown } from 'lucide-react'
import { calcularRentabilidad, fetchMonedasParaCalculo, fetchMonedasParaCalculoConAlgoritmo, fetchPaisesElectricidad } from '../../api/calculatorApi'
import { fetchHardwareByType, formatHashrate, formatPower } from '../../api/hardwareApi'
import { fetchPools } from '../../api/poolApi'
import { fetchSoftware } from '../../api/softwareApi'
import type { PaisElectricidad } from '../../types/paisElectricidad'
import type { HardwareItem, HardwareType } from '../../types/hardware'
import type { SoftwareItem } from '../../types/software'
import type { PoolItem } from '../../types/pool'
import '../styles/calculator-page.css'

type InputMode = 'manual' | 'auto'
type HashrateUnit = 'H/s' | 'KH/s' | 'MH/s' | 'GH/s' | 'TH/s'
type ElectricityMode = 'manual' | 'country'

type SelectedHardwareItem = {
  type: HardwareType
  name: string
  rawName: string
  algorithm: string
  algorithms: string[]
  algorithmDetails: Record<string, { hashrateValue: number; powerValue: number }>
  hashrateValue: number
  powerValue: number
  quantity: number
}

type MonedaAlgoritmosItem = {
  nombre: string
  algoritmos: string[]
}

const hardwareTabLabels: Record<HardwareType, string> = {
  cpu: 'CPU',
  gpu: 'GPU',
  asic: 'ASIC',
}

const closedHardwareDropdownState: Record<HardwareType, boolean> = {
  cpu: false,
  gpu: false,
  asic: false,
}

const normalizeComparableName = (value: string): string => value.trim().toLowerCase()

const normalizeAlgorithm = (value: string): string => normalizeComparableName(value)

const toAlgorithmSet = (values: string[] | null | undefined): Set<string> | null => {
  if (!values || values.length === 0) {
    return null
  }

  return new Set(values.map((value) => normalizeAlgorithm(value)))
}

const intersectAlgorithmSets = (sets: Array<Set<string> | null>): Set<string> | null => {
  const activeSets = sets.filter((value): value is Set<string> => value !== null)

  if (activeSets.length === 0) {
    return null
  }

  const [firstSet, ...restSets] = activeSets
  const intersection = new Set(firstSet)

  for (const currentSet of restSets) {
    for (const value of Array.from(intersection)) {
      if (!currentSet.has(value)) {
        intersection.delete(value)
      }
    }
  }

  return intersection
}

const intersectsWithActiveAlgorithms = (values: string[] | null | undefined, activeAlgorithms: Set<string> | null): boolean => {
  if (activeAlgorithms === null) {
    return true
  }

  if (activeAlgorithms.size === 0) {
    return false
  }

  if (!values || values.length === 0) {
    return false
  }

  return values.some((value) => activeAlgorithms.has(normalizeAlgorithm(value)))
}

const getHardwareAlgorithmNames = (item: HardwareItem): string[] => {
  const names = [item.algorithm, ...item.algorithms.map((algorithm) => algorithm.name)]
  return Array.from(new Set(names.map((value) => normalizeAlgorithm(value))))
}

const getSelectedHardwareAlgorithmNames = (item: SelectedHardwareItem): string[] => {
  const names = [item.algorithm, ...item.algorithms]
  return Array.from(new Set(names.map((value) => normalizeAlgorithm(value))))
}

const getPoolAlgorithmNames = (
  pool: PoolItem,
  monedaAlgorithmByName: Map<string, string[]>,
): string[] => {
  const directAlgorithms = pool.algoritmos.map((algorithm) => normalizeAlgorithm(algorithm))

  if (directAlgorithms.length > 0) {
    return Array.from(new Set(directAlgorithms))
  }

  const derivedAlgorithms = pool.monedas
    .flatMap((moneda) => monedaAlgorithmByName.get(normalizeComparableName(moneda)) ?? [])

  return Array.from(new Set(derivedAlgorithms.map((value) => normalizeAlgorithm(value))))
}

type CalculatorFormState = {
  hashRate: number | ''
  hashRateUnit: HashrateUnit
  powerW: number | ''
  elecCost: number | ''
  elecCostInput: string
  electricityMode: ElectricityMode
  selectedCountry: string
  selectedMoneda: string
  poolMode: InputMode
  poolFee: number | ''
  selectedPool: string
  softwareMode: InputMode
  softwareFee: number | ''
  selectedSoftware: string
  hardwareCost: number | ''
  selectedHardware: SelectedHardwareItem[]
  hardwareTab: HardwareType
  hardwareAutofill: boolean
}

const STORAGE_KEY = 'calculator_form_state'

function loadFormState(): Partial<CalculatorFormState> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}




function saveFormState(state: CalculatorFormState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Silenciar errores de storage
  }
}

export function CalculatorPage() {
  const resultsRef = useRef<HTMLDivElement | null>(null)
  const savedState = loadFormState()
  const [hashRate, setHashRate] = useState<number | ''>(savedState.hashRate ?? '')
  const [hashRateUnit, setHashRateUnit] = useState<HashrateUnit>(savedState.hashRateUnit ?? 'H/s')
  const [powerW, setPowerW] = useState<number | ''>(savedState.powerW ?? '')
  const [elecCost, setElecCost] = useState<number | ''>(savedState.elecCost ?? '')
  const [elecCostInput, setElecCostInput] = useState<string>(savedState.elecCostInput ?? '')
  const [electricityMode, setElectricityMode] = useState<ElectricityMode>(savedState.electricityMode ?? 'manual')
  const [selectedCountry, setSelectedCountry] = useState<string>(savedState.selectedCountry ?? '')
  const [selectedMoneda, setSelectedMoneda] = useState<string>(savedState.selectedMoneda ?? '')
  const [poolMode, setPoolMode] = useState<InputMode>(savedState.poolMode ?? 'manual')
  const [poolFee, setPoolFee] = useState<number | ''>(savedState.poolFee ?? '')
  const [selectedPool, setSelectedPool] = useState<string>(savedState.selectedPool ?? '')
  const [softwareMode, setSoftwareMode] = useState<InputMode>(savedState.softwareMode ?? 'manual')
  const [softwareFee, setSoftwareFee] = useState<number | ''>(savedState.softwareFee ?? '')
  const [selectedSoftware, setSelectedSoftware] = useState<string>(savedState.selectedSoftware ?? '')
  const [hardwareCost, setHardwareCost] = useState<number | ''>(savedState.hardwareCost ?? '')
  const [availableMonedas, setAvailableMonedas] = useState<MonedaAlgoritmosItem[]>([])
  const [availableCountries, setAvailableCountries] = useState<PaisElectricidad[]>([])
  const [availablePools, setAvailablePools] = useState<PoolItem[]>([])
  const [availableSoftware, setAvailableSoftware] = useState<SoftwareItem[]>([])
  const [hardwareByType, setHardwareByType] = useState<Partial<Record<HardwareType, HardwareItem[]>>>({})
  const [hardwareTab, setHardwareTab] = useState<HardwareType>(savedState.hardwareTab ?? 'gpu')
  const [selectedHardware, setSelectedHardware] = useState<SelectedHardwareItem[]>(savedState.selectedHardware ?? [])
  const [hardwareAutofill, setHardwareAutofill] = useState<boolean>(savedState.hardwareAutofill ?? false)
  const [hardwareSearchByType, setHardwareSearchByType] = useState<Record<HardwareType, string>>({
    cpu: '',
    gpu: '',
    asic: '',
  })
  const [hardwareOpenByType, setHardwareOpenByType] = useState<Record<HardwareType, boolean>>({
    cpu: false,
    gpu: false,
    asic: false,
  })
  const [isCalculating, setIsCalculating] = useState<boolean>(false)
  const [isMonedaOpen, setIsMonedaOpen] = useState<boolean>(false)
  const [isCountryOpen, setIsCountryOpen] = useState<boolean>(false)
  const [isSoftwareOpen, setIsSoftwareOpen] = useState<boolean>(false)
  const [isPoolOpen, setIsPoolOpen] = useState<boolean>(false)
  const [calcOutput, setCalcOutput] = useState<null | {
    beneficioDiario: number
    beneficioBrutoDiario?: number | null
    beneficioMensual: number
    beneficioAnual: number
    roiDias: number | null
    hashrate?: number | null
    consumoW?: number | null
    precioKwh?: number | null
    comision?: number | null
    costeEnergiaDiario?: number | null
    algoritmoUsado?: string | null
  }>(null)
  const [calcError, setCalcError] = useState<string>('')

  // Guardar estado en localStorage cuando cambia
  useEffect(() => {
    const formState: CalculatorFormState = {
      hashRate,
      hashRateUnit,
      powerW,
      elecCost,
      elecCostInput,
      electricityMode,
      selectedCountry,
      selectedMoneda,
      poolMode,
      poolFee,
      selectedPool,
      softwareMode,
      softwareFee,
      selectedSoftware,
      hardwareCost,
      selectedHardware,
      hardwareTab,
      hardwareAutofill,
    }
    saveFormState(formState)
  }, [
    hashRate,
    hashRateUnit,
    powerW,
    elecCost,
    elecCostInput,
    electricityMode,
    selectedCountry,
    selectedMoneda,
    poolMode,
    poolFee,
    selectedPool,
    softwareMode,
    softwareFee,
    selectedSoftware,
    hardwareCost,
    selectedHardware,
    hardwareTab,
    hardwareAutofill,
  ])

  const selectedMonedaAlgorithms = useMemo(() => {
    const normalizedSelectedMoneda = normalizeComparableName(selectedMoneda)
    const moneda = availableMonedas.find((item) => normalizeComparableName(item.nombre) === normalizedSelectedMoneda)
    return moneda?.algoritmos ?? null
  }, [availableMonedas, selectedMoneda])

  const monedaAlgorithmByName = useMemo(() => {
    return new Map(
      availableMonedas
        .filter((item) => item.algoritmos.length > 0)
        .map((item) => [
          normalizeComparableName(item.nombre),
          item.algoritmos.map((algorithm) => normalizeAlgorithm(algorithm)),
        ]),
    )
  }, [availableMonedas])

  const selectedSoftwareItem = useMemo(() => {
    if (softwareMode !== 'auto') {
      return null
    }

    const normalizedSelectedSoftware = normalizeComparableName(selectedSoftware)
    return availableSoftware.find((item) => normalizeComparableName(item.nombre) === normalizedSelectedSoftware) ?? null
  }, [availableSoftware, selectedSoftware, softwareMode])

  const selectedPoolItem = useMemo(() => {
    if (poolMode !== 'auto') {
      return null
    }

    const normalizedSelectedPool = normalizeComparableName(selectedPool)
    return availablePools.find((item) => normalizeComparableName(item.nombre) === normalizedSelectedPool) ?? null
  }, [availablePools, selectedPool, poolMode])

  const selectedHardwareAlgorithms = useMemo(() => {
    if (selectedHardware.length === 0) {
      return null
    }

    const perItemSets = selectedHardware.map((item) => toAlgorithmSet(getSelectedHardwareAlgorithmNames(item)))
    return intersectAlgorithmSets(perItemSets)
  }, [selectedHardware])

  const activeAlgorithms = useMemo(() => {
    return intersectAlgorithmSets([
      toAlgorithmSet(selectedMonedaAlgorithms),
      selectedSoftwareItem ? toAlgorithmSet(selectedSoftwareItem.algoritmos) : null,
      selectedPoolItem ? toAlgorithmSet(selectedPoolItem.algoritmos) : null,
      selectedHardwareAlgorithms,
    ])
  }, [selectedHardwareAlgorithms, selectedMonedaAlgorithms, selectedPoolItem, selectedSoftwareItem])

  useEffect(() => {
    let isMounted = true

    fetchMonedasParaCalculoConAlgoritmo()
      .then((items) => {
        if (isMounted) {
          setAvailableMonedas(items)
        }
      })
      .catch(() => {
        fetchMonedasParaCalculo()
          .then((items) => {
            if (isMounted) {
              setAvailableMonedas(items.map((nombre) => ({ nombre, algoritmos: [] })))
            }
          })
          .catch(() => undefined)
      })

    fetchPools()
      .then((items) => {
        if (isMounted) {
          setAvailablePools(items)
        }
      })
      .catch((error) => {
        console.error('[CalculatorPage] fetchPools error:', error)
      })

    fetchPaisesElectricidad()
      .then((items) => {
        if (isMounted) {
          setAvailableCountries(items)
        }
      })
      .catch(() => undefined)

    fetchSoftware()
      .then((items) => {
        if (isMounted) {
          setAvailableSoftware(items)
        }
      })
      .catch((error) => {
        console.error('[CalculatorPage] fetchSoftware error:', error)
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (hardwareByType[hardwareTab]) {
      return
    }

    let isCancelled = false

    fetchHardwareByType(hardwareTab)
      .then((items) => {
        if (!isCancelled) {
          setHardwareByType((prev) => ({
            ...prev,
            [hardwareTab]: items,
          }))
        }
      })
      .catch(() => undefined)

    return () => {
      isCancelled = true
    }
  }, [hardwareTab, hardwareByType])

  // Limpiar campos incompatibles cuando cambia la moneda seleccionada
  useEffect(() => {
    if (!selectedMoneda.trim()) {
      return
    }

    const monedaNorm = normalizeComparableName(selectedMoneda)

    // Validar y limpiar software si no es compatible
    if (selectedSoftware.trim() && softwareMode === 'auto') {
      const softwareItem = availableSoftware.find(
        (item) => normalizeComparableName(item.nombre) === normalizeComparableName(selectedSoftware),
      )
      if (
        !softwareItem ||
        !softwareItem.detallesAlgoritmoMoneda?.some((d) => normalizeComparableName(d.moneda) === monedaNorm)
      ) {
        setSelectedSoftware('')
      }
    }

    // Validar y limpiar pool si no es compatible
    if (selectedPool.trim() && poolMode === 'auto') {
      const poolItem = availablePools.find(
        (item) => normalizeComparableName(item.nombre) === normalizeComparableName(selectedPool),
      )
      if (!poolItem || !poolItem.monedas?.some((m) => normalizeComparableName(m) === monedaNorm)) {
        setSelectedPool('')
      }
    }

    // Validar y limpiar hardware si no es compatible con los algoritmos de la moneda
    const monedaAlgoritmos = availableMonedas
      .find((m) => normalizeComparableName(m.nombre) === monedaNorm)
      ?.algoritmos.map((a) => normalizeAlgorithm(a)) ?? []

    if (monedaAlgoritmos.length > 0 && selectedHardware.length > 0) {
      const monedaAlgoSet = new Set(monedaAlgoritmos)
      const hasIncompatibleHardware = selectedHardware.some((item) => {
        const itemAlgos = new Set(item.algorithms.map((a) => normalizeAlgorithm(a)))
        return !Array.from(monedaAlgoSet).some((algo) => itemAlgos.has(algo))
      })

      if (hasIncompatibleHardware) {
        setSelectedHardware([])
      } else {
        // Si el hardware ES compatible, forzar recálculo con el nuevo algoritmo
        setHardwareAutofill(true)
      }
    }
  }, [selectedMoneda, availableSoftware, availablePools, availableMonedas, softwareMode, poolMode, selectedHardware, selectedSoftware, selectedPool])

  const results = useMemo(() => {
    if (!calcOutput) {
      return {
        beneficioBrutoHorario: 0,
        beneficioHorario: 0,
        costeEnergiaHorario: 0,
        beneficioDiario: 0,
        beneficioMensual: 0,
        beneficioAnual: 0,
        roiDias: null,
        comision: 0,
        algoritmoUsado: null,
      }
    }

    return {
      beneficioBrutoHorario: (calcOutput.beneficioBrutoDiario ?? 0) / 24,
      beneficioHorario: (calcOutput.beneficioDiario ?? 0) / 24,
      costeEnergiaHorario: (calcOutput.costeEnergiaDiario ?? 0) / 24,
      beneficioDiario: calcOutput.beneficioDiario ?? 0,
      beneficioMensual: calcOutput.beneficioMensual ?? 0,
      beneficioAnual: calcOutput.beneficioAnual ?? 0,
      roiDias: calcOutput.roiDias ?? null,
      comision: calcOutput.comision ?? 0,
      algoritmoUsado: calcOutput.algoritmoUsado ?? null,
    }
  }, [calcOutput])

  const filteredMonedas = useMemo(() => {
    const term = selectedMoneda.trim().toLowerCase()
    return availableMonedas.filter((moneda) => {
      const matchesSearch = !term || moneda.nombre.toLowerCase().includes(term)
      const matchesAlgorithms = moneda.algoritmos.length > 0
        ? intersectsWithActiveAlgorithms(moneda.algoritmos, activeAlgorithms)
        : true
      return matchesSearch && matchesAlgorithms
    })
  }, [activeAlgorithms, availableMonedas, selectedMoneda])

  const filteredCountries = useMemo(() => {
    const term = selectedCountry.trim().toLowerCase()
    if (!term) {
      return availableCountries
    }
    return availableCountries.filter((item) => item.pais.toLowerCase().includes(term))
  }, [availableCountries, selectedCountry])

  const filteredSoftware = useMemo(() => {
    const term = selectedSoftware.trim().toLowerCase()
    let filtered = availableSoftware
    const monedaNorm = selectedMoneda.trim() ? normalizeComparableName(selectedMoneda) : null

    if (monedaNorm) {
      filtered = filtered.filter((item) => (item.detallesAlgoritmoMoneda ?? []).some((d) => normalizeComparableName(d.moneda) === monedaNorm))
    } else {
      filtered = filtered.filter((item) => intersectsWithActiveAlgorithms(item.algoritmos, activeAlgorithms))
    }

    if (!term) {
      return filtered
    }

    return filtered.filter((item) => item.nombre.toLowerCase().includes(term))
  }, [activeAlgorithms, availableSoftware, selectedSoftware])

  const filteredPools = useMemo(() => {
    const term = selectedPool.trim().toLowerCase()
    let filtered = availablePools
    const monedaNorm = selectedMoneda.trim() ? normalizeComparableName(selectedMoneda) : null

    if (monedaNorm) {
      filtered = filtered.filter((pool) => (pool.monedas ?? []).some((m) => normalizeComparableName(m) === monedaNorm))
    } else {
      filtered = filtered.filter((pool) => intersectsWithActiveAlgorithms(getPoolAlgorithmNames(pool, monedaAlgorithmByName), activeAlgorithms))
    }

    if (!term) {
      return filtered
    }

    return filtered.filter((pool) => pool.nombre.toLowerCase().includes(term))
  }, [activeAlgorithms, availablePools, monedaAlgorithmByName, selectedPool])

  const isProfitable = results.beneficioDiario >= 0

  const activeHardwareOptions = hardwareByType[hardwareTab] ?? []
  const hardwareSearchValue = hardwareSearchByType[hardwareTab]

  const filteredHardwareOptions = useMemo(() => {
    const term = hardwareSearchValue.trim().toLowerCase()
    let filtered = activeHardwareOptions
    
    // Apply algorithm compatibility filter if a coin is selected
    if (activeAlgorithms !== null) {
      filtered = filtered.filter((item) => intersectsWithActiveAlgorithms(getHardwareAlgorithmNames(item), activeAlgorithms))
    }
    
    if (!term) {
      return filtered
    }
    return filtered.filter((item) => item.name.toLowerCase().includes(term))
  }, [activeAlgorithms, activeHardwareOptions, hardwareSearchValue])

  const adjustValue = (
    current: number | '',
    step: number,
    direction: 1 | -1,
    setter: (next: number) => void,
    minValue = 0,
  ) => {
    const safeCurrent = typeof current === 'number' ? current : 0
    const next = Math.max(minValue, safeCurrent + step * direction)
    setter(Number(next.toFixed(6)))
  }

  const toHashesPerSecond = (value: number, unit: HashrateUnit): number => {
    switch (unit) {
      case 'H/s':
        return value
      case 'KH/s':
        return value * 1_000
      case 'MH/s':
        return value * 1_000_000
      case 'GH/s':
        return value * 1_000_000_000
      case 'TH/s':
        return value * 1_000_000_000_000
      default:
        return value
    }
  }

  const fromHashesPerSecond = (value: number, unit: HashrateUnit): number => {
    switch (unit) {
      case 'H/s':
        return value
      case 'KH/s':
        return value / 1_000
      case 'MH/s':
        return value / 1_000_000
      case 'GH/s':
        return value / 1_000_000_000
      case 'TH/s':
        return value / 1_000_000_000_000
      default:
        return value
    }
  }

  const getPreferredHashrateUnit = (valueInHashesPerSecond: number): HashrateUnit => {
    const absoluteValue = Math.abs(valueInHashesPerSecond)

    if (absoluteValue >= 1_000_000_000_000) {
      return 'TH/s'
    }

    if (absoluteValue >= 1_000_000_000) {
      return 'GH/s'
    }

    if (absoluteValue >= 1_000_000) {
      return 'MH/s'
    }

    if (absoluteValue >= 1_000) {
      return 'KH/s'
    }

    return 'H/s'
  }

  const getHardwareDisplayStatsForHardwareItem = (item: HardwareItem): string => {
    if (!selectedMoneda.trim()) return ''
    const selectedMonedaNorm = normalizeComparableName(selectedMoneda)
    const monedaData = availableMonedas.find((m) => normalizeComparableName(m.nombre) === selectedMonedaNorm)
    const monedaAlgorithm = monedaData?.algoritmos[0] ? normalizeAlgorithm(monedaData.algoritmos[0]) : null
    if (!monedaAlgorithm) return ''
    const algo = item.algorithms?.find((a) => normalizeAlgorithm(a.name) === monedaAlgorithm)
    if (algo && typeof algo.hashrateValue === 'number' && typeof algo.powerValue === 'number') {
      return `${formatHashrate(algo.hashrateValue, item.type)} · ${formatPower(algo.powerValue)}`
    }
    return ''
  }

  const getHardwareDisplayStatsForSelectedItem = (item: SelectedHardwareItem): string => {
    if (!selectedMoneda.trim()) return ''
    const selectedMonedaNorm = normalizeComparableName(selectedMoneda)
    const monedaData = availableMonedas.find((m) => normalizeComparableName(m.nombre) === selectedMonedaNorm)
    const monedaAlgorithm = monedaData?.algoritmos[0] ? normalizeAlgorithm(monedaData.algoritmos[0]) : null
    if (!monedaAlgorithm) return ''
    const algoData = item.algorithmDetails?.[monedaAlgorithm]
    if (algoData && typeof algoData.hashrateValue === 'number' && typeof algoData.powerValue === 'number') {
      return `${formatHashrate(algoData.hashrateValue, item.type)} · ${formatPower(algoData.powerValue)}`
    }
    return ''
  }

  const formatPrecioKwh = (value: number | null | undefined): string => {
    if (value == null || !Number.isFinite(value)) {
      return 'N/D'
    }

    return value.toLocaleString('es-ES', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    })
  }

  const formatMoney = (value: number): string => {
    return value.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const formatMoneyPrecise = (value: number): string => {
    return value.toLocaleString('es-ES', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })
  }

  const formatPercent = (value: number): string => {
    return value.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const parseLocaleNumber = (value: string): number | '' => {
    const normalized = value.trim().replace(/,/g, '.')
    if (!normalized) {
      return ''
    }

    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : ''
  }

  const setElecCostValue = (value: number) => {
    setElecCost(value)
    setElecCostInput(formatPrecioKwh(value))
  }

  useEffect(() => {
    if (!hardwareAutofill) {
      return
    }

    if (selectedHardware.length === 0) {
      setHashRate('')
      setPowerW('')
      return
    }

    // Obtener el algoritmo de la moneda seleccionada
    const selectedMonedaNorm = normalizeComparableName(selectedMoneda)
    const monedaData = availableMonedas.find(
      (m) => normalizeComparableName(m.nombre) === selectedMonedaNorm,
    )
    const monedaAlgorithm = monedaData?.algoritmos[0]
      ? normalizeAlgorithm(monedaData.algoritmos[0])
      : null

    // Calcular el hashrate total y la potencia usando el algoritmo específico
    const totalHashrate = selectedHardware.reduce((acc, item) => {
      if (monedaAlgorithm && item.algorithmDetails[monedaAlgorithm]) {
        const algoData = item.algorithmDetails[monedaAlgorithm]
        return acc + algoData.hashrateValue * item.quantity
      }
      // Fallback al valor nominal si no existe el algoritmo
      return acc + item.hashrateValue * item.quantity
    }, 0)

    const totalPower = selectedHardware.reduce((acc, item) => {
      if (monedaAlgorithm && item.algorithmDetails[monedaAlgorithm]) {
        const algoData = item.algorithmDetails[monedaAlgorithm]
        return acc + algoData.powerValue * item.quantity
      }
      // Fallback al valor nominal si no existe el algoritmo
      return acc + item.powerValue * item.quantity
    }, 0)

    const preferredUnit = getPreferredHashrateUnit(totalHashrate)
    const convertedHashrate = fromHashesPerSecond(totalHashrate, preferredUnit)

    setHashRateUnit(preferredUnit)
    setHashRate(Number(convertedHashrate.toFixed(6)))
    setPowerW(Number(totalPower.toFixed(2)))
  }, [selectedHardware, hardwareAutofill, selectedMoneda, availableMonedas])

  const addHardwareItem = (type: HardwareType, item: HardwareItem) => {
    setSelectedHardware((prev) => {
      const index = prev.findIndex(
        (entry) => entry.type === type && entry.rawName === item.rawName,
      )
      if (index >= 0) {
        const next = [...prev]
        next[index] = {
          ...next[index],
          quantity: next[index].quantity + 1,
        }
        return next
      }

      const algorithmDetails = item.algorithms.reduce(
        (acc, algo) => {
          acc[normalizeAlgorithm(algo.name)] = {
            hashrateValue: algo.hashrateValue,
            powerValue: algo.powerValue,
          }
          return acc
        },
        {} as Record<string, { hashrateValue: number; powerValue: number }>,
      )

      return [
        ...prev,
        {
          type,
          name: item.name,
          rawName: item.rawName,
          algorithm: item.algorithm,
          algorithms: item.algorithms.map((algorithm) => algorithm.name),
          algorithmDetails,
          hashrateValue: item.hashrateValue,
          powerValue: item.powerValue,
          quantity: 1,
        },
      ]
    })
    setHardwareAutofill(true)
    setHardwareSearchByType((prev) => ({
      ...prev,
      [type]: '',
    }))
    setHardwareOpenByType((prev) => ({
      ...prev,
      [type]: false,
    }))
  }

  const updateHardwareQuantity = (index: number, nextQuantity: number) => {
    setSelectedHardware((prev) => {
      if (nextQuantity <= 0) {
        return prev.filter((_, itemIndex) => itemIndex !== index)
      }
      const next = [...prev]
      next[index] = {
        ...next[index],
        quantity: nextQuantity,
      }
      return next
    })
    setHardwareAutofill(true)
  }

  const handleCalculate = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()

    // Validación en frontend, no llega a hacer la petición si falta algún campo
    const errors: string[] = []

    if (!selectedMoneda) {
      errors.push('Selecciona una criptomoneda.')
    }

    if (!(typeof hashRate === 'number' && Number.isFinite(hashRate) && hashRate > 0)) {
      errors.push('El campo Potencia de minado es obligatorio, selecciona hardware o introduce algún valor.')
    }

    if (!(typeof powerW === 'number' && Number.isFinite(powerW) && powerW >= 0)) {
      errors.push('El campo Consumo es obligatorio, selecciona hardware o introduce algún valor.')
    }

    if (electricityMode === 'manual' && !(typeof elecCost === 'number' && Number.isFinite(elecCost) && elecCost >= 0)) {
      errors.push('Introduce un precio de electricidad válido.')
    }

    if (errors.length > 0) {
      setCalcError(errors.join('\n'))
      return
    }

    const poolFromList = availablePools.find((pool) => pool.nombre === selectedPool)
    const softwareFromList = availableSoftware.find((item) => item.nombre === selectedSoftware)
    const manualPoolFee = typeof poolFee === 'number' ? poolFee : 0
    const manualSoftwareFee = typeof softwareFee === 'number' ? softwareFee : 0
    const effectivePoolFee = poolMode === 'auto' ? (poolFromList?.comision ?? 0) : manualPoolFee
    const effectiveSoftwareFee = softwareMode === 'auto' ? (softwareFromList?.comision ?? 0) : manualSoftwareFee
    const totalCommission = (effectivePoolFee > 0 ? effectivePoolFee : 0)
      + (effectiveSoftwareFee > 0 ? effectiveSoftwareFee : 0)

    const hashrateValue = typeof hashRate === 'number'
      ? toHashesPerSecond(hashRate, hashRateUnit)
      : null
    const consumoValue = typeof powerW === 'number' ? powerW : null
    const precioValue = electricityMode === 'manual' && typeof elecCost === 'number'
      ? elecCost
      : null
    const paisValue = electricityMode === 'country' && selectedCountry.trim()
      ? selectedCountry.trim()
      : null
    const hardwareCostValue = typeof hardwareCost === 'number' ? hardwareCost : null
    const hardwareItems = selectedHardware.length > 0
      ? selectedHardware.map((item) => ({
        tipoHardware: item.type.toUpperCase(),
        nombreHardware: item.rawName,
        cantidad: item.quantity,
      }))
      : undefined

    const payload = {
      hashrate: hashrateValue,
      moneda: selectedMoneda,
      consumoW: consumoValue,
      precioKwh: precioValue,
      pais: paisValue,
      comision: totalCommission,
      hardwareItems,
      pool: poolMode === 'auto' ? selectedPool || null : null,
      software: softwareMode === 'auto' ? selectedSoftware || null : null,
      costoInicialHardware: hardwareCostValue,
    }

    setIsCalculating(true)
    calcularRentabilidad(payload)
      .then((output) => {
        setCalcOutput(output)
        setCalcError('')
        requestAnimationFrame(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      })
      .catch((error) => {
        setCalcError(error instanceof Error ? error.message : 'Error en el cálculo')
        requestAnimationFrame(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      })
      .finally(() => setIsCalculating(false))
  }

  const resetForm = () => {
    setHashRate('')
    setHashRateUnit('H/s')
    setPowerW('')
    setElecCost('')
    setElecCostInput('')
    setElectricityMode('manual')
    setSelectedCountry('')
    setSelectedMoneda('')
    setPoolMode('manual')
    setPoolFee('')
    setSelectedPool('')
    setSoftwareMode('manual')
    setSoftwareFee('')
    setSelectedSoftware('')
    setHardwareCost('')
    setSelectedHardware([])
    setHardwareTab('gpu')
    setHardwareAutofill(false)
    setHardwareSearchByType({ cpu: '', gpu: '', asic: '' })
    setHardwareOpenByType({ cpu: false, gpu: false, asic: false })
    setCalcOutput(null)
    setCalcError('')
    setIsCalculating(false)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  return (
    <section className="calculator-page">
      <div className="calculator-page__header">
        <h2>Calculadora de rentabilidad</h2>
        <p>Cálculo de rentabilidad basados en los parámetros introducidos.</p>
      </div>

      <div className="calculator-page__content">
        <div className="card calculator-panel">
          <h3>Parámetros de Minería</h3>
          <p className="calculator-page__required-note">* Campo obligatorio</p>
          <form
            className="calculator-page__form"
            onSubmit={handleCalculate}
          >
            <label>
              <span className="calculator-page__label-text">
                Criptomoneda a minar <span className="calculator-page__required">*</span>
                <span className='calculator-page__field-note'>(limita software, pools y hardware)</span>
              </span>
              <div className="calculator-page__hint-field">
                <input
                  type="text"
                  className="calculator-page__label-inputs"
                  value={selectedMoneda}
                  onChange={(e) => {
                    setSelectedMoneda(e.target.value)
                    setIsMonedaOpen(true)
                  }}
                  onFocus={() => setIsMonedaOpen(true)}
                  onBlur={() => setTimeout(() => setIsMonedaOpen(false), 120)}
                  placeholder="Escribe o selecciona una moneda"
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-haspopup="listbox"
                  aria-controls="monedas-listbox"
                />
                {isMonedaOpen && filteredMonedas.length > 0 && (
                  <ul
                    id="monedas-listbox"
                    role="listbox"
                    className="calculator-page__dropdown"
                  >
                    {filteredMonedas.map((moneda) => (
                      <li
                            key={moneda.nombre}
                        role="option"
                        tabIndex={-1}
                        className="calculator-page__dropdown-item"
                        onMouseDown={async () => {
                              setSelectedMoneda(moneda.nombre)
                          setIsMonedaOpen(false)
                        }}
                      >
                            <div className="calculator-page__dropdown-title">{moneda.nombre}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </label>
            
            <div className="calculator-page__field">
              <div className="calculator-page__label-row">
                <label className="calculator-page__label-text" htmlFor="hashrate-input">
                  Potencia de minado <span className="calculator-page__required">*</span>
                </label>
                <span className="calculator-page__unit-wrap">
                  <select
                    className="calculator-page__unit-select"
                    value={hashRateUnit}
                    onChange={(e) => setHashRateUnit(e.target.value as HashrateUnit)}
                    aria-label="Unidad de potencia de minado"
                  >
                    <option value="H/s">H/s</option>
                    <option value="KH/s">KH/s</option>
                    <option value="MH/s">MH/s</option>
                    <option value="GH/s">GH/s</option>
                    <option value="TH/s">TH/s</option>
                  </select>
                  <ChevronDown size={14} aria-hidden="true" className="calculator-page__unit-icon" />
                </span>
              </div>
              <div className="number-input">
                <input
                  id="hashrate-input"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  className="calculator-page__label-inputs number-input__field"
                  value={hashRate}
                  onChange={(e) => {
                    setHardwareAutofill(false)
                    setHashRate(parseLocaleNumber(e.target.value))
                  }}
                  placeholder="0,0"
                />
                <span className="calculator-page__field-note">Se rellena automáticamente al seleccionar hardware</span>

                <div className="number-input__controls">
                  <button
                    type="button"
                    aria-label="Incrementar"
                    onClick={() => {
                      setHardwareAutofill(false)
                      adjustValue(hashRate, 0.1, 1, setHashRate)
                    }}
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Reducir"
                    onClick={() => {
                      setHardwareAutofill(false)
                      adjustValue(hashRate, 0.1, -1, setHashRate)
                    }}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
            </div>

            <label>
              <span className="calculator-page__label-text">
                Consumo (W)
                <span className="calculator-page__required">*</span>
              </span>
              <div className="number-input">
                <input
                  type="number"
                  className="calculator-page__label-inputs number-input__field"
                  value={powerW}
                  onChange={(e) => {
                    setHardwareAutofill(false)
                    setPowerW(e.target.value === '' ? '' : Number(e.target.value))
                  }}
                  min={0}
                  step={1}
                  placeholder='0'
                />
                <span className="calculator-page__field-note">Se rellena automáticamente al seleccionar hardware</span>

                <div className="number-input__controls">
                  <button
                    type="button"
                    aria-label="Incrementar"
                    onClick={() => {
                      setHardwareAutofill(false)
                      adjustValue(powerW, 1, 1, setPowerW)
                    }}
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Reducir"
                    onClick={() => {
                      setHardwareAutofill(false)
                      adjustValue(powerW, 1, -1, setPowerW)
                    }}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
            </label>

            <div className="calculator-page__field">
              <span className="calculator-page__label-text">
                Hardware utilizado
                <span className='calculator-page__field-note'>(filtrado por algoritmo)</span>
              </span>
              <div className="hardware-tabs" role="tablist" aria-label="Tipo de hardware">
                {(['cpu', 'gpu', 'asic'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={hardwareTab === tab}
                    className={`hardware-tab${hardwareTab === tab ? ' hardware-tab--active' : ''}`}
                    onClick={() => {
                      setHardwareTab(tab)
                      setHardwareOpenByType(closedHardwareDropdownState)
                    }}
                  >
                    {hardwareTabLabels[tab]}
                  </button>
                ))}
              </div>

              <div className="calculator-page__hint-field">
                <input
                  type="text"
                  className="calculator-page__label-inputs"
                  value={hardwareSearchValue}
                  onChange={(e) => {
                    const nextValue = e.target.value
                    setHardwareSearchByType((prev) => ({
                      ...prev,
                      [hardwareTab]: nextValue,
                    }))
                    setHardwareOpenByType((prev) => ({
                      ...prev,
                      [hardwareTab]: true,
                    }))
                  }}
                  onFocus={() =>
                    setHardwareOpenByType((prev) => ({
                      ...prev,
                      [hardwareTab]: true,
                    }))
                  }
                  onBlur={() =>
                    setTimeout(() =>
                      setHardwareOpenByType(closedHardwareDropdownState),
                      120)
                  }
                  placeholder={`Buscar ${hardwareTabLabels[hardwareTab]}...`}
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-haspopup="listbox"
                  aria-controls="hardware-listbox"
                />
                {hardwareOpenByType[hardwareTab] && filteredHardwareOptions.length > 0 && (
                  <ul
                    id="hardware-listbox"
                    role="listbox"
                    className="calculator-page__dropdown"
                  >
                    {filteredHardwareOptions.map((item) => (
                      <li
                        key={`${hardwareTab}-${item.rawName}`}
                        role="option"
                        tabIndex={-1}
                        className="calculator-page__dropdown-item"
                        onMouseDown={() => addHardwareItem(hardwareTab, item)}
                      >
                        <div className="calculator-page__dropdown-title">{item.name}</div>
                        <div className="calculator-page__dropdown-sub">
                          {(() => {
                            const stats = getHardwareDisplayStatsForHardwareItem(item)
                            return stats ? (
                              stats
                            ) : (
                              <em style={{ color: '#7a8fa3', fontSize: '12px' }}>Selecciona una moneda para ver valores por algoritmo</em>
                            )
                          })()}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {hardwareOpenByType && hardwareByType[hardwareTab] !== undefined && filteredHardwareOptions.length === 0 && (
                  <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#d9534f' }}>
                    No encontramos {hardwareTabLabels[hardwareTab]}s compatibles con la moneda seleccionada
                  </p>
                )}
              </div>
              {selectedHardware.length > 0 && (
                <div className="calculator-page__selected-hardware">
                  {selectedHardware.map((item, index) => (
                    <div key={`${item.type}-${item.rawName}`} className="calculator-page__selected-item">
                      <div>
                        <div className="calculator-page__dropdown-title">{item.name}</div>
                        <div className="calculator-page__dropdown-sub">
                          {(() => {
                            const stats = getHardwareDisplayStatsForSelectedItem(item)
                            return stats ? (
                              `${item.type.toUpperCase()} · ${stats}`
                            ) : (
                              item.type.toUpperCase()
                            )
                          })()}
                        </div>
                      </div>
                      <div className="calculator-page__selected-controls">
                        <button
                          type="button"
                          className="calculator-page__qty-button"
                          aria-label="Reducir cantidad"
                          onClick={() => updateHardwareQuantity(index, item.quantity - 1)}
                        >
                          -
                        </button>
                        <span className="calculator-page__qty-value">{item.quantity}</span>
                        <button
                          type="button"
                          className="calculator-page__qty-button"
                          aria-label="Incrementar cantidad"
                          onClick={() => updateHardwareQuantity(index, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="calculator-page__field">
              <span className="calculator-page__label-text">
                Precio electricidad (€/kWh)
                <span className="calculator-page__required">*</span>
              </span>
              <div className="toggle-group">
                <button
                  type="button"
                  className={electricityMode === 'manual' ? 'is-active' : ''}
                  onClick={() => setElectricityMode('manual')}
                >
                  Manual
                </button>
                <button
                  type="button"
                  className={electricityMode === 'country' ? 'is-active' : ''}
                  onClick={() => setElectricityMode('country')}
                >
                  Seleccionar país
                </button>
              </div>
              {electricityMode === 'manual' ? (
                <div className="number-input">
                  <input
                    type="text"
                    inputMode="decimal"
                    className="calculator-page__label-inputs number-input__field"
                    value={elecCostInput}
                    onChange={(e) => {
                      const raw = e.target.value
                      setElecCostInput(raw)
                      setElecCost(parseLocaleNumber(raw))
                    }}
                    min={0}
                    step={0.01}
                    placeholder="0,00"
                  />
                  <div className="number-input__controls">
                    <button
                      type="button"
                      aria-label="Incrementar"
                      onClick={() => adjustValue(elecCost, 0.001, 1, setElecCostValue)}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label="Reducir"
                      onClick={() => adjustValue(elecCost, 0.001, -1, setElecCostValue)}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="calculator-page__hint-field">
                  <input
                    type="text"
                    className="calculator-page__label-inputs"
                    value={selectedCountry}
                    onChange={(e) => {
                      setSelectedCountry(e.target.value)
                      setIsCountryOpen(true)
                    }}
                    onFocus={() => setIsCountryOpen(true)}
                    onBlur={() => setTimeout(() => setIsCountryOpen(false), 120)}
                    placeholder="Escribe o selecciona un país"
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-haspopup="listbox"
                    aria-controls="paises-listbox"
                  />
                  {isCountryOpen && filteredCountries.length > 0 && (
                    <ul
                      id="paises-listbox"
                      role="listbox"
                      className="calculator-page__dropdown"
                    >
                      {filteredCountries.map((item) => (
                        <li
                          key={item.pais}
                          role="option"
                          tabIndex={-1}
                          className="calculator-page__dropdown-item"
                          onMouseDown={() => setSelectedCountry(item.pais)}
                        >
                          <div className="calculator-page__dropdown-title">{item.pais}</div>
                          <div className="calculator-page__dropdown-sub">
                            {formatPrecioKwh(item.precioKwh)} €/kWh
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="calculator-page__field">
              <span className="calculator-page__label-text">Comisión de software minero (%)</span>
              <div className="toggle-group">
                <button
                  type="button"
                  className={softwareMode === 'manual' ? 'is-active' : ''}
                  onClick={() => setSoftwareMode('manual')}
                >
                  Manual
                </button>
                <button
                  type="button"
                  className={softwareMode === 'auto' ? 'is-active' : ''}
                  onClick={() => setSoftwareMode('auto')}
                >
                  Seleccionar software
                </button>
              </div>
              {softwareMode === 'manual' ? (
                <div className="number-input">
                  <input
                    type="number"
                    className="calculator-page__label-inputs number-input__field"
                    value={softwareFee}
                    onChange={(e) => setSoftwareFee(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder='0,00'
                    min={0}
                    step={0.01}
                  />
                  <div className="number-input__controls">
                    <button
                      type="button"
                      aria-label="Incrementar"
                      onClick={() => adjustValue(softwareFee, 0.1, 1, setSoftwareFee)}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label="Reducir"
                      onClick={() => adjustValue(softwareFee, 0.1, -1, setSoftwareFee)}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="calculator-page__hint-field">
                  <input
                    type="text"
                    className="calculator-page__label-inputs"
                    value={selectedSoftware}
                    onChange={(e) => {
                      setSelectedSoftware(e.target.value)
                      setIsSoftwareOpen(true)
                    }}
                    onFocus={() => setIsSoftwareOpen(true)}
                    onBlur={() => setTimeout(() => setIsSoftwareOpen(false), 120)}
                    placeholder="Escribe o selecciona un software"
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-haspopup="listbox"
                    aria-controls="software-listbox"
                  />
                  {isSoftwareOpen && filteredSoftware.length > 0 && (
                    <ul
                      id="software-listbox"
                      role="listbox"
                      className="calculator-page__dropdown"
                    >
                      {filteredSoftware.map((item) => (
                        <li
                          key={item.nombre}
                          role="option"
                          tabIndex={-1}
                          className="calculator-page__dropdown-item"
                          onMouseDown={() => setSelectedSoftware(item.nombre)}
                        >
                          <div className="calculator-page__dropdown-title">{item.nombre}</div>
                          <div className="calculator-page__dropdown-sub">
                            {formatPercent(item.comision)}% comisión
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {softwareMode === 'auto' && selectedMoneda && filteredSoftware.length === 0 && (
                <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#d9534f' }}>
                  No encontramos software mineros que den soporte a <strong>{selectedMoneda}</strong>
                </p>
              )}
            </div>

            <div className="calculator-page__field">
              <span className="calculator-page__label-text">Comisión de pool (%)</span>
              <div className="toggle-group">
                <button
                  type="button"
                  className={poolMode === 'manual' ? 'is-active' : ''}
                  onClick={() => setPoolMode('manual')}
                >
                  Manual
                </button>
                <button
                  type="button"
                  className={poolMode === 'auto' ? 'is-active' : ''}
                  onClick={() => setPoolMode('auto')}
                >
                  Seleccionar pool
                </button>
              </div>
              {poolMode === 'manual' ? (
                <div className="number-input">
                  <input
                    type="number"
                    className="calculator-page__label-inputs number-input__field"
                    value={poolFee}
                    onChange={(e) => setPoolFee(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder='0,00'
                    min={0}
                    step={0.01}
                  />
                  <div className="number-input__controls">
                    <button
                      type="button"
                      aria-label="Incrementar"
                      onClick={() => adjustValue(poolFee, 0.1, 1, setPoolFee)}
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label="Reducir"
                      onClick={() => adjustValue(poolFee, 0.1, -1, setPoolFee)}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="calculator-page__hint-field">
                  <input
                    type="text"
                    className="calculator-page__label-inputs"
                    value={selectedPool}
                    onChange={(e) => {
                      setSelectedPool(e.target.value)
                      setIsPoolOpen(true)
                    }}
                    onFocus={() => setIsPoolOpen(true)}
                    onBlur={() => setTimeout(() => setIsPoolOpen(false), 120)}
                    placeholder="Escribe o selecciona una pool"
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-haspopup="listbox"
                    aria-controls="pools-listbox"
                  />
                  {isPoolOpen && filteredPools.length > 0 && (
                    <ul
                      id="pools-listbox"
                      role="listbox"
                      className="calculator-page__dropdown"
                    >
                      {filteredPools.map((pool) => (
                        <li
                          key={pool.nombre}
                          role="option"
                          tabIndex={-1}
                          className="calculator-page__dropdown-item"
                          onMouseDown={() => setSelectedPool(pool.nombre)}
                        >
                          <div className="calculator-page__dropdown-title">{pool.nombre}</div>
                          <div className="calculator-page__dropdown-sub">
                            {formatPercent(pool.comision)}% comisión
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {poolMode === 'auto' && selectedMoneda && filteredPools.length === 0 && (
                <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#d9534f' }}>
                  No encontramos pools que den soporte a <strong>{selectedMoneda}</strong>
                </p>
              )}
            </div>


            <label>
              Coste inicial del hardware (€)
              <div className="number-input">
                <input
                  type="number"
                  className="calculator-page__label-inputs number-input__field"
                  value={hardwareCost}
                  onChange={(e) => setHardwareCost(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder='0'
                  min={0}
                  step={1}
                />
                <div className="number-input__controls">
                  <button
                    type="button"
                    aria-label="Incrementar"
                    onClick={() => adjustValue(hardwareCost, 1, 1, setHardwareCost)}
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="Reducir"
                    onClick={() => adjustValue(hardwareCost, 1, -1, setHardwareCost)}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
            </label>

            <div className="calculator-page__actions">
              <button
                type="submit"
                className="calculator-page__submit"
                disabled={isCalculating}
              >
                {isCalculating ? 'Calculando...' : 'Calcular'}
              </button>
              <button
                type="button"
                className="calculator-page__clear"
                onClick={resetForm}
                disabled={isCalculating}
              >
                Limpiar
              </button>
            </div>

          </form>
        </div>

        <div ref={resultsRef} className="calculator-page__results">

          <div className={isProfitable ? 'card status-card status-card--positive' : 'card status-card status-card--negative'}>
            <div className="status-card__title">
              {isProfitable ? (
                <TrendingUp className="status-card__icon" />
              ) : (
                <TrendingDown className="status-card__icon" />
              )}
              <h3>{isProfitable ? 'Rentable' : 'No rentable'}</h3>
            </div>
            <p>{isProfitable ? 'Tu configuración genera beneficios' : 'Los costes superan a los ingresos'}</p>
          </div>

          <div className="card results-card">
            <h4>Resultado por hora</h4>
            <div className="results-row">
              <span>Beneficio bruto</span>
              <span className="results-value">€ {formatMoneyPrecise(results.beneficioBrutoHorario)}</span>
            </div>
            <div className="results-row">
              <span>Comisión total aplicada</span>
              <span className="results-value">{formatPercent(results.comision)}%</span>
            </div>
            <div className="results-row">
              <span>Gasto en electricidad</span>
              <span className="results-value">€ {formatMoneyPrecise(results.costeEnergiaHorario)}</span>
            </div>
            <div className="results-row">
              <span>Algoritmo</span>
              <span className="results-value">{results.algoritmoUsado ?? 'N/D'}</span>
            </div>
            <div className="results-divider" />
            <div className="results-row results-row--highlight">
              <span>Beneficio Neto</span>
              <span className={isProfitable ? 'results-value results-value--positive' : 'results-value results-value--negative'}>
                € {formatMoneyPrecise(results.beneficioHorario)}
              </span>
            </div>
          </div>

          <div className="card results-card">
            <h4>Proyecciones</h4>
            <div className="results-grid">
              <div className="projection-card">
                <span>Diario</span>
                <strong className={results.beneficioDiario >= 0 ? 'projection-card__value' : 'projection-card__value projection-card__value--negative'}>
                  € {formatMoney(results.beneficioDiario)}
                </strong>
              </div>
              <div className="projection-card">
                <span>Mensual</span>
                <strong className={results.beneficioMensual >= 0 ? 'projection-card__value' : 'projection-card__value projection-card__value--negative'}>
                  € {formatMoney(results.beneficioMensual)}
                </strong>
              </div>
              <div className="projection-card">
                <span>Anual</span>
                <strong className={results.beneficioAnual >= 0 ? 'projection-card__value' : 'projection-card__value projection-card__value--negative'}>
                  € {formatMoney(results.beneficioAnual)}
                </strong>
              </div>
            </div>
          </div>

          {activeAlgorithms && activeAlgorithms.size > 0 && (
            <div className="algorithms-card">
              <h4 className="algorithms-card__label">Algoritmos filtrando actualmente</h4>
              <div className="algorithms-card__value">
                {Array.from(activeAlgorithms)
                  .map((algo) => algo.charAt(0).toUpperCase() + algo.slice(1))
                  .join(', ')}
              </div>
            </div>
          )}

          <div className="card results-card">
            <h4>Retorno de Inversión</h4>
            <div className="roi-row">
              <span className="roi-icon">$</span>
              <div>
                <p>Punto de Equilibrio</p>
                <strong>
                  {results.roiDias == null ? 'N/D' : `${Math.round(results.roiDias)} días`}
                </strong>
              </div>
            </div>
          </div>
          {calcError ? (
            <div className="card results-card">
              <h4>Error de cálculo</h4>
              <p className="negative">{calcError}</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
