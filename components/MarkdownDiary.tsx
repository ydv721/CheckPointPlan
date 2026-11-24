"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent, type WheelEvent as ReactWheelEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AlignCenter, AlignLeft, AlignRight, Bold, ChevronDown, ChevronLeft, ChevronRight, Code2, Eraser, FileDown, Heading1, Highlighter, ImagePlus, Italic, List, ListOrdered, Minus, Palette, PenLine, Plus, Quote, StickyNote as StickyNoteIcon, Strikethrough, Type, Underline, Check, Trash2, X } from "lucide-react";
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

type JsPdfDocument = {
  addImage: (
    imageData: HTMLCanvasElement,
    format: "PNG",
    x: number,
    y: number,
    width: number,
    height: number
  ) => JsPdfDocument;
  save: (filename: string) => void;
};

type JsPdfConstructor = new (options: {
  orientation: "portrait" | "landscape";
  unit: "pt";
  format: [number, number];
  compress?: boolean;
  putOnlyUsedFonts?: boolean;
}) => JsPdfDocument;

type Html2CanvasOptions = {
  backgroundColor?: string | null;
  scale?: number;
  useCORS?: boolean;
  logging?: boolean;
  width?: number;
  height?: number;
  windowWidth?: number;
  windowHeight?: number;
  scrollX?: number;
  scrollY?: number;
  normalizeDom?: boolean;
  onclone?: (clonedDocument: Document, clonedElement: HTMLElement) => void | Promise<void>;
};

declare global {
  interface Window {
    jspdf?: { jsPDF: JsPdfConstructor };
    html2canvas?: (element: HTMLElement, options?: Html2CanvasOptions) => Promise<HTMLCanvasElement>;
  }
}

const JSPDF_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js";
const HTML2CANVAS_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/html2canvas-pro@2.6.4/dist/html2canvas-pro.min.js";

function loadJsPdf(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("브라우저에서만 PDF를 만들 수 있습니다."));
  if (window.jspdf?.jsPDF) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-jspdf-loader="true"]');
    if (existing) {
      if (existing.dataset.loaded === "true") {
        if (window.jspdf?.jsPDF) resolve();
        else reject(new Error("PDF 변환 도구를 초기화하지 못했습니다."));
        return;
      }
      existing.addEventListener("load", () => {
        if (window.jspdf?.jsPDF) resolve();
        else reject(new Error("PDF 변환 도구를 초기화하지 못했습니다."));
      }, { once: true });
      existing.addEventListener("error", () => reject(new Error("PDF 변환 도구를 불러오지 못했습니다.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = JSPDF_SCRIPT_URL;
    script.async = true;
    script.dataset.jspdfLoader = "true";
    script.onload = () => {
      script.dataset.loaded = "true";
      if (window.jspdf?.jsPDF) resolve();
      else reject(new Error("PDF 변환 도구를 초기화하지 못했습니다."));
    };
    script.onerror = () => {
      script.remove();
      reject(new Error("PDF 변환 도구를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요."));
    };
    document.head.appendChild(script);
  });
}

function loadHtml2Canvas(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("브라우저에서만 이미지를 저장할 수 있습니다."));
  }
  if (window.html2canvas) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-html2canvas-pro-loader="true"]');
    if (existing) {
      if (existing.dataset.loaded === "true") {
        if (window.html2canvas) resolve();
        else reject(new Error("이미지 변환 도구를 초기화하지 못했습니다."));
        return;
      }
      existing.addEventListener("load", () => {
        if (window.html2canvas) resolve();
        else reject(new Error("이미지 변환 도구를 초기화하지 못했습니다."));
      }, { once: true });
      existing.addEventListener("error", () => {
        reject(new Error("이미지 변환 도구를 불러오지 못했습니다."));
      }, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = HTML2CANVAS_SCRIPT_URL;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.html2canvasProLoader = "true";
    script.onload = () => {
      script.dataset.loaded = "true";
      if (window.html2canvas) resolve();
      else reject(new Error("이미지 변환 도구를 초기화하지 못했습니다."));
    };
    script.onerror = () => {
      script.remove();
      reject(new Error("이미지 변환 도구를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요."));
    };
    document.head.appendChild(script);
  });
}

export type MarkdownAction = "bold" | "italic" | "underline" | "strike" | "heading" | "bullet" | "ordered" | "quote" | "code" | "divider";

export const MARKDOWN_TOOLBAR = [
  { action: "bold", label: "굵게", icon: Bold },
  { action: "italic", label: "기울임", icon: Italic },
  { action: "underline", label: "밑줄", icon: Underline },
  { action: "strike", label: "취소선", icon: Strikethrough },
  { action: "heading", label: "제목", icon: Heading1 },
  { action: "bullet", label: "글머리표", icon: List },
  { action: "ordered", label: "번호 목록", icon: ListOrdered },
  { action: "quote", label: "인용", icon: Quote },
  { action: "code", label: "코드 블록", icon: Code2 },
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
  onOpenCover: () => void;
  onSignOut: () => Promise<void>;
  onDeleteAccount: () => void;
};

const CODE_LANGUAGES = [
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "java", label: "Java" },
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash" },
  { value: "json", label: "JSON" },
  { value: "plaintext", label: "Plain text" }
] as const;

const DEFAULT_CODE_LANGUAGE = "c";

const PAGE_CONTENT_PREFIX_V1 = "\u001eCHECKPOINT_FREE_NOTE_V1\u001e";
const PAGE_CONTENT_PREFIX = "\u001eCHECKPOINT_FREE_NOTE_V2\u001e";

type DrawingTool = "pen" | "highlighter" | "sticky" | "eraser";
type DrawingPoint = { x: number; y: number };
type ImageCropRect = { x: number; y: number; width: number; height: number };
type DrawingStroke = {
  id: string;
  tool: "pen" | "highlighter";
  color: string;
  points: DrawingPoint[];
};
type StickyNote = {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
};
type FreeNotePageAnnotations = {
  height: number;
  strokes: DrawingStroke[];
  notes: StickyNote[];
};

const DRAWING_COLORS = [
  { label: "노랑", color: "#F4D35E" },
  { label: "분홍", color: "#F2A7C6" },
  { label: "연두", color: "#A8DDB5" },
  { label: "하늘", color: "#9CCFF0" },
  { label: "보라", color: "#C4B2EB" },
  { label: "검정", color: "#34343B" }
] as const;

function createEmptyPageAnnotations(height = 1): FreeNotePageAnnotations {
  return { height: Math.max(1, height), strokes: [], notes: [] };
}

function createDrawingId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function normalizePageAnnotations(value: unknown, pageCount: number): FreeNotePageAnnotations[] {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: pageCount }, (_, index) => {
    const raw = source[index] && typeof source[index] === "object"
      ? source[index] as Partial<FreeNotePageAnnotations>
      : {};
    const strokes = Array.isArray(raw.strokes)
      ? raw.strokes.slice(0, 500).flatMap((item): DrawingStroke[] => {
          if (!item || typeof item !== "object") return [];
          const stroke = item as Partial<DrawingStroke>;
          if (stroke.tool !== "pen" && stroke.tool !== "highlighter") return [];
          if (!Array.isArray(stroke.points)) return [];
          const points = stroke.points.slice(0, 5000).flatMap((point): DrawingPoint[] => {
            if (!point || typeof point !== "object") return [];
            const candidate = point as Partial<DrawingPoint>;
            if (typeof candidate.x !== "number" || !Number.isFinite(candidate.x) || typeof candidate.y !== "number" || !Number.isFinite(candidate.y)) return [];
            return [{
              x: Math.max(0, Math.min(1000, Number(candidate.x))),
              y: Math.max(0, Math.min(100000, Number(candidate.y)))
            }];
          });
          if (points.length === 0) return [];
          const color = typeof stroke.color === "string" && /^#[0-9a-f]{6}$/i.test(stroke.color)
            ? stroke.color
            : stroke.tool === "highlighter" ? "#F4D35E" : "#34343B";
          return [{
            id: typeof stroke.id === "string" ? stroke.id : createDrawingId(),
            tool: stroke.tool,
            color,
            points
          }];
        })
      : [];
    const notes = Array.isArray(raw.notes)
      ? raw.notes.slice(0, 100).flatMap((item): StickyNote[] => {
          if (!item || typeof item !== "object") return [];
          const note = item as Partial<StickyNote>;
          if (typeof note.x !== "number" || !Number.isFinite(note.x) || typeof note.y !== "number" || !Number.isFinite(note.y)) return [];
          const color = typeof note.color === "string" && /^#[0-9a-f]{6}$/i.test(note.color)
            ? note.color
            : "#FFF2B8";
          return [{
            id: typeof note.id === "string" ? note.id : createDrawingId(),
            x: Math.max(0, Math.min(1000, Number(note.x))),
            y: Math.max(0, Math.min(100000, Number(note.y))),
            text: typeof note.text === "string" ? note.text.slice(0, 5000) : "",
            color
          }];
        })
      : [];
    return {
      height: typeof raw.height === "number" && Number.isFinite(raw.height) ? Math.max(1, Math.min(100000, raw.height)) : 1,
      strokes,
      notes
    };
  });
}

function decodeNoteDocument(content: string): { pages: string[]; annotations: FreeNotePageAnnotations[] } {
  if (content.startsWith(PAGE_CONTENT_PREFIX)) {
    try {
      const parsed = JSON.parse(content.slice(PAGE_CONTENT_PREFIX.length)) as { pages?: unknown; annotations?: unknown };
      if (Array.isArray(parsed.pages)) {
        const pages = parsed.pages.map((page): string => typeof page === "string" ? page : "");
        const safePages = pages.length > 0 ? pages : [""];
        return {
          pages: safePages,
          annotations: normalizePageAnnotations(parsed.annotations, safePages.length)
        };
      }
    } catch {
      return { pages: [content], annotations: [createEmptyPageAnnotations()] };
    }
    return { pages: [content], annotations: [createEmptyPageAnnotations()] };
  }

  if (content.startsWith(PAGE_CONTENT_PREFIX_V1)) {
    try {
      const parsed = JSON.parse(content.slice(PAGE_CONTENT_PREFIX_V1.length)) as Partial<NotePages>;
      const pages = [typeof parsed.left === "string" ? parsed.left : ""];
      if (typeof parsed.right === "string" && parsed.right.trim()) pages.push(parsed.right);
      return { pages, annotations: normalizePageAnnotations([], pages.length) };
    } catch {
      return { pages: [content], annotations: [createEmptyPageAnnotations()] };
    }
  }

  return { pages: [content], annotations: [createEmptyPageAnnotations()] };
}

function decodeNotePages(content: string): string[] {
  return decodeNoteDocument(content).pages;
}

function decodeNoteAnnotations(content: string): FreeNotePageAnnotations[] {
  return decodeNoteDocument(content).annotations;
}

function encodeNotePages(pages: string[], annotations: FreeNotePageAnnotations[] = []) {
  const safePages = pages.length > 0 ? pages : [""];
  return PAGE_CONTENT_PREFIX + JSON.stringify({
    pages: safePages,
    annotations: normalizePageAnnotations(annotations, safePages.length)
  });
}

function extractStoredImagePaths(markdown: string) {
  const paths = new Set<string>();
  const pattern = /!\[([^\]]*)\]\(checkpoint-image:([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    try {
      const encodedPath = match[2].split("?")[0];
      const path = decodeURIComponent(encodedPath);
      if (path) paths.add(path);
    } catch {
      // Ignore malformed stored image references.
    }
  }
  return [...paths];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeCodeLanguage(value: string) {
  return CODE_LANGUAGES.some(language => language.value === value)
    ? value
    : "plaintext";
}

function highlightCodeHtml(source: string, language: string) {
  const lang = normalizeCodeLanguage(language);
  if (lang === "plaintext" || !source) return escapeHtml(source) || "<br>";

  const keywordGroups: Record<string, string> = {
    c: "auto break case char const continue default do double else enum extern float for goto if int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while",
    cpp: "alignas auto bool break case char class const constexpr continue default delete do double else enum explicit extern false float for friend goto if inline int long namespace new nullptr operator private protected public register return short signed sizeof static struct switch template this throw true try typedef typename union unsigned using virtual void volatile while",
    java: "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null",
    python: "and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield",
    javascript: "async await break case catch class const continue debugger default delete do else export extends false finally for from function if import in instanceof let new null return super switch this throw true try typeof var void while yield",
    typescript: "abstract any as async await boolean break case catch class const constructor continue debugger declare default delete do else enum export extends false finally for from function if implements import in instanceof interface keyof let namespace never new null number private protected public readonly return super switch this throw true try type typeof undefined var void while yield",
    sql: "add all alter and as asc begin between by case cast check column commit constraint create cross current_date current_time database default delete desc distinct drop else end exists false fetch foreign from full group having in index inner insert into is join key left like limit not null offset on or order outer primary procedure references right rollback row select set table then true union unique update use values view when where with",
    bash: "case do done elif else esac fi for function if in select then time until while"
  };
  const keywords = (keywordGroups[lang] ?? "").split(/\s+/).filter(Boolean).join("|");
  const keywordPattern = keywords ? "\\b(?:" + keywords + ")\\b" : "(?!)";
  const hashPattern = lang === "python" || lang === "bash"
    ? "#[^\\n]*"
    : "#[ \\t]*(?:include|define|if|ifdef|ifndef|endif|pragma)\\b";
  const pattern = new RegExp(
    "(" + hashPattern + "|//[^\\n]*|--[^\\n]*|/\\*[\\s\\S]*?\\*/|<[^>\\n]+>|\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'|" + keywordPattern + "|\\b\\d+(?:\\.\\d+)?\\b|\\b[A-Za-z_]\\w*(?=\\s*\\())",
    "g"
  );

  return source.replace(pattern, token => {
    let tokenClass = "function";
    if (/^#/.test(token)) tokenClass = lang === "python" || lang === "bash" ? "comment" : "directive";
    else if (/^(\/\/|--|\/\*)/.test(token)) tokenClass = "comment";
    else if (/^<[^>]+>$/.test(token)) tokenClass = "include";
    else if (/^["']/.test(token)) tokenClass = "string";
    else if (/^\d/.test(token)) tokenClass = "number";
    else if (keywords && new RegExp("^(?:" + keywords + ")$").test(token)) tokenClass = "keyword";
    return '<span class="code-token-' + tokenClass + '">' + escapeHtml(token) + "</span>";
  });
}

export function createMarkdownCodeBlockHtml(code: string, language: string, inserted = false) {
  const safeLanguage = normalizeCodeLanguage(language);
  const options = CODE_LANGUAGES.map(({ value, label }) =>
    '<option value="' + value + '"' + (value === safeLanguage ? " selected" : "") + ">" + label + "</option>"
  ).join("");
  const codeHtml = code ? highlightCodeHtml(code, safeLanguage) : "<br>";
  return (
    '<div class="markdown-code-block" data-language="' + safeLanguage + '"' +
      (inserted ? ' data-inserted="true"' : "") + ">" +
      '<div class="markdown-code-header" contenteditable="false">' +
        '<span class="markdown-code-label">CODE</span>' +
        '<select class="markdown-code-language" aria-label="코드 언어">' + options + "</select>" +
      "</div>" +
      "<pre><code>" + codeHtml + "</code></pre>" +
    "</div>"
  );
}

function serializeCodeText(node: Node): string {
  if (node.nodeType === 3) return node.textContent ?? "";
  if (node.nodeType !== 1) return "";

  const element = node as HTMLElement;
  if (element.tagName === "BR") return "\n";

  let result = "";
  for (const child of Array.from(element.childNodes)) {
    const childText = serializeCodeText(child);
    const isBlockLine = child.nodeType === 1 && ["DIV", "P"].includes((child as HTMLElement).tagName);
    if (isBlockLine && result && !result.endsWith("\n")) result += "\n";
    result += childText;
    if (isBlockLine && !result.endsWith("\n")) result += "\n";
  }
  return result;
}

export function highlightCodeBlocks(editor: HTMLElement) {
  editor.querySelectorAll<HTMLElement>(".markdown-code-block").forEach(block => {
    const code = block.querySelector("pre code");
    if (!code) return;
    const language = normalizeCodeLanguage(block.dataset.language ?? "plaintext");
    const source = serializeCodeText(code).replace(/\n+$/, "");
    code.innerHTML = highlightCodeHtml(source, language);
  });
}

function normalizeMarkdownColor(value: string) {
  const color = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(color)) return color;
  const rgb = color.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/);
  if (!rgb) return "";
  const channels = rgb.slice(1, 4).map(Number);
  if (channels.some(channel => channel < 0 || channel > 255)) return "";
  return "#" + channels.map(channel => channel.toString(16).padStart(2, "0")).join("");
}


function safeMarkdownHref(value: string) {
  const href = value.trim();
  if (/^(https?:\/\/|mailto:)/i.test(href) || href.startsWith("/") || href.startsWith("#")) {
    return href;
  }
  return "";
}

function noteImageControlsMarkup() {
  return [
    '<button type="button" class="markdown-note-image-menu-trigger markdown-note-image-control" aria-label="이미지 메뉴" title="이미지 메뉴" draggable="false">⋯</button>',
    '<span class="markdown-note-image-options" role="group" aria-label="이미지 메뉴">',
    '<button type="button" class="markdown-note-image-crop markdown-note-image-control" draggable="false">자르기</button>',
    '<button type="button" class="markdown-note-image-delete markdown-note-image-control" draggable="false">삭제</button>',
    '</span>',
    '<span class="markdown-note-image-rotation-stem" aria-hidden="true"></span>',
    '<button type="button" class="markdown-note-image-rotate-handle markdown-note-image-control" aria-label="이미지 회전" title="이미지 회전" draggable="false">↻</button>',
    '<button type="button" class="markdown-note-image-resize-handle markdown-note-image-control" aria-label="이미지 크기 조절" title="이미지 크기 조절" draggable="false">↘</button>'
  ].join("");
}

function renderInlineMarkdown(value: string, imageUrls: Record<string, string> = {}) {
  const tokens: string[] = [];
  const stash = (html: string) => {
    tokens.push(html);
    return "\u0000" + (tokens.length - 1) + "\u0000";
  };

  // Protect inline code first: literal <u> inside backticks must remain code.
  let source = value.replace(/\x60([^\x60]+)\x60/g, (_match, code: string) =>
    stash("<code>" + escapeHtml(code) + "</code>")
  );
  // Underline uses limited HTML syntax because standard Markdown has no underline marker.
  source = source.replace(/<(u|ins)>([\s\S]*?)<\/\1>/gi, (_match, _tag: string, content: string) =>
    stash("<u>" + renderInlineMarkdown(content, imageUrls) + "</u>")
  );
  source = source.replace(
    /<span\s+style=["']color:\s*(#[0-9a-f]{6})["']\s*>([\s\S]*?)<\/span>/gi,
    (_match, color: string, content: string) =>
      stash('<span style="color: ' + color.toLowerCase() + '">' + renderInlineMarkdown(content, imageUrls) + "</span>")
  );
  source = source.replace(/!\[([^\]]*)\]\(checkpoint-image:([^)]+)\)/g, (_match, alt: string, encodedReference: string) => {
    try {
      const [encodedPath, rawOptions = ""] = encodedReference.split("?");
      const path = decodeURIComponent(encodedPath);
      const options = new URLSearchParams(rawOptions);
      const clampNumber = (value: string | null, fallback: number, min: number, max: number) => {
        if (value === null || value.trim() === "") return fallback;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
      };
      const width = clampNumber(options.get("w"), 80, 20, 100);
      const ratioValue = options.get("r") ?? "original";
      const ratio = ["original", "1:1", "4:3", "16:9", "3:4"].includes(ratioValue) ? ratioValue : "original";
      const zoom = clampNumber(options.get("z"), 100, 100, 300);
      const cropX = clampNumber(options.get("x"), 50, 0, 100);
      const cropY = clampNumber(options.get("y"), 50, 0, 100);
      const rotation = clampNumber(options.get("rot"), 0, -180, 180);
      const src = imageUrls[path];
      const srcAttribute = src ? ' src="' + escapeHtml(src) + '"' : "";
      const wrapperStyle = [
        "display:block",
        "position:relative",
        "box-sizing:border-box",
        "width:" + width + "%",
        "max-width:100%",
        "margin:26px auto",
        "overflow:visible",
        ratio === "original" ? "" : "aspect-ratio:" + ratio.replace(":", " / ")
      ].filter(Boolean).join(";");
      const imageStyle = ratio === "original"
        ? "display:block;position:relative;width:100%;height:auto;max-width:100%;object-fit:contain;transform:scale(" + zoom / 100 + ");transform-origin:" + cropX + "% " + cropY + "%;"
        : "display:block;position:absolute;inset:0;width:100%;height:100%;max-width:none;object-fit:cover;object-position:" + cropX + "% " + cropY + "%;transform:scale(" + zoom / 100 + ");transform-origin:" + cropX + "% " + cropY + "%;";
      return stash(
        '<span class="markdown-note-image-frame" data-checkpoint-image-path="' + escapeHtml(path) +
        '" data-checkpoint-image-width="' + width + '" data-checkpoint-image-ratio="' + ratio +
        '" data-checkpoint-image-zoom="' + zoom + '" data-checkpoint-image-x="' + cropX +
        '" data-checkpoint-image-y="' + cropY + '" data-checkpoint-image-rotation="' + rotation +
        '" contenteditable="false" draggable="true" style="' + escapeHtml(wrapperStyle) + '">' +
        '<span class="markdown-note-image-content" style="transform:rotate(' + rotation + 'deg)">' +
        '<img class="markdown-note-image" data-checkpoint-image-path="' + escapeHtml(path) +
        '"' + srcAttribute + ' alt="' + escapeHtml(alt || "이미지") +
        '" draggable="false" style="' + escapeHtml(imageStyle) + '"></span>' +
        noteImageControlsMarkup() + '</span>'
      );
    } catch {
      return alt || "이미지";
    }
  });
  let html = escapeHtml(source);
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, (_match, text: string) =>
    stash("<strong><em>" + text + "</em></strong>")
  );
  html = html.replace(/___(.+?)___/g, (_match, text: string) =>
    stash("<strong><em>" + text + "</em></strong>")
  );
  html = html.replace(/\*\*(.+?)\*\*/g, (_match, text: string) =>
    stash("<strong>" + text + "</strong>")
  );
  html = html.replace(/__(.+?)__/g, (_match, text: string) =>
    stash("<strong>" + text + "</strong>")
  );
  html = html.replace(/~~(.+?)~~/g, (_match, text: string) =>
    stash("<del>" + text + "</del>")
  );
  html = html.replace(/\*([^*\n]+)\*/g, (_match, text: string) =>
    stash("<em>" + text + "</em>")
  );
  html = html.replace(/_([^_\n]+)_/g, (_match, text: string) =>
    stash("<em>" + text + "</em>")
  );
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, rawHref: string) => {
    const href = safeMarkdownHref(rawHref.replace(/&amp;/g, "&"));
    return href
      ? stash('<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' + label + "</a>")
      : label;
  });
  html = html.replace(/(^|[\s(])((?:https?:\/\/|www\.)[^\s<]+)/gi, (_match, prefix: string, rawUrl: string) => {
    const trailing = rawUrl.match(/[.,!?;:)\]}]+$/)?.[0] ?? "";
    const url = trailing ? rawUrl.slice(0, -trailing.length) : rawUrl;
    const decodedUrl = url.replace(/&amp;/g, "&");
    const href = safeMarkdownHref(decodedUrl.startsWith("www.") ? "https://" + decodedUrl : decodedUrl);
    return href
      ? prefix + stash('<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' + url + "</a>") + trailing
      : prefix + rawUrl;
  });

  let rendered = html;
  for (let pass = 0; pass <= tokens.length; pass += 1) {
    const next = rendered.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => tokens[Number(index)] ?? "");
    if (next === rendered) break;
    rendered = next;
  }
  return rendered;
}

export function markdownToHtml(markdown: string, imageUrls: Record<string, string> = {}) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let index = 0;

  const isBlockStart = (line: string) =>
    /^\s*\x60{3}/.test(line) ||
    /^\s*~~~/.test(line) ||
    /^\s*:::align-(?:left|center|right)\s*$/.test(line) ||
    /^#{1,3}\s+/.test(line) ||
    /^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line) ||
    /^\s*>/.test(line) ||
    /^\s*(?:[-+*]|\d+[.)])\s+/.test(line);

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const alignmentBlock = line.match(/^\s*:::align-(left|center|right)\s*$/);
    if (alignmentBlock) {
      const alignment = alignmentBlock[1];
      const contentLines: string[] = [];
      let depth = 1;
      index += 1;

      while (index < lines.length && depth > 0) {
        const currentLine = lines[index];
        if (/^\s*:::align-(?:left|center|right)\s*$/.test(currentLine)) {
          depth += 1;
          contentLines.push(currentLine);
        } else if (currentLine.trim() === ":::") {
          depth -= 1;
          if (depth > 0) contentLines.push(currentLine);
        } else {
          contentLines.push(currentLine);
        }
        index += 1;
      }

      const content = markdownToHtml(contentLines.join("\n"), imageUrls);
      blocks.push('<div data-checkpoint-align="' + alignment + '" style="text-align:' + alignment + '">' + content + "</div>");
      continue;
    }

    const codeFence = line.match(/^\s*(\x60{3}|~~~)\s*(.*)$/);
    if (codeFence) {
      const fence = codeFence[1];
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith(fence)) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const language = normalizeCodeLanguage((codeFence[2].trim().split(/\s+/)[0] ?? "plaintext").toLowerCase());
      blocks.push(createMarkdownCodeBlockHtml(codeLines.join("\n"), language));
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push("<h" + level + ">" + renderInlineMarkdown(heading[2], imageUrls) + "</h" + level + ">");
      index += 1;
      continue;
    }

    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      blocks.push("<hr>");
      index += 1;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      blocks.push("<blockquote><p>" + renderInlineMarkdown(quoteLines.join("\n"), imageUrls).replace(/\n/g, "<br>") + "</p></blockquote>");
      continue;
    }

    const listMatch = line.match(/^\s*(?:(\d+)[.)]|[-+*])\s+(.*)$/);
    if (listMatch) {
      const ordered = Boolean(listMatch[1]);
      const items: string[] = [];
      while (index < lines.length) {
        const item = lines[index].match(/^\s*(?:(\d+)[.)]|[-+*])\s+(.*)$/);
        if (!item || Boolean(item[1]) !== ordered) break;
        const itemAlignment = item[2].match(/^\{align=(left|center|right)\}\s?(.*)$/);
        const itemText = itemAlignment ? itemAlignment[2] : item[2];
        const alignmentStyle = itemAlignment ? ' style="text-align:' + itemAlignment[1] + '"' : "";
        items.push("<li" + alignmentStyle + ">" + renderInlineMarkdown(itemText, imageUrls) + "</li>");
        index += 1;
      }
      const tag = ordered ? "ol" : "ul";
      blocks.push("<" + tag + ">" + items.join("") + "</" + tag + ">");
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && (paragraph.length === 0 || !isBlockStart(lines[index]))) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push("<p>" + renderInlineMarkdown(paragraph.join("\n"), imageUrls).replace(/\n/g, "<br>") + "</p>");
  }

  return blocks.join("");
}

export function htmlToMarkdown(html: string) {
  const parsed = new DOMParser().parseFromString("<div>" + html + "</div>", "text/html");
  const root = parsed.body.firstElementChild;
  if (!root) return "";

  const inline = (node: Node): string => {
    if (node.nodeType === 3) return node.textContent ?? "";
    if (node.nodeType !== 1) return "";

    const element = node as HTMLElement;
    const tag = element.tagName;
    const children = Array.from(element.childNodes).map(inline).join("");

    if (tag === "BR") return "\n";
    if (tag === "HR") return "\n---\n";
    if (tag === "SPAN" && element.classList.contains("markdown-note-image-frame")) {
      const path = element.dataset.checkpointImagePath ?? "";
      if (!path) return "";
      const image = element.querySelector<HTMLImageElement>("img.markdown-note-image");
      const alt = (image?.getAttribute("alt") ?? "이미지").replace(/[\[\]()\r\n]/g, " ").trim() || "이미지";
      const width = Math.min(100, Math.max(20, Number(element.dataset.checkpointImageWidth) || 80));
      const ratioValue = element.dataset.checkpointImageRatio ?? "original";
      const ratio = ["original", "1:1", "4:3", "16:9", "3:4"].includes(ratioValue) ? ratioValue : "original";
      const zoom = Math.min(300, Math.max(100, Number(element.dataset.checkpointImageZoom) || 100));
      const cropXValue = Number(element.dataset.checkpointImageX);
      const cropYValue = Number(element.dataset.checkpointImageY);
      const cropX = Number.isFinite(cropXValue) ? Math.min(100, Math.max(0, cropXValue)) : 50;
      const cropY = Number.isFinite(cropYValue) ? Math.min(100, Math.max(0, cropYValue)) : 50;
      const rotationValue = Number(element.dataset.checkpointImageRotation);
      const rotation = Number.isFinite(rotationValue) ? Math.min(180, Math.max(-180, rotationValue)) : 0;
      const options = new URLSearchParams();
      if (width !== 100) options.set("w", String(width));
      if (ratio !== "original") options.set("r", ratio);
      if (zoom !== 100) options.set("z", String(zoom));
      if (cropX !== 50) options.set("x", String(cropX));
      if (cropY !== 50) options.set("y", String(cropY));
      if (rotation !== 0) options.set("rot", String(Math.round(rotation * 10) / 10));
      const query = options.toString();
      return "![" + alt + "](checkpoint-image:" + encodeURIComponent(path) + (query ? "?" + query : "") + ")";
    }
    if (tag === "IMG") {
      const path = element.getAttribute("data-checkpoint-image-path") ?? "";
      if (!path) return "";
      const alt = (element.getAttribute("alt") ?? "이미지").replace(/[\[\]()\r\n]/g, " ").trim() || "이미지";
      return "![" + alt + "](checkpoint-image:" + encodeURIComponent(path) + ")";
    }
    if (tag === "B" || tag === "STRONG") return "**" + children + "**";
    if (tag === "I" || tag === "EM") return "*" + children + "*";
    if (tag === "U" || tag === "INS") return "<u>" + children + "</u>";
    if (tag === "S" || tag === "STRIKE" || tag === "DEL") return "~~" + children + "~~";
    if (tag === "CODE" && !element.closest(".markdown-code-block")) return String.fromCharCode(96) + children + String.fromCharCode(96);
    if (tag === "FONT" || tag === "SPAN") {
      const rawColor = tag === "FONT" ? (element.getAttribute("color") ?? element.style.color) : element.style.color;
      const color = normalizeMarkdownColor(rawColor);
      const underlined = /\bunderline\b/i.test(element.style.textDecorationLine + " " + element.style.textDecoration)
        ? "<u>" + children + "</u>" : children;
      return color ? '<span style="color: ' + color + '">' + underlined + "</span>" : underlined;
    }
    if (tag === "A") {
      const href = safeMarkdownHref(element.getAttribute("href") ?? "");
      return href ? "[" + children + "](" + href + ")" : children;
    }
    return children;
  };

  const serializeList = (element: HTMLElement, depth = 0): string => {
    const ordered = element.tagName === "OL";
    let number = 0;
    const rows = Array.from(element.children)
      .filter(child => child.tagName === "LI")
      .map(child => {
        number += 1;
        const item = child as HTMLElement;
        const text = Array.from(item.childNodes)
          .filter(node => !(node.nodeType === 1 && ["UL", "OL"].includes((node as HTMLElement).tagName)))
          .map(inline)
          .join("")
          .trim();
        const nested = Array.from(item.children)
          .filter(nestedList => nestedList.tagName === "UL" || nestedList.tagName === "OL")
          .map(nestedList => serializeList(nestedList as HTMLElement, depth + 1))
          .join("")
          .trimEnd();
        const prefix = ordered ? (number + ". ") : "- ";
        const itemAlignment = item.style.textAlign;
        const alignmentPrefix = !element.style.textAlign && ["left", "center", "right"].includes(itemAlignment)
          ? "{align=" + itemAlignment + "} "
          : "";
        return "  ".repeat(depth) + prefix + alignmentPrefix + text + (nested ? "\n" + nested : "");
      });
    return rows.join("\n") + "\n\n";
  };

  const block = (node: Node): string => {
    if (node.nodeType === 3) return node.textContent ?? "";
    if (node.nodeType !== 1) return "";

    const element = node as HTMLElement;
    const tag = element.tagName;
    const children = Array.from(element.childNodes);

    if (tag === "DIV" && element.classList.contains("markdown-code-block")) {
      const language = normalizeCodeLanguage(element.dataset.language ?? "plaintext");
      const codeElement = element.querySelector("pre code") ?? element.querySelector("pre");
      const code = codeElement ? serializeCodeText(codeElement).replace(/\n+$/, "") : "";
      const fenceLanguage = language === "plaintext" ? "" : language;
      const fence = String.fromCharCode(96).repeat(3);
      return fence + fenceLanguage + "\n" + code + "\n" + fence + "\n\n";
    }

    let content = "";
    if (tag === "H1" || tag === "H2" || tag === "H3") {
      const level = Number(tag.slice(1));
      content = "#".repeat(level) + " " + children.map(inline).join("") + "\n\n";
    } else if (tag === "P") {
      content = children.map(inline).join("") + "\n\n";
    } else if (tag === "UL" || tag === "OL") {
      content = serializeList(element);
    } else if (tag === "BLOCKQUOTE") {
      const quoteContent = children.map(block).join("").trimEnd();
      content = quoteContent.split("\n").map(line => line ? "> " + line : ">").join("\n") + "\n\n";
    } else if (tag === "PRE") {
      const fence = String.fromCharCode(96).repeat(3);
      content = fence + "\n" + serializeCodeText(element).replace(/\n+$/, "") + "\n" + fence + "\n\n";
    } else if (tag === "HR") {
      content = "---\n\n";
    } else if (tag === "DIV") {
      const hasBlockChild = children.some(child =>
        child.nodeType === 1 &&
        ["DIV", "P", "UL", "OL", "BLOCKQUOTE", "PRE", "H1", "H2", "H3", "HR"].includes((child as HTMLElement).tagName)
      );
      content = hasBlockChild ? children.map(block).join("") : children.map(inline).join("");
      content += content.endsWith("\n") ? "" : "\n";
    } else {
      content = inline(element);
    }

    const rawAlignment = element.dataset.checkpointAlign || element.style.textAlign;
    const alignment = rawAlignment === "left" || rawAlignment === "center" || rawAlignment === "right"
      ? rawAlignment
      : "";
    if (!alignment || !content.trim()) return content;

    return ":::align-" + alignment + "\n" + content.trimEnd() + "\n:::\n\n";
  };

  return Array.from(root.childNodes)
    .map(block)
    .join("")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
  onOpenCover,
  onSignOut,
  onDeleteAccount
}: Props) {
  const [notes, setNotes] = useState<MarkdownNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const activePageIndexRef = useRef(activePageIndex);
  activePageIndexRef.current = activePageIndex;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [exportFeedback, setExportFeedback] = useState("");
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pageDeleteOpen, setPageDeleteOpen] = useState(false);
  const [colorPaletteOpen, setColorPaletteOpen] = useState(false);
  const [customTextColor, setCustomTextColor] = useState("#7868e8");
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>("highlighter");
  const [highlighterMode, setHighlighterMode] = useState<"free" | "straight">("free");
  const [highlighterMenuOpen, setHighlighterMenuOpen] = useState(false);
  const [drawingColor, setDrawingColor] = useState("#F4D35E");
  const [currentStroke, setCurrentStroke] = useState<DrawingStroke | null>(null);
  const [drawingCanvasHeight, setDrawingCanvasHeight] = useState(1);
  const [drawingScrollTop, setDrawingScrollTop] = useState(0);
  const [noteImageUrls, setNoteImageUrls] = useState<Record<string, string>>({});
  const [imageUploading, setImageUploading] = useState(false);
  const [imageCropOpen, setImageCropOpen] = useState(false);
  const [imageCropRect, setImageCropRect] = useState<ImageCropRect>({ x: 0, y: 0, width: 100, height: 100 });
  const imageCropDragRef = useRef<{
    pointerId: number;
    mode: "move" | "resize";
    handle: string;
    startX: number;
    startY: number;
    startRect: ImageCropRect;
    stageWidth: number;
    stageHeight: number;
  } | null>(null);
  const leftEditorRef = useRef<HTMLDivElement>(null);
  const highlighterMenuRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const selectedImageElementRef = useRef<HTMLElement | null>(null);
  const movingImageElementRef = useRef<HTMLElement | null>(null);
  const imageTransformRef = useRef<{
    frame: HTMLElement;
    pointerId: number;
    kind: "rotate" | "resize";
    centerX: number;
    centerY: number;
    startAngle: number;
    startDistance: number;
    initialRotation: number;
    initialWidth: number;
  } | null>(null);
  const currentStrokeRef = useRef<DrawingStroke | null>(null);
  const drawingPointerIdRef = useRef<number | null>(null);
  const touchScrollYRef = useRef<number | null>(null);
  const stickyDragRef = useRef<{ id: string; pointerId: number; startClientX: number; startClientY: number; startX: number; startY: number } | null>(null);
  const editorSelectionRef = useRef<Range | null>(null);
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
  const storedImagePaths = useMemo(
    () => [...new Set(pageContents.flatMap(extractStoredImagePaths))],
    [pageContents]
  );
  const pageAnnotations = useMemo(
    () => decodeNoteAnnotations(activeNote?.content ?? ""),
    [activeNote?.content]
  );
  const currentPageAnnotations = pageAnnotations[activePageIndex] ?? createEmptyPageAnnotations(drawingCanvasHeight);

  const syncDrawingCanvasMetrics = useCallback(() => {
    const editor = leftEditorRef.current;
    if (!editor) return;
    const nextHeight = Math.max(1, editor.scrollHeight, editor.clientHeight);
    setDrawingCanvasHeight(current => current === nextHeight ? current : nextHeight);
    setDrawingScrollTop(current => current === editor.scrollTop ? current : editor.scrollTop);
  }, []);

  useEffect(() => {
    setActivePageIndex(0);
    setPageDeleteOpen(false);
    editorSelectionRef.current = null;
    setColorPaletteOpen(false);
    setDrawingMode(false);
    setDrawingTool("highlighter");
    setHighlighterMenuOpen(false);
    setCurrentStroke(null);
    currentStrokeRef.current = null;
    drawingPointerIdRef.current = null;
    selectedImageElementRef.current?.classList.remove("is-selected", "menu-open");
    selectedImageElementRef.current = null;
    movingImageElementRef.current = null;
    imageTransformRef.current = null;
    setImageCropOpen(false);
  }, [activeNoteId]);

  useEffect(() => {
    selectedImageElementRef.current?.classList.remove("is-selected", "menu-open");
    selectedImageElementRef.current = null;
    movingImageElementRef.current = null;
    imageTransformRef.current = null;
    setImageCropOpen(false);
  }, [activePageIndex, activeNoteId]);

  useEffect(() => {
    if (!pageDeleteOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPageDeleteOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [pageDeleteOpen]);

  useEffect(() => {
    if (!activeNote || loading) return;
    const ownedPrefix = userId + "/notes/" + notebookId + "/";
    const missingPaths = storedImagePaths.filter(path =>
      path.startsWith(ownedPrefix) && !noteImageUrls[path]
    );
    if (!missingPaths.length) return;

    let active = true;
    void Promise.all(missingPaths.map(async path => {
      const { data, error: signedError } = await client.storage
        .from("checkpoint-covers")
        .createSignedUrl(path, 60 * 60);
      return { path, url: signedError ? null : data?.signedUrl ?? null };
    })).then(results => {
      if (!active) return;
      const entries = results.filter((item): item is { path: string; url: string } => Boolean(item.url));
      if (entries.length) {
        setNoteImageUrls(current => ({ ...current, ...Object.fromEntries(entries.map(item => [item.path, item.url])) }));
      }
      if (results.some(item => !item.url)) setError("일부 이미지를 불러오지 못했습니다.");
    });

    return () => { active = false; };
  }, [client, userId, notebookId, activeNote?.id, loading, storedImagePaths, noteImageUrls]);

  useEffect(() => {
    const editor = leftEditorRef.current;
    if (!editor || !activeNote || loading) return;
    const pageKey = activeNote.id + ":" + activePageIndex;
    if (editor.dataset.pageKey !== pageKey) {
      editor.innerHTML = markdownToHtml(pageContents[activePageIndex] ?? "", noteImageUrls);
      editor.dataset.pageKey = pageKey;
    } else {
      editor.querySelectorAll<HTMLImageElement>("img[data-checkpoint-image-path]").forEach(image => {
        const path = image.dataset.checkpointImagePath;
        const signedUrl = path ? noteImageUrls[path] : undefined;
        if (signedUrl && image.getAttribute("src") !== signedUrl) image.src = signedUrl;
      });
    }
    syncDrawingCanvasMetrics();
  }, [activeNote, activePageIndex, loading, pageContents, noteImageUrls, syncDrawingCanvasMetrics]);

  useEffect(() => {
    const editor = leftEditorRef.current;
    if (!editor) return;
    syncDrawingCanvasMetrics();
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncDrawingCanvasMetrics) : null;
    const mutationObserver = typeof MutationObserver !== "undefined" ? new MutationObserver(syncDrawingCanvasMetrics) : null;
    resizeObserver?.observe(editor);
    mutationObserver?.observe(editor, { childList: true, subtree: true, characterData: true });
    editor.addEventListener("scroll", syncDrawingCanvasMetrics, { passive: true });
    return () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      editor.removeEventListener("scroll", syncDrawingCanvasMetrics);
    };
  }, [activeNoteId, activePageIndex, loading, syncDrawingCanvasMetrics]);

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
                content: encodeNotePages([""])
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

  function updateCurrentPage(value: string) {
    if (!activeNote) return;
    const nextPages = [...pageContents];
    nextPages[activePageIndex] = value;
    updateActiveNote({ content: encodeNotePages(nextPages, pageAnnotations) });
  }

  function updateCurrentPageAnnotations(nextAnnotations: FreeNotePageAnnotations[]) {
    if (!activeNote) return;
    const safeAnnotations = normalizePageAnnotations(nextAnnotations, pageContents.length);
    safeAnnotations[activePageIndex] = {
      ...safeAnnotations[activePageIndex],
      height: Math.max(1, drawingCanvasHeight)
    };
    updateActiveNote({ content: encodeNotePages(pageContents, safeAnnotations) });
  }

  function getCurrentPages() {
    const nextPages = [...pageContents];
    const editor = leftEditorRef.current;
    if (activeNote && editor) {
      while (nextPages.length <= activePageIndex) nextPages.push("");
      nextPages[activePageIndex] = htmlToMarkdown(editor.innerHTML);
    }
    return nextPages.length > 0 ? nextPages : [""];
  }

  function focusEditorAtEnd() {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const editor = leftEditorRef.current;
        if (!editor) return;
        editor.focus();
        const selection = window.getSelection();
        if (!selection) return;
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      });
    });
  }

  function goToPage(index: number) {
    if (!activeNote || loading || index < 0 || index >= pageContents.length || index === activePageIndex) return;
    updateActiveNote({ content: encodeNotePages(getCurrentPages(), pageAnnotations) });
    setActivePageIndex(index);
    setColorPaletteOpen(false);
    editorSelectionRef.current = null;
    window.getSelection()?.removeAllRanges();
    if (!drawingMode) focusEditorAtEnd();
  }

  function addPage() {
    if (!activeNote || loading) return;
    const nextPages = getCurrentPages();
    nextPages.push("");
    const nextAnnotations = [...pageAnnotations, createEmptyPageAnnotations()];
    updateActiveNote({ content: encodeNotePages(nextPages, nextAnnotations) });
    setDrawingMode(false);
    setCurrentStroke(null);
    currentStrokeRef.current = null;
    setActivePageIndex(nextPages.length - 1);
    setColorPaletteOpen(false);
    editorSelectionRef.current = null;
    window.getSelection()?.removeAllRanges();
    focusEditorAtEnd();
  }

  function deleteCurrentPage() {
    if (!activeNote || loading || pageContents.length <= 1) {
      setPageDeleteOpen(false);
      return;
    }

    const deletedPageIndex = activePageIndex;
    const nextPages = getCurrentPages();
    nextPages.splice(deletedPageIndex, 1);
    const nextAnnotations = [...pageAnnotations];
    nextAnnotations.splice(deletedPageIndex, 1);

    const editor = leftEditorRef.current;
    if (editor) editor.dataset.pageKey = "";

    updateActiveNote({ content: encodeNotePages(nextPages, nextAnnotations) });
    setActivePageIndex(Math.min(deletedPageIndex, nextPages.length - 1));
    setPageDeleteOpen(false);
    setDrawingMode(false);
    setCurrentStroke(null);
    currentStrokeRef.current = null;
    drawingPointerIdRef.current = null;
    setColorPaletteOpen(false);
    editorSelectionRef.current = null;
    window.getSelection()?.removeAllRanges();
    focusEditorAtEnd();
  }

  function getDrawingPoint(clientX: number, clientY: number): DrawingPoint | null {
    const editor = leftEditorRef.current;
    if (!editor) return null;
    const rect = editor.getBoundingClientRect();
    if (!rect.width) return null;
    return {
      x: Math.max(0, Math.min(1000, ((clientX - rect.left) / rect.width) * 1000)),
      y: Math.max(0, clientY - rect.top + editor.scrollTop)
    };
  }

  function addStickyNote(point: DrawingPoint) {
    const nextAnnotations = [...pageAnnotations];
    const current = nextAnnotations[activePageIndex] ?? createEmptyPageAnnotations(drawingCanvasHeight);
    nextAnnotations[activePageIndex] = {
      ...current,
      height: Math.max(1, drawingCanvasHeight),
      notes: [...current.notes, {
        id: createDrawingId(),
        x: point.x,
        y: point.y,
        text: "",
        color: "#FFF2B8"
      }]
    };
    updateCurrentPageAnnotations(nextAnnotations);
  }

  function updateStickyNote(noteId: string, patch: Partial<StickyNote>) {
    const nextAnnotations = [...pageAnnotations];
    const current = nextAnnotations[activePageIndex] ?? createEmptyPageAnnotations(drawingCanvasHeight);
    nextAnnotations[activePageIndex] = {
      ...current,
      notes: current.notes.map(note => note.id === noteId ? { ...note, ...patch } : note)
    };
    updateCurrentPageAnnotations(nextAnnotations);
  }

  function deleteStickyNote(noteId: string) {
    const nextAnnotations = [...pageAnnotations];
    const current = nextAnnotations[activePageIndex] ?? createEmptyPageAnnotations(drawingCanvasHeight);
    nextAnnotations[activePageIndex] = {
      ...current,
      notes: current.notes.filter(note => note.id !== noteId)
    };
    updateCurrentPageAnnotations(nextAnnotations);
  }

  function eraseDrawingAt(point: DrawingPoint) {
    const editor = leftEditorRef.current;
    if (!editor) return;
    const rect = editor.getBoundingClientRect();
    const current = pageAnnotations[activePageIndex] ?? createEmptyPageAnnotations(drawingCanvasHeight);
    const strokes = current.strokes.filter(stroke => {
      for (let index = 0; index < stroke.points.length; index += 1) {
        const candidate = stroke.points[index];
        const x = (candidate.x - point.x) / 1000 * rect.width;
        const y = candidate.y - point.y;
        if (Math.hypot(x, y) <= 24) return false;
        if (index === 0) continue;
        const previous = stroke.points[index - 1];
        const previousX = (previous.x - point.x) / 1000 * rect.width;
        const previousY = previous.y - point.y;
        const dx = x - previousX;
        const dy = y - previousY;
        const lengthSquared = dx * dx + dy * dy;
        const fraction = lengthSquared === 0 ? 0
          : Math.max(0, Math.min(1, -(previousX * dx + previousY * dy) / lengthSquared));
        if (Math.hypot(previousX + dx * fraction, previousY + dy * fraction) <= 24) return false;
      }
      return true;
    });
    const notes = current.notes.filter(note => {
      const dx = Math.abs(note.x - point.x) / 1000 * rect.width;
      const dy = point.y - note.y;
      return !(dx <= 100 && dy >= -12 && dy <= 132);
    });
    if (strokes.length === current.strokes.length && notes.length === current.notes.length) return;
    const nextAnnotations = [...pageAnnotations];
    nextAnnotations[activePageIndex] = { ...current, strokes, notes };
    updateCurrentPageAnnotations(nextAnnotations);
  }

  function handleDrawingPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (!drawingMode || !activeNote || loading) return;
    const point = getDrawingPoint(event.clientX, event.clientY);
    if (!point) return;
    if (drawingTool === "sticky") {
      event.preventDefault();
      addStickyNote(point);
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingPointerIdRef.current = event.pointerId;
    if (drawingTool === "eraser") {
      eraseDrawingAt(point);
      return;
    }

    const stroke: DrawingStroke = {
      id: createDrawingId(),
      tool: drawingTool,
      color: drawingColor,
      points: [point]
    };
    currentStrokeRef.current = stroke;
    setCurrentStroke(stroke);
  }

  function handleDrawingPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!drawingMode || drawingPointerIdRef.current !== event.pointerId) return;
    const point = getDrawingPoint(event.clientX, event.clientY);
    if (!point) return;
    if (drawingTool === "eraser") {
      eraseDrawingAt(point);
      return;
    }
    const current = currentStrokeRef.current;
    if (!current) return;
    const previous = current.points[current.points.length - 1];
    if (previous && Math.hypot((point.x - previous.x) / 1000 * (leftEditorRef.current?.clientWidth ?? 1), point.y - previous.y) < 1.5) return;
    const points = current.tool === "highlighter" && highlighterMode === "straight"
      ? [current.points[0], point]
      : [...current.points, point];
    const nextStroke = { ...current, points };
    currentStrokeRef.current = nextStroke;
    setCurrentStroke(nextStroke);
  }

  function cancelDrawingPointer(event: ReactPointerEvent<SVGSVGElement>) {
    if (drawingPointerIdRef.current !== event.pointerId) return;
    drawingPointerIdRef.current = null;
    currentStrokeRef.current = null;
    setCurrentStroke(null);
  }

  function handleDrawingWheel(event: ReactWheelEvent<SVGSVGElement>) {
    const editor = leftEditorRef.current;
    if (!drawingMode || !editor) return;
    event.preventDefault();
    editor.scrollTop += event.deltaY;
    editor.scrollLeft += event.deltaX;
    syncDrawingCanvasMetrics();
  }

  function handleDrawingTouchStart(event: ReactTouchEvent<SVGSVGElement>) {
    if (event.touches.length < 2) return;
    const averageY = Array.from(event.touches).reduce((total, touch) => total + touch.clientY, 0) / event.touches.length;
    touchScrollYRef.current = averageY;
    drawingPointerIdRef.current = null;
    currentStrokeRef.current = null;
    setCurrentStroke(null);
  }

  function handleDrawingTouchMove(event: ReactTouchEvent<SVGSVGElement>) {
    if (event.touches.length < 2) return;
    const editor = leftEditorRef.current;
    if (!editor) return;
    const averageY = Array.from(event.touches).reduce((total, touch) => total + touch.clientY, 0) / event.touches.length;
    if (touchScrollYRef.current !== null) {
      editor.scrollTop += touchScrollYRef.current - averageY;
      syncDrawingCanvasMetrics();
    }
    touchScrollYRef.current = averageY;
    event.preventDefault();
  }

  function handleDrawingTouchEnd(event: ReactTouchEvent<SVGSVGElement>) {
    if (event.touches.length < 2) touchScrollYRef.current = null;
  }

  function finishDrawingPointer(event: ReactPointerEvent<SVGSVGElement>) {
    if (drawingPointerIdRef.current !== event.pointerId) return;
    drawingPointerIdRef.current = null;
    let stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    setCurrentStroke(null);
    if (!stroke || stroke.points.length === 0) return;
    if (stroke.tool === "highlighter" && highlighterMode === "straight") {
      const endPoint = getDrawingPoint(event.clientX, event.clientY);
      if (endPoint) stroke = { ...stroke, points: [stroke.points[0], endPoint] };
    }
    const nextAnnotations = [...pageAnnotations];
    const current = nextAnnotations[activePageIndex] ?? createEmptyPageAnnotations(drawingCanvasHeight);
    nextAnnotations[activePageIndex] = {
      ...current,
      height: Math.max(1, drawingCanvasHeight),
      strokes: [...current.strokes, stroke]
    };
    updateCurrentPageAnnotations(nextAnnotations);
  }

  useEffect(() => {
    if (!highlighterMenuOpen) return;
    const closeWhenOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !highlighterMenuRef.current?.contains(event.target)) {
        setHighlighterMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHighlighterMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [highlighterMenuOpen]);

  function enterDrawingMode() {
    const editor = leftEditorRef.current;
    if (editor) updateCurrentPage(htmlToMarkdown(editor.innerHTML));
    setColorPaletteOpen(false);
    editorSelectionRef.current = null;
    window.getSelection()?.removeAllRanges();
    setDrawingTool("highlighter");
    setHighlighterMenuOpen(false);
    setDrawingMode(true);
    syncDrawingCanvasMetrics();
  }

  function exitDrawingMode() {
    setDrawingMode(false);
    setHighlighterMenuOpen(false);
    setCurrentStroke(null);
    currentStrokeRef.current = null;
    drawingPointerIdRef.current = null;
    window.getSelection()?.removeAllRanges();
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => leftEditorRef.current?.focus());
    });
  }

  function beginStickyNoteDrag(event: ReactPointerEvent<HTMLDivElement>, note: StickyNote) {
    if (!drawingMode) return;
    event.preventDefault();
    event.stopPropagation();
    stickyDragRef.current = {
      id: note.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: note.x,
      startY: note.y
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveStickyNoteDrag(event: ReactPointerEvent<HTMLDivElement>, noteId: string) {
    const drag = stickyDragRef.current;
    if (!drawingMode || !drag || drag.id !== noteId || drag.pointerId !== event.pointerId) return;
    const editor = leftEditorRef.current;
    if (!editor) return;
    const rect = editor.getBoundingClientRect();
    const nextX = Math.max(90, Math.min(910, drag.startX + (event.clientX - drag.startClientX) / Math.max(1, rect.width) * 1000));
    const nextY = Math.max(0, drag.startY + event.clientY - drag.startClientY);
    updateStickyNote(noteId, { x: nextX, y: nextY });
  }

  function finishStickyNoteDrag(event: ReactPointerEvent<HTMLDivElement>, noteId: string) {
    const drag = stickyDragRef.current;
    if (drag?.id === noteId && drag.pointerId === event.pointerId) stickyDragRef.current = null;
  }

  function rememberEditorSelection() {
    const editor = leftEditorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount || !selection.anchorNode || !selection.focusNode) return;
    if (editor.contains(selection.anchorNode) && editor.contains(selection.focusNode)) {
      editorSelectionRef.current = selection.getRangeAt(0).cloneRange();
    }
  }

  function getEditorRangeAtPoint(clientX: number, clientY: number) {
    const editor = leftEditorRef.current;
    if (!editor) return null;
    const documentWithCaret = document as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };
    const pointRange = documentWithCaret.caretRangeFromPoint?.(clientX, clientY);
    if (pointRange && editor.contains(pointRange.commonAncestorContainer)) return pointRange;
    const position = documentWithCaret.caretPositionFromPoint?.(clientX, clientY);
    if (position && editor.contains(position.offsetNode)) {
      const range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      return range;
    }
    return null;
  }

  function rememberEditorSelectionAtPoint(clientX: number, clientY: number) {
    const range = getEditorRangeAtPoint(clientX, clientY);
    if (range) editorSelectionRef.current = range.cloneRange();
    else rememberEditorSelection();
  }

  function selectNoteImage(frame: HTMLElement) {
    if (selectedImageElementRef.current !== frame) {
      selectedImageElementRef.current?.classList.remove("is-selected", "menu-open");
    }
    selectedImageElementRef.current = frame;
    frame.classList.add("is-selected");
  }

  function clearSelectedNoteImage() {
    selectedImageElementRef.current?.classList.remove("is-selected", "menu-open");
    selectedImageElementRef.current = null;
    setImageCropOpen(false);
  }

  function applyNoteImageFrameStyles(frame: HTMLElement) {
    const image = frame.querySelector<HTMLImageElement>("img.markdown-note-image");
    const visual = frame.querySelector<HTMLElement>(".markdown-note-image-content");
    if (!image || !visual) return;
    const width = Math.min(100, Math.max(20, Number(frame.dataset.checkpointImageWidth) || 80));
    const ratioValue = frame.dataset.checkpointImageRatio ?? "original";
    const ratio = ["original", "1:1", "4:3", "16:9", "3:4"].includes(ratioValue) ? ratioValue : "original";
    const zoom = Math.min(300, Math.max(100, Number(frame.dataset.checkpointImageZoom) || 100));
    const cropXValue = Number(frame.dataset.checkpointImageX);
    const cropYValue = Number(frame.dataset.checkpointImageY);
    const cropX = Number.isFinite(cropXValue) ? Math.min(100, Math.max(0, cropXValue)) : 50;
    const cropY = Number.isFinite(cropYValue) ? Math.min(100, Math.max(0, cropYValue)) : 50;
    frame.style.display = "block";
    frame.style.position = "relative";
    frame.style.boxSizing = "border-box";
    frame.style.width = width + "%";
    frame.style.maxWidth = "100%";
    frame.style.margin = "26px auto";
    frame.style.overflow = "visible";
    frame.style.aspectRatio = ratio === "original" ? "" : ratio.replace(":", " / ");
    const rotation = Number(frame.dataset.checkpointImageRotation);
    visual.style.transform = "rotate(" + (Number.isFinite(rotation) ? Math.min(180, Math.max(-180, rotation)) : 0) + "deg)";
    visual.style.transformOrigin = "center center";
    visual.style.position = ratio === "original" ? "relative" : "absolute";
    visual.style.inset = ratio === "original" ? "" : "0";
    visual.style.height = ratio === "original" ? "" : "100%";
    if (ratio === "original") {
      image.style.cssText = [
        "display:block",
        "position:relative",
        "width:100%",
        "height:auto",
        "max-width:100%",
        "object-fit:contain",
        "transform:scale(" + zoom / 100 + ")",
        "transform-origin:" + cropX + "% " + cropY + "%"
      ].join(";");
    } else {
      image.style.cssText = [
        "display:block",
        "position:absolute",
        "inset:0",
        "width:100%",
        "height:100%",
        "max-width:none",
        "object-fit:cover",
        "object-position:" + cropX + "% " + cropY + "%",
        "transform:scale(" + zoom / 100 + ")",
        "transform-origin:" + cropX + "% " + cropY + "%"
      ].join(";");
    }
  }

  function updateSelectedImageWidth(value: number) {
    const frame = selectedImageElementRef.current;
    const editor = leftEditorRef.current;
    if (!frame || !editor) return;
    const width = Math.min(100, Math.max(20, value));
    frame.dataset.checkpointImageWidth = String(width);
    applyNoteImageFrameStyles(frame);
    updateCurrentPage(htmlToMarkdown(editor.innerHTML));
    syncDrawingCanvasMetrics();
  }

  function startNoteImageTransform(event: ReactPointerEvent<HTMLDivElement>) {
    const handle = (event.target as HTMLElement).closest<HTMLButtonElement>(
      ".markdown-note-image-rotate-handle, .markdown-note-image-resize-handle"
    );
    const frame = handle?.closest<HTMLElement>(".markdown-note-image-frame");
    if (!handle || !frame || !leftEditorRef.current?.contains(frame) || drawingMode) return;
    event.preventDefault();
    event.stopPropagation();
    selectNoteImage(frame);
    frame.classList.remove("menu-open");
    const rect = frame.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const kind = handle.classList.contains("markdown-note-image-rotate-handle") ? "rotate" : "resize";
    imageTransformRef.current = {
      frame,
      pointerId: event.pointerId,
      kind,
      centerX,
      centerY,
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
      startDistance: Math.max(8, Math.hypot(event.clientX - centerX, event.clientY - centerY)),
      initialRotation: Number(frame.dataset.checkpointImageRotation) || 0,
      initialWidth: Math.min(100, Math.max(20, Number(frame.dataset.checkpointImageWidth) || 80))
    };
    handle.setPointerCapture(event.pointerId);
  }

  function moveNoteImageTransform(event: ReactPointerEvent<HTMLDivElement>) {
    const active = imageTransformRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    if (active.kind === "rotate") {
      const angle = Math.atan2(event.clientY - active.centerY, event.clientX - active.centerX);
      const delta = (angle - active.startAngle) * 180 / Math.PI;
      const rotation = ((active.initialRotation + delta + 180) % 360 + 360) % 360 - 180;
      active.frame.dataset.checkpointImageRotation = String(Math.round(rotation * 10) / 10);
    } else {
      const distance = Math.max(8, Math.hypot(event.clientX - active.centerX, event.clientY - active.centerY));
      const width = Math.max(20, Math.min(100, Math.round(active.initialWidth * distance / active.startDistance)));
      active.frame.dataset.checkpointImageWidth = String(width);
    }
    applyNoteImageFrameStyles(active.frame);
  }

  function finishNoteImageTransform(pointerId: number) {
    const active = imageTransformRef.current;
    if (!active || active.pointerId !== pointerId) return;
    imageTransformRef.current = null;
    const editor = leftEditorRef.current;
    if (!editor || !editor.contains(active.frame)) return;
    if (active.kind === "resize") {
      updateSelectedImageWidth(Number(active.frame.dataset.checkpointImageWidth) || 80);
    } else {
      updateCurrentPage(htmlToMarkdown(editor.innerHTML));
      syncDrawingCanvasMetrics();
    }
  }

  function openImageCropEditor() {
    const frame = selectedImageElementRef.current;
    const image = frame?.querySelector<HTMLImageElement>("img.markdown-note-image");
    if (!frame || !image) return;
    const ratioValue = frame.dataset.checkpointImageRatio ?? "original";
    const ratio = ["original", "1:1", "4:3", "16:9", "3:4"].includes(ratioValue)
      ? ratioValue as "original" | "1:1" | "4:3" | "16:9" | "3:4"
      : "original";
    setImageCropRatio(ratio);
    setImageCropZoom(Math.min(300, Math.max(100, Number(frame.dataset.checkpointImageZoom) || 100)));
    const cropXValue = Number(frame.dataset.checkpointImageX);
    const cropYValue = Number(frame.dataset.checkpointImageY);
    setImageCropX(Number.isFinite(cropXValue) ? Math.min(100, Math.max(0, cropXValue)) : 50);
    setImageCropY(Number.isFinite(cropYValue) ? Math.min(100, Math.max(0, cropYValue)) : 50);
    setImageCropOpen(true);
  }

  function saveImageCrop() {
    const frame = selectedImageElementRef.current;
    const editor = leftEditorRef.current;
    if (!frame || !editor) return;
    frame.dataset.checkpointImageRatio = imageCropRatio;
    frame.dataset.checkpointImageZoom = String(imageCropZoom);
    frame.dataset.checkpointImageX = String(imageCropX);
    frame.dataset.checkpointImageY = String(imageCropY);
    applyNoteImageFrameStyles(frame);
    updateCurrentPage(htmlToMarkdown(editor.innerHTML));
    setImageCropOpen(false);
    syncDrawingCanvasMetrics();
  }

  function removeSelectedNoteImage() {
    const frame = selectedImageElementRef.current;
    const editor = leftEditorRef.current;
    if (!frame || !editor) return;
    frame.remove();
    updateCurrentPage(htmlToMarkdown(editor.innerHTML));
    clearSelectedNoteImage();
    syncDrawingCanvasMetrics();
  }

  async function uploadAndInsertImage(file: File) {
    const targetNoteId = activeNote?.id;
    const targetPageIndex = activePageIndex;
    if (!targetNoteId || !activeNote || loading || imageUploading) return;

    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif"
    };
    const extension = extensions[file.type];
    if (!extension) {
      setError("PNG, JPG, WEBP, GIF 형식의 이미지만 추가할 수 있습니다.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("이미지는 5MB 이하만 추가할 수 있습니다.");
      return;
    }

    setImageUploading(true);
    setError("");
    const path = userId + "/notes/" + notebookId + "/" + targetNoteId + "/" + createDrawingId() + "." + extension;
    let uploaded = false;

    try {
      const { error: uploadError } = await client.storage
        .from("checkpoint-covers")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      uploaded = true;

      const { data, error: signedError } = await client.storage
        .from("checkpoint-covers")
        .createSignedUrl(path, 60 * 60);
      if (signedError || !data?.signedUrl) {
        throw signedError ?? new Error("이미지 주소를 만들지 못했습니다.");
      }

      if (currentNoteRef.current?.id !== targetNoteId || activePageIndexRef.current !== targetPageIndex) {
        await client.storage.from("checkpoint-covers").remove([path]);
        uploaded = false;
        return;
      }

      const editor = leftEditorRef.current;
      if (!editor) {
        await client.storage.from("checkpoint-covers").remove([path]);
        uploaded = false;
        return;
      }

      setNoteImageUrls(current => ({ ...current, [path]: data.signedUrl }));
      editor.focus();

      const savedRange = editorSelectionRef.current;
      const range = savedRange && editor.contains(savedRange.commonAncestorContainer)
        ? savedRange.cloneRange()
        : document.createRange();
      if (!savedRange || !editor.contains(savedRange.commonAncestorContainer)) {
        range.selectNodeContents(editor);
        range.collapse(false);
      }

      const rangeNode = range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer as HTMLElement
        : range.commonAncestorContainer.parentElement;
      const codeBlock = rangeNode?.closest(".markdown-code-block");
      if (codeBlock) {
        range.selectNode(codeBlock);
        range.collapse(false);
      }

      range.deleteContents();
      const frame = document.createElement("span");
      frame.className = "markdown-note-image-frame";
      frame.dataset.checkpointImagePath = path;
      frame.dataset.checkpointImageWidth = "80";
      frame.dataset.checkpointImageRatio = "original";
      frame.dataset.checkpointImageZoom = "100";
      frame.dataset.checkpointImageX = "50";
      frame.dataset.checkpointImageY = "50";
      frame.dataset.checkpointImageRotation = "0";
      frame.contentEditable = "false";
      frame.draggable = true;

      const image = document.createElement("img");
      image.className = "markdown-note-image";
      image.dataset.checkpointImagePath = path;
      image.src = data.signedUrl;
      image.alt = file.name.replace(/\.[^.]+$/, "").replace(/[\[\]()\r\n]/g, " ").trim() || "이미지";
      image.draggable = false;
      const visual = document.createElement("span");
      visual.className = "markdown-note-image-content";
      visual.append(image);
      frame.append(visual);
      frame.insertAdjacentHTML("beforeend", noteImageControlsMarkup());
      applyNoteImageFrameStyles(frame);
      range.insertNode(frame);
      selectNoteImage(frame);

      const lineBreak = document.createElement("br");
      frame.after(lineBreak);
      const nextRange = document.createRange();
      nextRange.setStartAfter(lineBreak);
      nextRange.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(nextRange);
      editorSelectionRef.current = nextRange.cloneRange();

      updateCurrentPage(htmlToMarkdown(editor.innerHTML));
      syncDrawingCanvasMetrics();
      editor.focus();
    } catch (uploadError) {
      if (uploaded) await client.storage.from("checkpoint-covers").remove([path]);
      const message = uploadError instanceof Error ? uploadError.message : "네트워크 연결을 확인해 주세요.";
      setError("이미지 업로드에 실패했습니다: " + message);
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  function applyTextColor(color: string, options: { keepPickerOpen?: boolean } = {}) {
    const editor = leftEditorRef.current;
    const keepPickerOpen = options.keepPickerOpen ?? false;
    if (!editor || !activeNote || loading) return;

    if (!keepPickerOpen) editor.focus();

    const selection = window.getSelection();
    const savedRange = editorSelectionRef.current;
    if (selection && savedRange && editor.contains(savedRange.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
    }

    if (
      !selection?.rangeCount ||
      selection.isCollapsed ||
      !selection.anchorNode ||
      !selection.focusNode ||
      !editor.contains(selection.anchorNode) ||
      !editor.contains(selection.focusNode)
    ) {
      return;
    }

    document.execCommand("foreColor", false, color);
    updateCurrentPage(htmlToMarkdown(editor.innerHTML));

    if (keepPickerOpen) {
      if (selection.rangeCount > 0) {
        const currentRange = selection.getRangeAt(0);
        if (editor.contains(currentRange.commonAncestorContainer)) {
          editorSelectionRef.current = currentRange.cloneRange();
        }
      }
      return;
    }

    editorSelectionRef.current = null;
    setColorPaletteOpen(false);
    editor.focus();
  }

  function applyThemeTextColor() {
    const editor = leftEditorRef.current;
    const rawColor = editor ? getComputedStyle(editor).getPropertyValue("--accent").trim() : customColor;
    applyTextColor(normalizeMarkdownColor(rawColor) || customColor || "#7868e8");
  }

  function applyDefaultTextColor() {
    applyTextColor("#000000");
  }

  function insertCodeBlock() {
    const editor = leftEditorRef.current;
    if (!editor || !activeNote || loading) return;

    const selection = window.getSelection();
    const hasEditorSelection = Boolean(
      selection?.rangeCount &&
      selection.anchorNode &&
      editor.contains(selection.anchorNode)
    );
    const selectedCode = hasEditorSelection ? selection?.toString() ?? "" : "";

    editor.focus();
    document.execCommand(
      "insertHTML",
      false,
      createMarkdownCodeBlockHtml(selectedCode, DEFAULT_CODE_LANGUAGE, true)
    );

    const inserted = editor.querySelector<HTMLElement>('.markdown-code-block[data-inserted="true"]');
    if (inserted) {
      inserted.removeAttribute("data-inserted");
      const code = inserted.querySelector("pre code");
      if (code && selection) {
        const range = document.createRange();
        range.selectNodeContents(code);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    updateCurrentPage(htmlToMarkdown(editor.innerHTML));
    editor.focus();
  }

  function applyMarkdown(action: MarkdownAction) {
    const editor = leftEditorRef.current;
    if (!editor || !activeNote || loading) return;

    editor.focus();

    if (action === "bold") {
      document.execCommand("bold");
    } else if (action === "italic") {
      document.execCommand("italic");
    } else if (action === "underline") {
      document.execCommand("underline");
    } else if (action === "strike") {
      document.execCommand("strikeThrough");
    } else if (action === "heading") {
      document.execCommand("formatBlock", false, "H1");
    } else if (action === "bullet") {
      document.execCommand("insertUnorderedList");
    } else if (action === "ordered") {
      document.execCommand("insertOrderedList");
    } else if (action === "quote") {
      document.execCommand("formatBlock", false, "BLOCKQUOTE");
    } else if (action === "code") {
      insertCodeBlock();
      return;
    } else if (action === "divider") {
      document.execCommand("insertHorizontalRule");
    }

    updateCurrentPage(htmlToMarkdown(editor.innerHTML));
    editor.focus();
  }

  function applyTextAlignment(alignment: "left" | "center" | "right") {
    const editor = leftEditorRef.current;
    if (!editor || !activeNote || loading) return;

    editor.focus();
    const command = alignment === "left"
      ? "justifyLeft"
      : alignment === "center"
        ? "justifyCenter"
        : "justifyRight";
    document.execCommand(command);
    updateCurrentPage(htmlToMarkdown(editor.innerHTML));
    editor.focus();
  }

  async function renderFullNotebookCanvas(): Promise<{ canvas: HTMLCanvasElement; pageCount: number; outputScale: number }> {
    const editor = leftEditorRef.current;
    if (!activeNote || !editor || loading) throw new Error("프리노트를 먼저 열어 주세요.");

    const pagesForImage = getCurrentPages();
    const imagePathsForExport = [...new Set(pagesForImage.flatMap(extractStoredImagePaths))];
    const signedExportImages = await Promise.all(imagePathsForExport.map(async path => {
      const ownedPrefix = userId + "/notes/" + notebookId + "/";
      if (!path.startsWith(ownedPrefix)) return null;
      const { data, error: signedError } = await client.storage
        .from("checkpoint-covers")
        .createSignedUrl(path, 60 * 60);
      if (signedError || !data?.signedUrl) {
        throw new Error("노트에 포함된 이미지를 불러오지 못했습니다.");
      }
      return [path, data.signedUrl] as const;
    }));
    const exportImageUrls = {
      ...noteImageUrls,
      ...Object.fromEntries(signedExportImages.filter((item): item is readonly [string, string] => item !== null))
    };
    setNoteImageUrls(current => ({ ...current, ...exportImageUrls }));
    const annotationsForImage = normalizePageAnnotations(pageAnnotations, pagesForImage.length);
    if (currentStroke) {
      const currentAnnotations = annotationsForImage[activePageIndex] ?? createEmptyPageAnnotations();
      annotationsForImage[activePageIndex] = {
        ...currentAnnotations,
        strokes: [
          ...currentAnnotations.strokes.filter(stroke => stroke.id !== currentStroke.id),
          currentStroke
        ]
      };
    }

    let exportRoot: HTMLDivElement | null = null;

    try {
      await loadHtml2Canvas();
      if (!window.html2canvas) throw new Error("이미지 변환 도구를 사용할 수 없습니다.");

      if (document.fonts?.ready) await document.fonts.ready;

      const editorStyles = window.getComputedStyle(editor);
      const fullWidth = Math.ceil(editor.getBoundingClientRect().width);
      const basePageHeight = Math.ceil(Math.max(320, editor.clientHeight, drawingCanvasHeight));

      if (fullWidth <= 0 || basePageHeight <= 0) {
        throw new Error("노트의 크기를 확인할 수 없습니다.");
      }

      exportRoot = document.createElement("div");
      exportRoot.className = "markdown-free-note-section markdown-long-image-export-root";
      exportRoot.style.cssText = [
        "position:absolute",
        "left:-10000px",
        "top:0",
        "display:block !important",
        "flex:none !important",
        "width:" + fullWidth + "px !important",
        "min-width:0 !important",
        "min-height:0 !important",
        "height:auto !important",
        "max-height:none !important",
        "margin:0 !important",
        "padding:0 !important",
        "overflow:visible !important",
        "background:#ffffff",
        "color:" + editorStyles.color,
        "font-family:" + editorStyles.fontFamily,
        "box-sizing:border-box",
        "z-index:-1",
        "visibility:visible"
      ].join(";");

      ["--accent", "--line", "--paper", "--soft", "--ink", "--font"].forEach(variable => {
        const value = editorStyles.getPropertyValue(variable).trim();
        if (value) exportRoot?.style.setProperty(variable, value);
      });

      const pagesRoot = document.createElement("div");
      pagesRoot.className = "markdown-long-image-pages";
      pagesRoot.style.cssText = [
        "display:flex",
        "flex-direction:column",
        "gap:0px",
        "width:100%",
        "height:auto",
        "margin:0",
        "padding:0",
        "box-sizing:border-box"
      ].join(";");

      const pageRecords: Array<{
        paper: HTMLDivElement;
        viewport: HTMLDivElement;
        editor: HTMLDivElement;
        drawingLayer: SVGSVGElement | null;
        stickyLayer: HTMLDivElement;
        stickyNotes: Array<{ element: HTMLDivElement; top: number }>;
        annotationHeight: number;
        drawingHeight: number;
      }> = [];

      pagesForImage.forEach((markdown, index) => {
        const annotations = annotationsForImage[index] ?? createEmptyPageAnnotations(basePageHeight);

        const page = document.createElement("section");
        page.className = "markdown-long-image-page";
        page.dataset.pageIndex = String(index);
        page.style.cssText = [
          "display:block",
          "width:100%",
          "min-width:0",
          "margin:0",
          "padding:0",
          "box-sizing:border-box"
        ].join(";");

        const paper = document.createElement("div");
        paper.className = "free-note-paper markdown-long-image-paper";
        paper.style.cssText = [
          "position:relative",
          "display:block",
          "flex:none",
          "width:100%",
          "height:auto",
          "min-height:" + basePageHeight + "px",
          "max-height:none",
          "overflow:visible",
          "box-sizing:border-box",
          "border:0",
          "border-radius:0",
          "background:var(--soft)"
        ].join(";");

        const viewport = document.createElement("div");
        viewport.className = "free-note-editor-viewport markdown-long-image-viewport";
        viewport.style.cssText = [
          "position:relative",
          "display:block",
          "width:100%",
          "height:auto",
          "min-height:" + basePageHeight + "px",
          "max-height:none",
          "overflow:visible",
          "isolation:isolate",
          "box-sizing:border-box"
        ].join(";");

        const pageEditor = document.createElement("div");
        pageEditor.className = "free-note-input markdown-editor-grid";
        pageEditor.innerHTML = markdownToHtml(markdown, exportImageUrls);
        pageEditor.style.cssText = [
          "position:relative !important",
          "z-index:1 !important",
          "display:block !important",
          "flex:0 0 auto !important",
          "box-sizing:border-box !important",
          "width:100% !important",
          "height:auto !important",
          "min-height:" + basePageHeight + "px !important",
          "max-height:none !important",
          "margin:0 !important",
          "padding:18px 22px !important",
          "overflow:visible !important",
          "overflow-y:visible !important",
          "border:0 !important",
          "border-radius:0 !important",
          "outline:0 !important",
          "box-shadow:none !important"
        ].join(";");

        pageEditor.querySelectorAll<HTMLSelectElement>(".markdown-code-language").forEach(select => {
          const language = document.createElement("span");
          language.className = "markdown-code-language-label";
          language.textContent = select.selectedOptions[0]?.textContent?.trim() || select.value.toUpperCase();
          language.style.cssText = "color:#68748a;font-size:9px;";
          select.replaceWith(language);
        });
        pageEditor.querySelectorAll("button, input, textarea, script, iframe, object, embed").forEach(element => element.remove());
        pageEditor.querySelectorAll<HTMLElement>("*").forEach(element => {
          element.removeAttribute("contenteditable");
          Array.from(element.attributes).forEach(attribute => {
            if (attribute.name.toLowerCase().startsWith("on")) element.removeAttribute(attribute.name);
            if (
              ["href", "src"].includes(attribute.name.toLowerCase()) &&
              /^\s*javascript:/i.test(attribute.value)
            ) element.removeAttribute(attribute.name);
          });
        });

        const maxStrokeY = annotations.strokes.reduce(
          (bottom, stroke) => Math.max(bottom, ...stroke.points.map(point => point.y)),
          0
        );
        const drawingHeight = Math.ceil(Math.max(1, annotations.height, maxStrokeY + 24));
        let drawingLayer: SVGSVGElement | null = null;

        if (annotations.strokes.length > 0) {
          drawingLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          drawingLayer.classList.add("free-note-drawing-layer");
          drawingLayer.setAttribute("viewBox", "0 0 1000 " + drawingHeight);
          drawingLayer.setAttribute("preserveAspectRatio", "none");
          drawingLayer.setAttribute("aria-hidden", "true");
          drawingLayer.style.cssText = [
            "position:absolute",
            "top:0",
            "left:0",
            "z-index:4",
            "display:block",
            "width:100%",
            "height:" + drawingHeight + "px",
            "pointer-events:none",
            "touch-action:none",
            "overflow:visible",
            "transform:none"
          ].join(";");

          annotations.strokes.forEach(stroke => {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const pathData = stroke.points.map((point, pointIndex) =>
              (pointIndex === 0 ? "M " : "L ") + point.x + " " + point.y
            ).join(" ");
            path.setAttribute("d", stroke.points.length === 1 ? pathData + " l 0.1 0" : pathData);
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", stroke.color);
            path.setAttribute("stroke-width", stroke.tool === "highlighter" ? "18" : "3.2");
            path.setAttribute("stroke-opacity", stroke.tool === "highlighter" ? "0.42" : "0.95");
            path.setAttribute("stroke-linecap", "round");
            path.setAttribute("stroke-linejoin", "round");
            path.setAttribute("vector-effect", "non-scaling-stroke");
            drawingLayer?.appendChild(path);
          });
        }

        const stickyLayer = document.createElement("div");
        stickyLayer.className = "free-note-sticky-layer markdown-long-image-sticky-layer";
        stickyLayer.style.cssText = [
          "position:absolute",
          "top:0",
          "left:0",
          "z-index:5",
          "width:100%",
          "height:" + basePageHeight + "px",
          "pointer-events:none",
          "transform:none",
          "overflow:visible"
        ].join(";");

        const stickyNotes: Array<{ element: HTMLDivElement; top: number }> = [];
        annotations.notes.forEach(note => {
          const sticky = document.createElement("div");
          sticky.className = "free-note-sticky-note";
          sticky.style.left = (note.x / 10) + "%";
          sticky.style.top = note.y + "px";
          sticky.style.backgroundColor = note.color;

          const header = document.createElement("div");
          header.className = "free-note-sticky-note-header";
          header.textContent = "MEMO";

          const body = document.createElement("div");
          body.className = "markdown-long-image-sticky-note-body";
          body.textContent = note.text;
          body.style.cssText = [
            "display:block",
            "flex:1 1 auto",
            "width:100%",
            "min-height:84px",
            "height:auto",
            "padding:8px 9px",
            "box-sizing:border-box",
            "background:transparent",
            "color:#38332a",
            "font-family:" + editorStyles.fontFamily,
            "font-size:12px",
            "font-weight:500",
            "line-height:1.5",
            "white-space:pre-wrap",
            "overflow-wrap:anywhere"
          ].join(";");

          sticky.append(header, body);
          stickyLayer.appendChild(sticky);
          stickyNotes.push({ element: sticky, top: note.y });
        });

        viewport.appendChild(pageEditor);
        if (drawingLayer) viewport.appendChild(drawingLayer);
        viewport.appendChild(stickyLayer);
        paper.appendChild(viewport);
        page.appendChild(paper);
        pagesRoot.appendChild(page);

        pageRecords.push({
          paper,
          viewport,
          editor: pageEditor,
          drawingLayer,
          stickyLayer,
          stickyNotes,
          annotationHeight: annotations.height,
          drawingHeight
        });
      });

      exportRoot.appendChild(pagesRoot);
      document.body.appendChild(exportRoot);

      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise<void>(resolve => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
      });

      pageRecords.forEach(record => {
        const textHeight = Math.max(
          record.editor.scrollHeight,
          record.editor.getBoundingClientRect().height
        );
        const stickyBottom = record.stickyNotes.reduce(
          (bottom, note) => Math.max(bottom, note.top + note.element.offsetHeight),
          0
        );
        const pageHeight = Math.ceil(Math.max(
          basePageHeight,
          textHeight,
          record.annotationHeight,
          record.drawingHeight,
          stickyBottom
        ));

        record.paper.style.height = pageHeight + "px";
        record.paper.style.minHeight = pageHeight + "px";
        record.viewport.style.height = pageHeight + "px";
        record.viewport.style.minHeight = pageHeight + "px";
        record.editor.style.setProperty("height", pageHeight + "px", "important");
        record.editor.style.setProperty("min-height", pageHeight + "px", "important");
        record.stickyLayer.style.height = pageHeight + "px";
      });

      await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));

      const totalWidth = Math.ceil(exportRoot.getBoundingClientRect().width);
      const totalHeight = Math.ceil(pagesRoot.getBoundingClientRect().height);
      if (totalWidth <= 0 || totalHeight <= 0) {
        throw new Error("전체 페이지의 이미지 크기를 계산하지 못했습니다.");
      }

      const maxCanvasDimension = 32767;
      const maxCanvasArea = 268435456;
      const outputScale = Math.min(
        1,
        maxCanvasDimension / totalWidth,
        maxCanvasDimension / totalHeight,
        Math.sqrt(maxCanvasArea / (totalWidth * totalHeight))
      );
      if (outputScale < 0.35) {
        throw new Error("페이지가 너무 많아 한 장의 PNG로 저장하기 어렵습니다. PDF로 저장하거나 페이지 수를 줄여 주세요.");
      }

      await Promise.all(Array.from(exportRoot.querySelectorAll<HTMLImageElement>("img")).map(image =>
        typeof image.decode === "function" ? image.decode().catch(() => undefined) : Promise.resolve()
      ));

      const canvas = await window.html2canvas(exportRoot, {
        scale: outputScale,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        normalizeDom: false,
        width: totalWidth,
        height: totalHeight,
        windowWidth: window.innerWidth,
        windowHeight: Math.max(window.innerHeight, Math.min(totalHeight, maxCanvasDimension)),
        scrollX: 0,
        scrollY: 0,
        onclone: clonedDocument => {
          const clonedRoot = clonedDocument.querySelector<HTMLElement>(".markdown-long-image-export-root");
          if (!clonedRoot) return;

          clonedRoot.style.setProperty("position", "static", "important");
          clonedRoot.style.setProperty("left", "auto", "important");
          clonedRoot.style.setProperty("top", "auto", "important");
          clonedRoot.style.setProperty("z-index", "auto", "important");
          clonedRoot.style.setProperty("transform", "none", "important");
          clonedRoot.style.setProperty("visibility", "visible", "important");
          clonedRoot.style.setProperty("opacity", "1", "important");
          clonedRoot.style.setProperty("width", totalWidth + "px", "important");
        }
      });

      if (canvas.width <= 0 || canvas.height <= 0) {
        throw new Error("캡처된 이미지 크기가 올바르지 않습니다.");
      }

      return { canvas, pageCount: pagesForImage.length, outputScale };
    } finally {
      exportRoot?.remove();
    }
  }


  async function downloadPdf() {
    if (!activeNote || !leftEditorRef.current || loading || pdfExporting) return;

    const pageCount = getCurrentPages().length;
    setPdfExporting(true);
    setExportFeedback("pdf 생성 중...");

    try {
      await loadJsPdf();
      const { canvas, pageCount: renderedPageCount, outputScale } = await renderFullNotebookCanvas();
      const JsPDF = window.jspdf?.jsPDF;
      if (!JsPDF) throw new Error("PDF 변환 도구를 사용할 수 없습니다.");

      const pointsPerPixel = 72 / 96;
      const originalWidthPt = canvas.width * pointsPerPixel;
      const originalHeightPt = canvas.height * pointsPerPixel;
      const maxPageDimensionPt = 14400;
      const pdfScale = Math.min(
        1,
        maxPageDimensionPt / originalWidthPt,
        maxPageDimensionPt / originalHeightPt
      );
      const pageWidthPt = originalWidthPt * pdfScale;
      const pageHeightPt = originalHeightPt * pdfScale;

      const pdf = new JsPDF({
        orientation: pageWidthPt > pageHeightPt ? "landscape" : "portrait",
        unit: "pt",
        format: [pageWidthPt, pageHeightPt],
        compress: true,
        putOnlyUsedFonts: true
      });
      pdf.addImage(canvas, "PNG", 0, 0, pageWidthPt, pageHeightPt);

      const now = new Date();
      const dateStamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0")
      ].join("-");
      const safeTitle = (notebookTitle.trim() || "프리노트")
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, " ")
        .trim();
      const fileName = safeTitle + "_전체_" + dateStamp + ".pdf";

      pdf.save(fileName);

      const pdfScaledMessage = pdfScale < 1
        ? " PDF 한 페이지 크기 제한에 맞춰 이미지 크기를 조정했습니다."
        : "";
      const imageScaledMessage = outputScale < 1
        ? " 캡처 크기에 맞춰 이미지 해상도를 조정했습니다."
        : "";
      setExportFeedback("pdf 저장 완료");
    } catch (pdfError) {
      console.error("Full notebook PDF export failed:", pdfError);
      setExportFeedback(pdfError instanceof Error
        ? "PDF 저장 실패: " + pdfError.message
        : "PDF 저장에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setPdfExporting(false);
    }
  }

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
        onViewChange={nextView => {
          if (nextView === "cover") void leaveDiary(async () => { onOpenCover(); });
        }}
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
            <PlannerSpread className="book-frame markdown-diary-single-page">
              <section className="paper-page markdown-note-page markdown-single-note-page" aria-label="자유 노트">
                <div className="paper-section key-section markdown-free-note-section">
                  <div className="section-heading markdown-note-heading">
                    <span>FREE NOTE</span>
                    <div className="markdown-note-heading-actions">
                      {exportFeedback ? (
                        <span className="markdown-export-feedback" aria-live="polite">{exportFeedback}</span>
                      ) : null}
                                            <button
                        type="button"
                        className="markdown-share-top-button markdown-add-page-top-button"
                        aria-label="새 페이지 추가"
                        title="새 페이지 추가"
                        disabled={loading || !activeNote}
                        onMouseDown={event => event.preventDefault()}
                        onClick={addPage}
                      >
                        <Plus size={16} strokeWidth={2.2}/>
                      </button>
                      <button
                        type="button"
                        className="markdown-share-top-button markdown-delete-page-top-button"
                        aria-label="현재 페이지 삭제"
                        title="현재 페이지 삭제"
                        disabled={loading || !activeNote || pageContents.length <= 1}
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => setPageDeleteOpen(true)}
                      >
                        <Trash2 size={16} strokeWidth={2}/>
                      </button>
                      

                      <button
                        type="button"
                        className="markdown-share-top-button markdown-pdf-top-button"
                        aria-label={pdfExporting ? "PDF 저장 중" : "PDF 다운로드"}
                        title={pdfExporting ? "PDF 저장 중" : "PDF 다운로드"}
                        disabled={pdfExporting || loading || !activeNote}
                        aria-busy={pdfExporting}
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => { void downloadPdf(); }}
                      >
                        <FileDown size={16} strokeWidth={2}/>
                      </button>
                    </div>
                  </div>
                  <div className="free-note-paper">
                    {loading ? (
                      <div className="markdown-empty-state" role="status">노트를 불러오는 중입니다...</div>
                    ) : activeNote ? (
                      <>
                        <div className={drawingMode ? "markdown-toolbar is-hidden" : "markdown-toolbar"} role="toolbar" aria-label="Markdown 도구 모음">
                          
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
                          <div className="markdown-align-controls" role="group" aria-label="텍스트 정렬">
                            <button
                              type="button"
                              className="markdown-toolbar-button"
                              aria-label="왼쪽 정렬"
                              title="왼쪽 정렬"
                              onMouseDown={event => event.preventDefault()}
                              onClick={() => applyTextAlignment("left")}
                            >
                              <AlignLeft size={16} strokeWidth={2}/>
                            </button>
                            <button
                              type="button"
                              className="markdown-toolbar-button"
                              aria-label="가운데 정렬"
                              title="가운데 정렬"
                              onMouseDown={event => event.preventDefault()}
                              onClick={() => applyTextAlignment("center")}
                            >
                              <AlignCenter size={16} strokeWidth={2}/>
                            </button>
                            <button
                              type="button"
                              className="markdown-toolbar-button"
                              aria-label="오른쪽 정렬"
                              title="오른쪽 정렬"
                              onMouseDown={event => event.preventDefault()}
                              onClick={() => applyTextAlignment("right")}
                            >
                              <AlignRight size={16} strokeWidth={2}/>
                            </button>
                          </div>
                          <div className="markdown-color-picker-wrap">
                            <button
                              type="button"
                              className="markdown-toolbar-button"
                              aria-label="글자색"
                              title="글자색"
                              aria-expanded={colorPaletteOpen}
                              onMouseDown={event => {
                                event.preventDefault();
                                rememberEditorSelection();
                              }}
                              onClick={() => {
                                setColorPaletteOpen(open => !open);
                              }}
                            >
                              <Palette size={16} strokeWidth={2}/>
                            </button>
                            {colorPaletteOpen && (
                              <div className="markdown-color-palette" role="group" aria-label="글자색 선택">
                                <div className="markdown-color-palette-title">글자색</div>
                                <div className="markdown-color-swatches">
                                  <button
                                    type="button"
                                    className="markdown-color-swatch markdown-color-default"
                                    aria-label="기본 글자색"
                                    title="기본 글자색"
                                    onMouseDown={event => event.preventDefault()}
                                    onClick={applyDefaultTextColor}
                                  />
                                  <button
                                    type="button"
                                    className="markdown-color-swatch markdown-color-theme"
                                    aria-label="테마 색상"
                                    title="테마 색상"
                                    onMouseDown={event => event.preventDefault()}
                                    onClick={applyThemeTextColor}
                                  />
                                  {[
                                    { label: "빨강", color: "#d64545" },
                                    { label: "주황", color: "#d97736" },
                                    { label: "노랑", color: "#b58a00" },
                                    { label: "초록", color: "#39845b" },
                                    { label: "파랑", color: "#3978b8" },
                                    { label: "보라", color: "#8063b5" },
                                    { label: "분홍", color: "#c96b91" }
                                  ].map(({ label, color }) => (
                                    <button
                                      key={color}
                                      type="button"
                                      className="markdown-color-swatch"
                                      aria-label={label}
                                      title={label}
                                      style={{ backgroundColor: color }}
                                      onMouseDown={event => event.preventDefault()}
                                      onClick={() => applyTextColor(color)}
                                    />
                                  ))}
                                  <label
                                    className="markdown-color-swatch markdown-color-custom-swatch"
                                    title="사용자 지정 글자색"
                                    onMouseDown={rememberEditorSelection}
                                  >
                                    <input
                                      type="color"
                                      aria-label="사용자 지정 글자색"
                                      value={customTextColor}
                                      onChange={event => {
                                        const color = event.target.value;
                                        setCustomTextColor(color);
                                        applyTextColor(color, { keepPickerOpen: true });
                                      }}
                                    />
                                  </label>
                                </div>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            className="markdown-toolbar-button markdown-image-insert-button"
                            aria-label={imageUploading ? "이미지 업로드 중" : "이미지 추가"}
                            title={imageUploading ? "이미지 업로드 중" : "이미지 추가"}
                            disabled={imageUploading || loading || !activeNote}
                            onMouseDown={rememberEditorSelection}
                            onClick={() => imageInputRef.current?.click()}
                          >
                            <ImagePlus size={16} strokeWidth={2}/>
                          </button>
                          <input
                            ref={imageInputRef}
                            className="sr-only"
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            aria-label="추가할 이미지 선택"
                            onChange={event => {
                              const file = event.currentTarget.files?.[0];
                              if (file) void uploadAndInsertImage(file);
                              event.currentTarget.value = "";
                            }}
                          />
                          <button
                            type="button"
                            className="markdown-toolbar-button markdown-toolbar-drawing-toggle"
                            aria-label="필기 모드"
                            title="필기 모드"
                            onMouseDown={event => event.preventDefault()}
                            onClick={enterDrawingMode}
                          >
                            <PenLine size={15} strokeWidth={2}/>
                            <span>필기 모드</span>
                          </button>
                        </div>
                        {drawingMode ? (
                          <div className="markdown-toolbar free-note-drawing-toolbar" role="toolbar" aria-label="필기 도구 모음">
                            <div className="free-note-drawing-tool-group">
                              <div className="free-note-highlighter-wrap" ref={highlighterMenuRef}>
                                <button
                                  type="button"
                                  className={"free-note-drawing-tool-button" + (drawingTool === "highlighter" ? " is-active" : "")}
                                  aria-pressed={drawingTool === "highlighter"}
                                  aria-expanded={highlighterMenuOpen}
                                  aria-haspopup="true"
                                  aria-label="형광펜 그리기 방식 선택"
                                  onClick={() => {
                                    setDrawingTool("highlighter");
                                    setHighlighterMenuOpen(open => !open);
                                  }}
                                >
                                  <Highlighter size={16}/><span>형광펜</span><ChevronDown size={13}/>
                                </button>
                                {highlighterMenuOpen && (
                                  <div className="free-note-highlighter-menu" role="group" aria-label="형광펜 그리기 방식">
                                    <button
                                      type="button"
                                      className={highlighterMode === "straight" ? "is-active" : ""}
                                      aria-pressed={highlighterMode === "straight"}
                                      onClick={() => {
                                        setHighlighterMode("straight");
                                        setDrawingTool("highlighter");
                                        setHighlighterMenuOpen(false);
                                      }}
                                    >
                                      <Minus size={16}/><span>직선</span>{highlighterMode === "straight" && <Check size={14}/>}
                                    </button>
                                    <button
                                      type="button"
                                      className={highlighterMode === "free" ? "is-active" : ""}
                                      aria-pressed={highlighterMode === "free"}
                                      onClick={() => {
                                        setHighlighterMode("free");
                                        setDrawingTool("highlighter");
                                        setHighlighterMenuOpen(false);
                                      }}
                                    >
                                      <PenLine size={16}/><span>자유롭게</span>{highlighterMode === "free" && <Check size={14}/>}
                                    </button>
                                  </div>
                                )}
                              </div>
                              <button type="button" className={"free-note-drawing-tool-button" + (drawingTool === "pen" ? " is-active" : "")} aria-pressed={drawingTool === "pen"} onClick={() => { setDrawingTool("pen"); setHighlighterMenuOpen(false); }}>
                                <PenLine size={16}/><span>펜</span>
                              </button>
                              <button type="button" className={"free-note-drawing-tool-button" + (drawingTool === "sticky" ? " is-active" : "")} aria-pressed={drawingTool === "sticky"} onClick={() => { setDrawingTool("sticky"); setHighlighterMenuOpen(false); }}>
                                <StickyNoteIcon size={16}/><span>메모지</span>
                              </button>
                              <button type="button" className={"free-note-drawing-tool-button" + (drawingTool === "eraser" ? " is-active" : "")} aria-pressed={drawingTool === "eraser"} onClick={() => { setDrawingTool("eraser"); setHighlighterMenuOpen(false); }}>
                                <Eraser size={16}/><span>지우개</span>
                              </button>
                            </div>
                            <div className="free-note-drawing-colors" role="group" aria-label="필기 색상">
                              {DRAWING_COLORS.map(({ label, color }) => (
                                <button
                                  key={color}
                                  type="button"
                                  className={"free-note-drawing-color" + (drawingColor === color ? " is-active" : "")}
                                  aria-label={label}
                                  title={label}
                                  aria-pressed={drawingColor === color}
                                  style={{ backgroundColor: color }}
                                  onClick={() => setDrawingColor(color)}
                                />
                              ))}
                            </div>
                            
                            
                          <button type="button" className="free-note-drawing-exit" onClick={exitDrawingMode} title="텍스트 편집" aria-label="텍스트 편집">
                              <Type size={15}/><span>텍스트 편집</span>
                            </button>
                            </div>
                        ) : null}
                        <div className="free-note-editor-viewport">
                        <div
                          ref={leftEditorRef}
                          className={"free-note-input markdown-editor-grid" + (drawingMode ? " is-readonly" : "")}
                          role="textbox"
                          aria-label="자유 노트 내용"
                          aria-multiline="true"
                          aria-readonly={drawingMode}
                          tabIndex={drawingMode ? -1 : 0}
                          contentEditable={!drawingMode}
                          suppressContentEditableWarning
                          data-placeholder="여기에 내용을 자유롭게 작성해 보세요."
                          onInput={() => {
                            const editor = leftEditorRef.current;
                            if (editor) updateCurrentPage(htmlToMarkdown(editor.innerHTML));
                            syncDrawingCanvasMetrics();
                          }}
                          onScroll={syncDrawingCanvasMetrics}
                          onPointerDown={startNoteImageTransform}
                          onPointerMove={moveNoteImageTransform}
                          onPointerUp={event => finishNoteImageTransform(event.pointerId)}
                          onPointerCancel={event => finishNoteImageTransform(event.pointerId)}
                          onDragStart={event => {
                            const target = event.target as HTMLElement;
                            if (target.closest(".markdown-note-image-control, .markdown-note-image-options")) {
                              event.preventDefault();
                              return;
                            }
                            const frame = target.closest<HTMLElement>(".markdown-note-image-frame");
                            if (!frame || !leftEditorRef.current?.contains(frame)) return;
                            movingImageElementRef.current = frame;
                            selectNoteImage(frame);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("application/x-checkpoint-note-image", "move");
                          }}
                          onDragEnd={() => {
                            movingImageElementRef.current = null;
                          }}
                          onPaste={event => {
                            const imageItem = Array.from(event.clipboardData.items).find(item =>
                              item.kind === "file" && item.type.startsWith("image/")
                            );
                            const pastedImage = imageItem?.getAsFile() ??
                              Array.from(event.clipboardData.files).find(file => file.type.startsWith("image/"));
                            if (pastedImage) {
                              event.preventDefault();
                              rememberEditorSelection();
                              void uploadAndInsertImage(pastedImage);
                              return;
                            }

                            event.preventDefault();
                            const pasted = event.clipboardData.getData("text/plain");
                            const target = event.target as HTMLElement;
                            if (!pasted) return;
                            if (target.closest(".markdown-code-block")) {
                              document.execCommand("insertText", false, pasted);
                            } else {
                              document.execCommand("insertHTML", false, markdownToHtml(pasted, noteImageUrls));
                            }
                          }}
                          onDragOver={event => {
                            const types = Array.from(event.dataTransfer.types);
                            if (types.includes("Files") || types.includes("application/x-checkpoint-note-image")) event.preventDefault();
                          }}
                          onDrop={event => {
                            event.preventDefault();
                            const editor = leftEditorRef.current;
                            const movingFrame = movingImageElementRef.current;
                            if (
                              editor &&
                              movingFrame &&
                              event.dataTransfer.getData("application/x-checkpoint-note-image") === "move"
                            ) {
                              const dropRange = getEditorRangeAtPoint(event.clientX, event.clientY);
                              if (dropRange && !movingFrame.contains(dropRange.commonAncestorContainer)) {
                                const targetNode = dropRange.commonAncestorContainer.nodeType === 1
                                  ? dropRange.commonAncestorContainer as HTMLElement
                                  : dropRange.commonAncestorContainer.parentElement;
                                if (!targetNode?.closest(".markdown-code-block")) {
                                  const insertionRange = dropRange.cloneRange();
                                  movingFrame.remove();
                                  insertionRange.insertNode(movingFrame);
                                  const lineBreak = document.createElement("br");
                                  movingFrame.after(lineBreak);
                                  updateCurrentPage(htmlToMarkdown(editor.innerHTML));
                                  selectNoteImage(movingFrame);
                                  syncDrawingCanvasMetrics();
                                  editor.focus();
                                }
                              }
                              movingImageElementRef.current = null;
                              return;
                            }

                            const droppedImage = Array.from(event.dataTransfer.files).find(file =>
                              file.type.startsWith("image/")
                            );
                            if (droppedImage) {
                              rememberEditorSelectionAtPoint(event.clientX, event.clientY);
                              void uploadAndInsertImage(droppedImage);
                              return;
                            }

                            const dropped = event.dataTransfer.getData("text/plain");
                            const target = event.target as HTMLElement;
                            if (!dropped) return;
                            if (target.closest(".markdown-code-block")) {
                              document.execCommand("insertText", false, dropped);
                            } else {
                              document.execCommand("insertHTML", false, markdownToHtml(dropped, noteImageUrls));
                            }
                          }}
                          onChange={event => {
                            const target = event.target as HTMLElement;
                            if (!(target instanceof HTMLSelectElement) || !target.classList.contains("markdown-code-language")) return;
                            const codeBlock = target.closest<HTMLElement>(".markdown-code-block");
                            const editor = leftEditorRef.current;
                            if (!codeBlock || !editor) return;
                            codeBlock.dataset.language = normalizeCodeLanguage(target.value);
                            updateCurrentPage(htmlToMarkdown(editor.innerHTML));
                          }}
                          onBlur={event => {
                            const editor = leftEditorRef.current;
                            const nextTarget = event.relatedTarget as Node | null;
                            if (!editor || (nextTarget && editor.contains(nextTarget))) return;
                            highlightCodeBlocks(editor);
                            updateCurrentPage(htmlToMarkdown(editor.innerHTML));
                          }}
                          onClick={event => {
                            const editor = leftEditorRef.current;
                            const target = event.target as HTMLElement;
                            const imageFrame = target.closest<HTMLElement>(".markdown-note-image-frame");
                            if (editor && imageFrame && editor.contains(imageFrame)) {
                              event.preventDefault();
                              event.stopPropagation();
                              selectNoteImage(imageFrame);
                              if (target.closest(".markdown-note-image-menu-trigger")) {
                                imageFrame.classList.toggle("menu-open");
                              } else if (target.closest(".markdown-note-image-crop")) {
                                imageFrame.classList.remove("menu-open");
                                openImageCropEditor();
                              } else if (target.closest(".markdown-note-image-delete")) {
                                removeSelectedNoteImage();
                              } else if (!target.closest(".markdown-note-image-options")) {
                                imageFrame.classList.remove("menu-open");
                              }
                              return;
                            }
                            if (selectedImageElementRef.current) clearSelectedNoteImage();
                            const link = target.closest<HTMLAnchorElement>("a[href]");
                            if (!editor || !link || !editor.contains(link)) return;

                            event.preventDefault();
                            event.stopPropagation();

                            const visibleText = (link.textContent ?? "").trim();
                            const visibleUrl = visibleText.match(/^(?:https?:\/\/|www\.)\S+$/i)?.[0];
                            if (visibleUrl) {
                              const cleanUrl = visibleUrl.replace(/[.,!?;:)\]}]+$/, "");
                              const displayHref = safeMarkdownHref(
                                cleanUrl.startsWith("www.") ? "https://" + cleanUrl : cleanUrl
                              );
                              if (displayHref) {
                                link.setAttribute("href", displayHref);
                                link.setAttribute("target", "_blank");
                                link.setAttribute("rel", "noopener noreferrer");
                              }
                            }

                            const href = safeMarkdownHref(link.getAttribute("href") ?? "");
                            if (!href) return;

                            updateCurrentPage(htmlToMarkdown(editor.innerHTML));
                            window.open(href, "_blank", "noopener,noreferrer");
                          }}
                          onKeyDown={event => {
                            if (event.key !== " " && event.key !== "Enter") return;
                            const editor = leftEditorRef.current;
                            const selection = window.getSelection();
                            if (!editor || !selection?.rangeCount || !selection.isCollapsed) return;
                            const range = selection.getRangeAt(0);
                            if (!editor.contains(range.startContainer)) return;

                            const currentElement = range.startContainer.nodeType === 1
                              ? range.startContainer as HTMLElement
                              : range.startContainer.parentElement;
                            if (currentElement?.closest(".markdown-code-block, a")) return;

                            if (range.startContainer.nodeType === 3) {
                              const textNode = range.startContainer as Text;
                              const beforeCaretText = (textNode.textContent ?? "").slice(0, range.startOffset);
                              const urlMatch = beforeCaretText.match(/(?:https?:\/\/|www\.)[^\s<>]+$/i);
                              if (urlMatch) {
                                const rawUrl = urlMatch[0];
                                const trailing = rawUrl.match(/[.,!?;:)\]}]+$/)?.[0] ?? "";
                                const url = trailing ? rawUrl.slice(0, -trailing.length) : rawUrl;
                                const href = safeMarkdownHref(url.startsWith("www.") ? "https://" + url : url);
                                if (href && url) {
                                  const linkRange = document.createRange();
                                  linkRange.setStart(textNode, range.startOffset - url.length);
                                  linkRange.setEnd(textNode, range.startOffset);
                                  const anchor = document.createElement("a");
                                  anchor.href = href;
                                  anchor.target = "_blank";
                                  anchor.rel = "noopener noreferrer";
                                  anchor.appendChild(linkRange.extractContents());
                                  linkRange.insertNode(anchor);

                                  const afterLink = document.createRange();
                                  const suffixNode = anchor.nextSibling;
                                  if (trailing && suffixNode?.nodeType === 3) {
                                    afterLink.setStart(suffixNode, Math.min(trailing.length, (suffixNode as Text).length));
                                  } else {
                                    afterLink.setStartAfter(anchor);
                                  }
                                  afterLink.collapse(true);
                                  selection.removeAllRanges();
                                  selection.addRange(afterLink);
                                  updateCurrentPage(htmlToMarkdown(editor.innerHTML));
                                  return;
                                }
                              }
                            }

                            if (event.key !== " ") return;

                            let block = range.startContainer.nodeType === 1
                              ? range.startContainer as HTMLElement
                              : range.startContainer.parentElement;
                            while (block && block !== editor && !["P", "DIV", "H1", "H2", "H3", "LI"].includes(block.tagName)) {
                              block = block.parentElement;
                            }
                            if (!block) return;

                            const beforeCaret = range.cloneRange();
                            beforeCaret.selectNodeContents(block);
                            beforeCaret.setEnd(range.startContainer, range.startOffset);
                            const marker = beforeCaret.toString();

                            if (/^#{1,3}$/.test(marker)) {
                              event.preventDefault();
                              selection.removeAllRanges();
                              selection.addRange(beforeCaret);
                              document.execCommand("delete");
                              document.execCommand("formatBlock", false, "H" + marker.length);
                            } else if (/^[-+*]$/.test(marker)) {
                              event.preventDefault();
                              selection.removeAllRanges();
                              selection.addRange(beforeCaret);
                              document.execCommand("delete");
                              document.execCommand("insertUnorderedList");
                            } else if (/^\d+[.)]$/.test(marker)) {
                              event.preventDefault();
                              selection.removeAllRanges();
                              selection.addRange(beforeCaret);
                              document.execCommand("delete");
                              document.execCommand("insertOrderedList");
                            } else if (marker === ">") {
                              event.preventDefault();
                              selection.removeAllRanges();
                              selection.addRange(beforeCaret);
                              document.execCommand("delete");
                              document.execCommand("formatBlock", false, "BLOCKQUOTE");
                            }
                          }}
                          spellCheck
                        />
                        <svg
                          className={drawingMode ? "free-note-drawing-layer is-active" : "free-note-drawing-layer"}
                          viewBox={"0 0 1000 " + Math.max(1, drawingCanvasHeight)}
                          preserveAspectRatio="none"
                          aria-label="필기 레이어"
                          style={{ height: drawingCanvasHeight + "px", transform: "translateY(-" + drawingScrollTop + "px)" }}
                          onPointerDown={handleDrawingPointerDown}
                          onPointerMove={handleDrawingPointerMove}
                          onPointerUp={finishDrawingPointer}
                          onPointerCancel={cancelDrawingPointer}
                          onWheel={handleDrawingWheel}
                          onTouchStart={handleDrawingTouchStart}
                          onTouchMove={handleDrawingTouchMove}
                          onTouchEnd={handleDrawingTouchEnd}
                        >
                          {(currentStroke ? [...currentPageAnnotations.strokes, currentStroke] : currentPageAnnotations.strokes).map(stroke => {
                            const pathData = stroke.points.map((point, pointIndex) =>
                              (pointIndex === 0 ? "M " : "L ") + point.x + " " + point.y
                            ).join(" ");
                            return (
                              <path
                                key={stroke.id}
                                d={stroke.points.length === 1 ? pathData + " l 0.1 0" : pathData}
                                fill="none"
                                stroke={stroke.color}
                                strokeWidth={stroke.tool === "highlighter" ? 18 : 3.2}
                                strokeOpacity={stroke.tool === "highlighter" ? 0.42 : 0.95}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                vectorEffect="non-scaling-stroke"
                              />
                            );
                          })}
                        </svg>
                        <div
                          className={drawingMode ? "free-note-sticky-layer is-active" : "free-note-sticky-layer"}
                          style={{ height: drawingCanvasHeight + "px", transform: "translateY(-" + drawingScrollTop + "px)" }}
                        >
                          {currentPageAnnotations.notes.map(note => (
                            <div
                              key={note.id}
                              className="free-note-sticky-note"
                              style={{ left: (note.x / 10) + "%", top: note.y + "px", backgroundColor: note.color }}
                            >
                              <div
                                className="free-note-sticky-note-header"
                                onPointerDown={event => beginStickyNoteDrag(event, note)}
                                onPointerMove={event => moveStickyNoteDrag(event, note.id)}
                                onPointerUp={event => finishStickyNoteDrag(event, note.id)}
                                onPointerCancel={event => finishStickyNoteDrag(event, note.id)}
                              >
                                <span>MEMO</span>
                                {drawingMode ? (
                                  <button
                                    type="button"
                                    aria-label="메모지 삭제"
                                    title="메모지 삭제"
                                    onPointerDown={event => event.stopPropagation()}
                                    onClick={() => deleteStickyNote(note.id)}
                                  >
                                    <X size={13}/>
                                  </button>
                                ) : null}
                              </div>
                              <textarea
                                value={note.text}
                                readOnly={!drawingMode}
                                placeholder="메모를 입력하세요."
                                aria-label="메모지 내용"
                                onPointerDown={event => event.stopPropagation()}
                                onChange={event => updateStickyNote(note.id, { text: event.target.value })}
                              />
                            </div>
                          ))}
                        </div>
                        </div>
                        <div className="markdown-page-navigation">
                          <div className="markdown-page-controls">
                            <button
                              type="button"
                              className="markdown-page-nav-button"
                              aria-label="이전 페이지"
                              title="이전 페이지"
                              disabled={activePageIndex === 0}
                              onMouseDown={event => event.preventDefault()}
                              onClick={() => goToPage(activePageIndex - 1)}
                            >
                              <ChevronLeft size={16} strokeWidth={2}/>
                            </button>
                            <span className="markdown-page-indicator" aria-live="polite">
                              {activePageIndex + 1} / {pageContents.length} 페이지
                            </span>
                            <button
                              type="button"
                              className="markdown-page-nav-button"
                              aria-label="다음 페이지"
                              title="다음 페이지"
                              disabled={activePageIndex >= pageContents.length - 1}
                              onMouseDown={event => event.preventDefault()}
                              onClick={() => goToPage(activePageIndex + 1)}
                            >
                              <ChevronRight size={16} strokeWidth={2}/>
                            </button>
                          </div>
                          
                        </div>
                      </>
                    ) : (
                      <div className="markdown-empty-state" role="status">
                        노트를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </PlannerSpread>
          </div>
        </div>
      </main>
      {imageCropOpen && selectedImageElementRef.current ? (
        <div
          className="markdown-image-crop-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setImageCropOpen(false);
          }}
        >
          <section className="markdown-image-crop-modal" role="dialog" aria-modal="true" aria-labelledby="markdown-image-crop-title">
            <div className="markdown-image-crop-header">
              <h2 id="markdown-image-crop-title">이미지 자르기</h2>
              <button type="button" aria-label="닫기" onClick={() => setImageCropOpen(false)}><X size={18}/></button>
            </div>
            <div
              className="markdown-image-crop-preview"
              style={{
                width: (() => {
                  const image = selectedImageElementRef.current?.querySelector<HTMLImageElement>("img.markdown-note-image");
                  const ratio = imageCropRatio === "original"
                    ? (image?.naturalWidth || 4) / (image?.naturalHeight || 3)
                    : imageCropRatio === "1:1" ? 1
                      : imageCropRatio === "4:3" ? 4 / 3
                        : imageCropRatio === "16:9" ? 16 / 9 : 3 / 4;
                  return "min(100%, " + Math.min(420, 320 * ratio) + "px)";
                })(),
                aspectRatio: imageCropRatio === "original"
                  ? (() => {
                      const image = selectedImageElementRef.current?.querySelector<HTMLImageElement>("img.markdown-note-image");
                      return String(image?.naturalWidth || 4) + " / " + String(image?.naturalHeight || 3);
                    })()
                  : imageCropRatio.replace(":", " / ")
              }}
            >
              <img
                src={selectedImageElementRef.current?.querySelector<HTMLImageElement>("img.markdown-note-image")?.src ?? ""}
                alt="자르기 미리보기"
                style={{
                  objectFit: imageCropRatio === "original" ? "contain" : "cover",
                  objectPosition: String(imageCropX) + "% " + String(imageCropY) + "%",
                  transform: "scale(" + imageCropZoom / 100 + ")",
                  transformOrigin: String(imageCropX) + "% " + String(imageCropY) + "%"
                }}
              />
            </div>
            <div className="markdown-image-crop-ratios" role="group" aria-label="자르기 비율">
              {(["original", "1:1", "4:3", "16:9", "3:4"] as const).map(ratio => (
                <button key={ratio} type="button" className={imageCropRatio === ratio ? "is-active" : ""} aria-pressed={imageCropRatio === ratio} onClick={() => setImageCropRatio(ratio)}>
                  {ratio === "original" ? "원본" : ratio}
                </button>
              ))}
            </div>
            <div className="markdown-image-crop-controls">
              <label>
                확대 <output>{imageCropZoom}%</output>
                <input type="range" min={100} max={300} step={5} value={imageCropZoom} onChange={event => setImageCropZoom(Number(event.currentTarget.value))}/>
              </label>
              <label>
                가로 위치 <output>{imageCropX}%</output>
                <input type="range" min={0} max={100} step={1} value={imageCropX} onChange={event => setImageCropX(Number(event.currentTarget.value))}/>
              </label>
              <label>
                세로 위치 <output>{imageCropY}%</output>
                <input type="range" min={0} max={100} step={1} value={imageCropY} onChange={event => setImageCropY(Number(event.currentTarget.value))}/>
              </label>
            </div>
            <div className="markdown-image-crop-actions">
              <button type="button" className="outline-btn" onClick={() => setImageCropOpen(false)}>취소</button>
              <button type="button" className="markdown-image-crop-apply" onClick={saveImageCrop}>적용</button>
            </div>
          </section>
        </div>
      ) : null}
      {pageDeleteOpen ? (
        <div
          className="modal-backdrop notebook-delete-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setPageDeleteOpen(false);
          }}
        >
          <section
            className="delete-account-modal notebook-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notebook-delete-title"
            aria-describedby="notebook-delete-description"
          >
            <div className="delete-account-icon"><Trash2 size={22}/></div>
            <h2 id="notebook-delete-title">페이지를 삭제할까요?</h2>
            <p id="notebook-delete-description">
              현재 {activePageIndex + 1}페이지를 삭제합니다. 이 페이지에 작성한 글과 필기, 메모지가 함께 삭제됩니다.
            </p>
            <div className="delete-account-actions">
              <button type="button" className="outline-btn" onClick={() => setPageDeleteOpen(false)}>
                취소
              </button>
              <button type="button" className="delete-confirm-btn" onClick={deleteCurrentPage}>
                페이지 삭제
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
