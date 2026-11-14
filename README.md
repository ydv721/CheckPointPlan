# CHECKPOINT

계획을 못 지킨 날에도 다시 시작하기 쉬운 데일리 스터디 플래너.

**Next.js 15 · React 19 · TypeScript · Supabase Auth/PostgreSQL/Storage · Vercel**

## 구현 기능

- 종이 플래너의 **양쪽 페이지 레이아웃**. 모바일에서는 세로 배치
- 날짜 이동과 날짜별 자동 저장
- 날짜 옆의 자유 항목(D-DAY·날씨·노래·기분·스티커·메모·자유 입력)
- 클릭·드래그 10분 단위 형광펜 시간표, 색상과 지우개
- 넓은 To-do List: 추가·삭제·완료 체크
- Today's Focus, Key Point, Memo
- **화이트·핑크·블루·블랙·커스텀 HEX** 테마 및 표지 색 연동
- 스티커·이미지 업로드·드래그 위치 조절·크기 조절이 가능한 표지
- Supabase 이메일 로그인 및 회원가입
- 사용자별 데이터 저장, RLS, 비공개 사용자별 이미지 저장소
- **Progress/달성률 영역 없음**

## 로컬에서 실행

```bash
npm install
cp .env.example .env.local
# .env.local에 Supabase 프로젝트 URL, publishable key 입력
npm run dev
```

Windows PowerShell에서는 `Copy-Item .env.example .env.local` 사용.

```text
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`service_role` 또는 DB 비밀번호를 클라이언트 환경변수로 설정하지 마세요. Supabase 프로젝트에는 `supabase/schema.sql`의 테이블과 정책이 준비되어 있어야 합니다. 기존 CHECKPOINT Supabase 프로젝트의 `planner_entries` 및 `planner_settings`는 별도 적용됩니다.

Supabase Authentication에서 이메일 인증을 사용 중이라면 가입 후 메일 인증이 필요합니다. 배포 후 `Authentication > URL Configuration`에서 Site URL을 실제 Vercel 주소로 설정하고 Redirect URLs에 배포 주소를 허용하세요.

## Vercel 배포

1. GitHub의 `ydv721/checkpoint-planner` 저장소에 이 프로젝트의 파일을 업로드합니다.
2. Vercel에서 GitHub 저장소를 연결하여 새 프로젝트를 만듭니다. Framework Preset은 Next.js입니다.
3. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 Vercel 환경변수로 설정합니다.
4. Deploy 후 정상 접속과 로그인, 날짜별 자동 저장을 확인합니다.
5. Supabase Auth의 Site URL 및 Redirect URLs를 배포된 URL로 업데이트합니다.

## 보안과 한계

- 인증 사용자는 본인 `user_id` 데이터만 읽거나 수정할 수 있어야 하며, RLS 정책으로 제한합니다.
- 표지 이미지는 **private** Storage bucket에 저장하고 사용자 ID 폴더에 접근 제한합니다. 화면에는 만료되는 Signed URL을 사용합니다.
- 비밀번호는 앱 코드나 DB의 일반 테이블에 저장하지 않고 Supabase Auth가 관리합니다.
- 이미지 업로드는 JPEG/PNG/WEBP/GIF 및 5MB 이하로 제한합니다.
- 인프라 키 설정, 최종 배포, 이메일 인증과 복구 흐름은 서비스 환경에서 검증해야 합니다.

## 작업 파일

- `components/Planner.tsx` – 인증·플래너·표지·테마 UI
- `app/globals.css` – 화면 스타일과 모바일 반응형
- `lib/supabase.ts` – Supabase 클라이언트
- `lib/types.ts` – 데이터 타입 및 기본 테마
- `supabase/schema.sql` – 초기 테이블/정책 스키마 참고 파일
