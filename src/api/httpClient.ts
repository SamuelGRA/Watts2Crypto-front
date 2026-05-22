const DEFAULT_API_BASE_URL = 'http://localhost:8080'

export class HttpError extends Error {
  status: number

  constructor(status: number, path: string) {
    super(`HTTP ${status} en ${path}`)
    this.name = 'HttpError'
    this.status = status
  }
}

function normalizePath(path: string): string {
  if (path.startsWith('/')) {
    return path
  }

  return `/${path}`
}

function buildApiUrl(path: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL
  return `${baseUrl}${normalizePath(path)}`
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new HttpError(response.status, path)
  }

  return response.json() as Promise<T>
}

export async function postJson<T, B>(path: string, body: B): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} en ${path}`)
  }

  return response.json() as Promise<T>
}
