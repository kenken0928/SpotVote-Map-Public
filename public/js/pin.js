// file: public/js/pin.js

(async () => {
  const id = SpotVoteAPI.getQueryParam("id");
  const feedback = document.getElementById("feedback");

  if (!id) {
    SpotVoteAPI.setFeedback(feedback, "error", "スポットIDが指定されていません。");
    return;
  }

  try {
    const data = await SpotVoteAPI.request(`/api/pin/${encodeURIComponent(id)}`);
    const pin = data.pin;

    document.title = `${pin.title}｜みんなで選べるスポットマップ`;

    document.getElementById("pinTitle").textContent = pin.title;
    document.getElementById("pinCategory").textContent = pin.category_name || "Spot";

    const description = document.getElementById("pinDescription");
    const addressRow = document.getElementById("addressRow");
    const memoRow = document.getElementById("memoRow");
    const urlRow = document.getElementById("urlRow");
    const image = document.getElementById("pinImage");

    description.textContent = pin.show_description ? pin.description || "" : "";

    document.getElementById("pinAddress").textContent = pin.show_address ? pin.address || "" : "";
    document.getElementById("pinMemo").textContent = pin.show_memo ? pin.memo || "" : "";

    addressRow.style.display = pin.show_address && pin.address ? "" : "none";
    memoRow.style.display = pin.show_memo && pin.memo ? "" : "none";
    urlRow.style.display = pin.show_url && pin.url ? "" : "none";

    if (pin.show_url && pin.url) {
      const url = document.getElementById("pinUrl");
      url.href = pin.url;
      url.textContent = pin.url;
    }

    if (pin.show_image && pin.image_url) {
      image.src = pin.image_url;
      image.alt = pin.title;
    } else {
      image.style.display = "none";
    }

    const map = SpotVoteMap.createMap("detailMap", {
      center: [pin.lat, pin.lng],
      zoom: 16,
    });

    SpotVoteMap.addPinMarkers(map, [pin]);

    setTimeout(() => {
      map.invalidateSize();
      map.setView([pin.lat, pin.lng], 16);
    }, 100);
  } catch (error) {
    SpotVoteAPI.setFeedback(feedback, "error", error.message);
  }
})();
