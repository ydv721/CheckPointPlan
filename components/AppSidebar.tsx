"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight, BookOpen, Check, ChevronDown, Ellipsis, Folder, FolderPlus, House, LogOut, Menu,
  Moon, Palette, Pencil, Sparkles, Trash2, X
} from "lucide-react";
import { themes, type ThemeName } from "@/lib/types";

type SidebarView = "library" | "planner" | "cover" | "markdown" | "markdown-cover";
type SidebarFolder = { id: string; name: string };

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
  onOpenNotebookList?: () => void;
  onViewChange?: (view: "planner" | "cover") => void;
  folders?: SidebarFolder[];
  folderCounts?: Record<string, number>;
  unfiledNotebookCount?: number;
  totalNotebookCount?: number;
  selectedFolderKey?: string;
  onFolderSelect?: (folderKey: string) => void;
  onCreateFolderRequest?: () => void;
  onRenameFolderRequest?: (folder: SidebarFolder) => void;
  onDeleteFolderRequest?: (folder: SidebarFolder) => void;
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
  onOpenNotebookList,
  onViewChange,
  folders = [],
  folderCounts = {},
  unfiledNotebookCount = 0,
  totalNotebookCount = 0,
  selectedFolderKey = "all",
  onFolderSelect,
  onCreateFolderRequest,
  onRenameFolderRequest,
  onDeleteFolderRequest,
  onSignOut,
  onDeleteAccount
}: AppSidebarProps) {
  const [open, setOpen] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [folderActionMenuId, setFolderActionMenuId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const clearHoverClose = () => {
    if (hoverCloseTimerRef.current !== null) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  const closePanel = () => {
    clearHoverClose();
    setOpen(false);
    setHoverOpen(false);
    setFolderActionMenuId(null);
  };

  const openFromHover = () => {
    if (typeof window === "undefined" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (open && !hoverOpen) return;
    clearHoverClose();
    setHoverOpen(true);
    setOpen(true);
  };

  const scheduleHoverClose = () => {
    if (!hoverOpen) return;
    clearHoverClose();
    hoverCloseTimerRef.current = setTimeout(() => {
      setOpen(false);
      setHoverOpen(false);
      hoverCloseTimerRef.current = null;
    }, 180);
  };

  const handleTriggerClick = () => {
    clearHoverClose();
    if (open && !hoverOpen) {
      closePanel();
      return;
    }
    // Clicking the menu keeps it open until the user closes it.
    setHoverOpen(false);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (hoverCloseTimerRef.current !== null) {
          clearTimeout(hoverCloseTimerRef.current);
          hoverCloseTimerRef.current = null;
        }
        setOpen(false);
        setHoverOpen(false);
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    if (!hoverOpen) {
      document.body.style.overflow = "hidden";
      closeRef.current?.focus();
    }

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      if (!hoverOpen) {
        document.body.style.overflow = previousOverflow;
        triggerRef.current?.focus();
      }
    };
  }, [open, hoverOpen]);

  useEffect(() => () => {
    if (hoverCloseTimerRef.current !== null) clearTimeout(hoverCloseTimerRef.current);
  }, []);

  const runAction = (action?: () => void) => {
    closePanel();
    action?.();
  };

  return (
    <>
      <div
        className="app-sidebar-hover-edge"
        aria-hidden="true"
        onMouseEnter={openFromHover}
        onMouseLeave={scheduleHoverClose}
      />
      <button
        ref={triggerRef}
        type="button"
        className="app-sidebar-trigger"
        aria-label="메뉴 열기"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="checkpoint-app-sidebar"
        title="메뉴"
        onMouseEnter={openFromHover}
        onMouseLeave={scheduleHoverClose}
        onClick={handleTriggerClick}
      >
        <Menu size={21} />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className={hoverOpen ? "app-sidebar-backdrop is-hover-open" : "app-sidebar-backdrop"}
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) closePanel();
          }}
        >
          <aside
            id="checkpoint-app-sidebar"
            className={panelDarkMode ? "app-sidebar-panel app-sidebar-panel-dark app-sidebar-panel-library" : currentView === "library" ? "app-sidebar-panel app-sidebar-panel-library" : "app-sidebar-panel"}
            style={panelStyle}
            role="dialog"
            aria-modal={!hoverOpen}
            aria-label="메뉴"
            onMouseEnter={clearHoverClose}
            onMouseLeave={scheduleHoverClose}
          >
            <header className="app-sidebar-header">
              <span className="app-sidebar-email" title={email}>{email}</span>
              <button
                ref={closeRef}
                type="button"
                className="app-sidebar-close"
                aria-label="메뉴 닫기"
                onClick={closePanel}
              >
                <X size={20} />
              </button>
            </header>

            <nav className="app-sidebar-navigation" aria-label="다이어리 메뉴">
              {currentView === "library" ? (
                <button
                  type="button"
                  className={selectedFolderKey === "all" ? "app-sidebar-current is-selected" : "app-sidebar-current"}
                  aria-current={selectedFolderKey === "all" ? "page" : undefined}
                  onClick={() => runAction(() => onFolderSelect?.("all"))}
                >
                  <House size={18} />
                  <span>다이어리 목록</span>
                  <small>{totalNotebookCount}</small>
                </button>
              ) : (
                <button type="button" onClick={() => runAction(onOpenNotebookList)}>
                  <House size={18} />
                  <span>다이어리 목록</span>
                  <ArrowRight size={16} className="app-sidebar-arrow" />
                </button>
              )}

              {(currentView === "planner" || currentView === "markdown") && (
                <button type="button" onClick={() => runAction(() => onViewChange?.("cover"))}>
                  <Sparkles size={18} />
                  <span>표지 꾸미기</span>
                  <ArrowRight size={16} className="app-sidebar-arrow" />
                </button>
              )}

              {(currentView === "cover" || currentView === "markdown-cover") && (
                <button type="button" onClick={() => runAction(() => onViewChange?.("planner"))}>
                  <BookOpen size={18} />
                  <span>{currentView === "markdown-cover" ? "다이어리로 돌아가기" : "플래너로 돌아가기"}</span>
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

            {currentView === "library" && (
              <section className="app-sidebar-folders" aria-label="다이어리 폴더">
                <div className="app-sidebar-folders-heading">
                  <div>
                    <Folder size={17} />
                    <strong>폴더</strong>
                    <small>{folders.length}</small>
                  </div>
                  <button
                    type="button"
                    className="app-sidebar-folder-add"
                    aria-label="새 폴더 만들기"
                    title="새 폴더 만들기"
                    onClick={() => runAction(onCreateFolderRequest)}
                  >
                    <FolderPlus size={17} />
                  </button>
                </div>

                <div className="app-sidebar-folder-list">
                  {folders.map((folder, index) => {
                    const folderColors = ["#8EA5D8", "#D36A48", "#D36A48", "#3CB5BD", "#A38BCB", "#C39B5C"];
                    const selected = selectedFolderKey === folder.id;
                    return (
                      <div key={folder.id} className={selected ? "app-sidebar-folder-row is-selected" : "app-sidebar-folder-row"}>
                        <button
                          type="button"
                          className="app-sidebar-folder-select"
                          aria-current={selected ? "page" : undefined}
                          onClick={() => runAction(() => onFolderSelect?.(folder.id))}
                        >
                          <Folder size={18} style={{ color: folderColors[index % folderColors.length] }} />
                          <span>{folder.name}</span>
                          <small>{folderCounts[folder.id] ?? 0}</small>
                        </button>
                        <button
                          type="button"
                          className="app-sidebar-folder-more"
                          aria-label={folder.name + " 폴더 메뉴"}
                          aria-expanded={folderActionMenuId === folder.id}
                          title="폴더 메뉴"
                          onClick={() => setFolderActionMenuId(current => current === folder.id ? null : folder.id)}
                        >
                          <Ellipsis size={17} />
                        </button>
                        {folderActionMenuId === folder.id && (
                          <div className="app-sidebar-folder-menu" role="menu">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => runAction(() => onRenameFolderRequest?.(folder))}
                            >
                              <Pencil size={14} /> 이름 변경
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => runAction(() => onDeleteFolderRequest?.(folder))}
                            >
                              <Trash2 size={14} /> 폴더 삭제
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {folders.length === 0 && (
                    <p className="app-sidebar-folders-empty">아직 만든 폴더가 없습니다.</p>
                  )}
                  <button
                    type="button"
                    className={selectedFolderKey === "unfiled" ? "app-sidebar-folder-select app-sidebar-unfiled is-selected" : "app-sidebar-folder-select app-sidebar-unfiled"}
                    aria-current={selectedFolderKey === "unfiled" ? "page" : undefined}
                    onClick={() => runAction(() => onFolderSelect?.("unfiled"))}
                  >
                    <Folder size={18} />
                    <span>분류 없음</span>
                    <small>{unfiledNotebookCount}</small>
                  </button>
                </div>
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
