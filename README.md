# CHECKPOINT

내 속도로 기록하는 데일리 플래너. PC에서는 펼친 책 형태의 좌우 2페이지 레이아웃으로 표시돼.

## 주요 기능

- 날짜별 데일리 플래너
- 왼쪽 페이지: 날짜, 오늘의 목표, Key Point, 시간표
- 오른쪽 페이지: To-do List, 메모
- 할 일 추가·완료 체크
- 시간표 칸별 색상 표시
- 화이트·핑크·블루·블랙·사용자 지정 테마
- 표지 제목·부제 편집, 스티커 및 이미지 배치
- Supabase 이메일 회원가입·로그인
- Supabase를 이용한 사용자별 플래너 데이터 저장
- 모바일 반응형 레이아웃

## 기술 스택

- Next.js 15 / React 19
- TypeScript
- CSS
- Supabase Auth / PostgreSQL / Storage
- lucide-react

## 로컬 실행

Node.js 20 이상을 권장해.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Windows PowerShell에서는 아래처럼 환경 파일을 복사할 수 있어.

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 열어.

## 환경 변수

`.env.local`에 Supabase 프로젝트 값을 입력해.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

브라우저에 노출되는 publishable key만 사용해. `service_role` 또는 secret key를 `NEXT_PUBLIC_*` 변수에 넣거나 Git에 커밋하면 안 돼.

## Supabase 설정

새 Supabase 프로젝트를 사용하는 경우 SQL Editor에서 `supabase/schema.sql`을 한 번 실행해.

이 스키마는 다음 리소스를 생성해.

- `public.planner_entries`: 날짜별 플래너 데이터
- `public.planner_settings`: 테마 및 표지 설정
- `checkpoint-covers`: 비공개 표지 이미지 버킷
- 사용자별 데이터 접근을 제한하는 RLS 정책과 Storage 정책

이미 CHECKPOINT용 Supabase 프로젝트에 해당 테이블과 정책을 적용했다면 스키마를 다시 실행하지 마. 기존 데이터베이스에 중복 정책을 만들 수 있어.

Supabase Authentication의 URL Configuration에서 로컬 주소와 배포 주소를 Site URL / Redirect URLs에 등록해.

## 검사 및 빌드

```bash
npm run typecheck
npm run lint
npm run build
```

## Vercel 배포

1. Vercel에서 이 GitHub 저장소를 Import해.
2. Root Directory는 저장소 최상위(`./`)로 설정해.
3. Framework Preset은 Next.js로 선택해.
4. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 환경 변수를 등록해.
5. Deploy를 실행해.
6. 배포 도메인을 Supabase Authentication의 Redirect URLs에도 추가해.

## 프로젝트 구조

```text
app/                  Next.js 페이지 및 전역 스타일
components/Planner.tsx 플래너 UI와 상호작용
lib/                  Supabase 클라이언트 및 타입
supabase/schema.sql   신규 Supabase 프로젝트용 DB/RLS/Storage 스키마
```

## 데이터 및 보안

플래너 데이터는 로그인한 사용자 계정에 연결돼. 데이터베이스와 Storage 접근은 Supabase RLS 정책으로 사용자별 제한을 적용해. 표지 이미지는 비공개 Storage 버킷에 저장하고 서명 URL로 표시해.

현재 저장소에는 실제 배포 환경의 비밀 키나 `.env.local` 파일을 포함하지 않아.
