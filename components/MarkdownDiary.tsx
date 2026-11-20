"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Bold, Code2, Heading1, Italic, Link2, List, ListOrdered, Minus, Quote, Share2, Strikethrough, Check } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
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

type MarkdownAction = "bold" | "italic" | "strike" | "heading" | "bullet" | "ordered" | "quote" | "code" | "link" | "divider";

const MARKDOWN_TOOLBAR = [
  { action: "bold", label: "굵게", icon: Bold },
  { action: "italic", label: "기울임", icon: Italic },
  { action: "strike", label: "취소선", icon: Strikethrough },
  { action: "heading", label: "제목", icon: Heading1 },
  { action: "bullet", label: "글머리표", icon: List },
  { action: "ordered", label: "번호 목록", icon: ListOrdered },
  { action: "quote", label: "인용", icon: Quote },
  { action: "code", label: "코드", icon: Code2 },
  { action: "link", label: "링크", icon: Link2 },
  { action: "divider", label: "구분선", icon: Minus }
] as const;

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


export default function MarkdownDiary({
  client,
  userId,
  email,
  notebookId,
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
  const [shareFeedback, setShareFeedback] = useState("");
  const leftEditorRef = useRef<HTMLTextAreaElement>(null);
  const currentNoteRef = useRef<MarkdownNote | null>(null);
  const savedSnapshotsRef = useRef<Record<string, string>>({});
  const initialNotePromiseRef = useRef<{ key: string; promise: PromiseLike<MarkdownNote> } | null>(null);
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

    void (async () => {
      try {
        const { data, error: loadError } = await client
          .from("markdown_notes")
          .select("id,notebook_id,user_id,title,content,created_at,updated_at")
          .eq("notebook_id", notebookId)
          .eq("user_id", userId)
          .order("updated_at", { ascending: false });

        if (!active) return;
        if (loadError) throw loadError;

        let rows = (data ?? []) as MarkdownNote[];
        if (rows.length === 0) {
          const key = userId + ":" + notebookId;
          let initialNotePromise = initialNotePromiseRef.current;

          if (!initialNotePromise || initialNotePromise.key !== key) {
            const promise = client
              .from("markdown_notes")
              .insert({
                notebook_id: notebookId,
                user_id: userId,
                title: "새 노트",
                content: encodeNotePages({ left: "", right: "" })
              })
              .select("id,notebook_id,user_id,title,content,created_at,updated_at")
              .single()
              .then(({ data: created, error: createError }) => {
                if (createError) throw createError;
                if (!created) throw new Error("새 노트를 만들지 못했습니다.");
                return created as MarkdownNote;
              });

            initialNotePromise = { key, promise };
            initialNotePromiseRef.current = initialNotePromise;
          }

          rows = [await initialNotePromise.promise];
        }

        if (!active) return;
        savedSnapshotsRef.current = Object.fromEntries(
          rows.map(note => [note.id, JSON.stringify({ title: note.title, content: note.content })])
        );
        setNotes(rows);
        setActiveNoteId(rows[0]?.id ?? null);
      } catch (loadError) {
        if (!active) return;
        const message = loadError instanceof Error ? loadError.message : "알 수 없는 오류";
        setError("노트를 불러오지 못했습니다: " + message);
        setNotes([]);
        setActiveNoteId(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

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

    if (remaining.length === 0) {
      currentNoteRef.current = null;
      void createNote();
    }
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

  function applyMarkdown(action: MarkdownAction) {
    const editor = leftEditorRef.current;
    if (!editor || !activeNote || loading) return;

    const source = editor.value;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = source.slice(start, end);
    let replaceStart = start;
    let replaceEnd = end;
    let replacement = "";
    let selectionStart = start;
    let selectionEnd = start;

    const wrap = (before: string, after: string, placeholder: string) => {
      const inner = selected || placeholder;
      replacement = before + inner + after;
      selectionStart = start + before.length;
      selectionEnd = selectionStart + inner.length;
    };

    if (action === "bold") {
      wrap("**", "**", "굵은 텍스트");
    } else if (action === "italic") {
      wrap("*", "*", "기울임 텍스트");
    } else if (action === "strike") {
      wrap("~~", "~~", "취소선 텍스트");
    } else if (action === "code") {
      wrap("`", "`", "코드");
    } else if (action === "link") {
      if (selected) {
        replacement = "[" + selected + "](https://주소)";
        selectionStart = start + selected.length + 3;
        selectionEnd = selectionStart + "https://주소".length;
      } else {
        replacement = "[링크 텍스트](https://주소)";
        selectionStart = start + 1;
        selectionEnd = selectionStart + "링크 텍스트".length;
      }
    } else if (action === "divider") {
      replacement = (start > 0 && source[start - 1] !== "\n" ? "\n\n" : "") + "---\n\n";
      selectionStart = start + replacement.length;
      selectionEnd = selectionStart;
    } else {
      const lineStart = source.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
      const currentLineEndIndex = source.indexOf("\n", start);
      const currentLineEnd = currentLineEndIndex < 0 ? source.length : currentLineEndIndex;
      replaceStart = selected ? lineStart : lineStart;
      replaceEnd = selected
        ? (source.indexOf("\n", end) < 0 ? source.length : source.indexOf("\n", end))
        : currentLineEnd;

      const block = source.slice(replaceStart, replaceEnd);
      const lines = block.split("\n");
      const placeholder = action === "heading" ? "제목" : action === "quote" ? "인용문" : "목록 항목";
      const prefix = action === "heading" ? "# " : action === "quote" ? "> " : action === "bullet" ? "- " : "";
      replacement = lines.map((line, index) => {
        const value = line || (!selected && index === 0 ? placeholder : "");
        return action === "ordered" ? (index + 1) + ". " + value : prefix + value;
      }).join("\n");
      selectionStart = replaceStart;
      selectionEnd = replaceStart + replacement.length;
    }

    const nextValue = source.slice(0, replaceStart) + replacement + source.slice(replaceEnd);
    updatePage("left", nextValue);

    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  function getMarkdownContent(note: MarkdownNote) {
    const pages = decodeNotePages(note.content);
    return [
      "# " + (note.title.trim() || "제목 없는 글"),
      "",
      pages.left,
      ...(pages.right.trim() ? ["", "---", "", pages.right] : [])
    ].join("\n");
  }

  function downloadMarkdown(title: string, markdown: string) {
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

  async function shareMarkdown() {
    if (!activeNote) return;

    const title = activeNote.title.trim() || "제목 없는 글";
    const markdown = getMarkdownContent(activeNote);
    setShareFeedback("");

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: markdown });
        setShareFeedback("공유 창을 열었어.");
        return;
      } catch (shareError) {
        if (shareError instanceof Error && shareError.name === "AbortError") return;
      }
    }

    try {
      if (!navigator.clipboard?.writeText) throw new Error("클립보드를 사용할 수 없습니다.");
      await navigator.clipboard.writeText(markdown);
      setShareFeedback("Markdown 내용을 복사했어.");
    } catch {
      downloadMarkdown(title, markdown);
      setShareFeedback("공유를 지원하지 않아 Markdown 파일로 저장했어.");
    }
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
        noteOptions={notes.map(note => ({ id: note.id, title: note.title }))}
        activeNoteId={activeNoteId}
        noteSaveLabel={saveLabel}
        noteActionsDisabled={loading || creating}
        noteCanDelete={!!activeNote}
        onNoteSelect={noteId => { void selectNote(noteId); }}
        onCreateNote={() => { void createNote(); }}
        onDeleteNote={() => { void deleteActiveNote(); }}
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
            <div className="book-frame markdown-diary-single-page">
              <section className="paper-page markdown-note-page markdown-single-note-page" aria-label="자유 노트">
                <div className="paper-section key-section markdown-free-note-section">
                  <div className="section-heading"><span>FREE NOTE</span></div>
                  <div className="free-note-paper">
                    {loading ? (
                      <div className="markdown-empty-state" role="status">노트를 불러오는 중...</div>
                    ) : activeNote ? (
                      <>
                        <div className="markdown-toolbar" role="toolbar" aria-label="Markdown 도구 모음">
                          {MARKDOWN_TOOLBAR.map(({ action, label, icon: Icon }) => (
                            <button
                              key={action}
                              type="button"
                              className="markdown-toolbar-button"
                              aria-label={label}
                              title={label}
                              onMouseDown={event => event.preventDefault()}
                              onClick={() => applyMarkdown(action)}
                            >
                              <Icon size={16} strokeWidth={2}/>
                            </button>
                          ))}
                          <div className="markdown-toolbar-spacer" />
                          {shareFeedback ? (
                            <span className="markdown-share-feedback" aria-live="polite">{shareFeedback}</span>
                          ) : null}
                          <button
                            type="button"
                            className="markdown-toolbar-button markdown-toolbar-share"
                            aria-label="공유"
                            title="공유"
                            onMouseDown={event => event.preventDefault()}
                            onClick={() => { void shareMarkdown(); }}
                          >
                            <Share2 size={16} strokeWidth={2}/>
                          </button>
                        </div>
                        <textarea
                          ref={leftEditorRef}
                          className="free-note-input"
                          aria-label="자유 노트 내용"
                          value={pageContents.left}
                          onChange={event => updatePage("left", event.target.value)}
                          spellCheck
                        />
                      </>
                    ) : (
                      <div className="markdown-empty-state" role="status">
                        노트를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
