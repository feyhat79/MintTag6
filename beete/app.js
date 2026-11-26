(() => {
    "use strict";

    const PRESETS = {
        intro: {
            id: "intro",
            title: "Einstieg-Garten (3 × 4 Felder)",
            rows: 3,
            cols: 4,
            flowers: [
                [0, 0],
                [1, 2],
                [2, 0]
            ],
            optimal: 1
        },
        main: {
            id: "main",
            title: "Original-Garten (4 × 5 Felder)",
            rows: 4,
            cols: 5,
            flowers: [
                [0, 2],
                [1, 0],
                [1, 4],
                [2, 1],
                [3, 2]
            ],
            optimal: 2
        },
        random: {
            id: "random",
            title: "Zufalls-Garten (5 × 5 Felder)",
            rows: 5,
            cols: 5,
            flowers: [],
            optimal: 0
        }
    };

    const state = {
        currentMode: "main",
        sprinklers: new Set(),
        showRange: true,
        hoverKey: null,
        theme: "dark"
    };

    const themeBtn = document.getElementById("theme-btn");
    const storyBtn = document.getElementById("story-btn");
    const storyModal = document.getElementById("story-modal");

    const modeButtons = document.querySelectorAll(".mode-pill");
    const newRandomBtn = document.getElementById("new-random-btn");
    const clearBtn = document.getElementById("clear-btn");
    const toggleRangeInput = document.getElementById("toggle-range");

    const gardenTitleEl = document.getElementById("garden-title");
    const gardenGridEl = document.getElementById("garden-grid");

    const resultBannerEl = document.getElementById("result-banner");
    const resultIconEl = document.getElementById("result-icon");
    const resultTitleEl = document.getElementById("result-title");
    const resultDescEl = document.getElementById("result-desc");

    const sprinklerCountEl = document.getElementById("sprinkler-count");
    const wateredCountEl = document.getElementById("watered-count");
    const statusBadgeEl = document.getElementById("status-badge");

    function keyOf(r, c) {
        return `${r},${c}`;
    }

    function parseKey(key) {
        const [r, c] = key.split(",").map(Number);
        return { r, c };
    }

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
            // ignorieren
        }
    }

    function getLevel() {
        return PRESETS[state.currentMode];
    }

    function computeMinSprinklers(rows, cols, flowers) {
        const flowerMaskAll = (1 << flowers.length) - 1;
        if (flowerMaskAll === 0) return 0;

        const flowerSet = new Set(flowers.map(([r, c]) => keyOf(r, c)));
        const candidates = [];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (flowerSet.has(keyOf(r, c))) continue;
                let mask = 0;
                flowers.forEach(([fr, fc], idx) => {
                    if (Math.abs(fr - r) <= 1 && Math.abs(fc - c) <= 1) {
                        mask |= (1 << idx);
                    }
                });
                if (mask > 0) {
                    candidates.push(mask);
                }
            }
        }

        // Dominierte Kandidaten entfernen für maximale Geschwindigkeit
        const pruned = candidates.filter((m, i) =>
            !candidates.some((other, j) => j !== i && (other & m) === m && (other !== m || j < i))
        );
        pruned.sort((a, b) => popCount(b) - popCount(a));

        for (let limit = 1; limit <= flowers.length; limit++) {
            if (canCover(pruned, 0, 0, flowerMaskAll, limit)) {
                return limit;
            }
        }
        return flowers.length;
    }

    function popCount(n) {
        let count = 0;
        let v = n;
        while (v > 0) {
            v &= v - 1;
            count++;
        }
        return count;
    }

    function canCover(masks, startIdx, covered, target, remaining) {
        if (covered === target) return true;
        if (remaining === 0) return false;

        // Nächstes ungedecktes Blumenbeet wählen -> reduziert Verzweigung drastisch
        const missing = target & ~covered;
        const firstMissingBit = missing & -missing;

        for (let i = startIdx; i < masks.length; i++) {
            if ((masks[i] & firstMissingBit) === 0) continue;
            if (canCover(masks, i + 1, covered | masks[i], target, remaining - 1)) {
                return true;
            }
        }
        return false;
    }

    function generateRandomGarden() {
        const { rows, cols } = PRESETS.random;
        const allCoords = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                allCoords.push([r, c]);
            }
        }
        // Fisher-Yates
        for (let i = allCoords.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allCoords[i], allCoords[j]] = [allCoords[j], allCoords[i]];
        }

        const count = 6 + Math.floor(Math.random() * 2); // 6 oder 7 Beete
        const picked = allCoords.slice(0, count);
        PRESETS.random.flowers = picked;
        PRESETS.random.optimal = computeMinSprinklers(rows, cols, picked);
    }

    function getWateredSet() {
        const watered = new Set();
        const { rows, cols } = getLevel();
        state.sprinklers.forEach((key) => {
            const { r, c } = parseKey(key);
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                        watered.add(keyOf(nr, nc));
                    }
                }
            }
        });
        return watered;
    }

    function getPreviewSet() {
        const preview = new Set();
        if (!state.hoverKey) return preview;
        const { rows, cols } = getLevel();
        const { r, c } = parseKey(state.hoverKey);
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                    preview.add(keyOf(nr, nc));
                }
            }
        }
        return preview;
    }

    function createFlowerSvg() {
        return `<svg class="cell-svg" viewBox="0 0 64 64" aria-hidden="true">
            <ellipse class="flower-leaf" cx="32" cy="36" rx="22" ry="18" fill="#3f9142" stroke="#1e4620" stroke-width="2"/>
            <ellipse class="flower-leaf" cx="22" cy="28" rx="11" ry="9" fill="#52b74a"/>
            <ellipse class="flower-leaf" cx="42" cy="40" rx="12" ry="9" fill="#52b74a"/>
            <g class="flower-petals">
                <circle cx="22" cy="24" r="6" fill="#ef4444"/>
                <circle cx="22" cy="24" r="2.5" fill="#fde047"/>
                <circle cx="38" cy="24" r="6.5" fill="#a855f7"/>
                <circle cx="38" cy="24" r="2.6" fill="#fde047"/>
                <circle cx="30" cy="40" r="6.5" fill="#f97316"/>
                <circle cx="30" cy="40" r="2.6" fill="#fef08a"/>
                <circle cx="44" cy="40" r="5" fill="#3b82f6"/>
                <circle cx="44" cy="40" r="2" fill="#fef08a"/>
            </g>
        </svg>`;
    }

    function createSprinklerSvg() {
        return `<svg class="cell-svg" viewBox="0 0 64 64" aria-hidden="true">
            <g class="sprinkler-spray">
                <path d="M32 34 Q18 14 10 26" fill="none" stroke="#38bdf8" stroke-width="2.6" stroke-dasharray="3 3" stroke-linecap="round"/>
                <path d="M32 34 Q32 10 32 18" fill="none" stroke="#38bdf8" stroke-width="2.6" stroke-dasharray="3 3" stroke-linecap="round"/>
                <path d="M32 34 Q46 14 54 26" fill="none" stroke="#38bdf8" stroke-width="2.6" stroke-dasharray="3 3" stroke-linecap="round"/>
                <path d="M32 36 Q18 42 12 52" fill="none" stroke="#7dd3fc" stroke-width="2.2" stroke-dasharray="3 3" stroke-linecap="round"/>
                <path d="M32 36 Q46 42 52 52" fill="none" stroke="#7dd3fc" stroke-width="2.2" stroke-dasharray="3 3" stroke-linecap="round"/>
            </g>
            <path d="M22 48 H42 L39 43 H25 Z" fill="#1e293b" stroke="#0f172a" stroke-width="1.5"/>
            <rect x="29" y="33" width="6" height="11" rx="2" fill="#334155"/>
            <rect x="25" y="30" width="14" height="5" rx="2.5" fill="#0f172a"/>
        </svg>`;
    }

    function setBanner(variant, icon, title, desc) {
        resultBannerEl.className = `result-banner ${variant}`;
        resultIconEl.textContent = icon;
        resultTitleEl.textContent = title;
        resultDescEl.textContent = desc;
    }

    function renderGrid() {
        const level = getLevel();
        const flowerSet = new Set(level.flowers.map(([r, c]) => keyOf(r, c)));
        const watered = getWateredSet();
        const preview = getPreviewSet();

        gardenGridEl.style.gridTemplateColumns = `repeat(${level.cols}, auto)`;
        gardenGridEl.innerHTML = "";

        for (let r = 0; r < level.rows; r++) {
            for (let c = 0; c < level.cols; c++) {
                const k = keyOf(r, c);
                const isFlower = flowerSet.has(k);
                const hasSprinkler = state.sprinklers.has(k);
                const isWatered = watered.has(k);

                const cell = document.createElement("button");
                cell.type = "button";
                cell.className = "garden-cell";
                cell.dataset.key = k;
                cell.setAttribute("role", "gridcell");

                if (isFlower) {
                    cell.classList.add("is-flower", isWatered ? "flower-wet" : "flower-dry");
                    cell.setAttribute(
                        "aria-label",
                        `Zeile ${r + 1}, Spalte ${c + 1}: Blumenbeet (${isWatered ? "bewässert" : "trocken"})`
                    );
                    cell.innerHTML = createFlowerSvg() +
                        `<span class="water-badge" aria-hidden="true">${isWatered ? "💧" : "🥀"}</span>`;
                } else if (hasSprinkler) {
                    cell.classList.add("has-sprinkler");
                    cell.setAttribute("aria-label", `Zeile ${r + 1}, Spalte ${c + 1}: Rasensprenger entfernen`);
                    cell.innerHTML = createSprinklerSvg();
                } else {
                    cell.setAttribute("aria-label", `Zeile ${r + 1}, Spalte ${c + 1}: Rasensprenger setzen`);
                }

                if (state.showRange && isWatered && !hasSprinkler) {
                    cell.classList.add("is-watered");
                }
                if (preview.has(k) && !hasSprinkler) {
                    cell.classList.add("is-preview");
                }

                cell.addEventListener("click", () => handleCellClick(k, isFlower, cell));
                cell.addEventListener("mouseenter", () => {
                    if (!isFlower && state.hoverKey !== k) {
                        state.hoverKey = k;
                        updatePreviewHighlights();
                    }
                });
                cell.addEventListener("mouseleave", () => {
                    if (state.hoverKey === k) {
                        state.hoverKey = null;
                        updatePreviewHighlights();
                    }
                });

                gardenGridEl.appendChild(cell);
            }
        }
    }

    function updatePreviewHighlights() {
        const preview = getPreviewSet();
        gardenGridEl.querySelectorAll(".garden-cell").forEach((cell) => {
            const k = cell.dataset.key;
            if (preview.has(k) && !state.sprinklers.has(k)) {
                cell.classList.add("is-preview");
            } else {
                cell.classList.remove("is-preview");
            }
        });
    }

    function handleCellClick(k, isFlower, cellEl) {
        if (isFlower) {
            cellEl.classList.remove("shake");
            void cellEl.offsetWidth;
            cellEl.classList.add("shake");
            setBanner(
                "error",
                "🌸",
                "Hier wachsen schon Blumen!",
                "Auf Felder mit Blumen darf kein Rasensprenger gestellt werden. Wähle ein freies Erd-Feld daneben."
            );
            return;
        }

        if (state.sprinklers.has(k)) {
            state.sprinklers.delete(k);
        } else {
            state.sprinklers.add(k);
        }

        renderAll();
    }

    function updateStatusAndBanner() {
        const level = getLevel();
        const watered = getWateredSet();
        const totalFlowers = level.flowers.length;
        const wetFlowers = level.flowers.filter(([r, c]) => watered.has(keyOf(r, c))).length;
        const used = state.sprinklers.size;

        sprinklerCountEl.textContent = String(used);
        wateredCountEl.textContent = `${wetFlowers} / ${totalFlowers}`;

        if (used === 0) {
            statusBadgeEl.textContent = "Noch offen";
            setBanner(
                "neutral",
                "💧",
                "Setze deinen ersten Rasensprenger!",
                "Jeder Sprenger erreicht die 8 Felder direkt um sich herum – aber auf Blumenfeldern selbst darf kein Sprenger stehen."
            );
            return;
        }

        if (wetFlowers < totalFlowers) {
            const missing = totalFlowers - wetFlowers;
            statusBadgeEl.textContent = `Noch ${missing} trocken`;
            setBanner(
                "info",
                "🌱",
                `${wetFlowers} von ${totalFlowers} Beeten bewässert`,
                `Es fehlt noch Wasser bei ${missing === 1 ? "einem Blumenbeet" : `${missing} Blumenbeeten`}. Probiere weitere Plätze aus oder verschiebe einen Sprenger!`
            );
            return;
        }

        if (used === level.optimal) {
            statusBadgeEl.textContent = `Optimal (${used}) ✓`;
            setBanner(
                "success",
                "🎉",
                `Perfekt! Alle Blumen mit nur ${used} ${used === 1 ? "Rasensprenger" : "Rasensprengern"} bewässert!`,
                "Weniger Rasensprenger sind in diesem Garten nicht möglich – optimale Lösung gefunden!"
            );
        } else {
            statusBadgeEl.textContent = `Geht noch sparsamer (${used})`;
            setBanner(
                "info",
                "🤔",
                `Alle Blumen sind nass – aber es geht mit noch weniger!`,
                `Du hast ${used} Sprenger gesetzt. Überlege, wie du mit weniger Sprengern noch mehr Beete gleichzeitig triffst.`
            );
        }
    }

    function renderModeControls() {
        const level = getLevel();
        gardenTitleEl.textContent = level.title;
        newRandomBtn.classList.toggle("hidden", state.currentMode !== "random");

        modeButtons.forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.mode === state.currentMode);
        });
    }

    function renderAll() {
        renderModeControls();
        renderGrid();
        updateStatusAndBanner();
    }

    function switchMode(modeId) {
        if (!PRESETS[modeId] || modeId === state.currentMode) return;
        state.currentMode = modeId;
        state.sprinklers.clear();
        state.hoverKey = null;
        if (modeId === "random" && PRESETS.random.flowers.length === 0) {
            generateRandomGarden();
        }
        renderAll();
    }

    modeButtons.forEach((btn) => {
        btn.addEventListener("click", () => switchMode(btn.dataset.mode));
    });

    newRandomBtn.addEventListener("click", () => {
        generateRandomGarden();
        state.sprinklers.clear();
        state.hoverKey = null;
        renderAll();
    });

    clearBtn.addEventListener("click", () => {
        state.sprinklers.clear();
        renderAll();
    });

    toggleRangeInput.addEventListener("change", () => {
        state.showRange = toggleRangeInput.checked;
        renderGrid();
    });

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

    try {
        const savedTheme = localStorage.getItem("donnerkugeln-theme");
        applyTheme(savedTheme === "light" ? "light" : "dark");
    } catch (_) {
        applyTheme("dark");
    }
    renderAll();
})();
