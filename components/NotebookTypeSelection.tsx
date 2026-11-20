"use client";

import { useEffect, type CSSProperties } from "react";
import { ArrowRight, X } from "lucide-react";

export type NotebookType = "planner" | "study-notes" | "diary" | "checklist" | "free-notes";

const NOTEBOOK_TYPES: { type: NotebookType; title: string; description: string }[] = [
  { type: "planner", title: "플래너", description: "월간 · 일간 · 일정 관리" },
  { type: "study-notes", title: "필기 다이어리", description: "공부 · 강의 · 지식 정리" },
  { type: "diary", title: "일기", description: "하루의 기록 · 일상" },
  { type: "checklist", title: "체크리스트", description: "할 일 · 목표 · 점검" },
  { type: "free-notes", title: "프리 다이어리", description: "Markdown · 자유로운 글쓰기" }
];

type NotebookTypeSelectionProps = {
  themeStyle: CSSProperties;
  notice: string;
  creating: boolean;
  onContinue: (type: NotebookType) => void;
  onClose: () => void;
};

export default function NotebookTypeSelection({
  themeStyle,
  notice,
  creating,
  onContinue,
  onClose
}: NotebookTypeSelectionProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !creating) onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [creating, onClose]);

  return (
    <div
      className="modal-backdrop notebook-type-backdrop"
      style={themeStyle}
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !creating) onClose();
      }}
    >
      <section
        className="notebook-type-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notebook-type-title"
        aria-busy={creating}
      >
        <div className="notebook-type-modal-header">
          <div className="notebook-select-heading">
            <span className="eyebrow">CHOOSE YOUR DIARY</span>
            <h2 id="notebook-type-title">어떤 다이어리를 만들까요?</h2>
            <p>원하는 다이어리 종류를 누르면 바로 만들어져요.</p>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="닫기"
            disabled={creating}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="notebook-type-list" aria-label="다이어리 종류">
          {NOTEBOOK_TYPES.map(option => (
            <button
              type="button"
              className="notebook-type-option"
              key={option.type}
              disabled={creating}
              onClick={() => onContinue(option.type)}
            >
              <span className="notebook-type-copy">
                <strong>{option.title}</strong>
                <span>{option.description}</span>
              </span>
              <ArrowRight className="notebook-type-arrow" size={19} aria-hidden="true" />
            </button>
          ))}
        </div>
        {notice ? <p className="notebook-type-notice" role="status">{notice}</p> : null}
      </section>
    </div>
  );
}
