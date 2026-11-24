"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  ArrowLeft, Brush, Check, Circle, Download, Eraser, Eye, EyeOff, Layers3,
  Lasso, LayoutGrid, Minus, MoveDown, MoveUp, Pipette, Plus,
  Redo2, RotateCw, Save, Square, Trash2, Undo2, ZoomIn, ZoomOut
} from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import type { ThemeName } from "@/lib/types";

export type SketchPoint = { x: number; y: number; pressure?: number };
export type SketchStroke = {
  id: string;
  tool: "pen" | "eraser" | "line" | "rect" | "ellipse";
  color: string;
  size: number;
  opacity: number;
  points: SketchPoint[];
};
export type SketchLayer = {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  strokes: SketchStroke[];
};
export type SketchDocument = {
  version: 1;
  width: number;
  height: number;
  background: string;
  backgroundStyle: "plain" | "grid" | "ruled" | "transparent";
  layers: SketchLayer[];
};

type SketchTool = "pen" | "eraser" | "lasso" | "line" | "rect" | "ellipse" | "eyedropper";
const CANVAS_RATIOS = [
  { value: "1:1", width: 1200, height: 1200 },
  { value: "3:4", width: 900, height: 1200 },
  { value: "4:3", width: 1200, height: 900 },
  { value: "9:16", width: 900, height: 1600 },
  { value: "16:9", width: 1600, height: 900 }
] as const;

type CanvasRatio = typeof CANVAS_RATIOS[number]["value"];

function getCanvasRatio(width: number, height: number): CanvasRatio {
  const ratio = width / height;
  return CANVAS_RATIOS.reduce((closest, option) => {
    const closestDistance = Math.abs(Math.log(ratio / (closest.width / closest.height)));
    const optionDistance = Math.abs(Math.log(ratio / (option.width / option.height)));
    return optionDistance < closestDistance ? option : closest;
  }).value;
}
type SelectionBounds = { left: number; top: number; right: number; bottom: number };
type SelectionHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

type PointerMode =
  | { kind: "stroke"; layerId: string; strokeId: string }
  | { kind: "lasso" }
  | { kind: "move"; start: SketchPoint; origin: SketchDocument; keys: string[] }
  | { kind: "scale"; start: SketchPoint; anchor: SketchPoint; bounds: SelectionBounds; handle: SelectionHandle; origin: SketchDocument; keys: string[] };

type Props = {
  initialDocument?: SketchDocument | null;
  onSave: (blob: Blob, document: SketchDocument) => Promise<boolean>;
  onClose: () => void;
  email: string;
  themeStyle: CSSProperties;
  theme: ThemeName;
  customColor: string;
  onThemeChange: (theme: ThemeName) => void;
  onCustomColorChange: (color: string) => void;
  onOpenNotebookList: () => void;
  onOpenCover: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
};

const uid = () => globalThis.crypto?.randomUUID?.() || String(Date.now()) + "-" + Math.random().toString(36).slice(2);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const COLOR_SWATCHES = ["#202124", "#ffffff", "#e5484d", "#f08a38", "#e2b52d", "#39936b", "#3982c7", "#8264bd", "#d36b9a", "#8b9ec4"];

export function createEmptySketchDocument(): SketchDocument {
  return {
    version: 1,
    width: 900,
    height: 1200,
    background: "#ffffff",
    backgroundStyle: "plain",
    layers: [{ id: uid(), name: "레이어 1", visible: true, opacity: 100, strokes: [] }]
  };
}

export function normalizeSketchDocument(value: unknown): SketchDocument {
  const fallback = createEmptySketchDocument();
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const raw = value as Partial<SketchDocument>;
  const width = Number.isFinite(raw.width) ? clamp(Number(raw.width), 400, 2400) : fallback.width;
  const height = Number.isFinite(raw.height) ? clamp(Number(raw.height), 400, 2400) : fallback.height;
  const backgroundStyle = raw.backgroundStyle === "grid" || raw.backgroundStyle === "ruled" || raw.backgroundStyle === "transparent"
    ? raw.backgroundStyle
    : "plain";
  const layers = Array.isArray(raw.layers) ? raw.layers.slice(0, 30).flatMap((layer, layerIndex): SketchLayer[] => {
    if (!layer || typeof layer !== "object") return [];
    const item = layer as Partial<SketchLayer>;
    const strokes = Array.isArray(item.strokes) ? item.strokes.slice(0, 5000).flatMap((stroke): SketchStroke[] => {
      if (!stroke || typeof stroke !== "object") return [];
      const candidate = stroke as Partial<SketchStroke>;
      const tool = candidate.tool === "eraser" || candidate.tool === "line" || candidate.tool === "rect" || candidate.tool === "ellipse" ? candidate.tool : "pen";
      const points = Array.isArray(candidate.points) ? candidate.points.slice(0, 20000).flatMap((point): SketchPoint[] => {
        if (!point || typeof point !== "object") return [];
        const p = point as Partial<SketchPoint>;
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return [];
        return [{ x: clamp(Number(p.x), 0, width), y: clamp(Number(p.y), 0, height), pressure: Number.isFinite(p.pressure) ? clamp(Number(p.pressure), 0, 1) : 0.5 }];
      }) : [];
      if (points.length === 0) return [];
      return [{
        id: typeof candidate.id === "string" ? candidate.id : uid(),
        tool,
        color: typeof candidate.color === "string" && /^#[0-9a-fA-F]{6}$/.test(candidate.color) ? candidate.color : "#202124",
        size: Number.isFinite(candidate.size) ? clamp(Number(candidate.size), 1, 160) : 6,
        opacity: Number.isFinite(candidate.opacity) ? clamp(Number(candidate.opacity), 1, 100) : 100,
        points
      }];
    }) : [];
    return [{
      id: typeof item.id === "string" ? item.id : uid(),
      name: typeof item.name === "string" ? item.name.slice(0, 32) : "레이어 " + (layerIndex + 1),
      visible: item.visible !== false,
      opacity: Number.isFinite(item.opacity) ? clamp(Number(item.opacity), 0, 100) : 100,
      strokes
    }];
  }) : [];
  return {
    version: 1,
    width,
    height,
    background: typeof raw.background === "string" && /^#[0-9a-fA-F]{6}$/.test(raw.background) ? raw.background : "#ffffff",
    backgroundStyle,
    layers: layers.length ? layers : fallback.layers
  };
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: SketchStroke) {
  const points = stroke.points;
  if (!points.length) return;
  ctx.save();
  ctx.globalAlpha = clamp(stroke.opacity, 1, 100) / 100;
  ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (stroke.tool === "line" || stroke.tool === "rect" || stroke.tool === "ellipse") {
    const start = points[0];
    const end = points[points.length - 1];
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    if (stroke.tool === "line") {
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (stroke.tool === "rect") {
      ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    } else {
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      ctx.ellipse((start.x + end.x) / 2, (start.y + end.y) / 2, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (points.length === 1) {
    const pressure = points[0].pressure ?? 0.5;
    const radius = Math.max(0.5, stroke.size * (0.4 + pressure * 0.6) / 2);
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const pressure = ((previous.pressure ?? 0.5) + (current.pressure ?? 0.5)) / 2;
    ctx.lineWidth = Math.max(0.7, stroke.size * (0.4 + pressure * 0.6));
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    ctx.lineTo(current.x, current.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDocument(canvas: HTMLCanvasElement, doc: SketchDocument) {
  canvas.width = doc.width;
  canvas.height = doc.height;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, doc.width, doc.height);
  if (doc.backgroundStyle !== "transparent") {
    context.fillStyle = doc.background;
    context.fillRect(0, 0, doc.width, doc.height);
  }
  if (doc.backgroundStyle === "grid" || doc.backgroundStyle === "ruled") {
    context.save();
    context.strokeStyle = "#dce2ec";
    context.lineWidth = 1;
    const step = 40;
    if (doc.backgroundStyle === "grid") {
      for (let x = step; x < doc.width; x += step) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, doc.height);
        context.stroke();
      }
    }
    for (let y = step; y < doc.height; y += step) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(doc.width, y);
      context.stroke();
    }
    context.restore();
  }
  for (const layer of doc.layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    const offscreen = document.createElement("canvas");
    offscreen.width = doc.width;
    offscreen.height = doc.height;
    const layerContext = offscreen.getContext("2d");
    if (!layerContext) continue;
    layer.strokes.forEach(stroke => drawStroke(layerContext, stroke));
    context.save();
    context.globalAlpha = clamp(layer.opacity, 0, 100) / 100;
    context.drawImage(offscreen, 0, 0);
    context.restore();
  }
}

function pointInPolygon(point: SketchPoint, polygon: SketchPoint[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects = ((a.y > point.y) !== (b.y > point.y)) &&
      (point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || 0.00001) + a.x);
    if (intersects) inside = !inside;
  }
  return inside;
}

function strokeBounds(stroke: SketchStroke) {
  const xs = stroke.points.map(point => point.x);
  const ys = stroke.points.map(point => point.y);
  return {
    left: Math.min(...xs) - stroke.size,
    right: Math.max(...xs) + stroke.size,
    top: Math.min(...ys) - stroke.size,
    bottom: Math.max(...ys) + stroke.size
  };
}

function getSelectionBounds(doc: SketchDocument, keys: string[]): SelectionBounds | null {
  if (!keys.length) return null;
  const selected = new Set(keys);
  const bounds = doc.layers.flatMap(layer => layer.strokes
    .filter(stroke => selected.has(layer.id + ":" + stroke.id))
    .map(strokeBounds));
  if (!bounds.length) return null;
  return {
    left: Math.min(...bounds.map(item => item.left)),
    top: Math.min(...bounds.map(item => item.top)),
    right: Math.max(...bounds.map(item => item.right)),
    bottom: Math.max(...bounds.map(item => item.bottom))
  };
}

const SELECTION_HANDLES: SelectionHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function getSelectionHandlePoint(bounds: SelectionBounds, handle: SelectionHandle): SketchPoint {
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;
  const positions: Record<SelectionHandle, SketchPoint> = {
    nw: { x: bounds.left, y: bounds.top },
    n: { x: centerX, y: bounds.top },
    ne: { x: bounds.right, y: bounds.top },
    e: { x: bounds.right, y: centerY },
    se: { x: bounds.right, y: bounds.bottom },
    s: { x: centerX, y: bounds.bottom },
    sw: { x: bounds.left, y: bounds.bottom },
    w: { x: bounds.left, y: centerY }
  };
  return positions[handle];
}

function getSelectionAnchor(bounds: SelectionBounds, handle: SelectionHandle): SketchPoint {
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;
  const anchors: Record<SelectionHandle, SketchPoint> = {
    nw: { x: bounds.right, y: bounds.bottom },
    n: { x: centerX, y: bounds.bottom },
    ne: { x: bounds.left, y: bounds.bottom },
    e: { x: bounds.left, y: centerY },
    se: { x: bounds.left, y: bounds.top },
    s: { x: centerX, y: bounds.top },
    sw: { x: bounds.right, y: bounds.top },
    w: { x: bounds.right, y: centerY }
  };
  return anchors[handle];
}

function findSelectionHandle(point: SketchPoint, bounds: SelectionBounds, tolerance: number): SelectionHandle | null {
  for (const handle of SELECTION_HANDLES) {
    const position = getSelectionHandlePoint(bounds, handle);
    if (Math.hypot(point.x - position.x, point.y - position.y) <= tolerance) return handle;
  }
  return null;
}

function isInsideBounds(point: SketchPoint, bounds: SelectionBounds) {
  return point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom;
}

function interpolatePoint(start: SketchPoint, end: SketchPoint, t: number): SketchPoint {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
    pressure: (start.pressure ?? 0.5) + ((end.pressure ?? 0.5) - (start.pressure ?? 0.5)) * t
  };
}

function strokeToPolyline(stroke: SketchStroke): SketchPoint[] {
  const points = stroke.points;
  if (stroke.tool === "line") return points.length > 1 ? [points[0], points[points.length - 1]] : points;
  if (stroke.tool === "rect" && points.length > 1) {
    const start = points[0];
    const end = points[points.length - 1];
    return [
      start,
      { x: end.x, y: start.y, pressure: 0.5 },
      end,
      { x: start.x, y: end.y, pressure: 0.5 },
      start
    ];
  }
  if (stroke.tool === "ellipse" && points.length > 1) {
    const start = points[0];
    const end = points[points.length - 1];
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;
    const radiusX = Math.abs(end.x - start.x) / 2;
    const radiusY = Math.abs(end.y - start.y) / 2;
    return Array.from({ length: 97 }, (_, index) => {
      const angle = (index / 96) * Math.PI * 2;
      return { x: centerX + Math.cos(angle) * radiusX, y: centerY + Math.sin(angle) * radiusY, pressure: 0.5 };
    });
  }
  return points;
}

function segmentPolygonIntersections(start: SketchPoint, end: SketchPoint, polygon: SketchPoint[]) {
  const rx = end.x - start.x;
  const ry = end.y - start.y;
  const intersections: number[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    const sx = b.x - a.x;
    const sy = b.y - a.y;
    const denominator = rx * sy - ry * sx;
    if (Math.abs(denominator) < 1e-8) continue;
    const qpx = a.x - start.x;
    const qpy = a.y - start.y;
    const t = (qpx * sy - qpy * sx) / denominator;
    const u = (qpx * ry - qpy * rx) / denominator;
    if (t > 1e-6 && t < 1 - 1e-6 && u >= -1e-6 && u <= 1 + 1e-6) intersections.push(t);
  }
  return intersections;
}

function splitStrokeByPolygon(stroke: SketchStroke, polygon: SketchPoint[]) {
  const path = strokeToPolyline(stroke);
  if (path.length === 1) {
    return pointInPolygon(path[0], polygon)
      ? { inside: [{ ...stroke, id: uid() }], outside: [] as SketchStroke[] }
      : { inside: [] as SketchStroke[], outside: [stroke] };
  }

  const pieces: { inside: boolean; points: SketchPoint[] }[] = [];
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const cuts = [0, ...segmentPolygonIntersections(start, end, polygon), 1]
      .sort((a, b) => a - b)
      .filter((value, cutIndex, values) => cutIndex === 0 || Math.abs(value - values[cutIndex - 1]) > 1e-6);

    for (let cutIndex = 1; cutIndex < cuts.length; cutIndex += 1) {
      const from = cuts[cutIndex - 1];
      const to = cuts[cutIndex];
      if (to - from < 1e-6) continue;
      const midpoint = interpolatePoint(start, end, (from + to) / 2);
      const inside = pointInPolygon(midpoint, polygon);
      const first = interpolatePoint(start, end, from);
      const last = interpolatePoint(start, end, to);
      const previous = pieces[pieces.length - 1];
      const previousPoint = previous?.points[previous.points.length - 1];
      if (previous && previous.inside === inside && previousPoint &&
        Math.hypot(previousPoint.x - first.x, previousPoint.y - first.y) < 1e-3) {
        previous.points.push(last);
      } else {
        pieces.push({ inside, points: [first, last] });
      }
    }
  }

  const isShape = stroke.tool === "rect" || stroke.tool === "ellipse";
  const makeStroke = (points: SketchPoint[]): SketchStroke => ({
    ...stroke,
    id: uid(),
    tool: isShape ? "pen" : stroke.tool,
    points
  });
  const inside = pieces.filter(piece => piece.inside && piece.points.length > 1).map(piece => makeStroke(piece.points));
  const outside = pieces.filter(piece => !piece.inside && piece.points.length > 1).map(piece => makeStroke(piece.points));
  return inside.length ? { inside, outside } : { inside: [] as SketchStroke[], outside: [stroke] };
}

function distanceToSegment(point: SketchPoint, start: SketchPoint, end: SketchPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = dx * dx + dy * dy;
  if (!length) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / length, 0, 1);
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function hitStroke(point: SketchPoint, stroke: SketchStroke) {
  const tolerance = Math.max(14, stroke.size + 8);
  for (let i = 0; i < stroke.points.length; i += 1) {
    if (i === 0 && Math.hypot(point.x - stroke.points[i].x, point.y - stroke.points[i].y) <= tolerance) return true;
    if (i > 0 && distanceToSegment(point, stroke.points[i - 1], stroke.points[i]) <= tolerance) return true;
  }
  return false;
}

function documentToBlob(doc: SketchDocument): Promise<Blob> {
  const canvas = document.createElement("canvas");
  drawDocument(canvas, doc);
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("그림 파일을 만들지 못했습니다.")), "image/png");
  });
}

const TOOL_OPTIONS: { id: SketchTool; label: string; icon: typeof Brush }[] = [
  { id: "pen", label: "펜", icon: Brush },
  { id: "eraser", label: "지우개", icon: Eraser },
  { id: "lasso", label: "올가미", icon: Lasso },
  { id: "line", label: "직선", icon: Minus },
  { id: "rect", label: "사각형", icon: Square },
  { id: "ellipse", label: "타원", icon: Circle },
  { id: "eyedropper", label: "스포이드", icon: Pipette }
];

export default function SketchWorkspace({
  initialDocument,
  onSave,
  onClose,
  email,
  themeStyle,
  theme,
  customColor,
  onThemeChange,
  onCustomColorChange,
  onOpenNotebookList,
  onOpenCover,
  onSignOut,
  onDeleteAccount
}: Props) {
  const initial = useMemo(() => normalizeSketchDocument(initialDocument), [initialDocument]);
  const [doc, setDoc] = useState<SketchDocument>(initial);
  const docRef = useRef<SketchDocument>(initial);
  const [history, setHistory] = useState<SketchDocument[]>([initial]);
  const historyRef = useRef<SketchDocument[]>([initial]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyIndexRef = useRef(0);
  const [tool, setTool] = useState<SketchTool>("pen");
  const [color, setColor] = useState("#202124");
  const [brushSize, setBrushSize] = useState(6);
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [eraserSize, setEraserSize] = useState(28);
  const [eraserStrength, setEraserStrength] = useState(100);
  const [selectedLayerId, setSelectedLayerId] = useState(initial.layers[0]?.id ?? "");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [lassoPoints, setLassoPoints] = useState<SketchPoint[]>([]);
  const lassoPointsRef = useRef<SketchPoint[]>([]);
  const pointerModeRef = useRef<PointerMode | null>(null);
  const touchPointsRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStateRef = useRef<{ distance: number; zoom: number } | null>(null);
  const panStateRef = useRef<{ pointerId: number; startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasStageRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const [isPanning, setIsPanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const layout = getCanvasRatio(doc.width, doc.height);

  const selectedLayer = doc.layers.find(layer => layer.id === selectedLayerId) ?? doc.layers[0];

  const setWorkingDocument = useCallback((next: SketchDocument) => {
    docRef.current = next;
    setDoc(next);
  }, []);

  const commitDocument = useCallback((next: SketchDocument) => {
    const nextHistory = historyRef.current.slice(0, historyIndexRef.current + 1).concat([next]);
    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    docRef.current = next;
    setDoc(next);
    setDirty(true);
  }, []);

  const undo = useCallback(() => {
    const nextIndex = Math.max(0, historyIndexRef.current - 1);
    if (nextIndex === historyIndexRef.current) return;
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    const next = historyRef.current[nextIndex];
    docRef.current = next;
    setDoc(next);
    setSelectedKeys([]);
    setDirty(true);
  }, []);

  const redo = useCallback(() => {
    const nextIndex = Math.min(historyRef.current.length - 1, historyIndexRef.current + 1);
    if (nextIndex === historyIndexRef.current) return;
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    const next = historyRef.current[nextIndex];
    docRef.current = next;
    setDoc(next);
    setSelectedKeys([]);
    setDirty(true);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawDocument(canvas, doc);
    const context = canvas.getContext("2d");
    if (!context) return;
    if (lassoPoints.length > 1) {
      context.save();
      context.strokeStyle = "#6f83b0";
      context.fillStyle = "rgba(111,131,176,.12)";
      context.lineWidth = 2;
      context.setLineDash([9, 6]);
      context.beginPath();
      context.moveTo(lassoPoints[0].x, lassoPoints[0].y);
      lassoPoints.slice(1).forEach(point => context.lineTo(point.x, point.y));
      context.stroke();
      context.restore();
    }
    const selectionBounds = getSelectionBounds(doc, selectedKeys);
    if (selectionBounds) {
      context.save();
      context.strokeStyle = "#6f83b0";
      context.fillStyle = "#ffffff";
      context.lineWidth = 2;
      context.setLineDash([7, 5]);
      context.strokeRect(
        selectionBounds.left,
        selectionBounds.top,
        selectionBounds.right - selectionBounds.left,
        selectionBounds.bottom - selectionBounds.top
      );
      context.setLineDash([]);
      const handleSize = 12;
      for (const handle of SELECTION_HANDLES) {
        const position = getSelectionHandlePoint(selectionBounds, handle);
        context.fillRect(position.x - handleSize / 2, position.y - handleSize / 2, handleSize, handleSize);
        context.strokeRect(position.x - handleSize / 2, position.y - handleSize / 2, handleSize, handleSize);
      }
      context.restore();
    }
  }, [doc, lassoPoints, selectedKeys]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    const stage = canvasStageRef.current;
    if (!stage) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0015);
      setZoom(current => clamp(Math.round(current * factor), 50, 300));
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const stage = canvasStageRef.current;
    if (!stage) return;
    stage.scrollLeft = Math.max(0, (stage.scrollWidth - stage.clientWidth) / 2);
    stage.scrollTop = Math.max(0, (stage.scrollHeight - stage.clientHeight) / 2);
  }, [zoom, doc.width, doc.height]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
      } else if ((event.ctrlKey || event.metaKey) && key === "y") {
        event.preventDefault();
        redo();
      } else if ((event.ctrlKey || event.metaKey) && key === "s") {
        event.preventDefault();
        void saveSketch();
      } else if ((event.ctrlKey || event.metaKey) && key === "d" && selectedKeys.length) {
        event.preventDefault();
        duplicateSelection();
      } else if (key === "delete" || key === "backspace") {
        if (selectedKeys.length) {
          event.preventDefault();
          deleteSelection();
        }
      } else if (key === "b") setTool("pen");
      else if (key === "e") setTool("eraser");
      else if (key === "l") setTool("lasso");
      else if (key === "[") setBrushSize(value => clamp(value - 1, 1, 80));
      else if (key === "]") setBrushSize(value => clamp(value + 1, 1, 80));
      else if (key === "escape") {
        if (selectedKeys.length) setSelectedKeys([]);
        else requestClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  function cancelPointerForPinch() {
    const mode = pointerModeRef.current;
    if (mode?.kind === "stroke") {
      const current = docRef.current;
      const next: SketchDocument = {
        ...current,
        layers: current.layers.map(layer => layer.id === mode.layerId
          ? { ...layer, strokes: layer.strokes.filter(stroke => stroke.id !== mode.strokeId) }
          : layer)
      };
      setWorkingDocument(next);
    } else if (mode?.kind === "move" || mode?.kind === "scale") {
      setWorkingDocument(mode.origin);
    } else if (mode?.kind === "lasso") {
      lassoPointsRef.current = [];
      setLassoPoints([]);
    }
    pointerModeRef.current = null;
  }

  function handleStagePointerDownCapture(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button === 2) {
      const stage = event.currentTarget;
      panStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: stage.scrollLeft,
        scrollTop: stage.scrollTop
      };
      setIsPanning(true);
      try {
        stage.setPointerCapture(event.pointerId);
      } catch {}
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.pointerType !== "touch") return;

    touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touchPointsRef.current.size < 2) return;

    const points = Array.from(touchPointsRef.current.values()).slice(0, 2);
    const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    if (!pinchStateRef.current && distance > 0) {
      pinchStateRef.current = { distance, zoom };
      cancelPointerForPinch();
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
    event.preventDefault();
    event.stopPropagation();
  }

  function handleStagePointerMoveCapture(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panStateRef.current;
    if (pan && pan.pointerId === event.pointerId) {
      event.currentTarget.scrollLeft = pan.scrollLeft - (event.clientX - pan.startX);
      event.currentTarget.scrollTop = pan.scrollTop - (event.clientY - pan.startY);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.pointerType !== "touch" || !touchPointsRef.current.has(event.pointerId)) return;

    touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pinch = pinchStateRef.current;
    if (!pinch || touchPointsRef.current.size < 2) return;

    const points = Array.from(touchPointsRef.current.values()).slice(0, 2);
    const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    setZoom(clamp(Math.round(pinch.zoom * distance / pinch.distance), 50, 300));
    event.preventDefault();
    event.stopPropagation();
  }

  function handleStagePointerEndCapture(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = panStateRef.current;
    if (pan && pan.pointerId === event.pointerId) {
      panStateRef.current = null;
      setIsPanning(false);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.pointerType !== "touch" || !touchPointsRef.current.has(event.pointerId)) return;

    const wasPinching = pinchStateRef.current !== null;
    touchPointsRef.current.delete(event.pointerId);
    if (wasPinching) {
      pinchStateRef.current = null;
      touchPointsRef.current.clear();
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function canvasPoint(event: ReactPointerEvent<HTMLCanvasElement>): SketchPoint {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, pressure: 0.5 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) * (docRef.current.width / rect.width), 0, docRef.current.width),
      y: clamp((event.clientY - rect.top) * (docRef.current.height / rect.height), 0, docRef.current.height),
      pressure: event.pointerType === "mouse" || event.pressure === 0 ? 0.5 : clamp(event.pressure, 0.05, 1)
    };
  }

  function findHitSelected(point: SketchPoint) {
    const selected = new Set(selectedKeys);
    for (const layer of docRef.current.layers) {
      for (const stroke of layer.strokes) {
        if (selected.has(layer.id + ":" + stroke.id) && hitStroke(point, stroke)) return true;
      }
    }
    return false;
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = canvasPoint(event);
    const current = docRef.current;

    if (tool === "eyedropper") {
      const context = canvasRef.current?.getContext("2d");
      if (context) {
        const pixel = context.getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1).data;
        if (pixel[3] > 0) setColor("#" + [pixel[0], pixel[1], pixel[2]].map(value => value.toString(16).padStart(2, "0")).join(""));
      }
      return;
    }

    if (tool === "lasso") {
      const bounds = getSelectionBounds(current, selectedKeys);
      const handle = bounds ? findSelectionHandle(point, bounds, Math.max(5, 14 * 100 / zoom)) : null;
      if (bounds && handle) {
        pointerModeRef.current = {
          kind: "scale",
          start: getSelectionHandlePoint(bounds, handle),
          anchor: getSelectionAnchor(bounds, handle),
          bounds,
          handle,
          origin: current,
          keys: selectedKeys
        };
      } else if (bounds && (isInsideBounds(point, bounds) || findHitSelected(point))) {
        pointerModeRef.current = { kind: "move", start: point, origin: current, keys: selectedKeys };
      } else {
        setSelectedKeys([]);
        pointerModeRef.current = { kind: "lasso" };
        lassoPointsRef.current = [point];
        setLassoPoints([point]);
      }
      return;
    }

    if (!selectedLayer) return;
    const strokeTool = tool === "eraser" ? "eraser" : tool === "line" || tool === "rect" || tool === "ellipse" ? tool : "pen";
    const stroke: SketchStroke = {
      id: uid(),
      tool: strokeTool,
      color: color,
      size: tool === "eraser" ? eraserSize : brushSize,
      opacity: tool === "eraser" ? eraserStrength : brushOpacity,
      points: [point]
    };
    const next: SketchDocument = {
      ...current,
      layers: current.layers.map(layer => layer.id === selectedLayer.id ? { ...layer, strokes: [...layer.strokes, stroke] } : layer)
    };
    setWorkingDocument(next);
    pointerModeRef.current = { kind: "stroke", layerId: selectedLayer.id, strokeId: stroke.id };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const mode = pointerModeRef.current;
    if (!mode) return;
    const point = canvasPoint(event);
    if (mode.kind === "lasso") {
      const nextPoints = lassoPointsRef.current.concat([point]);
      lassoPointsRef.current = nextPoints;
      setLassoPoints(nextPoints);
      return;
    }
    if (mode.kind === "move") {
      const dx = point.x - mode.start.x;
      const dy = point.y - mode.start.y;
      const selected = new Set(mode.keys);
      const next: SketchDocument = {
        ...mode.origin,
        layers: mode.origin.layers.map(layer => ({
          ...layer,
          strokes: layer.strokes.map(stroke => selected.has(layer.id + ":" + stroke.id)
            ? { ...stroke, points: stroke.points.map(item => ({ ...item, x: clamp(item.x + dx, 0, mode.origin.width), y: clamp(item.y + dy, 0, mode.origin.height) })) }
            : stroke)
        }))
      };
      setWorkingDocument(next);
      return;
    }
    if (mode.kind === "scale") {
      const selected = new Set(mode.keys);
      const startVectorX = mode.start.x - mode.anchor.x;
      const startVectorY = mode.start.y - mode.anchor.y;
      const isCorner = ["nw", "ne", "se", "sw"].includes(mode.handle);
      let scaleX = Math.abs(startVectorX) > 1e-6 ? (point.x - mode.anchor.x) / startVectorX : 1;
      let scaleY = Math.abs(startVectorY) > 1e-6 ? (point.y - mode.anchor.y) / startVectorY : 1;

      if (isCorner && !event.shiftKey) {
        const denominator = startVectorX * startVectorX + startVectorY * startVectorY;
        const uniformScale = denominator > 1e-6
          ? ((point.x - mode.anchor.x) * startVectorX + (point.y - mode.anchor.y) * startVectorY) / denominator
          : 1;
        scaleX = uniformScale;
        scaleY = uniformScale;
      }

      scaleX = clamp(scaleX, 0.05, 10);
      scaleY = clamp(scaleY, 0.05, 10);
      const sizeScale = (scaleX + scaleY) / 2;
      const next: SketchDocument = {
        ...mode.origin,
        layers: mode.origin.layers.map(layer => ({
          ...layer,
          strokes: layer.strokes.map(stroke => selected.has(layer.id + ":" + stroke.id)
            ? {
                ...stroke,
                size: clamp(stroke.size * sizeScale, 1, 160),
                points: stroke.points.map(item => ({
                  ...item,
                  x: clamp(mode.anchor.x + (item.x - mode.anchor.x) * scaleX, 0, mode.origin.width),
                  y: clamp(mode.anchor.y + (item.y - mode.anchor.y) * scaleY, 0, mode.origin.height)
                }))
              }
            : stroke)
        }))
      };
      setWorkingDocument(next);
      return;
    }
    const current = docRef.current;
    const next: SketchDocument = {
      ...current,
      layers: current.layers.map(layer => layer.id === mode.layerId ? {
        ...layer,
        strokes: layer.strokes.map(stroke => {
          if (stroke.id !== mode.strokeId) return stroke;
          if (stroke.tool === "line" || stroke.tool === "rect" || stroke.tool === "ellipse") return { ...stroke, points: [stroke.points[0], point] };
          return { ...stroke, points: stroke.points.concat([point]) };
        })
      } : layer)
    };
    setWorkingDocument(next);
  }

  function handlePointerUp() {
    const mode = pointerModeRef.current;
    if (!mode) return;
    pointerModeRef.current = null;
    if (mode.kind === "lasso") {
      const polygon = lassoPointsRef.current;
      const selected: string[] = [];
      if (polygon.length > 2) {
        const nextLayers = docRef.current.layers.map(layer => ({
          ...layer,
          strokes: layer.strokes.flatMap(stroke => {
            const split = splitStrokeByPolygon(stroke, polygon);
            if (!split.inside.length) return [stroke];
            split.inside.forEach(piece => selected.push(layer.id + ":" + piece.id));
            return [...split.outside, ...split.inside];
          })
        }));
        if (selected.length) {
          commitDocument({ ...docRef.current, layers: nextLayers });
          setSelectedKeys(selected);
        } else {
          setSelectedKeys([]);
        }
      } else {
        setSelectedKeys([]);
      }
      lassoPointsRef.current = [];
      setLassoPoints([]);
      return;
    }
    if (mode.kind === "stroke" || mode.kind === "move" || mode.kind === "scale") commitDocument(docRef.current);
  }

  function addLayer() {
    const layer: SketchLayer = { id: uid(), name: "레이어 " + (doc.layers.length + 1), visible: true, opacity: 100, strokes: [] };
    const next = { ...docRef.current, layers: [...docRef.current.layers, layer] };
    commitDocument(next);
    setSelectedLayerId(layer.id);
    setSelectedKeys([]);
  }

  function updateLayer(patch: Partial<SketchLayer>) {
    if (!selectedLayer) return;
    setWorkingDocument({
      ...docRef.current,
      layers: docRef.current.layers.map(layer => layer.id === selectedLayer.id ? { ...layer, ...patch } : layer)
    });
  }

  function reorderLayer(direction: -1 | 1) {
    if (!selectedLayer) return;
    const layers = docRef.current.layers.slice();
    const index = layers.findIndex(layer => layer.id === selectedLayer.id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= layers.length) return;
    [layers[index], layers[nextIndex]] = [layers[nextIndex], layers[index]];
    commitDocument({ ...docRef.current, layers });
  }

  function deleteLayer() {
    if (!selectedLayer || docRef.current.layers.length <= 1) return;
    if (!window.confirm("선택한 레이어와 그 안의 그림을 삭제할까요?")) return;
    const layers = docRef.current.layers.filter(layer => layer.id !== selectedLayer.id);
    commitDocument({ ...docRef.current, layers });
    setSelectedLayerId(layers[layers.length - 1].id);
    setSelectedKeys([]);
  }

  function deleteSelection() {
    if (!selectedKeys.length) return;
    const selected = new Set(selectedKeys);
    const next = {
      ...docRef.current,
      layers: docRef.current.layers.map(layer => ({
        ...layer,
        strokes: layer.strokes.filter(stroke => !selected.has(layer.id + ":" + stroke.id))
      }))
    };
    commitDocument(next);
    setSelectedKeys([]);
  }

  function duplicateSelection() {
    if (!selectedKeys.length) return;
    const selected = new Set(selectedKeys);
    const next = {
      ...docRef.current,
      layers: docRef.current.layers.map(layer => {
        const copies = layer.strokes.filter(stroke => selected.has(layer.id + ":" + stroke.id)).map(stroke => ({
          ...stroke,
          id: uid(),
          points: stroke.points.map(point => ({ ...point, x: clamp(point.x + 24, 0, docRef.current.width), y: clamp(point.y + 24, 0, docRef.current.height) }))
        }));
        return { ...layer, strokes: layer.strokes.concat(copies) };
      })
    };
    commitDocument(next);
  }

  function changeLayout(nextLayout: CanvasRatio) {
    const preset = CANVAS_RATIOS.find(option => option.value === nextLayout);
    if (!preset) return;

    const current = docRef.current;
    const scale = Math.min(preset.width / current.width, preset.height / current.height);
    const offsetX = (preset.width - current.width * scale) / 2;
    const offsetY = (preset.height - current.height * scale) / 2;
    const next: SketchDocument = {
      ...current,
      width: preset.width,
      height: preset.height,
      layers: current.layers.map(layer => ({
        ...layer,
        strokes: layer.strokes.map(stroke => ({
          ...stroke,
          size: stroke.size * scale,
          points: stroke.points.map(point => ({
            ...point,
            x: point.x * scale + offsetX,
            y: point.y * scale + offsetY
          }))
        }))
      }))
    };

    commitDocument(next);
    setSelectedKeys([]);
    lassoPointsRef.current = [];
    setLassoPoints([]);
    setZoom(100);
  }

  function rotateCanvasClockwise() {
    const current = docRef.current;
    const next: SketchDocument = {
      ...current,
      width: current.height,
      height: current.width,
      layers: current.layers.map(layer => ({
        ...layer,
        strokes: layer.strokes.map(stroke => ({
          ...stroke,
          points: stroke.points.map(point => ({
            ...point,
            x: current.height - point.y,
            y: point.x
          }))
        }))
      }))
    };

    commitDocument(next);
    setSelectedKeys([]);
    lassoPointsRef.current = [];
    setLassoPoints([]);
    setZoom(100);
  }

  function changeBackgroundStyle(value: SketchDocument["backgroundStyle"]) {
    commitDocument({ ...docRef.current, backgroundStyle: value });
  }

  function requestClose() {
    if (dirty && !window.confirm("저장하지 않은 그림이 있습니다. 저장하지 않고 나가시겠습니까?")) return;
    onClose();
  }

  function navigateFromSketch(action: () => void) {
    if (dirty && !window.confirm("저장하지 않은 그림이 있습니다. 저장하지 않고 나가시겠습니까?")) return;
    onClose();
    action();
  }

  async function saveSketch() {
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      const blob = await documentToBlob(docRef.current);
      const saved = await onSave(blob, docRef.current);
      if (saved) {
        setDirty(false);
        onClose();
      } else {
        setMessage("저장하지 못했습니다. 연결 상태를 확인한 후 다시 시도해 주세요.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? "그림을 저장하지 못했습니다: " + error.message : "그림을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function downloadSketch() {
    try {
      const blob = await documentToBlob(docRef.current);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "picture-diary-sketch.png";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error instanceof Error ? "그림을 다운로드하지 못했습니다: " + error.message : "그림을 다운로드하지 못했습니다.");
    }
  }

  return (
    <div className="sketch-workspace app-shell planner-view" style={themeStyle} role="dialog" aria-modal="true" aria-label="그림 스케치 작업실">
      <AppSidebar
        email={email}
        currentView="markdown"
        themeStyle={themeStyle}
        theme={theme}
        customColor={customColor}
        onThemeChange={onThemeChange}
        onCustomColorChange={onCustomColorChange}
        onOpenNotebookList={() => navigateFromSketch(onOpenNotebookList)}
        onViewChange={view => {
          if (view === "cover") navigateFromSketch(onOpenCover);
        }}
        onSignOut={() => navigateFromSketch(onSignOut)}
        onDeleteAccount={() => navigateFromSketch(onDeleteAccount)}
      />
      <header className="site-header sketch-topbar">
        <div className="header-inner sketch-header-inner">
          <button type="button" className="brand" onClick={requestClose} aria-label="그림일기로 돌아가기">
            <span className="brand-lockup"><span className="brand-icon"><Check size={18} strokeWidth={3}/></span><span>CHECKPOINT</span></span>
          </button>
          <div className="sketch-topbar-center">
            <strong>스케치</strong>
            <span>{dirty ? "저장되지 않은 변경 사항이 있습니다." : "저장된 상태입니다."}</span>
          </div>
          <div className="sketch-topbar-actions">
            <button type="button" className="sketch-back-button" onClick={requestClose}>
              <ArrowLeft size={17}/><span>일기로 돌아가기</span>
            </button>
            <button type="button" className="sketch-icon-action" title="PNG 다운로드" aria-label="PNG 다운로드" onClick={() => void downloadSketch()}>
              <Download size={18}/>
            </button>
            <button type="button" className="sketch-save-action" disabled={saving} onClick={() => void saveSketch()}>
              <Save size={16}/><span>{saving ? "저장 중입니다..." : "저장"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="sketch-main-area">
        <div className="sketch-layout">
        <aside className="sketch-tool-rail" aria-label="그리기 도구">
          {TOOL_OPTIONS.map(option => {
            const Icon = option.icon;
            return (
              <button key={option.id} type="button" className={tool === option.id ? "sketch-tool-button is-active" : "sketch-tool-button"}
                aria-pressed={tool === option.id} title={option.label} aria-label={option.label} onClick={() => setTool(option.id)}>
                <Icon size={19}/><span>{option.label}</span>
              </button>
            );
          })}
          <div className="sketch-tool-divider"/>
          <button type="button" className="sketch-tool-button" title="실행 취소" aria-label="실행 취소" disabled={historyIndex === 0} onClick={undo}><Undo2 size={18}/><span>실행 취소</span></button>
          <button type="button" className="sketch-tool-button" title="다시 실행" aria-label="다시 실행" disabled={historyIndex >= history.length - 1} onClick={redo}><Redo2 size={18}/><span>다시 실행</span></button>
          <button type="button" className="sketch-tool-button" title="선택 삭제" aria-label="선택 삭제" disabled={!selectedKeys.length} onClick={deleteSelection}><Trash2 size={18}/><span>선택 삭제</span></button>
        </aside>

        <section className="sketch-canvas-area" aria-label="그림 캔버스">
          <div className="sketch-canvas-toolbar">
            <div className="sketch-zoom-controls">
              <button type="button" aria-label="축소" title="축소" onClick={() => setZoom(value => clamp(value - 10, 50, 300))}><ZoomOut size={16}/></button>
              <span>{zoom}%</span>
              <button type="button" aria-label="확대" title="확대" onClick={() => setZoom(value => clamp(value + 10, 50, 300))}><ZoomIn size={16}/></button>
              <button type="button" title="화면에 맞춤" aria-label="화면에 맞춤" onClick={() => setZoom(100)}><LayoutGrid size={15}/></button>
              <button type="button" className="sketch-rotate-button" title="캔버스를 시계 방향으로 90도 회전" aria-label="캔버스 90도 회전" onClick={rotateCanvasClockwise}>
                <RotateCw size={15}/><span>90° 회전</span>
              </button>
            </div>
            <span className="sketch-canvas-size">{doc.width} × {doc.height}px</span>
            <button type="button" className="sketch-clear-button" onClick={() => {
              if (!selectedLayer || !window.confirm("현재 레이어의 그림을 모두 삭제할까요?")) return;
              commitDocument({ ...docRef.current, layers: docRef.current.layers.map(layer => layer.id === selectedLayer.id ? { ...layer, strokes: [] } : layer) });
              setSelectedKeys([]);
            }}><Trash2 size={14}/> 현재 레이어 비우기</button>
          </div>
          <div
            ref={canvasStageRef}
            className={isPanning ? "sketch-canvas-stage is-panning" : "sketch-canvas-stage"}
            onContextMenu={event => event.preventDefault()}
            onPointerDownCapture={handleStagePointerDownCapture}
            onPointerMoveCapture={handleStagePointerMoveCapture}
            onPointerUpCapture={handleStagePointerEndCapture}
            onPointerCancelCapture={handleStagePointerEndCapture}
          >
            <div className="sketch-canvas-wrap" style={{ width: zoom + "%" }}>
              <canvas ref={canvasRef} className="sketch-canvas" width={doc.width} height={doc.height}
                onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp} aria-label="그림 그리기 영역"/>
            </div>
          </div>
          <div className="sketch-bottom-hint">
            <span>펜: B</span><span>지우개: E</span><span>올가미: L</span><span>실행 취소: Ctrl + Z</span><span>이동: 마우스 오른쪽 버튼 드래그</span><span>확대·축소: 마우스 휠 · 두 손가락</span>
            {selectedKeys.length ? <strong>{selectedKeys.length}개 선택됨 · Ctrl + D 복제 · Delete 삭제</strong> : null}
          </div>
        </section>

        <aside className="sketch-settings-panel">
          <section className="sketch-settings-section">
            <div className="sketch-panel-heading"><strong>{tool === "eraser" ? "지우개 설정" : tool === "lasso" ? "올가미 선택" : "도구 설정"}</strong></div>
            {tool === "pen" || tool === "line" || tool === "rect" || tool === "ellipse" ? (
              <>
                <label className="sketch-control-label">색상</label>
                <div className="sketch-color-row">
                  <input type="color" value={color} aria-label="펜 색상" onChange={event => setColor(event.target.value)}/>
                  <div className="sketch-color-swatches">{COLOR_SWATCHES.map(swatch => <button key={swatch} type="button" aria-label={"색상 " + swatch} title={swatch} style={{ background: swatch }} className={color.toLowerCase() === swatch ? "is-selected" : ""} onClick={() => setColor(swatch)}/>)}</div>
                </div>
                <label className="sketch-range-label"><span>펜 굵기</span><strong>{brushSize}px</strong></label>
                <input className="sketch-range" type="range" min={1} max={80} value={brushSize} onChange={event => setBrushSize(Number(event.target.value))}/>
                <label className="sketch-range-label"><span>투명도</span><strong>{brushOpacity}%</strong></label>
                <input className="sketch-range" type="range" min={1} max={100} value={brushOpacity} onChange={event => setBrushOpacity(Number(event.target.value))}/>
              </>
            ) : tool === "eraser" ? (
              <>
                <label className="sketch-range-label"><span>지우개 굵기</span><strong>{eraserSize}px</strong></label>
                <input className="sketch-range" type="range" min={2} max={160} value={eraserSize} onChange={event => setEraserSize(Number(event.target.value))}/>
                <label className="sketch-range-label"><span>지우개 강도</span><strong>{eraserStrength}%</strong></label>
                <input className="sketch-range" type="range" min={5} max={100} value={eraserStrength} onChange={event => setEraserStrength(Number(event.target.value))}/>
                <p className="sketch-setting-help">강도를 낮추면 한 번에 지워지는 양이 줄어듭니다.</p>
              </>
            ) : tool === "lasso" ? (
              <div className="sketch-selection-actions">
                <p>올가미로 둘러싼 영역 안의 선 부분만 분리됩니다. 선택 영역 안쪽을 드래그해 이동하고, 테두리의 조절점을 드래그해 크기를 바꿀 수 있습니다. 모서리 조절은 비율을 유지하며, Shift를 누르면 가로·세로를 따로 조절합니다.</p>
                <button type="button" disabled={!selectedKeys.length} onClick={duplicateSelection}>선택 복제</button>
                <button type="button" disabled={!selectedKeys.length} onClick={deleteSelection}>선택 삭제</button>
                <button type="button" disabled={!selectedKeys.length} onClick={() => setSelectedKeys([])}>선택 해제</button>
              </div>
            ) : (
              <p className="sketch-setting-help">캔버스에서 시작점을 누른 뒤 드래그해 도형을 그릴 수 있습니다.</p>
            )}
          </section>

          <section className="sketch-settings-section">
            <div className="sketch-panel-heading">
              <strong>레이어</strong>
              <button type="button" title="새 레이어" aria-label="새 레이어" onClick={addLayer}><Plus size={16}/></button>
            </div>
            <div className="sketch-layer-list">
              {[...doc.layers].reverse().map(layer => (
                <div key={layer.id} className={layer.id === selectedLayer?.id ? "sketch-layer-row is-active" : "sketch-layer-row"}>
                  <button type="button" className="sketch-layer-select" onClick={() => { setSelectedLayerId(layer.id); setSelectedKeys([]); }}>
                    <span className="sketch-layer-thumbnail"><Layers3 size={15}/></span>
                    <span>{layer.name}</span>
                  </button>
                  <button type="button" className="sketch-layer-visibility" aria-label={layer.visible ? "레이어 숨기기" : "레이어 표시"} title={layer.visible ? "숨기기" : "표시"} onClick={() => commitDocument({ ...docRef.current, layers: docRef.current.layers.map(item => item.id === layer.id ? { ...item, visible: !item.visible } : item) })}>
                    {layer.visible ? <Eye size={15}/> : <EyeOff size={15}/>}
                  </button>
                </div>
              ))}
            </div>
            {selectedLayer ? (
              <>
                <label className="sketch-layer-name-label">레이어 이름</label>
                <input className="sketch-layer-name-input" value={selectedLayer.name} maxLength={32} onChange={event => updateLayer({ name: event.target.value })} onBlur={() => commitDocument(docRef.current)}/>
                <label className="sketch-range-label"><span>레이어 불투명도</span><strong>{selectedLayer.opacity}%</strong></label>
                <input className="sketch-range" type="range" min={0} max={100} value={selectedLayer.opacity} onChange={event => updateLayer({ opacity: Number(event.target.value) })} onPointerUp={() => commitDocument(docRef.current)} onKeyUp={() => commitDocument(docRef.current)}/>
                <div className="sketch-layer-actions">
                  <button type="button" title="위로 이동" aria-label="레이어 위로 이동" onClick={() => reorderLayer(1)}><MoveUp size={15}/></button>
                  <button type="button" title="아래로 이동" aria-label="레이어 아래로 이동" onClick={() => reorderLayer(-1)}><MoveDown size={15}/></button>
                  <button type="button" title="레이어 삭제" aria-label="레이어 삭제" disabled={doc.layers.length <= 1} onClick={deleteLayer}><Trash2 size={15}/></button>
                </div>
              </>
            ) : null}
          </section>

          <section className="sketch-settings-section">
            <div className="sketch-panel-heading"><strong>캔버스 레이아웃</strong></div>
            <label className="sketch-control-label">비율</label>
            <select className="sketch-select" value={layout} onChange={event => changeLayout(event.target.value as CanvasRatio)}>
              <option value="1:1">1:1</option>
              <option value="3:4">3:4</option>
              <option value="4:3">4:3</option>
              <option value="9:16">9:16</option>
              <option value="16:9">16:9</option>
            </select>
            <label className="sketch-control-label">배경</label>
            <select className="sketch-select" value={doc.backgroundStyle} onChange={event => changeBackgroundStyle(event.target.value as SketchDocument["backgroundStyle"])}>
              <option value="plain">흰 종이</option>
              <option value="grid">모눈 종이</option>
              <option value="ruled">줄 노트</option>
              <option value="transparent">투명 배경</option>
            </select>
            {doc.backgroundStyle !== "transparent" ? (
              <label className="sketch-background-color">종이 색상<input type="color" value={doc.background} onChange={event => commitDocument({ ...docRef.current, background: event.target.value })}/></label>
            ) : null}
          </section>
        </aside>
        </div>
      </main>
      {message ? <div className="sketch-message" role="status">{message}</div> : null}
    </div>
  );
}
