# 뷁어번역기 Pro

> **인코딩 깨짐(이른바 뷁어·모지바케)을 양방향으로 번역·복원하는 서버리스 정적 웹앱**

<img src="https://i.imgur.com/hMq1iZ0.png" width="100%">

🔗 **링크:** https://jtech-co.github.io/BWEK-Pro/

## 1. 소개 (Introduction)

이 프로젝트는 한 인코딩으로 만든 바이트를 다른 인코딩으로 잘못 읽어 글자가 깨지는 현상(**뷁어**, mojibake)을 복원하고 재현하기 위해 개발된 웹 애플리케이션입니다. 예를 들어 일본어 `あいうえお`(Shift-JIS)를 한국어(CP949)로 읽으면 `궇궋궎궑궓`가 되는데, 이를 클릭 한 번으로 되돌립니다. 모든 변환이 브라우저에서 일어나므로 **입력 내용은 서버로 전송되지 않습니다.**

**주요 기능**
- **인코딩 깨짐 양방향 변환**: 일본어(Shift-JIS)·한국어(CP949)·중국어(GBK/Big5)·UTF-8·Latin-1 등 임의 인코딩 조합을 서로 깨뜨리고 복원
- **스마트 복원**: 깨진 글을 붙여넣으면 가능한 오독 조합을 추론해 신뢰도순 후보 제시
- **유니코드 도구**: 한글 자소결합/분리(NFC/NFD), 전각↔반각, `\u`·HTML 엔티티·퍼센트(URL) 코덱, 코드포인트·바이트 뷰어
- **레트로 XP UI**: Windows XP(Luna) 창 스타일을 충실히 재현하면서 접근성·반응형 개선
- **서버리스 편의 기능**: 공유 링크(URL 해시), 실시간 변환, 인코딩 데이터 무번들(브라우저 내장 API 활용)

> 참고: 양쪽 인코딩에서 모두 유효한 바이트가 아닌 일부 글자(예: 특정 한자)는 왕복이 손실될 수 있습니다 — 실제 뷁어에서도 동일하게 나타나는 현상입니다.

## 2. 기술 스택 (Tech Stack)

- **Frontend**: TypeScript (프레임워크 없음), Vite
- **인코딩 엔진**: 브라우저 내장 `TextEncoder` / `TextDecoder` (런타임 의존성 0)
- **Backend**: 없음 (완전한 클라이언트 사이드)
- **Deployment**: GitHub Pages (GitHub Actions 자동 배포)

## 3. 설치 및 실행 (Quick Start)

**요구 사항**: Node.js 20.19+ 또는 22.12+

1. **설치 (Install)**
   ```bash
   git clone https://github.com/JTech-CO/BWEK-Pro.git
   cd BWEK-Pro
   npm install
   ```

2. **환경 변수 (Environment)**
   별도의 환경 변수가 필요 없습니다. 서버·API 키 없이 그대로 동작합니다.

3. **실행 (Run)**
   ```bash
   npm run dev      # 개발 서버 (http://localhost:5173)
   npm run build    # 타입체크 + 프로덕션 빌드 (dist/)
   npm run preview  # 빌드 결과 미리보기
   ```

## 4. 폴더 구조 (Structure)

```text
src/
├── lib/
│   ├── codecs.ts      # 인코딩 엔진 (encode/decode/reinterpret)
│   ├── convert.ts     # 프리셋 + 변환 적용 (인코딩 깨짐 / 유니코드 도구)
│   ├── transforms.ts  # 유니코드 변환 (NFC·NFD, 전각/반각, 이스케이프 등)
│   ├── detect.ts      # 스마트 복원 (후보 추론·점수화)
│   ├── share.ts       # URL 해시 상태 공유
│   └── index.ts       # 엔진 묶음 (지연 로드 진입점)
├── styles/
│   └── xp.css         # Windows XP(Luna) 테마 · 반응형 · 접근성
└── main.ts            # UI 바인딩 및 이벤트
```

## 5. 라이선스 (License)

- **MIT** 
