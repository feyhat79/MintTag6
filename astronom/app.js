(() => {
    "use strict";

    const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

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

    // Reine Übungssätze (die echte Papier-Aufgabe kommt NICHT vor)
    const PRACTICE_POOLS = {
        gitter: [
            "STERN IM NORDEN",
            "SUCHE BEI NACHT",
            "BLICK ZUM MOND"
        ],
        caesar: [
            "IM WALD",
            "AM SEE",
            "DER TURM",
            "BEI NACHT"
        ],
        double: [
            "IM WALD AM SEE",
            "AM ALTEN TURM",
            "BEI DER EICHE",
            "UNTER DEM STEIN"
        ]
    };

    const LETTER_MAP = new Map();
    GRIDS.forEach((g) => {
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                const ch = g.rows[r][c];
                if (!ch) continue;
                LETTER_MAP.set(ch, {
                    letter: ch,
                    grid: g.id,
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
        tab: "train",
        stage: "gitter", // "gitter" | "caesar" | "double"
        poolIndex: { gitter: 0, caesar: 0, double: 0 },
        plainPhrase: "",
        caesarShift: 3, // Klartext + shift = Geheimtext
        midPhrase: "", // Nach Caesar-Verschiebung
        step1Solved: false,
        step1Slots: [], // [{ index, target, value, status }]
        step2Slots: [], // [{ index, target, value, status }]
        solvedStages: new Set(),
        wheelShift: 0, // Aktuelle Stellung der drehbaren Caesar-Scheibe (0..25)
        encodeShift: 3,
        hideEncodeMid: false,
        theme: "dark"
    };

    // DOM
    const themeBtn = document.getElementById("theme-btn");
    const storyBtn = document.getElementById("story-btn");
    const storyModal = document.getElementById("story-modal");

    const tabTrainBtn = document.getElementById("tab-train");
    const tabEncodeBtn = document.getElementById("tab-encode");
    const trainViewEl = document.getElementById("train-view");
    const encodeViewEl = document.getElementById("encode-view");

    const stageButtons = document.querySelectorAll(".stage-pill");
    const missionTitleEl = document.getElementById("mission-title");
    const missionDescEl = document.getElementById("mission-desc");
    const newPuzzleBtn = document.getElementById("new-puzzle-btn");
    const clearInputsBtn = document.getElementById("clear-inputs-btn");

    const step1CardEl = document.getElementById("step1-card");
    const step1PillEl = document.getElementById("step1-pill");
    const step1TitleEl = document.getElementById("step1-title");
    const step1WordsEl = document.getElementById("step1-words");
    const checkStep1Btn = document.getElementById("check-step1-btn");

    const step2CardEl = document.getElementById("step2-card");
    const step2WordsEl = document.getElementById("step2-words");
    const checkStep2Btn = document.getElementById("check-step2-btn");

    const trainFeedbackEl = document.getElementById("train-feedback");
    const trainFbIconEl = document.getElementById("train-fb-icon");
    const trainFbTextEl = document.getElementById("train-fb-text");

    const gridsPanelEl = document.getElementById("grids-panel");
    const gridsTrioEl = document.getElementById("grids-trio");

    const caesarPanelEl = document.getElementById("caesar-panel");
    const caesarSvgEl = document.getElementById("caesar-svg");
    const caesarLeftBtn = document.getElementById("caesar-left-btn");
    const caesarRightBtn = document.getElementById("caesar-right-btn");
    const caesarReadoutValEl = document.getElementById("caesar-readout-val");
    const caesarTestInputEl = document.getElementById("caesar-test-input");
    const caesarTestOutputEl = document.getElementById("caesar-test-output");
    const caesarTestHintEl = document.getElementById("caesar-test-hint");

    const encodeInputEl = document.getElementById("encode-input");
    const encodeShiftMinusBtn = document.getElementById("encode-shift-minus");
    const encodeShiftPlusBtn = document.getElementById("encode-shift-plus");
    const encodeShiftValEl = document.getElementById("encode-shift-val");
    const encodeMidTextEl = document.getElementById("encode-mid-text");
    const toggleMidBtn = document.getElementById("toggle-mid-btn");
    const encodeOutputEl = document.getElementById("encode-output");

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

    function setFeedback(variant, icon, text) {
        trainFeedbackEl.className = `feedback-bar ${variant}`;
        trainFbIconEl.textContent = icon;
        trainFbTextEl.textContent = text;
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

    function caesarShiftPhrase(phrase, shift) {
        const s = ((shift % 26) + 26) % 26;
        return [...phrase].map((ch) => {
            if (ch === " ") return " ";
            const idx = ALPHABET.indexOf(ch);
            if (idx === -1) return ch;
            return ALPHABET[(idx + s) % 26];
        }).join("");
    }

    function createPigpenSvg(letter, size = 36) {
        const info = LETTER_MAP.get(letter);
        if (!info) return "";

        const { walls, marker } = info;
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

    function buildSlots(phrase) {
        const slots = [];
        let idx = 0;
        for (const ch of phrase) {
            if (ch !== " ") {
                slots.push({
                    index: idx++,
                    target: ch,
                    value: "",
                    status: "neutral"
                });
            }
        }
        return slots;
    }

    function pickShiftForPuzzle(idx) {
        const shifts = [3, 4, 2, 5, 6];
        return shifts[idx % shifts.length];
    }

    function loadStage(stage, advanceExample = false) {
        state.stage = stage;
        if (caesarTestInputEl) caesarTestInputEl.value = "";
        const pool = PRACTICE_POOLS[stage];
        if (advanceExample) {
            state.poolIndex[stage] = (state.poolIndex[stage] + 1) % pool.length;
        }
        const idx = state.poolIndex[stage];
        state.plainPhrase = pool[idx];

        if (stage === "gitter") {
            state.caesarShift = 0;
            state.midPhrase = state.plainPhrase;
            state.step1Slots = buildSlots(state.plainPhrase);
            state.step2Slots = [];
            state.step1Solved = false;

            missionTitleEl.textContent = "Übung 1: Gitter-Code ablesen";
            missionDescEl.textContent = "Lies jedes Zeichen selbst in den 3 Gittern nach und tippe den Buchstaben ein.";
            step1PillEl.textContent = "Übung 1";
            step1TitleEl.textContent = "Entschlüssle die Gitter-Zeichen:";
            checkStep1Btn.innerHTML = '<span aria-hidden="true">🔍</span> Lösung prüfen';
            setFeedback("neutral", "🔭", "Achte auf die Wände rund um jeden Buchstaben sowie Punkt (•) und Kreis (°).");
        } else if (stage === "caesar") {
            state.caesarShift = pickShiftForPuzzle(idx);
            state.midPhrase = caesarShiftPhrase(state.plainPhrase, state.caesarShift);
            state.step1Slots = buildSlots(state.plainPhrase);
            state.step2Slots = [];
            state.step1Solved = false;
            state.wheelShift = 0;

            missionTitleEl.textContent = "Übung 2: Die Caesar-Scheibe";
            missionDescEl.textContent = "Drehe den inneren Ring der Caesar-Scheibe so lange, bis die Buchstaben ein deutsches Wort ergeben.";
            step1PillEl.textContent = "Übung 2";
            step1TitleEl.textContent = "Lies die Geheim-Buchstaben (außen) an der Scheibe ab und tippe den Klartext (innen) ein:";
            checkStep1Btn.innerHTML = '<span aria-hidden="true">🔍</span> Lösung prüfen';
            setFeedback("neutral", "⚙️", "Tipp: Stelle die Scheibe ein und teste, welche Buchstaben zusammenpassen!");
        } else {
            state.caesarShift = pickShiftForPuzzle(idx + 1);
            state.midPhrase = caesarShiftPhrase(state.plainPhrase, state.caesarShift);
            state.step1Slots = buildSlots(state.midPhrase);
            state.step2Slots = buildSlots(state.plainPhrase);
            state.step1Solved = false;
            state.wheelShift = 0;

            missionTitleEl.textContent = "Übung 3: Doppelte Verschlüsselung";
            missionDescEl.textContent = "Erst die Gitter-Zeichen ablesen – und danach den Buchstabensalat mit der Caesar-Scheibe knacken!";
            step1PillEl.textContent = "Schritt 1";
            step1TitleEl.textContent = "Lies zuerst alle Geheimzeichen aus den 3 Gittern ab:";
            checkStep1Btn.innerHTML = '<span aria-hidden="true">🔍</span> Schritt 1 prüfen';
            setFeedback("neutral", "🕵️", "Schritt 1: Übersetze alle Gitter-Zeichen. Noch keine Sorge, wenn die Buchstaben komisch aussehen!");
        }

        renderTrainView();
    }

    function renderWordInputs(containerEl, phrase, slots, mode, disabledAll) {
        containerEl.innerHTML = "";
        const words = phrase.split(" ");
        const cipherWords = state.midPhrase.split(" ");
        let cursor = 0;

        words.forEach((word, wIdx) => {
            const wordDiv = document.createElement("div");
            wordDiv.className = "cipher-word";

            for (let i = 0; i < word.length; i++) {
                const slot = slots[cursor++];
                const slotCard = document.createElement("div");
                slotCard.className = "cipher-slot";
                if (slot.status === "correct") slotCard.classList.add("correct");
                if (slot.status === "wrong") slotCard.classList.add("wrong");

                if (mode === "pigpen") {
                    const symBox = document.createElement("div");
                    symBox.className = "cipher-symbol-box";
                    symBox.innerHTML = createPigpenSvg(cipherWords[wIdx][i], 36);
                    slotCard.appendChild(symBox);
                } else {
                    const badge = document.createElement("div");
                    badge.className = "caesar-cipher-badge";
                    badge.textContent = cipherWords[wIdx][i];
                    slotCard.appendChild(badge);
                }

                const input = document.createElement("input");
                input.type = "text";
                input.maxLength = 1;
                input.className = "letter-input";
                input.value = slot.value;
                input.disabled = disabledAll;
                input.setAttribute("aria-label", `Buchstabe ${slot.index + 1}`);
                input.dataset.slotIndex = String(slot.index);

                input.addEventListener("input", (e) => {
                    const cleaned = normalizePhrase(e.target.value).replace(/\s/g, "");
                    const letter = cleaned.slice(-1);
                    slot.value = letter;
                    slot.status = "neutral";
                    e.target.value = letter;
                    slotCard.classList.remove("correct", "wrong");

                    if (letter) {
                        const next = containerEl.querySelector(`input[data-slot-index="${slot.index + 1}"]`);
                        if (next && !next.disabled) next.focus();
                    }
                });

                input.addEventListener("keydown", (e) => {
                    if (e.key === "Backspace" && !slot.value && slot.index > 0) {
                        const prev = containerEl.querySelector(`input[data-slot-index="${slot.index - 1}"]`);
                        if (prev && !prev.disabled) prev.focus();
                    }
                });

                slotCard.appendChild(input);
                wordDiv.appendChild(slotCard);
            }

            containerEl.appendChild(wordDiv);
        });
    }

    function renderStaticGrids() {
        gridsTrioEl.innerHTML = "";
        GRIDS.forEach((grid) => {
            const card = document.createElement("div");
            card.className = "pigpen-grid-card";

            const title = document.createElement("div");
            title.className = "grid-card-title";
            title.textContent = grid.title;
            card.appendChild(title);

            const ttt = document.createElement("div");
            ttt.className = "ttt-grid";

            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    const ch = grid.rows[r][c];
                    const cell = document.createElement("div");
                    cell.className = "grid-cell";
                    if (r > 0) cell.classList.add("wall-top");
                    if (c < 2) cell.classList.add("wall-right");
                    if (r < 2) cell.classList.add("wall-bottom");
                    if (c > 0) cell.classList.add("wall-left");

                    if (!ch) {
                        cell.classList.add("empty-cell");
                        cell.textContent = "·";
                    } else {
                        cell.innerHTML = `<span>${ch}</span>` +
                            (grid.markerLabel ? `<span class="cell-marker">${grid.markerLabel}</span>` : "");
                    }
                    ttt.appendChild(cell);
                }
            }

            card.appendChild(ttt);
            gridsTrioEl.appendChild(card);
        });
    }

    function buildCaesarWheelSvg() {
        const cx = 160;
        const cy = 160;
        const step = 360 / 26;

        let outerLetters = "";
        let innerLetters = "";
        let outerTicks = "";
        let innerTicks = "";

        for (let i = 0; i < 26; i++) {
            const angleDeg = i * step;
            const rad = (angleDeg - 90) * (Math.PI / 180);
            const tickRad = (angleDeg - step / 2 - 90) * (Math.PI / 180);

            // Outer ring letter (Geheimtext)
            const ox = cx + 131 * Math.cos(rad);
            const oy = cy + 131 * Math.sin(rad);
            outerLetters += `<text class="wheel-outer-text" x="${ox.toFixed(1)}" y="${oy.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="800" transform="rotate(${angleDeg.toFixed(1)} ${ox.toFixed(1)} ${oy.toFixed(1)})">${ALPHABET[i]}</text>`;

            const tx1 = cx + 114 * Math.cos(tickRad);
            const ty1 = cy + 114 * Math.sin(tickRad);
            const tx2 = cx + 148 * Math.cos(tickRad);
            const ty2 = cy + 148 * Math.sin(tickRad);
            outerTicks += `<line class="wheel-outer-divider" x1="${tx1.toFixed(1)}" y1="${ty1.toFixed(1)}" x2="${tx2.toFixed(1)}" y2="${ty2.toFixed(1)}" stroke-width="1"/>`;

            // Inner ring letter (Klartext)
            const ix = cx + 91 * Math.cos(rad);
            const iy = cy + 91 * Math.sin(rad);
            innerLetters += `<text class="wheel-inner-text" x="${ix.toFixed(1)}" y="${iy.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="900" transform="rotate(${angleDeg.toFixed(1)} ${ix.toFixed(1)} ${iy.toFixed(1)})">${ALPHABET[i]}</text>`;

            const ix1 = cx + 70 * Math.cos(tickRad);
            const iy1 = cy + 70 * Math.sin(tickRad);
            const ix2 = cx + 110 * Math.cos(tickRad);
            const iy2 = cy + 110 * Math.sin(tickRad);
            innerTicks += `<line class="wheel-inner-divider" x1="${ix1.toFixed(1)}" y1="${iy1.toFixed(1)}" x2="${ix2.toFixed(1)}" y2="${iy2.toFixed(1)}" stroke-width="1"/>`;
        }

        caesarSvgEl.innerHTML = `
            <circle class="wheel-outer-bg" cx="${cx}" cy="${cy}" r="150" stroke-width="2.5"/>
            <circle class="wheel-outer-divider" cx="${cx}" cy="${cy}" r="113" fill="none" stroke-width="1.5"/>
            ${outerTicks}
            ${outerLetters}
            <g id="caesar-inner-ring">
                <circle class="wheel-inner-bg" cx="${cx}" cy="${cy}" r="110" stroke-width="2.5"/>
                <circle class="wheel-inner-bg" cx="${cx}" cy="${cy}" r="70" fill="none" stroke-width="1.8"/>
                ${innerTicks}
                ${innerLetters}
            </g>
            <circle class="wheel-hub-bg" cx="${cx}" cy="${cy}" r="64" stroke-width="2"/>
            <text class="wheel-hub-sub" x="${cx}" y="${cy - 15}" text-anchor="middle" font-size="10.5" font-weight="700">AUSSEN = GEHEIM</text>
            <text class="wheel-hub-accent" x="${cx}" y="${cy + 2}" text-anchor="middle" font-size="10.5" font-weight="800">INNEN = KLAR</text>
            <text class="wheel-hub-pair" id="caesar-center-pair" x="${cx}" y="${cy + 24}" text-anchor="middle" font-size="14" font-weight="900">Klar A → A</text>
        `;
    }

    function updateCaesarTester() {
        if (!caesarTestInputEl || !caesarTestOutputEl) return;
        const raw = caesarTestInputEl.value;
        const hasSpace = /\s/.test(raw);
        const word = normalizePhrase(raw).replace(/\s+/g, "").slice(0, 10);
        caesarTestInputEl.value = word;
        if (caesarTestHintEl) {
            caesarTestHintEl.classList.toggle("hidden", !hasSpace);
        }
        if (!word) {
            caesarTestOutputEl.textContent = "–";
            return;
        }
        const s = ((state.wheelShift % 26) + 26) % 26;
        caesarTestOutputEl.textContent = caesarShiftPhrase(word, -s);
    }

    function updateCaesarWheelVisual() {
        const innerRing = document.getElementById("caesar-inner-ring");
        const centerPair = document.getElementById("caesar-center-pair");
        const s = ((state.wheelShift % 26) + 26) % 26;
        const deg = s * (360 / 26);

        if (innerRing) {
            innerRing.setAttribute("transform", `rotate(${deg.toFixed(2)} 160 160)`);
        }
        const cipherChar = ALPHABET[s];
        if (centerPair) {
            centerPair.textContent = `Klar A → ${cipherChar}`;
        }
        caesarReadoutValEl.textContent = `Klar A = Geheim ${cipherChar} (+${s})`;
        updateCaesarTester();
    }

    function setupCaesarWheelDrag() {
        let dragging = false;
        let startAngle = 0;
        let startShift = 0;

        function getPointerAngle(clientX, clientY) {
            const rect = caesarSvgEl.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
        }

        caesarSvgEl.addEventListener("pointerdown", (e) => {
            dragging = true;
            startAngle = getPointerAngle(e.clientX, e.clientY);
            startShift = state.wheelShift;
            if (typeof caesarSvgEl.setPointerCapture === "function") {
                caesarSvgEl.setPointerCapture(e.pointerId);
            }
        });

        caesarSvgEl.addEventListener("pointermove", (e) => {
            if (!dragging) return;
            const currentAngle = getPointerAngle(e.clientX, e.clientY);
            let diff = currentAngle - startAngle;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;
            const steps = Math.round(diff / (360 / 26));
            state.wheelShift = (((startShift + steps) % 26) + 26) % 26;
            updateCaesarWheelVisual();
        });

        const stopDrag = () => { dragging = false; };
        caesarSvgEl.addEventListener("pointerup", stopDrag);
        caesarSvgEl.addEventListener("pointercancel", stopDrag);
    }

    function renderStageBar() {
        stageButtons.forEach((btn) => {
            const st = btn.dataset.stage;
            btn.classList.toggle("active", st === state.stage);
            btn.classList.toggle("solved", state.solvedStages.has(st));
            const badge = document.getElementById(`badge-${st}`);
            if (badge) {
                const defaultNum = st === "gitter" ? "1" : st === "caesar" ? "2" : "3";
                badge.textContent = state.solvedStages.has(st) ? "✓" : defaultNum;
            }
        });
    }

    function renderTrainView() {
        renderStageBar();

        const showGrids = state.stage === "gitter" || state.stage === "double";
        const showCaesar = state.stage === "caesar" || state.stage === "double";
        gridsPanelEl.classList.toggle("hidden", !showGrids);
        caesarPanelEl.classList.toggle("hidden", !showCaesar);

        if (state.stage === "gitter") {
            renderWordInputs(step1WordsEl, state.plainPhrase, state.step1Slots, "pigpen", false);
            step2CardEl.classList.add("hidden");
        } else if (state.stage === "caesar") {
            renderWordInputs(step1WordsEl, state.plainPhrase, state.step1Slots, "caesar", false);
            step2CardEl.classList.add("hidden");
        } else {
            renderWordInputs(step1WordsEl, state.midPhrase, state.step1Slots, "pigpen", state.step1Solved);
            step2CardEl.classList.toggle("hidden", !state.step1Solved);
            if (state.step1Solved) {
                renderWordInputs(step2WordsEl, state.plainPhrase, state.step2Slots, "caesar", false);
            }
        }

        updateCaesarWheelVisual();
    }

    function checkSlots(slots, containerEl, phraseToShowOnSuccess) {
        const allFilled = slots.every((s) => Boolean(s.value));
        if (!allFilled) {
            const filledCount = slots.filter((s) => Boolean(s.value)).length;
            setFeedback(
                "warning",
                "✏️",
                `Bitte fülle zuerst alle Felder aus (bisher ${filledCount} von ${slots.length}).`
            );
            return false;
        }

        let correctCount = 0;
        slots.forEach((s) => {
            if (s.value === s.target) {
                s.status = "correct";
                correctCount++;
            } else {
                s.status = "wrong";
            }
        });

        const cards = containerEl.querySelectorAll(".cipher-slot");
        cards.forEach((card, idx) => {
            const st = slots[idx]?.status;
            card.classList.toggle("correct", st === "correct");
            card.classList.toggle("wrong", st === "wrong");
        });

        if (correctCount === slots.length) {
            return true;
        }

        setFeedback(
            "warning",
            "⚠️",
            `${correctCount} von ${slots.length} Buchstaben stimmen schon. Prüfe die rot markierten Felder noch einmal!`
        );
        return false;
    }

    function handleCheckStep1() {
        const ok = checkSlots(state.step1Slots, step1WordsEl, state.plainPhrase);
        if (!ok) return;

        if (state.stage === "gitter") {
            state.solvedStages.add("gitter");
            renderStageBar();
            setFeedback("success", "🎉", `Super! „${state.plainPhrase}“ stimmt genau. Weiter geht es mit Stufe 2 (Caesar-Scheibe)!`);
        } else if (state.stage === "caesar") {
            state.solvedStages.add("caesar");
            renderStageBar();
            setFeedback("success", "🎉", `Klasse! „${state.plainPhrase}“ mit Verschiebung +${state.caesarShift} geknackt! Probiere jetzt Stufe 3 (Doppel-Code).`);
        } else {
            state.step1Solved = true;
            renderTrainView();
            setFeedback(
                "success",
                "✨",
                `Schritt 1 stimmt („${state.midPhrase}“)! Aber das ist noch Kauderwelsch – knacke jetzt Schritt 2 mit der Caesar-Scheibe!`
            );
        }
    }

    function handleCheckStep2() {
        const ok = checkSlots(state.step2Slots, step2WordsEl, state.plainPhrase);
        if (!ok) return;

        state.solvedStages.add("double");
        renderStageBar();
        setFeedback(
            "success",
            "🏆",
            `Doppel-Code geknackt! Die Nachricht lautet „${state.plainPhrase}“ (Caesar +${state.caesarShift}). Jetzt bist du bereit für das Arbeitsblatt!`
        );
    }

    function renderEncodePreview() {
        const clean = normalizePhrase(encodeInputEl.value);
        encodeShiftValEl.textContent = `+${state.encodeShift}`;

        if (!clean) {
            encodeMidTextEl.textContent = "–";
            encodeOutputEl.innerHTML = '<span style="color: var(--text-muted); font-size: 0.9rem;">Tippe oben Buchstaben (A–Z) ein, um deine doppelt verschlüsselte Geheimschrift zu erzeugen.</span>';
            return;
        }

        const shifted = caesarShiftPhrase(clean, state.encodeShift);
        encodeMidTextEl.textContent = state.hideEncodeMid ? "••• (versteckt)" : shifted;

        encodeOutputEl.innerHTML = "";
        const words = shifted.split(" ");
        words.forEach((word) => {
            const wordWrap = document.createElement("div");
            wordWrap.className = "cipher-word";
            for (const ch of word) {
                const card = document.createElement("div");
                card.className = "encode-char-card";
                card.innerHTML = createPigpenSvg(ch, 40);
                wordWrap.appendChild(card);
            }
            encodeOutputEl.appendChild(wordWrap);
        });
    }

    function switchTab(tab) {
        state.tab = tab;
        const isTrain = tab === "train";
        tabTrainBtn.classList.toggle("active", isTrain);
        tabTrainBtn.setAttribute("aria-selected", String(isTrain));
        tabEncodeBtn.classList.toggle("active", !isTrain);
        tabEncodeBtn.setAttribute("aria-selected", String(!isTrain));
        trainViewEl.classList.toggle("hidden", !isTrain);
        encodeViewEl.classList.toggle("hidden", isTrain);
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

        tabTrainBtn.addEventListener("click", () => switchTab("train"));
        tabEncodeBtn.addEventListener("click", () => switchTab("encode"));

        stageButtons.forEach((btn) => {
            btn.addEventListener("click", () => loadStage(btn.dataset.stage, false));
        });

        newPuzzleBtn.addEventListener("click", () => loadStage(state.stage, true));
        clearInputsBtn.addEventListener("click", () => {
            state.step1Slots.forEach((s) => { s.value = ""; s.status = "neutral"; });
            state.step2Slots.forEach((s) => { s.value = ""; s.status = "neutral"; });
            state.step1Solved = false;
            setFeedback("neutral", "🔭", "Felder geleert. Starte von vorn!");
            renderTrainView();
        });

        checkStep1Btn.addEventListener("click", handleCheckStep1);
        checkStep2Btn.addEventListener("click", handleCheckStep2);

        caesarLeftBtn.addEventListener("click", () => {
            state.wheelShift = (state.wheelShift + 25) % 26;
            updateCaesarWheelVisual();
        });
        caesarRightBtn.addEventListener("click", () => {
            state.wheelShift = (state.wheelShift + 1) % 26;
            updateCaesarWheelVisual();
        });
        if (caesarTestInputEl) {
            caesarTestInputEl.addEventListener("input", updateCaesarTester);
        }

        encodeInputEl.addEventListener("input", renderEncodePreview);
        encodeShiftMinusBtn.addEventListener("click", () => {
            state.encodeShift = (state.encodeShift + 25) % 26;
            renderEncodePreview();
        });
        encodeShiftPlusBtn.addEventListener("click", () => {
            state.encodeShift = (state.encodeShift + 1) % 26;
            renderEncodePreview();
        });
        toggleMidBtn.addEventListener("click", () => {
            state.hideEncodeMid = !state.hideEncodeMid;
            toggleMidBtn.textContent = state.hideEncodeMid ? "Anzeigen" : "Verstecken";
            renderEncodePreview();
        });

        renderStaticGrids();
        buildCaesarWheelSvg();
        setupCaesarWheelDrag();
        setupModals();
        loadStage("gitter", false);
        renderEncodePreview();
    }

    init();
})();
