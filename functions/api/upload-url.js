// file: functions/api/upload-url.js

import { error, requireMediaBucket } from "./_utils.js";

export async function onRequestGet({ request, env }) {
  try {
    requireMediaBucket(env);

    const url = new URL(request.url);
    const key = url.searchParams.get("key");

    if (!key) return error("画像キーが指定されていません。", 400);

    const object = await env.MEDIA_BUCKET.get(key);
    if (!object) return error("画像が見つかりません。", 404);

    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (exception) {
    return error(exception.message || "画像取得に失敗しました。", 500);
  }
}

export async function onRequestPost() {
  return error("このAPIでは画像アップロードできません。", 405);
}
