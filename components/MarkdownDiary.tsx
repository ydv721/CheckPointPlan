"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Bold, Code2, Download, Eye, FilePlus2, Heading1, Heading2,
  Italic, List, ListOrdered, MessageSquareQuote, Minus,
  Pencil, Search, Trash2
} from "lucide-react";
import AppSidebar from "@/components/AppSidebar";

type MarkdownNote = {
  id: string;
  notebook_id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

type Props = {
  client: SupabaseClient;
  userId: string;
  email: string;
  notebookId: string;
  notebookTitle: string;
  themeStyle: CSSProperties;
  darkMode: boolean;
  onDarkModeChange: (enabled: boolean) => void;
  onBack: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onDeleteAccount: () => void;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
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

function inlineMarkdown(value: string): ReactNode[] {
  const tick = String.fromCharCode(96);
  const pattern = new RegExp(
    "(\\*\\*[^*]+\\*\\*|__[^_]+__|" + tick + "[^" + tick + "]+" + tick + "|\\*[^*\\n]+\\*|_[^_\\n]+_|~~[^~]+~~)",
    "g"
  );
  return value.split(pattern).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("__") && part.endsWith("__")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith(tick) && part.endsWith(tick)) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("~~") && part.endsWith("~~")) {
      return <del key={index}>{part.slice(2, -2)}</del>;
    }
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <span key={index}>{part}</span>;
  });
}

function isMarkdownBlockStart(line: string) {
  const trimmed = line.trim();
  const fence = String.fromCharCode(96).repeat(3);
  return /^(#{1,3}\s|>\s?|[-*+]\s+|\d+\.\s+|---+$|___+$|\*\*\*+$)/.test(trimmed) ||
    trimmed.startsWith(fence);
}

function MarkdownPreview({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  const fence = String.fromCharCode(96).repeat(3);
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith(fence)) {
      const language = trimmed.slice(3).trim();
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !lines[index].trim().startsWith(fence)) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <pre key={"code-" + index}>
          <code className={language ? "language-" + language : undefined}>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    if (/^(---+|___+|\*\*\*+)$/.test(trimmed)) {
      blocks.push(<hr key={"hr-" + index} />);
      index += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const text = inlineMarkdown(heading[2]);
      if (level === 1) blocks.push(<h1 key={"h-" + index}>{text}</h1>);
      else if (level === 2) blocks.push(<h2 key={"h-" + index}>{text}</h2>);
      else blocks.push(<h3 key={"h-" + index}>{text}</h3>);
      index += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(
        <blockquote key={"quote-" + index}>
          {quoteLines.map((quoteLine, quoteIndex) => (
            <p key={quoteIndex}>{inlineMarkdown(quoteLine)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    const firstListItem = trimmed.match(/^([-*+])\s+(.*)$/) || trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (firstListItem) {
      const ordered = /^\d+\.\s+/.test(trimmed);
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index].trim();
        const match = ordered
          ? current.match(/^\d+\.\s+(.*)$/)
          : current.match(/^[-*+]\s+(.*)$/);
        if (!match) break;
        items.push(match[1]);
        index += 1;
      }
      const listItems = items.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item)}</li>);
      blocks.push(ordered ? <ol key={"list-" + index}>{listItems}</ol> : <ul key={"list-" + index}>{listItems}</ul>);
      continue;
    }

    const paragraph = [trimmed];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isMarkdownBlockStart(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={"p-" + index}>{inlineMarkdown(paragraph.join(" "))}</p>);
  }

  return <div className="markdown-preview-content">{blocks.length ? blocks : <p className="markdown-preview-empty">미리보기할 내용이 없습니다.</p>}</div>;
}

export default function MarkdownDiary({
  client,
  userId,
  email,
  notebookId,
  notebookTitle,
  themeStyle,
  darkMode,
  onDarkModeChange,
  onBack,
  onSignOut,
  onDeleteAccount
}: Props) {
  const [notes, setNotes] = useState<MarkdownNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const currentNoteRef = useRef<MarkdownNote | null>(null);
  const savedSnapshotsRef = useRef<Record<string, string>>({});
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));

  const activeNote = useMemo(
    () => notes.find(note => note.id === activeNoteId) ?? null,
    [notes, activeNoteId]
  );

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return notes;
    return notes.filter(note =>
      note.title.toLocaleLowerCase().includes(query) ||
      note.content.toLocaleLowerCase().includes(query)
    );
  }, [notes, search]);

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
          setError("글 목록을 불러오지 못했습니다: " + loadError.message);
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

      if (saveError) {
        setSaveState("error");
        setError("글 저장에 실패했습니다: " + saveError.message);
        return false;
      }

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
        title: "제목 없는 글",
        content: ""
      })
      .select("id,notebook_id,user_id,title,content,created_at,updated_at")
      .single();

    if (createError || !data) {
      setError("새 글을 만들지 못했습니다: " + (createError?.message ?? "알 수 없는 오류"));
      setCreating(false);
      return;
    }

    const note = data as MarkdownNote;
    savedSnapshotsRef.current[note.id] = JSON.stringify({ title: note.title, content: note.content });
    setNotes(current => [note, ...current]);
    setActiveNoteId(note.id);
    setMode("edit");
    setSearch("");
    setCreating(false);
    requestAnimationFrame(() => editorRef.current?.focus());
  }

  async function selectNote(noteId: string) {
    if (noteId === activeNoteId) return;
    if (!(await saveCurrentNote())) return;
    setActiveNoteId(noteId);
    setMode("edit");
  }

  async function deleteActiveNote() {
    if (!activeNote) return;
    const title = activeNote.title.trim() || "제목 없는 글";
    if (!window.confirm("「" + title + "」 글을 삭제하시겠습니까? 삭제한 글은 복구할 수 없습니다.")) return;

    const { error: deleteError } = await client
      .from("markdown_notes")
      .delete()
      .eq("id", activeNote.id)
      .eq("notebook_id", notebookId)
      .eq("user_id", userId);

    if (deleteError) {
      setError("글을 삭제하지 못했습니다: " + deleteError.message);
      return;
    }

    const remaining = notes.filter(note => note.id !== activeNote.id);
    delete savedSnapshotsRef.current[activeNote.id];
    setNotes(remaining);
    setActiveNoteId(remaining[0]?.id ?? null);
    setMode("edit");
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

  function insertWrapped(prefix: string, suffix: string, placeholder: string) {
    const editor = editorRef.current;
    if (!editor || !activeNote) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = activeNote.content.slice(start, end) || placeholder;
    const next = activeNote.content.slice(0, start) + prefix + selected + suffix + activeNote.content.slice(end);
    updateActiveNote({ content: next });
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  }

  function insertLinePrefix(prefix: string) {
    const editor = editorRef.current;
    if (!editor || !activeNote) return;
    const start = editor.selectionStart;
    const lineStart = activeNote.content.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const next = activeNote.content.slice(0, lineStart) + prefix + activeNote.content.slice(lineStart);
    updateActiveNote({ content: next });
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  }

  function insertRule() {
    const editor = editorRef.current;
    if (!editor || !activeNote) return;
    const start = editor.selectionStart;
    const before = activeNote.content.slice(0, start);
    const after = activeNote.content.slice(start);
    const insertion = (before && !before.endsWith("\n") ? "\n" : "") + "\n---\n\n";
    const next = before + insertion + after;
    updateActiveNote({ content: next });
    requestAnimationFrame(() => {
      editor.focus();
      const cursor = before.length + insertion.length;
      editor.setSelectionRange(cursor, cursor);
    });
  }

  function exportMarkdown() {
    if (!activeNote) return;
    const title = activeNote.title.trim() || "제목 없는 글";
    const markdown = "# " + title + "\n\n" + activeNote.content;
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

  const saveLabel = saveState === "saving"
    ? "저장 중"
    : saveState === "dirty"
      ? "저장 대기 중"
      : saveState === "error"
        ? "저장 실패"
        : "저장 완료";

  return (
    <div className="markdown-diary-shell" style={themeStyle} data-theme={darkMode ? "dark" : "light"}>
      <header className="markdown-diary-header">
        <div className="markdown-diary-brand">
          <span className="markdown-diary-brand-mark">C</span>
          <span><strong>CHECKPOINT</strong><small>{notebookTitle}</small></span>
        </div>
        <AppSidebar
          email={email}
          currentView="markdown"
          themeStyle={themeStyle}
          darkMode={darkMode}
          onDarkModeChange={onDarkModeChange}
          onOpenNotebookList={() => { void leaveDiary(onBack); }}
          onSignOut={() => { void leaveDiary(onSignOut); }}
          onDeleteAccount={onDeleteAccount}
        />
      </header>

      <main className="markdown-diary-main">
        <div className="markdown-diary-heading">
          <div>
            <span className="eyebrow">FREE DIARY · MARKDOWN</span>
            <h1>{notebookTitle}</h1>
            <p>생각과 지식을 자유롭게 기록하고 정리해 보세요.</p>
          </div>
          <div className="markdown-diary-save-status" role="status" aria-live="polite">
            <span className={"markdown-save-dot markdown-save-" + saveState}/>
            {saveLabel}
          </div>
        </div>

        {error ? <div className="markdown-diary-error" role="alert">{error}</div> : null}

        <div className="markdown-diary-workspace">
          <aside className="markdown-note-library" aria-label="작성한 글 목록">
            <div className="markdown-note-library-heading">
              <div><strong>내 글</strong><span>{notes.length}개</span></div>
              <button type="button" className="markdown-new-note-button" onClick={() => { void createNote(); }} disabled={creating}>
                <FilePlus2 size={16}/><span>새 글</span>
              </button>
            </div>
            <label className="markdown-note-search">
              <Search size={16}/>
              <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="글 제목 또는 내용 검색"/>
            </label>
            <div className="markdown-note-list">
              {loading ? (
                <div className="markdown-note-list-empty">글을 불러오는 중입니다...</div>
              ) : filteredNotes.length ? (
                filteredNotes.map(note => {
                  const snippet = note.content.replace(/\s+/g, " ").trim();
                  return (
                    <button
                      type="button"
                      key={note.id}
                      className={"markdown-note-item" + (note.id === activeNoteId ? " is-active" : "")}
                      onClick={() => { void selectNote(note.id); }}
                    >
                      <strong>{note.title.trim() || "제목 없는 글"}</strong>
                      <span>{snippet || "아직 작성한 내용이 없습니다."}</span>
                      <time>{formatTime(note.updated_at)}</time>
                    </button>
                  );
                })
              ) : (
                <div className="markdown-note-list-empty">
                  {search.trim() ? "검색 결과가 없습니다." : "아직 작성한 글이 없습니다."}
                </div>
              )}
            </div>
          </aside>

          <section className="markdown-note-editor" aria-label="Markdown 편집기">
            {activeNote ? (
              <>
                <div className="markdown-editor-header">
                  <input
                    className="markdown-note-title"
                    type="text"
                    maxLength={120}
                    value={activeNote.title}
                    onChange={event => updateActiveNote({ title: event.target.value })}
                    placeholder="글 제목"
                    aria-label="글 제목"
                  />
                  <div className="markdown-editor-actions">
                    <button type="button" onClick={exportMarkdown} title="Markdown 파일 내보내기">
                      <Download size={16}/><span>.md 내보내기</span>
                    </button>
                    <button type="button" className="markdown-delete-note" onClick={() => { void deleteActiveNote(); }} title="현재 글 삭제">
                      <Trash2 size={16}/><span>삭제</span>
                    </button>
                  </div>
                </div>

                <div className="markdown-editor-toolbar-row">
                  {mode === "edit" ? (
                    <div className="markdown-format-toolbar" aria-label="Markdown 서식 도구">
                      <button type="button" title="제목 1" aria-label="제목 1" onClick={() => insertLinePrefix("# ")}><Heading1 size={17}/></button>
                      <button type="button" title="제목 2" aria-label="제목 2" onClick={() => insertLinePrefix("## ")}><Heading2 size={17}/></button>
                      <span className="markdown-toolbar-divider"/>
                      <button type="button" title="굵게" aria-label="굵게" onClick={() => insertWrapped("**", "**", "굵은 글씨")}><Bold size={17}/></button>
                      <button type="button" title="기울임" aria-label="기울임" onClick={() => insertWrapped("*", "*", "기울인 글씨")}><Italic size={17}/></button>
                      <span className="markdown-toolbar-divider"/>
                      <button type="button" title="글머리 기호 목록" aria-label="글머리 기호 목록" onClick={() => insertLinePrefix("- ")}><List size={17}/></button>
                      <button type="button" title="번호 목록" aria-label="번호 목록" onClick={() => insertLinePrefix("1. ")}><ListOrdered size={17}/></button>
                      <button type="button" title="인용" aria-label="인용" onClick={() => insertLinePrefix("> ")}><MessageSquareQuote size={17}/></button>
                      <button type="button" title="코드 블록" aria-label="코드 블록" onClick={() => insertWrapped(String.fromCharCode(96).repeat(3) + "\n", "\n" + String.fromCharCode(96).repeat(3), "코드를 입력하세요.")}><Code2 size={17}/></button>
                      <button type="button" title="구분선" aria-label="구분선" onClick={insertRule}><Minus size={17}/></button>
                    </div>
                  ) : <span className="markdown-preview-mode-label"><Eye size={15}/> 미리보기</span>}
                  <div className="markdown-mode-switch" role="tablist" aria-label="편집 및 미리보기">
                    <button type="button" role="tab" aria-selected={mode === "edit"} className={mode === "edit" ? "is-active" : ""} onClick={() => setMode("edit")}><Pencil size={14}/>편집</button>
                    <button type="button" role="tab" aria-selected={mode === "preview"} className={mode === "preview" ? "is-active" : ""} onClick={() => setMode("preview")}><Eye size={14}/>미리보기</button>
                  </div>
                </div>

                {mode === "edit" ? (
                  <textarea
                    ref={editorRef}
                    className="markdown-note-textarea"
                    value={activeNote.content}
                    onChange={event => updateActiveNote({ content: event.target.value })}
                    placeholder="여기에 Markdown으로 자유롭게 기록해 보세요."
                    aria-label="Markdown 본문"
                    spellCheck
                  />
                ) : (
                  <div className="markdown-note-preview">
                    <MarkdownPreview source={activeNote.content}/>
                  </div>
                )}

                <footer className="markdown-editor-footer">
                  <span>Markdown 지원: 제목 · 굵게 · 기울임 · 목록 · 인용 · 코드 블록</span>
                  <span>{activeNote.content.length.toLocaleString("ko-KR")}자 · {formatDate(activeNote.updated_at)}</span>
                </footer>
              </>
            ) : (
              <div className="markdown-editor-empty">
                <div className="markdown-editor-empty-icon"><Pencil size={25}/></div>
                <strong>{loading ? "글을 불러오고 있습니다." : "어떤 내용을 기록할까요?"}</strong>
                <p>{loading ? "잠시만 기다려 주세요." : "새 글을 만들어 Markdown으로 자유롭게 작성해 보세요."}</p>
                {!loading ? <button type="button" className="markdown-empty-create-button" onClick={() => { void createNote(); }} disabled={creating}><FilePlus2 size={16}/>새 글 작성</button> : null}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
