/* The Dad Field Manual — logic.
   State lives in localStorage under the key below. No accounts, no network. */
(function () {
  "use strict";

  var STORE_KEY = "dad-field-manual-v1";
  var DAYS = ["M", "T", "W", "T", "F", "S", "S"];

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || { checks: {}, notes: {}, habits: {} };
    } catch (e) {
      return { checks: {}, notes: {}, habits: {} };
    }
  }

  var state = loadState();
  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  /* ---------- Tabs ---------- */
  var tabs = document.querySelectorAll(".tab");
  for (var t = 0; t < tabs.length; t++) {
    tabs[t].addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (el) { el.classList.remove("is-active"); });
      this.classList.add("is-active");
      var name = this.getAttribute("data-section");
      var checklistIds = ["before-baby", "hospital-day", "first-weeks", "home-safety"];
      document.getElementById("checklists-app").hidden = checklistIds.indexOf(name) === -1;
      document.getElementById("habits-app").hidden = name !== "dad-habits";
      document.getElementById("notes-app").hidden = name !== "notes";
    });
  }

  /* ---------- Checklists ---------- */
  function renderChecklists() {
    var host = document.getElementById("checklists-app");
    host.innerHTML = "";
    window.DFM_SECTIONS.forEach(function (sec) {
      var block = document.createElement("div");
      block.className = "section-block";

      var headRow = document.createElement("div");
      headRow.className = "section-head-row";
      var h2 = document.createElement("h2");
      h2.textContent = sec.title;
      var pct = document.createElement("span");
      pct.className = "pct-inline";
      pct.id = "pct-" + sec.id;
      headRow.appendChild(h2);
      headRow.appendChild(pct);
      block.appendChild(headRow);

      var why = document.createElement("p");
      why.className = "why";
      why.textContent = sec.why;
      block.appendChild(why);

      var ul = document.createElement("ul");
      ul.className = "checklist";
      sec.items.forEach(function (item) {
        var li = document.createElement("li");
        var label = document.createElement("label");
        label.className = "check-item";
        var box = document.createElement("input");
        box.type = "checkbox";
        box.checked = !!state.checks[item.id];
        box.addEventListener("change", function () {
          state.checks[item.id] = box.checked;
          li.classList.toggle("is-done", box.checked);
          save();
          updatePercent(sec, pct);
          updateOverall();
        });
        var span = document.createElement("span");
        span.className = "check-text";
        span.textContent = item.text;
        label.appendChild(box);
        label.appendChild(span);
        li.appendChild(label);
        if (box.checked) li.classList.add("is-done");
        ul.appendChild(li);
      });
      block.appendChild(ul);
      host.appendChild(block);
      updatePercent(sec, pct);
    });
  }

  function updatePercent(sec, pctEl) {
    var done = sec.items.filter(function (i) { return state.checks[i.id]; }).length;
    var total = sec.items.length;
    var pct = total ? Math.round((done / total) * 100) : 0;
    pctEl.textContent = done + " / " + total + " (" + pct + "%)";
  }

  function updateOverall() {
    var total = 0, done = 0;
    window.DFM_SECTIONS.forEach(function (sec) {
      total += sec.items.length;
      sec.items.forEach(function (i) { if (state.checks[i.id]) done++; });
    });
    var pct = total ? Math.round((done / total) * 100) : 0;
    document.getElementById("overall-pct").textContent = pct + "%";
    document.getElementById("overall-bar").style.width = pct + "%";
  }

  /* ---------- Field Notes ---------- */
  function noteKey(sectionId) {
    return "note-" + sectionId;
  }

  function renderNotes() {
    var holder = document.getElementById("notes-holder");
    holder.innerHTML = "";
    window.DFM_SECTIONS.forEach(function (sec) {
      var block = document.createElement("div");
      block.className = "section-block";
      var h2 = document.createElement("h2");
      h2.textContent = sec.title;
      block.appendChild(h2);
      var ta = document.createElement("textarea");
      ta.className = "field-note";
      ta.placeholder = "What did you learn here? What will you actually do?";
      ta.value = state.notes[noteKey(sec.id)] || "";
      var saved = document.createElement("p");
      saved.className = "note-saved";
      var setSaved = function () { saved.textContent = "Saved " + new Date().toLocaleTimeString(); };
      if (ta.value) setSaved();
      ta.addEventListener("input", function () {
        state.notes[noteKey(sec.id)] = ta.value;
        save();
        setSaved();
      });
      block.appendChild(ta);
      block.appendChild(saved);
      holder.appendChild(block);
    });
  }

  /* ---------- Dad Habits (weekly grid) ---------- */
  function currentWeekId() {
    var now = new Date();
    var day = (now.getDay() + 6) % 7; // Monday=0
    var monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
    var iso = monday.toISOString().slice(0, 10);
    return iso;
  }

  function mondayOffsetText(mondayIso) {
    var monday = new Date(mondayIso + "T00:00:00");
    var opts = { month: "short", day: "numeric" };
    return "Week of " + monday.toLocaleDateString(undefined, opts);
  }

  function renderHabits() {
    var host = document.getElementById("habits-app");
    host.innerHTML = "";

    var wk = currentWeekId();

    var toolbar = document.createElement("div");
    toolbar.className = "week-toolbar";
    var label = document.createElement("span");
    label.className = "week-label";
    label.id = "week-label";
    label.textContent = mondayOffsetText(wk) + " — five habits, pass/fail. That's the scorecard.";
    host.appendChild(toolbar);
    toolbar.appendChild(label);

    var prevBtn = document.createElement("button");
    prevBtn.className = "btn btn-ghost btn-small";
    prevBtn.type = "button";
    prevBtn.textContent = "← Last week";
    prevBtn.addEventListener("click", function () {
      var d = new Date(wk + "T00:00:00");
      d.setDate(d.getDate() - 7);
      renderWeek(host, d.toISOString().slice(0, 10));
    });
    var nextBtn = document.createElement("button");
    nextBtn.className = "btn btn-ghost btn-small";
    nextBtn.type = "button";
    nextBtn.textContent = "This week →";
    nextBtn.style.marginLeft = "8px";
    nextBtn.addEventListener("click", function () {
      renderWeek(host, currentWeekId());
    });
    toolbar.appendChild(prevBtn);
    toolbar.appendChild(nextBtn);

    renderWeek(host, wk);
  }

  function renderWeek(host, weekId) {
    var old = host.querySelector(".habit-table-wrap");
    if (old) old.remove();

    var wrap = document.createElement("div");
    wrap.className = "habit-table-wrap";
    var table = document.createElement("table");
    table.className = "habit-table";

    var thead = document.createElement("thead");
    var hr = document.createElement("tr");
    var thHabit = document.createElement("th");
    thHabit.className = "habit";
    thHabit.textContent = "Habit";
    hr.appendChild(thHabit);
    var todayIdx = ((new Date().getDay() + 6) % 7); // 0=Mon
    for (var d = 0; d < 7; d++) {
      var th = document.createElement("th");
      th.className = "day";
      th.textContent = DAYS[d];
      hr.appendChild(th);
    }
    var thTot = document.createElement("th");
    thTot.className = "day";
    thTot.textContent = "Score";
    hr.appendChild(thTot);
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    var todayColCells = [];
    window.DFM_HABITS.forEach(function (habit) {
      var tr = document.createElement("tr");
      var tdLabel = document.createElement("td");
      tdLabel.className = "habit";
      tdLabel.textContent = habit.label;
      tr.appendChild(tdLabel);
      for (var d = 0; d < 7; d++) {
        var td = document.createElement("td");
        td.className = "daycell";
        var box = document.createElement("input");
        box.type = "checkbox";
        box.className = "daybox";
        var key = habit.id + "@" + weekId + "#" + d;
        box.checked = !!state.habits[key];
        box.addEventListener("change", function () {
          state.habits[this.dataset.key] = this.checked;
          save();
          refreshTotals(table, weekId);
        });
        box.dataset.key = key;
        td.appendChild(box);
        if (d === todayIdx) { td.classList.add("todaycol"); todayColCells.push(td); }
        tr.appendChild(td);
      }
      var tdTot = document.createElement("td");
      tdTot.className = "habit-total";
      tr.appendChild(tdTot);
      tbody.appendChild(tr);
    });

    var totalsRow = document.createElement("tr");
    totalsRow.className = "week-row-totals";
    var tdTotalLabel = document.createElement("td");
    tdTotalLabel.className = "habit";
    tdTotalLabel.textContent = "Day score (of 5)";
    totalsRow.appendChild(tdTotalLabel);
    for (var d2 = 0; d2 < 7; d2++) {
      var tdD = document.createElement("td");
      tdD.className = "day-total";
      tdD.textContent = "–";
      if (d2 === todayIdx) { tdD.classList.add("todaycol"); }
      totalsRow.appendChild(tdD);
    }
    var tdWeekTotal = document.createElement("td");
    tdWeekTotal.className = "week-total";
    tdWeekTotal.textContent = "–";
    totalsRow.appendChild(tdWeekTotal);
    tbody.appendChild(totalsRow);

    table.appendChild(tbody);
    wrap.appendChild(table);
    host.appendChild(wrap);
    refreshTotals(table, weekId);
    var lbl = document.getElementById("week-label");
    if (lbl) lbl.textContent = mondayOffsetText(weekId) + " — five habits, pass/fail. That's the scorecard.";
  }

  function refreshTotals(table, weekId) {
    var rows = table.querySelectorAll("tbody tr");
    var weekTotal = 0;
    for (var d = 0; d < 7; d++) {
      var dayCount = 0;
      for (var r = 0; r < rows.length - 1; r++) {
        var box = rows[r].querySelectorAll(".daybox")[d];
        if (box && box.checked) dayCount++;
      }
      rows[rows.length - 1].querySelectorAll(".day-total")[d].textContent =
        d <= ((new Date().getDay() + 6) % 7) ? String(dayCount) : "–";
      weekTotal += dayCount;
    }
    table.querySelector(".week-total").textContent = String(weekTotal) + " / 35";
  }

  /* ---------- Reset ---------- */
  var resetBtn = document.getElementById("reset-all");
  resetBtn.addEventListener("click", function () {
    if (confirm("Wipe all checkmarks, notes, and habit data? This cannot be undone.")) {
      localStorage.removeItem(STORE_KEY);
      state = { checks: {}, notes: {}, habits: {} };
      renderChecklists();
      renderNotes();
      renderHabits();
      updateOverall();
    }
  });

  /* ---------- Print ---------- */
  document.getElementById("print-btn").addEventListener("click", function () {
    document.getElementById("checklists-app").hidden = false;
    document.getElementById("habits-app").hidden = false;
    document.getElementById("notes-app").hidden = false;
    window.print();
  });

  /* ---------- Boot ---------- */
  renderChecklists();
  renderNotes();
  renderHabits();
  updateOverall();
})();