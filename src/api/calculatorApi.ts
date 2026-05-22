import { getJson, postJson } from './httpClient'
import type { CalculoInput, CalculoOutput, MetricasMoneda } from '../types/calculo'
import type { PaisElectricidad } from '../types/paisElectricidad'

type RawMetricasMoneda = {
	algoritmo: string
}

export type MonedaAlgoritmos = {
	nombre: string
	algoritmos: string[]
}

export async function calcularRentabilidad(input: CalculoInput): Promise<CalculoOutput> {
	return postJson<CalculoOutput, CalculoInput>('/api/calculo/rentabilidad', input)
}

export async function fetchMonedasParaCalculo(): Promise<string[]> {
	return getJson<string[]>('/api/calculo/monedasParaCalculo')
}

export async function fetchMonedasParaCalculoConAlgoritmo(): Promise<MonedaAlgoritmos[]> {
	return getJson<MonedaAlgoritmos[]>('/api/calculo/monedasParaCalculoConAlgoritmo')
}

export async function fetchMetricasMoneda(moneda: string): Promise<MetricasMoneda> {
	const res = await getJson<RawMetricasMoneda>(`/api/calculo/metricas/${encodeURIComponent(moneda)}`)
	return {
		algoritmo: res.algoritmo,
	}
}

export async function fetchPaisesElectricidad(): Promise<PaisElectricidad[]> {
	const items = await getJson<PaisElectricidad[]>('/api/calculo/paisesElectricidad')
	return items.map((item) => ({
		...item,
		precioKwh: Number(item.precioKwh),
	}))
}
