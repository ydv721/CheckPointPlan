"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Home, LogOut, MoreHorizontal, Palette, Sparkles, Trash2 } from "lucide-react";

type PlannerView = "planner" | "cover";

type PageMenuProps = {
  email: string;
  view: PlannerView;
  themeStyle: CSSProperties;
  onViewChange: (view: PlannerView) => void;
  onOpenSettings: () => void;
  onOpenNotebookList: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
};

export default function PageMenu({
  email,
  view,
  themeStyle,
  onViewChange,
  onOpenSettings,
  onOpenNotebookList,
  onSignOut,
  onDeleteAccount
}: PageMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const trigger = anchorRef.current?.querySelector<HTMLButtonElement>(".page-menu-trigger");
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(205, Math.max(160, window.innerWidth - 24));
    const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12));
    setPosition({ top: rect.bottom + 8, left, width });
  }, []);

  useEffect(() => {
    if (!open) return;

    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (anchorRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    updatePosition();
    document.addEventListener("pointerdown", closeOnOutside, true);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutside, true);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  const runAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <>
      <div className="page-menu-slot" ref={anchorRef}>
        <div className="page-menu-anchor">
          <button
            type="button"
            className="page-menu-trigger"
            aria-label="다이어리 메뉴"
            aria-haspopup="menu"
            aria-expanded={open}
            title="메뉴"
            onClick={() => {
              if (open) {
                setOpen(false);
                return;
              }
              updatePosition();
              setOpen(true);
            }}
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>
      {open && position && typeof document !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          className="page-menu-popover"
          style={{ ...themeStyle, top: position.top, left: position.left, width: position.width }}
          role="menu"
          aria-label="다이어리 메뉴"
        >
          <div className="page-menu-account">{email}</div>
          <div className="page-menu-divider" role="separator" />
          <button type="button" role="menuitem" onClick={() => runAction(onOpenNotebookList)}>
            <Home size={16} /><span>노트 목록</span>
          </button>
          {view === "cover" ? (
            <button type="button" role="menuitem" onClick={() => runAction(() => onViewChange("planner"))}>
              <BookOpen size={16} /><span>플래너로 돌아가기</span>
            </button>
          ) : (
            <button type="button" role="menuitem" onClick={() => runAction(() => onViewChange("cover"))}>
              <Sparkles size={16} /><span>표지 꾸미기</span>
            </button>
          )}
          <button type="button" role="menuitem" onClick={() => runAction(onOpenSettings)}>
            <Palette size={16} /><span>테마 설정</span>
          </button>
          <div className="page-menu-divider" role="separator" />
          <button type="button" role="menuitem" onClick={() => runAction(onSignOut)}>
            <LogOut size={16} /><span>로그아웃</span>
          </button>
          <button type="button" role="menuitem" className="page-menu-danger" onClick={() => runAction(onDeleteAccount)}>
            <Trash2 size={16} /><span>회원 탈퇴</span>
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
