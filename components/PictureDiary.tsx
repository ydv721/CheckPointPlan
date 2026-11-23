"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Brush, CalendarDays, Check, ChevronLeft, ChevronRight, ImagePlus, X
} from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import PlannerSpread from "@/components/PlannerSpread";
import SketchWorkspace, { createEmptySketchDocument, type SketchDocument } from "@/components/SketchWorkspace";
import {
  highlightCodeBlocks, htmlToMarkdown, markdownToHtml
} from "@/components/MarkdownDiary";
import type { ThemeName } from "@/lib/types";

type DiaryEntry = {
  id?: string;
  notebook_id: string;
  user_id: string;
  date: string;
  title: string;
  weather: string;
  wake_time: string;
  sleep_time: string;
  drawing_path: string | null;
  drawing_state: SketchDocument | null;
  journal_content: string;
  memo: string;
  reflection: string;
  created_at?: string;
  updated_at?: string;
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
  onOpenCover: () => void;
  onSignOut: () => Promise<void>;
  onDeleteAccount: () => void;
};

const WEATHER_OPTIONS = [
  { id: "sunny", label: "맑음", emoji: "☀️" },
  { id: "partly-cloudy", label: "구름 조금", emoji: "🌤️" },
  { id: "cloudy", label: "흐림", emoji: "☁️" },
  { id: "rainy", label: "비", emoji: "🌧️" },
  { id: "snowy", label: "눈", emoji: "❄️" },
  { id: "windy", label: "바람", emoji: "🍃" }
];
const uid = () => globalThis.crypto?.randomUUID?.() || String(Date.now()) + "-" + Math.random().toString(36).slice(2);

function localToday() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function dateLabel(value: string) {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some(number => !number)) return value;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return parts[0] + " " + parts[1] + " " + parts[2] + " " + weekday;
}

function shiftDate(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day + amount);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function emptyEntry(notebookId: string, userId: string, date: string): DiaryEntry {
  return {
    notebook_id: notebookId,
    user_id: userId,
    date,
    title: "",
    weather: "sunny",
    wake_time: "",
    sleep_time: "",
    drawing_path: null,
    drawing_state: null,
    journal_content: "",
    memo: "",
    reflection: ""
  };
}

function entrySnapshot(entry: DiaryEntry) {
  return JSON.stringify({
    date: entry.date,
    title: entry.title,
    weather: entry.weather,
    wake_time: entry.wake_time,
    sleep_time: entry.sleep_time,
    drawing_path: entry.drawing_path,
    drawing_state: entry.drawing_state,
    journal_content: entry.journal_content,
    memo: entry.memo,
    reflection: entry.reflection
  });
}

type Meridiem = "AM" | "PM";
type TimePart = "hour" | "minute" | null;

function parseDiaryTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return { period: "AM" as Meridiem, hour: 12, minute: 0 };
  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  if (hour24 > 23 || minute > 59) return { period: "AM" as Meridiem, hour: 12, minute: 0 };
  return {
    period: hour24 >= 12 ? "PM" as Meridiem : "AM" as Meridiem,
    hour: hour24 % 12 || 12,
    minute
  };
}

function toStoredDiaryTime(period: Meridiem, hour: number, minute: number) {
  const hour24 = period === "PM" ? (hour % 12) + 12 : hour % 12;
  return String(hour24).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
}

function DiaryTimePicker({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const current = parseDiaryTime(value);
  const [activePart, setActivePart] = useState<TimePart>(null);
  const [hourDraft, setHourDraft] = useState(String(current.hour));
  const [minuteDraft, setMinuteDraft] = useState(String(current.minute).padStart(2, "0"));

  useEffect(() => {
    if (!activePart) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setActivePart(null);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [activePart]);

  function updateTime(period: Meridiem, hour: number, minute: number) {
    onChange(toStoredDiaryTime(period, hour, minute));
  }

  function togglePart(part: Exclude<TimePart, null>) {
    if (activePart === part) {
      setActivePart(null);
      return;
    }
    setHourDraft(String(current.hour));
    setMinuteDraft(String(current.minute).padStart(2, "0"));
    setActivePart(part);
  }

  function commitHour() {
    const normalized = hourDraft.trim();
    const parsed = /^\d{1,2}$/.test(normalized) ? Number(normalized) : NaN;
    if (parsed >= 1 && parsed <= 12) {
      updateTime(current.period, parsed, current.minute);
      setHourDraft(String(parsed));
    } else {
      setHourDraft(String(current.hour));
    }
  }

  function commitMinute() {
    const normalized = minuteDraft.trim();
    const parsed = /^\d{1,2}$/.test(normalized) ? Number(normalized) : NaN;
    if (parsed >= 0 && parsed <= 59) {
      updateTime(current.period, current.hour, parsed);
      setMinuteDraft(String(parsed).padStart(2, "0"));
    } else {
      setMinuteDraft(String(current.minute).padStart(2, "0"));
    }
  }

  return (
    <div className="diary-time-field">
      <span className="diary-field-label">{label}</span>
      <div className="diary-time-picker" ref={rootRef}>
        <div className="diary-time-value">
          <button type="button" className="diary-time-period" aria-label={label + " 오전/오후 변경"}
            onClick={() => {
              setActivePart(null);
              updateTime(current.period === "AM" ? "PM" : "AM", current.hour, current.minute);
            }}>
            {current.period}
          </button>
          <button type="button" className="diary-time-segment" aria-label={label + " 시 선택"}
            aria-expanded={activePart === "hour"} onClick={() => togglePart("hour")}>
            {String(current.hour).padStart(2, "0")}
          </button>
          <span className="diary-time-colon" aria-hidden="true">:</span>
          <button type="button" className="diary-time-segment" aria-label={label + " 분 선택"}
            aria-expanded={activePart === "minute"} onClick={() => togglePart("minute")}>
            {String(current.minute).padStart(2, "0")}
          </button>
        </div>

        {activePart === "hour" ? (
          <div className="diary-time-popover" role="group" aria-label={label + " 시 선택"}>
            <div className="diary-time-options diary-time-hour-options">
              {Array.from({ length: 12 }, (_, index) => index + 1).map(hour => (
                <button key={hour} type="button" className={current.hour === hour ? "is-selected" : ""}
                  onClick={() => { updateTime(current.period, hour, current.minute); setHourDraft(String(hour)); setActivePart(null); }}>
                  {hour}
                </button>
              ))}
            </div>
            <label className="diary-time-direct-input">
              <span>직접 입력</span>
              <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} aria-label={label + " 시 직접 입력"}
                value={hourDraft} onChange={event => setHourDraft(event.target.value.replace(/\D/g, "").slice(0, 2))}
                onBlur={commitHour}
                onKeyDown={event => {
                  if (event.key === "Enter") { event.preventDefault(); commitHour(); setActivePart(null); }
                }}/>
            </label>
          </div>
        ) : null}

        {activePart === "minute" ? (
          <div className="diary-time-popover is-minute" role="group" aria-label={label + " 분 선택"}>
            <div className="diary-time-options diary-time-minute-options">
              {[0, 10, 20, 30, 40, 50].map(minute => (
                <button key={minute} type="button" className={current.minute === minute ? "is-selected" : ""}
                  onClick={() => { updateTime(current.period, current.hour, minute); setMinuteDraft(String(minute).padStart(2, "0")); setActivePart(null); }}>
                  {String(minute).padStart(2, "0")}
                </button>
              ))}
            </div>
            <label className="diary-time-direct-input">
              <span>직접 입력</span>
              <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} aria-label={label + " 분 직접 입력"}
                value={minuteDraft} onChange={event => setMinuteDraft(event.target.value.replace(/\D/g, "").slice(0, 2))}
                onBlur={commitMinute}
                onKeyDown={event => {
                  if (event.key === "Enter") { event.preventDefault(); commitMinute(); setActivePart(null); }
                }}/>
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function PictureDiary({
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
  onOpenCover,
  onSignOut,
  onDeleteAccount
}: Props) {
  const [date, setDate] = useState(localToday);
  const [entry, setEntry] = useState<DiaryEntry>(() => emptyEntry(notebookId, userId, localToday()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawingUrl, setDrawingUrl] = useState("");
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [sketchOpen, setSketchOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const entryRef = useRef(entry);
  const lastSavedRef = useRef("");
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    entryRef.current = entry;
  }, [entry]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setDrawingUrl("");
    void (async () => {
      try {
        const { data, error: loadError } = await client
          .from("picture_diary_entries")
          .select("id,notebook_id,user_id,entry_date,title,weather,wake_time,sleep_time,drawing_path,drawing_state,journal_content,memo,reflection,created_at,updated_at")
          .eq("notebook_id", notebookId)
          .eq("user_id", userId)
          .eq("entry_date", date)
          .maybeSingle();
        if (!active) return;
        if (loadError) throw loadError;
        const next: DiaryEntry = data ? {
          id: data.id,
          notebook_id: data.notebook_id,
          user_id: data.user_id,
          date,
          title: data.title || "",
          weather: data.weather || "sunny",
          wake_time: data.wake_time || "",
          sleep_time: data.sleep_time || "",
          drawing_path: data.drawing_path || null,
          drawing_state: data.drawing_state && typeof data.drawing_state === "object" ? data.drawing_state as SketchDocument : null,
          journal_content: data.journal_content || "",
          memo: data.memo || "",
          reflection: data.reflection || "",
          created_at: data.created_at,
          updated_at: data.updated_at
        } : emptyEntry(notebookId, userId, date);
        lastSavedRef.current = entrySnapshot(next);
        entryRef.current = next;
        setEntry(next);
        if (next.drawing_path) {
          const { data: signed, error: signedError } = await client.storage
            .from("picture-diary-assets")
            .createSignedUrl(next.drawing_path, 60 * 60);
          if (!active) return;
          if (signedError) setError("그림 미리보기를 불러오지 못했습니다: " + signedError.message);
          else setDrawingUrl(signed?.signedUrl ?? "");
        }
      } catch (loadError) {
        if (!active) return;
        const message = loadError instanceof Error ? loadError.message : "알 수 없는 오류";
        setError("그림일기를 불러오지 못했습니다: " + message);
        const fallback = emptyEntry(notebookId, userId, date);
        entryRef.current = fallback;
        setEntry(fallback);
        lastSavedRef.current = entrySnapshot(fallback);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => { active = false; };
  }, [client, notebookId, userId, date]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || loading) return;
    if (editor.dataset.entryDate !== date) {
      editor.innerHTML = markdownToHtml(entry.journal_content);
      editor.dataset.entryDate = date;
    }
  }, [date, entry.journal_content, loading]);

  const persistEntry = useCallback((current: DiaryEntry): Promise<boolean> => {
    const snapshot = entrySnapshot(current);
    if (snapshot === lastSavedRef.current) return Promise.resolve(true);
    const run = async () => {
      const updatedAt = new Date().toISOString();
      try {
        const { error: saveError } = await client.from("picture_diary_entries").upsert({
          notebook_id: notebookId,
          user_id: userId,
          entry_date: current.date,
          title: current.title,
          weather: current.weather,
          wake_time: current.wake_time,
          sleep_time: current.sleep_time,
          drawing_path: current.drawing_path,
          drawing_state: current.drawing_state,
          journal_content: current.journal_content,
          memo: current.memo,
          reflection: current.reflection,
          updated_at: updatedAt
        }, { onConflict: "notebook_id,entry_date" });
        if (saveError) throw saveError;
        lastSavedRef.current = snapshot;
        setError("");
        await client.from("notebooks").update({ updated_at: updatedAt }).eq("id", notebookId).eq("user_id", userId);
        return true;
      } catch (saveError) {
        const message = saveError instanceof Error ? saveError.message : "네트워크 연결을 확인해 주세요.";
        setError("그림일기 저장에 실패했습니다: " + message);
        return false;
      }
    };
    const queued = saveQueueRef.current.then(run, run);
    saveQueueRef.current = queued;
    return queued;
  }, [client, notebookId, userId]);

  useEffect(() => {
    if (loading) return;
    const snapshot = entrySnapshot(entry);
    if (snapshot === lastSavedRef.current) return;
    const timer = window.setTimeout(() => { void persistEntry(entry); }, 900);
    return () => window.clearTimeout(timer);
  }, [entry, loading, persistEntry]);

  const saveCurrentEntry = useCallback(async () => {
    if (loading) return false;
    return await persistEntry(entryRef.current);
  }, [loading, persistEntry]);

  async function leaveDiary(action: () => Promise<void>) {
    if (!(await saveCurrentEntry())) return;
    await action();
  }

  async function navigateDate(nextDate: string) {
    if (uploading || !/^\d{4}-\d{2}-\d{2}$/.test(nextDate) || nextDate === date) return;
    if (!(await saveCurrentEntry())) return;
    setDate(nextDate);
  }

  function updateEntry(patch: Partial<DiaryEntry>) {
    setEntry(current => {
      const next = { ...current, ...patch };
      entryRef.current = next;
      return next;
    });
  }

  function updateJournalContent() {
    const editor = editorRef.current;
    if (editor) updateEntry({ journal_content: htmlToMarkdown(editor.innerHTML) });
  }

  async function replaceDrawing(file: File, drawingState: SketchDocument | null) {
    if (uploading || !file) return false;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      setError("PNG, JPG, WEBP, GIF 형식의 이미지만 업로드할 수 있습니다.");
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("그림 파일은 10MB 이하만 업로드할 수 있습니다.");
      return false;
    }
    setUploading(true);
    setError("");
    const extension = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" } as Record<string, string>)[file.type];
    const path = userId + "/" + notebookId + "/" + date + "/" + uid() + "." + extension;
    const previousPath = entryRef.current.drawing_path;
    const previousState = entryRef.current.drawing_state;
    const previousUrl = drawingUrl;
    try {
      const { error: uploadError } = await client.storage.from("picture-diary-assets").upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data: signed, error: signedError } = await client.storage.from("picture-diary-assets").createSignedUrl(path, 60 * 60);
      if (signedError || !signed?.signedUrl) throw signedError ?? new Error("그림 미리보기를 만들지 못했습니다.");
      const next = { ...entryRef.current, drawing_path: path, drawing_state: drawingState };
      entryRef.current = next;
      setEntry(next);
      const saved = await persistEntry(next);
      if (!saved) {
        await client.storage.from("picture-diary-assets").remove([path]);
        setEntry(current => {
          if (current.drawing_path !== path) return current;
          const restored = { ...current, drawing_path: previousPath, drawing_state: previousState };
          entryRef.current = restored;
          return restored;
        });
        setDrawingUrl(previousUrl);
        return false;
      }
      setDrawingUrl(signed.signedUrl);
      if (previousPath && previousPath !== path) await client.storage.from("picture-diary-assets").remove([previousPath]);
      return true;
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "파일 업로드에 실패했습니다.";
      setError("그림을 저장하지 못했습니다: " + message);
      await client.storage.from("picture-diary-assets").remove([path]);
      return false;
    } finally {
      setUploading(false);
    }
  }

  async function saveSketch(blob: Blob, document: SketchDocument) {
    const file = new File([blob], "picture-diary-sketch.png", { type: "image/png" });
    return await replaceDrawing(file, document);
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setChoiceOpen(false);
    await replaceDrawing(file, null);
  }

  async function saveAndOpenCover() {
    if (await saveCurrentEntry()) onOpenCover();
  }

  function requestSketch() {
    setChoiceOpen(false);
    setSketchOpen(true);
  }

  return (
    <div className="app-shell planner-view picture-diary-shell" style={themeStyle}>
      <AppSidebar
        email={email}
        currentView="markdown"
        themeStyle={themeStyle}
        theme={theme}
        customColor={customColor}
        onThemeChange={onThemeChange}
        onCustomColorChange={onCustomColorChange}
        onViewChange={nextView => {
          if (nextView === "cover") void saveAndOpenCover();
        }}
        onOpenNotebookList={() => { void leaveDiary(onBack); }}
        onSignOut={() => { void leaveDiary(onSignOut); }}
        onDeleteAccount={() => { void leaveDiary(async () => { onDeleteAccount(); }); }}
      />

      <header className="site-header">
        <div className="header-inner">
          <button type="button" className="brand" onClick={() => { void leaveDiary(onBack); }}>
            <span className="brand-lockup"><span className="brand-icon"><Check size={18} strokeWidth={3}/></span><span>CHECKPOINT</span></span>
          </button>
          <div className="picture-diary-header-title"><span>{notebookTitle}</span></div>
        </div>
      </header>

      <main className="main-area picture-diary-main">
        {error ? <div className="message-banner markdown-diary-error" role="alert"><span>{error}</span><button type="button" aria-label="알림 닫기" onClick={() => setError("")}><X size={15}/></button></div> : null}
        <div className="workspace-shell">
          <div className="workspace-canvas picture-diary-canvas">
            <PlannerSpread className="book-frame picture-diary-book-frame">
              <div className="book-spine" aria-hidden="true">{Array.from({ length: 13 }, (_, index) => <span key={index}/>)}</div>

              <section className="paper-page left-page diary-left-page" aria-label="오늘의 그림">
                <div className="diary-date-heading">
                  <div className="diary-date-navigation">
                    <button type="button" className="month-nav-button" aria-label="이전 날짜" title="이전 날짜" disabled={loading || uploading} onClick={() => void navigateDate(shiftDate(date, -1))}><ChevronLeft size={16}/></button>
                    <strong>{dateLabel(date)}</strong>
                    <button type="button" className="month-nav-button" aria-label="다음 날짜" title="다음 날짜" disabled={loading || uploading} onClick={() => void navigateDate(shiftDate(date, 1))}><ChevronRight size={16}/></button>
                    <label className="diary-date-picker" title="날짜 선택">
                      <CalendarDays size={16}/>
                      <input type="date" aria-label="그림일기 날짜 선택" value={date} disabled={loading || uploading} onChange={event => void navigateDate(event.target.value)}/>
                    </label>
                  </div>
                </div>

                <div className="diary-daily-info">
                  <div className="diary-weather-group">
                    <span className="diary-field-label">오늘의 날씨</span>
                    <div className="diary-weather-options" role="group" aria-label="오늘의 날씨">
                      {WEATHER_OPTIONS.map(option => (
                        <button key={option.id} type="button" className={entry.weather === option.id ? "diary-weather-option is-active" : "diary-weather-option"}
                          aria-label={option.label} title={option.label} aria-pressed={entry.weather === option.id}
                          onClick={() => updateEntry({ weather: option.id })}>
                          <span>{option.emoji}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <DiaryTimePicker label="일어난 시간" value={entry.wake_time} onChange={wake_time => updateEntry({ wake_time })}/>
                  <DiaryTimePicker label="잠잘 시간" value={entry.sleep_time} onChange={sleep_time => updateEntry({ sleep_time })}/>
                </div>

                <button type="button" className={drawingUrl ? "picture-diary-drawing-area has-image" : "picture-diary-drawing-area"}
                  disabled={loading || uploading} onClick={() => setChoiceOpen(true)} aria-label="그림 추가 또는 변경">
                  {drawingUrl ? (
                    <>
                      <img src={drawingUrl} alt="오늘의 그림"/>
                      <span className="picture-diary-drawing-edit"><Brush size={15}/> 그림 변경</span>
                    </>
                  ) : (
                    <span className="picture-diary-drawing-empty">
                      <ImagePlus size={31}/>
                      <strong>{uploading ? "그림을 저장하고 있습니다..." : "그림을 그리거나 사진을 추가해 보세요."}</strong>
                    </span>
                  )}
                </button>
              </section>

              <section className="paper-page right-page diary-right-page" aria-label="오늘의 일기">
                <div className="diary-title-field">
                  <label htmlFor="picture-diary-title">제목</label>
                  <input id="picture-diary-title" type="text" maxLength={100} value={entry.title} onChange={event => updateEntry({ title: event.target.value })}/>
                </div>

                <section className="paper-section key-section diary-journal-section">
                  <div className="free-note-paper diary-journal-paper">
                    {loading ? <div className="markdown-empty-state">일기를 불러오는 중입니다...</div> : (
                      <>
                        <div ref={editorRef} className="free-note-input markdown-editor-grid picture-diary-rich-editor"
                          role="textbox" aria-label="오늘의 일기 내용" aria-multiline="true" contentEditable suppressContentEditableWarning
                          onInput={updateJournalContent}
                          onPaste={event => {
                            event.preventDefault();
                            const pasted = event.clipboardData.getData("text/plain");
                            const target = event.target as HTMLElement;
                            if (!pasted) return;
                            if (target.closest(".markdown-code-block")) document.execCommand("insertText", false, pasted);
                            else document.execCommand("insertHTML", false, markdownToHtml(pasted));
                            updateJournalContent();
                          }}
                          onDrop={event => {
                            event.preventDefault();
                            const dropped = event.dataTransfer.getData("text/plain");
                            const target = event.target as HTMLElement;
                            if (!dropped) return;
                            if (target.closest(".markdown-code-block")) document.execCommand("insertText", false, dropped);
                            else document.execCommand("insertHTML", false, markdownToHtml(dropped));
                            updateJournalContent();
                          }}
                          onChange={event => {
                            const target = event.target as HTMLElement;
                            if (!(target instanceof HTMLSelectElement) || !target.classList.contains("markdown-code-language")) return;
                            const block = target.closest<HTMLElement>(".markdown-code-block");
                            if (!block) return;
                            block.dataset.language = target.value;
                            updateJournalContent();
                          }}
                          onBlur={event => {
                            const editor = editorRef.current;
                            const nextTarget = event.relatedTarget as Node | null;
                            if (!editor || (nextTarget && editor.contains(nextTarget))) return;
                            highlightCodeBlocks(editor);
                            updateJournalContent();
                          }}
                        />
                      </>
                    )}
                  </div>
                </section>

                <div className="diary-bottom-panels">
                  <section className="diary-small-writing-panel">
                    <div className="section-heading"><span>메모</span><small>MEMO</small></div>
                    <textarea aria-label="오늘의 메모" value={entry.memo} onChange={event => updateEntry({ memo: event.target.value })}/>
                  </section>
                  <section className="diary-small-writing-panel">
                    <div className="section-heading"><span>하루 돌아보기</span><small>REFLECTION</small></div>
                    <textarea aria-label="하루 돌아보기" value={entry.reflection} onChange={event => updateEntry({ reflection: event.target.value })}/>
                  </section>
                </div>
              </section>
            </PlannerSpread>
          </div>
        </div>
      </main>

      <input ref={imageInputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => void uploadImage(event)}/>

      {choiceOpen ? (
        <div className="modal-backdrop picture-diary-choice-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setChoiceOpen(false); }}>
          <section className="picture-diary-choice-modal" role="dialog" aria-modal="true" aria-labelledby="picture-diary-choice-title">
            <div className="picture-diary-choice-header">
              <div><span className="eyebrow">ADD YOUR ART</span><h2 id="picture-diary-choice-title">그림을 어떻게 추가할까요?</h2></div>
              <button type="button" className="icon-btn" aria-label="닫기" onClick={() => setChoiceOpen(false)}><X size={19}/></button>
            </div>
            <div className="picture-diary-choice-options">
              <button type="button" onClick={requestSketch}>
                <span className="picture-diary-choice-icon"><Brush size={23}/></span>
              </button>
              <button type="button" onClick={() => { setChoiceOpen(false); imageInputRef.current?.click(); }}>
                <span className="picture-diary-choice-icon"><ImagePlus size={23}/></span>
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {sketchOpen ? (
        <SketchWorkspace key={date} initialDocument={entry.drawing_state ?? createEmptySketchDocument()} onSave={saveSketch} onClose={() => setSketchOpen(false)}/>
      ) : null}
    </div>
  );
}
