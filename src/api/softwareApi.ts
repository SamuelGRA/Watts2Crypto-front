import { getJson } from './httpClient'
import type { SoftwareItem } from '../types/software'

type RawSoftware = {
	nombre?: string
	hardwareUsable?: string[]
	comision?: number
	algoritmos?: string[]
	sistemas?: string[]
	tipoSoftware?: string
}

function normalizeList(values: string[] | null | undefined): string[] {
	if (!values || values.length === 0) {
		return []
	}

	return values
		.map((value) => value?.trim())
		.filter((value): value is string => Boolean(value))
}

function toSoftwareItem(raw: RawSoftware): SoftwareItem {
	return {
		nombre: raw.nombre?.trim() || 'Sin nombre',
		hardwareUsable: normalizeList(raw.hardwareUsable),
		comision: raw.comision ?? 0,
		algoritmos: normalizeList(raw.algoritmos),
		sistemas: normalizeList(raw.sistemas),
		tipoSoftware: raw.tipoSoftware?.trim() || 'N/D',
	}
}

export async function fetchSoftware(): Promise<SoftwareItem[]> {
	const items = await getJson<RawSoftware[]>('/api/software')
	return items.map(toSoftwareItem)
}
