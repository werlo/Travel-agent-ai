import { md5 } from 'js-md5'

/**
 * Travelpayouts' real-time flight search signature (travelpayouts.github.io/slate):
 * `md5("token:marker:" + every request-body value, sorted by key, joined with ":")`,
 * walking nested objects/arrays recursively in key-sorted order.
 *
 * This is written from Travelpayouts' own documented description of the algorithm,
 * not reverse-engineered against a live account (we do not have one yet) — treat it
 * as needing a real-key smoke test before launch, same as the rest of this provider.
 *
 * **This hashing scheme necessarily puts the token in client JS.** Computing an
 * MD5 signature in the browser means the token has to be present in the browser to
 * compute it, so it cannot be kept secret in a pure static SPA — anyone can read
 * `VITE_TRAVELPAYOUTS_TOKEN` out of the shipped bundle. There is no way to close
 * that gap without a backend proxy, which this product does not have (and, per
 * `docs/agency/house-stack.md`, is not supposed to grow one). Recorded here rather
 * than papered over.
 */
export function collectValuesInKeyOrder(node: unknown, out: string[]): void {
  if (node === null || node === undefined) return
  if (Array.isArray(node)) {
    for (const item of node) collectValuesInKeyOrder(item, out)
    return
  }
  if (typeof node === 'object') {
    const record = node as Record<string, unknown>
    for (const key of Object.keys(record).sort()) collectValuesInKeyOrder(record[key], out)
    return
  }
  out.push(String(node))
}

export function buildTravelpayoutsSignature(
  token: string,
  marker: string,
  body: Record<string, unknown>,
): string {
  const values: string[] = []
  collectValuesInKeyOrder(body, values)
  return md5(`${token}:${marker}:${values.join(':')}`)
}
