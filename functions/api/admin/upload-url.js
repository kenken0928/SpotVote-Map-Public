// file: functions/api/admin/upload-url.js

import {
  json,
  error,
  requireEnv,
  assertAdmin,
  savePinImage,
} from "../_utils.js";

export async function onRequestPost({ request, env }) {
  try {
    requireEnv(env);
    assertAdmin(request);

    const formData = await request.formData();
    const pinId = Number(formData.get("pin_id"));
    const file = formData.get("file");

    const image = await savePinImage(env, pinId, file);

    return json({
      ok: true,
      ...image,
    }, 201);
  } catch (exception) {
    if (exception instanceof Response) return exception;
    return error(exception.message || "画像アップロードに失敗しました。", 400);
  }
}
