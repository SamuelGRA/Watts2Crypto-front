export type CalculoInput = {
	hashrate?: number | null
	moneda: string
	consumoW?: number | null
	precioKwh?: number | null
	comision?: number | null
	hardwareItems?: Array<{ tipoHardware: string; nombreHardware: string; cantidad?: number | null }>
	algoritmo?: string | null
	pais?: string | null
	pool?: string | null
	software?: string | null
	costoInicialHardware?: number | null
}

export type CalculoOutput = {
	beneficioDiario: number
	beneficioMensual: number
	beneficioAnual: number
	roiDias: number | null
	hashrate?: number | null
	consumoW?: number | null
	precioKwh?: number | null
	comision?: number | null
	algoritmoUsado?: string | null
}

export type MetricasMoneda = {
	algoritmo: string
}
