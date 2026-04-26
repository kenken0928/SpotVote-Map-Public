// file: functions/api/pins.js

import {
  json,
  error,
  requireEnv,
  listCategories,
  getPinRows
} from "./_utils.js";

export async function onRequest(context) {
  const { request, env } = context;

  requireEnv(env);

  if (request.method === "GET") {
    try {
      const pins = await getPinRows(env, true);
      const categories = await listCategories(env);

      return json({
        pins,
        categories
      });
    } catch (e) {
      return error(e.message || "スポット取得に失敗しました。", 500);
    }
  }

  return error("Method not allowed", 405);
}
