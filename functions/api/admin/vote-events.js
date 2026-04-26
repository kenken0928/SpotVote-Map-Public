// file: functions/api/admin/vote-events.js

import {
  json,
  error,
  readJson,
  requireEnv,
  assertAdmin,
  randomSlug,
} from "../_utils.js";

export async function onRequestGet({ request, env }) {
  try {
    requireEnv(env);
    assertAdmin(request);

    const result = await env.DB.prepare(`
      SELECT
        id,
        slug,
        title,
        description,
        expires_at,
        is_active,
        created_at
      FROM vote_events
      ORDER BY created_at DESC
    `).all();

    return json({ events: result.results || [] });
  } catch (exception) {
    if (exception instanceof Response) return exception;
    return error(exception.message || "投票イベント一覧の取得に失敗しました。", 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    requireEnv(env);
    assertAdmin(request);

    const body = await readJson(request);
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const expiresAt = String(body.expires_at || "").trim();
    const pinIds = Array.isArray(body.pin_ids) ? body.pin_ids.map(Number).filter(Number.isInteger) : [];

    if (!title) return error("イベント名は必須です。", 400);
    if (!expiresAt || Number.isNaN(new Date(expiresAt).getTime())) return error("期限が不正です。", 400);
    if (new Date(expiresAt).getTime() <= Date.now()) return error("期限は未来日時にしてください。", 400);
    if (pinIds.length < 2) return error("候補スポットは2件以上必要です。", 400);

    const slug = randomSlug(28);

    const eventResult = await env.DB.prepare(`
      INSERT INTO vote_events (
        slug,
        title,
        description,
        expires_at,
        is_active
      ) VALUES (?, ?, ?, ?, 1)
    `).bind(slug, title, description, expiresAt).run();

    const eventId = eventResult.meta.last_row_id;

    for (const [index, pinId] of pinIds.entries()) {
      await env.DB.prepare(`
        INSERT INTO vote_event_pins (
          event_id,
          pin_id,
          sort_order
        ) VALUES (?, ?, ?)
      `).bind(eventId, pinId, index + 1).run();
    }

    const event = await env.DB.prepare(`
      SELECT id, slug, title, description, expires_at, is_active, created_at
      FROM vote_events
      WHERE id = ?
    `).bind(eventId).first();

    return json({ event }, 201);
  } catch (exception) {
    if (exception instanceof Response) return exception;
    return error(exception.message || "投票イベント作成に失敗しました。", 400);
  }
}
