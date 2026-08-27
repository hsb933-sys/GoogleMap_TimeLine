# 여행 타임라인 영상 만들기

Google Timeline.json을 업로드하면 전체 여행 기록을 지도에서 확인하고, 원하는 기간을 선택해
지도 위에 이동 경로가 그려지는 애니메이션 영상(WebM)으로 만들어 다운로드할 수 있는 완전
클라이언트 사이드 웹앱입니다. 업로드한 위치 데이터는 서버로 전송되지 않으며 모든 처리(파싱,
지도 렌더링, 영상 녹화)는 브라우저 안에서만 이루어집니다.

## 개발

```bash
npm install
npm run dev
```

## 테스트

```bash
npm run test
```

## 빌드

```bash
npm run build
```

`dist/` 폴더에 정적 파일이 생성됩니다. `vite.config.ts`의 `base: './'` 설정 덕분에 어떤 경로에
배포하거나 iframe으로 임베드해도 상대 경로로 정상 동작합니다.

## 블로그에 임베드하기

1. `npm run build` 후 `dist/` 폴더를 정적 호스팅(GitHub Pages, Netlify, Vercel 등)에 업로드합니다.
2. 블로그 글에 아래와 같이 iframe을 삽입합니다.

```html
<iframe
  src="https://your-host.example.com/travel-app/"
  width="100%"
  height="800"
  style="border:0"
  loading="lazy"
></iframe>
```

## 기술 스택 및 참고 사항

- **지도**: Leaflet + OpenStreetMap (API 키 불필요)
- **영상 생성**: 별도의 Canvas2D 렌더러(`src/lib/canvasMapRenderer.ts`)로 OSM 타일과 이동
  경로를 직접 그리고, `canvas.captureStream()` + `MediaRecorder`로 녹화합니다. Leaflet은
  개요 지도와 기간 선택 UI에만 사용됩니다(DOM 기반이라 직접 캡처가 불가능하기 때문).
- **출력 포맷**: WebM (VP9/VP8). 브라우저 네이티브로는 MP4 인코딩이 불안정해 1차 범위에서
  제외했습니다.
- **내보내기 중 탭 전환 주의**: 브라우저가 백그라운드 탭의 애니메이션 프레임을 강하게
  제한하므로, 내보내기가 진행되는 동안 다른 탭으로 전환하지 않는 것이 좋습니다(내부적으로
  `setInterval` 기반 타이머를 사용해 탭이 백그라운드로 가도 내보내기 자체는 끝까지
  완료되지만, 애니메이션이 더 거칠게 보일 수 있습니다).
- Safari 등 일부 구형 브라우저는 `MediaRecorder`를 지원하지 않을 수 있으며, 이 경우 앱이
  안내 메시지를 표시합니다.
- **여행지역 이름(역지오코딩)**: 방문 지점들을 도시 단위(약 15km 반경)로 묶은 뒤
  OSM Nominatim(`nominatim.openstreetmap.org`)에 좌표를 보내 지명을 조회합니다
  (`src/lib/reverseGeocode.ts`). Nominatim 정책상 초당 1회로 속도를 제한하고 결과는
  캐시합니다. 이 조회 과정에서만 좌표가 외부(OSM)로 전송되며, 원본 Timeline.json이나
  전체 경로 데이터는 여전히 브라우저 밖으로 나가지 않습니다. Nominatim이 요청을 막거나
  (개발 중 `localhost`에서 CORS 차단이 확인된 사례가 있음) 오프라인 상태면, 자동으로
  좌표 문자열(예: "37.57°, 126.98°")로 대체되어 표시되며 영상 생성 자체는 실패하지
  않습니다. 실제 배포 도메인에서 다시 확인해 보는 것을 권장합니다.
