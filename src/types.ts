/** Geographic coordinate */
export interface LatLng {
  lat: number;
  lng: number;
}

/** Screen pixel coordinate */
export interface Point {
  x: number;
  y: number;
}

/** Tile grid coordinate */
export interface TileCoord {
  x: number;
  y: number;
  z: number;
}

/** Camera state */
export interface CameraState {
  center: LatLng;
  zoom: number;
}

/** Map marker */
export interface MapMarker {
  id: string;
  position: LatLng;
  color?: string;
  size?: number;
  label?: string;
}

/** Map polygon overlay */
export interface MapPolygon {
  id: string;
  coordinates: LatLng[];
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

/** Tile source configuration */
export interface TileSource {
  /** URL template with {z}, {x}, {y} placeholders */
  urlTemplate: string;
  /** Tile size in pixels (default: 256) */
  tileSize?: number;
  /** Minimum zoom level (default: 1) */
  minZoom?: number;
  /** Maximum zoom level (default: 19) */
  maxZoom?: number;
}

/** Map press event */
export interface MapPressEvent {
  /** Geographic coordinate of the press */
  coordinate: LatLng;
  /** Screen pixel position of the press */
  point: Point;
}

/** Built-in tile providers */
export const TileProviders = {
  /** CartoDB Dark Matter — dark theme, great for data overlays */
  cartoDark: {
    urlTemplate: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
    tileSize: 256,
    minZoom: 1,
    maxZoom: 19,
  } as TileSource,

  /** CartoDB Positron — light/minimal theme */
  cartoLight: {
    urlTemplate: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
    tileSize: 256,
    minZoom: 1,
    maxZoom: 19,
  } as TileSource,

  /** CartoDB Voyager — colorful street map */
  cartoVoyager: {
    urlTemplate: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
    tileSize: 256,
    minZoom: 1,
    maxZoom: 19,
  } as TileSource,

  /** OpenStreetMap standard tiles */
  openStreetMap: {
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileSize: 256,
    minZoom: 1,
    maxZoom: 19,
  } as TileSource,
} as const;
