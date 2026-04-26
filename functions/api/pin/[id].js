// file: functions/api/pin/[id].js

import { json, error, requireEnv, getPinById } from "../_utils.js";

export async function onRequestGet({ env, params }) {
  try {
    requireEnv(env);

    const id = Number(params.id);
    if (!Number.isInteger(id)) return error("スポットIDが不正です。", 400);

    const pin = await getPinById(env, id, true);
    if (!pin) return error("スポットが見つかりません。", 404);

    return json({ pin });
  } catch (exception) {
    return error(exception.message || "スポット詳細の取得に失敗しました。", 500);
  }
}
