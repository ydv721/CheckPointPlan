"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { BookOpen, BookText, CalendarDays, CheckSquare, Plus, Clock3, Trash2, Pencil, Check, X, CheckCircle2 } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import type { NotebookType } from "@/components/NotebookTypeSelection";
import { defaultCover, themes, type Cover, type ThemeName } from "@/lib/types";

export type NotebookRecord = {
  id: string;
  notebook_type: NotebookType;
  title: string;
  created_at: string;
  updated_at: string;
  theme?: ThemeName;
  custom_color?: string;
  cover?: Cover;
};

type Props = {
  email: string;
  themeStyle: CSSProperties;
  darkMode: boolean;
  onDarkModeChange: (enabled: boolean) => void;
  notebooks: NotebookRecord[];
  coverPhotoUrls: Record<string, string>;
  loading: boolean;
  notice: string;
  onCreate: () => void;
  onOpen: (notebook: NotebookRecord) => void;
  onDelete: (notebook: NotebookRecord) => Promise<boolean>;
  onRename: (notebook: NotebookRecord, title: string) => Promise<boolean>;
  onSignOut: () => void;
  onDeleteAccount: () => void;
};

const TYPES: Record<NotebookType,{label:string;description:string;icon:typeof BookOpen}> = {
  planner:{label:"플래너",description:"월간 · 일간 · 일정 관리",icon:CalendarDays},
  "study-notes":{label:"필기 다이어리",description:"공부 · 강의 · 지식 정리",icon:BookText},
  diary:{label:"일기",description:"하루의 기록 · 일상",icon:BookOpen},
  checklist:{label:"체크리스트",description:"할 일 · 목표 · 점검",icon:CheckSquare},
  "free-notes":{label:"프리 다이어리",description:"Markdown · 자유로운 글쓰기",icon:BookText}
};

function dateLabel(value:string) {
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"":new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"long",day:"numeric"}).format(date);
}

function NotebookCoverPreview({notebook,photoUrls}:{notebook:NotebookRecord;photoUrls:Record<string,string>}) {
  const cover=notebook.cover??defaultCover;
  const theme=notebook.theme??"blue";
  const customColor=/^#[0-9a-fA-F]{6}$/.test(notebook.custom_color??"")?notebook.custom_color!:themes.custom.cover;
  const palette=theme==="custom"?{...themes.custom,cover:customColor}:themes[theme];
  const activePattern=cover.backgroundPattern??"grid";
  const patternThickness=typeof cover.patternThickness==="number"?Math.min(8,Math.max(1,cover.patternThickness)):2;
  const patternColor=cover.patternColor||(theme==="white"?"#788393":theme==="black"?"#A9B4D5":"#FFFFFF");
  const items=Array.isArray(cover.items)?cover.items:[];
  const artStyle={
    "--cover":cover.backgroundColor||palette.cover,
    "--cover-ink":palette.coverInk
  } as CSSProperties;
  const patternStyle={
    "--pattern-color":patternColor,
    "--pattern-thickness":(patternThickness*.48)+"px",
    "--pattern-frame-border":((6+patternThickness*2)*.48)+"px",
    "--pattern-frame-bottom":((6+patternThickness*2)*4.4*.48)+"px",
    "--pattern-preview-frame-border":((3+patternThickness)*.48)+"px",
    "--pattern-preview-frame-bottom":((6+patternThickness*2)*.48)+"px"
  } as CSSProperties;

  return <span className={`notebook-book-cover-art cover-art cover-${theme}`} style={artStyle} aria-hidden="true">
    {cover.backgroundImage&&photoUrls[cover.backgroundImage]&&<img className="cover-background-image" src={photoUrls[cover.backgroundImage]} alt="" draggable={false} style={{objectPosition:(cover.backgroundPositionX??50)+"% "+(cover.backgroundPositionY??50)+"%"}}/>}
    {activePattern!=="none"&&<span className={`cover-pattern-layer cover-pattern-${activePattern}`} style={patternStyle}/>}
    <span className="cover-signature">
      <svg className="cover-signature-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="3.5" y="5" width="21" height="21" rx="6.5" stroke="currentColor" strokeWidth="1.8"/>
        <path d="m9 15.5 4.1 4 7.4-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M26 2.5c.45 1.65 1.1 2.3 2.7 2.75-1.6.45-2.25 1.1-2.7 2.75-.45-1.65-1.1-2.3-2.7-2.75 1.6-.45 2.25-1.1 2.7-2.75Z" fill="currentColor"/>
      </svg>
      <span className="cover-signature-text">YOUR PACE, YOUR CHECKPOINT</span>
    </span>
    {items.map(item=>{
      const rotation=Number(item.rotation??0);
      const itemStyle:CSSProperties={
        left:String(item.x)+"%",
        top:String(item.y)+"%",
        fontSize:Math.max(4,(item.size??12)*.48),
        transform:"translate(-50%,-50%)",
        rotate:Number.isFinite(rotation)&&rotation!==0?String(rotation)+"deg":"none",
        ...(item.kind==="text"?{
          width:String(item.width??76)+"%",
          height:String(item.height??20)+"%",
          color:item.color||undefined,
          fontWeight:item.weight??800
        }:{})
      };
      return <span key={item.id} className={"placed-sticker placed-object "+(item.kind==="text"?"placed-text":"placed-decor")} style={itemStyle}>
        {item.kind==="text"
          ? <span className="placed-text-content">{item.value}</span>
          : item.kind==="photo"
            ? (photoUrls[item.value]?<img src={photoUrls[item.value]} alt="" draggable={false}/>:null)
            : <span className="placed-sticker-content">{item.value}</span>}
      </span>;
    })}
  </span>;
}

export default function NotebookLibrary({email,themeStyle,darkMode,onDarkModeChange,notebooks,coverPhotoUrls,loading,notice,onCreate,onOpen,onDelete,onRename,onSignOut,onDeleteAccount}:Props) {
  const [deleteTarget,setDeleteTarget]=useState<NotebookRecord|null>(null);
  const [deleting,setDeleting]=useState(false);
  const [deleteToast,setDeleteToast]=useState<{message:string;id:number}|null>(null);
  const [renameTargetId,setRenameTargetId]=useState<string|null>(null);
  const [renameValue,setRenameValue]=useState("");
  const [renaming,setRenaming]=useState(false);
  const [renameError,setRenameError]=useState("");

  function startRename(notebook:NotebookRecord){
    setRenameTargetId(notebook.id);
    setRenameValue(notebook.title);
    setRenameError("");
  }

  function cancelRename(){
    if(renaming)return;
    setRenameTargetId(null);
    setRenameValue("");
    setRenameError("");
  }

  async function saveRename(notebook:NotebookRecord){
    if(renaming)return;
    const nextTitle=renameValue.trim();
    if(!nextTitle){
      setRenameError("이름을 입력해 줘.");
      return;
    }
    if(nextTitle===notebook.title){
      cancelRename();
      return;
    }
    setRenaming(true);
    setRenameError("");
    try{
      const saved=await onRename(notebook,nextTitle);
      if(saved){
        setRenameTargetId(null);
        setRenameValue("");
      }
    }finally{
      setRenaming(false);
    }
  }

  useEffect(()=>{
    if(!deleteToast)return;
    const timeoutId=window.setTimeout(()=>setDeleteToast(null),3000);
    return()=>window.clearTimeout(timeoutId);
  },[deleteToast]);

  useEffect(()=>{
    if(!deleteTarget)return;
    const closeOnEscape=(event:KeyboardEvent)=>{
      if(event.key==="Escape"&&!deleting)setDeleteTarget(null);
    };
    document.addEventListener("keydown",closeOnEscape);
    return()=>document.removeEventListener("keydown",closeOnEscape);
  },[deleteTarget,deleting]);

  async function confirmDelete(){
    if(!deleteTarget||deleting)return;
    setDeleting(true);
    try{
      const deleted=await onDelete(deleteTarget);
      if(deleted){
        setDeleteToast({message:`'${deleteTarget.title}' 다이어리를 삭제했습니다.`,id:Date.now()});
        setDeleteTarget(null);
      }
    }finally{
      setDeleting(false);
    }
  }

  return (
    <div className="notebook-library-shell" data-theme={darkMode ? "dark" : "light"} style={themeStyle}>
      <header className="notebook-library-header">
        <div className="notebook-library-brand">
          <span className="brand-icon"><BookOpen size={18}/></span>
          <span><strong>CHECKPOINT</strong><small>YOUR PACE, YOUR CHECKPOINT</small></span>
        </div>
        <AppSidebar
          email={email}
          currentView="library"
          themeStyle={themeStyle}
          darkMode={darkMode}
          onDarkModeChange={onDarkModeChange}
          onSignOut={onSignOut}
          onDeleteAccount={onDeleteAccount}
        />
      </header>
      <main className="notebook-library-main">
        <div className="notebook-library-heading">
          <div><span className="eyebrow">MY DIARIES</span><h1>내 다이어리</h1><p>나만의 기록을 한곳에서 관리해 보세요.</p></div>
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
              const hasSavedCover=Boolean(notebook.cover);
              const isRenaming=renameTargetId===notebook.id;
              return <div key={notebook.id} className={"notebook-book-card notebook-book-"+notebook.notebook_type}>
                <button type="button" className="notebook-book-open" onClick={()=>onOpen(notebook)}>
                  <span className={"notebook-book-cover"+(hasSavedCover?" has-saved-cover":"")}>
                    {hasSavedCover
                      ? <NotebookCoverPreview notebook={notebook} photoUrls={coverPhotoUrls}/>
                      : <>
                          <span className="notebook-book-binding" aria-hidden="true"/>
                          <span className="notebook-book-mark"><Icon size={27}/></span>
                          <strong>{notebook.title}</strong>
                          <small>{meta.label.toUpperCase()}</small>
                          <span className="notebook-book-lines" aria-hidden="true"><i/><i/><i/></span>
                        </>}
                    {hasSavedCover?<span className="notebook-book-binding" aria-hidden="true"/>:null}
                  </span>
                </button>
                <div className="notebook-book-info">
                  {isRenaming?(
                    <form
                      className="notebook-book-rename"
                      onSubmit={event=>{
                        event.preventDefault();
                        void saveRename(notebook);
                      }}
                    >
                      <input
                        type="text"
                        value={renameValue}
                        maxLength={60}
                        autoFocus
                        aria-label="다이어리 이름"
                        disabled={renaming}
                        onChange={event=>{
                          setRenameValue(event.target.value);
                          setRenameError("");
                        }}
                        onKeyDown={event=>{
                          if(event.key==="Escape"){
                            event.preventDefault();
                            cancelRename();
                          }
                        }}
                      />
                      <button type="submit" aria-label="이름 저장" title="저장" disabled={renaming||!renameValue.trim()}>
                        <Check size={15}/>
                      </button>
                      <button type="button" aria-label="이름 변경 취소" title="취소" disabled={renaming} onClick={cancelRename}>
                        <X size={15}/>
                      </button>
                    </form>
                  ):(
                    <button
                      type="button"
                      className="notebook-book-title"
                      title="클릭해서 이름 변경"
                      aria-label={notebook.title+" 이름 변경"}
                      onClick={()=>startRename(notebook)}
                    >
                      <span>{notebook.title}</span>
                      <Pencil className="notebook-book-title-edit" size={13}/>
                    </button>
                  )}
                  {renameError&&isRenaming?<span className="notebook-book-rename-error" role="alert">{renameError}</span>:null}
                  <small>{meta.description}</small>
                  <small className="notebook-book-date"><Clock3 size={11}/> {dateLabel(notebook.updated_at)}</small>
                </div>
                <button
                  type="button"
                  className="notebook-book-delete"
                  aria-label={notebook.title+" 다이어리 삭제"}
                  title="다이어리 삭제"
                  onClick={()=>setDeleteTarget(notebook)}
                >
                  <Trash2 size={16}/>
                </button>
              </div>;
            })}
            <button type="button" className="notebook-book-add" onClick={onCreate}>
              <span><Plus size={27}/></span><strong>새 다이어리</strong>
            </button>
          </div>
        )}
      </main>
      {deleteToast?(
        <div className="notebook-delete-toast" role="status" aria-live="polite">
          <CheckCircle2 className="notebook-delete-toast-icon" size={19}/>
          <span>{deleteToast.message}</span>
        </div>
      ):null}
      {deleteTarget?(
        <div
          className="modal-backdrop notebook-delete-backdrop"
          role="presentation"
          onMouseDown={event=>{
            if(event.target===event.currentTarget&&!deleting)setDeleteTarget(null);
          }}
        >
          <section className="delete-account-modal notebook-delete-modal" role="dialog" aria-modal="true" aria-labelledby="notebook-delete-title" aria-describedby="notebook-delete-description">
            <div className="delete-account-icon"><Trash2 size={22}/></div>
            <h2 id="notebook-delete-title">다이어리를 삭제할까요?</h2>
            <p id="notebook-delete-description">&apos;{deleteTarget.title}&apos; 다이어리와 저장된 기록이 함께 삭제됩니다. 삭제한 내용은 복구할 수 없습니다.</p>
            <div className="delete-account-actions">
              <button type="button" className="outline-btn" disabled={deleting} onClick={()=>setDeleteTarget(null)}>취소</button>
              <button type="button" className="delete-confirm-btn" disabled={deleting} onClick={()=>void confirmDelete()}>
                {deleting?"삭제 중...":"다이어리 삭제"}
              </button>
            </div>
          </section>
        </div>
      ):null}
    </div>
  );
}
