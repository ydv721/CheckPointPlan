"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight, BookOpen, Check, ChevronDown, Download, FilePlus2, House, LogOut, Menu,
  Moon, Palette, Sparkles, Trash2, X
} from "lucide-react";
import { themes, type ThemeName } from "@/lib/types";

type SidebarView = "library" | "planner" | "cover" | "markdown";

type SidebarNoteOption = { id: string; title: string };

type AppSidebarProps = {
  email: string;
  currentView: SidebarView;
  themeStyle: CSSProperties;
  darkMode?: boolean;
  onDarkModeChange?: (enabled: boolean) => void;
  theme?: ThemeName;
  customColor?: string;
  onThemeChange?: (theme: ThemeName) => void;
  onCustomColorChange?: (color: string) => void;
  noteOptions?: SidebarNoteOption[];
  activeNoteId?: string | null;
  noteSaveLabel?: string;
  noteActionsDisabled?: boolean;
  noteCanExport?: boolean;
  noteCanDelete?: boolean;
  onNoteSelect?: (noteId: string) => void;
  onCreateNote?: () => void;
  onExportNote?: () => void;
  onDeleteNote?: () => void;
  onOpenNotebookList?: () => void;
  onViewChange?: (view: "planner" | "cover") => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
};

export default function AppSidebar({
  email,
  currentView,
  themeStyle,
  darkMode = false,
  onDarkModeChange,
  theme = "blue",
  customColor = "#8b9ec4",
  onThemeChange,
  onCustomColorChange,
  noteOptions = [],
  activeNoteId = null,
  noteSaveLabel = "",
  noteActionsDisabled = false,
  noteCanExport = false,
  noteCanDelete = false,
  onNoteSelect,
  onCreateNote,
  onExportNote,
  onDeleteNote,
  onOpenNotebookList,
  onViewChange,
  onSignOut,
  onDeleteAccount
}: AppSidebarProps) {
  const [open, setOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const panelDarkMode = currentView === "library" && darkMode;
  const panelStyle = panelDarkMode ? {
    ...themeStyle,
    "--bg": "#171A21",
    "--paper": "#252A35",
    "--ink": "#F2F4F8",
    "--accent": "#AFC7F5",
    "--soft": "rgba(175,199,245,.12)",
    "--line": "rgba(255,255,255,.12)"
  } as CSSProperties : themeStyle;
  const safeCustomColor = /^#[0-9a-fA-F]{6}$/.test(customColor) ? customColor : "#8b9ec4";
  const themeOptions: { value: ThemeName; label: string }[] = [
    { value: "white", label: "White" },
    { value: "pink", label: "Pink" },
    { value: "blue", label: "Blue" },
    { value: "black", label: "Black" },
    { value: "custom", label: "Custom" }
  ];

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
        <Menu size={21} />
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
            className={panelDarkMode ? "app-sidebar-panel app-sidebar-panel-dark" : "app-sidebar-panel"}
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

              {currentView === "library" ? (
                <button
                  type="button"
                  className="app-sidebar-theme-toggle"
                  aria-pressed={darkMode}
                  onClick={() => onDarkModeChange?.(!darkMode)}
                >
                  <Moon size={18} />
                  <span>다크 모드</span>
                  <span className="app-sidebar-switch" aria-hidden="true" />
                </button>
              ) : (
                <div className="app-sidebar-theme-group">
                  <button
                    type="button"
                    className="app-sidebar-theme-trigger"
                    aria-expanded={themeMenuOpen}
                    onClick={() => setThemeMenuOpen(value => !value)}
                  >
                    <Palette size={18} />
                    <span>다이어리 테마 바꾸기</span>
                    <ChevronDown size={16} className={themeMenuOpen ? "app-sidebar-chevron is-open" : "app-sidebar-chevron"} />
                  </button>
                  {themeMenuOpen && (
                    <div className="app-sidebar-theme-options" role="group" aria-label="다이어리 테마 선택">
                      {themeOptions.map(option => (
                        <button
                          key={option.value}
                          type="button"
                          className={theme === option.value ? "app-sidebar-theme-option is-selected" : "app-sidebar-theme-option"}
                          aria-pressed={theme === option.value}
                          onClick={() => onThemeChange?.(option.value)}
                        >
                          <span
                            className="app-sidebar-theme-swatch"
                            style={{ background: option.value === "custom" ? safeCustomColor : themes[option.value].cover }}
                          />
                          <span>{option.label}</span>
                          {theme === option.value && <Check size={15} />}
                        </button>
                      ))}
                      {theme === "custom" && (
                        <div className="app-sidebar-custom-theme">
                          <label>
                            컬러 피커
                            <input
                              aria-label="사용자 지정 컬러 피커"
                              type="color"
                              value={safeCustomColor}
                              onChange={event => onCustomColorChange?.(event.target.value)}
                            />
                          </label>
                          <label>
                            HEX 코드
                            <input
                              aria-label="사용자 지정 HEX 코드"
                              type="text"
                              maxLength={7}
                              placeholder="#8B9EC4"
                              value={customColor}
                              onChange={event => onCustomColorChange?.(event.target.value)}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </nav>

            {currentView === "markdown" && (
              <section className="app-sidebar-note-tools" aria-label="Markdown 노트 관리">
                <div className="app-sidebar-note-tools-title">노트 관리</div>
                <label className="app-sidebar-note-label" htmlFor="app-sidebar-note-select">현재 노트</label>
                <select
                  id="app-sidebar-note-select"
                  className="app-sidebar-note-select"
                  aria-label="노트 선택"
                  value={activeNoteId ?? ""}
                  disabled={noteActionsDisabled || noteOptions.length === 0}
                  onChange={event => onNoteSelect?.(event.target.value)}
                >
                  {noteOptions.length === 0 ? <option value="">노트 없음</option> : null}
                  {noteOptions.map(note => <option key={note.id} value={note.id}>{note.title || "제목 없는 노트"}</option>)}
                </select>
                <div className="app-sidebar-note-actions">
                  <button type="button" onClick={() => runAction(onCreateNote)} disabled={noteActionsDisabled}>
                    <FilePlus2 size={16}/><span>새 노트</span>
                  </button>
                  <button type="button" onClick={() => runAction(onExportNote)} disabled={!noteCanExport}>
                    <Download size={16}/><span>Markdown 내보내기</span>
                  </button>
                  <button type="button" onClick={() => runAction(onDeleteNote)} disabled={!noteCanDelete}>
                    <Trash2 size={16}/><span>현재 노트 삭제</span>
                  </button>
                </div>
                {noteSaveLabel ? <div className="app-sidebar-note-save" aria-live="polite">{noteSaveLabel}</div> : null}
              </section>
            )}

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
