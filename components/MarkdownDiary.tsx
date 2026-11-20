"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Bold, Code2, Heading1, Italic, List, ListOrdered, Minus, Palette, Quote, Share2, Strikethrough, Check } from "lucide-react";
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

type MarkdownAction = "bold" | "italic" | "strike" | "heading" | "bullet" | "ordered" | "quote" | "code" | "divider";

const MARKDOWN_TOOLBAR = [
  { action: "bold", label: "굵게", icon: Bold },
  { action: "italic", label: "기울임", icon: Italic },
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
    if (/^(#|\\/\\/|--|\\/\\*)/.test(token)) tokenClass = "comment";
    else if (/^<[^>]+>$/.test(token)) tokenClass = "include";
    else if (/^["']/.test(token)) tokenClass = "string";
    else if (/^\\d/.test(token)) tokenClass = "number";
    else if (keywords && new RegExp("^(?:" + keywords + ")$").test(token)) tokenClass = "keyword";
    return '<span class="code-token-' + tokenClass + '">' + escapeHtml(token) + "</span>";
  });
}

function createMarkdownCodeBlockHtml(code: string, language: string, inserted = false) {
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

function highlightCodeBlocks(editor: HTMLElement) {
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

function renderInlineMarkdown(value: string) {
  const tokens: string[] = [];
  const stash = (html: string) => {
    tokens.push(html);
    return "\u0000" + (tokens.length - 1) + "\u0000";
  };

  const source = value.replace(
    /<span\s+style=["']color:\s*(#[0-9a-f]{6})["']\s*>([\s\S]*?)<\/span>/gi,
    (_match, color: string, content: string) =>
      stash('<span style="color: ' + color.toLowerCase() + '">' + renderInlineMarkdown(content) + "</span>")
  );
  let html = escapeHtml(source);
  html = html.replace(/\x60([^\x60]+)\x60/g, (_match, code: string) =>
    stash("<code>" + code + "</code>")
  );
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
    const href = safeMarkdownHref(url.startsWith("www.") ? "https://" + url : url);
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

function markdownToHtml(markdown: string) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let index = 0;

  const isBlockStart = (line: string) =>
    /^\s*\x60{3}/.test(line) ||
    /^\s*~~~/.test(line) ||
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
      blocks.push("<h" + level + ">" + renderInlineMarkdown(heading[2]) + "</h" + level + ">");
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
      blocks.push("<blockquote><p>" + renderInlineMarkdown(quoteLines.join("\n")).replace(/\n/g, "<br>") + "</p></blockquote>");
      continue;
    }

    const listMatch = line.match(/^\s*(?:(\d+)[.)]|[-+*])\s+(.*)$/);
    if (listMatch) {
      const ordered = Boolean(listMatch[1]);
      const items: string[] = [];
      while (index < lines.length) {
        const item = lines[index].match(/^\s*(?:(\d+)[.)]|[-+*])\s+(.*)$/);
        if (!item || Boolean(item[1]) !== ordered) break;
        items.push("<li>" + renderInlineMarkdown(item[2]) + "</li>");
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
    blocks.push("<p>" + renderInlineMarkdown(paragraph.join("\n")).replace(/\n/g, "<br>") + "</p>");
  }

  return blocks.join("");
}

function htmlToMarkdown(html: string) {
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
    if (tag === "B" || tag === "STRONG") return "**" + children + "**";
    if (tag === "I" || tag === "EM") return "*" + children + "*";
    if (tag === "S" || tag === "STRIKE" || tag === "DEL") return "~~" + children + "~~";
    if (tag === "CODE" && !element.closest(".markdown-code-block")) return String.fromCharCode(96) + children + String.fromCharCode(96);
    if (tag === "FONT" || tag === "SPAN") {
      const rawColor = tag === "FONT" ? (element.getAttribute("color") ?? element.style.color) : element.style.color;
      const color = normalizeMarkdownColor(rawColor);
      return color ? '<span style="color: ' + color + '">' + children + "</span>" : children;
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
        return "  ".repeat(depth) + prefix + text + (nested ? "\n" + nested : "");
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
    if (tag === "H1" || tag === "H2" || tag === "H3") {
      const level = Number(tag.slice(1));
      return "#".repeat(level) + " " + children.map(inline).join("") + "\n\n";
    }
    if (tag === "P") return children.map(inline).join("") + "\n\n";
    if (tag === "UL" || tag === "OL") return serializeList(element);
    if (tag === "BLOCKQUOTE") {
      const content = children.map(block).join("").trimEnd();
      return content.split("\n").map(line => line ? "> " + line : ">").join("\n") + "\n\n";
    }
    if (tag === "PRE") {
      const fence = String.fromCharCode(96).repeat(3);
      return fence + "\n" + serializeCodeText(element).replace(/\n+$/, "") + "\n" + fence + "\n\n";
    }
    if (tag === "HR") return "---\n\n";
    if (tag === "DIV") {
      const hasBlockChild = children.some(child =>
        child.nodeType === 1 &&
        ["DIV", "P", "UL", "OL", "BLOCKQUOTE", "PRE", "H1", "H2", "H3", "HR"].includes((child as HTMLElement).tagName)
      );
      const content = hasBlockChild ? children.map(block).join("") : children.map(inline).join("");
      return content + (content.endsWith("\n") ? "" : "\n");
    }
    return inline(element);
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [shareFeedback, setShareFeedback] = useState("");
  const [colorPaletteOpen, setColorPaletteOpen] = useState(false);
  const [customTextColor, setCustomTextColor] = useState("#7868e8");
  const [colorSelectionHint, setColorSelectionHint] = useState("");
  const leftEditorRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const editor = leftEditorRef.current;
    if (!editor || !activeNote || loading) return;
    if (editor.dataset.noteId !== activeNote.id) {
      editor.innerHTML = markdownToHtml(pageContents.left);
      editor.dataset.noteId = activeNote.id;
    }
  }, [activeNote, loading, pageContents.left]);

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

  function rememberEditorSelection() {
    const editor = leftEditorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount || !selection.anchorNode || !selection.focusNode) return;
    if (editor.contains(selection.anchorNode) && editor.contains(selection.focusNode)) {
      editorSelectionRef.current = selection.getRangeAt(0).cloneRange();
    }
  }

  function applyTextColor(color: string) {
    const editor = leftEditorRef.current;
    if (!editor || !activeNote || loading) return;

    editor.focus();
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
      setColorSelectionHint("색상을 적용할 글자를 먼저 선택해 줘.");
      return;
    }

    document.execCommand("foreColor", false, color);
    updatePage("left", htmlToMarkdown(editor.innerHTML));
    editorSelectionRef.current = null;
    setColorSelectionHint("");
    setColorPaletteOpen(false);
    editor.focus();
  }

  function applyThemeTextColor() {
    const editor = leftEditorRef.current;
    const rawColor = editor ? getComputedStyle(editor).getPropertyValue("--accent").trim() : customColor;
    applyTextColor(normalizeMarkdownColor(rawColor) || customColor || "#7868e8");
  }

  function applyDefaultTextColor() {
    const editor = leftEditorRef.current;
    const rawColor = editor ? getComputedStyle(editor).getPropertyValue("--ink").trim() : "";
    applyTextColor(normalizeMarkdownColor(rawColor) || "#34465e");
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

    updatePage("left", htmlToMarkdown(editor.innerHTML));
    editor.focus();
  }

  function applyMarkdown(action: MarkdownAction) {
    const editor = leftEditorRef.current;
    if (!editor || !activeNote || loading) return;

    editor.focus();
    const selected = window.getSelection()?.toString() ?? "";

    if (action === "bold") {
      document.execCommand("bold");
    } else if (action === "italic") {
      document.execCommand("italic");
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

    updatePage("left", htmlToMarkdown(editor.innerHTML));
    editor.focus();
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
            <div className="book-frame markdown-diary-single-page">
              <section className="paper-page markdown-note-page markdown-single-note-page" aria-label="자유 노트">
                <div className="paper-section key-section markdown-free-note-section">
                  <div className="section-heading markdown-note-heading">
                    <span>FREE NOTE</span>
                    <div className="markdown-note-heading-actions">
                      {shareFeedback ? (
                        <span className="markdown-share-feedback" aria-live="polite">{shareFeedback}</span>
                      ) : null}
                      <button
                        type="button"
                        className="markdown-share-top-button"
                        aria-label="공유"
                        title="공유"
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => { void shareMarkdown(); }}
                      >
                        <Share2 size={16} strokeWidth={2}/>
                      </button>
                    </div>
                  </div>
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
                                setColorSelectionHint("");
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
                                  >
                                    A
                                  </button>
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
                                </div>
                                <label className="markdown-color-custom">
                                  <span>직접 선택</span>
                                  <input
                                    type="color"
                                    aria-label="사용자 지정 글자색"
                                    value={customTextColor}
                                    onChange={event => {
                                      const color = event.target.value;
                                      setCustomTextColor(color);
                                      applyTextColor(color);
                                    }}
                                  />
                                </label>
                                <span className="markdown-color-hint" aria-live="polite">
                                  {colorSelectionHint || "글자를 선택한 뒤 색상을 눌러 줘."}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div
                          ref={leftEditorRef}
                          className="free-note-input markdown-editor-grid"
                          role="textbox"
                          aria-label="자유 노트 내용"
                          aria-multiline="true"
                          contentEditable
                          suppressContentEditableWarning
                          data-placeholder="여기에 내용을 자유롭게 작성해 보세요."
                          onInput={() => {
                            const editor = leftEditorRef.current;
                            if (editor) updatePage("left", htmlToMarkdown(editor.innerHTML));
                          }}
                          onPaste={event => {
                            event.preventDefault();
                            const pasted = event.clipboardData.getData("text/plain");
                            const target = event.target as HTMLElement;
                            if (!pasted) return;
                            if (target.closest(".markdown-code-block")) {
                              document.execCommand("insertText", false, pasted);
                            } else {
                              document.execCommand("insertHTML", false, markdownToHtml(pasted));
                            }
                          }}
                          onDrop={event => {
                            event.preventDefault();
                            const dropped = event.dataTransfer.getData("text/plain");
                            const target = event.target as HTMLElement;
                            if (!dropped) return;
                            if (target.closest(".markdown-code-block")) {
                              document.execCommand("insertText", false, dropped);
                            } else {
                              document.execCommand("insertHTML", false, markdownToHtml(dropped));
                            }
                          }}
                          onChange={event => {
                            const target = event.target as HTMLElement;
                            if (!(target instanceof HTMLSelectElement) || !target.classList.contains("markdown-code-language")) return;
                            const codeBlock = target.closest<HTMLElement>(".markdown-code-block");
                            const editor = leftEditorRef.current;
                            if (!codeBlock || !editor) return;
                            codeBlock.dataset.language = normalizeCodeLanguage(target.value);
                            updatePage("left", htmlToMarkdown(editor.innerHTML));
                          }}
                          onBlur={event => {
                            const editor = leftEditorRef.current;
                            const nextTarget = event.relatedTarget as Node | null;
                            if (!editor || (nextTarget && editor.contains(nextTarget))) return;
                            highlightCodeBlocks(editor);
                            updatePage("left", htmlToMarkdown(editor.innerHTML));
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
                            if (currentElement?.closest(".markdown-code-block")) return;

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
                                  afterLink.setStartAfter(anchor);
                                  afterLink.collapse(true);
                                  selection.removeAllRanges();
                                  selection.addRange(afterLink);
                                  updatePage("left", htmlToMarkdown(editor.innerHTML));
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
