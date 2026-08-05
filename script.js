(function () {
  "use strict";

  const STORAGE_KEY = "myfamily_expenses_v1";
  const CATEGORY_KEY = "myfamily_categories_v1";

  const DEFAULT_CATEGORIES = ["Baby Expenses", "Rent", "Utilities", "Food", "Personal", "Others"];
  const MONTHLY_BUDGET = 60000;
  const LOW_BALANCE_THRESHOLD = 10000;

  /** @returns {Array} */
  function loadExpenses() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("failed to load expenses", e);
      return [];
    }
  }

  function saveExpenses(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function loadCategories() {
    try {
      const raw = localStorage.getItem(CATEGORY_KEY);
      const list = raw ? JSON.parse(raw) : null;
      return list && list.length ? list : DEFAULT_CATEGORIES.slice();
    } catch (e) {
      return DEFAULT_CATEGORIES.slice();
    }
  }

  function saveCategories(list) {
    localStorage.setItem(CATEGORY_KEY, JSON.stringify(list));
  }

  let expenses = loadExpenses();
  let categories = loadCategories();
  if (!categories.includes("Others")) {
    categories.push("Others");
    saveCategories(categories);
  }
  let currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

  const monthLabelEl = document.getElementById("monthLabel");
  const listMonthLabelEl = document.getElementById("listMonthLabel");
  const totalAmountEl = document.getElementById("totalAmount");
  const budgetAmountEl = document.getElementById("budgetAmount");
  const balanceAmountEl = document.getElementById("balanceAmount");
  const alertBtn = document.getElementById("alertBtn");
  const categoryBreakdownEl = document.getElementById("categoryBreakdown");
  const expenseTbody = document.getElementById("expenseTbody");
  const emptyMsg = document.getElementById("emptyMsg");
  const categorySelect = document.getElementById("categorySelect");
  const dateInput = document.getElementById("dateInput");

  function formatYen(n) {
    return "¥" + Math.round(n).toLocaleString("en-US");
  }

  function formatMonthLabel(ym) {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  }

  function shiftMonth(ym, delta) {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function renderCategoryOptions() {
    categorySelect.innerHTML = "";
    categories.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      categorySelect.appendChild(opt);
    });
  }

  function expensesForMonth(ym) {
    return expenses.filter((e) => e.date.substring(0, 7) === ym);
  }

  function render() {
    monthLabelEl.textContent = formatMonthLabel(currentMonth);
    listMonthLabelEl.textContent = formatMonthLabel(currentMonth);

    const monthExpenses = expensesForMonth(currentMonth);
    const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    totalAmountEl.textContent = formatYen(total);

    budgetAmountEl.textContent = formatYen(MONTHLY_BUDGET);

    const balance = MONTHLY_BUDGET - total;
    balanceAmountEl.textContent = formatYen(balance);
    balanceAmountEl.classList.toggle("low", balance < LOW_BALANCE_THRESHOLD);
    alertBtn.style.display = balance < LOW_BALANCE_THRESHOLD ? "inline-flex" : "none";

    // category breakdown
    const byCategory = {};
    monthExpenses.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    });

    categoryBreakdownEl.innerHTML = "";
    const maxAmount = Math.max(1, ...Object.values(byCategory));
    const barFills = [];

    categories
      .filter((cat) => byCategory[cat])
      .sort((a, b) => byCategory[b] - byCategory[a])
      .forEach((cat, i) => {
        const amount = byCategory[cat];
        const pct = Math.round((amount / maxAmount) * 100);
        const row = document.createElement("div");
        row.className = "cat-row";
        row.style.animationDelay = (i * 60) + "ms";
        row.innerHTML =
          '<div class="cat-name">' + escapeHtml(cat) + '</div>' +
          '<div class="bar-track"><div class="bar-fill" style="width:0%"></div></div>' +
          '<div class="cat-amount">' + formatYen(amount) + '</div>';
        categoryBreakdownEl.appendChild(row);
        barFills.push({ el: row.querySelector(".bar-fill"), pct });
      });

    requestAnimationFrame(() => {
      barFills.forEach(({ el, pct }) => {
        el.style.width = pct + "%";
      });
    });

    // list
    expenseTbody.innerHTML = "";
    const sorted = monthExpenses.slice().sort((a, b) => b.date.localeCompare(a.date));

    if (sorted.length === 0) {
      emptyMsg.style.display = "block";
    } else {
      emptyMsg.style.display = "none";
      sorted.forEach((e) => {
        const tr = document.createElement("tr");
        const detailMemo = [e.detail, e.memo].filter(Boolean).join(" / ");
        tr.innerHTML =
          "<td>" + e.date + "</td>" +
          "<td>" + escapeHtml(e.category) + "</td>" +
          "<td>" + escapeHtml(detailMemo) + "</td>" +
          '<td class="amount">' + formatYen(e.amount) + "</td>" +
          '<td><button class="btn-danger" data-id="' + e.id + '">Delete</button></td>';
        expenseTbody.appendChild(tr);
      });
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }

  // -- events --

  document.getElementById("prevMonth").addEventListener("click", () => {
    currentMonth = shiftMonth(currentMonth, -1);
    render();
  });

  document.getElementById("nextMonth").addEventListener("click", () => {
    currentMonth = shiftMonth(currentMonth, 1);
    render();
  });

  document.getElementById("expenseForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const category = categorySelect.value;
    const amount = Number(document.getElementById("amountInput").value);
    const date = dateInput.value;
    const detail = document.getElementById("detailInput").value.trim();
    const memo = document.getElementById("memoInput").value.trim();

    if (!category || !amount || !date) return;

    expenses.push({
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      category,
      amount,
      date,
      detail,
      memo
    });

    saveExpenses(expenses);

    currentMonth = date.substring(0, 7);
    document.getElementById("expenseForm").reset();
    dateInput.value = new Date().toISOString().substring(0, 10);
    render();
  });

  document.getElementById("addCategoryBtn").addEventListener("click", () => {
    const input = document.getElementById("newCategoryInput");
    const name = input.value.trim();
    if (!name || categories.includes(name)) return;

    categories.push(name);
    saveCategories(categories);
    renderCategoryOptions();
    categorySelect.value = name;
    input.value = "";
  });

  expenseTbody.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-id]");
    if (!btn) return;

    const id = btn.getAttribute("data-id");
    if (!confirm("Delete this record?")) return;

    expenses = expenses.filter((e) => e.id !== id);
    saveExpenses(expenses);
    render();
  });

  document.getElementById("exportBtn").addEventListener("click", () => {
    const data = { expenses, categories };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "myfamily-expenses-" + new Date().toISOString().substring(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("importBtn").addEventListener("click", () => {
    document.getElementById("importFile").click();
  });

  document.getElementById("importFile").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.expenses)) throw new Error("invalid file");

        if (!confirm("This will replace your current data. Continue?")) return;

        expenses = data.expenses;
        categories = Array.isArray(data.categories) && data.categories.length ? data.categories : DEFAULT_CATEGORIES.slice();

        saveExpenses(expenses);
        saveCategories(categories);
        renderCategoryOptions();
        render();
      } catch (e) {
        alert("Failed to load file. Please select a valid JSON file.");
      }
    };
    reader.readAsText(file);
  });

  document.querySelectorAll(".quick-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const category = btn.getAttribute("data-category");
      const detail = btn.getAttribute("data-detail");

      if (category && categories.includes(category)) {
        categorySelect.value = category;
      }
      document.getElementById("detailInput").value = detail;
      document.getElementById("expenseForm").scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById("amountInput").focus();
    });
  });

  // baby age (auto-updates daily, no manual editing needed)
  function updateBabyAge() {
    const el = document.getElementById("rahaAge");
    if (!el) return;

    const birth = new Date(el.getAttribute("data-birthdate") + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (today < birth) {
      el.textContent = "👶 Raha arrives soon!";
      return;
    }

    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    let days = today.getDate() - birth.getDate();

    if (days < 0) {
      months--;
      const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    const parts = [];
    if (years > 0) parts.push(years + (years === 1 ? " year" : " years"));
    if (months > 0) parts.push(months + (months === 1 ? " month" : " months"));
    if (days > 0 || parts.length === 0) parts.push(days + (days === 1 ? " day" : " days"));

    // each part (years/months/days) gets its own span so it can pop in
    // with a staggered animation whenever the age is (re)rendered
    const partsHtml = parts
      .map((p, i) => `<span class="age-part" style="animation-delay:${i * 0.12}s">${p}</span>`)
      .join('<span class="age-sep">, </span>');

    el.innerHTML = "👶 Raha is " + partsHtml + " old";
  }

  // education modal (daily Japanese)
  const eduModal = document.getElementById("eduModal");
  const eduToggleBtn = document.getElementById("eduToggleBtn");
  const eduCloseBtn = document.getElementById("eduCloseBtn");

  function openEduModal() {
    eduModal.style.display = "flex";
  }
  function closeEduModal() {
    eduModal.style.display = "none";
  }

  eduToggleBtn.addEventListener("click", openEduModal);
  eduCloseBtn.addEventListener("click", closeEduModal);
  eduModal.addEventListener("click", (event) => {
    if (event.target === eduModal) closeEduModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && eduModal.style.display !== "none") closeEduModal();
  });

  // baby sensory game (tap tiles: pop + wiggle + sound)
  const gameModal = document.getElementById("gameModal");
  const gameToggleBtn = document.getElementById("gameToggleBtn");
  const gameCloseBtn = document.getElementById("gameCloseBtn");
  const gameGrid = document.getElementById("gameGrid");

  function openGameModal() {
    gameModal.style.display = "flex";
  }
  function closeGameModal() {
    gameModal.style.display = "none";
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }

  gameToggleBtn.addEventListener("click", openGameModal);
  gameCloseBtn.addEventListener("click", closeGameModal);
  gameModal.addEventListener("click", (event) => {
    if (event.target === gameModal) closeGameModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && gameModal.style.display !== "none") closeGameModal();
  });

  function speakSound(text) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.85;
    utter.pitch = 1.4;
    speechSynthesis.speak(utter);
  }

  const confettiEmojis = ["✨", "🎉", "⭐", "🌟", "💫"];

  function burstConfetti(button) {
    const rect = button.getBoundingClientRect();
    for (let i = 0; i < 5; i++) {
      const particle = document.createElement("span");
      particle.className = "confetti-particle";
      particle.textContent = confettiEmojis[Math.floor(Math.random() * confettiEmojis.length)];
      particle.style.left = (rect.left + rect.width / 2) + "px";
      particle.style.top = (rect.top + rect.height / 2) + "px";
      particle.style.setProperty("--drift", (Math.random() * 80 - 40) + "px");
      document.body.appendChild(particle);
      particle.addEventListener("animationend", () => particle.remove());
    }
  }

  gameGrid.addEventListener("click", (event) => {
    const btn = event.target.closest(".game-item");
    if (!btn) return;

    btn.classList.remove("popped");
    void btn.offsetWidth; // restart animation
    btn.classList.add("popped");

    speakSound(btn.getAttribute("data-sound"));
    burstConfetti(btn);
  });

  // init
  dateInput.value = new Date().toISOString().substring(0, 10);
  renderCategoryOptions();
  render();
  updateBabyAge();
  // recheck periodically so the age rolls over automatically past midnight
  // if the page is left open
  setInterval(updateBabyAge, 60 * 60 * 1000);
})();
