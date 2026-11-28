import type { ReactNode } from "react";
import { BookOpen } from "lucide-react";

type SiteHeaderProps = {
  onBrandClick?: () => void;
  menu?: ReactNode;
};

export default function SiteHeader({
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

        <div className="checkpoint-header-actions">{menu}</div>
      </div>
    </header>
  );
}
