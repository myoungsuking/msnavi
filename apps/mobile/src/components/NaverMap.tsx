import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
  NaverMapView,
  NaverMapMarkerOverlay,
  NaverMapPathOverlay,
} from '@mj-studio/react-native-naver-map';

interface Coord {
  latitude: number;
  longitude: number;
}

interface Props {
  currentLocation?: Coord | null;
  snappedLocation?: Coord | null;
  routeCoords?: Coord[];
  certificationCenters?: Array<Coord & { name?: string }>;
}

const HANGANG_DDUKSEOM: Coord = { latitude: 37.5172, longitude: 127.0473 };

export function NaverMap({
  currentLocation,
  snappedLocation,
  routeCoords = [],
  certificationCenters = [],
}: Props) {
  const initial = currentLocation ?? routeCoords[0] ?? HANGANG_DDUKSEOM;

  const pathCoords = useMemo(
    () =>
      routeCoords.map((c) => ({
        latitude: c.latitude,
        longitude: c.longitude,
      })),
    [routeCoords],
  );

  return (
    <NaverMapView
      style={StyleSheet.absoluteFillObject}
      initialCamera={{
        latitude: initial.latitude,
        longitude: initial.longitude,
        zoom: 13,
      }}
      isShowCompass={false}
      isShowScaleBar={false}
      isShowZoomControls={false}
      isShowLocationButton={false}
      mapType="Basic"
    >
      {pathCoords.length >= 2 && (
        <NaverMapPathOverlay coords={pathCoords} width={6} color="#000000" />
      )}

      {snappedLocation && (
        <NaverMapMarkerOverlay
          latitude={snappedLocation.latitude}
          longitude={snappedLocation.longitude}
          anchor={{ x: 0.5, y: 1 }}
          caption={{ text: '현재' }}
          image={{ symbol: 'black' }}
        />
      )}

      {certificationCenters.map((p, idx) => (
        <NaverMapMarkerOverlay
          key={`${p.latitude}-${p.longitude}-${idx}`}
          latitude={p.latitude}
          longitude={p.longitude}
          anchor={{ x: 0.5, y: 1 }}
          caption={{ text: p.name ?? `인증 ${idx + 1}` }}
          image={{ symbol: 'gray' }}
        />
      ))}
    </NaverMapView>
  );
}
