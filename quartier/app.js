(() => {
    "use strict";

    const COLORS = ["green", "red", "blue"];
    const COLOR_LABELS = {
        green: "Hellgrün",
        red: "Rot",
        blue: "Dunkelblau",
        white: "Weiß"
    };
    const COLOR_HEX = {
        green: "#6df26b",
        red: "#f2291b",
        blue: "#0e198f",
        white: "#ffffff"
    };

    const PRESETS = {
        intro: {
            id: "intro",
            title: "Einstieg-Straße (2 × 3 Häuser)",
            cols: 3,
            shapes: [
                ["gable", "low-gable", "tall-gable"],
                ["trap", "tall-gable", "flat"]
            ],
            fixed: [
                ["red", null, "blue"],
                ["blue", null, null]
            ]
        },
        main: {
            id: "main",
            title: "Original-Quartier (2 × 5 Häuser)",
            cols: 5,
            shapes: [
                ["gable", "low-gable", "tall-gable", "tall-gable", "flat"],
                ["trap", "tall-gable", "flat", "tall-gable", "gable"]
            ],
            fixed: [
                ["red", null, "blue", null, "green"],
                ["blue", null, null, null, "red"]
            ]
        },
        random: {
            id: "random",
            title: "Zufalls-Straße (2 × 6 Häuser)",
            cols: 6,
            shapes: [
                ["gable", "low-gable", "tall-gable", "flat", "gable", "tall-gable"],
                ["trap", "tall-gable", "flat", "gable", "trap", "flat"]
            ],
            fixed: [
                [null, null, null, null, null, null],
                [null, null, null, null, null, null]
            ]
        }
    };

    function cloneGrid(grid) {
        return grid.map((row) => [...row]);
    }

    const state = {
        currentMode: "main",
        selectedColor: "green",
        showCandidates: false,
        grids: {
            intro: cloneGrid(PRESETS.intro.fixed),
            main: cloneGrid(PRESETS.main.fixed),
            random: cloneGrid(PRESETS.random.fixed)
        },
        theme: "dark"
    };

    const themeBtn = document.getElementById("theme-btn");
    const storyBtn = document.getElementById("story-btn");
    const storyModal = document.getElementById("story-modal");

    const modeButtons = document.querySelectorAll(".mode-pill");
    const paintButtons = document.querySelectorAll(".paint-btn");
    const newRandomBtn = document.getElementById("new-random-btn");
    const clearBtn = document.getElementById("clear-btn");
    const toggleCandidatesInput = document.getElementById("toggle-candidates");

    const streetTitleEl = document.getElementById("street-title");
    const streetStageEl = document.getElementById("street-stage");
    const rowTopEl = document.getElementById("row-top");
    const rowBottomEl = document.getElementById("row-bottom");
    const conflictOverlayEl = document.getElementById("conflict-overlay");

    const resultBannerEl = document.getElementById("result-banner");
    const resultIconEl = document.getElementById("result-icon");
    const resultTitleEl = document.getElementById("result-title");
    const resultDescEl = document.getElementById("result-desc");

    const paintedCountEl = document.getElementById("painted-count");
    const conflictCountEl = document.getElementById("conflict-count");
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
            // ignorieren
        }
    }

    function getLevel() {
        return PRESETS[state.currentMode];
    }

    function getGrid() {
        return state.grids[state.currentMode];
    }

    function generateRandomStreet() {
        const cols = PRESETS.random.cols;
        // Gültige 2xN 3-Färbung zeilen-/spaltenweise zufällig generieren
        const solution = [Array(cols).fill(null), Array(cols).fill(null)];
        for (let c = 0; c < cols; c++) {
            const forbiddenTop = c > 0 ? [solution[0][c - 1]] : [];
            const optsTop = COLORS.filter((col) => !forbiddenTop.includes(col));
            solution[0][c] = optsTop[Math.floor(Math.random() * optsTop.length)];

            const forbiddenBot = [solution[0][c]];
            if (c > 0) forbiddenBot.push(solution[1][c - 1]);
            const optsBot = COLORS.filter((col) => !forbiddenBot.includes(col));
            solution[1][c] = optsBot[Math.floor(Math.random() * optsBot.length)];
        }

        // Einige Häuser als feste Vorgaben stehen lassen (ca. 4-5 Stück)
        const fixed = [Array(cols).fill(null), Array(cols).fill(null)];
        const coords = [];
        for (let r = 0; r < 2; r++) {
            for (let c = 0; c < cols; c++) {
                coords.push([r, c]);
            }
        }
        for (let i = coords.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [coords[i], coords[j]] = [coords[j], coords[i]];
        }
        const fixedCount = 5;
        for (let i = 0; i < fixedCount; i++) {
            const [r, c] = coords[i];
            fixed[r][c] = solution[r][c];
        }

        PRESETS.random.fixed = fixed;
        state.grids.random = cloneGrid(fixed);
    }

    function findConflicts(grid, cols) {
        const conflicts = [];
        for (let r = 0; r < 2; r++) {
            for (let c = 0; c < cols - 1; c++) {
                const a = grid[r][c];
                const b = grid[r][c + 1];
                if (a && b && a === b) {
                    conflicts.push({
                        type: "neighbor",
                        a: [r, c],
                        b: [r, c + 1],
                        color: a
                    });
                }
            }
        }
        for (let c = 0; c < cols; c++) {
            const top = grid[0][c];
            const bot = grid[1][c];
            if (top && bot && top === bot) {
                conflicts.push({
                    type: "opposite",
                    a: [0, c],
                    b: [1, c],
                    color: top
                });
            }
        }
        return conflicts;
    }

    function getAllowedColors(grid, cols, r, c) {
        const used = new Set();
        if (c > 0 && grid[r][c - 1]) used.add(grid[r][c - 1]);
        if (c < cols - 1 && grid[r][c + 1]) used.add(grid[r][c + 1]);
        const otherRow = r === 0 ? 1 : 0;
        if (grid[otherRow][c]) used.add(grid[otherRow][c]);
        return COLORS.filter((col) => !used.has(col));
    }

    function createHouseSvg(shape, color, isWhiteEditable, row) {
        const fill = color ? COLOR_HEX[color] : COLOR_HEX.white;
        const isDark = color === "blue";
        const stroke = "#1e2433";
        const windowOrDoor = row === 0
            ? `<rect x="26" y="56" width="16" height="24" fill="#6b5038" stroke="${stroke}" stroke-width="1.8"/>`
            : `<rect x="24" y="54" width="22" height="16" fill="#0ea5e9" stroke="${stroke}" stroke-width="1.8"/>`;

        let bodyPath = "";
        if (shape === "gable") {
            bodyPath = `<polygon points="10,46 45,14 80,46" fill="${fill}" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round"/>
                        <rect x="18" y="46" width="54" height="34" fill="${fill}" stroke="${stroke}" stroke-width="2.4"/>`;
        } else if (shape === "low-gable") {
            bodyPath = `<polygon points="12,50 45,24 78,50" fill="${fill}" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round"/>
                        <rect x="18" y="50" width="54" height="30" fill="${fill}" stroke="${stroke}" stroke-width="2.4"/>`;
        } else if (shape === "tall-gable") {
            bodyPath = `<polygon points="14,46 45,6 76,46" fill="${fill}" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round"/>
                        <rect x="19" y="46" width="52" height="34" fill="${fill}" stroke="${stroke}" stroke-width="2.4"/>`;
        } else if (shape === "flat") {
            bodyPath = `<rect x="11" y="34" width="68" height="14" fill="${fill}" stroke="${stroke}" stroke-width="2.4"/>
                        <rect x="17" y="48" width="56" height="32" fill="${fill}" stroke="${stroke}" stroke-width="2.4"/>`;
        } else {
            // trap (Trapezdach)
            bodyPath = `<polygon points="10,48 18,30 72,30 80,48" fill="${fill}" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round"/>
                        <rect x="16" y="48" width="58" height="32" fill="${fill}" stroke="${stroke}" stroke-width="2.4"/>`;
        }

        const ladder = isWhiteEditable
            ? `<g stroke="#334155" stroke-width="1.7" stroke-linecap="round">
                   <line x1="56" y1="44" x2="62" y2="80"/>
                   <line x1="65" y1="44" x2="71" y2="80"/>
                   <line x1="57" y1="51" x2="66" y2="51"/>
                   <line x1="58" y1="59" x2="67" y2="59"/>
                   <line x1="59" y1="67" x2="68" y2="67"/>
                   <line x1="60" y1="74" x2="69" y2="74"/>
               </g>
               <rect x="69" y="72" width="7" height="7" rx="1" fill="#cbd5e1" stroke="${stroke}" stroke-width="1.2"/>`
            : "";

        const highlight = isDark
            ? `<circle cx="72" cy="70" r="2" fill="rgba(255,255,255,0.2)"/>`
            : "";

        return `<svg class="house-svg" viewBox="0 0 90 86" aria-hidden="true">
            ${bodyPath}
            ${windowOrDoor}
            ${ladder}
            ${highlight}
        </svg>`;
    }

    function setBanner(variant, icon, title, desc) {
        resultBannerEl.className = `result-banner ${variant}`;
        resultIconEl.textContent = icon;
        resultTitleEl.textContent = title;
        resultDescEl.textContent = desc;
    }

    function renderStreet() {
        const level = getLevel();
        const grid = getGrid();
        const conflicts = findConflicts(grid, level.cols);

        const conflictKeys = new Set();
        conflicts.forEach((cf) => {
            conflictKeys.add(`${cf.a[0]},${cf.a[1]}`);
            conflictKeys.add(`${cf.b[0]},${cf.b[1]}`);
        });

        rowTopEl.innerHTML = "";
        rowBottomEl.innerHTML = "";

        for (let r = 0; r < 2; r++) {
            const targetRow = r === 0 ? rowTopEl : rowBottomEl;
            for (let c = 0; c < level.cols; c++) {
                const isFixed = level.fixed[r][c] !== null;
                const color = grid[r][c];
                const shape = level.shapes[r][c];
                const hasConflict = conflictKeys.has(`${r},${c}`);

                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "house-btn";
                btn.dataset.row = String(r);
                btn.dataset.col = String(c);

                if (isFixed) btn.classList.add("is-locked");
                if (hasConflict) btn.classList.add("has-conflict");

                const rowLabel = r === 0 ? "Oben" : "Unten";
                const colorName = color ? COLOR_LABELS[color] : "Weiß (noch frei)";
                btn.setAttribute(
                    "aria-label",
                    `Haus ${rowLabel} ${c + 1}: ${colorName}${isFixed ? " (fest vorgegeben)" : ""}`
                );

                let metaHtml = `<span class="house-coord">${r === 0 ? "O" : "U"}${c + 1}</span>`;
                if (isFixed) {
                    metaHtml += `<span class="lock-pill" title="Fest vorgegeben" aria-hidden="true">🔒</span>`;
                } else if (state.showCandidates && !color) {
                    const allowed = getAllowedColors(grid, level.cols, r, c);
                    const dots = allowed.length > 0
                        ? allowed.map((col) => `<span class="cand-dot ${col}" title="${COLOR_LABELS[col]}"></span>`).join("")
                        : `<span class="cand-none">✕</span>`;
                    metaHtml += `<span class="candidates-dots" aria-hidden="true">${dots}</span>`;
                }

                btn.innerHTML =
                    createHouseSvg(shape, color, !isFixed && !color, r) +
                    `<div class="house-meta">${metaHtml}</div>`;

                btn.addEventListener("click", () => handleHouseClick(r, c, isFixed, btn));
                targetRow.appendChild(btn);
            }
        }

        requestAnimationFrame(() => drawConflictLines(conflicts));
    }

    function drawConflictLines(conflicts) {
        const stageRect = streetStageEl.getBoundingClientRect();
        conflictOverlayEl.setAttribute("viewBox", `0 0 ${stageRect.width} ${stageRect.height}`);
        conflictOverlayEl.innerHTML = "";

        conflicts.forEach((cf) => {
            const elA = streetStageEl.querySelector(`.house-btn[data-row="${cf.a[0]}"][data-col="${cf.a[1]}"]`);
            const elB = streetStageEl.querySelector(`.house-btn[data-row="${cf.b[0]}"][data-col="${cf.b[1]}"]`);
            if (!elA || !elB) return;

            const rA = elA.getBoundingClientRect();
            const rB = elB.getBoundingClientRect();
            const x1 = rA.left - stageRect.left + rA.width / 2;
            const y1 = rA.top - stageRect.top + rA.height / 2;
            const x2 = rB.left - stageRect.left + rB.width / 2;
            const y2 = rB.top - stageRect.top + rB.height / 2;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;

            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", String(x1));
            line.setAttribute("y1", String(y1));
            line.setAttribute("x2", String(x2));
            line.setAttribute("y2", String(y2));
            line.setAttribute("class", "conflict-line");

            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", String(mx));
            circle.setAttribute("cy", String(my));
            circle.setAttribute("r", "11");
            circle.setAttribute("class", "conflict-badge-bg");

            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", String(mx));
            text.setAttribute("y", String(my));
            text.setAttribute("class", "conflict-badge-text");
            text.textContent = "!";

            conflictOverlayEl.append(line, circle, text);
        });
    }

    function handleHouseClick(r, c, isFixed, btnEl) {
        if (isFixed) {
            btnEl.classList.remove("shake");
            void btnEl.offsetWidth;
            btnEl.classList.add("shake");
            setBanner(
                "info",
                "🔒",
                "Dieses Haus ist schon fertig angemalt!",
                "Häuser mit Schloss 🔒 wurden bereits von ihren Anwohnern gestrichen und bleiben so. Male nur die übrigen Häuser an."
            );
            return;
        }

        const grid = getGrid();
        if (state.selectedColor === "white") {
            grid[r][c] = null;
        } else if (grid[r][c] === state.selectedColor) {
            grid[r][c] = null;
        } else {
            grid[r][c] = state.selectedColor;
        }

        renderAll();
    }

    function updateStatusAndBanner() {
        const level = getLevel();
        const grid = getGrid();
        const total = level.cols * 2;
        let painted = 0;

        for (let r = 0; r < 2; r++) {
            for (let c = 0; c < level.cols; c++) {
                if (grid[r][c] !== null) painted++;
            }
        }

        const conflicts = findConflicts(grid, level.cols);
        paintedCountEl.textContent = `${painted} / ${total}`;
        conflictCountEl.textContent = String(conflicts.length);

        if (conflicts.length > 0) {
            const first = conflicts[0];
            const nameA = `${first.a[0] === 0 ? "Oben" : "Unten"} ${first.a[1] + 1}`;
            const nameB = `${first.b[0] === 0 ? "Oben" : "Unten"} ${first.b[1] + 1}`;
            const relation = first.type === "opposite"
                ? "stehen sich direkt gegenüber"
                : "stehen direkt nebeneinander";

            statusBadgeEl.textContent = `${conflicts.length} ${conflicts.length === 1 ? "Konflikt" : "Konflikte"}`;
            setBanner(
                "error",
                "⚠️",
                `Regelverstoß: ${nameA} und ${nameB} sind beide ${COLOR_LABELS[first.color]}!`,
                `Die Häuser ${nameA} und ${nameB} ${relation} und dürfen daher nicht dieselbe Farbe haben.`
            );
            return;
        }

        if (painted === total) {
            statusBadgeEl.textContent = "Gelöst ✓";
            setBanner(
                "success",
                "🎉",
                "Klasse! Alle Häuser sind regelkonform angemalt!",
                "Keine Nachbarn und keine gegenüberliegenden Häuser haben dieselbe Farbe."
            );
            return;
        }

        const remaining = total - painted;
        statusBadgeEl.textContent = `Noch ${remaining} weiß`;
        setBanner(
            "neutral",
            "🎨",
            `Noch ${remaining} ${remaining === 1 ? "weißes Haus" : "weiße Häuser"} übrig`,
            "Bisher passt alles ohne Konflikt! Wähle eine Farbe und tippe auf das nächste weiße Haus."
        );
    }

    function renderModeControls() {
        const level = getLevel();
        streetTitleEl.textContent = level.title;
        newRandomBtn.classList.toggle("hidden", state.currentMode !== "random");

        modeButtons.forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.mode === state.currentMode);
        });

        paintButtons.forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.color === state.selectedColor);
        });
    }

    function renderAll() {
        renderModeControls();
        renderStreet();
        updateStatusAndBanner();
    }

    function switchMode(modeId) {
        if (!PRESETS[modeId] || modeId === state.currentMode) return;
        state.currentMode = modeId;
        if (modeId === "random" && PRESETS.random.fixed[0].every((x) => x === null)) {
            generateRandomStreet();
        }
        renderAll();
    }

    modeButtons.forEach((btn) => {
        btn.addEventListener("click", () => switchMode(btn.dataset.mode));
    });

    paintButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            state.selectedColor = btn.dataset.color;
            renderModeControls();
        });
    });

    newRandomBtn.addEventListener("click", () => {
        generateRandomStreet();
        renderAll();
    });

    clearBtn.addEventListener("click", () => {
        state.grids[state.currentMode] = cloneGrid(getLevel().fixed);
        renderAll();
    });

    toggleCandidatesInput.addEventListener("change", () => {
        state.showCandidates = toggleCandidatesInput.checked;
        renderStreet();
    });

    window.addEventListener("resize", () => {
        const level = getLevel();
        const conflicts = findConflicts(getGrid(), level.cols);
        drawConflictLines(conflicts);
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
