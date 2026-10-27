(function () {
  "use strict";

  const main = document.getElementById("main");
  let allEntries = [];
  let sortCol = "date";
  let sortDir = "desc";
  let filters = { employee: "", car: "", start: "", end: "" };

  function pad(n) { return String(n).padStart(2, "0"); }
  function formatDateLabel(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  function effectiveDate(en){ return en.dateFrom || en.date || ""; }
  function effectiveDateTo(en){ return en.dateTo || en.date || ""; }
  function formatDateRange(en){
    const from = effectiveDate(en);
    const to = effectiveDateTo(en);
    if (!from) return "—";
    if (!to || to === from) return formatDateLabel(from);
    return `${formatDateLabel(from)} → ${formatDateLabel(to)}`;
  }
  function effectiveTimeFrom(en){ return en.timeFrom || en.time || ""; }
  function effectiveTimeTo(en){ return en.timeTo || en.time || ""; }
  function formatTimeRange(en){
    const from = effectiveTimeFrom(en);
    const to = effectiveTimeTo(en);
    if (!from) return "—";
    if (!to || to === from) return from;
    return `${from} → ${to}`;
  }
  function monthKeyOf(dateStr) { return dateStr.slice(0, 7); }
  function monthLabelShort(key) {
    const [y, m] = key.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function getISOWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // ---------- Server API ----------
  async function loadEntries() {
    try {
      const data = await SanayaAuth.apiCall('GET', '/api/trips');
      allEntries = (data.trips || []).map(t => ({
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
      allEntries = [];
    }
  }

  // ---------- Filtering ----------
  function applyFilters(list) {
    return list.filter((en) => {
      const d = effectiveDate(en);
      if (filters.employee && en.name !== filters.employee) return false;
      if (filters.car && en.carNumber !== filters.car) return false;
      if (filters.start && d < filters.start) return false;
      if (filters.end && d > filters.end) return false;
      return true;
    });
  }

  function sortEntries(list) {
    const sorted = [...list].sort((a, b) => {
      let av = a[sortCol] ?? "";
      let bv = b[sortCol] ?? "";
      if (sortCol === "date") {
        av = effectiveDate(a) + " " + (effectiveTimeFrom(a) || "");
        bv = effectiveDate(b) + " " + (effectiveTimeFrom(b) || "");
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }

  // ---------- Chart drawing (plain canvas, no dependency) ----------
  function drawBarChart(canvas, data, opts = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    ctx.clearRect(0, 0, W, H);

    if (data.length === 0) {
      ctx.fillStyle = "#7A756A";
      ctx.font = "13px sans-serif";
      ctx.fillText("No data for this selection", 12, 24);
      return;
    }

    const padLeft = 34, padBottom = 34, padTop = 14, padRight = 10;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBottom;
    const maxVal = Math.max(...data.map((d) => d.value), 1);
    const barGap = 10;
    const barW = Math.max(8, (chartW - barGap * (data.length - 1)) / data.length);

    // gridlines + y labels
    ctx.strokeStyle = "#E7E0CF";
    ctx.fillStyle = "#7A756A";
    ctx.font = "11px sans-serif";
    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const y = padTop + chartH - (chartH * i) / ySteps;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(W - padRight, y);
      ctx.stroke();
      const val = Math.round((maxVal * i) / ySteps);
      ctx.fillText(String(val), 4, y + 3);
    }

    data.forEach((d, i) => {
      const x = padLeft + i * (barW + barGap);
      const h = (d.value / maxVal) * chartH;
      const y = padTop + chartH - h;
      ctx.fillStyle = opts.color || "#D9A226";
      ctx.beginPath();
      const r = Math.min(4, barW / 2);
      ctx.moveTo(x, y + h);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.lineTo(x + barW - r, y);
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
      ctx.lineTo(x + barW, y + h);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#2B2B2B";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      const label = d.label.length > 10 ? d.label.slice(0, 9) + "…" : d.label;
      ctx.fillText(label, x + barW / 2, H - padBottom + 16);
      ctx.textAlign = "left";
    });
  }

  // ---------- Render ----------
  function render() {
    const filtered = applyFilters(allEntries);
    const sorted = sortEntries(filtered);

    const employees = Array.from(new Set(allEntries.map((e) => e.name))).sort();
    const cars = Array.from(new Set(allEntries.map((e) => e.carNumber).filter(Boolean))).sort();

    const now = new Date();
    const weekStart = getISOWeekStart(now);
    const tripsThisWeek = allEntries.filter((e) => new Date(effectiveDate(e) + "T00:00:00") >= weekStart).length;

    // by-employee counts (top 8) from filtered set
    const empCounts = new Map();
    filtered.forEach((e) => empCounts.set(e.name, (empCounts.get(e.name) || 0) + 1));
    const empData = Array.from(empCounts.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([label, value]) => ({ label, value }));

    // by-month counts (last 6 months present in filtered data)
    const monthCounts = new Map();
    filtered.forEach((e) => {
      const k = monthKeyOf(effectiveDate(e));
      monthCounts.set(k, (monthCounts.get(k) || 0) + 1);
    });
    const monthData = Array.from(monthCounts.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-6)
      .map(([key, value]) => ({ label: monthLabelShort(key), value }));

    main.innerHTML = `
      <div class="card filters-card">
        <div class="filter-field">
          <label>Employee</label>
          <select id="fl-employee">
            <option value="">All employees</option>
            ${employees.map((n) => `<option value="${escapeHtml(n)}" ${filters.employee === n ? "selected" : ""}>${escapeHtml(n)}</option>`).join("")}
          </select>
        </div>
        <div class="filter-field">
          <label>Car / plate no.</label>
          <select id="fl-car">
            <option value="">All cars</option>
            ${cars.map((c) => `<option value="${escapeHtml(c)}" ${filters.car === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
          </select>
        </div>
        <div class="filter-field">
          <label>From</label>
          <input type="date" id="fl-start" value="${filters.start}" />
        </div>
        <div class="filter-field">
          <label>To</label>
          <input type="date" id="fl-end" value="${filters.end}" />
        </div>
        <div class="filter-actions">
          <button type="button" class="btn-secondary" id="fl-clear">Clear filters</button>
          <button type="button" class="btn-primary" id="fl-export">Export CSV</button>
        </div>
      </div>

      <div class="stat-row">
        <div class="stat-card"><div class="stat-value">${filtered.length}</div><div class="stat-label">Trips (filtered)</div></div>
        <div class="stat-card"><div class="stat-value">${employees.length}</div><div class="stat-label">Employees on record</div></div>
        <div class="stat-card"><div class="stat-value">${cars.length}</div><div class="stat-label">Vehicles on record</div></div>
        <div class="stat-card"><div class="stat-value">${tripsThisWeek}</div><div class="stat-label">Trips this week (all data)</div></div>
      </div>

      <div class="chart-row">
        <div class="card chart-card">
          <h2 class="section-title" style="font-size:15px;">Trips by employee</h2>
          <canvas id="chart-emp"></canvas>
        </div>
        <div class="card chart-card">
          <h2 class="section-title" style="font-size:15px;">Trips by month</h2>
          <canvas id="chart-month"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="table-toolbar">
          <h2 class="section-title" style="margin:0;">All entries</h2>
          <span class="report-count">${filtered.length} of ${allEntries.length} total</span>
        </div>
        ${filtered.length === 0 ? `<p class="empty-text">No entries match these filters.</p>` : `
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                ${headerCell("name", "Employee")}
                ${headerCell("date", "From → To")}
                ${headerCell("carModel", "Car")}
                ${headerCell("carNumber", "Plate no.")}
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map((en) => `
                <tr>
                  <td>${escapeHtml(en.name)}</td>
                  <td>${escapeHtml(formatDateRange(en))} · ${escapeHtml(formatTimeRange(en))}</td>
                  <td>${escapeHtml(en.carModel || "—")}</td>
                  <td>${escapeHtml(en.carNumber || "—")}</td>
                  <td style="color:var(--muted)">${en.purpose ? escapeHtml(en.purpose) : "—"}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>`}
      </div>
    `;
  
    function headerCell(col, label) {
      const arrow = sortCol === col ? (sortDir === "asc" ? "▲" : "▼") : "";
      return `<th class="sortable" data-col="${col}">${label}<span class="sort-arrow">${arrow}</span></th>`;
    }

    drawBarChart(document.getElementById("chart-emp"), empData, { color: "#D9A226" });
    drawBarChart(document.getElementById("chart-month"), monthData, { color: "#B9860F" });

    document.getElementById("fl-employee").addEventListener("change", (e) => { filters.employee = e.target.value; render(); });
    document.getElementById("fl-car").addEventListener("change", (e) => { filters.car = e.target.value; render(); });
    document.getElementById("fl-start").addEventListener("change", (e) => { filters.start = e.target.value; render(); });
    document.getElementById("fl-end").addEventListener("change", (e) => { filters.end = e.target.value; render(); });
    document.getElementById("fl-clear").addEventListener("click", () => { filters = { employee: "", car: "", start: "", end: "" }; render(); });
    document.getElementById("fl-export").addEventListener("click", () => exportCsv(sorted));

    main.querySelectorAll(".sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const col = th.dataset.col;
        if (sortCol === col) sortDir = sortDir === "asc" ? "desc" : "asc";
        else { sortCol = col; sortDir = "asc"; }
        render();
      });
    });
  }

  function exportCsv(list) {
    const headers = ["Employee", "From", "To", "Time From", "Time To", "Car model", "Plate no.", "Purpose"];
    const rows = list.map((en) => [
      en.name, effectiveDate(en), effectiveDateTo(en), effectiveTimeFrom(en), effectiveTimeTo(en), en.carModel || "", en.carNumber || "", en.purpose || "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `sanaya-vehicle-log-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => render(), 150);
  });

  // Initialize
  async function init() {
    await loadEntries();
    render();
  }

  init();
})();
