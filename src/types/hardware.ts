export type HardwareType = 'gpu' | 'cpu' | 'asic'

export type HardwareAlgorithm = {
  name: string
  hashrate: string
  power: string
}

export type HardwareItem = {
  name: string
  hashrate: string
  algorithm: string
  power: string
  algorithms: HardwareAlgorithm[]
}
