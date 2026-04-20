import React from 'react';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { StyleSheet } from 'react-native';
import { colors } from '../theme';

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

export function RouteMap({
  currentLocation,
  snappedLocation,
  routeCoords = [],
  certificationCenters = [],
}: Props) {
  const initial = currentLocation ??
    routeCoords[0] ?? { latitude: 37.5665, longitude: 126.978 };

  return (
    <MapView
      provider={PROVIDER_DEFAULT}
      style={StyleSheet.absoluteFillObject}
      initialRegion={{
        latitude: initial.latitude,
        longitude: initial.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
      showsUserLocation
      showsCompass={false}
      showsPointsOfInterest={false}
      showsBuildings={false}
      showsTraffic={false}
      toolbarEnabled={false}
    >
      {routeCoords.length > 0 && (
        <Polyline
          coordinates={routeCoords}
          strokeColor={colors.bgInverse}
          strokeWidth={4}
        />
      )}

      {snappedLocation && (
        <Marker
          coordinate={snappedLocation}
          title="현재 위치(스냅)"
          pinColor="black"
        />
      )}

      {certificationCenters.map((item, idx) => (
        <Marker
          key={idx}
          coordinate={{ latitude: item.latitude, longitude: item.longitude }}
          title={item.name ?? `인증센터 ${idx + 1}`}
          pinColor="black"
        />
      ))}
    </MapView>
  );
}
