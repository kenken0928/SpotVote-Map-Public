// file: public/js/map.js

window.SpotVoteMap = (() => {
  const DEFAULT_CENTER = [35.681236, 139.767125];
  const DEFAULT_ZOOM = 13;

  function hasLeaflet() {
    return typeof window.L !== "undefined";
  }

  function createFallbackMap(elementId, options = {}) {
    const element = document.getElementById(elementId);

    if (element) {
      element.innerHTML = `
        <div style="
          height:100%;
          min-height:260px;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:24px;
          text-align:center;
          color:#475569;
          background:#eef3f8;
          border-radius:16px;
        ">
          <div>
            <strong style="display:block;color:#0f172a;margin-bottom:8px;">
              地図を読み込めませんでした
            </strong>
            <p style="margin:0 0 8px;">
              地図ライブラリの読み込みに失敗しています。
            </p>
            <p style="margin:0;font-size:13px;">
              緯度・経度は下の入力欄へ直接入力できます。
            </p>
          </div>
        </div>
      `;
    }

    return {
      isFallback: true,
      center: options.center || DEFAULT_CENTER,
      zoom: options.zoom || DEFAULT_ZOOM,
      setView(center, zoom) {
        this.center = center;
        this.zoom = zoom || this.zoom;
      },
      getZoom() {
        return this.zoom;
      },
      on() {},
    };
  }

  function createMap(elementId, options = {}) {
    if (!hasLeaflet()) {
      return createFallbackMap(elementId, options);
    }

    const map = L.map(elementId).setView(
      options.center || DEFAULT_CENTER,
      options.zoom || DEFAULT_ZOOM
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    return map;
  }

  function fitToPins(map, pins) {
    if (!map || map.isFallback || !hasLeaflet()) return;

    const validPins = pins.filter((pin) => (
      Number.isFinite(Number(pin.lat)) &&
      Number.isFinite(Number(pin.lng))
    ));

    if (!validPins.length) return;

    const bounds = L.latLngBounds(validPins.map((pin) => [pin.lat, pin.lng]));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
  }

  function popupHTML(pin) {
    const image = pin.image_url
      ? `<img class="popup-thumb" src="${SpotVoteAPI.escapeHTML(pin.image_url)}" alt="">`
      : "";

    return `
      <div class="popup-card">
        ${image}
        <h3>${SpotVoteAPI.escapeHTML(pin.title)}</h3>
        <p>${SpotVoteAPI.escapeHTML(pin.description || "")}</p>
        <a class="btn small primary" href="/pin.html?id=${encodeURIComponent(pin.id)}">詳細</a>
      </div>
    `;
  }

  function addPinMarkers(map, pins, options = {}) {
    if (!map || map.isFallback || !hasLeaflet()) return [];

    const markers = [];

    pins.forEach((pin) => {
      if (!Number.isFinite(Number(pin.lat)) || !Number.isFinite(Number(pin.lng))) return;

      const marker = L.marker([pin.lat, pin.lng]).addTo(map);
      marker.bindPopup(options.popupHTML ? options.popupHTML(pin) : popupHTML(pin));

      marker.on("click", () => {
        if (typeof options.onClick === "function") options.onClick(pin, marker);
      });

      markers.push(marker);
    });

    return markers;
  }

  function createEditableMarker(map, initialLat, initialLng, onMove) {
    if (!map || map.isFallback || !hasLeaflet()) {
      return {
        set() {},
      };
    }

    let marker = null;

    function set(lat, lng) {
      if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return;

      if (!marker) {
        marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        marker.on("dragend", () => {
          const position = marker.getLatLng();
          onMove(position.lat, position.lng);
        });
      } else {
        marker.setLatLng([lat, lng]);
      }

      map.setView([lat, lng], Math.max(map.getZoom(), 15));
    }

    if (initialLat && initialLng) set(initialLat, initialLng);

    map.on("click", (event) => {
      set(event.latlng.lat, event.latlng.lng);
      onMove(event.latlng.lat, event.latlng.lng);
    });

    return { set };
  }

  return {
    createMap,
    fitToPins,
    addPinMarkers,
    createEditableMarker,
  };
})();
