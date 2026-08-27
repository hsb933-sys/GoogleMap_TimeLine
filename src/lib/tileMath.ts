// Standard slippy-map (Web Mercator) tile math.
// https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames

export const TILE_SIZE = 256

export function lonLatToWorldPixel(lon: number, lat: number, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** zoom
  const x = ((lon + 180) / 360) * scale
  const sinLat = Math.sin((lat * Math.PI) / 180)
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale
  return { x, y }
}

export function worldPixelToTile(x: number, y: number): { tx: number; ty: number } {
  return { tx: Math.floor(x / TILE_SIZE), ty: Math.floor(y / TILE_SIZE) }
}

export interface BoundsPx {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Picks the largest zoom (most detail) at which the given lon/lat bounds fit within a viewport. */
export function fitZoom(
  points: { lat: number; lng: number }[],
  viewportWidth: number,
  viewportHeight: number,
  maxZoom = 17,
  padding = 40,
): { zoom: number; centerLon: number; centerLat: number } {
  if (points.length === 0) {
    return { zoom: 2, centerLon: 0, centerLat: 0 }
  }
  let minLat = Infinity
  let maxLat = -Infinity
  let minLon = Infinity
  let maxLon = -Infinity
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lng < minLon) minLon = p.lng
    if (p.lng > maxLon) maxLon = p.lng
  }
  const centerLon = (minLon + maxLon) / 2
  const centerLat = (minLat + maxLat) / 2

  for (let zoom = maxZoom; zoom >= 0; zoom--) {
    const min = lonLatToWorldPixel(minLon, maxLat, zoom)
    const max = lonLatToWorldPixel(maxLon, minLat, zoom)
    const w = max.x - min.x
    const h = max.y - min.y
    if (w <= viewportWidth - padding * 2 && h <= viewportHeight - padding * 2) {
      return { zoom, centerLon, centerLat }
    }
  }
  return { zoom: 0, centerLon, centerLat }
}

export function osmTileUrl(z: number, x: number, y: number): string {
  const n = 2 ** z
  const wrappedX = ((x % n) + n) % n
  return `https://tile.openstreetmap.org/${z}/${wrappedX}/${y}.png`
}
