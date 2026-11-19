"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight, BookOpen, House, LogOut, Moon, MoreHorizontal,
  Sparkles, Trash2, X
} from "lucide-react";

type SidebarView = "library" | "planner" | "cover";

type AppSidebarProps = {
  email: string;
  currentView: SidebarView;
  themeStyle: CSSProperties;
  onOpenNotebookList?: () => void;
  onViewChange?: (view: "planner" | "cover") => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
};

export default function AppSidebar({
  email,
  currentView,
  themeStyle,
  onOpenNotebookList,
  onViewChange,
  onSignOut,
  onDeleteAccount
}: AppSidebarProps) {
  const [open, setOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [darkModeLoaded, setDarkModeLoaded] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      setDarkMode(window.localStorage.getItem("checkpoint-sidebar-dark-mode") === "true");
    } catch {
      setDarkMode(false);
    }
    setDarkModeLoaded(true);
  }, []);

  useEffect(() => {
    if (!darkModeLoaded) return;
    try {
      window.localStorage.setItem("checkpoint-sidebar-dark-mode", String(darkMode));
    } catch {
      // Keep the in-memory setting if browser storage is unavailable.
    }
  }, [darkMode, darkModeLoaded]);

  const panelStyle = darkMode ? {
    ...themeStyle,
    "--bg": "#171A21",
    "--paper": "#252A35",
    "--ink": "#F2F4F8",
    "--accent": "#AFC7F5",
    "--soft": "rgba(175,199,245,.12)",
    "--line": "rgba(255,255,255,.12)"
  } as CSSProperties : themeStyle;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
      triggerRef.current?.focus();
    };
  }, [open]);

  const runAction = (action?: () => void) => {
    setOpen(false);
    action?.();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="app-sidebar-trigger"
        aria-label="메뉴 열기"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="checkpoint-app-sidebar"
        title="메뉴"
        onClick={() => setOpen(true)}
      >
        <MoreHorizontal size={21} />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="app-sidebar-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <aside
            id="checkpoint-app-sidebar"
            className={darkMode ? "app-sidebar-panel app-sidebar-panel-dark" : "app-sidebar-panel"}
            style={panelStyle}
            role="dialog"
            aria-modal="true"
            aria-label="메뉴"
          >
            <header className="app-sidebar-header">
              <span className="app-sidebar-email" title={email}>{email}</span>
              <button
                ref={closeRef}
                type="button"
                className="app-sidebar-close"
                aria-label="메뉴 닫기"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
            </header>

            <nav className="app-sidebar-navigation" aria-label="다이어리 메뉴">
              {currentView === "library" ? (
                <div className="app-sidebar-current" aria-current="page">
                  <House size={18} />
                  <span>다이어리 목록</span>
                </div>
              ) : (
                <button type="button" onClick={() => runAction(onOpenNotebookList)}>
                  <House size={18} />
                  <span>다이어리 목록</span>
                  <ArrowRight size={16} className="app-sidebar-arrow" />
                </button>
              )}

              {currentView === "planner" && (
                <button type="button" onClick={() => runAction(() => onViewChange?.("cover"))}>
                  <Sparkles size={18} />
                  <span>표지 꾸미기</span>
                  <ArrowRight size={16} className="app-sidebar-arrow" />
                </button>
              )}

              {currentView === "cover" && (
                <button type="button" onClick={() => runAction(() => onViewChange?.("planner"))}>
                  <BookOpen size={18} />
                  <span>플래너로 돌아가기</span>
                  <ArrowRight size={16} className="app-sidebar-arrow" />
                </button>
              )}

              <button
                type="button"
                className="app-sidebar-theme-toggle"
                aria-pressed={darkMode}
                onClick={() => setDarkMode(value => !value)}
              >
                <Moon size={18} />
                <span>다크 모드</span>
                <span className="app-sidebar-switch" aria-hidden="true" />
              </button>
            </nav>

            <div className="app-sidebar-footer">
              <button type="button" onClick={() => runAction(onSignOut)}>
                <LogOut size={18} />
                <span>로그아웃</span>
              </button>
              <button
                type="button"
                className="app-sidebar-delete"
                onClick={() => runAction(onDeleteAccount)}
              >
                <Trash2 size={18} />
                <span>회원 탈퇴</span>
              </button>
            </div>
          </aside>
        </div>,
        document.body
      )}
    </>
  );
}
