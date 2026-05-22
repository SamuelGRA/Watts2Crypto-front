export type HardwareType = 'gpu' | 'cpu' | 'asic'

export type HardwareAlgorithm = {
  name: string
  hashrateValue: number
  powerValue: number
}

export type HardwareItem = {
  type: HardwareType
  rawName: string
  name: string
  hashrateValue: number
  algorithm: string
  powerValue: number
  algorithms: HardwareAlgorithm[]
}
