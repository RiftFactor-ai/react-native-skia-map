import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import {
  SkiaMapView,
  TileProviders,
  type LatLng,
  type MapMarker,
  type MapPolygon,
  type MapPressEvent,
} from '@riftfactor/react-native-skia-map';

const NYC_CENTER: LatLng = { lat: 40.7484, lng: -73.9857 };

const SAMPLE_MARKERS: MapMarker[] = [
  { id: '1', position: { lat: 40.7484, lng: -73.9857 }, color: '#EF4444', label: 'Empire State' },
  { id: '2', position: { lat: 40.7580, lng: -73.9855 }, color: '#3B82F6', label: 'Times Square' },
  { id: '3', position: { lat: 40.7527, lng: -73.9772 }, color: '#10B981', label: 'Grand Central' },
  { id: '4', position: { lat: 40.7614, lng: -73.9776 }, color: '#F59E0B', label: 'MoMA' },
];

export default function App() {
  const [markers, setMarkers] = useState<MapMarker[]>(SAMPLE_MARKERS);
  const [polygonPoints, setPolygonPoints] = useState<LatLng[]>([]);
  const [polygons, setPolygons] = useState<MapPolygon[]>([]);
  const [drawMode, setDrawMode] = useState(false);
  const [tapCount, setTapCount] = useState(0);

  const handlePress = (event: MapPressEvent) => {
    if (drawMode) {
      const newPoints = [...polygonPoints, event.coordinate];
      setPolygonPoints(newPoints);
      if (newPoints.length >= 3) {
        setPolygons([{
          id: 'drawing',
          coordinates: newPoints,
          fillColor: 'rgba(124, 58, 237, 0.25)',
          strokeColor: '#7C3AED',
          strokeWidth: 2.5,
        }]);
      }
    } else {
      const id = `tap-${Date.now()}`;
      setMarkers(prev => [...prev, {
        id,
        position: event.coordinate,
        color: '#EF4444',
        size: 8,
      }]);
      setTapCount(prev => prev + 1);
    }
  };

  const resetAll = () => {
    setMarkers(SAMPLE_MARKERS);
    setPolygonPoints([]);
    setPolygons([]);
    setTapCount(0);
    setDrawMode(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Skia Map Demo</Text>
        <Text style={styles.subtitle}>
          @riftfactor/react-native-skia-map
        </Text>
      </View>

      <View style={styles.mapContainer}>
        <SkiaMapView
          center={NYC_CENTER}
          zoom={13}
          markers={markers}
          polygons={polygons}
          tileSource={TileProviders.cartoDark}
          onPress={handlePress}
          minZoom={2}
          maxZoom={18}
        />
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, drawMode && styles.buttonActive]}
          onPress={() => setDrawMode(!drawMode)}
        >
          <Text style={styles.buttonText}>
            {drawMode ? 'Drawing Mode' : 'Marker Mode'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={resetAll}>
          <Text style={styles.buttonText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.stats}>
        <Text style={styles.statsText}>
          Markers: {markers.length} | Taps: {tapCount} | Polygon pts: {polygonPoints.length}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  mapContainer: {
    flex: 1,
    margin: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  controls: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  button: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  buttonActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#8B5CF6',
  },
  buttonText: {
    color: '#F8FAFC',
    fontWeight: '600',
    fontSize: 14,
  },
  stats: {
    padding: 12,
    paddingTop: 0,
  },
  statsText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
  },
});
