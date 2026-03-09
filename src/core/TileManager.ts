import { Skia } from '@shopify/react-native-skia';
import type { SkImage } from '@shopify/react-native-skia';
import { LRUCache } from '../utils/LRUCache';
import { getTileUrl, getVisibleTiles } from '../utils/projection';
import type { LatLng, TileCoord, TileSource, CameraState } from '../types';

type TileKey = string;

function tileKey(coord: TileCoord): TileKey {
  return `${coord.z}/${coord.x}/${coord.y}`;
}

export interface TileManagerOptions {
  /** Max tiles to keep in memory (default: 256) */
  cacheSize?: number;
  /** Tile source configuration */
  source?: TileSource;
  /** Called when a new tile finishes loading */
  onTileLoaded?: () => void;
}

const DEFAULT_SOURCE: TileSource = {
  urlTemplate: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
  tileSize: 256,
  minZoom: 1,
  maxZoom: 19,
};

export class TileManager {
  private cache: LRUCache<TileKey, SkImage>;
  private loading = new Set<TileKey>();
  private failed = new Set<TileKey>();
  private source: TileSource;
  private onTileLoaded: (() => void) | null = null;

  constructor(options?: TileManagerOptions) {
    this.source = options?.source ?? DEFAULT_SOURCE;
    this.onTileLoaded = options?.onTileLoaded ?? null;
    // Dispose SkImage when evicted from cache to prevent memory leaks
    this.cache = new LRUCache<TileKey, SkImage>(
      options?.cacheSize ?? 256,
      (_key, image) => {
        try { image.dispose(); } catch {}
      },
    );
  }

  setSource(source: TileSource) {
    this.source = source;
    this.cache.clear();
    this.loading.clear();
    this.failed.clear();
  }

  setOnTileLoaded(cb: () => void) {
    this.onTileLoaded = cb;
  }

  /** Get cached tile image, or start loading it. Returns null if not yet available. */
  getTile(coord: TileCoord): SkImage | null {
    const key = tileKey(coord);
    const img = this.cache.get(key);
    if (img) return img;

    if (!this.loading.has(key) && !this.failed.has(key)) {
      this.loadTile(coord);
    }
    return null;
  }

  /** Get a lower-zoom parent tile as placeholder while the real tile loads */
  getFallbackTile(coord: TileCoord): {
    image: SkImage;
    srcX: number;
    srcY: number;
    scale: number;
  } | null {
    for (let dz = 1; dz <= 3; dz++) {
      const parentZ = coord.z - dz;
      if (parentZ < 0) break;
      const scale = Math.pow(2, dz);
      const parentX = Math.floor(coord.x / scale);
      const parentY = Math.floor(coord.y / scale);
      const parentKey = tileKey({ x: parentX, y: parentY, z: parentZ });
      const img = this.cache.get(parentKey);
      if (img) {
        return {
          image: img,
          srcX: (coord.x % scale) / scale,
          srcY: (coord.y % scale) / scale,
          scale,
        };
      }
    }
    return null;
  }

  /** Pre-fetch tiles for a viewport */
  requestTiles(center: LatLng, zoom: number, width: number, height: number) {
    const z = Math.floor(zoom);
    const tiles = getVisibleTiles(center, z, width, height, 2);
    for (const tile of tiles) {
      this.getTile(tile);
    }
  }

  get cacheSize(): number {
    return this.cache.size;
  }

  destroy() {
    this.cache.clear();
    this.loading.clear();
    this.failed.clear();
    this.onTileLoaded = null;
  }

  private async loadTile(coord: TileCoord) {
    const key = tileKey(coord);
    if (this.loading.has(key)) return;
    this.loading.add(key);

    const url = getTileUrl(this.source.urlTemplate, coord);

    try {
      // Use Skia's native data loading (handles network fetch internally via JSI)
      const data = await Skia.Data.fromURI(url);
      const image = Skia.Image.MakeImageFromEncoded(data);

      if (image) {
        this.cache.set(key, image);
        this.onTileLoaded?.();
      } else {
        // Fallback: fetch + base64
        await this.loadTileFetch(coord, key);
      }
    } catch {
      try {
        await this.loadTileFetch(coord, key);
      } catch {
        this.failed.add(key);
        setTimeout(() => this.failed.delete(key), 5000);
      }
    } finally {
      this.loading.delete(key);
    }
  }

  private async loadTileFetch(coord: TileCoord, key: string) {
    const url = getTileUrl(this.source.urlTemplate, coord);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const reader = new FileReader();

    return new Promise<void>((resolve, reject) => {
      reader.onload = () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          if (!base64) { reject(new Error('no base64')); return; }
          const data = Skia.Data.fromBase64(base64);
          const image = Skia.Image.MakeImageFromEncoded(data);
          if (image) {
            this.cache.set(key, image);
            this.onTileLoaded?.();
            resolve();
          } else {
            this.failed.add(key);
            reject(new Error('decode failed'));
          }
        } catch (e) {
          this.failed.add(key);
          reject(e);
        }
      };
      reader.onerror = () => { this.failed.add(key); reject(reader.error); };
      reader.readAsDataURL(blob);
    });
  }
}
