import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { appConfig } from '../config/appConfig';
import { colors, typography } from '../theme';

interface Coord {
  latitude: number;
  longitude: number;
}

interface NamedCoord extends Coord {
  name?: string;
  highlight?: boolean;
}

interface Props {
  currentLocation?: Coord | null;
  snappedLocation?: Coord | null;
  /** 현재 위치 마커가 가리킬 방향 (0~360, 진북 기준, 시계방향). null 이면 원형 점. */
  heading?: number | null;
  routeCoords?: Coord[];
  /**
   * 지도에 그릴 폴리라인(들). 여러 조각으로 분할해서 주면 각 조각이 독립 polyline 으로
   * 렌더된다. 주지 않으면 routeCoords 를 단일 polyline 으로 그린다.
   * 큰 점프(예: 본선↔지선 연결선)를 잘라서 시각적으로 직선 막대가 나오는 것을 막는 용도.
   */
  routePaths?: Coord[][];
  certificationCenters?: NamedCoord[];
  /** 카메라 중심. 주어지지 않으면 첫 경로점 또는 현재 위치. */
  focusLocation?: Coord | null;
  /** 초기 줌 레벨 (네이버 기준 12~18 권장). 기본 12 */
  initialZoom?: number;
  /**
   * 카메라 추적 모드.
   * - "off": 수동
   * - "north-up": 북쪽 고정, 중심만 추적
   * - "heading-up": 현재 heading 을 위로 오도록 지도 회전 + 중심 추적
   */
  followMode?: 'off' | 'north-up' | 'heading-up';
}

const DEFAULT_CENTER: Coord = { latitude: 37.5172, longitude: 127.0473 };

export function NaverMap({
  currentLocation,
  snappedLocation,
  heading = null,
  routeCoords = [],
  routePaths,
  certificationCenters = [],
  focusLocation,
  initialZoom = 12,
  followMode = 'off',
}: Props) {
  const webRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const initial = focusLocation ?? routeCoords[0] ?? currentLocation ?? DEFAULT_CENTER;

  const mapUrl = useMemo(() => {
    const base = appConfig.apiBaseUrl.replace(/\/+$/, '');
    const qs = new URLSearchParams({
      lat: String(initial.latitude),
      lng: String(initial.longitude),
      zoom: String(initialZoom),
    }).toString();
    return `${base}/api/map/naver.html?${qs}`;
    // initial / zoom 변경 시 reload 되면 깜빡이므로 최초 1회만 사용
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyUpdates = useCallback(() => {
    if (!readyRef.current || !webRef.current) return;
    // paths: 항상 [[[lat,lng],...], ...] 형태로 WebView 에 넘김. routePaths 가 있으면 그걸,
    // 없으면 routeCoords 를 단일 path 로 감싸서 전달.
    const paths = routePaths
      ? routePaths.map((p) => p.map((c) => [c.latitude, c.longitude]))
      : [routeCoords.map((c) => [c.latitude, c.longitude])];
    const markers = certificationCenters.map((c) => [
      c.latitude,
      c.longitude,
      c.name ?? '',
      c.highlight ? 1 : 0,
    ]);
    const curr = snappedLocation ?? currentLocation ?? null;
    const h = heading != null && Number.isFinite(heading) ? heading : 'null';
    const script = `
      try {
        window.__updatePath && window.__updatePath(${JSON.stringify(paths)});
        window.__updateMarkers && window.__updateMarkers(${JSON.stringify(markers)});
        window.__updateCurrent && window.__updateCurrent(${curr ? curr.latitude : 'null'}, ${curr ? curr.longitude : 'null'}, ${h});
      } catch (e) {}
      true;
    `;
    webRef.current.injectJavaScript(script);
  }, [routeCoords, routePaths, certificationCenters, currentLocation, snappedLocation, heading]);

  useEffect(() => {
    applyUpdates();
  }, [applyUpdates]);

  // heading-up 모드면 heading 변경 시 지도 회전까지 적용 (경로/마커 리인젝션 없이)
  useEffect(() => {
    if (!readyRef.current || !webRef.current) return;
    if (followMode === 'heading-up' && heading != null && Number.isFinite(heading)) {
      webRef.current.injectJavaScript(
        `window.__setMapRotation && window.__setMapRotation(${heading}); true;`,
      );
    } else if (followMode === 'north-up') {
      webRef.current.injectJavaScript(
        `window.__setMapRotation && window.__setMapRotation(0); true;`,
      );
    }
  }, [heading, followMode]);

  useEffect(() => {
    if (!focusLocation || !readyRef.current || !webRef.current) return;
    webRef.current.injectJavaScript(
      `window.__recenter && window.__recenter(${focusLocation.latitude}, ${focusLocation.longitude}); true;`,
    );
  }, [focusLocation?.latitude, focusLocation?.longitude]);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(e.nativeEvent.data);
        if (data.type === 'ready') {
          readyRef.current = true;
          setLoadError(null);
          applyUpdates();
        } else if (data.type === 'auth-fail') {
          setLoadError('네이버 지도 인증 실패');
        } else if (data.type === 'error') {
          setLoadError('네이버 지도 로드 실패');
        }
      } catch {
        /* ignore */
      }
    },
    [applyUpdates],
  );

  if (!appConfig.naverMapClientId && !appConfig.apiBaseUrl) {
    return (
      <View style={[StyleSheet.absoluteFillObject, styles.fallback]}>
        <Text style={styles.fallbackText}>네이버 지도 설정이 비어 있습니다.</Text>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <WebView
        ref={webRef}
        style={StyleSheet.absoluteFillObject}
        source={{ uri: mapUrl }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
        allowsInlineMediaPlayback
        mixedContentMode="always"
        startInLoadingState
        renderLoading={() => (
          <View style={[StyleSheet.absoluteFillObject, styles.loading]}>
            <ActivityIndicator color={colors.text} />
          </View>
        )}
      />
      {loadError ? (
        <View style={styles.errorBanner} pointerEvents="none">
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fallbackText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  loading: {
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: '#000',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  errorText: {
    ...typography.caption,
    color: '#fff',
    textAlign: 'center',
  },
});
