import { getJson } from './httpClient'
import type { PoolItem } from '../types/pool'

type RawPool = {
	nombre?: string
	comision?: number
	esquemaDePago?: string[] | string
	regiones?: string[]
	monedas?: string[]
	algoritmos?: string[]
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

function toPoolItem(raw: RawPool): PoolItem {
	return {
		nombre: raw.nombre?.trim() || 'Sin nombre',
		comision: raw.comision ?? 0,
		esquemaDePago: normalizeList(raw.esquemaDePago),
		regiones: normalizeList(raw.regiones),
		monedas: normalizeList(raw.monedas),
		algoritmos: normalizeList(raw.algoritmos),
	}
}

export async function fetchPools(): Promise<PoolItem[]> {
	const items = await getJson<RawPool[]>('/api/pools')
	return items.map(toPoolItem)
}
