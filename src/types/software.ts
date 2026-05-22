export type SoftwareAlgoritmoMonedaItem = {
  moneda: string
  algoritmo: string
  comision: number
}

export type SoftwareBackendItem = {
  nombre: string
  hardwareUsable: string[]
  detallesAlgoritmoMoneda: SoftwareAlgoritmoMonedaItem[]
  sistemas: string[]
}

export type SoftwareItem = SoftwareBackendItem & {
  algoritmos: string[]
  comision: number
}