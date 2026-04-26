// file: functions/api/admin/vote-events/[id].js

import { json, error, requireEnv, assertAdmin } from "../../_utils.js";

export async function onRequestDelete({ request, env, params }) {
  try {
    requireEnv(env);
    assertAdmin(request);

    const id = Number(params.id);
    if (!Number.isInteger(id)) return error("投票イベントIDが不正です。", 400);

    await env.DB.prepare("DELETE FROM vote_events WHERE id = ?").bind(id).run();

    return json({ ok: true });
  } catch (exception) {
    if (exception instanceof Response) return exception;
    return error(exception.message || "投票イベント削除に失敗しました。", 500);
  }
}
