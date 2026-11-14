# CHECKPOINT — 배포 및 검증 상태

## GitHub

- 저장소: https://github.com/ydv721/CheckPointPlan
- 기본 브랜치: `main`
- 저장소 공개 상태: Public
- Next.js 앱 소스 및 Supabase 스키마 파일 업로드 확인
- `.env.example` 및 `.gitignore` 추가
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

## Supabase 구성

- 프로젝트 이름: `checkpoint`
- 프로젝트 URL: https://uuzktppatmhhoxapwdxk.supabase.co
- 리전: 서울(ap-northeast-2)
- 테이블: `public.planner_entries`, `public.planner_settings`
- Storage: 비공개 `checkpoint-covers` bucket
- 두 테이블의 RLS 및 사용자별 접근 정책 구성
- Storage의 사용자별 폴더 접근 정책 구성

## 현재 확인된 검증 상태

- GitHub 저장소의 소스 파일 및 디렉터리 확인
- TypeScript/TSX 문법 파서 검사 통과
- CSS/PostCSS 파서 검사 통과
- 실제 `npm install`, `npm run typecheck`, `npm run lint`, `npm run build`는 아직 이 환경에서 완료되지 않음
- 따라서 실제 브라우저에서 로그인, 저장/복원, 표지 이미지 업로드까지 동작한다고 확정할 수 없음

## Vercel 배포 상태

- Vercel 프로젝트: 아직 생성 및 배포 확인 전
- 이전 프로젝트 생성 시도에서 연결 팀 권한 오류(403)가 발생했음
- GitHub 저장소를 Vercel에서 Import하거나, 팀 권한 문제를 해결한 후 프로젝트를 생성해야 함
- Vercel 환경변수로 `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 설정해야 함

## 배포 후 필수 검증

1. 첫 화면이 정상적으로 표시되는지 확인
2. 회원가입, 이메일 인증, 로그인, 로그아웃 확인
3. 날짜별 플래너 저장 후 새로고침 및 재로그인 뒤 복원 확인
4. 사용자 계정이 다른 데이터에 접근할 수 없는지 확인
5. 시간표 색칠·지우기, 테마 변경 확인
6. 표지 스티커 및 이미지 업로드·표시 확인
7. 모바일 화면에서 레이아웃 확인
8. Supabase Auth URL Configuration에 배포 도메인 등록
