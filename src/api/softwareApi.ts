import { getJson } from './httpClient'
import type { SoftwareAlgoritmoMonedaItem, SoftwareItem } from '../types/software'

type RawSoftware = {
	nombre?: string
	hardwareUsable?: string[]
	comision?: number
	algoritmos?: string[]
	sistemas?: string[]
	detallesAlgoritmoMoneda?: Array<{
		moneda?: string
		algoritmo?: string
		comision?: number
	}>

}

function normalizeList(values: string[] | null | undefined): string[] {
	if (!values || values.length === 0) {
		return []
	}

	return values
		.map((value) => value?.trim())
		.filter((value): value is string => Boolean(value))
}

function toSoftwareAlgorithmItems(
	values: RawSoftware['detallesAlgoritmoMoneda'] | null | undefined,
): SoftwareAlgoritmoMonedaItem[] {
	if (!values || values.length === 0) {
		return []
	}

	return values
		.map((value) => ({
			moneda: value.moneda?.trim() || 'Sin moneda',
			algoritmo: value.algoritmo?.trim() || 'Sin algoritmo',
			comision: value.comision ?? 0,
		}))
		.filter((value) => value.moneda !== 'Sin moneda' || value.algoritmo !== 'Sin algoritmo')
}

function toSoftwareItem(raw: RawSoftware): SoftwareItem {
	const detallesAlgoritmoMoneda = toSoftwareAlgorithmItems(raw.detallesAlgoritmoMoneda)
	const algoritmos = raw.algoritmos && raw.algoritmos.length > 0
		? normalizeList(raw.algoritmos)
		: Array.from(new Set(detallesAlgoritmoMoneda.map((item) => item.algoritmo)))
	const comision = raw.comision ?? detallesAlgoritmoMoneda[0]?.comision ?? 0

	return {
		nombre: raw.nombre?.trim() || 'Sin nombre',
		hardwareUsable: normalizeList(raw.hardwareUsable),
		detallesAlgoritmoMoneda,
		algoritmos,
		sistemas: normalizeList(raw.sistemas),
		comision,

	}
}

export async function fetchSoftware(): Promise<SoftwareItem[]> {
	const items = await getJson<RawSoftware[]>('/api/software')
	return items.map(toSoftwareItem)
}

export async function fetchSoftwareNamesByAlgorithm(algoritmo: string): Promise<string[]> {
	return getJson<string[]>(`/api/software/byAlgoritmo/${encodeURIComponent(algoritmo)}`)
}
