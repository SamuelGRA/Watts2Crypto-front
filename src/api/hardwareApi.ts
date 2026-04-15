import { getJson } from './httpClient'
import type { HardwareItem, HardwareType } from '../types/hardware'

type RawPerformance = { //Performance es la entidad RendimientoAlgoritmo del backend
  hashrate: number
  consumo: number
}

type RawHardware = {
  nombre: string
  consumoNominal: number
  hashrateNominal: number
  algorithms: Record<string, RawPerformance>
}

const ENDPOINT_BY_TYPE: Record<HardwareType, string> = {
  gpu: '/api/gpus',
  cpu: '/api/cpus',
  asic: '/api/asics',
}

const CPU_DEFAULT_ALGORITHM = 'RandomX'

const EXPLICIT_BRAND_PATTERNS = [
  /\bnvidia\b/i,
  /\bamd\b/i,
  /\bintel\b/i,
  /\bbitmain\b/i,
  /\bantminer\b/i,
  /\bmicrobt\b/i,
  /\bwhatsminer\b/i,
  /\bcanaan\b/i,
  /\bavalon(?:miner)?\b/i,
  /\bgoldshell\b/i,
  /\biceriver\b/i,
  /\bjasminer\b/i,
  /\bipollo\b/i,
  /\binnosilicon\b/i,
  /\bibelink\b/i,
  /\belphapex\b/i,
  /\bbombax\b/i,
  /\blinzhi\b/i,
  /\bstrongu\b/i,
]

const BRAND_RULES_BY_TYPE: Record<HardwareType, Array<{ brand: string; pattern: RegExp }>> = {
  gpu: [
    { brand: 'NVIDIA', pattern: /(\brtx\b|\bgtx\b|\bgeforce\b|\bquadro\b)/i },
    { brand: 'AMD', pattern: /(\brx\s*\d|\bradeon\b)/i },
    { brand: 'Intel', pattern: /(\barc\b|\ba\d{3}\b)/i },
  ],
  cpu: [
    { brand: 'Intel', pattern: /(\bi[3579][-\s]?\d|\bxeon\b|\bceleron\b|\bpentium\b|\bcore\b)/i },
    { brand: 'AMD', pattern: /(\bryzen\b|\bthreadripper\b|\bepyc\b|\bathlon\b|\bbc\b)/i },
  ],
  asic: [], //Se decidió no añadir nombres de marcas de ASIC por ambigüedad en los modelos
}

function hasBrandToken(name: string): boolean {
  return EXPLICIT_BRAND_PATTERNS.some((pattern) => pattern.test(name))
}

function inferBrand(name: string, type: HardwareType): string | null {
  for (const rule of BRAND_RULES_BY_TYPE[type]) {
    if (rule.pattern.test(name)) {
      return rule.brand
    }
  }

  return null
}

function withInferredBrand(rawName: string | null | undefined, type: HardwareType): string {
  const name = rawName?.trim() || 'Sin nombre'

  if (hasBrandToken(name)) {
    return name
  }

  // Los nombres de los modelos son ambiguos en las marcas de ASIC, por lo que solo se pondrá el nombre de
  //la amrca si viene explícitamente del backend
  if (type === 'asic') {
    return name
  }

  const inferredBrand = inferBrand(name, type)
  if (!inferredBrand) {
    return name
  }

  return `${inferredBrand} ${name}`
}

type HashUnit = { divisor: number; label: string }

const HASH_UNITS: Record<HardwareType, HashUnit[]> = {
  gpu: [
    { divisor: 1000000, label: 'MH/s' },
    { divisor: 1000, label: 'KH/s' },
    { divisor: 1, label: 'H/s' },
  ],
  cpu: [
    { divisor: 1000, label: 'KH/s' },
    { divisor: 1, label: 'H/s' },
  ],
  asic: [
    { divisor: 1000000000000, label: 'TH/s' },
    { divisor: 1000000000, label: 'GH/s' },
    { divisor: 1000000, label: 'MH/s' },
    { divisor: 1000, label: 'KH/s' },
    { divisor: 1, label: 'H/s' },
  ],
}

function formatHashrate(value: number, type: HardwareType): string {
  if (value == null) {
    return 'N/D'
  }

  for (const { divisor, label } of HASH_UNITS[type]) {
    const rounded = Math.round(value / divisor)
    if (rounded > 0) {
      return `${rounded} ${label}`
    }
  }

  return '0 H/s'
}

function formatPower(value: number): string {
  if (value == null) {
    return 'N/D'
  }

  return `${value}W`
}

function getAlgorithms(raw: RawHardware): Record<string, RawPerformance> {
  return raw.algorithms ?? {}
}

function getMostProfitableAlgorithm(type: HardwareType, raw: RawHardware): string {
  if (type === 'cpu') {
    return CPU_DEFAULT_ALGORITHM
  }

  const algorithms = Object.entries(getAlgorithms(raw))

  if (algorithms.length === 0) {
    return 'N/D'
  }

  let bestName = algorithms[0][0]
  let bestScore = Number.NEGATIVE_INFINITY

  for (const [name, performance] of algorithms) {
    if (performance.consumo <= 0) {
      continue
    }

    const score = performance.hashrate / performance.consumo
    if (score > bestScore) {
      bestScore = score
      bestName = name
    }
  }

  return bestName
}

function mapAlgorithms(type: HardwareType, raw: RawHardware) {
  if (type === 'cpu') {
    return [
      {
        name: CPU_DEFAULT_ALGORITHM,
        hashrate: formatHashrate(raw.hashrateNominal, type),
        power: formatPower(raw.consumoNominal),
      },
    ]
  }

  return Object.entries(getAlgorithms(raw)).map(([name, performance]) => ({
    name,
    hashrate: formatHashrate(performance.hashrate, type),
    power: formatPower(performance.consumo),
  }))
}

function toHardwareItem(type: HardwareType, raw: RawHardware): HardwareItem {
  const rawHashrate = raw.hashrateNominal
  const rawPower = raw.consumoNominal
  const algorithms = mapAlgorithms(type, raw)

  return {
    name: withInferredBrand(raw.nombre, type),
    hashrate: formatHashrate(rawHashrate, type),
    algorithm: getMostProfitableAlgorithm(type, raw),
    power: formatPower(rawPower),
    algorithms,
  }
}

export async function fetchHardwareByType(type: HardwareType): Promise<HardwareItem[]> {
  const rawItems = await getJson<RawHardware[]>(ENDPOINT_BY_TYPE[type])
  return rawItems.map((item) => toHardwareItem(type, item))
}
