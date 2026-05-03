import type { ApiError, TxReceipt } from './types'

async function parseJson<T>(r: Response): Promise<T> {
  const text = await r.text()
  if (!r.ok) {
    let detail: string = text
    try {
      const j = JSON.parse(text) as Partial<ApiError> & { message?: string }
      detail = j.error ?? j.message ?? text
    } catch {
      /* not json — keep raw text */
    }
    throw new Error(detail || `HTTP ${r.status}`)
  }
  if (!text) return undefined as unknown as T
  try {
    return JSON.parse(text) as T
  } catch {
    return text as unknown as T
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(path)
  return parseJson<T>(r)
}

export async function apiPost<T>(path: string, body?: object): Promise<T> {
  const r = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-Id': crypto.randomUUID(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return parseJson<T>(r)
}

export async function postAction(path: string, body?: object): Promise<TxReceipt> {
  return apiPost<TxReceipt>(path, body)
}
