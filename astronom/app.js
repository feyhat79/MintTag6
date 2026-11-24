(() => {
    "use strict";

    // Die 3 Gitter aus dem Dokument:
    // Gitter 0 (ohne Punkt): A-I
    // Gitter 1 (Punkt •):   J-R
    // Gitter 2 (Kreis °):   S-Z (Zelle 2,2 leer)
    const GRIDS = [
        {
            id: 0,
            title: "Gitter 1 (ohne Punkt)",
            marker: "none",
            markerLabel: "",
            rows: [
                ["A", "B", "C"],
                ["D", "E", "F"],
                ["G", "H", "I"]
            ]
        },
        {
            id: 1,
            title: "Gitter 2 (mit Punkt •)",
            marker: "dot",
            markerLabel: "•",
            rows: [
                ["J", "K", "L"],
                ["M", "N", "O"],
                ["P", "Q", "R"]
            ]
        },
        {
            id: 2,
            title: "Gitter 3 (mit Kreis °)",
            marker: "ring",
            markerLabel: "°",
            rows: [
                ["S", "T", "U"],
                ["V", "W", "X"],
                ["Y", "Z", ""]
            ]
        }
    ];

    const MISSIONS = {
        main: {
            id: "main",
            title: "Abgefangener Standort (Original-Notiz)",
            phrase: "IM KRATER IST ES"
        },
        bonus1: {
            id: "bonus1",
            title: "Bonus-Notiz 1 (Sternenkarte)",
            phrase: "BEI DER ALTEN EICHE"
        },
        bonus2: {
            id: "bonus2",
            title: "Bonus-Notiz 2 (Geheim-Koordinate)",
            phrase: "NORDLICH VOM TURM"
        }
    };

    // Map Buchstabe -> { grid, row, col, walls: { top, right, bottom, left }, marker }
    const LETTER_MAP = new Map();
    GRIDS.forEach((g) => {
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                const ch = g.rows[r][c];
                if (!ch) continue;
                LETTER_MAP.set(ch, {
                    letter: ch,
                    grid: g.id,
                    gridTitle: g.title,
                    row: r,
                    col: c,
                    marker: g.marker,
                    walls: {
                        top: r > 0,
                        right: c < 2,
                        bottom: r < 2,
                        left: c > 0
                    }
                });
            }
        }
    });

    const state = {
        tab: "decode", // "decode" | "encode"
        missionId: "main",
        phrase: MISSIONS.main.phrase,
        slots: [], // [{ index, targetLetter, value, status: "neutral"|"correct"|"wrong" }]
        selectedSlotIdx: 0,
        filter: "all",
        theme: "dark"
    };

    // DOM
    const themeBtn = document.getElementById("theme-btn");
    const storyBtn = document.getElementById("story-btn");
    const storyModal = document.getElementById("story-modal");

    const tabDecodeBtn = document.getElementById("tab-decode");
    const tabEncodeBtn = document.getElementById("tab-encode");
    const decodeViewEl = document.getElementById("decode-view");
    const encodeViewEl = document.getElementById("encode-view");

    const missionTitleEl = document.getElementById("mission-title");
    const modeButtons = document.querySelectorAll(".mode-pill");
    const clearInputsBtn = document.getElementById("clear-inputs-btn");
    const cipherWordsEl = document.getElementById("cipher-words");
    const checkMsgBtn = document.getElementById("check-msg-btn");
    const hintBtn = document.getElementById("hint-btn");
    const matchInfoEl = document.getElementById("match-info");
    const decodeFeedbackEl = document.getElementById("decode-feedback");
    const decodeFbIconEl = document.getElementById("decode-fb-icon");
    const decodeFbTextEl = document.getElementById("decode-fb-text");

    const filterPills = document.querySelectorAll(".filter-pill");
    const gridsTrioEl = document.getElementById("grids-trio");
    const inspTargetSvgEl = document.getElementById("insp-target-svg");
    const inspHoverSvgEl = document.getElementById("insp-hover-svg");
    const inspHoverLetterEl = document.getElementById("insp-hover-letter");
    const inspExplainEl = document.getElementById("insp-explain");

    const encodeInputEl = document.getElementById("encode-input");
    const encodeOutputEl = document.getElementById("encode-output");
    const startPartnerQuizBtn = document.getElementById("start-partner-quiz-btn");

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

    function setDecodeFeedback(variant, icon, text) {
        decodeFeedbackEl.className = `feedback-bar ${variant}`;
        decodeFbIconEl.textContent = icon;
        decodeFbTextEl.textContent = text;
    }

    function normalizePhrase(raw) {
        return raw
            .toUpperCase()
            .replace(/Ä/g, "AE")
            .replace(/Ö/g, "OE")
            .replace(/Ü/g, "UE")
            .replace(/ß/g, "SS")
            .replace(/[^A-Z ]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function createPigpenSvg(letter, size = 38) {
        const info = LETTER_MAP.get(letter);
        if (!info) return "";

        const { walls, marker } = info;
        // Wenn ein Punkt/Kreis rechts daneben sitzt, rücken wir das Kästchen etwas nach links
        const x1 = marker === "none" ? 13 : 8;
        const x2 = marker === "none" ? 35 : 28;
        const y1 = 13;
        const y2 = 35;

        const paths = [];
        if (walls.top) paths.push(`M ${x1} ${y1} H ${x2}`);
        if (walls.right) paths.push(`M ${x2} ${y1} V ${y2}`);
        if (walls.bottom) paths.push(`M ${x1} ${y2} H ${x2}`);
        if (walls.left) paths.push(`M ${x1} ${y1} V ${y2}`);

        let markerSvg = "";
        if (marker === "dot") {
            markerSvg = `<circle cx="37" cy="24" r="3.2" fill="currentColor"/>`;
        } else if (marker === "ring") {
            markerSvg = `<circle cx="37" cy="18" r="3.4" fill="none" stroke="currentColor" stroke-width="2.2"/>`;
        }

        return `<svg class="pigpen-svg" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true">
            <path d="${paths.join(" ")}" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="square" stroke-linejoin="miter"/>
            ${markerSvg}
        </svg>`;
    }

    function loadPhrase(phrase, title, missionId) {
        state.missionId = missionId;
        state.phrase = phrase;
        missionTitleEl.textContent = title;
        modeButtons.forEach((b) => b.classList.toggle("active", b.dataset.mission === missionId));

        state.slots = [];
        let slotIdx = 0;
        for (const ch of phrase) {
            if (ch !== " ") {
                state.slots.push({
                    index: slotIdx++,
                    target: ch,
                    value: "",
                    status: "neutral"
                });
            }
        }
        state.selectedSlotIdx = 0;

        setDecodeFeedback("neutral", "🔭", "Wähle ein Geheimzeichen aus und finde die passende Linienform in den 3 Gittern.");
        renderAllDecode();
    }

    function renderCipherWords() {
        cipherWordsEl.innerHTML = "";

        const activeTarget = state.slots[state.selectedSlotIdx]?.target || null;
        let sameCount = 0;
        if (activeTarget) {
            sameCount = state.slots.filter((s) => s.target === activeTarget).length;
        }
        matchInfoEl.textContent = activeTarget
            ? `Aktives Zeichen kommt ${sameCount}× in dieser Nachricht vor.`
            : "Tippe ein Zeichen an.";

        const words = state.phrase.split(" ");
        let cursor = 0;

        words.forEach((word) => {
            const wordDiv = document.createElement("div");
            wordDiv.className = "cipher-word";

            for (let i = 0; i < word.length; i++) {
                const slot = state.slots[cursor++];
                const isActive = slot.index === state.selectedSlotIdx;
                const isSame = activeTarget && slot.target === activeTarget && !isActive;

                const slotCard = document.createElement("div");
                slotCard.className = "cipher-slot";
                if (isActive) slotCard.classList.add("active");
                if (isSame) slotCard.classList.add("same-symbol");
                if (slot.status === "correct") slotCard.classList.add("correct");
                if (slot.status === "wrong") slotCard.classList.add("wrong");

                const symBox = document.createElement("div");
                symBox.className = "cipher-symbol-box";
                symBox.innerHTML = createPigpenSvg(slot.target, 38);

                const input = document.createElement("input");
                input.type = "text";
                input.maxLength = 1;
                input.className = "letter-input";
                input.value = slot.value;
                input.setAttribute("aria-label", `Geheimzeichen ${slot.index + 1}`);
                input.dataset.slotIndex = String(slot.index);

                slotCard.addEventListener("click", () => {
                    state.selectedSlotIdx = slot.index;
                    renderCipherWords();
                    updateTargetInspector();
                    const freshInput = cipherWordsEl.querySelector(`input[data-slot-index="${slot.index}"]`);
                    if (freshInput) freshInput.focus();
                });

                input.addEventListener("focus", () => {
                    if (state.selectedSlotIdx !== slot.index) {
                        state.selectedSlotIdx = slot.index;
                        updateSlotHighlights();
                        updateTargetInspector();
                    }
                });

                input.addEventListener("input", (e) => {
                    const cleaned = normalizePhrase(e.target.value).replace(/\s/g, "");
                    const letter = cleaned.slice(-1);
                    slot.value = letter;
                    slot.status = "neutral";
                    e.target.value = letter;
                    slotCard.classList.remove("correct", "wrong");

                    if (letter) {
                        jumpToNextSlot(slot.index);
                    }
                });

                input.addEventListener("keydown", (e) => {
                    if (e.key === "Backspace" && !slot.value && slot.index > 0) {
                        state.selectedSlotIdx = slot.index - 1;
                        renderCipherWords();
                        const prev = cipherWordsEl.querySelector(`input[data-slot-index="${state.selectedSlotIdx}"]`);
                        if (prev) prev.focus();
                    }
                });

                slotCard.appendChild(symBox);
                slotCard.appendChild(input);
                wordDiv.appendChild(slotCard);
            }

            cipherWordsEl.appendChild(wordDiv);
        });
    }

    function updateSlotHighlights() {
        const activeTarget = state.slots[state.selectedSlotIdx]?.target || null;
        const cards = cipherWordsEl.querySelectorAll(".cipher-slot");
        let sameCount = 0;

        cards.forEach((card, idx) => {
            const slot = state.slots[idx];
            const isActive = idx === state.selectedSlotIdx;
            const isSame = activeTarget && slot.target === activeTarget && !isActive;
            card.classList.toggle("active", isActive);
            card.classList.toggle("same-symbol", Boolean(isSame));
            if (activeTarget && slot.target === activeTarget) sameCount++;
        });

        matchInfoEl.textContent = activeTarget
            ? `Aktives Zeichen kommt ${sameCount}× in dieser Nachricht vor.`
            : "";
    }

    function jumpToNextSlot(fromIdx) {
        const nextEmpty = state.slots.find((s, idx) => idx > fromIdx && !s.value)
            || state.slots.find((s) => !s.value);
        if (nextEmpty) {
            state.selectedSlotIdx = nextEmpty.index;
        } else if (fromIdx + 1 < state.slots.length) {
            state.selectedSlotIdx = fromIdx + 1;
        }
        renderCipherWords();
        updateTargetInspector();
        const input = cipherWordsEl.querySelector(`input[data-slot-index="${state.selectedSlotIdx}"]`);
        if (input) input.focus();
    }

    function updateTargetInspector() {
        const target = state.slots[state.selectedSlotIdx]?.target;
        inspTargetSvgEl.innerHTML = target ? createPigpenSvg(target, 46) : "";
    }

    function previewGridCell(letter) {
        if (!letter) {
            inspHoverSvgEl.innerHTML = "";
            inspHoverLetterEl.textContent = "–";
            return;
        }
        const info = LETTER_MAP.get(letter);
        inspHoverSvgEl.innerHTML = createPigpenSvg(letter, 46);
        inspHoverLetterEl.textContent = letter + (info.marker === "dot" ? " •" : info.marker === "ring" ? " °" : "");
        const wallNames = [];
        if (info.walls.top) wallNames.push("oben");
        if (info.walls.right) wallNames.push("rechts");
        if (info.walls.bottom) wallNames.push("unten");
        if (info.walls.left) wallNames.push("links");
        const markTxt = info.marker === "none" ? "ohne Punkt" : info.marker === "dot" ? "mit Punkt •" : "mit Kreis °";
        inspExplainEl.textContent = `${letter} hat Wände ${wallNames.join(", ")} (${markTxt}).`;
    }

    function renderGrids() {
        gridsTrioEl.innerHTML = "";
        GRIDS.forEach((grid) => {
            const card = document.createElement("div");
            card.className = "pigpen-grid-card";
            if (state.filter !== "all" && Number(state.filter) !== grid.id) {
                card.classList.add("dimmed");
            }

            const title = document.createElement("div");
            title.className = "grid-card-title";
            title.textContent = grid.title;
            card.appendChild(title);

            const ttt = document.createElement("div");
            ttt.className = "ttt-grid";

            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    const ch = grid.rows[r][c];
                    const btn = document.createElement("button");
                    btn.type = "button";
                    btn.className = "grid-cell";
                    if (r > 0) btn.classList.add("wall-top");
                    if (c < 2) btn.classList.add("wall-right");
                    if (r < 2) btn.classList.add("wall-bottom");
                    if (c > 0) btn.classList.add("wall-left");

                    if (!ch) {
                        btn.classList.add("empty-cell");
                        btn.disabled = true;
                        btn.textContent = "·";
                    } else {
                        btn.innerHTML = `<span>${ch}</span>` +
                            (grid.markerLabel ? `<span class="cell-marker">${grid.markerLabel}</span>` : "");
                        btn.setAttribute("aria-label", `Buchstabe ${ch} aus ${grid.title}`);

                        btn.addEventListener("mouseenter", () => previewGridCell(ch));
                        btn.addEventListener("focus", () => previewGridCell(ch));
                        btn.addEventListener("click", () => {
                            previewGridCell(ch);
                            const activeSlot = state.slots[state.selectedSlotIdx];
                            if (!activeSlot) return;
                            activeSlot.value = ch;
                            activeSlot.status = "neutral";
                            jumpToNextSlot(activeSlot.index);
                        });
                    }
                    ttt.appendChild(btn);
                }
            }

            card.appendChild(ttt);
            gridsTrioEl.appendChild(card);
        });
    }

    function renderAllDecode() {
        renderCipherWords();
        renderGrids();
        updateTargetInspector();
    }

    function checkSolution() {
        let allFilled = true;
        let correctCount = 0;

        state.slots.forEach((slot) => {
            if (!slot.value) {
                allFilled = false;
                slot.status = "neutral";
            } else if (slot.value === slot.target) {
                slot.status = "correct";
                correctCount++;
            } else {
                slot.status = "wrong";
            }
        });

        renderCipherWords();

        if (correctCount === state.slots.length) {
            setDecodeFeedback(
                "success",
                "🎉",
                `Volltreffer! Die entschlüsselte Geheimbotschaft lautet: „${state.phrase}“!`
            );
        } else if (!allFilled) {
            setDecodeFeedback(
                "warning",
                "🕵️",
                `Es fehlen noch Buchstaben (${correctCount} von ${state.slots.length} bisher richtig). Grüne Felder stimmen schon!`
            );
        } else {
            setDecodeFeedback(
                "warning",
                "⚠️",
                `${correctCount} von ${state.slots.length} Buchstaben stimmen. Prüfe die rot markierten Felder noch einmal in den Gittern!`
            );
        }
    }

    function giveHint() {
        const candidate = state.slots.find((s) => s.value !== s.target);
        if (!candidate) {
            setDecodeFeedback("success", "✨", "Du hast bereits alle Buchstaben richtig gelöst!");
            return;
        }
        candidate.value = candidate.target;
        candidate.status = "correct";
        state.selectedSlotIdx = candidate.index;

        const info = LETTER_MAP.get(candidate.target);
        previewGridCell(candidate.target);
        setDecodeFeedback(
            "neutral",
            "💡",
            `Tipp: Zeichen #${candidate.index + 1} ist „${candidate.target}“ (aus ${info.gridTitle}).`
        );
        renderCipherWords();
        updateTargetInspector();
    }

    function renderEncodePreview() {
        const clean = normalizePhrase(encodeInputEl.value);
        encodeOutputEl.innerHTML = "";

        if (!clean) {
            encodeOutputEl.innerHTML = '<span style="color: var(--text-muted); font-size: 0.9rem;">Tippe oben Buchstaben (A–Z) ein, um deine Geheimschrift zu sehen.</span>';
            return;
        }

        const words = clean.split(" ");
        words.forEach((word) => {
            const wordWrap = document.createElement("div");
            wordWrap.className = "cipher-word";
            for (const ch of word) {
                const card = document.createElement("div");
                card.className = "encode-char-card";
                card.innerHTML = `${createPigpenSvg(ch, 38)}<span class="encode-char-label">${ch}</span>`;
                wordWrap.appendChild(card);
            }
            encodeOutputEl.appendChild(wordWrap);
        });
    }

    function switchTab(tab) {
        state.tab = tab;
        const isDecode = tab === "decode";
        tabDecodeBtn.classList.toggle("active", isDecode);
        tabDecodeBtn.setAttribute("aria-selected", String(isDecode));
        tabEncodeBtn.classList.toggle("active", !isDecode);
        tabEncodeBtn.setAttribute("aria-selected", String(!isDecode));
        decodeViewEl.classList.toggle("hidden", !isDecode);
        encodeViewEl.classList.toggle("hidden", isDecode);
    }

    function setupModals() {
        storyBtn.addEventListener("click", () => storyModal.classList.remove("hidden"));
        document.querySelectorAll("[data-close-modal]").forEach((btn) => {
            btn.addEventListener("click", () => {
                document.getElementById(btn.dataset.closeModal).classList.add("hidden");
            });
        });
        storyModal.addEventListener("click", (e) => {
            if (e.target === storyModal) storyModal.classList.add("hidden");
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") storyModal.classList.add("hidden");
        });
    }

    function init() {
        let savedTheme = "dark";
        try {
            savedTheme = localStorage.getItem("donnerkugeln-theme") || "dark";
        } catch (_) {
            savedTheme = "dark";
        }
        applyTheme(savedTheme);

        themeBtn.addEventListener("click", () => {
            applyTheme(state.theme === "dark" ? "light" : "dark");
        });

        tabDecodeBtn.addEventListener("click", () => switchTab("decode"));
        tabEncodeBtn.addEventListener("click", () => switchTab("encode"));

        modeButtons.forEach((btn) => {
            btn.addEventListener("click", () => {
                const m = MISSIONS[btn.dataset.mission];
                if (m) loadPhrase(m.phrase, m.title, m.id);
            });
        });

        filterPills.forEach((pill) => {
            pill.addEventListener("click", () => {
                state.filter = pill.dataset.filter;
                filterPills.forEach((p) => p.classList.toggle("active", p === pill));
                renderGrids();
            });
        });

        clearInputsBtn.addEventListener("click", () => {
            state.slots.forEach((s) => {
                s.value = "";
                s.status = "neutral";
            });
            state.selectedSlotIdx = 0;
            setDecodeFeedback("neutral", "🔭", "Felder geleert. Starte von vorn!");
            renderCipherWords();
            updateTargetInspector();
        });

        checkMsgBtn.addEventListener("click", checkSolution);
        hintBtn.addEventListener("click", giveHint);

        encodeInputEl.addEventListener("input", renderEncodePreview);
        startPartnerQuizBtn.addEventListener("click", () => {
            const clean = normalizePhrase(encodeInputEl.value);
            if (!clean) {
                encodeInputEl.focus();
                return;
            }
            switchTab("decode");
            loadPhrase(clean, "Partner-Rätsel (Eigene Notiz)", "custom");
        });

        setupModals();
        loadPhrase(MISSIONS.main.phrase, MISSIONS.main.title, "main");
        renderEncodePreview();
    }

    init();
})();
