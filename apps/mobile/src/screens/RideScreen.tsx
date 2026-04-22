import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigationStore } from '../store/navigationStore';
import { useCourseSegments, useCoursePois } from '../hooks/useCourse';
import { useRideTracking } from '../hooks/useRideTracking';
import { navigationApi, ridesApi } from '../services/api';
import { NaverMap } from '../components/NaverMap';
import { RideStatsPanel } from '../components/RideStatsPanel';
import { MonoButton } from '../components/MonoButton';
import { useRideStore } from '../store/rideStore';
import { useSettingsStore } from '../store/settingsStore';
import type { LocationSample } from '../services/location';
import { colors, spacing, typography } from '../theme';
import {
  detectTurns,
  formatDistance,
  haversine,
  nearestOnRoute,
  nearestPoi,
  nextTurnFrom,
  pathLengthM,
  smoothPath,
  splitOnJumps,
  turnLabelKo,
} from '../utils/geo';
import { speakKo, stopSpeaking } from '../services/voice';
import { getDeviceId } from '../services/device';

const START_RADIUS_M = 500;
const RESUME_RADIUS_M = 10_000;

/** 한국 영역(대략치): 위도 33~39, 경도 124~132. 이 밖이면 GPS 가 제대로 안 잡힌 것으로 판단. */
function isInKorea(p: { latitude: number; longitude: number }): boolean {
  return (
    p.latitude >= 33 && p.latitude <= 39 && p.longitude >= 124 && p.longitude <= 132
  );
}

export function RideScreen() {
  const insets = useSafeAreaInsets();
  const courseId = useNavigationStore((s) => s.selectedCourseId);
  const setCurrent = useNavigationStore((s) => s.setCurrentLocation);
  const setProgress = useNavigationStore((s) => s.setProgress);
  const current = useNavigationStore((s) => s.currentLocation);
  const snapped = useNavigationStore((s) => s.snappedLocation);
  const displayHeading = useNavigationStore((s) => s.displayHeading);
  const remainingKm = useNavigationStore((s) => s.remainingDistanceKm);
  const etaMin = useNavigationStore((s) => s.estimatedDurationMin);
  const etaIso = useNavigationStore((s) => s.estimatedArrivalAt);
  const offRoute = useNavigationStore((s) => s.offRoute);
  const nextName = useNavigationStore((s) => s.nextPoiName);
  const nextDist = useNavigationStore((s) => s.nextPoiDistanceKm);

  const rideId = useRideStore((s) => s.rideId);
  const startRide = useRideStore((s) => s.startRide);
  const endRide = useRideStore((s) => s.endRide);

  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);

  const [lastProgressAt, setLastProgressAt] = useState(0);
  // 서버 windowed 스냅 가속용: 직전 응답의 segmentIndex 를 다음 요청에 그대로 전달.
  const lastSegmentIndexRef = useRef<number | undefined>(undefined);
  // off-route 확정 판정용: 연속 off-route 샘플의 시작 시각(ms). null 이면 현재 경로 위.
  const offRouteSinceRef = useRef<number | null>(null);
  // 마지막으로 UI/TTS 에 반영한 "확정 off-route" 상태.
  const [confirmedOffRoute, setConfirmedOffRoute] = useState(false);
  // headingMismatch 경고를 너무 자주 말하지 않도록 쿨다운
  const lastHeadingWarnAtRef = useRef(0);

  const { data: segments } = useCourseSegments(courseId);
  const { data: certPois } = useCoursePois(courseId, 'certification_center');

  const routeCoords = useMemo(() => {
    const acc: { latitude: number; longitude: number }[] = [];
    for (const seg of segments ?? []) {
      for (const c of seg.coordinates ?? []) {
        acc.push({ longitude: Number(c[0]), latitude: Number(c[1]) });
      }
    }
    return acc;
  }, [segments]);

  // 지도에 그릴 폴리라인들.
  // 1) 공공데이터 CSV 는 한 road_sn 에 본선+지선이 섞여 있어 seq 순으로 이어붙이면
  //    "본선 ↔ 지선" 사이에 수 km~수십 km 의 큰 점프가 생긴다(예: 한강종주 idx=628 37km,
  //    idx=230 19km). 이 점프 선분만 시각적으로 제거하고 본선 자체는 끊김 없이 이어지도록,
  //    임계값을 3km 로 잡아 본선 내부의 정상 공백(~2km 이하)은 보존한다.
  // 2) 분할 결과 중 전체 길이 대비 5% 미만짜리 자잘한 지선 조각은 렌더에서 제외
  //    (본선만 깔끔하게 보이도록).
  // 3) 각 조각은 sparse 할 수 있으므로 Catmull-Rom 스플라인으로 부드럽게 보간한다.
  // 4) NaverMap 은 routePaths 를 받아 조각마다 독립 polyline 으로 렌더한다.
  // 계산용(turns/routeInfo/서버 progress)은 이 분할/보간을 쓰지 않고 원본 routeCoords 를 쓴다.
  const displayPaths = useMemo(() => {
    const parts = splitOnJumps(routeCoords, 3000);
    if (parts.length === 0) return [];
    const lengths = parts.map(pathLengthM);
    const maxLen = Math.max(...lengths, 0);
    const threshold = maxLen * 0.05;
    return parts
      .filter((_, i) => lengths[i] >= threshold)
      .map((p) => smoothPath(p));
  }, [routeCoords]);

  const certCoords = useMemo(
    () =>
      (certPois ?? []).map((p) => ({
        latitude: Number(p.lat),
        longitude: Number(p.lng),
        name: p.name,
      })),
    [certPois],
  );

  const currentLatLng = useMemo(
    () => (current ? { latitude: current.lat, longitude: current.lng } : null),
    [current],
  );

  // 경로까지 최단 거리 + 진행 위치
  const routeInfo = useMemo(() => {
    if (!currentLatLng || routeCoords.length < 2) return null;
    return nearestOnRoute(currentLatLng, routeCoords);
  }, [currentLatLng, routeCoords]);

  // 코스 polyline 에서 턴 꼭짓점 미리 계산 (코스 바뀌기 전엔 재계산 불필요)
  const turns = useMemo(() => {
    if (routeCoords.length < 3) return [];
    return detectTurns(routeCoords, {
      minAngleDeg: 35,
      minLegM: 20,
      sharpAngleDeg: 75,
      uTurnAngleDeg: 150,
    });
  }, [routeCoords]);

  // 현재 위치 이후 첫 번째 턴 (자전거 기준 최대 1.5km 앞까지만 표시)
  const nextTurn = useMemo(() => {
    if (!routeInfo || turns.length === 0) return null;
    const nt = nextTurnFrom(turns, routeInfo.traveledM);
    if (!nt) return null;
    if (nt.distanceM > 1500) return null;
    return nt;
  }, [turns, routeInfo]);

  // 현재 위치에서 가장 가까운 인증센터
  const nearestCert = useMemo(() => {
    if (!currentLatLng || certCoords.length === 0) return null;
    return nearestPoi(currentLatLng, certCoords);
  }, [currentLatLng, certCoords]);

  // 지도에 강조 표시할 마커 (가장 가까운 인증센터 highlight)
  const displayCerts = useMemo(() => {
    if (!nearestCert) return certCoords;
    return certCoords.map((c) =>
      c === nearestCert.item ? { ...c, highlight: true } : c,
    );
  }, [certCoords, nearestCert]);

  // 카메라 포커스: 주행 중이면 현재 위치, 아니면 경로 첫 지점
  const focusLocation = useMemo(() => {
    if (rideId && currentLatLng) return currentLatLng;
    if (currentLatLng && routeInfo && routeInfo.distanceM < RESUME_RADIUS_M) {
      return currentLatLng;
    }
    return routeCoords[0] ?? currentLatLng ?? null;
  }, [rideId, currentLatLng, routeInfo, routeCoords]);

  /**
   * 카메라 추적 모드:
   * - 주행중 + 속도 3km/h 이상: heading-up (지도가 진행방향 기준으로 회전)
   * - 주행중 + 정지: north-up (회전 고정, 이동 시 재개)
   * - 주행 아님: off (지도 수동 조작 가능)
   */
  const followMode: 'off' | 'north-up' | 'heading-up' = useMemo(() => {
    if (!rideId) return 'off';
    const v = current?.speedKmh ?? 0;
    return v >= 3 ? 'heading-up' : 'north-up';
  }, [rideId, current?.speedKmh]);

  // ── 주행 요약 통계 누적 (샘플 간 델타 기반) ────────────────────────
  const statsRef = useRef<{
    prev: { lat: number; lng: number; t: number } | null;
    totalMeters: number;
    maxSpeedKmh: number;
    movingMs: number;
    stoppedMs: number;
  }>({
    prev: null,
    totalMeters: 0,
    maxSpeedKmh: 0,
    movingMs: 0,
    stoppedMs: 0,
  });

  const resetStats = useCallback(() => {
    statsRef.current = {
      prev: null,
      totalMeters: 0,
      maxSpeedKmh: 0,
      movingMs: 0,
      stoppedMs: 0,
    };
  }, []);

  const onSample = useCallback(
    async (s: LocationSample) => {
      setCurrent({ lat: s.lat, lng: s.lng, speedKmh: s.speedKmh, heading: s.heading ?? undefined });

      // 주행 중이면 로컬 통계 누적 (속도 1km/h 기준으로 이동/정지 구분)
      if (rideId) {
        const st = statsRef.current;
        const now = Date.parse(s.recordedAt) || Date.now();
        if (st.prev) {
          const dtMs = Math.max(0, now - st.prev.t);
          const dM = haversine(
            { latitude: st.prev.lat, longitude: st.prev.lng },
            { latitude: s.lat, longitude: s.lng },
          );
          // 연속 튐 방지: 샘플 간격이 비정상으로 길면 이동거리 누적 스킵
          if (dtMs <= 15_000 && dM < 500) {
            st.totalMeters += dM;
            if (s.speedKmh > 1) st.movingMs += dtMs;
            else st.stoppedMs += dtMs;
          }
        }
        st.prev = { lat: s.lat, lng: s.lng, t: now };
        if (s.speedKmh > st.maxSpeedKmh) st.maxSpeedKmh = s.speedKmh;
      }

      if (!courseId) return;
      const now = Date.now();
      if (now - lastProgressAt < 2000) return;
      setLastProgressAt(now);
      try {
        const p = await navigationApi.progress({
          courseId,
          lat: s.lat,
          lng: s.lng,
          speedKmh: s.speedKmh,
          headingDeg: s.heading ?? undefined,
          lastSegmentIndex: lastSegmentIndexRef.current,
        });
        lastSegmentIndexRef.current = p.segmentIndex;

        // off-route 연속 지속 판정: raw 값이 true 여도 "연속 6초 이상" 지속되어야 확정.
        if (p.offRoute) {
          if (offRouteSinceRef.current == null) offRouteSinceRef.current = now;
        } else {
          offRouteSinceRef.current = null;
        }
        const offConfirmed =
          p.offRoute &&
          offRouteSinceRef.current != null &&
          now - offRouteSinceRef.current >= 6000;

        if (offConfirmed !== confirmedOffRoute) {
          setConfirmedOffRoute(offConfirmed);
          if (offConfirmed && voiceEnabled) speakKo('경로를 이탈했습니다');
        }

        // 역방향 진행 경고 (확정 off-route 가 아닐 때만 유효)
        if (
          !offConfirmed &&
          p.headingMismatch &&
          voiceEnabled &&
          now - lastHeadingWarnAtRef.current > 30_000 &&
          s.speedKmh > 5
        ) {
          lastHeadingWarnAtRef.current = now;
          speakKo('반대 방향으로 가고 있습니다');
        }

        setProgress({
          snapped: p.snapped,
          remainingDistanceKm: p.remainingDistanceKm,
          estimatedDurationMin: p.estimatedDurationMin,
          estimatedArrivalAt: p.estimatedArrivalAt,
          // store 의 offRoute 는 "확정값"만 반영. 단발 튐으로 UI 를 흔들지 않음.
          offRoute: offConfirmed,
          nextPoiName: p.nextPoi?.name ?? null,
          nextPoiDistanceKm: p.nextPoi?.distanceKm ?? null,
        });

        if (rideId) {
          ridesApi
            .track(rideId, [
              {
                lat: s.lat,
                lng: s.lng,
                speedKmh: s.speedKmh,
                altitudeM: s.altitudeM ?? undefined,
                recordedAt: s.recordedAt,
              },
            ])
            .catch(() => undefined);
        }
      } catch {
        /* ignore network errors during tracking */
      }
    },
    [
      courseId,
      lastProgressAt,
      rideId,
      setCurrent,
      setProgress,
      confirmedOffRoute,
      voiceEnabled,
    ],
  );

  const buildEndPayload = useCallback(() => {
    const st = statsRef.current;
    const movingSec = Math.round(st.movingMs / 1000);
    const stoppedSec = Math.round(st.stoppedMs / 1000);
    const totalKm = st.totalMeters / 1000;
    const avg = movingSec > 0 ? totalKm / (movingSec / 3600) : 0;
    return {
      totalDistanceKm: Number(totalKm.toFixed(2)),
      avgSpeedKmh: Number(avg.toFixed(2)),
      maxSpeedKmh: Number(st.maxSpeedKmh.toFixed(2)),
      movingTimeSec: movingSec,
      stoppedTimeSec: stoppedSec,
    };
  }, []);

  useRideTracking(true, onSample);

  // ── 음성 턴바이턴 안내 ─────────────────────────────────────────────
  // 턴별로 "500m / 200m / 50m / at-turn" 버킷을 한 번씩만 발화.
  const announcedRef = useRef<Map<number, Set<string>>>(new Map());

  useEffect(() => {
    if (!rideId) return;
    if (!voiceEnabled) return;
    if (!nextTurn) return;

    const { turn, distanceM } = nextTurn;
    const key = turn.cumM; // 이 턴의 안정적인 식별자
    let set = announcedRef.current.get(key);
    if (!set) {
      set = new Set();
      announcedRef.current.set(key, set);
    }

    const label = turnLabelKo(turn.direction);
    const speakIfNew = (bucket: string, text: string) => {
      if (!set) return;
      if (set.has(bucket)) return;
      set.add(bucket);
      speakKo(text);
    };

    // 자전거 기준 안내 버킷: 자동차 500/200/50 보다 가까운 300/100/30m.
    // 평균 시속 15km/h 기준 300m ≈ 72s, 100m ≈ 24s, 30m ≈ 7s 전 안내.
    if (distanceM <= 15) {
      speakIfNew('at', label);
    } else if (distanceM <= 40) {
      speakIfNew('30m', `30미터 앞 ${label}`);
    } else if (distanceM <= 120) {
      speakIfNew('100m', `100미터 앞 ${label}`);
    } else if (distanceM <= 320) {
      speakIfNew('300m', `300미터 앞 ${label}`);
    }
  }, [nextTurn, rideId, voiceEnabled]);

  // 주행 종료/코스 변경 시 버킷 리셋
  useEffect(() => {
    if (!rideId) {
      announcedRef.current = new Map();
      stopSpeaking();
    }
    // 코스/주행 변경 시 경로 관련 세션 상태 리셋
    lastSegmentIndexRef.current = undefined;
    offRouteSinceRef.current = null;
    lastHeadingWarnAtRef.current = 0;
    setConfirmedOffRoute(false);
  }, [rideId, courseId]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      if (rideId) {
        ridesApi.end(rideId, buildEndPayload()).catch(() => undefined);
        endRide();
        resetStats();
      }
    };
  }, [endRide, rideId, buildEndPayload, resetStats]);

  const locationAbroad = useMemo(
    () => !!currentLatLng && !isInKorea(currentLatLng),
    [currentLatLng],
  );

  const describeError = useCallback((err: unknown): string => {
    type MaybeAxios = {
      message?: string;
      code?: string;
      response?: { status?: number; data?: unknown };
      config?: { baseURL?: string; url?: string };
    };
    const e = (err ?? {}) as MaybeAxios;
    const status = e.response?.status;
    const data = e.response?.data;
    const bodyMsg =
      typeof data === 'string'
        ? data
        : data && typeof data === 'object'
          ? ((data as { message?: string }).message ?? JSON.stringify(data))
          : undefined;
    const url = `${e.config?.baseURL ?? ''}${e.config?.url ?? ''}`;
    return [
      status ? `HTTP ${status}` : e.code,
      bodyMsg,
      e.message,
      url ? `URL: ${url}` : undefined,
    ]
      .filter(Boolean)
      .join('\n');
  }, []);

  const useTestStartPoint = useCallback(
    (opts?: { alsoStart?: boolean }) => {
      const start = routeCoords[0];
      if (!start) return;
      setCurrent({ lat: start.latitude, lng: start.longitude, speedKmh: 0 });
      if (opts?.alsoStart && courseId && !rideId) {
        getDeviceId()
          .then((deviceId) => ridesApi.start({ courseId, deviceId }))
          .then((s) => {
            resetStats();
            startRide(s.id);
          })
          .catch((err) =>
            Alert.alert('주행을 시작할 수 없습니다', describeError(err)),
          );
      }
    },
    [routeCoords, setCurrent, courseId, rideId, startRide, resetStats, describeError],
  );

  const doStart = useCallback(
    async (resume: boolean) => {
      if (!courseId) return;
      try {
        const deviceId = await getDeviceId();
        const s = await ridesApi.start({ courseId, deviceId });
        resetStats();
        startRide(s.id);
      } catch (err) {
        Alert.alert('주행을 시작할 수 없습니다', describeError(err));
      }
      void resume;
    },
    [courseId, startRide, resetStats, describeError],
  );

  const startState = useMemo(() => {
    if (!courseId) return { mode: 'no-course' as const };
    if (!currentLatLng) return { mode: 'no-location' as const };
    if (!routeInfo) return { mode: 'no-route' as const };
    if (routeInfo.distanceM <= START_RADIUS_M) {
      return { mode: 'start' as const, distanceM: routeInfo.distanceM };
    }
    if (routeInfo.distanceM <= RESUME_RADIUS_M) {
      return { mode: 'resume' as const, distanceM: routeInfo.distanceM, traveledM: routeInfo.traveledM };
    }
    return { mode: 'too-far' as const, distanceM: routeInfo.distanceM };
  }, [courseId, currentLatLng, routeInfo]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>
        <NaverMap
          currentLocation={currentLatLng}
          snappedLocation={snapped ? { latitude: snapped.lat, longitude: snapped.lng } : null}
          heading={displayHeading}
          routeCoords={routeCoords}
          routePaths={displayPaths}
          certificationCenters={displayCerts}
          focusLocation={focusLocation}
          followMode={followMode}
        />

        {!courseId && (
          <View
            style={[styles.banner, { top: insets.top + spacing.md }]}
            pointerEvents="none"
          >
            <Text style={styles.bannerTitle}>코스 미선택</Text>
            <Text style={styles.bannerCaption}>홈에서 코스를 선택하면 경로가 표시됩니다.</Text>
          </View>
        )}

        {courseId && startState.mode === 'resume' && (
          <View
            style={[
              styles.banner,
              styles.bannerWarn,
              { top: insets.top + spacing.md },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.bannerTitle}>경로에서 {formatDistance(startState.distanceM)} 떨어져 있습니다</Text>
            <Text style={styles.bannerCaption}>가까운 경로 지점부터 이어 달릴 수 있어요.</Text>
          </View>
        )}

        {courseId && startState.mode === 'too-far' && !locationAbroad && (
          <View
            style={[
              styles.banner,
              styles.bannerDanger,
              { top: insets.top + spacing.md },
            ]}
            pointerEvents="none"
          >
            <Text style={[styles.bannerTitle, { color: '#fff' }]}>경로와 너무 멀리 있습니다 ({formatDistance(startState.distanceM)})</Text>
            <Text style={[styles.bannerCaption, { color: '#ddd' }]}>10km 이내로 이동 후 시작할 수 있습니다.</Text>
          </View>
        )}

        {courseId && locationAbroad && (
          <View
            style={[
              styles.banner,
              styles.bannerDanger,
              { top: insets.top + spacing.md },
            ]}
          >
            <Text style={[styles.bannerTitle, { color: '#fff' }]}>현재 위치가 한국이 아닙니다</Text>
            <Text style={[styles.bannerCaption, { color: '#ddd' }]}>
              GPS 권한을 확인해 주세요. 또는 아래 "테스트 시작점 사용" 으로 시뮬레이션.
            </Text>
          </View>
        )}

        {courseId && nearestCert && currentLatLng && (
          <View style={styles.certCard} pointerEvents="none">
            <Text style={styles.certLabel}>가장 가까운 인증센터</Text>
            <Text style={styles.certName} numberOfLines={1}>{nearestCert.item.name ?? '인증센터'}</Text>
            {routeInfo && (
              <Text style={styles.certDist}>
                경로 진행 {formatDistance(routeInfo.traveledM)} / {formatDistance(routeInfo.totalM)}
              </Text>
            )}
          </View>
        )}
      </View>

      {courseId ? (
        <RideStatsPanel
          currentSpeedKmh={
            // GPS speed 가 음수/NaN 으로 오는 경우 방어
            current?.speedKmh != null && Number.isFinite(current.speedKmh)
              ? Math.max(0, current.speedKmh)
              : undefined
          }
          remainingKm={remainingKm}
          etaIso={etaIso}
          etaDurationMin={etaMin}
          // 서버 progress 응답이 아직 없거나 nextPoi 가 null 일 때는
          // 로컬에서 계산한 "가장 가까운 인증센터" 를 대체 표시.
          nextPoiName={nextName ?? nearestCert?.item.name ?? null}
          nextPoiDistanceKm={
            nextDist ?? (nearestCert ? nearestCert.distanceM / 1000 : null)
          }
          offRoute={offRoute}
          nextTurn={
            rideId && nextTurn
              ? { direction: nextTurn.turn.direction, distanceM: nextTurn.distanceM }
              : null
          }
        />
      ) : null}

      <View
        style={[
          styles.btnRow,
          { paddingBottom: Math.max(insets.bottom, spacing.md) },
        ]}
      >
        {rideId ? (
          <MonoButton
            label="주행 종료"
            variant="outline"
            onPress={async () => {
              const payload = buildEndPayload();
              try {
                await ridesApi.end(rideId, payload);
              } finally {
                endRide();
                resetStats();
              }
            }}
          />
        ) : startState.mode === 'no-course' ? (
          <MonoButton label="홈에서 코스 선택하기" variant="outline" disabled />
        ) : startState.mode === 'no-route' ? (
          <MonoButton label="경로 불러오는 중..." variant="outline" disabled />
        ) : startState.mode === 'no-location' ? (
          <MonoButton
            label="현재 위치 없이 바로 시작 (테스트)"
            onPress={() => useTestStartPoint({ alsoStart: true })}
          />
        ) : startState.mode === 'start' ? (
          <MonoButton
            label={`주행 시작 (경로까지 ${formatDistance(startState.distanceM)})`}
            onPress={() => doStart(false)}
          />
        ) : startState.mode === 'resume' ? (
          <MonoButton
            label={`이어서 출발 (경로까지 ${formatDistance(startState.distanceM)})`}
            variant="outline"
            onPress={() =>
              Alert.alert(
                '이어서 출발하시겠어요?',
                `현재 위치가 경로에서 ${formatDistance(
                  startState.distanceM,
                )} 떨어져 있어요. 가장 가까운 경로 지점(진행 ${formatDistance(
                  startState.traveledM,
                )})부터 이어서 달립니다.`,
                [
                  { text: '취소', style: 'cancel' },
                  { text: '이어 달리기', onPress: () => doStart(true) },
                ],
              )
            }
          />
        ) : (
          <MonoButton
            label={`경로까지 ${formatDistance(startState.distanceM)} (10km 초과)`}
            variant="outline"
            disabled
          />
        )}

        {rideId && nearestCert ? (
          <Text style={styles.hint}>
            다음 인증센터까지 약 {formatDistance(nearestCert.distanceM)} · {nearestCert.item.name ?? '인증센터'}
          </Text>
        ) : null}

        {!rideId &&
        courseId &&
        routeCoords.length > 0 &&
        (locationAbroad ||
          startState.mode === 'too-far' ||
          startState.mode === 'no-location') ? (
          <Pressable onPress={() => useTestStartPoint()} hitSlop={10}>
            <Text style={styles.testLink}>
              {startState.mode === 'start' || startState.mode === 'resume'
                ? '테스트: 코스 시작점으로 점프'
                : '테스트: 현재 위치를 코스 시작점으로 설정'}
            </Text>
          </Pressable>
        ) : null}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  btnRow: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.bg,
    gap: spacing.sm,
  },
  banner: {
    position: 'absolute',
    // top 은 런타임에 safe-area-inset 을 더해 지정한다 (노치/다이나믹아일랜드 회피)
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  bannerWarn: {
    backgroundColor: '#FFF8E1',
    borderColor: '#000',
  },
  bannerDanger: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  bannerTitle: { ...typography.bodyBold, color: colors.text },
  bannerCaption: { ...typography.caption, color: colors.textMuted },
  certCard: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  certLabel: { ...typography.caption, color: colors.textMuted, marginBottom: 2 },
  certName: { ...typography.bodyBold, color: colors.text },
  certDist: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  testLink: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
