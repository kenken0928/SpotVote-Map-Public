// file: functions/api/admin/cleanup-expired-events.js

import { json, error, requireEnv, assertAdmin } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  try {
    requireEnv(env);
    assertAdmin(request);

    const expired = await env.DB.prepare(`
      SELECT id
      FROM vote_events
      WHERE datetime(expires_at) <= datetime('now')
    `).all();

    const ids = (expired.results || []).map((row) => row.id);

    for (const id of ids) {
      await env.DB.prepare("DELETE FROM vote_events WHERE id = ?").bind(id).run();
    }

    return json({
      ok: true,
      deleted: ids.length,
    });
  } catch (exception) {
    if (exception instanceof Response) return exception;
    return error(exception.message || "期限切れイベント削除に失敗しました。", 500);
  }
}
