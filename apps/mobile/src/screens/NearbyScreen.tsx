import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { useNavigationStore } from '../store/navigationStore';
import { useNearbyPois } from '../hooks/useNearbyPois';
import { NearbyList } from '../components/NearbyList';
import { NaverMap } from '../components/NaverMap';
import { colors, spacing, typography } from '../theme';
import type { RootStackParamList } from '../navigation/types';
import type { NearbyItem } from '../services/api';

const TYPES: Array<{ id: string; label: string }> = [
  { id: 'certification_center', label: '인증센터' },
  { id: 'restroom', label: '화장실' },
  { id: 'water_station', label: '급수대' },
  { id: 'air_pump', label: '공기주입기' },
  { id: 'convenience_store', label: '편의점' },
  { id: 'restaurant', label: '식당' },
  { id: 'lodging', label: '숙소' },
  { id: 'cafe', label: '카페' },
  { id: 'bike_repair', label: '자전거 수리' },
];

type LocState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; lat: number; lng: number }
  | { status: 'denied' }
  | { status: 'error'; message: string };

export function NearbyScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const storedLocation = useNavigationStore((s) => s.currentLocation);
  const setCurrentLocation = useNavigationStore((s) => s.setCurrentLocation);
  const [type, setType] = useState<string>('convenience_store');
  const [highlightedId, setHighlightedId] = useState<string | number | null>(
    null,
  );
  const [loc, setLoc] = useState<LocState>(() =>
    storedLocation
      ? { status: 'ok', lat: storedLocation.lat, lng: storedLocation.lng }
      : { status: 'idle' },
  );

  const fetchLocation = useCallback(
    async (force: boolean) => {
      setLoc((prev) => {
        if (!force && prev.status === 'loading') return prev;
        return { status: 'loading' };
      });

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLoc({ status: 'denied' });
          return;
        }

        // 빠른 응답을 위해 가벼운 정확도로 1회 조회.
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLoc({ status: 'ok', lat, lng });
        setCurrentLocation({
          lat,
          lng,
          speedKmh: ((pos.coords.speed ?? 0) as number) * 3.6,
          heading: pos.coords.heading ?? undefined,
        });
      } catch (e) {
        setLoc({
          status: 'error',
          message: e instanceof Error ? e.message : '위치 조회 실패',
        });
      }
    },
    [setCurrentLocation],
  );

  // 탭 진입 시마다 최신 위치로 갱신
  useFocusEffect(
    useCallback(() => {
      fetchLocation(true);
    }, [fetchLocation]),
  );

  // 최초 마운트에서 idle 이면 한 번 트리거 (safety net)
  useEffect(() => {
    if (loc.status === 'idle') fetchLocation(false);
  }, [loc.status, fetchLocation]);

  const hasLoc = loc.status === 'ok';
  const { data, isLoading, refetch } = useNearbyPois({
    lat: hasLoc ? loc.lat : undefined,
    lng: hasLoc ? loc.lng : undefined,
    type,
    radius: 2000,
    source: 'auto',
  });

  // 타입 변경 시 선택 하이라이트 초기화
  useEffect(() => {
    setHighlightedId(null);
  }, [type]);

  // 지도 마커: 현재 타입의 주변 POI 전체. 리스트에서 탭한 항목만 highlight.
  const mapMarkers = React.useMemo(
    () =>
      (data ?? []).map((p) => ({
        latitude: p.lat,
        longitude: p.lng,
        name: p.name,
        highlight: highlightedId != null && p.id === highlightedId,
      })),
    [data, highlightedId],
  );

  const typeLabel = TYPES.find((t) => t.id === type)?.label ?? '';
  const resultCount = data?.length ?? 0;

  // 지도 포커스: 선택된 항목이 있으면 그 위치, 없으면 내 위치
  const mapFocus = React.useMemo(() => {
    if (!hasLoc) return null;
    if (highlightedId != null && data) {
      const found = data.find((p) => p.id === highlightedId);
      if (found) return { latitude: found.lat, longitude: found.lng };
    }
    return { latitude: loc.lat, longitude: loc.lng };
  }, [hasLoc, loc, highlightedId, data]);

  if (!hasLoc) {
    return (
      <SafeAreaView style={styles.empty} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>주변</Text>
        </View>
        <View style={styles.emptyBody}>
          {loc.status === 'loading' && (
            <Text style={styles.emptyText}>현재 위치를 가져오는 중...</Text>
          )}
          {loc.status === 'denied' && (
            <>
              <Text style={styles.emptyText}>
                위치 권한이 거부되었습니다.{'\n'}설정에서 권한을 허용한 뒤 다시
                시도해 주세요.
              </Text>
              <Pressable
                style={styles.retryBtn}
                onPress={() => fetchLocation(true)}
              >
                <Text style={styles.retryText}>다시 시도</Text>
              </Pressable>
            </>
          )}
          {loc.status === 'error' && (
            <>
              <Text style={styles.emptyText}>
                위치를 가져오지 못했습니다.{'\n'}
                <Text style={styles.emptySub}>{loc.message}</Text>
              </Text>
              <Pressable
                style={styles.retryBtn}
                onPress={() => fetchLocation(true)}
              >
                <Text style={styles.retryText}>다시 시도</Text>
              </Pressable>
            </>
          )}
          {loc.status === 'idle' && (
            <Text style={styles.emptyText}>위치 준비 중...</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>주변</Text>
          <Pressable
            onPress={() => {
              fetchLocation(true);
              refetch();
            }}
            hitSlop={10}
          >
            <Text style={styles.refreshText}>위치 갱신</Text>
          </Pressable>
        </View>
        <Text style={styles.caption}>
          반경 2km · 탭하면 지도에서 위치 보기, 한 번 더 탭하면 상세
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabs}
      >
        {TYPES.map((t) => {
          const active = t.id === type;
          return (
            <Pressable
              key={t.id}
              onPress={() => setType(t.id)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.mapWrap}>
        <NaverMap
          currentLocation={{ latitude: loc.lat, longitude: loc.lng }}
          certificationCenters={mapMarkers}
          focusLocation={mapFocus}
          initialZoom={14}
        />
      </View>

      <View style={styles.statusBar}>
        <Text style={styles.statusText} numberOfLines={1}>
          {isLoading
            ? '주변 검색 중...'
            : `${typeLabel} ${resultCount}곳 · 반경 2km`}
        </Text>
        {highlightedId != null && !isLoading ? (
          <Pressable onPress={() => setHighlightedId(null)} hitSlop={8}>
            <Text style={styles.statusAction}>선택 해제</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.listWrap}>
        {isLoading ? (
          <View style={styles.skeletonWrap}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.skelRow}>
                <View style={styles.skelTitle} />
                <View style={styles.skelSub} />
              </View>
            ))}
          </View>
        ) : (
          <NearbyList
            items={data ?? []}
            highlightedId={highlightedId}
            onItemPress={(item: NearbyItem) => {
              if (!hasLoc) return;
              // 한 번 탭: 지도에서 해당 마커로 포커스 + 하이라이트
              if (highlightedId !== item.id) {
                setHighlightedId(item.id ?? null);
                return;
              }
              // 이미 선택된 항목을 다시 탭: 상세 화면으로 이동
              navigation.navigate('NearbyDetail', {
                poi: {
                  id: item.id,
                  type: item.type,
                  name: item.name,
                  address: item.address,
                  lat: item.lat,
                  lng: item.lng,
                  distanceM: item.distanceM,
                  source: item.source,
                },
                myLat: loc.lat,
                myLng: loc.lng,
              });
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { ...typography.h2, color: colors.text },
  caption: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  refreshText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  tabsScroll: {
    // 가로 ScrollView 가 남은 세로 공간을 차지하는 현상 방지
    flexGrow: 0,
    flexShrink: 0,
  },
  tabs: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  mapWrap: {
    flex: 1,
    minHeight: 240,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.divider,
    backgroundColor: '#f2f2f2',
    overflow: 'hidden',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  statusText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  statusAction: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  listWrap: { flex: 1 },
  skeletonWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  skelRow: {
    gap: 6,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  skelTitle: {
    height: 14,
    width: '60%',
    borderRadius: 4,
    backgroundColor: '#ECECEC',
  },
  skelSub: {
    height: 10,
    width: '40%',
    borderRadius: 4,
    backgroundColor: '#F2F2F2',
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.bg,
    height: 34,
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.bgInverse,
    borderColor: colors.bgInverse,
  },
  tabText: { color: colors.text, ...typography.caption, fontWeight: '600' },
  tabTextActive: { color: colors.textInverse },
  loading: {
    padding: spacing.xl,
    textAlign: 'center',
    color: colors.textMuted,
    ...typography.body,
  },
  empty: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  emptyBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyText: {
    color: colors.textMuted,
    ...typography.body,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptySub: {
    color: colors.textSubtle,
    ...typography.caption,
  },
  retryBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 999,
  },
  retryText: {
    color: colors.text,
    ...typography.bodyBold,
  },
});
