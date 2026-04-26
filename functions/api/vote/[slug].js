// file: functions/api/vote/[slug].js

import { json, error, readJson, requireEnv } from "../_utils.js";

async function getEvent(env, slug) {
  return await env.DB.prepare(`
    SELECT
      id,
      slug,
      title,
      description,
      expires_at,
      is_active,
      created_at,
      CASE
        WHEN datetime(expires_at) <= datetime('now') THEN 1
        ELSE 0
      END AS is_expired
    FROM vote_events
    WHERE slug = ?
      AND is_active = 1
  `).bind(slug).first();
}

async function getActiveEvent(env, slug) {
  return await env.DB.prepare(`
    SELECT
      id,
      slug,
      title,
      description,
      expires_at,
      is_active,
      created_at
    FROM vote_events
    WHERE slug = ?
      AND is_active = 1
      AND datetime(expires_at) > datetime('now')
  `).bind(slug).first();
}

export async function onRequestGet({ env, params }) {
  try {
    requireEnv(env);

    const slug = String(params.slug || "");
    const event = await getEvent(env, slug);

    if (!event) {
      return error("投票イベントが存在しません。", 404);
    }

    const pinsResult = await env.DB.prepare(`
      SELECT
        p.id,
        p.title,
        p.description,
        p.lat,
        p.lng,
        p.category_id,
        p.is_public,
        c.name AS category_name,
        p.address,
        p.memo,
        p.url,
        img.public_url AS image_url
      FROM vote_event_pins vep
      INNER JOIN pins p ON p.id = vep.pin_id
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN (
        SELECT i1.*
        FROM images i1
        INNER JOIN (
          SELECT pin_id, MAX(id) AS max_id
          FROM images
          GROUP BY pin_id
        ) latest ON latest.max_id = i1.id
      ) img ON img.pin_id = p.id
      WHERE vep.event_id = ?
      ORDER BY vep.sort_order ASC, p.id ASC
    `).bind(event.id).all();

    const votesResult = await env.DB.prepare(`
      SELECT
        v.id,
        v.voter_name,
        v.voter_comment,
        v.created_at,
        p.title AS pin_title,
        p.id AS pin_id
      FROM votes v
      INNER JOIN pins p ON p.id = v.pin_id
      WHERE v.event_id = ?
      ORDER BY v.created_at DESC, v.id DESC
    `).bind(event.id).all();

    return json({
      event,
      pins: pinsResult.results || [],
      votes: votesResult.results || [],
      is_expired: Number(event.is_expired) === 1,
    });
  } catch (exception) {
    return error(exception.message || "投票イベント取得に失敗しました。", 500);
  }
}

export async function onRequestPost({ request, env, params }) {
  try {
    requireEnv(env);

    const slug = String(params.slug || "");
    const event = await getActiveEvent(env, slug);

    if (!event) {
      return error("投票イベントが存在しない、または期限切れです。", 404);
    }

    const body = await readJson(request);
    const pinId = Number(body.pin_id);
    const voterName = String(body.voter_name || "").trim();
    const voterComment = String(body.voter_comment || "").trim();

    if (!Number.isInteger(pinId)) return error("投票先が不正です。", 400);
    if (!voterName) return error("お名前は必須です。", 400);

    const candidate = await env.DB.prepare(`
      SELECT 1
      FROM vote_event_pins
      WHERE event_id = ?
        AND pin_id = ?
    `).bind(event.id, pinId).first();

    if (!candidate) return error("このイベントの候補ではありません。", 400);

    await env.DB.prepare(`
      INSERT INTO votes (
        event_id,
        pin_id,
        voter_name,
        voter_comment
      ) VALUES (?, ?, ?, ?)
    `).bind(event.id, pinId, voterName, voterComment).run();

    return json({ ok: true }, 201);
  } catch (exception) {
    return error(exception.message || "投票に失敗しました。", 400);
  }
}
