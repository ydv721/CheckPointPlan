import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CHECKPOINT | 다시 시작하는 나의 플래너",
  description: "계획이 바뀌어도 괜찮아. 내 속도로 기록하는 데일리 플래너.",
  applicationName: "CHECKPOINT",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}
