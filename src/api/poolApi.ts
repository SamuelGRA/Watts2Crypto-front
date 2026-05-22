import { getJson } from './httpClient'
import type { PoolItem, PoolMonedaComisionItem } from '../types/pool'

type RawPool = {
	nombre?: string
	comision?: number
	esquemaDePago?: string[] | string
	regiones?: string[]
	monedas?: string[]
	algoritmos?: string[]
	detallesMonedaComision?: Array<{
		moneda?: string
		comision?: number
	}>
}

function normalizeList(values: string[] | string | null | undefined): string[] {
	if (!values) {
		return []
	}

	const source = Array.isArray(values) ? values : [values]

	return source
		.map((value) => value?.trim())
		.filter((value): value is string => Boolean(value))
}

function toPoolMonedaComisionItems(
	values: RawPool['detallesMonedaComision'] | null | undefined,
): PoolMonedaComisionItem[] {
	if (!values || values.length === 0) {
		return []
	}

	return values
		.map((value) => ({
			moneda: value.moneda?.trim() || 'Sin moneda',
			comision: value.comision ?? 0,
		}))
		.filter((value) => value.moneda !== 'Sin moneda')
}

function toPoolItem(raw: RawPool): PoolItem {
	const detallesMonedaComision = toPoolMonedaComisionItems(raw.detallesMonedaComision)
	const monedas = raw.monedas && raw.monedas.length > 0
		? normalizeList(raw.monedas)
		: Array.from(new Set(detallesMonedaComision.map((item) => item.moneda)))
	const comision = raw.comision ?? detallesMonedaComision[0]?.comision ?? 0

	return {
		nombre: raw.nombre?.trim() || 'Sin nombre',
		esquemaDePago: normalizeList(raw.esquemaDePago),
		regiones: normalizeList(raw.regiones),
		detallesMonedaComision,
		monedas,
		algoritmos: normalizeList(raw.algoritmos),
		comision,
	}
}

export async function fetchPools(): Promise<PoolItem[]> {
	const items = await getJson<RawPool[]>('/api/pools')
	return items.map(toPoolItem)
}

export async function fetchPoolNamesByAlgorithm(algoritmo: string): Promise<string[]> {
	return getJson<string[]>(`/api/pools/byAlgoritmo/${encodeURIComponent(algoritmo)}`)
}
