import { Router } from 'express';
import { env } from '../config/env';

const router = Router();

/**
 * 모바일 WebView 가 로드할 Naver Maps JavaScript v3 초기 HTML.
 * - 실제 URL 로 호스팅돼 Referer/Origin 이 `https://msnavi.msking.co.kr` 로 잡히도록 함
 *   (네이버 콘솔에 등록한 Web 서비스 URL 과 일치해야 인증 통과).
 * - 초기 로드 후 WebView.injectJavaScript 로 __updatePath/__updateMarkers/__updateCurrent 호출.
 */
router.get('/naver.html', (req, res) => {
  const clientId = env.naver.mapClientId;
  const authParam = env.naver.mapAuthParam;

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const zoom = Number(req.query.zoom);

  const safeLat = Number.isFinite(lat) ? lat : 37.5172;
  const safeLng = Number.isFinite(lng) ? lng : 127.0473;
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? Math.min(zoom, 19) : 12;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // Helmet 의 기본 CSP 는 inline/external 스크립트를 막으므로 이 HTML 에 한해 완화.
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src * data: blob:",
      "script-src * 'unsafe-inline' 'unsafe-eval' blob:",
      "style-src * 'unsafe-inline'",
      "img-src * data: blob:",
      "connect-src *",
      "font-src * data:",
    ].join('; '),
  );

  res.send(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <title>Naver Map</title>
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #f2f2f2; }
    #map { transition: transform 300ms linear; will-change: transform; }
    body { -webkit-tap-highlight-color: transparent; font-family: -apple-system, BlinkMacSystemFont, 'Noto Sans KR', Roboto, sans-serif; }
    .auth-fail {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      background: #fff; color: #000; font-size: 13px; padding: 16px; text-align: center; line-height: 1.5;
    }
  </style>
  <script>
    // 네이버 인증 실패 콜백: 공식 훅
    window.navermap_authFailure = function () {
      var el = document.getElementById('auth-fail');
      if (el) el.style.display = 'flex';
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'auth-fail',
          payload: { authParam: ${JSON.stringify(authParam)}, clientId: ${JSON.stringify(clientId)} }
        }));
      }
    };
  </script>
  <script src="https://oapi.map.naver.com/openapi/v3/maps.js?${authParam}=${encodeURIComponent(clientId)}"></script>
</head>
<body>
  <div id="map"></div>
  <div id="auth-fail" class="auth-fail" style="display:none">
    네이버 지도 인증에 실패했습니다.<br/>
    Naver Cloud 콘솔에서 Web 서비스 URL 에<br/>
    <b>https://msnavi.msking.co.kr</b> 가 등록되어 있는지 확인해 주세요.
  </div>
  <script>
    (function () {
      var map, polylines = [], markers = [], currentMarker;
      var didFitBounds = false;

      function post(type, payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload || null }));
        }
      }

      function initMap() {
        if (typeof naver === 'undefined' || !naver.maps) return false;
        map = new naver.maps.Map('map', {
          center: new naver.maps.LatLng(${safeLat}, ${safeLng}),
          zoom: ${safeZoom},
          mapDataControl: false,
          scaleControl: false,
          logoControl: true,
          mapTypeControl: false,
          zoomControl: false,
        });
        post('ready');
        return true;
      }

      /**
       * 경로 polyline 을 그린다. paths 는 "여러 조각" 을 지원하는 multi-path 형태:
       *   paths = [ [[lat,lng], [lat,lng], ...], [[lat,lng], ...], ... ]
       * 조각마다 독립 polyline 으로 렌더한다. 본선↔지선 점프처럼 큰 간격을
       * 잘라서 넘기면 그 사이에 직선 막대가 안 생긴다.
       * 과거 호환을 위해 단일 배열 [[lat,lng],...] 이 오면 자동으로 [그 배열] 로 감싼다.
       */
      window.__updatePath = function (paths) {
        if (!map) return;
        polylines.forEach(function (p) { p.setMap(null); });
        polylines = [];
        if (!paths || paths.length === 0) return;
        // back-compat: 단일 path ([[lat,lng],...]) 로 들어오면 [paths] 로 감쌈
        var multi = (Array.isArray(paths[0]) && Array.isArray(paths[0][0]))
          ? paths
          : [paths];
        var allBounds = null;
        multi.forEach(function (coords) {
          if (!coords || coords.length < 2) return;
          var path = coords.map(function (c) { return new naver.maps.LatLng(c[0], c[1]); });
          var pl = new naver.maps.Polyline({
            map: map, path: path,
            strokeColor: '#000000', strokeWeight: 5, strokeOpacity: 0.9,
          });
          polylines.push(pl);
          try {
            var b = pl.getBounds();
            if (!allBounds) allBounds = b;
            else {
              // LatLngBounds.union 이 없는 환경 대비: 각 끝점으로 extend.
              allBounds.extend(b.getNE());
              allBounds.extend(b.getSW());
            }
          } catch (e) {}
        });
        if (!didFitBounds && allBounds) {
          try { map.fitBounds(allBounds, { top: 60, right: 40, bottom: 160, left: 40 }); } catch (e) {}
          didFitBounds = true;
        }
      };

      window.__updateMarkers = function (items) {
        markers.forEach(function (m) { m.setMap(null); });
        markers = [];
        if (!map || !items) return;
        items.forEach(function (p) {
          var highlight = !!p[3];
          var rot = mapRotationDeg ? ';transform: rotate(' + mapRotationDeg + 'deg);transform-origin:50% 50%' : '';
          var m = new naver.maps.Marker({
            position: new naver.maps.LatLng(p[0], p[1]),
            map: map,
            title: p[2] || '',
            icon: {
              content: '<div style="padding:4px 8px;background:' + (highlight ? '#000' : '#fff') + ';color:' + (highlight ? '#fff' : '#000') + ';border:1px solid #000;border-radius:999px;font-size:11px;white-space:nowrap' + rot + '">' + (p[2] || '인증') + '</div>',
              anchor: new naver.maps.Point(30, 12),
            }
          });
          markers.push(m);
        });
      };

      var lastCurrent = { lat: null, lng: null, heading: null };
      var mapRotationDeg = 0;

      /**
       * 현재 위치 마커 렌더.
       * heading 이 유효하면 위쪽으로 뻗는 콘(부채꼴)과 함께 표시, 아니면 원형 점만.
       * SVG 는 "위쪽으로 뻗는 콘 + 원형 중앙점" 구조. CSS transform 으로 회전.
       */
      window.__updateCurrent = function (lat, lng, heading) {
        lastCurrent = { lat: lat, lng: lng, heading: heading };
        if (!map) return;
        if (currentMarker) { currentMarker.setMap(null); currentMarker = null; }
        if (lat == null || lng == null) return;

        var hasHeading = (typeof heading === 'number') && isFinite(heading);
        // SVG 48x48 중앙 (24,24) 에 점, 위쪽으로 20° 반각의 콘.
        // viewBox 기준 heading=0 이면 콘이 위를 향하게 그린다 (North = up in SVG).
        var svg = ''
          + '<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" '
          + 'style="transform: rotate(' + (hasHeading ? heading : 0) + 'deg); transform-origin: 24px 24px;">'
          + (hasHeading
              ? '<path d="M 24 4 L 36 24 L 24 18 L 12 24 Z" fill="#000" opacity="0.85"/>'
              : '')
          + '<circle cx="24" cy="24" r="7" fill="#000" stroke="#fff" stroke-width="3"/>'
          + '<circle cx="24" cy="24" r="8.5" fill="none" stroke="#000" stroke-width="1"/>'
          + '</svg>';

        currentMarker = new naver.maps.Marker({
          position: new naver.maps.LatLng(lat, lng),
          map: map,
          icon: {
            content: '<div style="width:48px;height:48px;pointer-events:none">' + svg + '</div>',
            anchor: new naver.maps.Point(24, 24),
          }
        });
      };

      /**
       * 지도 전체를 heading-up 모드로 회전.
       * 네이버 Maps v3 는 자체 rotation API 가 없어 #map 컨테이너에 CSS transform 적용.
       * - deg: 사용자 heading (진북 기준 시계방향). 실제 적용은 rotate(-deg) 로 "사용자 방향 = 화면 위".
       * - 회전 중심은 viewport 중앙 (지도는 주로 현재 위치 중심에 있으므로 자연스러움).
       * - 회전 시 기존 마커들도 같이 돌아가므로 markers/current 를 역회전시켜 "지도만 돌고 마커는 고정" 효과.
       */
      window.__setMapRotation = function (deg) {
        mapRotationDeg = (typeof deg === 'number' && isFinite(deg)) ? deg : 0;
        var el = document.getElementById('map');
        if (!el) return;
        el.style.transform = 'rotate(' + (-mapRotationDeg) + 'deg)';
        el.style.transformOrigin = '50% 50%';
        // 현재 위치 마커 화살표는 lastCurrent.heading 기준으로 이미 올바른 방향이므로 재렌더 불필요.
        // 텍스트 마커(인증센터)는 역회전 스타일을 개별 DOM 에서 적용한다.
        applyCounterRotationToTextMarkers();
      };

      function applyCounterRotationToTextMarkers() {
        // markers 는 naver.maps.Marker 배열. content div 에 counter-rotate 적용.
        markers.forEach(function (m) {
          try {
            var el = m.getElement && m.getElement();
            if (!el) return;
            // 내부 첫 번째 div(라벨)를 찾아 rotate(mapRotationDeg) 적용 → 화면상 수평 유지
            var inner = el.querySelector('div');
            if (inner) {
              inner.style.transform = 'rotate(' + mapRotationDeg + 'deg)';
              inner.style.transformOrigin = '50% 50%';
            }
          } catch (e) {}
        });
      }

      window.__recenter = function (lat, lng, zoom) {
        if (!map) return;
        map.setCenter(new naver.maps.LatLng(lat, lng));
        if (zoom) map.setZoom(zoom);
      };

      var tries = 0;
      var timer = setInterval(function () {
        tries++;
        if (initMap()) {
          clearInterval(timer);
        } else if (tries > 200) {
          clearInterval(timer);
          post('error', 'naver-maps-load-timeout');
        }
      }, 50);
    })();
  </script>
</body>
</html>`);
});

export default router;
