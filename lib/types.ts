export type ThemeName = "white" | "pink" | "blue" | "black" | "custom";
export type TodoStatus = "todo" | "doing" | "done";
export type Todo = { id: string; title: string; checked: boolean; status?: TodoStatus };
export type Timetable = Record<string, string>;
export type Entry = {
  date: string;
  dday: string;
  headerLabel: string;
  headerValue: string;
  focus: string;
  keypoint: string;
  todos: Todo[];
  memo: string;
  timetable: Timetable;
};
export type CoverItem = { id: string; kind: "sticker" | "photo"; value: string; x: number; y: number; size: number };
export type Cover = { title: string; subtitle: string; items: CoverItem[] };
export const emptyEntry = (date: string): Entry => ({
  date, dday: "", headerLabel: "", headerValue: "", focus: "", keypoint: "",
  todos: Array.from({ length: 10 }, (_, index) => ({ id: `starter-${index + 1}`, title: "", checked: false, status: "todo" as const })),
  memo: "", timetable: {}
});
export const defaultCover: Cover = {title: "CHECKPOINT", subtitle: "YOUR PACE, YOUR CHECKPOINT.", items: []};

export const themes: Record<ThemeName, { bg: string; paper: string; ink: string; accent: string; soft: string; line: string; cover: string; coverInk: string }> = {
  white: {bg:"#f4f3f0",paper:"#ffffff",ink:"#303946",accent:"#7186a8",soft:"#e9edf3",line:"#e5e6e8",cover:"#edece9",coverInk:"#374151"},
  pink: {bg:"#fbf3f4",paper:"#fffefe",ink:"#584450",accent:"#c8859c",soft:"#f8e4eb",line:"#f0dfe4",cover:"#ebbacb",coverInk:"#604050"},
  blue: {bg:"#f0f4fb",paper:"#ffffff",ink:"#34465e",accent:"#7395c7",soft:"#e3ecfa",line:"#dce6f3",cover:"#789bc8",coverInk:"#fff9dc"},
  black: {bg:"#15181e",paper:"#22262d",ink:"#f0f1f5",accent:"#a9b4d5",soft:"#343b48",line:"#3b414a",cover:"#2c3038",coverInk:"#f7f3ec"},
  custom: {bg:"#f2f4f6",paper:"#ffffff",ink:"#303946",accent:"#8b9ec4",soft:"#ecf0f7",line:"#dee2e8",cover:"#8b9ec4",coverInk:"#ffffff"}
};
export const STICKERS = ["✦", "♡", "☁", "✿", "★", "☕", "✎", "☾", "☀", "❀", "✧", "♥", "♫", "☘"];
