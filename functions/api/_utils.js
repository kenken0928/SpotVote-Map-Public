// file: functions/api/_utils.js

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

export function error(message, status = 400) {
  return json({ error: message }, status);
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function requireEnv(env) {
  if (!env.DB) {
    throw new Error("D1 binding DB が設定されていません。");
  }
}

export function requireMediaBucket(env) {
  if (!env.MEDIA_BUCKET) {
    throw new Error("R2 binding MEDIA_BUCKET が設定されていません。");
  }
}

export function assertAdmin(request) {
  const email = request.headers.get("Cf-Access-Authenticated-User-Email");

  if (!email) {
    throw new Response(
      JSON.stringify({ error: "管理者認証が必要です。" }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      }
    );
  }

  return email;
}

export function randomSlug(length = 24) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((byte) => chars[byte % chars.length]).join("");
}

export async function sha256Hex(value) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function truthyFlag(value) {
  return value === true || value === 1 || value === "1" ? 1 : 0;
}

export function normalizePinPayload(body) {
  const title = String(body.title || "").trim();
  const lat = Number(body.lat);
  const lng = Number(body.lng);

  if (!title) {
    throw new Error("タイトルは必須です。");
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("緯度・経度が不正です。");
  }

  return {
    title,
    description: String(body.description || "").trim(),
    lat,
    lng,
    category_id: body.category_id ? Number(body.category_id) : null,
    address: String(body.address || "").trim(),
    memo: String(body.memo || "").trim(),
    url: String(body.url || "").trim(),
    is_public: body.is_public === 0 || body.is_public === "0" ? 0 : 1,
    display: {
      show_description: truthyFlag(body.show_description ?? body.display?.show_description ?? 1),
      show_address: truthyFlag(body.show_address ?? body.display?.show_address ?? 1),
      show_memo: truthyFlag(body.show_memo ?? body.display?.show_memo ?? 1),
      show_url: truthyFlag(body.show_url ?? body.display?.show_url ?? 1),
      show_image: truthyFlag(body.show_image ?? body.display?.show_image ?? 1),
    },
  };
}

function imagePayloadToFile(image) {
  if (!image || !image.data_url) return null;

  const dataUrl = String(image.data_url);
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);

  if (!match) {
    throw new Error("画像データ形式が不正です。");
  }

  const mimeType = match[1];
  const base64 = match[2];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return {
    type: mimeType,
    size: bytes.byteLength,
    async arrayBuffer() {
      return bytes.buffer;
    },
  };
}

export async function readPinRequest(request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");

    return {
      payload: normalizePinPayload({
        title: formData.get("title"),
        description: formData.get("description"),
        lat: formData.get("lat"),
        lng: formData.get("lng"),
        category_id: formData.get("category_id"),
        address: formData.get("address"),
        memo: formData.get("memo"),
        url: formData.get("url"),
        is_public: formData.get("is_public"),
        show_description: formData.get("show_description"),
        show_address: formData.get("show_address"),
        show_memo: formData.get("show_memo"),
        show_url: formData.get("show_url"),
        show_image: formData.get("show_image"),
      }),
      file:
        file &&
        typeof file.arrayBuffer === "function" &&
        Number(file.size) > 0
          ? file
          : null,
    };
  }

  const body = await readJson(request);

  return {
    payload: normalizePinPayload(body),
    file: imagePayloadToFile(body.image),
  };
}

export async function listCategories(env) {
  const result = await env.DB.prepare(`
    SELECT id, name, sort_order
    FROM categories
    ORDER BY sort_order ASC, id ASC
  `).all();

  return result.results || [];
}

export async function getPinRows(env, onlyPublic = true) {
  const where = onlyPublic ? "WHERE p.is_public = 1" : "";

  const result = await env.DB.prepare(`
    SELECT
      p.id,
      p.title,
      p.description,
      p.lat,
      p.lng,
      p.category_id,
      c.name AS category_name,
      p.address,
      p.memo,
      p.url,
      p.is_public,
      p.created_by_temp_code,
      p.created_at,
      p.updated_at,
      COALESCE(s.show_description, 1) AS show_description,
      COALESCE(s.show_address, 1) AS show_address,
      COALESCE(s.show_memo, 1) AS show_memo,
      COALESCE(s.show_url, 1) AS show_url,
      COALESCE(s.show_image, 1) AS show_image,
      img.public_url AS image_url,
      img.r2_key AS image_key
    FROM pins p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN pin_display_settings s ON s.pin_id = p.id
    LEFT JOIN (
      SELECT i1.*
      FROM images i1
      INNER JOIN (
        SELECT pin_id, MAX(id) AS max_id
        FROM images
        GROUP BY pin_id
      ) latest ON latest.max_id = i1.id
    ) img ON img.pin_id = p.id
    ${where}
    ORDER BY p.created_at DESC, p.id DESC
  `).all();

  return result.results || [];
}

export async function getPinById(env, id, onlyPublic = true) {
  const wherePublic = onlyPublic ? "AND p.is_public = 1" : "";

  const pin = await env.DB.prepare(`
    SELECT
      p.id,
      p.title,
      p.description,
      p.lat,
      p.lng,
      p.category_id,
      c.name AS category_name,
      p.address,
      p.memo,
      p.url,
      p.is_public,
      p.created_by_temp_code,
      p.created_at,
      p.updated_at,
      COALESCE(s.show_description, 1) AS show_description,
      COALESCE(s.show_address, 1) AS show_address,
      COALESCE(s.show_memo, 1) AS show_memo,
      COALESCE(s.show_url, 1) AS show_url,
      COALESCE(s.show_image, 1) AS show_image,
      img.public_url AS image_url,
      img.r2_key AS image_key
    FROM pins p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN pin_display_settings s ON s.pin_id = p.id
    LEFT JOIN (
      SELECT i1.*
      FROM images i1
      INNER JOIN (
        SELECT pin_id, MAX(id) AS max_id
        FROM images
        GROUP BY pin_id
      ) latest ON latest.max_id = i1.id
    ) img ON img.pin_id = p.id
    WHERE p.id = ? ${wherePublic}
  `).bind(id).first();

  return pin || null;
}

export async function createPin(env, pin, createdByTempCode = 0) {
  const result = await env.DB.prepare(`
    INSERT INTO pins (
      title,
      description,
      lat,
      lng,
      category_id,
      address,
      memo,
      url,
      is_public,
      created_by_temp_code,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    pin.title,
    pin.description,
    pin.lat,
    pin.lng,
    pin.category_id,
    pin.address,
    pin.memo,
    pin.url,
    pin.is_public,
    createdByTempCode
  ).run();

  const id = result.meta.last_row_id;

  await env.DB.prepare(`
    INSERT INTO pin_display_settings (
      pin_id,
      show_description,
      show_address,
      show_memo,
      show_url,
      show_image
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    pin.display.show_description,
    pin.display.show_address,
    pin.display.show_memo,
    pin.display.show_url,
    pin.display.show_image
  ).run();

  return await getPinById(env, id, false);
}

export async function updatePin(env, id, pin) {
  await env.DB.prepare(`
    UPDATE pins
    SET
      title = ?,
      description = ?,
      lat = ?,
      lng = ?,
      category_id = ?,
      address = ?,
      memo = ?,
      url = ?,
      is_public = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    pin.title,
    pin.description,
    pin.lat,
    pin.lng,
    pin.category_id,
    pin.address,
    pin.memo,
    pin.url,
    pin.is_public,
    id
  ).run();

  await env.DB.prepare(`
    INSERT INTO pin_display_settings (
      pin_id,
      show_description,
      show_address,
      show_memo,
      show_url,
      show_image
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(pin_id) DO UPDATE SET
      show_description = excluded.show_description,
      show_address = excluded.show_address,
      show_memo = excluded.show_memo,
      show_url = excluded.show_url,
      show_image = excluded.show_image
  `).bind(
    id,
    pin.display.show_description,
    pin.display.show_address,
    pin.display.show_memo,
    pin.display.show_url,
    pin.display.show_image
  ).run();

  return await getPinById(env, id, false);
}

export async function deletePinWithImages(env, pinId) {
  const id = Number(pinId);

  if (!Number.isInteger(id)) {
    throw new Error("スポットIDが不正です。");
  }

  const images = await env.DB.prepare(`
    SELECT r2_key
    FROM images
    WHERE pin_id = ?
  `).bind(id).all();

  if (env.MEDIA_BUCKET) {
    await Promise.all(
      (images.results || [])
        .filter((image) => image.r2_key)
        .map((image) => env.MEDIA_BUCKET.delete(image.r2_key).catch(() => null))
    );
  }

  await env.DB.prepare("DELETE FROM images WHERE pin_id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM pin_display_settings WHERE pin_id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM pins WHERE id = ?").bind(id).run();
}

export async function savePinImage(env, pinId, file) {
  requireMediaBucket(env);

  const id = Number(pinId);

  if (!Number.isInteger(id)) {
    throw new Error("スポットIDが不正です。");
  }

  if (!file || typeof file.arrayBuffer !== "function") {
    throw new Error("画像ファイルがありません。");
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("画像形式は JPEG / PNG / WebP のみ対応しています。");
  }

  if (Number(file.size) <= 0) {
    throw new Error("画像ファイルが空です。");
  }

  if (Number(file.size) > MAX_IMAGE_BYTES) {
    throw new Error("画像サイズは2MB以下にしてください。");
  }

  const exists = await env.DB.prepare(`
    SELECT id
    FROM pins
    WHERE id = ?
  `).bind(id).first();

  if (!exists) {
    throw new Error("スポットが見つかりません。");
  }

  const extension =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";

  const key = `pins/${id}/${crypto.randomUUID()}.${extension}`;
  const arrayBuffer = await file.arrayBuffer();

  await env.MEDIA_BUCKET.put(key, arrayBuffer, {
    httpMetadata: {
      contentType: file.type,
    },
  });

  const publicUrl = `/api/upload-url?key=${encodeURIComponent(key)}`;

  await env.DB.prepare(`
    INSERT INTO images (
      pin_id,
      r2_key,
      public_url,
      mime_type,
      size_bytes
    ) VALUES (?, ?, ?, ?, ?)
  `).bind(
    id,
    key,
    publicUrl,
    file.type,
    Number(file.size)
  ).run();

  return {
    key,
    public_url: publicUrl,
  };
}
