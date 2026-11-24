(() => {
    "use strict";

    const MODES = {
        main: { id: "main", label: "Hauptprüfung", barrels: 8, servants: 3 },
        simple: { id: "simple", label: "Vereinfachte Version", barrels: 4, servants: 2 }
    };

    function createEmptyPlan(servants, barrels) {
        return Array.from({ length: servants }, () => Array(barrels).fill(false));
    }

    const state = {
        currentMode: "main",
        plans: {
            main: createEmptyPlan(MODES.main.servants, MODES.main.barrels),
            simple: createEmptyPlan(MODES.simple.servants, MODES.simple.barrels)
        },
        solvedModes: new Set(),
        isSimulating: false,
        simActive: false,
        simSolvedGuess: false,
        poisonedBarrel: null,
        pickedBarrel: null,
        theme: "dark"
    };

    // DOM-Elemente
    const themeBtn = document.getElementById("theme-btn");
    const storyBtn = document.getElementById("story-btn");
    const storyModal = document.getElementById("story-modal");

    const modeButtons = document.querySelectorAll(".mode-pill");
    const matrixTitleEl = document.getElementById("matrix-title");
    const goalTextEl = document.getElementById("goal-text");
    const planTableEl = document.getElementById("plan-table");
    const clearPlanBtn = document.getElementById("clear-plan-btn");
    const simulateBtn = document.getElementById("simulate-btn");

    const resultBannerEl = document.getElementById("result-banner");
    const resultIconEl = document.getElementById("result-icon");
    const resultTitleEl = document.getElementById("result-title");
    const resultDescEl = document.getElementById("result-desc");

    const guessAreaEl = document.getElementById("guess-area");
    const dayCounterEl = document.getElementById("day-counter");
    const servantResultsEl = document.getElementById("servant-results");
    const barrelPickGridEl = document.getElementById("barrel-pick-grid");

    const statusBadgeEl = document.getElementById("status-badge");

    function applyTheme(theme) {
        state.theme = theme === "light" ? "light" : "dark";
        if (state.theme === "light") {
            document.documentElement.setAttribute("data-theme", "light");
            themeBtn.innerHTML = '<span aria-hidden="true">🌙</span> Dunkel';
        } else {
            document.documentElement.removeAttribute("data-theme");
            themeBtn.innerHTML = '<span aria-hidden="true">☀️</span> Hell';
        }
        try {
            localStorage.setItem("donnerkugeln-theme", state.theme);
        } catch (_) {
            // Speicher blockiert -> ignorieren
        }
    }

    function getMode() {
        return MODES[state.currentMode];
    }

    function getPlan() {
        return state.plans[state.currentMode];
    }

    function setBanner(variant, icon, title, desc) {
        resultBannerEl.className = `result-banner ${variant}`;
        resultIconEl.textContent = icon;
        resultTitleEl.textContent = title;
        resultDescEl.textContent = desc;
    }

    function getBarrelCode(barrelIndex) {
        const { servants } = getMode();
        const plan = getPlan();
        let code = "";
        for (let s = 0; s < servants; s++) {
            code += plan[s][barrelIndex] ? "1" : "0";
        }
        return code;
    }

    function hasDuplicateColumns() {
        const { barrels } = getMode();
        const seen = new Set();
        for (let b = 0; b < barrels; b++) {
            const code = getBarrelCode(b);
            if (seen.has(code)) return true;
            seen.add(code);
        }
        return false;
    }

    function createBarrelSvg(num) {
        return `<svg class="barrel-svg" viewBox="0 0 38 42" width="34" height="38" aria-hidden="true">
            <path d="M9 5 H29 C33 14 33 28 29 37 H9 C5 28 5 14 9 5 Z" fill="#7c4a21" stroke="#c8862b" stroke-width="1.8"/>
            <path d="M7.2 12 H30.8 M6.8 30 H31.2" stroke="#d9a441" stroke-width="2.4" stroke-linecap="round"/>
            <circle cx="19" cy="21" r="9.5" fill="#2c190a" fill-opacity="0.72" stroke="#e5b34c" stroke-width="1.2"/>
            <text x="19" y="25" text-anchor="middle" fill="#fef08a" font-size="12" font-weight="800">${num}</text>
        </svg>`;
    }

    function renderModeControls() {
        const { barrels, servants } = getMode();
        matrixTitleEl.textContent = `Trink-Plan: ${barrels} Fässer & ${servants} Diener`;
        goalTextEl.innerHTML =
            `Erstelle einen Trinkplan für die <strong>${barrels} Fässer und ${servants} Diener</strong>, ` +
            `bei dem du nach <strong>4 Tagen immer sicher weißt</strong>, welches Fass vergiftet ist!`;

        modeButtons.forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.mode === state.currentMode);
        });
    }

    function renderMatrix() {
        const { barrels, servants } = getMode();
        const plan = getPlan();

        planTableEl.innerHTML = "";

        const thead = document.createElement("thead");

        // Zeile 1: Eigene Zelle für die Fässer-Überschrift
        const groupRow = document.createElement("tr");
        const cornerTop = document.createElement("th");
        cornerTop.className = "corner-top-cell";
        cornerTop.innerHTML = '<span class="corner-emblem" aria-hidden="true">👑</span><span>Trinkplan</span>';
        groupRow.appendChild(cornerTop);

        const barrelsGroupTh = document.createElement("th");
        barrelsGroupTh.className = "barrels-group-head";
        barrelsGroupTh.colSpan = barrels;
        barrelsGroupTh.innerHTML = `<span>Fässer (Nr. 1 bis ${barrels})</span> <span class="axis-arrow" aria-hidden="true">→</span>`;
        groupRow.appendChild(barrelsGroupTh);
        thead.appendChild(groupRow);

        // Zeile 2: Eigene Zelle für Diener-Überschrift + je ein Fass pro Spalte
        const headRow = document.createElement("tr");
        const servantHeadTh = document.createElement("th");
        servantHeadTh.className = "servant-col-head";
        servantHeadTh.innerHTML = '<span>Diener</span> <span class="axis-arrow" aria-hidden="true">↓</span>';
        headRow.appendChild(servantHeadTh);

        for (let b = 0; b < barrels; b++) {
            const th = document.createElement("th");
            th.className = "barrel-head";
            th.innerHTML = `${createBarrelSvg(b + 1)}<span class="barrel-sub">Fass ${b + 1}</span>`;
            headRow.appendChild(th);
        }
        thead.appendChild(headRow);
        planTableEl.appendChild(thead);

        const tbody = document.createElement("tbody");
        for (let s = 0; s < servants; s++) {
            const tr = document.createElement("tr");
            const th = document.createElement("th");
            th.className = "servant-row-head";

            const drankCount = plan[s].filter(Boolean).length;
            const labelWrap = document.createElement("div");
            labelWrap.className = "servant-label";
            labelWrap.innerHTML =
                `<span class="servant-avatar" aria-hidden="true">${s + 1}</span>` +
                `<div class="servant-meta">` +
                `<span class="servant-name">Diener ${s + 1}</span>` +
                `<span class="servant-count">${drankCount} ${drankCount === 1 ? "Fass" : "Fässer"}</span>` +
                `</div>`;
            th.appendChild(labelWrap);
            tr.appendChild(th);

            for (let b = 0; b < barrels; b++) {
                const td = document.createElement("td");
                const checked = plan[s][b];
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "cell-btn" + (checked ? " checked" : "");
                btn.innerHTML = checked
                    ? '<span class="cup-icon" aria-hidden="true">🍷</span>'
                    : '<span class="empty-dot" aria-hidden="true">+</span>';
                btn.setAttribute(
                    "aria-label",
                    `Diener ${s + 1}, Fass ${b + 1}: ${checked ? "probiert" : "probiert nicht"}`
                );
                btn.setAttribute("aria-pressed", String(checked));
                btn.addEventListener("click", () => toggleCell(s, b));

                td.appendChild(btn);
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }

        planTableEl.appendChild(tbody);
    }

    function renderSimulationArea() {
        if (!state.simActive) {
            guessAreaEl.classList.add("hidden");
            return;
        }

        guessAreaEl.classList.remove("hidden");
        const { barrels, servants } = getMode();
        const plan = getPlan();

        servantResultsEl.innerHTML = "";
        for (let s = 0; s < servants; s++) {
            const isSick = plan[s][state.poisonedBarrel];
            const pill = document.createElement("div");
            pill.className = `servant-result-pill ${isSick ? "sick" : "healthy"}`;
            pill.textContent = isSick
                ? `Diener ${s + 1}: 🤢 Ausschlag!`
                : `Diener ${s + 1}: 😊 Gesund`;
            servantResultsEl.appendChild(pill);
        }

        barrelPickGridEl.innerHTML = "";
        for (let b = 0; b < barrels; b++) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "barrel-pick-btn";
            btn.textContent = `Fass ${b + 1}`;
            btn.disabled = state.simSolvedGuess;

            if (state.simSolvedGuess) {
                if (b === state.poisonedBarrel) {
                    btn.classList.add("correct");
                } else if (b === state.pickedBarrel) {
                    btn.classList.add("wrong");
                }
            }

            btn.addEventListener("click", () => submitBarrelGuess(b));
            barrelPickGridEl.appendChild(btn);
        }
    }

    function renderStatus() {
        const isSolved = state.solvedModes.has(state.currentMode);
        statusBadgeEl.textContent = isSolved ? "Gelöst ✓" : "Noch offen";
        statusBadgeEl.style.color = isSolved ? "var(--success)" : "var(--gold-bright)";
    }

    function renderAll() {
        renderModeControls();
        renderMatrix();
        renderStatus();
        renderSimulationArea();
    }

    // --- Aktionen ---
    function toggleCell(servantIndex, barrelIndex) {
        if (state.isSimulating) return;
        const plan = getPlan();
        plan[servantIndex][barrelIndex] = !plan[servantIndex][barrelIndex];
        state.simActive = false;
        state.simSolvedGuess = false;
        renderAll();
    }

    function clearCurrentPlan() {
        if (state.isSimulating) return;
        const { servants, barrels } = getMode();
        state.plans[state.currentMode] = createEmptyPlan(servants, barrels);
        state.solvedModes.delete(state.currentMode);
        state.simActive = false;
        state.simSolvedGuess = false;
        setBanner(
            "neutral",
            "🍷",
            "Plan geleert!",
            "Tippe auf die Felder, um deinen neuen Trink-Plan anzulegen."
        );
        renderAll();
    }

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    async function startSimulation() {
        if (state.isSimulating) return;
        state.isSimulating = true;
        simulateBtn.disabled = true;
        clearPlanBtn.disabled = true;

        const { barrels } = getMode();
        state.poisonedBarrel = Math.floor(Math.random() * barrels);
        state.pickedBarrel = null;
        state.simSolvedGuess = false;
        state.simActive = false;
        renderSimulationArea();

        setBanner("info", "⏳", "Tag 1: Alle Diener probieren …", "Dein Trink-Plan wird ausgeführt.");
        await sleep(260);
        setBanner("info", "⏳", "Tag 2: Wir spulen vor …", "Noch zeigt das Gift keine Wirkung.");
        await sleep(260);
        setBanner("info", "⏳", "Tag 3: Fast geschafft …", "Morgen ist das große Fest!");
        await sleep(260);

        state.isSimulating = false;
        state.simActive = true;
        simulateBtn.disabled = false;
        clearPlanBtn.disabled = false;
        dayCounterEl.textContent = "Tag 4: Auswertung!";

        setBanner(
            "info",
            "🔍",
            "Tag 4 ist da! Schau dir die Diener an:",
            "Welches Fass passt genau zu den kranken und gesunden Dienern?"
        );
        renderSimulationArea();
    }

    function submitBarrelGuess(barrelIndex) {
        if (!state.simActive || state.simSolvedGuess) return;
        state.pickedBarrel = barrelIndex;
        state.simSolvedGuess = true;

        const isPlanUnique = !hasDuplicateColumns();
        const won = barrelIndex === state.poisonedBarrel;

        if (won) {
            if (isPlanUnique) {
                state.solvedModes.add(state.currentMode);
                setBanner(
                    "success",
                    "🎉",
                    `Richtig! Fass ${barrelIndex + 1} war vergiftet – und dein Plan ist zu 100 % sicher!`,
                    "Du kannst deinen Plan jederzeit noch weiter testen (‚4 Tage vorspulen‘)."
                );
            } else {
                setBanner(
                    "info",
                    "🍀",
                    `Treffer! Fass ${barrelIndex + 1} war vergiftet – aber war das sicher oder Glück?`,
                    "Prüfe selbst in deiner Tabelle, ob wirklich jedes Fass ein eigenes Muster hat, und teste noch einmal!"
                );
            }
        } else {
            const pickedCode = getBarrelCode(barrelIndex);
            const realCode = getBarrelCode(state.poisonedBarrel);
            if (pickedCode === realCode) {
                setBanner(
                    "error",
                    "❌",
                    `Verwechselt! Es war Fass ${state.poisonedBarrel + 1} (nicht Fass ${barrelIndex + 1}).`,
                    "Beide Fässer hatten genau dasselbe Muster in deinem Plan – deshalb konnte man sie nicht unterscheiden!"
                );
            } else {
                setBanner(
                    "error",
                    "❌",
                    `Knapp daneben: Vergiftet war Fass ${state.poisonedBarrel + 1}.`,
                    `Vergleiche die kranken/gesunden Diener noch einmal mit der Spalte von Fass ${state.poisonedBarrel + 1}.`
                );
            }
        }

        renderAll();
    }

    function switchMode(modeId) {
        if (state.isSimulating || !MODES[modeId] || modeId === state.currentMode) return;
        state.currentMode = modeId;
        state.simActive = false;
        state.simSolvedGuess = false;

        const { label, barrels, servants } = getMode();
        setBanner(
            "neutral",
            "🍷",
            `${label} gewählt (${barrels} Fässer, ${servants} Diener)`,
            "Lege fest, welcher Diener aus welchen Fässern probiert, und spule dann 4 Tage vor."
        );
        renderAll();
    }

    // --- Event Listener ---
    modeButtons.forEach((btn) => {
        btn.addEventListener("click", () => switchMode(btn.dataset.mode));
    });

    clearPlanBtn.addEventListener("click", clearCurrentPlan);
    simulateBtn.addEventListener("click", startSimulation);

    themeBtn.addEventListener("click", () => {
        applyTheme(state.theme === "dark" ? "light" : "dark");
    });

    storyBtn.addEventListener("click", () => storyModal.classList.remove("hidden"));
    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-close-modal");
            document.getElementById(id).classList.add("hidden");
        });
    });
    storyModal.addEventListener("click", (e) => {
        if (e.target === storyModal) storyModal.classList.add("hidden");
    });

    // Start
    try {
        const savedTheme = localStorage.getItem("donnerkugeln-theme");
        applyTheme(savedTheme === "light" ? "light" : "dark");
    } catch (_) {
        applyTheme("dark");
    }
    renderAll();
})();
