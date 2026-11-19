"use client";

import type { CSSProperties } from "react";
import { Check, ChevronRight, LogOut } from "lucide-react";

export type NotebookType = "planner" | "study-notes" | "diary" | "checklist" | "free-notes";

const NOTEBOOK_TYPES: { type: NotebookType; title: string; description: string }[] = [
  { type: "planner", title: "플래너", description: "월간 · 일간 · 일정 관리" },
  { type: "study-notes", title: "필기 노트", description: "공부 · 강의 · 지식 정리" },
  { type: "diary", title: "일기", description: "하루의 기록 · 일상" },
  { type: "checklist", title: "체크리스트", description: "할 일 · 목표 · 점검" },
  { type: "free-notes", title: "프리 노트", description: "Markdown · 자유로운 글쓰기 · 메모" }
];

type NotebookTypeSelectionProps = {
  email: string;
  themeStyle: CSSProperties;
  selectedType: NotebookType | null;
  notice: string;
  onSelect: (type: NotebookType) => void;
  onContinue: (type: NotebookType) => void;
  onSignOut: () => void;
};

export default function NotebookTypeSelection({
  email,
  themeStyle,
  selectedType,
  notice,
  onSelect,
  onContinue,
  onSignOut
}: NotebookTypeSelectionProps) {
  return (
    <div className="notebook-select-shell" style={themeStyle}>
      <header className="notebook-select-header">
        <div className="notebook-select-brand">
          <span className="brand-icon"><Check size={18} strokeWidth={3} /></span>
          <span className="notebook-select-brand-copy">
            <strong>CHECKPOINT</strong>
            <small>YOUR PACE, YOUR CHECKPOINT</small>
          </span>
        </div>
        <div className="notebook-select-account">
          <span className="notebook-select-email">{email}</span>
          <button type="button" onClick={onSignOut}><LogOut size={15} /> 로그아웃</button>
        </div>
      </header>

      <main className="notebook-select-main">
        <div className="notebook-select-heading">
          <span className="eyebrow">CHOOSE YOUR NOTEBOOK</span>
          <h1>어떤 노트를 만들까요?</h1>
          <p>기록할 목적에 맞는 노트 종류를 선택해 주세요.</p>
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
          <p>노트 하나에는 한 가지 유형을 선택해 관리해요.</p>
          <button
            type="button"
            className="primary-btn notebook-select-continue"
            disabled={!selectedType}
            onClick={() => selectedType && onContinue(selectedType)}
          >
            {selectedType === "planner" ? "플래너 열기" : "선택 완료"}
            <ChevronRight size={17} />
          </button>
        </div>
        {notice ? <p className="notebook-type-notice" role="status">{notice}</p> : null}
      </main>
    </div>
  );
}
