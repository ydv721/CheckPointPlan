import type { ReactNode } from "react";
import { BookOpen, ChevronRight } from "lucide-react";

type SiteHeaderProps = {
  diaryTitle?: string;
  onBrandClick?: () => void;
  menu?: ReactNode;
};

export default function SiteHeader({
  diaryTitle,
  onBrandClick,
  menu
}: SiteHeaderProps) {
  const brandContent = (
    <>
      <span className="checkpoint-header-mark" aria-hidden="true">
        <BookOpen size={19} strokeWidth={2.1} />
      </span>
      <span className="checkpoint-header-brand-copy">
        <strong>CHECKPOINT</strong>
        <small>YOUR PACE, YOUR CHECKPOINT</small>
      </span>
    </>
  );

  return (
    <header className="site-header checkpoint-site-header">
      <div className="checkpoint-header-inner">
        {onBrandClick ? (
          <button
            type="button"
            className="checkpoint-header-brand"
            onClick={onBrandClick}
            aria-label="내 다이어리 목록으로 이동"
          >
            {brandContent}
          </button>
        ) : (
          <div className="checkpoint-header-brand">
            {brandContent}
          </div>
        )}

        {diaryTitle ? (
          <>
            <span className="checkpoint-header-divider" aria-hidden="true" />
            <nav className="checkpoint-header-breadcrumb" aria-label="현재 위치">
              <span className="checkpoint-header-breadcrumb-home">내 다이어리</span>
              <ChevronRight size={15} aria-hidden="true" />
              <strong aria-current="page">{diaryTitle}</strong>
            </nav>
          </>
        ) : null}

        {menu ? <div className="checkpoint-header-actions">{menu}</div> : null}
      </div>
    </header>
  );
}
