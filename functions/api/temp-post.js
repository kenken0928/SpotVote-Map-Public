// file: functions/api/temp-post.js

import {
  json,
  error,
  requireEnv,
  readJson,
  readPinRequest,
  createPin,
  savePinImage,
  deletePinWithImages,
  sha256Hex,
} from "./_utils.js";

export async function onRequestPost({ request, env }) {
  let createdPin = null;

  try {
    requireEnv(env);

    const contentType = request.headers.get("content-type") || "";

    let code = "";
    let payload;
    let file;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();

      code = String(formData.get("code") || "").trim();

      const fakeRequest = new Request(request.url, {
        method: "POST",
        body: formData,
      });

      const parsed = await readPinRequest(fakeRequest);
      payload = parsed.payload;
      file = parsed.file;
    } else {
      const body = await readJson(request);

      code = String(body.code || "").trim();

      const fakeRequest = new Request(request.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...body,
          is_public: "1",
          memo: "",
          show_description: "1",
          show_address: "1",
          show_memo: "0",
          show_url: "1",
          show_image: "1",
        }),
      });

      const parsed = await readPinRequest(fakeRequest);
      payload = parsed.payload;
      file = parsed.file;
    }

    if (!/^\d{6}$/.test(code)) {
      return error("6桁コードが不正です。", 400);
    }

    const codeHash = await sha256Hex(code);

    const tempCode = await env.DB.prepare(`
      SELECT id, expires_at, used_at
      FROM temp_post_codes
      WHERE code_hash = ?
    `).bind(codeHash).first();

    if (!tempCode) {
      return error("6桁コードが見つかりません。", 400);
    }

    if (tempCode.used_at) {
      return error("この6桁コードはすでに使用済みです。", 400);
    }

    if (new Date(tempCode.expires_at).getTime() < Date.now()) {
      return error("この6桁コードは期限切れです。", 400);
    }

    createdPin = await createPin(env, payload, 1);

    if (file) {
      await savePinImage(env, createdPin.id, file);
    }

    await env.DB.prepare(`
      UPDATE temp_post_codes
      SET used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(tempCode.id).run();

    const pin = await env.DB.prepare(`
      SELECT *
      FROM pins
      WHERE id = ?
    `).bind(createdPin.id).first();

    return json({ pin: pin || createdPin }, 201);
  } catch (exception) {
    if (createdPin?.id) {
      try {
        await deletePinWithImages(env, createdPin.id);
      } catch {
        // ロールバック失敗時も、元のエラーを返す
      }
    }

    return error(exception.message || "投稿に失敗しました。", 400);
  }
}

export async function onRequestGet() {
  return error("Method not allowed", 405);
}
