# CHECKPOINT

계획을 지키지 못한 날에도 부담 없이 다시 시작할 수 있는 데일리 스터디 플래너.

**Next.js 15 · React 19 · TypeScript · Supabase Auth/PostgreSQL/Storage · Vercel**

## 주요 기능

- 종이 플래너를 본뜬 **좌우 2페이지 레이아웃** (모바일에서는 세로 배치)
- 날짜 이동과 날짜별 플래너 저장
- 날짜와 별도로 입력하는 D-day 칸 및 자유 항목: 날씨, 노래, 기분, 메모 등
- 클릭·드래그로 색칠하는 10분 단위 시간표와 지우개
- 넓은 To-do List: 추가·삭제·완료 체크
- Today's Focus, Key Point, Memo
- 화이트·핑크·블루·블랙·커스텀 HEX 테마
- 테마와 연동되는 표지 편집: 제목, 부제, 스티커, 이미지 배치
- Supabase 이메일 회원가입·로그인
- 사용자별 데이터 저장 및 RLS 접근 제어
- 비공개 Storage 버킷에 사용자별 표지 이미지 저장
- **Progress/달성률 영역은 포함하지 않음**

## 기술 스택

- Next.js 15 / React 19
- TypeScript
- Supabase Auth, PostgreSQL, Storage
- lucide-react
- Vercel

## 로컬 실행

Node.js 22.x를 사용해. `package.json`의 `engines`에서 Node.js 22.x 범위로 고정했어.

### 1. 저장소 복제 및 패키지 설치

```bash
git clone https://github.com/ydv721/CheckPointPlan.git
cd CheckPointPlan
npm ci
```

`package-lock.json`이 저장소에 포함되어 있어. 처음 설치하거나 잠금 파일을 갱신할 때는 `npm install`을 사용하고, 재현 가능한 설치에는 `npm ci`를 사용해.

### 2. 환경변수 파일 생성

macOS/Linux:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

그다음 `.env.local`을 열어 Supabase publishable key를 입력해.

```env
NEXT_PUBLIC_SUPABASE_URL=https://uuzktppatmhhoxapwdxk.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Supabase 대시보드의 Project Settings → API Keys에서 publishable key를 확인할 수 있어. 프로젝트에 따라 legacy `anon` key를 사용한다면 해당 공개용 키를 입력해도 돼.

**주의:** `service_role` 키, secret key, DB 비밀번호는 브라우저에 노출되는 `NEXT_PUBLIC_*` 변수에 넣지 마. 실제 `.env.local` 파일은 Git에 커밋하지 않아.

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어.

Windows에서는 프로젝트 폴더의 `start-windows.ps1`을 실행해도 돼. 이 스크립트는 `.env.local`이 없으면 `.env.example`을 복사한 다음 패키지를 설치하고 개발 서버를 실행해.

## Supabase 설정

이 저장소에는 새 Supabase 프로젝트용 참고 스키마가 `supabase/schema.sql`에 있어.

현재 CHECKPOINT용 Supabase 프로젝트에는 다음 리소스가 별도로 구성되어 있어.

- `public.planner_entries`
- `public.planner_settings`
- 비공개 Storage bucket `checkpoint-covers`
- 사용자별 데이터 접근을 제한하는 RLS 정책

이미 이 프로젝트를 사용하는 경우 기존 DB에 스키마를 중복 적용하지 마. 새 Supabase 프로젝트를 사용하는 경우에는 SQL 파일을 검토한 뒤 SQL Editor에서 적용하고 RLS 정책 및 Storage 접근을 확인해.

Supabase Authentication의 URL Configuration에 로컬 주소와 실제 배포 주소를 등록해야 해. 이메일 확인 기능이 켜져 있으면 가입 후 인증 메일을 확인해야 로그인할 수 있어.

## Vercel 배포

1. Vercel에서 GitHub 저장소 `ydv721/CheckPointPlan`을 Import해.
2. Framework Preset은 Next.js, Root Directory는 저장소 최상위(`./`)로 설정해.
3. Vercel 프로젝트의 Environment Variables에 아래 두 항목을 등록해.
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Deploy를 실행해.
5. 배포 URL을 Supabase Authentication → URL Configuration의 Site URL 및 Redirect URLs에 등록해.
6. 회원가입, 이메일 인증, 로그인, 날짜별 저장·복원, 표지 이미지 업로드를 확인해.

## 검사 명령

GitHub Actions에서 `npm ci`, TypeScript 검사, ESLint, Next.js 프로덕션 빌드까지 통과했어. [최근 빌드 검증 결과](https://github.com/ydv721/CheckPointPlan/actions/runs/43574228707)를 확인할 수 있어.

```bash
npm run typecheck
npm run lint
npm run build
```

## 프로젝트 구조

```text
app/
  globals.css       전역 스타일 및 반응형 레이아웃
  layout.tsx        앱 메타데이터와 루트 레이아웃
  page.tsx          플래너 진입 페이지
components/
  Planner.tsx       인증, 플래너, 시간표, 테마, 표지 UI
lib/
  supabase.ts       Supabase 클라이언트
  types.ts          플래너 데이터 및 테마 타입
supabase/
  schema.sql        신규 Supabase 프로젝트용 참고 스키마
.env.example        환경변수 템플릿
start-windows.ps1   Windows 개발 환경 실행 스크립트
```

## 보안 및 검증 범위

- 플래너 데이터는 로그인 사용자 본인 계정에 연결되고 RLS 정책으로 접근을 제한해.
- 표지 이미지는 비공개 Storage bucket에 저장하며 사용자 ID 폴더 기준 정책을 적용해.
- 비밀번호는 앱 데이터 테이블에 저장하지 않고 Supabase Auth가 관리해.
- 이미지 업로드는 JPEG/PNG/WEBP/GIF 및 5MB 이하로 제한해.
- 실제 배포 환경에서 인증, 저장/복원, 사용자 간 데이터 격리, 이미지 업로드를 반드시 테스트해야 해.
