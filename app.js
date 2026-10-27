(function () {
  "use strict";

  const main = document.getElementById("main");
  const nav = document.getElementById("nav");
  let view = "submit";
  let entries = [];

  function pad(n) { return String(n).padStart(2, "0"); }
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function nowTime() {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${pad(weekNo)}`;
  }
  function monthKeyOf(dateStr) { return dateStr.slice(0, 7); }
  function formatDateLabel(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  function effectiveDate(en) { return en.dateFrom || en.date || ""; }
  function effectiveDateTo(en) { return en.dateTo || en.date || ""; }
  function formatDateRange(en) {
    const from = effectiveDate(en);
    const to = effectiveDateTo(en);
    if (!from) return "—";
    if (!to || to === from) return formatDateLabel(from);
    return `${formatDateLabel(from)} → ${formatDateLabel(to)}`;
  }
  function monthLabel(key) {
    const [y, m] = key.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  function effectiveTimeFrom(en) { return en.timeFrom || en.time || ""; }
  function effectiveTimeTo(en) { return en.timeTo || en.time || ""; }
  function formatTimeRange(en) {
    const from = effectiveTimeFrom(en);
    const to = effectiveTimeTo(en);
    if (!from) return "—";
    if (!to || to === from) return from;
    return `${from} → ${to}`;
  }
  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // ---------- Server API ----------
  async function loadEntries() {
    try {
      const data = await SanayaAuth.apiCall('GET', '/api/trips');
      entries = (data.trips || []).map(t => ({
        id: t.id,
        name: t.name,
        date: t.date,
        dateFrom: t.date_from,
        dateTo: t.date_to,
        time: t.time,
        timeFrom: t.time_from,
        timeTo: t.time_to,
        carModel: t.car_model,
        carNumber: t.car_number,
        purpose: t.purpose,
        submittedAt: t.submitted_at
      }));
    } catch (e) {
      console.error("Failed to load trips", e);
      entries = [];
    }
  }

  async function addEntry(entry) {
    const data = await SanayaAuth.apiCall('POST', '/api/trips', {
      name: entry.name,
      date: entry.date,
      dateFrom: entry.dateFrom,
      dateTo: entry.dateTo,
      time: entry.time,
      timeFrom: entry.timeFrom,
      timeTo: entry.timeTo,
      carModel: entry.carModel,
      carNumber: entry.carNumber,
      purpose: entry.purpose
    });
    // Add to local cache
    if (data.trip) {
      entries.unshift({
        id: data.trip.id,
        name: data.trip.name,
        date: data.trip.date,
        dateFrom: data.trip.date_from,
        dateTo: data.trip.date_to,
        time: data.trip.time,
        timeFrom: data.trip.time_from,
        timeTo: data.trip.time_to,
        carModel: data.trip.car_model,
        carNumber: data.trip.car_number,
        purpose: data.trip.purpose,
        submittedAt: data.trip.submitted_at
      });
    }
  }

  async function deleteEntry(id) {
    if (!isAdminView()) { alert("Only admin can remove entries."); return; }
    if (!id) return;
    await SanayaAuth.apiCall('DELETE', `/api/trips/${id}`);
    entries = entries.filter(e => e.id !== id);
  }

  // ---------- Rendering ----------
  function isAdminView() {
    try { return !!(window.SanayaAuth && SanayaAuth.isAdmin()); } catch { return false; }
  }
  function setView(v) {
    if ((v === "weekly" || v === "monthly") && !isAdminView()) {
      v = "submit";
    }
    view = v;
    [...nav.querySelectorAll(".nav-btn")].forEach((b) =>
      b.classList.toggle("active", b.dataset.view === v)
    );
    render();
  }
  function render() {
    if (!isAdminView() && view !== "submit") {
      view = "submit";
      [...nav.querySelectorAll(".nav-btn")].forEach((b) =>
        b.classList.toggle("active", b.dataset.view === view)
      );
    }
    if (view === "submit") renderSubmit();
    else if (view === "weekly") renderReport("weekly");
    else renderReport("monthly");
  }

  function renderSubmit() {
    main.innerHTML = `
      <div class="grid">
        <section class="card">
          <h2 class="section-title">Log vehicle use</h2>
          <p class="section-sub">Record who took the car and when, before you head out.</p>
          <form id="trip-form" novalidate>
            <label for="f-name">Employee name
              <input type="text" id="f-name" placeholder="e.g. Fatma Al Balushi" autocomplete="name" maxlength="60" required />
            </label>
            <div class="row">
              <label for="f-date-from">From
                <input type="date" id="f-date-from" value="${todayISO()}" required />
              </label>
              <label for="f-date-to">To
                <input type="date" id="f-date-to" value="${todayISO()}" required />
              </label>
            </div>
            <div class="row">
              <label for="f-time-from">Time From
                <input type="time" id="f-time-from" value="${nowTime()}" required />
              </label>
              <label for="f-time-to">Time To
                <input type="time" id="f-time-to" value="${nowTime()}" required />
              </label>
            </div>
            <div class="row">
              <label for="f-car-model">Car model
                <input type="text" id="f-car-model" placeholder="e.g. Toyota Hilux" maxlength="40" required />
              </label>
              <label for="f-car-number">Car number
                <input type="text" id="f-car-number" placeholder="e.g. 12345" maxlength="20" required />
              </label>
            </div>
            <label for="f-purpose">Purpose <span class="label-optional">(optional)</span>
              <input type="text" id="f-purpose" placeholder="e.g. Client visit — Al Khuwair" maxlength="120" />
            </label>
            <div id="f-error" class="error-text" style="display:none;"></div>
            <button type="submit" class="submit-btn" id="f-submit">Log trip</button>
            <div id="f-success" class="success-text" style="display:none;">Trip logged.</div>
          </form>
          <div class="sync-note"><span class="sync-dot"></span>Saved to server</div>
        </section>

        <section class="card">
          <h2 class="section-title">Recent entries</h2>
          ${
            entries.length === 0
              ? `<p class="empty-text">No trips logged yet. The first entry will appear here.</p>`
              : `<ul class="recent-list">${entries.slice(0, 8).map((en) => `
                  <li class="recent-item">
                    <div>
                      <div class="recent-name">${escapeHtml(en.name)}</div>
                      <div class="recent-meta">${formatDateRange(en)} · ${escapeHtml(formatTimeRange(en))} · ${escapeHtml(en.carModel || "")} (${escapeHtml(en.carNumber || "")})${en.purpose ? " · " + escapeHtml(en.purpose) : ""}</div>
                    </div>
                    ${isAdminView() ? `<button type="button" class="delete-btn" data-id="${en.id}" aria-label="Remove trip by ${escapeHtml(en.name)}">Remove</button>` : ``}
                  </li>`).join("")}</ul>`
          }
        </section>
      </div>
    `;

    document.getElementById("trip-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("f-name").value.trim();
      const dateFrom = document.getElementById("f-date-from").value;
      const dateTo = document.getElementById("f-date-to").value;
      const timeFrom = document.getElementById("f-time-from").value;
      const timeTo = document.getElementById("f-time-to").value;
      const carModel = document.getElementById("f-car-model").value.trim();
      const carNumber = document.getElementById("f-car-number").value.trim().toUpperCase();
      const purpose = document.getElementById("f-purpose").value.trim();
      const errorEl = document.getElementById("f-error");
      const successEl = document.getElementById("f-success");
      const submitBtn = document.getElementById("f-submit");

      if (!name || !dateFrom || !dateTo || !timeFrom || !timeTo || !carModel || !carNumber) {
        errorEl.textContent = "Name, From, To, time from, time to, car model, and car number are required.";
        errorEl.style.display = "block";
        return;
      }
      if (dateTo < dateFrom) {
        errorEl.textContent = "To date cannot be earlier than From date.";
        errorEl.style.display = "block";
        return;
      }
      if (dateFrom === dateTo && timeTo < timeFrom) {
        errorEl.textContent = "Time To cannot be earlier than Time From on the same day.";
        errorEl.style.display = "block";
        return;
      }
      errorEl.style.display = "none";
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving…";
      try {
        await addEntry({ name, date: dateFrom, dateFrom, dateTo, time: timeFrom, timeFrom, timeTo, carModel, carNumber, purpose });
        successEl.style.display = "block";
        setTimeout(() => { successEl.style.display = "none"; }, 2500);
        e.target.reset();
        document.getElementById("f-date-from").value = todayISO();
        document.getElementById("f-date-to").value = todayISO();
        document.getElementById("f-time-from").value = nowTime();
        document.getElementById("f-time-to").value = nowTime();
        render();
      } catch (err) {
        console.error(err);
        errorEl.textContent = err.message || "Could not save. Check connection and try again.";
        errorEl.style.display = "block";
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Log trip";
      }
    });

    main.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Remove this trip entry?")) return;
        btn.disabled = true;
        btn.textContent = "Removing…";
        try {
          await deleteEntry(btn.dataset.id);
          render();
        } catch (e) {
          console.error(e);
          alert("Could not remove entry.");
          btn.disabled = false;
          btn.textContent = "Remove";
        }
      });
    });
  }

  function groupBy(keyFn) {
    const map = new Map();
    for (const en of entries) {
      const k = keyFn(en);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(en);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }

  function tallyByEmployee(list) {
    const map = new Map();
    for (const en of list) map.set(en.name, (map.get(en.name) || 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }

  function renderReport(kind) {
    const groups = kind === "weekly"
      ? groupBy((en) => getISOWeek(new Date(effectiveDate(en) + "T00:00:00")))
      : groupBy((en) => monthKeyOf(effectiveDate(en)));
    const labelFor = kind === "weekly"
      ? (key) => { const [y, w] = key.split("-W"); return `Week ${w}, ${y}`; }
      : monthLabel;
    const title = kind === "weekly" ? "Weekly report" : "Monthly report";

    if (groups.length === 0) {
      main.innerHTML = `<section class="card"><h2 class="section-title">${title}</h2><p class="empty-text">No entries yet. Log a trip to start building this report.</p></section>`;
      return;
    }

    main.innerHTML = groups.map(([key, list]) => {
      const sorted = [...list].sort((a, b) =>
        effectiveDate(a) === effectiveDate(b) ? (effectiveTimeFrom(a) < effectiveTimeFrom(b) ? -1 : 1) : (effectiveDate(a) < effectiveDate(b) ? -1 : 1)
      );
      const counts = tallyByEmployee(list);
      return `
        <section class="card">
          <div class="report-header">
            <h2 class="section-title">${escapeHtml(labelFor(key))}</h2>
            <span class="report-count">${list.length} trip${list.length === 1 ? "" : "s"}</span>
          </div>
          <div class="tally-row">
            ${counts.map(([n, c]) => `<span class="tally-chip">${escapeHtml(n)} <strong>${c}</strong></span>`).join("")}
          </div>
          <table>
            <thead><tr><th>Employee</th><th>From → To</th><th>Time From → To</th><th>Car</th><th>Plate no.</th><th>Purpose</th></tr></thead>
            <tbody>
              ${sorted.map((en) => `
                <tr>
                  <td>${escapeHtml(en.name)}</td>
                  <td>${escapeHtml(formatDateRange(en))}</td>
                  <td>${escapeHtml(formatTimeRange(en))}</td>
                  <td>${escapeHtml(en.carModel || "—")}</td>
                  <td>${escapeHtml(en.carNumber || "—")}</td>
                  <td style="color:var(--muted)">${en.purpose ? escapeHtml(en.purpose) : "—"}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </section>`;
    }).join("");
  }

  nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-btn");
    if (btn) setView(btn.dataset.view);
  });

  // Initialize
  async function init() {
    await loadEntries();
    render();
  }

  init();
})();
