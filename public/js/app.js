// file: public/js/app.js

(async () => {
  const map = SpotVoteMap.createMap("map");
  map.setView([35.681236, 139.767125], 10);

  const spotList = document.getElementById("spotList");
  const keywordInput = document.getElementById("keywordInput");
  const categorySelect = document.getElementById("categorySelect");

  let allPins = [];
  let markers = [];

  function renderCategories(categories) {
    categorySelect.innerHTML = '<option value="">すべてのカテゴリ</option>';
    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      categorySelect.appendChild(option);
    });
  }

  function clearMarkers() {
    markers.forEach((marker) => marker.remove());
    markers = [];
  }

  function filteredPins() {
    const keyword = keywordInput.value.trim().toLowerCase();
    const categoryId = categorySelect.value;

    return allPins.filter((pin) => {
      const matchKeyword =
        !keyword ||
        [pin.title, pin.description, pin.address, pin.memo, pin.category_name]
          .join(" ")
          .toLowerCase()
          .includes(keyword);

      const matchCategory = !categoryId || String(pin.category_id) === String(categoryId);

      return matchKeyword && matchCategory;
    });
  }

  function renderPins() {
    const pins = filteredPins();

    clearMarkers();
    markers = SpotVoteMap.addPinMarkers(map, pins, {
      onClick: (pin) => highlightCard(pin.id),
    });

    spotList.innerHTML = pins.length
      ? pins.map((pin) => {
          const image = pin.image_url
            ? `<img class="spot-thumb" src="${SpotVoteAPI.escapeHTML(pin.image_url)}" alt="">`
            : "";

          return `
            <article class="spot-card" data-pin-id="${pin.id}">
              ${image}
              <span class="pill pill-open">${SpotVoteAPI.escapeHTML(pin.category_name || "未分類")}</span>
              <h3>${SpotVoteAPI.escapeHTML(pin.title)}</h3>
              <p>${SpotVoteAPI.escapeHTML(pin.description || "")}</p>
              <div class="form-actions" style="margin-top:12px;">
                <a class="btn small primary" href="/pin.html?id=${encodeURIComponent(pin.id)}">詳細</a>
              </div>
            </article>
          `;
        }).join("")
      : '<div class="notice">条件に合うスポットがありません。</div>';

    spotList.querySelectorAll(".spot-card").forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target.closest("a")) return;
        const pin = pins.find((item) => String(item.id) === String(card.dataset.pinId));
        if (!pin) return;
        map.setView([pin.lat, pin.lng], 16);
      });
    });
  }

  function highlightCard(pinId) {
    spotList.querySelectorAll(".spot-card").forEach((card) => {
      card.classList.toggle("is-selected", String(card.dataset.pinId) === String(pinId));
    });
  }

  try {
    const data = await SpotVoteAPI.request("/api/pins");
    allPins = data.pins || [];

    renderCategories(data.categories || []);
    renderPins();

    keywordInput.addEventListener("input", renderPins);
    categorySelect.addEventListener("change", renderPins);
  } catch (error) {
    spotList.innerHTML = `<div class="notice">${SpotVoteAPI.escapeHTML(error.message)}</div>`;
  }
})();
