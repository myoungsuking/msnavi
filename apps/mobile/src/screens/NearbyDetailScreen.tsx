import React, { useMemo } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NaverMap } from '../components/NaverMap';
import { colors, spacing, typography } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<RootStackParamList, 'NearbyDetail'>;

/**
 * 주변 목록에서 선택한 POI 의 위치를 지도에 표시.
 * - 내 위치 (검은 점) + POI 위치 (강조 핀) + 두 점을 잇는 직선
 * - 아래 시트에 이름/주소/직선거리 표시 + 외부 지도로 길찾기 버튼
 *
 * 직선거리는 UI 표기용. 실제 경로 거리는 별도 라우팅 API 가 필요하므로
 * 외부 지도(카카오맵) 로 위임한다.
 */
export function NearbyDetailScreen({ route, navigation }: Props) {
  const { poi, myLat, myLng } = route.params;

  const routeCoords = useMemo(
    () => [
      { latitude: myLat, longitude: myLng },
      { latitude: poi.lat, longitude: poi.lng },
    ],
    [myLat, myLng, poi.lat, poi.lng],
  );

  const markers = useMemo(
    () => [
      {
        latitude: poi.lat,
        longitude: poi.lng,
        name: poi.name,
        highlight: true,
      },
    ],
    [poi.lat, poi.lng, poi.name],
  );

  const openInKakaoMap = () => {
    // 카카오맵 길찾기 웹 URL. 앱 설치되어 있으면 앱이 가로챔.
    // https://apis.map.kakao.com/web/guide/#deeplinks
    const url = `https://map.kakao.com/link/to/${encodeURIComponent(poi.name)},${poi.lat},${poi.lng}/from/내위치,${myLat},${myLng}`;
    Linking.openURL(url).catch(() => {
      // fallback
      const fallback = `https://map.kakao.com/link/to/${encodeURIComponent(poi.name)},${poi.lat},${poi.lng}`;
      Linking.openURL(fallback);
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <View style={styles.mapWrap}>
        <NaverMap
          currentLocation={{ latitude: myLat, longitude: myLng }}
          routeCoords={routeCoords}
          certificationCenters={markers}
          focusLocation={{ latitude: poi.lat, longitude: poi.lng }}
        />
      </View>

      <View style={styles.sheet}>
        <View style={styles.topRow}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text style={styles.name} numberOfLines={1}>
              {poi.name}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {translateType(poi.type)}
              {poi.address ? ` · ${poi.address}` : ''}
            </Text>
          </View>
          <View style={styles.distPill}>
            <Text style={styles.distText}>{formatDistance(poi.distanceM)}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.btnSecondaryText}>닫기</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={openInKakaoMap}
          >
            <Text style={styles.btnPrimaryText}>카카오맵으로 길찾기</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function formatDistance(m: number) {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

function translateType(t: string) {
  const map: Record<string, string> = {
    certification_center: '인증센터',
    restroom: '화장실',
    water_station: '급수대',
    air_pump: '공기주입기',
    convenience_store: '편의점',
    restaurant: '식당',
    lodging: '숙소',
    cafe: '카페',
    bike_repair: '자전거 수리',
    shelter: '쉼터',
  };
  return map[t] ?? t;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  mapWrap: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  sheet: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.bg,
    gap: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    ...typography.h3,
    color: colors.text,
  },
  sub: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  distPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.bgInverse,
    borderRadius: 999,
  },
  distText: {
    ...typography.caption,
    color: colors.textInverse,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  btn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: colors.bgInverse,
  },
  btnPrimaryText: {
    ...typography.bodyBold,
    color: colors.textInverse,
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  btnSecondaryText: {
    ...typography.bodyBold,
    color: colors.text,
  },
});
