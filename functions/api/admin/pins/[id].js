// file: functions/api/admin/pins/[id].js

import {
  json,
  error,
  requireEnv,
  assertAdmin,
  readPinRequest,
  updatePin,
  savePinImage,
  getPinById,
  deletePinWithImages,
} from "../../_utils.js";

export async function onRequestPut({ request, env, params }) {
  try {
    requireEnv(env);
    assertAdmin(request);

    const id = Number(params.id);
    if (!Number.isInteger(id)) {
      return error("スポットIDが不正です。", 400);
    }

    const { payload, file } = await readPinRequest(request);

    await updatePin(env, id, payload);

    if (file) {
      await savePinImage(env, id, file);
    }

    const pin = await getPinById(env, id, false);

    return json({ pin });
  } catch (exception) {
    if (exception instanceof Response) return exception;
    return error(exception.message || "スポット更新に失敗しました。", 400);
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    requireEnv(env);
    assertAdmin(request);

    const id = Number(params.id);
    if (!Number.isInteger(id)) {
      return error("スポットIDが不正です。", 400);
    }

    await deletePinWithImages(env, id);

    return json({ ok: true });
  } catch (exception) {
    if (exception instanceof Response) return exception;
    return error(exception.message || "スポット削除に失敗しました。", 400);
  }
}
