import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://checkpoint-plan.vercel.app",
  "http://localhost:3000",
]);

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") ?? "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin)
      ? origin
      : "https://checkpoint-plan.vercel.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };

  const respond = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "허용되지 않은 요청입니다." }, 405);
  if (origin && !allowedOrigins.has(origin)) {
    return respond({ error: "허용되지 않은 요청 경로입니다." }, 403);
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) return respond({ error: "로그인 인증이 필요합니다." }, 401);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const secretMap = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const adminKey = secretMap.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !adminKey) {
      return respond({ error: "계정 삭제 서비스를 사용할 수 없습니다. 관리자 설정을 확인해 주세요." }, 503);
    }

    const admin = createClient(url, adminKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = tokenMatch[1];
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const user = userData.user;
    if (userError || !user) {
      return respond({ error: "로그인 인증이 만료되었습니다. 다시 로그인해 주세요." }, 401);
    }
    if (!user.email) {
      return respond({ error: "계정 이메일을 확인할 수 없습니다." }, 400);
    }

    const body = await req.json().catch(() => null);
    const confirmEmail = typeof body?.confirmEmail === "string"
      ? body.confirmEmail.trim().toLowerCase()
      : "";
    if (confirmEmail !== user.email.toLowerCase()) {
      return respond({ error: "로그인한 이메일 주소가 일치하지 않습니다." }, 400);
    }

    // Cover uploads are stored directly under the authenticated user's UUID.
    const bucket = admin.storage.from("checkpoint-covers");
    const objectPaths: string[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await bucket.list(user.id, { limit: 1000, offset });
      if (error) {
        return respond({ error: "표지 이미지 정리 중 문제가 발생했습니다. 계정은 삭제되지 않았습니다." }, 500);
      }
      const page = data ?? [];
      objectPaths.push(
        ...page.filter((item) => item.id).map((item) => `${user.id}/${item.name}`),
      );
      if (page.length < 1000) break;
      offset += page.length;
    }

    for (let index = 0; index < objectPaths.length; index += 100) {
      const { error } = await bucket.remove(objectPaths.slice(index, index + 100));
      if (error) {
        return respond({ error: "표지 이미지 정리 중 문제가 발생했습니다. 계정은 삭제되지 않았습니다." }, 500);
      }
    }

    // Revoke all refresh-token sessions before permanently deleting the account.
    const { error: revokeError } = await admin.auth.admin.signOut(token, "global");
    if (revokeError) {
      return respond({ error: "로그인 세션을 종료하지 못했습니다. 계정은 삭제되지 않았습니다." }, 500);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return respond({ error: "계정 삭제를 완료하지 못했습니다. 다시 시도해 주세요." }, 500);
    }

    return respond({ success: true });
  } catch {
    return respond({ error: "계정 삭제 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." }, 500);
  }
});
