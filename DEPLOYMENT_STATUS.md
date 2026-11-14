# CHECKPOINT — 배포 상태

## 구현 완료

- Next.js/TypeScript 웹앱 소스
- 로그인/회원가입(Supabase Auth)
- 날짜별 플래너, 자유 입력 칸, 시간표 형광펜, 넓은 할 일 목록과 메모
- 표지 편집(텍스트·스티커·이미지 업로드·이동·크기 조절)
- 테마 4개 + 사용자 지정 HEX 컬러, 속지/표지 연동
- 모바일 반응형
- Progress(달성률) 영역 제거
- 저장/로드와 사용자별 데이터 접근 제어

## 인프라

- Supabase 프로젝트: `checkpoint` (서울 리전, ACTIVE_HEALTHY)
- 프로젝트 주소: `https://uuzktppatmhhoxapwdxk.supabase.co`
- `public.planner_entries` / `public.planner_settings` / private `checkpoint-covers` 저장소 생성
- 두 테이블 RLS 활성화, 사용자 본인 소유 데이터에 한정한 읽기/쓰기 정책 8개 확인
- Supabase 보안 어드바이저 경고 0건 확인

## 현재 검증 범위

- TypeScript/TSX 파서: 문법 검사 통과
- CSS/PostCSS 파서: 문법 검사 통과
- TypeScript JS 트랜스파일: 문법 진단 0건
- `npm install` 및 실제 `next build`는 실행 환경에서 npm registry의 DNS 해석이 불가능하여 미완료
- 따라서 로그인/저장/이미지 업로드의 브라우저 동작은 아직 실서비스로 검증되지 않음

## 외부 연결 미완료

- 연결된 GitHub 앱에서 `ydv721/checkpoint-planner` 조회 시 404. 비공개 저장소가 아직 생성되지 않았거나 연결된 앱에 새 저장소 읽기 권한이 없을 수 있음.
- Vercel `Dabin` 팀 프로젝트 생성 API는 403 Forbidden을 반환함. 서비스 주소 배포 전.
- GitHub 저장소가 생성되어 있고 앱 접근이 허용되면 이 소스 파일을 올릴 수 있음.
- Vercel 권한이 복구되면 소스 연결 및 환경변수 설정 후 배포 가능.

## 다음 배포 단계

1. `https://github.com/ydv721/checkpoint-planner` 존재 여부 확인(계정 로그인 상태).
2. GitHub 새 저장소가 없다면 생성하고, 있다면 ChatGPT GitHub 연결 앱에 해당 저장소 접근을 허용.
3. 전체 소스 파일을 GitHub 저장소에 Push.
4. Vercel의 새 프로젝트를 `checkpoint-planner`로 만들고, Supabase URL과 publishable key 환경변수 두 개를 설정.
5. 배포 후 Supabase Auth의 Site URL과 Redirect URLs를 실제 배포 주소로 설정.
6. 회원가입, 이메일 인증, 로그인, 저장/복원, 다른 사용자 접근 차단, 이미지 업로드를 실제 브라우저에서 테스트.
