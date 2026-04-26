// file: public/js/vote.js

(async () => {
  const slug = SpotVoteAPI.getQueryParam("slug");
  const feedback = document.getElementById("feedback");
  const candidateList = document.getElementById("candidateList");
  const resultList = document.getElementById("resultList");
  const voteForm = document.getElementById("voteForm");
  const randomButton = document.getElementById("randomButton");

  let selectedPinId = null;
  let eventData = null;
  let map = null;

  if (!slug) {
    SpotVoteAPI.setFeedback(feedback, "error", "投票イベントのslugが指定されていません。URLを確認してください。");
    return;
  }

  const votedStorageKey = `spotVoteMap:voted:${slug}`;

  function hasAlreadyVoted() {
    try {
      return localStorage.getItem(votedStorageKey) === "1";
    } catch (error) {
      console.warn("localStorageの読み込みに失敗しました。", error);
      return false;
    }
  }

  function markAsVoted() {
    try {
      localStorage.setItem(votedStorageKey, "1");
    } catch (error) {
      console.warn("localStorageへの保存に失敗しました。", error);
    }
  }

  function isExpiredEvent() {
    return Boolean(eventData && eventData.is_expired);
  }

  function setVoteDisabled(disabled) {
    if (voteForm) {
      voteForm.querySelectorAll("input, textarea, button").forEach((element) => {
        element.disabled = disabled;
      });
    }

    if (randomButton) {
      randomButton.disabled = disabled;
    }

    if (candidateList) {
      candidateList.querySelectorAll('input[type="radio"]').forEach((radio) => {
        radio.disabled = disabled;
      });
    }
  }

  function renderCandidates(pins) {
    candidateList.innerHTML = pins.map((pin) => {
      const image = pin.image_url
        ? `<img class="spot-thumb" src="${SpotVoteAPI.escapeHTML(pin.image_url)}" alt="">`
        : "";

      const detailLink = Number(pin.is_public) === 1
        ? `
          <div class="form-actions" style="margin-top:10px;">
            <a class="btn small ghost" href="/pin.html?id=${encodeURIComponent(pin.id)}" target="_blank" rel="noopener">詳細</a>
          </div>
        `
        : "";

      return `
        <label class="vote-card" data-pin-id="${pin.id}">
          ${image}
          <div class="vote-card-choice">
            <input type="radio" name="pinId" value="${pin.id}">
            <strong>${SpotVoteAPI.escapeHTML(pin.title)}</strong>
          </div>
          <p class="muted">${SpotVoteAPI.escapeHTML(pin.description || "")}</p>
          ${detailLink}
        </label>
      `;
    }).join("");

    candidateList.querySelectorAll(".vote-card").forEach((card) => {
      card.addEventListener("click", () => {
        if (isExpiredEvent()) return;
        if (hasAlreadyVoted()) return;

        selectedPinId = Number(card.dataset.pinId);
        updateSelected();
      });
    });

    if (isExpiredEvent() || hasAlreadyVoted()) {
      setVoteDisabled(true);
    }
  }

  function updateSelected() {
    candidateList.querySelectorAll(".vote-card").forEach((card) => {
      const selected = String(card.dataset.pinId) === String(selectedPinId);
      card.classList.toggle("is-selected", selected);

      const radio = card.querySelector("input");
      if (radio) radio.checked = selected;
    });

    const pin = eventData.pins.find((item) => Number(item.id) === Number(selectedPinId));
    if (pin && map) map.setView([pin.lat, pin.lng], 16);
  }

  function renderExpiredResults(votes) {
    const counts = {};

    votes.forEach((vote) => {
      const pinTitle = vote.pin_title || "不明な投票先";
      counts[pinTitle] = (counts[pinTitle] || 0) + 1;
    });

    const ranking = Object.entries(counts)
      .sort((a, b) => b[1] - a[1]);

    const maxCount = ranking[0][1];
    const winners = ranking.filter(([, count]) => count === maxCount);

    const winnerText = winners.map(([title]) => title).join("、");

    resultList.innerHTML = `
      <div class="soft-card" style="margin-bottom:14px;">
        <p class="section-label">Winner</p>
        <h3 style="margin:0 0 6px;">🏆 最多得票</h3>
        <p style="margin:0;font-size:20px;font-weight:900;">
          ${SpotVoteAPI.escapeHTML(winnerText)}
        </p>
        <p class="muted" style="margin:6px 0 0;">
          ${maxCount}票を獲得しました。
        </p>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>順位</th>
              <th>投票先</th>
              <th>得票数</th>
              <th>グラフ</th>
            </tr>
          </thead>
          <tbody>
            ${ranking.map(([pinTitle, count], index) => {
              const rank = index + 1;
              const percent = Math.round((count / maxCount) * 100);
              const isWinner = count === maxCount;

              return `
                <tr>
                  <td class="cell-title">${isWinner ? "🥇" : rank}</td>
                  <td class="cell-title">${SpotVoteAPI.escapeHTML(pinTitle)}</td>
                  <td>${count}票</td>
                  <td>
                    <div style="width:100%;min-width:120px;background:#f3f4f6;border-radius:999px;overflow:hidden;">
                      <div style="width:${percent}%;height:14px;background:#f97316;border-radius:999px;"></div>
                    </div>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderActiveResults(votes) {
    resultList.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>投票先</th>
              <th>コメント</th>
              <th>日時</th>
            </tr>
          </thead>
          <tbody>
            ${votes.map((vote) => `
              <tr>
                <td class="cell-title">${SpotVoteAPI.escapeHTML(vote.pin_title)}</td>
                <td>${SpotVoteAPI.escapeHTML(vote.voter_comment || "")}</td>
                <td>${SpotVoteAPI.escapeHTML(SpotVoteAPI.formatDateTime(vote.created_at))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderResults(votes) {
    if (!votes.length) {
      resultList.innerHTML = '<div class="notice">まだ投票はありません。</div>';
      return;
    }

    if (isExpiredEvent()) {
      renderExpiredResults(votes);
      return;
    }

    renderActiveResults(votes);
  }

  async function loadEvent() {
    eventData = await SpotVoteAPI.request(`/api/vote/${encodeURIComponent(slug)}`);

    document.title = `${eventData.event.title}｜投票イベント`;
    document.getElementById("eventTitle").textContent = eventData.event.title;
    document.getElementById("eventDescription").textContent = eventData.event.description || "";
    document.getElementById("eventExpires").textContent = SpotVoteAPI.formatDateTime(eventData.event.expires_at);
    document.getElementById("candidateCount").textContent = eventData.pins.length;

    renderCandidates(eventData.pins);
    renderResults(eventData.votes || []);

    if (map && typeof map.remove === "function") {
      map.remove();
      map = null;
    }

    map = SpotVoteMap.createMap("voteMap");
    SpotVoteMap.addPinMarkers(map, eventData.pins);
    SpotVoteMap.fitToPins(map, eventData.pins);

    if (eventData.is_expired) {
      SpotVoteAPI.setFeedback(feedback, "error", "投票イベントは期限切れです。投票結果のみ確認できます。");
      setVoteDisabled(true);
    } else if (hasAlreadyVoted()) {
      SpotVoteAPI.setFeedback(feedback, "success", "このブラウザでは、すでにこの投票イベントに投票済みです。");
      setVoteDisabled(true);
    } else {
      setVoteDisabled(false);
    }
  }

  randomButton.addEventListener("click", () => {
    if (!eventData || !eventData.pins.length || isExpiredEvent() || hasAlreadyVoted()) return;

    const index = Math.floor(Math.random() * eventData.pins.length);
    selectedPinId = eventData.pins[index].id;
    updateSelected();
  });

  voteForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isExpiredEvent()) {
      SpotVoteAPI.setFeedback(feedback, "error", "投票イベントは期限切れです。");
      return;
    }

    if (hasAlreadyVoted()) {
      SpotVoteAPI.setFeedback(feedback, "error", "このブラウザでは、すでにこの投票イベントに投票済みです。");
      setVoteDisabled(true);
      return;
    }

    if (!selectedPinId) {
      SpotVoteAPI.setFeedback(feedback, "error", "投票する候補を選択してください。");
      return;
    }

    try {
      const payload = {
        pin_id: selectedPinId,
        voter_name: document.getElementById("voterName").value.trim(),
        voter_comment: document.getElementById("voterComment").value.trim(),
      };

      await SpotVoteAPI.request(`/api/vote/${encodeURIComponent(slug)}`, {
        method: "POST",
        body: payload,
      });

      markAsVoted();

      SpotVoteAPI.setFeedback(feedback, "success", "投票しました。");
      voteForm.reset();
      selectedPinId = null;
      await loadEvent();
    } catch (error) {
      SpotVoteAPI.setFeedback(feedback, "error", error.message);
    }
  });

  try {
    await loadEvent();
  } catch (error) {
    SpotVoteAPI.setFeedback(feedback, "error", error.message);
    document.querySelector("main").insertAdjacentHTML(
      "beforeend",
      '<div class="container"><div class="notice">投票イベントが存在しません。</div></div>'
    );
  }
})();
