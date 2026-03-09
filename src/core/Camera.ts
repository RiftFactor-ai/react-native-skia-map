import type { LatLng } from '../types';
import { clampZoom } from '../utils/projection';

export interface CameraState {
  center: LatLng;
  zoom: number;
}

export function createCamera(
  center: LatLng = { lat: 40.7484, lng: -73.9857 },
  zoom: number = 10,
): CameraState {
  return { center, zoom: clampZoom(zoom) };
}

export function panCamera(
  camera: CameraState,
  dx: number,
  dy: number,
): CameraState {
  const scale = Math.pow(2, camera.zoom) * 256;
  const lngDelta = (-dx / scale) * 360;
  const latScale = Math.cos((camera.center.lat * Math.PI) / 180);
  const latDelta = (dy / scale) * 360 / latScale;

  return {
    ...camera,
    center: {
      lat: Math.max(-85, Math.min(85, camera.center.lat + latDelta)),
      lng: ((camera.center.lng + lngDelta + 540) % 360) - 180,
    },
  };
}

export function zoomCamera(
  camera: CameraState,
  delta: number,
  minZoom: number = 1,
  maxZoom: number = 19,
): CameraState {
  return {
    ...camera,
    zoom: clampZoom(camera.zoom + delta, minZoom, maxZoom),
  };
}

/** Fit camera to bounds containing all given points */
export function fitBounds(
  points: LatLng[],
  viewportWidth: number,
  viewportHeight: number,
  padding: number = 40,
): CameraState {
  if (points.length === 0) return createCamera();

  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }

  const center: LatLng = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
  const latDiff = maxLat - minLat;
  const lngDiff = maxLng - minLng;

  const effectiveWidth = viewportWidth - padding * 2;
  const effectiveHeight = viewportHeight - padding * 2;

  let zoom = 19;
  for (let z = 19; z >= 1; z--) {
    const scale = Math.pow(2, z) * 256;
    const worldWidth = (lngDiff / 360) * scale;
    const latRad = (center.lat * Math.PI) / 180;
    const worldHeight = (latDiff / 360) * scale / Math.cos(latRad);
    if (worldWidth <= effectiveWidth && worldHeight <= effectiveHeight) {
      zoom = z;
      break;
    }
  }

  return { center, zoom: clampZoom(zoom) };
}
