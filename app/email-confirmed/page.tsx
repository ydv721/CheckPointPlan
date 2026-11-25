"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Status = "checking" | "confirmed" | "unverified";

export default function EmailConfirmedPage() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const client = supabase();
    if (!client) {
      setStatus("unverified");
      return;
    }

    let active = true;
    const isConfirmed = (user: { email_confirmed_at?: string; confirmed_at?: string } | null) =>
      Boolean(user?.email_confirmed_at || user?.confirmed_at);

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (!active || !session?.user) return;
      setStatus(isConfirmed(session.user) ? "confirmed" : "unverified");
    });

    client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      const user = data.session?.user ?? null;
      setStatus(!error && isConfirmed(user) ? "confirmed" : "unverified");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const heading =
    status === "checking"
      ? "인증 상태를 확인하고 있습니다."
      : status === "confirmed"
        ? "이메일 인증이 완료되었습니다."
        : "인증 상태를 확인하지 못했어요.";

  const description =
    status === "checking"
      ? "잠시만 기다려 주세요."
      : status === "confirmed"
        ? "CHECKPOINT에 오신 것을 환영합니다. 이제 플래너를 이용하실 수 있습니다."
        : "인증 링크가 만료되었거나 확인이 완료되지 않았을 수 있어요. CHECKPOINT에서 다시 로그인해 주세요.";

  return (
    <main className="email-confirmed-page">
      <section className="email-confirmed-card" aria-live="polite">
        <div className="email-confirmed-mark" aria-hidden="true">
          {status === "checking" ? "…" : status === "confirmed" ? "✓" : "!"}
        </div>
        <p className="email-confirmed-eyebrow">CHECKPOINT</p>
        <h1>{heading}</h1>
        <p className="email-confirmed-description">{description}</p>
        <a className="email-confirmed-link" href="https://checkpoint-plan.vercel.app/">
          CHECKPOINT로 이동
        </a>
        <p className="email-confirmed-note">
          매일 완벽하지 않아도 괜찮아요. 멈췄던 곳에서 언제든 다시 시작할 수 있어요.
        </p>
      </section>
    </main>
  );
}
