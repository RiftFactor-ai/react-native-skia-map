import type { LatLng, Point, TileCoord } from '../types';

const TILE_SIZE = 256;

/** Convert lat/lng to pixel coordinates at a given zoom level (Spherical Mercator) */
export function latLngToPixel(latLng: LatLng, zoom: number): Point {
  const scale = Math.pow(2, zoom) * TILE_SIZE;
  const x = ((latLng.lng + 180) / 360) * scale;
  const sinLat = Math.sin((latLng.lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

/** Convert pixel coordinates back to lat/lng at a given zoom level */
export function pixelToLatLng(pixel: Point, zoom: number): LatLng {
  const scale = Math.pow(2, zoom) * TILE_SIZE;
  const lng = (pixel.x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * pixel.y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

/** Get all tile coordinates visible in a viewport */
export function getVisibleTiles(
  center: LatLng,
  zoom: number,
  width: number,
  height: number,
  buffer: number = 1,
): TileCoord[] {
  const z = Math.floor(zoom);
  const maxTile = Math.pow(2, z) - 1;
  const centerPixel = latLngToPixel(center, z);

  const topLeftX = centerPixel.x - width / 2;
  const topLeftY = centerPixel.y - height / 2;
  const bottomRightX = centerPixel.x + width / 2;
  const bottomRightY = centerPixel.y + height / 2;

  const minTileX = Math.max(0, Math.floor(topLeftX / TILE_SIZE) - buffer);
  const minTileY = Math.max(0, Math.floor(topLeftY / TILE_SIZE) - buffer);
  const maxTileX = Math.min(maxTile, Math.floor(bottomRightX / TILE_SIZE) + buffer);
  const maxTileY = Math.min(maxTile, Math.floor(bottomRightY / TILE_SIZE) + buffer);

  const tiles: TileCoord[] = [];
  for (let x = minTileX; x <= maxTileX; x++) {
    for (let y = minTileY; y <= maxTileY; y++) {
      tiles.push({ x, y, z });
    }
  }
  return tiles;
}

/** Build tile URL from template */
export function getTileUrl(template: string, coord: TileCoord): string {
  return template
    .replace('{z}', String(coord.z))
    .replace('{x}', String(coord.x))
    .replace('{y}', String(coord.y));
}

/** Clamp zoom to valid range */
export function clampZoom(zoom: number, min: number = 1, max: number = 19): number {
  return Math.max(min, Math.min(max, zoom));
}

/** Haversine distance in meters between two points */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
