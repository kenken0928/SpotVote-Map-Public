// file: public/js/post.js

(async () => {
  const feedback = document.getElementById("feedback");
  const form = document.getElementById("postForm");

  const fields = {
    code: document.getElementById("code"),
    title: document.getElementById("title"),
    description: document.getElementById("description"),
    lat: document.getElementById("lat"),
    lng: document.getElementById("lng"),
    categoryId: document.getElementById("categoryId"),
    address: document.getElementById("address"),
    url: document.getElementById("url"),
    imageFile: document.getElementById("imageFile"),
    imagePreviewWrap: document.getElementById("imagePreviewWrap"),
    imagePreview: document.getElementById("imagePreview"),
    clearImageButton: document.getElementById("clearImageButton"),
  };

  let map;
  let editableMarker;

  function setLatLng(lat, lng) {
    fields.lat.value = Number(lat).toFixed(6);
    fields.lng.value = Number(lng).toFixed(6);
  }

  function setImagePreview(src) {
    if (!src) {
      fields.imagePreviewWrap.hidden = true;
      fields.imagePreview.removeAttribute("src");
      return;
    }

    fields.imagePreview.src = src;
    fields.imagePreviewWrap.hidden = false;
  }

  function clearImage() {
    fields.imageFile.value = "";
    setImagePreview("");
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));

      reader.readAsDataURL(file);
    });
  }

  async function selectedImagePayload() {
    const file = fields.imageFile.files[0];

    if (!file) return null;

    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      throw new Error("画像は JPEG / PNG / WebP のみ対応しています。");
    }

    const compressed = await SpotVoteAPI.compressImage(file);

    if (compressed.size > 2 * 1024 * 1024) {
      throw new Error("画像サイズは2MB以下にしてください。");
    }

    return {
      data_url: await fileToDataUrl(compressed),
      mime_type: compressed.type,
      size_bytes: compressed.size,
      name: compressed.name,
    };
  }

  async function buildPayload() {
    const payload = {
      code: fields.code.value.trim(),
      title: fields.title.value.trim(),
      description: fields.description.value.trim(),
      lat: Number(fields.lat.value),
      lng: Number(fields.lng.value),
      category_id: fields.categoryId.value || "",
      address: fields.address.value.trim(),
      url: fields.url.value.trim(),
    };

    const image = await selectedImagePayload();

    if (image) {
      payload.image = image;
    }

    return payload;
  }

  async function submitPost(e) {
    e.preventDefault();

    try {
      SpotVoteAPI.setFeedback(feedback, "info", "投稿中...");

      const body = await buildPayload();

      await SpotVoteAPI.request("/api/temp-post", {
        method: "POST",
        body,
      });

      SpotVoteAPI.setFeedback(feedback, "success", "投稿が完了しました");
      form.reset();
      clearImage();
    } catch (err) {
      SpotVoteAPI.setFeedback(feedback, "error", err.message);
    }
  }

  form.addEventListener("submit", submitPost);

  fields.imageFile.addEventListener("change", () => {
    const file = fields.imageFile.files[0];

    if (!file) {
      setImagePreview("");
      return;
    }

    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      clearImage();
      SpotVoteAPI.setFeedback(feedback, "error", "対応していない画像形式です");
      return;
    }

    setImagePreview(URL.createObjectURL(file));
  });

  fields.clearImageButton?.addEventListener("click", clearImage);

  try {
    map = SpotVoteMap.createMap("postMap");
    editableMarker = SpotVoteMap.createEditableMarker(map, null, null, setLatLng);

    const data = await SpotVoteAPI.request("/api/pins");
    const categories = data.categories || [];

    fields.categoryId.innerHTML = categories.map((category) =>
      `<option value="${category.id}">${SpotVoteAPI.escapeHTML(category.name)}</option>`
    ).join("");
  } catch (err) {
    SpotVoteAPI.setFeedback(feedback, "error", err.message);
  }
})();
