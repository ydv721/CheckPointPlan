"use client";

import { BookOpen, BookText, CalendarDays, CheckSquare, Plus, LogOut, Clock3 } from "lucide-react";
import type { NotebookType } from "@/components/NotebookTypeSelection";

export type NotebookRecord = {
  id: string;
  notebook_type: NotebookType;
  title: string;
  created_at: string;
  updated_at: string;
};

type Props = {
  email: string;
  notebooks: NotebookRecord[];
  loading: boolean;
  notice: string;
  onCreate: () => void;
  onOpen: (notebook: NotebookRecord) => void;
  onSignOut: () => void;
};

const TYPES: Record<NotebookType,{label:string;description:string;icon:typeof BookOpen}> = {
  planner:{label:"플래너",description:"월간 · 일간 · 일정 관리",icon:CalendarDays},
  "study-notes":{label:"필기 노트",description:"공부 · 강의 · 지식 정리",icon:BookText},
  diary:{label:"일기",description:"하루의 기록 · 일상",icon:BookOpen},
  checklist:{label:"체크리스트",description:"할 일 · 목표 · 점검",icon:CheckSquare},
  "free-notes":{label:"프리 노트",description:"Markdown · 자유로운 글쓰기",icon:BookText}
};

function dateLabel(value:string) {
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"":new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"long",day:"numeric"}).format(date);
}

export default function NotebookLibrary({email,notebooks,loading,notice,onCreate,onOpen,onSignOut}:Props) {
  return (
    <div className="notebook-library-shell">
      <header className="notebook-library-header">
        <div className="notebook-library-brand">
          <span className="brand-icon"><BookOpen size={18}/></span>
          <span><strong>CHECKPOINT</strong><small>YOUR PACE, YOUR CHECKPOINT</small></span>
        </div>
        <div className="notebook-library-account">
          <span>{email}</span>
          <button type="button" onClick={onSignOut}><LogOut size={15}/> 로그아웃</button>
        </div>
      </header>
      <main className="notebook-library-main">
        <div className="notebook-library-heading">
          <div><span className="eyebrow">MY NOTEBOOKS</span><h1>내 다이어리</h1><p>나만의 기록을 한곳에서 관리해 보세요.</p></div>
          <button type="button" className="primary-btn notebook-library-create" onClick={onCreate}><Plus size={18}/> 새 다이어리</button>
        </div>
        {notice?<div className="notebook-library-notice" role="status">{notice}</div>:null}
        {loading?<div className="notebook-library-empty">다이어리를 불러오는 중입니다...</div>:notebooks.length===0?(
          <div className="notebook-library-empty">
            <div className="notebook-library-empty-icon"><BookOpen size={30}/></div>
            <strong>아직 만든 다이어리가 없어요.</strong>
            <span>첫 다이어리를 만들어 기록을 시작해 보세요.</span>
            <button type="button" className="primary-btn" onClick={onCreate}><Plus size={17}/> 첫 다이어리 만들기</button>
          </div>
        ):(
          <div className="notebook-library-grid">
            {notebooks.map(notebook=>{
              const meta=TYPES[notebook.notebook_type];
              const Icon=meta.icon;
              return <button type="button" key={notebook.id} className={"notebook-book-card notebook-book-"+notebook.notebook_type} onClick={()=>onOpen(notebook)}>
                <span className="notebook-book-cover">
                  <span className="notebook-book-binding" aria-hidden="true"/>
                  <span className="notebook-book-mark"><Icon size={27}/></span>
                  <strong>{notebook.title}</strong>
                  <small>{meta.label.toUpperCase()}</small>
                  <span className="notebook-book-lines" aria-hidden="true"><i/><i/><i/></span>
                </span>
                <span className="notebook-book-info"><strong>{notebook.title}</strong><small>{meta.description}</small><small className="notebook-book-date"><Clock3 size={11}/> {dateLabel(notebook.updated_at)}</small></span>
              </button>;
            })}
            <button type="button" className="notebook-book-add" onClick={onCreate}>
              <span><Plus size={27}/></span><strong>새 다이어리</strong>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
