// file: functions/api/admin/temp-code.js

import { json, error, requireEnv, assertAdmin, sha256Hex } from "../_utils.js";

export async function onRequestPost({ request, env }) {
  try {
    requireEnv(env);
    assertAdmin(request);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await env.DB.prepare(`
      INSERT INTO temp_post_codes (
        code_hash,
        expires_at
      ) VALUES (?, ?)
    `).bind(codeHash, expiresAt).run();

    return json({
      code,
      expires_at: expiresAt,
    }, 201);
  } catch (exception) {
    if (exception instanceof Response) return exception;
    return error(exception.message || "一時投稿コード発行に失敗しました。", 500);
  }
}
