import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import {
  Canvas,
  Image as SkiaImage,
  Path as SkiaPath,
  Skia,
  Circle,
  Group,
  rect,
} from '@shopify/react-native-skia';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { useSharedValue, useDerivedValue, runOnJS, withDecay } from 'react-native-reanimated';
import { TileManager } from './core/TileManager';
import type { CameraState } from './core/Camera';
import { latLngToPixel, getVisibleTiles, pixelToLatLng, clampZoom } from './utils/projection';
import type {
  LatLng,
  MapMarker,
  MapPolygon,
  MapPressEvent,
  TileSource,
} from './types';

const TILE_SIZE = 256;

export interface SkiaMapViewProps {
  /** Initial center coordinate (default: NYC) */
  center?: LatLng;
  /** Initial zoom level (default: 10) */
  zoom?: number;
  /** Container style */
  style?: any;
  /** Map markers to render */
  markers?: MapMarker[];
  /** Polygon overlays to render */
  polygons?: MapPolygon[];
  /** Tile source configuration */
  tileSource?: TileSource;
  /** Called when the map is tapped */
  onPress?: (event: MapPressEvent) => void;
  /** Called on long press */
  onLongPress?: (event: MapPressEvent) => void;
  /** Called when camera position changes */
  onCameraChange?: (camera: CameraState) => void;
  /** Minimum zoom level (default: 1) */
  minZoom?: number;
  /** Maximum zoom level (default: 19) */
  maxZoom?: number;
  /** Show debug overlay (default: false) */
  debug?: boolean;
  /** Background color (default: #111827) */
  backgroundColor?: string;
}

/**
 * GPU-accelerated map view built on @shopify/react-native-skia.
 *
 * Uses Reanimated shared values for camera state — gestures update
 * on the UI thread with zero React re-renders. React only re-renders
 * when new tiles finish loading.
 */
export function SkiaMapView({
  center: initialCenter,
  zoom: initialZoom,
  style,
  markers = [],
  polygons = [],
  tileSource,
  onPress,
  onLongPress,
  onCameraChange,
  minZoom = 1,
  maxZoom = 19,
  debug = false,
  backgroundColor = '#111827',
}: SkiaMapViewProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const sizeRef = useRef(size);
  sizeRef.current = size;

  // Tile loading triggers React re-render to show new tiles
  const [renderTick, setRenderTick] = useState(0);

  // Camera as shared values — gestures update these on UI thread, no React re-renders
  const startCenter = initialCenter ?? { lat: 40.7484, lng: -73.9857 };
  const startZoom = initialZoom ?? 10;

  // We track camera as pixel offset from initial center, so pan is just translate
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const zoomLevel = useSharedValue(startZoom);

  // For reading camera state from JS thread
  const cameraRef = useRef<CameraState>({ center: startCenter, zoom: startZoom });

  // Transform: translate by pan offset
  const transform = useDerivedValue(() => [
    { translateX: offsetX.value },
    { translateY: offsetY.value },
  ]);

  const tileManager = useMemo(() => {
    const tm = new TileManager({
      source: tileSource,
      onTileLoaded: () => setRenderTick(t => t + 1),
    });
    return tm;
  }, []);

  useEffect(() => {
    if (tileSource) tileManager.setSource(tileSource);
  }, [tileSource, tileManager]);

  useEffect(() => () => tileManager.destroy(), [tileManager]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  // Sync camera ref and request tiles when offset changes settle
  const syncCamera = useCallback(() => {
    const w = sizeRef.current.width;
    const h = sizeRef.current.height;
    if (w === 0) return;
    const z = Math.floor(zoomLevel.value);
    const cp = latLngToPixel(startCenter, z);
    const newCenter = pixelToLatLng(
      { x: cp.x - offsetX.value, y: cp.y - offsetY.value },
      z,
    );
    cameraRef.current = { center: newCenter, zoom: zoomLevel.value };
    tileManager.requestTiles(newCenter, zoomLevel.value, w, h);
    setRenderTick(t => t + 1);
    onCameraChange?.(cameraRef.current);
  }, [startCenter, tileManager, onCameraChange]);

  // --- Gestures ---
  const panGesture = Gesture.Pan()
    .minDistance(8)
    .onChange((e) => {
      offsetX.value += e.changeX;
      offsetY.value += e.changeY;
    })
    .onEnd((e) => {
      offsetX.value = withDecay({ velocity: e.velocityX, deceleration: 0.997 });
      offsetY.value = withDecay({ velocity: e.velocityY, deceleration: 0.997 });
      runOnJS(syncCamera)();
    });

  const pinchStartZoom = useSharedValue(startZoom);
  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      pinchStartZoom.value = zoomLevel.value;
    })
    .onUpdate((e) => {
      const newZoom = clampZoom(pinchStartZoom.value + Math.log2(e.scale), minZoom, maxZoom);
      zoomLevel.value = newZoom;
    })
    .onEnd(() => {
      runOnJS(syncCamera)();
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(200)
    .onEnd(() => {
      zoomLevel.value = clampZoom(zoomLevel.value + 1, minZoom, maxZoom);
      offsetX.value = 0;
      offsetY.value = 0;
      runOnJS(syncCamera)();
    });

  const handleTapJS = useCallback((x: number, y: number) => {
    if (!onPress) return;
    const w = sizeRef.current.width;
    const h = sizeRef.current.height;
    if (w === 0) return;
    const z = Math.floor(zoomLevel.value);
    const cp = latLngToPixel(startCenter, z);
    const worldX = cp.x + (x - w / 2) - offsetX.value;
    const worldY = cp.y + (y - h / 2) - offsetY.value;
    const coord = pixelToLatLng({ x: worldX, y: worldY }, z);
    if (isNaN(coord.lat) || isNaN(coord.lng)) return;
    onPress({ coordinate: coord, point: { x, y } });
  }, [onPress, startCenter]);

  // Tap: capture x/y in shared values on start, fire callback on end
  const tapX = useSharedValue(0);
  const tapY = useSharedValue(0);

  const tapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(300)
    .onBegin((e) => {
      tapX.value = e.x;
      tapY.value = e.y;
    })
    .onEnd((_e, success) => {
      if (success) {
        runOnJS(handleTapJS)(tapX.value, tapY.value);
      }
    });

  const composed = Gesture.Race(
    Gesture.Simultaneous(panGesture, pinchGesture),
    Gesture.Exclusive(doubleTapGesture, tapGesture),
  );

  // --- Render tiles ---
  const renderTiles = () => {
    if (size.width === 0 || size.height === 0) return null;

    const cam = cameraRef.current;
    const z = Math.floor(cam.zoom);
    const initPixel = latLngToPixel(startCenter, z);
    const tiles = getVisibleTiles(startCenter, z, size.width, size.height, 4);

    tileManager.requestTiles(cam.center, cam.zoom, size.width, size.height);

    return tiles.map(tile => {
      const tilePixelX = tile.x * TILE_SIZE;
      const tilePixelY = tile.y * TILE_SIZE;
      const screenX = tilePixelX - initPixel.x + size.width / 2;
      const screenY = tilePixelY - initPixel.y + size.height / 2;

      const image = tileManager.getTile(tile);
      if (image) {
        return (
          <SkiaImage
            key={`${tile.z}/${tile.x}/${tile.y}`}
            image={image}
            x={screenX}
            y={screenY}
            width={TILE_SIZE}
            height={TILE_SIZE}
            fit="fill"
          />
        );
      }

      const fallback = tileManager.getFallbackTile(tile);
      if (fallback) {
        const { image: fbImg, srcX, srcY, scale } = fallback;
        const clipRect = rect(screenX, screenY, TILE_SIZE, TILE_SIZE);
        return (
          <Group key={`fb-${tile.z}/${tile.x}/${tile.y}`} clip={clipRect}>
            <SkiaImage
              image={fbImg}
              x={screenX - srcX * TILE_SIZE * scale}
              y={screenY - srcY * TILE_SIZE * scale}
              width={TILE_SIZE * scale}
              height={TILE_SIZE * scale}
              fit="fill"
            />
          </Group>
        );
      }

      return null;
    });
  };

  // --- Render polygons ---
  const renderPolygons = () => {
    if (size.width === 0) return null;
    const z = Math.floor(cameraRef.current.zoom);
    const initPixel = latLngToPixel(startCenter, z);

    return polygons.map(polygon => {
      if (polygon.coordinates.length < 3) return null;

      const path = Skia.Path.Make();
      const points = polygon.coordinates.map(coord => {
        const px = latLngToPixel(coord, z);
        return {
          x: px.x - initPixel.x + size.width / 2,
          y: px.y - initPixel.y + size.height / 2,
        };
      });

      path.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        path.lineTo(points[i].x, points[i].y);
      }
      path.close();

      return (
        <Group key={polygon.id}>
          <SkiaPath path={path} color={polygon.fillColor ?? 'rgba(124, 58, 237, 0.25)'} style="fill" />
          <SkiaPath path={path} color={polygon.strokeColor ?? '#7C3AED'} style="stroke" strokeWidth={polygon.strokeWidth ?? 2.5} />
        </Group>
      );
    });
  };

  // --- Render markers ---
  const renderMarkers = () => {
    if (size.width === 0) return null;
    const z = Math.floor(cameraRef.current.zoom);
    const initPixel = latLngToPixel(startCenter, z);

    return markers
      .filter(m => !isNaN(m.position.lat) && !isNaN(m.position.lng))
      .map(marker => {
        const px = latLngToPixel(marker.position, z);
        const screenX = px.x - initPixel.x + size.width / 2;
        const screenY = px.y - initPixel.y + size.height / 2;
        const r = marker.size ?? 8;

        return (
          <Group key={marker.id}>
            <Circle cx={screenX} cy={screenY} r={r + 2} color="white" />
            <Circle cx={screenX} cy={screenY} r={r} color={marker.color ?? '#EF4444'} />
          </Group>
        );
      });
  };

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor }, style]}>
      <GestureDetector gesture={composed}>
        <View style={styles.inner} onLayout={onLayout}>
          <Canvas style={styles.canvas}>
            <Group transform={transform}>
              {renderTiles()}
              {renderPolygons()}
              {renderMarkers()}
            </Group>
          </Canvas>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  inner: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  },
});
