// file: public/js/admin.js

(async () => {
  const $ = (id) => document.getElementById(id);

  const feedback = $("feedback");
  const pinForm = $("pinForm");
  const eventForm = $("eventForm");
  const adminPinList = $("adminPinList");
  const eventPinChecks = $("eventPinChecks");
  const eventList = $("eventList");
  const createdVoteUrlOutput = $("createdVoteUrlOutput");

  let map = null;
  let editableMarker = null;
  let pins = [];
  let categories = [];

  const fields = {
    pinId: $("pinId"),
    title: $("title"),
    description: $("description"),
    lat: $("lat"),
    lng: $("lng"),
    categoryId: $("categoryId"),
    address: $("address"),
    memo: $("memo"),
    url: $("url"),
    isPublic: $("isPublic"),
    imageFile: $("imageFile"),
    imagePreviewWrap: $("imagePreviewWrap"),
    imagePreview: $("imagePreview"),
    clearImageButton: $("clearImageButton"),
    showDescription: $("showDescription"),
    showAddress: $("showAddress"),
    showMemo: $("showMemo"),
    showUrl: $("showUrl"),
    showImage: $("showImage"),
  };

  function showFeedback(type, message) {
    if (window.SpotVoteAPI && typeof SpotVoteAPI.setFeedback === "function") {
      SpotVoteAPI.setFeedback(feedback, type, message);
      return;
    }

    if (!feedback) return;
    feedback.className = `form-feedback ${type || "info"}`;
    feedback.textContent = message || "";
  }

  function escapeHTML(value) {
    if (window.SpotVoteAPI && typeof SpotVoteAPI.escapeHTML === "function") {
      return SpotVoteAPI.escapeHTML(value);
    }

    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDateTime(value) {
    if (window.SpotVoteAPI && typeof SpotVoteAPI.formatDateTime === "function") {
      return SpotVoteAPI.formatDateTime(value);
    }

    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("ja-JP");
  }

  async function request(path, options = {}) {
    if (!window.SpotVoteAPI || typeof SpotVoteAPI.request !== "function") {
      throw new Error("API処理ファイルを読み込めませんでした。/js/api.js を確認してください。");
    }

    return SpotVoteAPI.request(path, options);
  }

  function setLatLng(lat, lng) {
    if (fields.lat) fields.lat.value = Number(lat).toFixed(6);
    if (fields.lng) fields.lng.value = Number(lng).toFixed(6);
  }

  function setImagePreview(src) {
    if (!fields.imagePreviewWrap || !fields.imagePreview) return;

    if (!src) {
      fields.imagePreview.removeAttribute("src");
      fields.imagePreviewWrap.hidden = true;
      return;
    }

    fields.imagePreview.src = src;
    fields.imagePreviewWrap.hidden = false;
  }

  function clearSelectedImage() {
    if (fields.imageFile) fields.imageFile.value = "";
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
    if (!fields.imageFile) return null;

    const file = fields.imageFile.files[0];

    if (!file) return null;

    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      throw new Error("画像は JPEG / PNG / WebP のみ対応しています。");
    }

    if (!window.SpotVoteAPI || typeof SpotVoteAPI.compressImage !== "function") {
      throw new Error("画像圧縮処理を読み込めませんでした。/js/api.js を確認してください。");
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

  function renderCategoryOptions() {
    if (!fields.categoryId) return;

    fields.categoryId.innerHTML = categories.length
      ? categories.map((category) => (
          `<option value="${category.id}">${escapeHTML(category.name)}</option>`
        )).join("")
      : '<option value="">カテゴリなし</option>';
  }

  function renderPins() {
    if (!adminPinList) return;

    adminPinList.innerHTML = pins.length
      ? pins.map((pin) => `
        <article class="spot-card" data-pin-id="${pin.id}">
          <span class="pill ${pin.is_public ? "pill-open" : "pill-close"}">${pin.is_public ? "公開" : "非公開"}</span>
          <h3>${escapeHTML(pin.title)}</h3>
          <p>${escapeHTML(pin.address || pin.description || "")}</p>
          <div class="form-actions" style="margin-top:12px;">
            <button class="btn small ghost" type="button" data-action="edit">編集</button>
            <button class="btn small danger" type="button" data-action="delete">削除</button>
          </div>
        </article>
      `).join("")
      : '<div class="notice">スポットがありません。</div>';

    adminPinList.querySelectorAll(".spot-card").forEach((card) => {
      card.addEventListener("click", async (event) => {
        const pinId = card.dataset.pinId;
        const action = event.target.dataset.action;

        if (action === "delete") {
          if (!confirm("このスポットを削除しますか？画像と表示設定も削除されます。")) return;
          await deletePin(pinId);
          return;
        }

        if (action === "edit") {
          const pin = pins.find((item) => String(item.id) === String(pinId));
          if (pin) fillPinForm(pin);
        }
      });
    });

    if (!eventPinChecks) return;

    eventPinChecks.innerHTML = pins
      .map((pin) => `
        <label class="soft-card">
          <input type="checkbox" name="eventPin" value="${pin.id}" style="width:auto;">
          <strong>${escapeHTML(pin.title)}</strong>
          <span class="pill ${pin.is_public ? "pill-open" : "pill-close"}" style="margin-left:8px;">
            ${pin.is_public ? "公開" : "非公開"}
          </span>
          <p class="muted">${escapeHTML(pin.address || pin.description || "")}</p>
        </label>
      `).join("");
  }

  function fillPinForm(pin) {
    if (fields.pinId) fields.pinId.value = pin.id;
    if (fields.title) fields.title.value = pin.title || "";
    if (fields.description) fields.description.value = pin.description || "";
    if (fields.lat) fields.lat.value = pin.lat || "";
    if (fields.lng) fields.lng.value = pin.lng || "";
    if (fields.categoryId) fields.categoryId.value = pin.category_id || "";
    if (fields.address) fields.address.value = pin.address || "";
    if (fields.memo) fields.memo.value = pin.memo || "";
    if (fields.url) fields.url.value = pin.url || "";
    if (fields.isPublic) fields.isPublic.value = String(pin.is_public ? 1 : 0);
    if (fields.showDescription) fields.showDescription.checked = Boolean(pin.show_description);
    if (fields.showAddress) fields.showAddress.checked = Boolean(pin.show_address);
    if (fields.showMemo) fields.showMemo.checked = Boolean(pin.show_memo);
    if (fields.showUrl) fields.showUrl.checked = Boolean(pin.show_url);
    if (fields.showImage) fields.showImage.checked = Boolean(pin.show_image);
    if (fields.imageFile) fields.imageFile.value = "";

    setImagePreview(pin.image_url || "");

    if (editableMarker && typeof editableMarker.set === "function") {
      editableMarker.set(pin.lat, pin.lng);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetPinForm() {
    if (pinForm) pinForm.reset();

    if (fields.pinId) fields.pinId.value = "";
    if (fields.isPublic) fields.isPublic.value = "1";
    if (fields.showDescription) fields.showDescription.checked = true;
    if (fields.showAddress) fields.showAddress.checked = true;
    if (fields.showMemo) fields.showMemo.checked = true;
    if (fields.showUrl) fields.showUrl.checked = true;
    if (fields.showImage) fields.showImage.checked = true;

    setImagePreview("");
  }

  async function pinPayload() {
    const payload = {
      title: fields.title ? fields.title.value.trim() : "",
      description: fields.description ? fields.description.value.trim() : "",
      lat: fields.lat ? Number(fields.lat.value) : NaN,
      lng: fields.lng ? Number(fields.lng.value) : NaN,
      category_id: fields.categoryId ? fields.categoryId.value || "" : "",
      address: fields.address ? fields.address.value.trim() : "",
      memo: fields.memo ? fields.memo.value.trim() : "",
      url: fields.url ? fields.url.value.trim() : "",
      is_public: fields.isPublic ? Number(fields.isPublic.value) : 1,
      show_description: fields.showDescription && fields.showDescription.checked ? "1" : "0",
      show_address: fields.showAddress && fields.showAddress.checked ? "1" : "0",
      show_memo: fields.showMemo && fields.showMemo.checked ? "1" : "0",
      show_url: fields.showUrl && fields.showUrl.checked ? "1" : "0",
      show_image: fields.showImage && fields.showImage.checked ? "1" : "0",
    };

    if (!payload.title) {
      throw new Error("タイトルを入力してください。");
    }

    if (!Number.isFinite(payload.lat) || !Number.isFinite(payload.lng)) {
      throw new Error("緯度・経度を入力してください。");
    }

    const image = await selectedImagePayload();

    if (image) {
      payload.image = image;
    }

    return payload;
  }

  async function savePin(event) {
    event.preventDefault();

    try {
      showFeedback("info", "保存しています。画像がある場合はR2へ保存します。");

      const id = fields.pinId ? fields.pinId.value : "";
      const path = id ? `/api/admin/pins/${encodeURIComponent(id)}` : "/api/admin/pins";
      const method = id ? "PUT" : "POST";
      const body = await pinPayload();

      await request(path, { method, body });

      showFeedback("success", "スポットを保存しました。");
      resetPinForm();
      await loadAdminData();
    } catch (error) {
      console.error(error);
      showFeedback("error", error.message);
    }
  }

  async function deletePin(id) {
    try {
      await request(`/api/admin/pins/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      showFeedback("success", "スポットを削除しました。");
      await loadAdminData();
    } catch (error) {
      console.error(error);
      showFeedback("error", error.message);
    }
  }

  async function createVoteEvent(event) {
    event.preventDefault();

    try {
      const titleInput = $("eventTitleInput");
      const descriptionInput = $("eventDescriptionInput");
      const expiresInput = $("eventExpiresInput");

      const pinIds = [...document.querySelectorAll('input[name="eventPin"]:checked')]
        .map((input) => Number(input.value));

      if (pinIds.length < 2) {
        throw new Error("投票イベントには候補スポットを2件以上選択してください。");
      }

      if (!titleInput || !titleInput.value.trim()) {
        throw new Error("イベント名を入力してください。");
      }

      if (!expiresInput || !expiresInput.value) {
        throw new Error("期限を入力してください。");
      }

      const payload = {
        title: titleInput.value.trim(),
        description: descriptionInput ? descriptionInput.value.trim() : "",
        expires_at: new Date(expiresInput.value).toISOString(),
        pin_ids: pinIds,
      };

      const result = await request("/api/admin/vote-events", {
        method: "POST",
        body: payload,
      });

      const url = `${location.origin}/vote.html?slug=${encodeURIComponent(result.event.slug)}`;

      try {
        await navigator.clipboard?.writeText(url);
      } catch (clipboardError) {
        console.warn("クリップボードへのコピーに失敗しました。", clipboardError);
      }

      showFeedback("success", "投票URLを作成しました。");

      if (createdVoteUrlOutput) {
        createdVoteUrlOutput.hidden = false;
        createdVoteUrlOutput.innerHTML = `
          <p class="created-vote-url-label">作成した投票URL</p>
          <a href="${escapeHTML(url)}" target="_blank" rel="noopener">${escapeHTML(url)}</a>
          <p class="field-hint">このURLを投票者に共有してください。</p>
        `;
      }

      if (eventForm) eventForm.reset();

      await loadEvents();
    } catch (error) {
      console.error(error);
      showFeedback("error", error.message);
    }
  }

  function renderEvents(events) {
    if (!eventList) return;

    eventList.innerHTML = events.length
      ? events.map((event) => {
          const url = `/vote.html?slug=${encodeURIComponent(event.slug)}`;

          return `
            <article class="soft-card">
              <strong>${escapeHTML(event.title)}</strong>
              <p class="muted">期限：${escapeHTML(formatDateTime(event.expires_at))}</p>
              <div class="form-actions" style="margin-top:10px;">
                <a class="btn small primary" href="${url}" target="_blank" rel="noopener">開く</a>
                <button class="btn small danger" data-event-id="${event.id}" type="button">削除</button>
              </div>
            </article>
          `;
        }).join("")
      : '<div class="notice">投票イベントはありません。</div>';

    eventList.querySelectorAll("button[data-event-id]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("この投票イベントを削除しますか？スポット本体は削除されません。")) return;

        try {
          await request(`/api/admin/vote-events/${encodeURIComponent(button.dataset.eventId)}`, {
            method: "DELETE",
          });

          showFeedback("success", "投票イベントを削除しました。");
          await loadEvents();
        } catch (error) {
          console.error(error);
          showFeedback("error", error.message);
        }
      });
    });
  }

  async function loadEvents() {
    const data = await request("/api/admin/vote-events");
    renderEvents(data.events || []);
  }

  async function loadAdminData() {
    const data = await request("/api/admin/pins");

    pins = data.pins || [];
    categories = data.categories || [];

    renderCategoryOptions();
    renderPins();
  }

  function initMap() {
    if (!window.SpotVoteMap) {
      throw new Error("地図処理ファイルを読み込めませんでした。/js/map.js を確認してください。");
    }

    map = SpotVoteMap.createMap("adminMap");
    editableMarker = SpotVoteMap.createEditableMarker(map, null, null, setLatLng);
  }

  function bindEvents() {
    if (pinForm) {
      pinForm.addEventListener("submit", savePin);
    }

    if (eventForm) {
      eventForm.addEventListener("submit", createVoteEvent);
    }

    const resetPinFormButton = $("resetPinForm");

    if (resetPinFormButton) {
      resetPinFormButton.addEventListener("click", resetPinForm);
    }

    if (fields.imageFile) {
      fields.imageFile.addEventListener("change", () => {
        const file = fields.imageFile.files[0];

        if (!file) {
          setImagePreview("");
          return;
        }

        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
          clearSelectedImage();
          showFeedback("error", "画像は JPEG / PNG / WebP のみ対応しています。");
          return;
        }

        setImagePreview(URL.createObjectURL(file));
      });
    }

    if (fields.clearImageButton) {
      fields.clearImageButton.addEventListener("click", clearSelectedImage);
    }

    const createTempCodeButton = $("createTempCodeButton");

    if (createTempCodeButton) {
      createTempCodeButton.addEventListener("click", async () => {
        try {
          const result = await request("/api/admin/temp-code", {
            method: "POST",
            body: {},
          });

          const tempCodeOutput = $("tempCodeOutput");

          if (tempCodeOutput) {
            tempCodeOutput.textContent = result.code;
          }

          showFeedback("success", "一時投稿コードを発行しました。");
        } catch (error) {
          console.error(error);
          showFeedback("error", error.message);
        }
      });
    }

    const cleanupButton = $("cleanupButton");

    if (cleanupButton) {
      cleanupButton.addEventListener("click", async () => {
        try {
          const result = await request("/api/admin/cleanup-expired-events", {
            method: "POST",
            body: {},
          });

          showFeedback("success", `${result.deleted}件の期限切れイベントを削除しました。`);
          await loadEvents();
        } catch (error) {
          console.error(error);
          showFeedback("error", error.message);
        }
      });
    }
  }

  bindEvents();

  try {
    initMap();
  } catch (error) {
    console.error(error);
    showFeedback("error", error.message);
  }

  try {
    await loadAdminData();
  } catch (error) {
    console.error(error);
    showFeedback("error", `スポット一覧の読み込みに失敗しました。${error.message}`);
  }

  try {
    await loadEvents();
  } catch (error) {
    console.error(error);
    showFeedback("error", `投票イベント一覧の読み込みに失敗しました。${error.message}`);
  }
})();
