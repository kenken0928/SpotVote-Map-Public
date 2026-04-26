// file: public/js/api.js

window.SpotVoteAPI = (() => {
  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});

    if (options.body && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(path, {
      ...options,
      headers,
      body:
        options.body && !(options.body instanceof FormData)
          ? JSON.stringify(options.body)
          : options.body,
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message =
        typeof payload === "object" && payload && payload.error
          ? payload.error
          : "通信に失敗しました。";
      throw new Error(message);
    }

    return payload;
  }

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  function setFeedback(element, type, message) {
    if (!element) return;
    element.className = `form-feedback ${type || "info"}`;
    element.textContent = message || "";
  }

  function clearFeedback(element) {
    if (!element) return;
    element.className = "form-feedback";
    element.textContent = "";
  }

  function imageUrl(image) {
    if (!image) return "";
    if (image.public_url) return image.public_url;
    if (image.r2_key) return `/api/upload-url?key=${encodeURIComponent(image.r2_key)}`;
    return "";
  }

  async function compressImage(file, maxWidth = 1200, quality = 0.78) {
    if (!file) return null;

    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      throw new Error("画像は JPEG / PNG / WebP のみ対応しています。HEICは拡張対応予定です。");
    }

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / bitmap.width);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });

    if (!blob) {
      throw new Error("画像の圧縮に失敗しました。");
    }

    return new File(
      [blob],
      file.name.replace(/\.[^.]+$/, "") + ".jpg",
      { type: "image/jpeg" }
    );
  }

  return {
    request,
    getQueryParam,
    escapeHTML,
    formatDateTime,
    setFeedback,
    clearFeedback,
    imageUrl,
    compressImage,
  };
})();
