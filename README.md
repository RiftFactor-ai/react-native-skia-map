<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-7C3AED?style=for-the-badge" alt="version" />
  <img src="https://img.shields.io/badge/platform-iOS%20%7C%20Android-1E293B?style=for-the-badge" alt="platform" />
  <img src="https://img.shields.io/badge/architecture-Fabric%20%2F%20New%20Arch-10B981?style=for-the-badge" alt="architecture" />
  <img src="https://img.shields.io/badge/license-MIT-F59E0B?style=for-the-badge" alt="license" />
</p>

<h1 align="center">@riftfactor/react-native-skia-map</h1>

<p align="center">
  <strong>GPU-accelerated map renderer for React Native — built on Skia, Reanimated & Gesture Handler</strong>
</p>

<p align="center">
  No WebView. No Google Maps SDK. No MapKit.<br/>
  Pure Skia rendering on the UI thread at 60fps.
</p>

<p align="center">
  <a href="https://github.com/RiftFactor-ai/skia-map-demo"><strong>See the full demo app →</strong></a>
</p>

---

## Why This Exists

React Native 0.84+ forces the **New Architecture (Fabric)**. This breaks `react-native-webview` and makes traditional map SDKs unreliable. We needed maps that actually work — so we built them from scratch using Skia.

This library renders **raster map tiles directly on a Skia Canvas**, with gesture handling powered by Reanimated shared values. The camera state lives entirely on the UI thread — panning, pinching, and zooming produce **zero React re-renders**.

### What Makes This Different

| Feature | This Library | WebView Maps | Native SDKs |
|---------|-------------|--------------|-------------|
| **Fabric / New Arch** | Full support | Broken on RN 0.84+ | Partial |
| **Rendering** | GPU via Skia | Browser engine | Platform native |
| **Camera updates** | UI thread (0 re-renders) | Bridge serialization | Bridge calls |
| **Bundle size** | ~15KB (just JS) | +WebView runtime | +SDK binary |
| **Customization** | Full Skia drawing API | Limited to HTML/CSS | SDK constraints |
| **Tile sources** | Any XYZ/TMS provider | Depends on implementation | Provider-locked |

---

## Installation

```bash
npm install @riftfactor/react-native-skia-map
```

### Peer Dependencies

```bash
npm install @shopify/react-native-skia react-native-reanimated react-native-gesture-handler
```

**Babel config** — add the Reanimated plugin:

```js
// babel.config.js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-reanimated/plugin'], // Must be last
};
```

**iOS** — install pods:

```bash
cd ios && pod install
```

---

## Quick Start

```tsx
import { SkiaMapView, TileProviders } from '@riftfactor/react-native-skia-map';

export default function App() {
  return (
    <SkiaMapView
      center={{ lat: 40.7484, lng: -73.9857 }}
      zoom={12}
      tileSource={TileProviders.cartoDark}
      onPress={(e) => console.log('Tapped:', e.coordinate)}
    />
  );
}
```

That's it. Dark-themed map of NYC, pannable, pinchable, tappable.

---

## Features

### Smooth Gestures — Zero Re-renders

Camera state uses Reanimated `useSharedValue`. Gesture callbacks run as **worklets on the UI thread**. The Skia `<Group>` transform updates via `useDerivedValue`. React never re-renders during pan/zoom.

```
Gesture (UI thread) → SharedValue → useDerivedValue → <Group transform>
                                                         ↓
                                                    Skia redraws (GPU)
                                                    React sleeps 😴
```

### Momentum Scrolling

Pan gestures end with `withDecay()` for natural inertia. Deceleration factor: `0.997`.

### Pinch-to-Zoom

Logarithmic zoom scaling via `Math.log2(e.scale)` for natural feel. Clamped to `minZoom`/`maxZoom`.

### Double-Tap Zoom

Tapping twice zooms in by 1 level.

### Tap-to-Interact

Tap coordinates are captured in shared values during `onBegin` (worklet), then bridged to JS thread via `runOnJS` on `onEnd`. This avoids the common RN pitfall where gesture event objects aren't serializable across threads.

### Tile Rendering

- **Spherical Mercator** projection (EPSG:3857)
- **LRU cache** with configurable size (default: 256 tiles)
- **Automatic SkImage disposal** on cache eviction — prevents GPU memory leaks
- **Parent tile fallback** — shows zoomed-in parent tiles while children load
- **Dual loading strategy** — tries `Skia.Data.fromURI()` first, falls back to `fetch` + base64

### Built-in Tile Providers

```tsx
import { TileProviders } from '@riftfactor/react-native-skia-map';

TileProviders.cartoDark     // Dark theme (great for data overlays)
TileProviders.cartoLight    // Light / minimal
TileProviders.cartoVoyager  // Colorful street map
TileProviders.openStreetMap // Classic OSM
```

Or use any XYZ tile server:

```tsx
<SkiaMapView
  tileSource={{
    urlTemplate: 'https://your-tile-server/{z}/{x}/{y}.png',
    tileSize: 256,
    minZoom: 1,
    maxZoom: 19,
  }}
/>
```

### Markers

```tsx
<SkiaMapView
  markers={[
    { id: '1', position: { lat: 40.7484, lng: -73.9857 }, color: '#EF4444', size: 10 },
    { id: '2', position: { lat: 40.7580, lng: -73.9855 }, color: '#3B82F6' },
  ]}
/>
```

Markers render as circles with a white border. Each marker has:
- `id` — unique identifier
- `position` — `{ lat, lng }` coordinate
- `color` — fill color (default: `#EF4444`)
- `size` — radius in pixels (default: `8`)
- `label` — text label (reserved for future use)

### Polygon Overlays

```tsx
<SkiaMapView
  polygons={[{
    id: 'service-area',
    coordinates: [
      { lat: 40.75, lng: -73.99 },
      { lat: 40.76, lng: -73.97 },
      { lat: 40.74, lng: -73.96 },
    ],
    fillColor: 'rgba(124, 58, 237, 0.25)',
    strokeColor: '#7C3AED',
    strokeWidth: 2.5,
  }]}
/>
```

---

## API Reference

### `<SkiaMapView>`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `center` | `LatLng` | NYC | Initial center coordinate |
| `zoom` | `number` | `10` | Initial zoom level |
| `style` | `ViewStyle` | — | Container style |
| `markers` | `MapMarker[]` | `[]` | Markers to render |
| `polygons` | `MapPolygon[]` | `[]` | Polygon overlays |
| `tileSource` | `TileSource` | CartoDB Dark | Tile source config |
| `onPress` | `(event: MapPressEvent) => void` | — | Tap callback |
| `onLongPress` | `(event: MapPressEvent) => void` | — | Long press callback |
| `onCameraChange` | `(camera: CameraState) => void` | — | Camera change callback |
| `minZoom` | `number` | `1` | Minimum zoom level |
| `maxZoom` | `number` | `19` | Maximum zoom level |
| `backgroundColor` | `string` | `#111827` | Background color |

### `MapPressEvent`

```ts
{
  coordinate: { lat: number; lng: number };  // Geographic position
  point: { x: number; y: number };           // Screen pixel position
}
```

### `CameraState`

```ts
{
  center: { lat: number; lng: number };
  zoom: number;
}
```

### Utility Functions

```tsx
import {
  createCamera,      // Create camera state
  fitBounds,         // Fit camera to contain points
  latLngToPixel,     // Geographic → pixel conversion
  pixelToLatLng,     // Pixel → geographic conversion
  haversineDistance,  // Distance between two points (meters)
} from '@riftfactor/react-native-skia-map';

// Fit camera to show all markers
const camera = fitBounds(
  markers.map(m => m.position),
  viewportWidth,
  viewportHeight,
  40, // padding
);
```

---

## Architecture Deep Dive

### The Re-render Problem

Traditional RN map wrappers store camera state in `useState`. Every pan frame triggers:

```
Gesture → setState → React reconciliation → Virtual DOM diff → Native update
```

At 60fps, that's 60 full React re-renders per second. On Skia Canvas, this **blanks the canvas** between frames — you see flickering or a solid blue/white screen.

### Our Solution

```
                    ┌─────────────────────────┐
                    │      UI Thread          │
                    │                         │
  Gesture ──────►   │  SharedValue (offset)   │
  Handler           │         │               │
  (worklet)         │    useDerivedValue      │
                    │         │               │
                    │   <Group transform>     │
                    │         │               │
                    │    Skia Canvas          │──── GPU renders
                    │    (no React!)          │
                    └─────────────────────────┘
                              │
                         runOnJS (on end)
                              │
                    ┌─────────▼───────────────┐
                    │      JS Thread          │
                    │                         │
                    │  requestTiles()         │──── Network fetch
                    │  setRenderTick()        │──── React re-render
                    │                         │     (tiles only)
                    └─────────────────────────┘
```

React only re-renders when a **new tile image finishes loading**. During active gestures, React does nothing.

### Memory Management

Skia `SkImage` objects are native GPU textures — they don't participate in Hermes garbage collection. We handle this with:

1. **LRU cache** with configurable size (default: 256 tiles)
2. **`onEvict` callback** that calls `image.dispose()` when tiles are evicted
3. **`destroy()` method** on TileManager that disposes all cached images
4. **`useEffect` cleanup** ensures disposal when the component unmounts

### Tile Loading Pipeline

```
getTile(coord)
    │
    ├── Cache hit? → Return SkImage immediately
    │
    ├── Already loading? → Return null (will re-render when done)
    │
    └── Start load:
        │
        ├── Try: Skia.Data.fromURI(url)           ← JSI native fetch
        │   └── Skia.Image.MakeImageFromEncoded()
        │
        └── Fallback: fetch() → blob → FileReader  ← JS fetch + base64
            └── Skia.Data.fromBase64()
            └── Skia.Image.MakeImageFromEncoded()
```

### Gesture Composition

```
Gesture.Race(
  Gesture.Simultaneous(pan, pinch),   ← Can pan + pinch together
  Gesture.Exclusive(doubleTap, tap),  ← Double-tap wins over single tap
)
```

`Race` ensures only one gesture group activates per touch. Pan/pinch can happen simultaneously (two-finger zoom while dragging). Double-tap takes priority over single tap via `Exclusive`.

---

## Compatibility

| Dependency | Minimum Version |
|------------|----------------|
| React Native | 0.71+ |
| `@shopify/react-native-skia` | 0.1.221+ |
| `react-native-reanimated` | 3.0+ (v4 recommended) |
| `react-native-gesture-handler` | 2.0+ |

**Tested on:**
- React Native 0.84.1 (Fabric / New Architecture)
- iOS 17+, Android 14+
- Hermes engine

---

## Use Cases

- **Service area selection** — tap to draw polygons on the map
- **Appointment/delivery tracking** — place colored markers for different statuses
- **Fleet visualization** — real-time vehicle positions on dark theme
- **Geofencing UI** — define zones with polygon overlays
- **Location picker** — tap to select coordinates
- **Any app stuck on RN 0.84+** where WebView maps are broken

---

## License

MIT — [RiftFactor AI](https://riftfactor.ai)

---

<p align="center">
  <strong>Built by <a href="https://riftfactor.ai">RiftFactor AI</a></strong><br/>
  <em>When the standard tools break, we build new ones.</em>
</p>
