# CHECKPOINT — 배포 및 검증 상태

## GitHub

- 저장소: https://github.com/ydv721/CheckPointPlan
- 기본 브랜치: `main`
- 저장소 공개 상태: Public
- Next.js 앱 소스 및 Supabase 스키마 파일 업로드 확인
- `.env.example`, `.gitignore`, `package-lock.json` 추가
- package-lock lockfileVersion: 3
- 실제 환경변수 파일 `.env.local`은 저장소에 포함하지 않음

## 구현 범위

- Next.js 15 / React 19 / TypeScript 웹앱
- Supabase 이메일 회원가입 및 로그인 UI
- 날짜별 플래너 입력 및 저장/불러오기
- 날짜 옆 자유 입력 영역
- 클릭·드래그 시간표 형광펜과 지우개
- 할 일 추가·삭제·완료 체크
- Today's Focus, Key Point, Memo
- 화이트·핑크·블루·블랙·커스텀 HEX 테마
- 표지 제목·부제·스티커·이미지 편집
- 모바일 반응형 레이아웃
- Progress/달성률 영역 제외

## 의존성 버전

- Node.js: 22.x
- Next.js: 15.5.29
- React / React DOM: 19.1.10
- TypeScript: 5.9.3
- ESLint: 9.39.5
- eslint-config-next: 15.5.29

Next.js 15.5.29는 2026년 11월 3일 공개된 15.5 계열 보안 수정 버전이야.

## Supabase 구성

- 프로젝트 이름: `checkpoint`
- 프로젝트 URL: https://uuzktppatmhhoxapwdxk.supabase.co
- 리전: 서울(ap-northeast-2)
- 테이블: `public.planner_entries`, `public.planner_settings`
- Storage: 비공개 `checkpoint-covers` bucket
- 두 테이블의 RLS 및 사용자별 접근 정책 구성
- Storage의 사용자별 폴더 접근 정책 구성

## 자동 빌드 검증

- GitHub Actions 실행: https://github.com/ydv721/CheckPointPlan/actions/runs/43574228707
- npm lockfile 생성 및 커밋: 통과
- `npm ci`: 통과
- `npm run typecheck`: 통과
- `npm run lint`: 통과 (경고 3건, 오류 0건)
- `npm run build`: 통과
- Next.js 프로덕션 빌드에서 정적 페이지 생성 완료

### 남은 코드 경고

- 사용하지 않는 `ChangeEvent` import
- 표지 이미지 렌더링의 `<img>` 사용 경고
- ESLint 설정 파일의 익명 default export 경고
- CSS Autoprefixer의 `start` 정렬값 호환성 경고

위 항목들은 현재 빌드 실패 원인이 아니며, 기능 안정화 후 정리할 수 있어.

## Vercel 배포 상태

- Vercel 팀: Dabin (Hobby)
- `checkpoint-planner` 프로젝트: 아직 생성 확인되지 않음
- Vercel API의 프로젝트 생성 요청은 403 Forbidden으로 거부됨
- Vercel 프로젝트/배포 목록에서 CHECKPOINT 프로젝트를 찾지 못함
- 브라우저의 기존 New Project 가져오기 화면은 36분 이상 Loading 상태로 남아 있음
- 따라서 현재 공개 배포 URL은 없음
- 사용자가 Vercel 웹 UI에서 기존 가져오기 시도를 취소하고 저장소를 다시 Import해야 함
- Import 시 Framework Preset Next.js, Root Directory `./`, Node.js 22.x, Supabase 환경변수 2개를 설정해야 함

## 배포 후 필수 검증

1. 첫 화면이 정상적으로 표시되는지 확인
2. 회원가입, 이메일 인증, 로그인, 로그아웃 확인
3. 날짜별 플래너 저장 후 새로고침 및 재로그인 뒤 복원 확인
4. 사용자 계정이 다른 데이터에 접근할 수 없는지 확인
5. 시간표 색칠·지우기, 테마 변경 확인
6. 표지 스티커 및 이미지 업로드·표시 확인
7. 모바일 화면에서 레이아웃 확인
8. Supabase Auth URL Configuration에 배포 도메인 등록
