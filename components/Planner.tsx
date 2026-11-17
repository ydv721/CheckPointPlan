"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type PointerEvent } from "react";
import type { User } from "@supabase/supabase-js";
import {
  ArrowLeft, BookOpen, CalendarDays, Check, ChevronDown,
  Expand, ImagePlus, LogOut, Menu, Plus, RotateCw,
  Sparkles, Trash2, X, CircleHelp, CheckCircle2, Palette
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { defaultCover, emptyEntry, STICKERS, themes, type Cover, type CoverItem, type CoverPattern, type Entry, type FocusItem, type ThemeName, type Todo, type TodoStatus } from "@/lib/types";

const HOURS = [...Array.from({ length: 18 }, (_, i) => i + 6), 0, 1, 2, 3, 4, 5];
const TIMES = ["00", "10", "20", "30", "40", "50"];
const PENS = ["#F4B8CA", "#F6E39A", "#CDE7B8", "#B9D8F4", "#CDBDEB"];
const COVER_PATTERNS: {value:CoverPattern;label:string}[] = [
  {value:"none",label:"없음"},
  {value:"grid",label:"모눈"},
  {value:"dots",label:"도트"},
  {value:"stripes",label:"스트라이프"},
  {value:"polaroid",label:"폴라로이드"}
];
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const dateView = (date: string) => {
  const [y,m,d] = date.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일 ${DAYS[new Date(y,m-1,d).getDay()]}요일`;
};
const sanitizeHex = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s) ? s : "#8b9ec4";
const isCoverBrandSlogan = (item: CoverItem) =>
  item.kind === "text" &&
  item.value.trim().replace(/[.!?]+$/, "").replace(/\s+/g, " ").toUpperCase() === "YOUR PACE, YOUR CHECKPOINT";

function parseFocusItems(raw: unknown): FocusItem[] {
  const makeBlankRows = (items: FocusItem[]) => {
    const rows = items.slice(0, 30);
    while (rows.length < 5) rows.push({ id: uid(), text: "", checked: false });
    return rows;
  };
  if (typeof raw !== "string" || !raw.trim()) return makeBlankRows([]);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const rows = parsed.flatMap((item, index): FocusItem[] => {
        if (typeof item === "string") return [{ id: uid(), text: item, checked: false }];
        if (!item || typeof item !== "object") return [];
        const value = item as Partial<FocusItem>;
        if (typeof value.text !== "string") return [];
        return [{ id: typeof value.id === "string" && value.id ? value.id : `focus-${index + 1}-${uid()}`, text: value.text, checked: value.checked === true }];
      });
      return makeBlankRows(rows);
    }
  } catch {
    // Older planner entries contain plain text rather than a JSON list.
  }
  const legacyRows = raw.split(/\r?\n/).filter(line => line.trim()).map(text => ({ id: uid(), text, checked: false }));
  return makeBlankRows(legacyRows);
}

function parseFreeNote(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return "";
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const rows = parsed.flatMap((item): string[] => {
        if (typeof item === "string") return [item];
        if (item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string") return [(item as { text: string }).text];
        return [];
      });
      while (rows.length && !rows[rows.length - 1].trim()) rows.pop();
      return rows.join("\n");
    }
  } catch {
    // Existing plain-text notes are kept as written.
  }
  return raw.replace(/^\s*[-•]\s?/gm, "");
}
const setOpacity = (hex: string, opacity: number) => {
  const a = sanitizeHex(hex);
  const r=parseInt(a.slice(1,3),16),g=parseInt(a.slice(3,5),16),b=parseInt(a.slice(5,7),16);
  return `rgba(${r},${g},${b},${opacity})`;
};

function AppIcon() {
  return <span className="brand-icon"><Check size={18} strokeWidth={3}/></span>;
}

function AuthBookCover() {
  return <div className="auth-cover">
    <span className="auth-sticker auth-star">✳</span><span className="auth-sticker auth-heart">♡</span>
    <div className="auth-cover-center"><span>YOUR LITTLE STUDY JOURNAL</span><h1>CHECK<br/>POINT<span className="gold-dot">.</span></h1>
      <p>YOUR PACE, YOUR CHECKPOINT.</p></div>
    <div className="auth-bottom">A PLACE TO BEGIN AGAIN — EVERY DAY.</div>
  </div>;
}

function AuthScreen({ onUser }: { onUser: (u: User) => void }) {
  const [mode,setMode]=useState<"login"|"signup">("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const client=supabase();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(!client) return;
    setBusy(true); setMessage("");
    try {
      if(mode==="signup") {
        const {data,error}=await client.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:"https://checkpoint-plan.vercel.app/email-confirmed"}});
        if(error) throw error;
        if(data.session?.user) onUser(data.session.user);
        else setMessage("인증 메일을 보냈습니다. 받은편지함에서 이메일 인증을 완료한 후 로그인해 주세요.");
      } else {
        const {data,error}=await client.auth.signInWithPassword({email:email.trim(),password});
        if(error) throw error;
        if(data.user) onUser(data.user);
      }
    } catch(err) {
      setMessage(err instanceof Error ? err.message : "로그인 중 문제가 발생했습니다.");
    } finally {setBusy(false);}
  }
  return <div className="auth-wrap">
    <div className="auth-left">
      <div className="auth-book">
        <AuthBookCover/>
      </div>
    </div>
    <div className="auth-right">
      <div className="auth-brand">
        <span className="brand-lockup"><AppIcon/><span>CHECKPOINT</span></span>
        <small>YOUR PACE, YOUR CHECKPOINT</small>
      </div>
      <div className="auth-card">
      <div className="eyebrow">WELCOME TO YOUR SPACE</div>
      <h2>{mode==="login"?"다시 시작하는 오늘":"나만의 플래너 시작하기"}</h2>
      <p className="sub">하루를 가볍게 기록해 보세요.</p>
      {!client ? <div className="alert error">Supabase 연결 정보가 없습니다. <code>.env.local</code> 파일에 환경변수를 설정해 주세요.</div> : null}
      <form onSubmit={submit} className="auth-form">
        <label>이메일<input type="email" autoComplete="email" placeholder="name@example.com" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
        <label>비밀번호<input type="password" placeholder="6자 이상 입력해 주세요." autoComplete={mode==="login"?"current-password":"new-password"} minLength={6} value={password} onChange={e=>setPassword(e.target.value)} required/></label>
        {message&&<div className="alert" role="status">{message}</div>}
        <button disabled={busy||!client} className="primary-btn auth-submit" type="submit">{busy?"처리 중입니다...":mode==="login"?"로그인":"회원가입"}</button>
      </form>
      <div className="auth-switch">{mode==="login"?"아직 계정이 없으신가요?":"이미 계정이 있으신가요?"}
        <button type="button" onClick={()=>{setMode(v=>v==="login"?"signup":"login");setMessage("");}}>{mode==="login"?"회원가입":"로그인"}</button>
      </div>
      <div className="auth-footnote"><Sparkles size={14}/> 매일 완벽하지 않아도 괜찮아요. 멈췄던 곳에서 언제든 다시 시작할 수 있어요.</div>
    </div></div>
  </div>;
}

function Timetable({ value, onChange, highlighter, tool }: {
  value: Record<string,string>; onChange:(v:Record<string,string>)=>void;
  highlighter:string; tool:"paint"|"erase";
}) {
  const drawing=useRef(false);
  const eraseCurrent=useRef(false);
  const valueRef=useRef(value);
  useEffect(()=>{valueRef.current=value;},[value]);
  const apply=useCallback((key:string,erase:boolean)=>{
    const next=Object.fromEntries(Object.entries({...valueRef.current,[key]:erase?"":highlighter}).filter(([,c])=>!!c));
    valueRef.current=next;
    onChange(next);
  },[highlighter,onChange]);
  const start=(key:string,e:PointerEvent<HTMLButtonElement>)=>{
    e.preventDefault(); drawing.current=true;
    eraseCurrent.current=tool==="erase"||valueRef.current[key]===highlighter;
    apply(key,eraseCurrent.current);
  };
  const over=(key:string)=>{if(drawing.current)apply(key,eraseCurrent.current);};
  useEffect(()=>{
    const stop=()=>{drawing.current=false;};
    window.addEventListener("pointerup",stop);window.addEventListener("pointercancel",stop);
    return()=>{window.removeEventListener("pointerup",stop);window.removeEventListener("pointercancel",stop);};
  },[]);
  return <div className="time-grid-wrap"><div className="time-table" aria-label="시간표: 누르거나 드래그하여 색칠할 수 있습니다.">
    <div className="time-head">시</div>{TIMES.map(m=><div className="time-head" key={m}>{m}</div>)}
    {HOURS.map((h,row)=><div className="time-row" key={`r-${row}`}>
      <div className="time-hour">{String(h).padStart(2,"0")}</div>
      {TIMES.map((m,col)=>{
        const key=`${row}-${col}`;const color=value[key];
        return <button key={key} type="button" className="time-cell" aria-label={`${String(h).padStart(2,"0")}:${m} ${color?"색칠됨":"비어 있음"}`}
          aria-pressed={Boolean(color)} style={{background:color||undefined}} onPointerDown={e=>start(key,e)} onPointerEnter={()=>over(key)} />;
      })}
    </div>)}
  </div></div>;
}

function CoverPage({cover,setCover,theme,handleUpload,photoUrls}: {
  cover:Cover;setCover:React.Dispatch<React.SetStateAction<Cover>>;
  theme:ThemeName;handleUpload:(file:File,asBackground?:boolean)=>Promise<void>;photoUrls:Record<string,string>;
}) {
  const fileInput=useRef<HTMLInputElement>(null);
  const backgroundInput=useRef<HTMLInputElement>(null);
  const [patternMenuOpen,setPatternMenuOpen]=useState(false);
  const backgroundPanRef=useRef<{pointerId:number;startX:number;startY:number;originX:number;originY:number;overflowX:number;overflowY:number}|null>(null);
  const activePattern:CoverPattern=cover.backgroundPattern??"grid";
  const patternColor=cover.patternColor||(theme==="white"?"#788393":theme==="black"?"#A9B4D5":"#FFFFFF");
  const patternLabel=COVER_PATTERNS.find(pattern=>pattern.value===activePattern)?.label??"모눈";
  type CoverInteraction =
    | {kind:"move";id:string;startX:number;startY:number;originX:number;originY:number;w:number;h:number}
    | {kind:"rotate";id:string;centerX:number;centerY:number;startAngle:number;originRotation:number}
    | {kind:"resize";id:string;centerX:number;centerY:number;startDistance:number;originSize:number;originWidth:number;originHeight:number};
  const [selectedItemId,setSelectedItemId]=useState<string|null>(null);
  const interactionRef=useRef<CoverInteraction|null>(null);
  const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));

  function startBackgroundPan(e:PointerEvent<HTMLImageElement>) {
    const image=e.currentTarget;
    if(!image.naturalWidth||!image.naturalHeight)return;
    const rect=image.getBoundingClientRect();
    const scale=Math.max(rect.width/image.naturalWidth,rect.height/image.naturalHeight);
    const overflowX=Math.max(0,image.naturalWidth*scale-rect.width);
    const overflowY=Math.max(0,image.naturalHeight*scale-rect.height);
    if(overflowX<1&&overflowY<1)return;
    e.preventDefault();
    backgroundPanRef.current={
      pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,
      originX:cover.backgroundPositionX??50,originY:cover.backgroundPositionY??50,
      overflowX,overflowY
    };
    image.setPointerCapture(e.pointerId);
  }
  function moveBackgroundPan(e:PointerEvent<HTMLImageElement>) {
    const active=backgroundPanRef.current;
    if(!active||active.pointerId!==e.pointerId)return;
    const backgroundPositionX=active.overflowX>0
      ?clamp(active.originX-(e.clientX-active.startX)/active.overflowX*100,0,100)
      :active.originX;
    const backgroundPositionY=active.overflowY>0
      ?clamp(active.originY-(e.clientY-active.startY)/active.overflowY*100,0,100)
      :active.originY;
    setCover(c=>({...c,backgroundPositionX,backgroundPositionY}));
  }
  function finishBackgroundPan(e:PointerEvent<HTMLImageElement>) {
    if(backgroundPanRef.current?.pointerId===e.pointerId)backgroundPanRef.current=null;
  }

  function addSticker(s:string) {
    const item:CoverItem={id:uid(),kind:"sticker",value:s,x:50,y:50,size:42,rotation:0};
    setCover(c=>({...c,items:[...c.items,item]}));
    setSelectedItemId(item.id);
  }
  function addText() {
    const item:CoverItem={id:uid(),kind:"text",value:"새 텍스트",x:50,y:58,size:16,rotation:0,width:76,height:20};
    setCover(c=>({...c,items:[...c.items,item]}));
    setSelectedItemId(item.id);
  }
  function pointerDown(e:PointerEvent<HTMLElement>,item:CoverItem) {
    if((e.target as HTMLElement).closest(".cover-object-handle"))return;
    const stage=e.currentTarget.closest(".cover-art") as HTMLElement|null;
    const p=stage?.getBoundingClientRect();if(!p)return;
    setSelectedItemId(item.id);
    interactionRef.current={kind:"move",id:item.id,startX:e.clientX,startY:e.clientY,originX:item.x,originY:item.y,w:p.width,h:p.height};
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function startRotate(e:PointerEvent<HTMLButtonElement>,item:CoverItem) {
    e.preventDefault();e.stopPropagation();
    const object=e.currentTarget.parentElement;
    const rect=object?.getBoundingClientRect();if(!rect)return;
    const centerX=rect.left+rect.width/2;
    const centerY=rect.top+rect.height/2;
    interactionRef.current={
      kind:"rotate",id:item.id,centerX,centerY,
      startAngle:Math.atan2(e.clientY-centerY,e.clientX-centerX),
      originRotation:item.rotation??0
    };
    setSelectedItemId(item.id);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function startResize(e:PointerEvent<HTMLButtonElement>,item:CoverItem) {
    e.preventDefault();e.stopPropagation();
    const object=e.currentTarget.parentElement;
    const rect=object?.getBoundingClientRect();if(!rect)return;
    const centerX=rect.left+rect.width/2;
    const centerY=rect.top+rect.height/2;
    const startDistance=Math.max(8,Math.hypot(e.clientX-centerX,e.clientY-centerY));
    interactionRef.current={
      kind:"resize",id:item.id,centerX,centerY,startDistance,
      originSize:item.size,originWidth:item.width??76,originHeight:item.height??20
    };
    setSelectedItemId(item.id);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function pointerMove(e:PointerEvent<HTMLElement>) {
    const active=interactionRef.current;if(!active)return;
    if(active.kind==="move") {
      setCover(c=>({...c,items:c.items.map(i=>i.id===active.id?{...i,
        x:clamp(active.originX+(e.clientX-active.startX)/active.w*100,2,98),
        y:clamp(active.originY+(e.clientY-active.startY)/active.h*100,2,98)}:i)}));
      return;
    }
    if(active.kind==="rotate") {
      const angle=Math.atan2(e.clientY-active.centerY,e.clientX-active.centerX);
      const delta=(angle-active.startAngle)*180/Math.PI;
      const rotation=((active.originRotation+delta+180)%360+360)%360-180;
      setCover(c=>({...c,items:c.items.map(i=>i.id===active.id?{...i,rotation}:i)}));
      return;
    }
    const distance=Math.hypot(e.clientX-active.centerX,e.clientY-active.centerY);
    const ratio=clamp(distance/active.startDistance,.25,3.5);
    setCover(c=>({...c,items:c.items.map(i=>{
      if(i.id!==active.id)return i;
      const size=clamp(active.originSize*ratio,8,120);
      if(i.kind!=="text")return {...i,size};
      return {
        ...i,size,
        width:clamp(active.originWidth*ratio,12,98),
        height:clamp(active.originHeight*ratio,8,94)
      };
    })}));
  }
  function finishInteraction() {
    interactionRef.current=null;
  }
  const updateItem=(id:string,patch:Partial<CoverItem>)=>setCover(c=>({...c,items:c.items.map(item=>item.id===id?{...item,...patch}:item)}));
  const removeItem=(id:string)=>{setCover(c=>({...c,items:c.items.filter(item=>item.id!==id)}));setSelectedItemId(current=>current===id?null:current);};

  return <section className="cover-layout">
    <div className="cover-stage"><div className="spiral-cover">
      <div className="spiral-binding">{Array.from({length:13},(_,i)=><span key={i}/>)}</div>
      <div className={`cover-art cover-${theme}`} style={{backgroundColor:cover.backgroundColor||undefined}} onPointerDown={e=>{if(e.target===e.currentTarget)setSelectedItemId(null);}}>
        {cover.backgroundImage&&photoUrls[cover.backgroundImage]&&<img className="cover-background-image" src={photoUrls[cover.backgroundImage]} alt="" draggable={false} style={{objectPosition:(cover.backgroundPositionX??50)+"% "+(cover.backgroundPositionY??50)+"%"}} onPointerDown={startBackgroundPan} onPointerMove={moveBackgroundPan} onPointerUp={finishBackgroundPan} onPointerCancel={finishBackgroundPan}/>}
        {activePattern!=="none"&&<div className={`cover-pattern-layer cover-pattern-${activePattern}`} style={{"--pattern-color":patternColor,"--pattern-thickness":(cover.patternThickness??2)+"px","--pattern-preview-thickness":Math.max(1,(cover.patternThickness??2)*0.45)+"px","--pattern-frame-border":(6+(cover.patternThickness??2)*2)+"px","--pattern-frame-bottom":((6+(cover.patternThickness??2)*2)*4.4)+"px","--pattern-preview-frame-border":(3+(cover.patternThickness??2))+"px","--pattern-preview-frame-bottom":(6+(cover.patternThickness??2)*2)+"px"} as CSSProperties} aria-hidden="true"/>}
        <div className="cover-signature" aria-label="CHECKPOINT — YOUR PACE, YOUR CHECKPOINT">
          <svg className="cover-signature-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect x="3.5" y="5" width="21" height="21" rx="6.5" stroke="currentColor" strokeWidth="1.8"/>
            <path d="m9 15.5 4.1 4 7.4-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M26 2.5c.45 1.65 1.1 2.3 2.7 2.75-1.6.45-2.25 1.1-2.7 2.75-.45-1.65-1.1-2.3-2.7-2.75 1.6-.45 2.25-1.1 2.7-2.75Z" fill="currentColor"/>
          </svg>
          <span className="cover-signature-text">YOUR PACE, YOUR CHECKPOINT</span>
        </div>
        {cover.items.map(item=>{
          const rotation=Number(item.rotation??0);
          const safeRotation=Number.isFinite(rotation)?rotation:0;
          const selected=selectedItemId===item.id;
          const itemStyle:CSSProperties={
            left:String(item.x)+"%",top:String(item.y)+"%",fontSize:item.size,
            transform:"translate(-50%,-50%)",
            rotate:safeRotation===0?"none":String(safeRotation)+"deg",
            ...(item.kind==="text"?{width:String(item.width??76)+"%",height:String(item.height??20)+"%",color:item.color||undefined,fontWeight:item.weight??800}:{})
          };
          return <div key={item.id}
            className={"placed-sticker placed-object "+(item.kind==="text"?"placed-text":"placed-decor")+(selected?" is-selected":"")}
            role="group" tabIndex={0}
            aria-label={item.kind==="text"?"텍스트":"표지 장식"}
            style={itemStyle}
            onPointerDown={e=>pointerDown(e,item)}
            onPointerMove={pointerMove}
            onPointerUp={finishInteraction}
            onPointerCancel={finishInteraction}
            onFocus={()=>setSelectedItemId(item.id)}>
            {item.kind==="text"
              ? <span className="placed-text-content">{item.value}</span>
              : item.kind==="photo"
                ? <img src={photoUrls[item.value]||""} alt="표지 장식 사진" draggable={false}/>
                : <span className="placed-sticker-content">{item.value}</span>}
            <button type="button" className="cover-object-handle cover-object-delete" aria-label="요소 삭제"
              onPointerDown={e=>{e.preventDefault();e.stopPropagation();}}
              onClick={e=>{e.stopPropagation();removeItem(item.id);}}>
              <Trash2 size={14}/>
            </button>
            <button type="button" className="cover-object-handle cover-object-rotate" aria-label="요소 회전"
              onPointerDown={e=>startRotate(e,item)}>
              <RotateCw size={14}/>
            </button>
            <button type="button" className="cover-object-handle cover-object-resize" aria-label="요소 크기 조절"
              onPointerDown={e=>startResize(e,item)}>
              <Expand size={14}/>
            </button>
          </div>;
        })}
      </div>
    </div></div>
    <div className="cover-editor">
      <div className="cover-editor-section">
        <div className="cover-editor-section-heading"><span>표지 배경</span></div>
        <div className="cover-background-options">
          <label className="cover-color-control cover-background-option"><span>단색 배경</span><input type="color" aria-label="표지 배경 색상" value={cover.backgroundColor||themes[theme].cover} onChange={e=>setCover(c=>({...c,backgroundColor:e.target.value}))}/></label>
          <div className="cover-pattern-wrap" onBlur={e=>{const next=e.relatedTarget;if(!(next instanceof Node)||!e.currentTarget.contains(next))setPatternMenuOpen(false);}}>
            <div className="cover-pattern-option cover-background-option">
              <button type="button" className="cover-pattern-trigger" aria-label="배경 패턴 선택" aria-expanded={patternMenuOpen} onClick={()=>setPatternMenuOpen(open=>!open)}>
                <span>패턴</span><span className="cover-pattern-value">{patternLabel}</span><ChevronDown size={13}/>
              </button>
              <input type="color" aria-label="패턴 색상" value={patternColor} onChange={e=>setCover(c=>({...c,patternColor:e.target.value}))}/>
            </div>
            {patternMenuOpen&&<div className="cover-pattern-menu" role="group" aria-label="패턴 종류">
              {COVER_PATTERNS.map(pattern=><button key={pattern.value} type="button" className="cover-pattern-choice" aria-pressed={activePattern===pattern.value} onClick={()=>{setCover(c=>({...c,backgroundPattern:pattern.value}));setPatternMenuOpen(false);}}>
                <span className={`cover-pattern-preview cover-pattern-preview-${pattern.value}`} style={{"--pattern-color":patternColor,"--pattern-thickness":(cover.patternThickness??2)+"px","--pattern-preview-thickness":Math.max(1,(cover.patternThickness??2)*0.45)+"px","--pattern-frame-border":(6+(cover.patternThickness??2)*2)+"px","--pattern-frame-bottom":((6+(cover.patternThickness??2)*2)*4.4)+"px","--pattern-preview-frame-border":(3+(cover.patternThickness??2))+"px","--pattern-preview-frame-bottom":(6+(cover.patternThickness??2)*2)+"px"} as CSSProperties} aria-hidden="true"/>
                <span>{pattern.label}</span>
                {activePattern===pattern.value&&<Check size={14}/>}
              </button>)}
            </div>}
          </div>
        </div>
        <div className="cover-pattern-thickness-row">
          <label htmlFor="cover-pattern-thickness">패턴 굵기</label>
          <input id="cover-pattern-thickness" type="range" min={1} max={8} step={1} value={cover.patternThickness??2} disabled={activePattern==="none"} onChange={e=>setCover(c=>({...c,patternThickness:Number(e.target.value)}))}/>
          <span>{cover.patternThickness??2}</span>
        </div>
        <div className="cover-image-actions">
          <button type="button" className="outline-btn upload-btn" onClick={()=>backgroundInput.current?.click()}><ImagePlus size={16}/> 배경 이미지 업로드</button>
          {cover.backgroundImage&&<button type="button" className="cover-remove-background" onClick={()=>setCover(c=>({...c,backgroundImage:"",backgroundPositionX:50,backgroundPositionY:50}))}><Trash2 size={14}/> 배경 이미지 제거</button>}
        </div>
        <input ref={backgroundInput} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f)void handleUpload(f,true);e.target.value="";}}/>
      </div>

      <div className="cover-editor-section">
        <div className="cover-editor-section-heading"><span>텍스트</span><button type="button" className="cover-add-text" onClick={addText}><Plus size={14}/> 텍스트 추가</button></div>
        {cover.items.filter(item=>item.kind==="text").map(item=><div className="cover-object-editor" key={item.id}>
          <div className="cover-text-editor-row">
            <input aria-label="텍스트 내용" maxLength={75} value={item.value} onChange={e=>updateItem(item.id,{value:e.target.value})}/>
            <label className="cover-text-color-control" title="텍스트 색상">
              <input type="color" aria-label="텍스트 색상" value={item.color||themes[theme].coverInk} onChange={e=>updateItem(item.id,{color:e.target.value})}/>
            </label>
          </div>
          <div className="cover-text-weight-row">
            <label>굵기
              <input type="range" min={400} max={900} step={100} value={item.weight??800} onChange={e=>updateItem(item.id,{weight:Number(e.target.value)})}/>
            </label>
            <span>{item.weight??800}</span>
          </div>
        </div>)}
      </div>

      <div className="cover-editor-section">
        <div className="cover-editor-section-heading"><span>스티커</span></div>
        <div className="sticker-palette">{STICKERS.map(s=><button key={s} type="button" onClick={()=>addSticker(s)} aria-label={`${s} 스티커 추가`}>{s}</button>)}</div>
        <button type="button" className="outline-btn upload-btn cover-sticker-upload" onClick={()=>fileInput.current?.click()}><ImagePlus size={17}/> 스티커 이미지 업로드</button>
        <input ref={fileInput} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>{const f=e.target.files?.[0];if(f)void handleUpload(f);e.target.value="";}}/>
      </div>


    </div>
  </section>;
}

export default function Planner() {
  const [user,setUser]=useState<User|null>(null);
  const [checking,setChecking]=useState(true);
  const pendingAuthUser=useRef<User|null>(null);
  const authenticatedUser=useRef<User|null>(null);
  const [view,setView]=useState<"planner"|"cover">("planner");
  const [date,setDate]=useState(today());
  const [entry,setEntry]=useState<Entry>(()=>emptyEntry(today()));
  const [theme,setTheme]=useState<ThemeName>("blue");
  const [customColor,setCustomColor]=useState("#8b9ec4");
  const [cover,setCover]=useState<Cover>(defaultCover);
  const [photoUrls,setPhotoUrls]=useState<Record<string,string>>({});
  const [pen,setPen]=useState(PENS[0]);
  const [tool,setTool]=useState<"paint"|"erase">("paint");
  const [showSettings,setShowSettings]=useState(false);
  const [showDeleteAccount,setShowDeleteAccount]=useState(false);
  const [deleteEmail,setDeleteEmail]=useState("");
  const [deletingAccount,setDeletingAccount]=useState(false);
  const [showAccountMenu,setShowAccountMenu]=useState(false);
  const [mobileMenu,setMobileMenu]=useState(false);
  const [loading,setLoading]=useState(false);
  const [hydrated,setHydrated]=useState(false);
  const [settingsHydrated,setSettingsHydrated]=useState(false);
  const [status,setStatus]=useState("5분마다 자동 저장돼요.");
  const [alert,setAlert]=useState("");
  const lastSaved=useRef("");
  const entryRef=useRef(entry);
  const lastSettings=useRef("");
  const saveVersion=useRef(0);
  const client=useMemo(()=>supabase(),[]);
  const palette=theme==="custom"?{...themes.custom,accent:sanitizeHex(customColor),cover:sanitizeHex(customColor),soft:setOpacity(customColor,.13),line:setOpacity(customColor,.19)}:themes[theme];
  const vars={"--bg":palette.bg,"--paper":palette.paper,"--ink":palette.ink,"--accent":palette.accent,"--soft":palette.soft,"--line":palette.line,"--cover":palette.cover,"--cover-ink":palette.coverInk} as CSSProperties;

  const beginAuthTransition=useCallback((nextUser:User)=>{
    if(authenticatedUser.current?.id===nextUser.id||pendingAuthUser.current?.id===nextUser.id)return;
    pendingAuthUser.current=nextUser;
    authenticatedUser.current=nextUser;
    setUser(nextUser);
  },[]);

  useEffect(()=>{
    if(!client){setChecking(false);return;}
    let mounted=true;
    void client.auth.getUser().then(({data})=>{
      if(mounted){
        const resolvedUser=pendingAuthUser.current??data.user??null;
        authenticatedUser.current=resolvedUser;
        pendingAuthUser.current=null;
        setUser(resolvedUser);
        setChecking(false);
      }
    });
    const {data:{subscription}}=client.auth.onAuthStateChange((event,session)=>{
      if(!mounted)return;
      if(event==="SIGNED_IN"&&session?.user){
        beginAuthTransition(session.user);
      }else if(event==="SIGNED_OUT"){
        pendingAuthUser.current=null;
        authenticatedUser.current=null;
        setUser(null);
      }else if(event==="INITIAL_SESSION"&&!pendingAuthUser.current){
        authenticatedUser.current=session?.user??null;
        setUser(session?.user??null);
      }
      setChecking(false);
    });
    return()=>{
      mounted=false;
      subscription.unsubscribe();
    };
  },[client,beginAuthTransition]);

  useEffect(()=>{
    if(!client||!user){setSettingsHydrated(false);return;}
    let active=true;setSettingsHydrated(false);
    void client.from("planner_settings").select("theme,custom_color,cover").eq("user_id",user.id).maybeSingle()
      .then(({data,error})=>{
        if(!active)return;
        if(error)setAlert(`설정을 불러오지 못했습니다: ${error.message}`);
        const t = data?.theme;
        const nextTheme:ThemeName=t && Object.keys(themes).includes(t)?t as ThemeName:"blue";
        const nextCustom=data?.custom_color||"#8b9ec4";
        const savedCover:Partial<Cover>=data?.cover && typeof data.cover==="object"?data.cover as Partial<Cover>:{};
        let coverItems:CoverItem[]=Array.isArray(savedCover.items)?savedCover.items:defaultCover.items;
        const subtitleConverted=savedCover.subtitleConverted===true;
        if(!subtitleConverted&&typeof savedCover.subtitle==="string"&&savedCover.subtitle.trim()&&!coverItems.some(item=>item.kind==="text")) {
          coverItems=[...coverItems,{id:"migrated-cover-subtitle",kind:"text",value:savedCover.subtitle,x:50,y:69,size:11,rotation:0}];
        }
        const removedBrandSlogan=coverItems.some(isCoverBrandSlogan);
        coverItems=coverItems.filter(item=>!isCoverBrandSlogan(item)).map(item=>({
          ...item,
          ...(typeof item.color==="string"?{color:sanitizeHex(item.color)}:{}),
          ...(item.kind==="text"?{weight:typeof item.weight==="number"&&Number.isFinite(item.weight)?Math.min(900,Math.max(400,Math.round(item.weight/100)*100)):800}: {})
        }));
        const savedPattern=savedCover.backgroundPattern;
        const validPatterns:CoverPattern[]=["none","grid","dots","stripes","polaroid"];
        const nextCover:Cover={
          subtitle:"",
          subtitleConverted:true,
          items:coverItems,
          colorLabels:Array.from({length:PENS.length},(_,index)=>typeof savedCover.colorLabels?.[index]==="string"?savedCover.colorLabels[index]:""),
          backgroundPattern:validPatterns.includes(savedPattern as CoverPattern)?savedPattern as CoverPattern:"grid",
          ...(typeof savedCover.backgroundColor==="string"?{backgroundColor:savedCover.backgroundColor}:{}),
          ...(typeof savedCover.backgroundImage==="string"?{backgroundImage:savedCover.backgroundImage}:{}),
          ...(typeof savedCover.patternColor==="string"?{patternColor:sanitizeHex(savedCover.patternColor)}:{}),
          patternThickness:typeof savedCover.patternThickness==="number"&&Number.isFinite(savedCover.patternThickness)?Math.min(8,Math.max(1,Math.round(savedCover.patternThickness))):2,
          backgroundPositionX:typeof savedCover.backgroundPositionX==="number"&&Number.isFinite(savedCover.backgroundPositionX)?Math.min(100,Math.max(0,savedCover.backgroundPositionX)):50,
          backgroundPositionY:typeof savedCover.backgroundPositionY==="number"&&Number.isFinite(savedCover.backgroundPositionY)?Math.min(100,Math.max(0,savedCover.backgroundPositionY)):50
        };
        setTheme(nextTheme);setCustomColor(nextCustom);setCover(nextCover);
        lastSettings.current=removedBrandSlogan?"":JSON.stringify({theme:nextTheme,customColor:nextCustom,cover:nextCover});
        setSettingsHydrated(true);
      });
    return()=>{active=false;};
  },[user,client]);

  useEffect(()=>{
    if(!client||!user){setHydrated(false);return;}
    let active=true;setLoading(true);setHydrated(false);setAlert("");saveVersion.current++;
    void client.from("planner_entries").select("entry_date,dday,header_label,header_value,focus,keypoint,todos,memo,timetable")
      .eq("user_id",user.id).eq("entry_date",date).maybeSingle().then(({data,error})=>{
        if(!active)return;
        if(error)setAlert(`기록을 불러오지 못했습니다: ${error.message}`);
        const next:Entry=data?{
          date,dday:data.dday||"",headerLabel:data.header_label||"",headerValue:data.header_value||"",focusItems:parseFocusItems(data.focus),freeNote:parseFreeNote(data.keypoint),
          todos:(()=>{
            const savedTodos:Todo[]=Array.isArray(data.todos)?data.todos.slice(0,10).map((todo:Partial<Todo>,idx:number)=>{
              const todoStatus:TodoStatus=todo.status==="todo"||todo.status==="doing"||todo.status==="done"?todo.status:todo.checked?"done":"todo";
              return {id:todo.id||`todo-${idx+1}`,title:todo.title||"",checked:todoStatus==="done",status:todoStatus};
            }):[];
            return Array.from({length:10},(_,idx)=>savedTodos[idx]??{id:`todo-slot-${idx+1}`,title:"",checked:false,status:"todo" as const});
          })(),
          memo:data.memo||"",timetable:data.timetable&&typeof data.timetable==="object"?data.timetable:{}
        }:emptyEntry(date);
        lastSaved.current=JSON.stringify(next);setEntry(next);setHydrated(true);setLoading(false);setStatus("5분마다 자동 저장돼요.");
      });
    return()=>{active=false;};
  },[client,user,date]);

  const saveNow=useCallback(async (current:Entry)=>{
    if(!client||!user||!hydrated)return;
    const currentJson=JSON.stringify(current);
    if(currentJson===lastSaved.current)return;
    const version=++saveVersion.current;
    setStatus("자동 저장 중이에요.");
    const {error}=await client.from("planner_entries").upsert({
      user_id:user.id,entry_date:current.date,date_label:dateView(current.date),dday:current.dday,header_label:current.headerLabel,
      header_value:current.headerValue,focus:JSON.stringify(current.focusItems),keypoint:current.freeNote,
      todos:current.todos,memo:current.memo,timetable:current.timetable,updated_at:new Date().toISOString()
    },{onConflict:"user_id,entry_date"});
    if(version!==saveVersion.current)return;
    if(error){setStatus("저장하지 못했어요. 다시 시도해 주세요.");setAlert(`기록 저장에 실패했습니다: ${error.message}`);}
    else{lastSaved.current=currentJson;setStatus(JSON.stringify(entryRef.current)===currentJson?"자동 저장되었어요.":"변경 내용은 5분마다 자동 저장돼요.");}
  },[client,user,hydrated]);

  useEffect(()=>{
    entryRef.current=entry;
  },[entry]);

  useEffect(()=>{
    if(!hydrated)return;
    const timer=window.setInterval(()=>{
      const current=entryRef.current;
      if(JSON.stringify(current)!==lastSaved.current)void saveNow(current);
    },5*60*1000);
    return()=>window.clearInterval(timer);
  },[hydrated,saveNow]);

  useEffect(()=>{
    if(!hydrated||JSON.stringify(entry)===lastSaved.current)return;
    setStatus("변경 내용은 5분마다 자동 저장돼요.");
  },[entry,hydrated]);

  useEffect(()=>{
    if(!client||!user||!settingsHydrated)return;
    const snapshot=JSON.stringify({theme,customColor,cover});if(snapshot===lastSettings.current)return;
    const t=setTimeout(async()=>{
      const {error}=await client.from("planner_settings").upsert({user_id:user.id,theme,custom_color:customColor,cover,updated_at:new Date().toISOString()},{onConflict:"user_id"});
      if(error)setAlert(`테마/표지 저장에 실패했습니다: ${error.message}`);else lastSettings.current=snapshot;
    },850);
    return()=>clearTimeout(t);
  },[client,user,settingsHydrated,theme,customColor,cover]);

  useEffect(()=>{
    if(!client||!user)return;
    let active=true;
    const paths=[...cover.items.filter(item=>item.kind==="photo" && !photoUrls[item.value]).map(i=>i.value),...(cover.backgroundImage&&!photoUrls[cover.backgroundImage]?[cover.backgroundImage]:[])];
    const unique=[...new Set(paths)];
    if(!unique.length)return;
    void Promise.all(unique.map(async path=>{
      const {data,error}=await client.storage.from("checkpoint-covers").createSignedUrl(path,60*60);
      return {path,url:error?null:data.signedUrl};
    })).then(res=>{if(active)setPhotoUrls(old=>({...old,...Object.fromEntries(res.filter(r=>r.url).map(r=>[r.path,r.url!]))}));});
    return()=>{active=false;};
  },[client,user,cover.items,cover.backgroundImage,photoUrls]);

  async function handleUpload(file:File,asBackground=false) {
    if(!client||!user)return;
    if(!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)){setAlert("PNG, JPG, WEBP, GIF 형식의 이미지만 업로드할 수 있습니다.");return;}
    if(file.size>5*1024*1024){setAlert("이미지는 5MB 이하만 업로드할 수 있습니다.");return;}
    const ext=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"} as Record<string,string>)[file.type];
    const path=`${user.id}/${uid()}.${ext}`;
    const {error}=await client.storage.from("checkpoint-covers").upload(path,file,{contentType:file.type,upsert:false});
    if(error){setAlert(`이미지 업로드에 실패했습니다: ${error.message}`);return;}
    const signed=await client.storage.from("checkpoint-covers").createSignedUrl(path,60*60);
    if(signed.data)setPhotoUrls(old=>({...old,[path]:signed.data.signedUrl}));
    if(asBackground)setCover(c=>({...c,backgroundImage:path,backgroundPositionX:50,backgroundPositionY:50}));
    else setCover(c=>({...c,items:[...c.items,{id:uid(),kind:"photo",value:path,x:50,y:52,size:96,rotation:0}]}));
  }

  async function signOut() {
    if(!client)return;
    if(hydrated)await saveNow(entry);
    setShowAccountMenu(false);
    await client.auth.signOut();setUser(null);setView("planner");
  }

  async function deleteAccount() {
    if(!client||!user?.email||deletingAccount)return;
    if(deleteEmail.trim().toLowerCase()!==user.email.toLowerCase()) {
      setAlert("로그인한 이메일 주소와 일치하지 않습니다.");
      return;
    }
    setDeletingAccount(true);
    setAlert("");
    try {
      const {data,error}=await client.functions.invoke("delete-account",{
        body:{confirmEmail:deleteEmail.trim()},
      });
      if(error) {
        const detail=typeof data?.error==="string"?data.error:error.message;
        throw new Error(detail||"계정 삭제 요청에 실패했습니다.");
      }
      if(!data?.success) throw new Error(data?.error||"계정 삭제를 완료하지 못했습니다.");
      await client.auth.signOut({scope:"local"});
      authenticatedUser.current=null;
      pendingAuthUser.current=null;
      setUser(null);
      setView("planner");
      setShowDeleteAccount(false);
      setDeleteEmail("");
      setPhotoUrls({});
      setAlert("");
    } catch(error) {
      setAlert(error instanceof Error?error.message:"계정 삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingAccount(false);
    }
  }

  function updateTodo(id:string,patch:Partial<Entry["todos"][number]>) {
    setEntry(v=>({...v,todos:v.todos.map(item=>item.id===id?{...item,...patch}:item)}));
  }
  function cycleTodoStatus(id:string) {
    setEntry(v=>({...v,todos:v.todos.map(item=>{
      if(item.id!==id)return item;
      const current:TodoStatus=item.status??(item.checked?"done":"todo");
      const next:TodoStatus=current==="todo"?"doing":current==="doing"?"done":"todo";
      return {...item,status:next,checked:next==="done"};
    })}));
  }
  const themeNames:Record<ThemeName,string>={white:"White",pink:"Pink",blue:"Blue",black:"Black",custom:"Custom"};

  if(checking)return <div className="boot-screen"><AppIcon/><h1>CHECKPOINT</h1><p>플래너를 불러오는 중입니다...</p></div>;
  if(!user)return <AuthScreen onUser={beginAuthTransition}/>;
  return <div className={view==="planner"?"app-shell planner-view":"app-shell cover-view"} style={vars}>
    <header className="site-header"><div className="header-inner">
      <button className="brand" onClick={()=>setView("planner")}><span className="brand-lockup"><AppIcon/><span>CHECKPOINT</span></span><small>YOUR PACE, YOUR CHECKPOINT</small></button>
      <nav className={mobileMenu?"nav-links open":"nav-links"} aria-label="페이지 이동">
        <button className={view==="planner"?"nav-active":""} onClick={()=>{setView("planner");setMobileMenu(false);}}><BookOpen size={17}/> 플래너</button>
        <button className={view==="cover"?"nav-active":""} onClick={()=>{setView("cover");setMobileMenu(false);}}><Sparkles size={17}/> 표지 꾸미기</button>
      </nav>
      <div className="header-actions">
        <div className="user-badge"><span className="user-dot"/>{user.email}</div>
        <button className="icon-btn" aria-label="테마 설정" title="테마 설정" onClick={()=>setShowSettings(true)}><Palette size={19}/></button>
        <button className="signout-btn" onClick={()=>void signOut()} title="로그아웃"><LogOut size={17}/><span>로그아웃</span></button>
        <button className="icon-btn mobile-menu" aria-label="메뉴" onClick={()=>setMobileMenu(!mobileMenu)}><Menu size={21}/></button>
      </div></div></header>

    <main className="main-area">

      {alert&&<div className="message-banner" role="alert"><CircleHelp size={17}/><span>{alert}</span><button aria-label="알림 닫기" onClick={()=>setAlert("")}><X size={15}/></button></div>}
      <div className="workspace-shell">
        <div className="workspace-canvas">
      {view==="cover"? <CoverPage cover={cover} setCover={setCover} theme={theme} handleUpload={handleUpload} photoUrls={photoUrls}/> : <>
        {loading?<div className="page-loading">페이지를 불러오는 중입니다...</div>:<div className="book-frame">
          <div className="book-spine" aria-hidden="true">{Array.from({length:13},(_,i)=><span key={i}/>)}</div>
          <section className="paper-page left-page">
            <div className="page-date">
              <div className="dday-field">
                <div className="dday-value-row">
                  <span className="dday-prefix">D-</span>
                  <input aria-label="D-day 숫자" type="text" inputMode="numeric" maxLength={4} value={entry.dday.replace(/^D-/i,"").replace(/^D\+/i,"")} onChange={e=>{const value=e.target.value.replace(/\D/g,"").slice(0,4);setEntry(v=>({...v,dday:value?"D-"+value:""}));}}/>
                </div>
              </div>
              <div className="date-main">
                <div className="date-main-row">
                  <span className="date-value">{date.replace(/-/g," ")}</span>
                  <label className="date-picker-trigger" title="달력에서 날짜 선택">
                    <CalendarDays size={16}/>
                    <input aria-label="날짜 선택" type="date" value={date} onChange={e=>{void saveNow(entry);setDate(e.target.value);}}/>
                  </label>
                </div>
              </div>
            </div>
            <div className="small-info-block"><input className="header-label-input" aria-label="상단 항목 이름" maxLength={16} value={entry.headerLabel} onChange={e=>setEntry(v=>({...v,headerLabel:e.target.value}))} /><input className="header-value-input" aria-label="상단 항목 내용" maxLength={100} value={entry.headerValue} onChange={e=>setEntry(v=>({...v,headerValue:e.target.value}))} /></div>
            <div className="workspace-grid">
              <div className="paper-section time-section">
                <div className="section-heading time-heading">
                  <span>TIME TABLE</span>
                  <div className="time-heading-tools">
                    <div className="marker-colors">{PENS.map((c,i)=><button key={c} type="button" className={tool==="paint"&&pen===c?"marker selected":"marker"} style={{background:c}} aria-label={`형광펜 색상 ${i+1} 선택`} title={["분홍","노랑","연두","하늘","보라"][i]} onClick={()=>{setPen(c);setTool("paint");}}/>)}</div>
                  </div>
                </div>
                <Timetable value={entry.timetable} onChange={timetable=>setEntry(v=>({...v,timetable}))} highlighter={pen} tool={tool}/>
              </div>
              <div className="notes-stack">
                <div className="paper-section focus-section"><div className="section-heading"><span>COLOR GUIDE</span></div>
                  <div className="color-guide-list" aria-label="시간표 형광펜 색상별 의미">
                    {PENS.map((color,index)=><div className="color-guide-row" key={color}>
                      <span className="color-guide-swatch" style={{backgroundColor:color}} aria-hidden="true"/>
                      <input className="color-guide-input" type="text" value={cover.colorLabels[index]??""} aria-label={`${index+1}번째 색상 의미`} onChange={e=>setCover(current=>({...current,colorLabels:PENS.map((_,i)=>i===index?e.target.value:(current.colorLabels[i]??""))}))}/>
                    </div>)}
                  </div>
                </div>
                <div className="memo-section"><div className="section-heading"><span>MEMO</span></div>
                  <textarea aria-label="자유 메모" value={entry.memo} onChange={e=>setEntry(v=>({...v,memo:e.target.value}))} />
                </div>
              </div>
            </div>
          </section>
          <section className="paper-page right-page"><div className="right-top"><div className="section-heading todo-header">
              <div className="todo-heading-group"><span>TO DO LIST</span></div>
              <div className="todo-tools">
                <small className="todo-save-status" role="status" aria-live="polite"><span className={status==="자동 저장되었어요."?"indicator-dot saved":"indicator-dot"}/>{status}</small>

              </div>
            </div>
            <div className="todo-list">{entry.todos.slice(0,7).map((todo,idx)=>{
              const todoStatus:TodoStatus=todo.status??(todo.checked?"done":"todo");
              const statusLabel=todoStatus==="todo"?"시작 전":todoStatus==="doing"?"진행 중":"완료";
              return <div className="todo-row" key={todo.id}>
                <span className="todo-number">{String(idx+1).padStart(2,"0")}</span>
                <input className={todoStatus==="done"?"todo-text checked":"todo-text"} value={todo.title}
                  onChange={e=>updateTodo(todo.id,{title:e.target.value})} aria-label={`${idx+1}번째 할 일`}/>
                
                <button type="button" className={`todo-status todo-status-${todoStatus}`} aria-label={`${idx+1}번째 할 일 상태: ${statusLabel}. 클릭하여 변경`} title={statusLabel} aria-pressed={todoStatus==="done"} onClick={()=>cycleTodoStatus(todo.id)}>
                  {todoStatus==="todo"?"○":todoStatus==="doing"?"△":"X"}
                </button>
              </div>;
            })}</div></div>
            <div className="paper-section key-section"><div className="section-heading"><span>FREE NOTE</span></div>
              <textarea className="free-note-input" rows={10} aria-label="자유롭게 작성하는 노트" value={entry.freeNote} onChange={e=>setEntry(current=>({...current,freeNote:e.target.value}))}/>
            </div>
            
          </section>
        </div>}
      </>}
        </div>
        <aside className="workspace-sidebar" aria-label="CHECKPOINT 메뉴">
          <button type="button" className="sidebar-brand" onClick={()=>setView("planner")} aria-label="CHECKPOINT 플래너로 이동">
            <AppIcon/><span>CHECKPOINT</span><small>YOUR PACE, YOUR CHECKPOINT</small>
          </button>
          <div className="sidebar-nav">
            {view==="cover" ? (
              <button type="button" className="workspace-action back-to-planner active" onClick={()=>setView("planner")} aria-current="page">
                <ArrowLeft size={19}/><span>플래너로 돌아가기</span>
              </button>
            ) : (
              <button type="button" className="workspace-action" onClick={()=>setView("cover")}>
                <Sparkles size={19}/><span>표지 꾸미기</span>
              </button>
            )}
            <button type="button" className="workspace-action" onClick={()=>setShowSettings(true)}>
              <Palette size={19}/><span>테마 설정</span>
            </button>
          </div>
          <div className="sidebar-account">
            <button
              type="button"
              className="sidebar-email-trigger"
              title={user?.email??""}
              aria-label="계정 메뉴"
              aria-expanded={showAccountMenu}
              aria-controls="sidebar-account-menu"
              onClick={()=>setShowAccountMenu(current=>!current)}
            >
              <span>{user?.email??""}</span>
              <ChevronDown size={15} aria-hidden="true"/>
            </button>
            {showAccountMenu&&<div className="sidebar-account-menu" id="sidebar-account-menu">
              <button type="button" className="sidebar-signout" onClick={()=>void signOut()}>
                <LogOut size={14}/><span>로그아웃</span>
              </button>
              <div className="sidebar-menu-divider" role="separator"/>
              <button type="button" className="sidebar-delete-account" onClick={()=>{setShowAccountMenu(false);setDeleteEmail("");setShowDeleteAccount(true);}}>
                <Trash2 size={14}/><span>회원 탈퇴</span>
              </button>
            </div>}
          </div>
        </aside>
      </div>
    </main>

    {showDeleteAccount&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!deletingAccount)setShowDeleteAccount(false)}} role="presentation">
      <section className="delete-account-modal" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
        <div className="delete-account-icon"><Trash2 size={22}/></div>
        <div className="eyebrow">ACCOUNT DELETION</div>
        <h2 id="delete-account-title">회원 탈퇴</h2>
        <p>회원 탈퇴를 진행하면 계정과 저장된 플래너 내용, 표지 이미지가 영구적으로 삭제됩니다. 삭제한 정보는 복구할 수 없습니다.</p>
        <label className="delete-confirm-label">확인을 위해 로그인한 이메일 주소를 입력해 주세요.
          <input type="email" autoComplete="off" value={deleteEmail} onChange={e=>setDeleteEmail(e.target.value)} placeholder="로그인한 이메일 주소"/>
        </label>
        <div className="delete-account-actions">
          <button type="button" className="outline-btn" disabled={deletingAccount} onClick={()=>{setShowDeleteAccount(false);setDeleteEmail("");}}>취소</button>
          <button type="button" className="delete-confirm-btn" disabled={deletingAccount||deleteEmail.trim().toLowerCase()!==user?.email?.toLowerCase()} onClick={()=>void deleteAccount()}>
            {deletingAccount?"삭제 처리 중...":"계정 영구 삭제"}
          </button>
        </div>
      </section>
    </div>}

    {showSettings&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowSettings(false)}} role="presentation">
      <section className="settings-modal" role="dialog" aria-modal="true" aria-label="테마 설정"><div className="settings-header"><div><div className="eyebrow">MAKE IT FEEL LIKE YOU</div><h2>테마 설정</h2></div><button className="icon-btn" aria-label="닫기" onClick={()=>setShowSettings(false)}><X size={21}/></button></div>
      <p>속지와 표지 색상이 함께 변경됩니다. 원하는 색상을 선택해 주세요.</p>
      <div className="theme-choices">{(["white","pink","blue","black","custom"] as ThemeName[]).map(t=><button type="button" className={theme===t?"theme-choice active":"theme-choice"} key={t} onClick={()=>setTheme(t)}>
        <span className="theme-thumb" style={{background:t==="custom"?sanitizeHex(customColor):themes[t].cover}}>{theme===t?<Check size={19}/>:null}</span><span>{themeNames[t]}</span>
      </button>)}</div>
      {theme==="custom"&&<div className="custom-color"><label>컬러 피커<input aria-label="사용자 지정 컬러 피커" type="color" value={sanitizeHex(customColor)} onChange={e=>setCustomColor(e.target.value)}/></label><label>HEX 코드<input aria-label="HEX 컬러 코드" type="text" maxLength={7} placeholder="#8B9EC4" value={customColor} onChange={e=>setCustomColor(e.target.value)}/></label></div>}
      <div className="settings-bottom"><span><CheckCircle2 size={16}/> 자동 저장이 적용됩니다.</span><button className="primary-btn" onClick={()=>setShowSettings(false)}>적용하기</button></div>
      </section></div>}
  </div>;
}
