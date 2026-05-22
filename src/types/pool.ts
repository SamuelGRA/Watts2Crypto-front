export type PoolMonedaComisionItem = {
  moneda: string
  comision: number
}

export type PoolBackendItem = {
  nombre: string
  esquemaDePago: string[]
  regiones: string[]
  detallesMonedaComision: PoolMonedaComisionItem[]
  monedas: string[]
}

export type PoolItem = PoolBackendItem & {
  algoritmos: string[]
  comision: number
}