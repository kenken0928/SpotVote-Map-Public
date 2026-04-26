// file: functions/api/admin/pins.js

import {
  json,
  error,
  requireEnv,
  assertAdmin,
  listCategories,
  getPinRows,
  readPinRequest,
  createPin,
  savePinImage,
  deletePinWithImages,
} from "../_utils.js";

export async function onRequestGet({ request, env }) {
  try {
    requireEnv(env);
    assertAdmin(request);

    const [pins, categories] = await Promise.all([
      getPinRows(env, false),
      listCategories(env),
    ]);

    return json({ pins, categories });
  } catch (exception) {
    if (exception instanceof Response) return exception;
    return error(exception.message || "管理用スポット一覧の取得に失敗しました。", 500);
  }
}

export async function onRequestPost({ request, env }) {
  let createdPin = null;

  try {
    requireEnv(env);
    assertAdmin(request);

    const { payload, file } = await readPinRequest(request);

    createdPin = await createPin(env, payload, 0);

    if (file) {
      await savePinImage(env, createdPin.id, file);
    }

    const pins = await getPinRows(env, false);
    const pin = pins.find((item) => Number(item.id) === Number(createdPin.id)) || createdPin;

    return json({ pin }, 201);
  } catch (exception) {
    if (createdPin?.id) {
      try {
        await deletePinWithImages(env, createdPin.id);
      } catch {
        // ロールバック失敗時も、元のエラーを返す
      }
    }

    if (exception instanceof Response) return exception;
    return error(exception.message || "スポット作成に失敗しました。", 400);
  }
}
