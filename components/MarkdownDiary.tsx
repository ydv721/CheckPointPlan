"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Check, Download, FilePlus2, Trash2 } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import PlannerSpread from "@/components/PlannerSpread";
import type { ThemeName } from "@/lib/types";

type MarkdownNote = {
  id: string;
  notebook_id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

type NotePages = {
  left: string;
  right: string;
};

type Props = {
  client: SupabaseClient;
  userId: string;
  email: string;
  notebookId: string;
  notebookTitle: string;
  themeStyle: CSSProperties;
  theme: ThemeName;
  customColor: string;
  onThemeChange: (theme: ThemeName) => void;
  onCustomColorChange: (color: string) => void;
  onBack: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onDeleteAccount: () => void;
};

const PAGE_CONTENT_PREFIX = "\u001eCHECKPOINT_FREE_NOTE_V1\u001e";

function decodeNotePages(content: string): NotePages {
  if (!content.startsWith(PAGE_CONTENT_PREFIX)) {
    return { left: content, right: "" };
  }

  try {
    const parsed = JSON.parse(content.slice(PAGE_CONTENT_PREFIX.length)) as Partial<NotePages>;
    return {
      left: typeof parsed.left === "string" ? parsed.left : "",
      right: typeof parsed.right === "string" ? parsed.right : ""
    };
  } catch {
    return { left: content, right: "" };
  }
}

function encodeNotePages(pages: NotePages) {
  return PAGE_CONTENT_PREFIX + JSON.stringify(pages);
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export default function MarkdownDiary({
  client,
  userId,
  email,
  notebookId,
  notebookTitle,
  themeStyle,
  theme,
  customColor,
  onThemeChange,
  onCustomColorChange,
  onBack,
  onSignOut,
  onDeleteAccount
}: Props) {
  const [notes, setNotes] = useState<MarkdownNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const leftEditorRef = useRef<HTMLTextAreaElement>(null);
  const rightEditorRef = useRef<HTMLTextAreaElement>(null);
  const currentNoteRef = useRef<MarkdownNote | null>(null);
  const savedSnapshotsRef = useRef<Record<string, string>>({});
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));

  const activeNote = useMemo(
    () => notes.find(note => note.id === activeNoteId) ?? null,
    [notes, activeNoteId]
  );

  const pageContents = useMemo(
    () => decodeNotePages(activeNote?.content ?? ""),
    [activeNote?.content]
  );

  useEffect(() => {
    currentNoteRef.current = activeNote;
  }, [activeNote]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    void client
      .from("markdown_notes")
      .select("id,notebook_id,user_id,title,content,created_at,updated_at")
      .eq("notebook_id", notebookId)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .then(({ data, error: loadError }) => {
        if (!active) return;

        if (loadError) {
          setError("노트를 불러오지 못했습니다: " + loadError.message);
          setNotes([]);
          setActiveNoteId(null);
        } else {
          const rows = (data ?? []) as MarkdownNote[];
          savedSnapshotsRef.current = Object.fromEntries(
            rows.map(note => [note.id, JSON.stringify({ title: note.title, content: note.content })])
          );
          setNotes(rows);
          setActiveNoteId(rows[0]?.id ?? null);
        }

        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [client, notebookId, userId]);

  const saveNote = useCallback((note: MarkdownNote): Promise<boolean> => {
    const snapshot = JSON.stringify({ title: note.title, content: note.content });
    if (savedSnapshotsRef.current[note.id] === snapshot) return Promise.resolve(true);

    const run = async () => {
      setSaveState("saving");
      const updatedAt = new Date().toISOString();

      try {
        const { error: saveError } = await client
          .from("markdown_notes")
          .update({
            title: note.title,
            content: note.content,
            updated_at: updatedAt
          })
          .eq("id", note.id)
          .eq("notebook_id", notebookId)
          .eq("user_id", userId);

        if (saveError) throw saveError;

        savedSnapshotsRef.current[note.id] = snapshot;
        setNotes(current =>
          current
            .map(item => item.id === note.id ? { ...item, updated_at: updatedAt } : item)
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        );

        const latest = currentNoteRef.current;
        const latestSnapshot = latest
          ? JSON.stringify({ title: latest.title, content: latest.content })
          : "";

        setSaveState(latest?.id === note.id && latestSnapshot === snapshot ? "saved" : "dirty");
        setError("");
        return true;
      } catch (saveError) {
        setSaveState("error");
        const message = saveError instanceof Error ? saveError.message : "네트워크 연결을 확인해 주세요.";
        setError("노트 저장에 실패했습니다: " + message);
        return false;
      }
    };

    const queued = saveQueueRef.current.then(run, run);
    saveQueueRef.current = queued;
    return queued;
  }, [client, notebookId, userId]);

  const saveCurrentNote = useCallback(async () => {
    const current = currentNoteRef.current;
    if (!current) return true;
    return await saveNote(current);
  }, [saveNote]);

  useEffect(() => {
    if (!activeNote || loading) return;

    const snapshot = JSON.stringify({ title: activeNote.title, content: activeNote.content });
    if (savedSnapshotsRef.current[activeNote.id] === snapshot) {
      setSaveState("saved");
      return;
    }

    setSaveState("dirty");
    const timer = window.setTimeout(() => {
      void saveNote(activeNote);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [activeNote, loading, saveNote]);

  async function createNote() {
    if (creating) return;
    if (!(await saveCurrentNote())) return;

    setCreating(true);
    setError("");

    const { data, error: createError } = await client
      .from("markdown_notes")
      .insert({
        notebook_id: notebookId,
        user_id: userId,
        title: "새 노트",
        content: encodeNotePages({ left: "", right: "" })
      })
      .select("id,notebook_id,user_id,title,content,created_at,updated_at")
      .single();

    if (createError || !data) {
      setError("새 노트를 만들지 못했습니다: " + (createError?.message ?? "알 수 없는 오류"));
      setCreating(false);
      return;
    }

    const note = data as MarkdownNote;
    savedSnapshotsRef.current[note.id] = JSON.stringify({ title: note.title, content: note.content });
    setNotes(current => [note, ...current]);
    setActiveNoteId(note.id);
    setSaveState("saved");
    setCreating(false);
    requestAnimationFrame(() => leftEditorRef.current?.focus());
  }

  async function selectNote(noteId: string) {
    if (noteId === activeNoteId) return;
    if (!(await saveCurrentNote())) return;
    setActiveNoteId(noteId);
    setSaveState("saved");
  }

  async function deleteActiveNote() {
    if (!activeNote) return;
    if (!window.confirm("이 노트를 삭제하시겠습니까? 삭제한 노트는 복구할 수 없습니다.")) return;

    const { error: deleteError } = await client
      .from("markdown_notes")
      .delete()
      .eq("id", activeNote.id)
      .eq("notebook_id", notebookId)
      .eq("user_id", userId);

    if (deleteError) {
      setError("노트를 삭제하지 못했습니다: " + deleteError.message);
      return;
    }

    const remaining = notes.filter(note => note.id !== activeNote.id);
    delete savedSnapshotsRef.current[activeNote.id];
    setNotes(remaining);
    setActiveNoteId(remaining[0]?.id ?? null);
    setSaveState("saved");
  }

  async function leaveDiary(action: () => Promise<void>) {
    if (!(await saveCurrentNote())) return;
    await action();
  }

  function updateActiveNote(patch: Partial<Pick<MarkdownNote, "title" | "content">>) {
    if (!activeNoteId) return;
    setNotes(current => current.map(note =>
      note.id === activeNoteId ? { ...note, ...patch } : note
    ));
  }

  function updatePage(side: "left" | "right", value: string) {
    if (!activeNote) return;
    const nextPages = { ...pageContents, [side]: value };
    updateActiveNote({ content: encodeNotePages(nextPages) });
  }

  function exportMarkdown() {
    if (!activeNote) return;

    const title = activeNote.title.trim() || "제목 없는 글";
    const pages = decodeNotePages(activeNote.content);
    const markdown = [
      "# " + title,
      "",
      pages.left,
      "",
      "---",
      "",
      pages.right
    ].join("\n");

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const filename = title.replace(/[\\/:*?"<>|]+/g, "-").trim() || "markdown-note";
    anchor.href = url;
    anchor.download = filename + ".md";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const saveLabel = loading
    ? "불러오는 중"
    : saveState === "saving"
      ? "저장 중"
      : saveState === "dirty"
        ? "저장 대기 중"
        : saveState === "error"
          ? "저장 실패"
          : "저장 완료";

  return (
    <div className="app-shell planner-view" style={themeStyle}>
      <AppSidebar
        email={email}
        currentView="markdown"
        themeStyle={themeStyle}
        theme={theme}
        customColor={customColor}
        onThemeChange={onThemeChange}
        onCustomColorChange={onCustomColorChange}
        onOpenNotebookList={() => { void leaveDiary(onBack); }}
        onSignOut={() => { void leaveDiary(onSignOut); }}
        onDeleteAccount={onDeleteAccount}
      />

      <header className="site-header">
        <div className="header-inner">
          <button type="button" className="brand" onClick={() => { void leaveDiary(onBack); }}>
            <span className="brand-lockup">
              <span className="brand-icon"><Check size={18} strokeWidth={3}/></span>
              <span>CHECKPOINT</span>
            </span>
            <small>YOUR PACE, YOUR CHECKPOINT</small>
          </button>
          <div className="header-actions"/>
        </div>
      </header>

      <main className="main-area markdown-diary-main">
        {error ? <div className="message-banner markdown-diary-error" role="alert"><span>{error}</span></div> : null}

        <div className="workspace-shell">
          <div className="workspace-canvas markdown-diary-canvas">
            <div className="markdown-diary-toolbar">
              <div className="markdown-diary-heading">
                <span className="eyebrow">FREE DIARY</span>
                <h1>{notebookTitle}</h1>
                <p>양쪽 페이지에 Markdown으로 자유롭게 기록해 보세요.</p>
              </div>

              <div className="markdown-diary-controls">
                <div className="save-indicator" aria-live="polite">
                  <span className={"indicator-dot markdown-save-dot markdown-save-" + saveState}/>
                  {saveLabel}
                </div>

                <select
                  className="markdown-note-select"
                  aria-label="노트 선택"
                  value={activeNoteId ?? ""}
                  disabled={loading || notes.length === 0}
                  onChange={event => { void selectNote(event.target.value); }}
                >
                  {notes.length === 0 ? <option value="">노트 없음</option> : null}
                  {notes.map(note => (
                    <option key={note.id} value={note.id}>
                      {(note.title.trim() || "제목 없는 글") + " · " + formatTime(note.updated_at)}
                    </option>
                  ))}
                </select>

                <button type="button" className="outline-btn markdown-action-button" onClick={() => { void createNote(); }} disabled={creating || loading}>
                  <FilePlus2 size={15}/><span>새 노트</span>
                </button>
                <button type="button" className="outline-btn markdown-action-icon" onClick={exportMarkdown} disabled={!activeNote} title="Markdown 파일 내보내기" aria-label="Markdown 파일 내보내기">
                  <Download size={16}/>
                </button>
                <button type="button" className="outline-btn markdown-action-icon" onClick={() => { void deleteActiveNote(); }} disabled={!activeNote} title="현재 노트 삭제" aria-label="현재 노트 삭제">
                  <Trash2 size={16}/>
                </button>
              </div>
            </div>

            <PlannerSpread className="book-frame day-book-frame markdown-diary-spread">
              <div className="book-spine" aria-hidden="true">
                {Array.from({ length: 13 }, (_, index) => <span key={index}/>)}
              </div>

              <section className="paper-page left-page markdown-note-page" aria-label="왼쪽 자유 노트">
                <div className="free-note-sheet">
                  <h2 className="free-note-heading">FREE NOTE</h2>
                  <div className="free-note-board">
                    <textarea
                      ref={leftEditorRef}
                      className="free-note-textarea"
                      aria-label="왼쪽 페이지 자유 노트"
                      value={pageContents.left}
                      disabled={!activeNote || loading}
                      onChange={event => updatePage("left", event.target.value)}
                      spellCheck
                    />
                  </div>
                </div>
              </section>

              <section className="paper-page right-page markdown-note-page" aria-label="오른쪽 자유 노트">
                <div className="free-note-sheet">
                  <h2 className="free-note-heading">FREE NOTE</h2>
                  <div className="free-note-board">
                    <textarea
                      ref={rightEditorRef}
                      className="free-note-textarea"
                      aria-label="오른쪽 페이지 자유 노트"
                      value={pageContents.right}
                      disabled={!activeNote || loading}
                      onChange={event => updatePage("right", event.target.value)}
                      spellCheck
                    />
                  </div>
                </div>
              </section>
            </PlannerSpread>
          </div>
        </div>
      </main>
    </div>
  );
}
