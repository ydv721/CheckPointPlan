"use client";

import { useEffect, type CSSProperties } from "react";
import { Check, ChevronRight, X } from "lucide-react";

export type NotebookType = "planner" | "study-notes" | "diary" | "checklist" | "free-notes";

const NOTEBOOK_TYPES: { type: NotebookType; title: string; description: string }[] = [
  { type: "planner", title: "플래너", description: "월간 · 일간 · 일정 관리" },
  { type: "study-notes", title: "필기 노트", description: "공부 · 강의 · 지식 정리" },
  { type: "diary", title: "일기", description: "하루의 기록 · 일상" },
  { type: "checklist", title: "체크리스트", description: "할 일 · 목표 · 점검" },
  { type: "free-notes", title: "프리 노트", description: "Markdown · 자유로운 글쓰기 · 메모" }
];

type NotebookTypeSelectionProps = {
  themeStyle: CSSProperties;
  selectedType: NotebookType | null;
  notice: string;
  creating: boolean;
  onSelect: (type: NotebookType) => void;
  onContinue: (type: NotebookType) => void;
  onClose: () => void;
};

export default function NotebookTypeSelection({
  themeStyle,
  selectedType,
  notice,
  creating,
  onSelect,
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
      >
        <div className="notebook-type-modal-header">
          <div className="notebook-select-heading">
            <span className="eyebrow">CHOOSE YOUR NOTEBOOK</span>
            <h2 id="notebook-type-title">어떤 노트를 만들까요?</h2>
            <p>기록할 목적에 맞는 노트 종류를 선택해 주세요.</p>
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

        <div className="notebook-type-list" role="radiogroup" aria-label="노트 종류 선택">
          {NOTEBOOK_TYPES.map(option => {
            const selected = selectedType === option.type;
            return (
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                className={selected ? "notebook-type-option selected" : "notebook-type-option"}
                key={option.type}
                disabled={creating}
                onClick={() => onSelect(option.type)}
              >
                <span className="notebook-type-copy">
                  <strong>{option.title}</strong>
                  <span>{option.description}</span>
                </span>
                <span className="notebook-type-indicator" aria-hidden="true">
                  {selected ? <Check size={14} strokeWidth={3} /> : null}
                </span>
              </button>
            );
          })}
        </div>

        <div className="notebook-select-footer">
          <button
            type="button"
            className="primary-btn notebook-select-continue"
            disabled={!selectedType || creating}
            onClick={() => selectedType && onContinue(selectedType)}
          >
            {creating ? "만드는 중..." : selectedType === "planner" ? "플래너 열기" : "선택 완료"}
            <ChevronRight size={17} />
          </button>
        </div>
        {notice ? <p className="notebook-type-notice" role="status">{notice}</p> : null}
      </section>
    </div>
  );
}
