(() => {
    "use strict";

    const SIMPLE_5 = [3, 1, 5, 2, 4];
    const MEDIUM_7 = [4, 2, 7, 1, 6, 3, 5];
    const EXAM_FORBIDDEN = "7,4,2,10,8,9,5,3,1,6";

    const state = {
        mode: "simple5",
        initialCards: [...SIMPLE_5],
        segments: [], // [{ type: "done", value } | { type: "pile", cards: [...] }]
        activeSegIndex: 0,
        phase: "pick_pivot", // "pick_pivot" | "partition" | "pass_ready" | "complete"
        pivot: null,
        remaining: [],
        leftCards: [],
        rightCards: [],
        passes: 0,
        compares: 0,
        log: [],
        theme: "dark"
    };

    // DOM
    const themeBtn = document.getElementById("theme-btn");
    const storyBtn = document.getElementById("story-btn");
    const storyModal = document.getElementById("story-modal");

    const modeButtons = document.querySelectorAll(".mode-pill");
    const resetBtn = document.getElementById("reset-btn");
    const boardTitleEl = document.getElementById("board-title");
    const boardHintEl = document.getElementById("board-hint");

    const stepBadgeEl = document.getElementById("step-badge");
    const stepInstructionEl = document.getElementById("step-instruction");
    const magicTableEl = document.getElementById("magic-table");

    const completeStageEl = document.getElementById("complete-stage");
    const completeSummaryEl = document.getElementById("complete-summary");
    const quizInputEl = document.getElementById("quiz-answer-input");
    const quizCheckBtn = document.getElementById("quiz-check-btn");
    const quizFeedbackEl = document.getElementById("quiz-feedback");

    const feedbackBarEl = document.getElementById("feedback-bar");
    const fbIconEl = document.getElementById("fb-icon");
    const fbTextEl = document.getElementById("fb-text");

    const passCountEl = document.getElementById("pass-count");
    const compareCountEl = document.getElementById("compare-count");
    const sortedProgressEl = document.getElementById("sorted-progress");
    const logListEl = document.getElementById("log-list");

    // Aktive Zone-Referenzen für Drag & Drop / Shake
    let activeZoneLeftEl = null;
    let activeZoneRightEl = null;

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
        feedbackBarEl.className = `feedback-bar ${variant}`;
        fbIconEl.textContent = icon;
        fbTextEl.textContent = text;
    }

    function createShuffled(count) {
        const arr = Array.from({ length: count }, (_, i) => i + 1);
        do {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
        } while (arr.join(",") === EXAM_FORBIDDEN);
        return arr;
    }

    function startMode(mode) {
        state.mode = mode;
        if (mode === "simple5") {
            state.initialCards = [...SIMPLE_5];
            boardTitleEl.textContent = "Einstieg: Übungs-Stapel (5 Karten)";
        } else if (mode === "medium7") {
            state.initialCards = [...MEDIUM_7];
            boardTitleEl.textContent = "Übungs-Stapel (7 Karten)";
        } else {
            state.initialCards = createShuffled(10);
            boardTitleEl.textContent = "Zufalls-Stapel (10 Karten)";
        }

        boardHintEl.innerHTML = `Startreihenfolge: <strong>${state.initialCards.join(" – ")}</strong>`;
        modeButtons.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));

        state.segments = [{ type: "pile", cards: [...state.initialCards] }];
        state.activeSegIndex = 0;
        state.phase = "pick_pivot";
        state.pivot = null;
        state.remaining = [];
        state.leftCards = [];
        state.rightCards = [];
        state.passes = 0;
        state.compares = 0;
        state.log = [];

        quizInputEl.value = "";
        quizFeedbackEl.textContent = "";
        quizFeedbackEl.className = "quiz-feedback";

        setFeedback("neutral", "✨", "Bereit! Tippe auf die oberste Karte des Stapels auf dem Zaubertisch.");
        renderAll();
    }

    function createCardElement(num, extraClasses = [], tag = "div") {
        const el = document.createElement(tag);
        if (tag === "button") el.type = "button";
        el.className = ["magic-card", ...extraClasses].join(" ");
        el.innerHTML = `<span class="card-corner">${num}</span><span>${num}</span><span class="card-star">✦</span>`;
        return el;
    }

    function buildDeckVisual(cards, isInteractiveTop) {
        const wrap = document.createElement("div");
        wrap.className = "deck-visual";

        if (cards.length >= 3) {
            const l2 = document.createElement("div");
            l2.className = "deck-layer l2";
            wrap.appendChild(l2);
        }
        if (cards.length >= 2) {
            const l1 = document.createElement("div");
            l1.className = "deck-layer l1";
            wrap.appendChild(l1);
        }

        const topCard = createCardElement(
            cards[0],
            isInteractiveTop ? ["deck-top-btn"] : [],
            isInteractiveTop ? "button" : "div"
        );
        if (isInteractiveTop) {
            topCard.setAttribute("aria-label", `Oberste Karte ${cards[0]} als Pivot wählen`);
            topCard.addEventListener("click", selectPivot);
        }
        wrap.appendChild(topCard);
        return wrap;
    }

    function findNextPileIndex() {
        return state.segments.findIndex((seg) => seg.type === "pile");
    }

    function selectPivot() {
        if (state.phase !== "pick_pivot") return;
        const activePile = state.segments[state.activeSegIndex];
        if (!activePile || activePile.type !== "pile") return;

        state.pivot = activePile.cards[0];
        state.remaining = activePile.cards.slice(1);
        state.leftCards = [];
        state.rightCards = [];
        state.phase = "partition";

        setFeedback(
            "neutral",
            "🪄",
            `Pivot ist die ${state.pivot}. Ziehe oder tippe die ${state.remaining.length} Karten vom Reststapel nach links (< ${state.pivot}) oder rechts (> ${state.pivot}).`
        );
        renderAll();
    }

    function sortNextCard(side) {
        if (state.phase !== "partition" || state.remaining.length === 0) return;

        const card = state.remaining[0];
        const expectedSide = card < state.pivot ? "left" : "right";

        if (side !== expectedSide) {
            const targetZone = side === "left" ? activeZoneLeftEl : activeZoneRightEl;
            if (targetZone) {
                targetZone.classList.remove("shake");
                void targetZone.offsetWidth;
                targetZone.classList.add("shake");
            }

            const cmpText = card < state.pivot
                ? `Schau genau: ${card} ist kleiner als der Pivot ${state.pivot} – sie gehört nach LINKS!`
                : `Schau genau: ${card} ist größer als der Pivot ${state.pivot} – sie gehört nach RECHTS!`;
            setFeedback("warning", "⚠️", cmpText);
            return;
        }

        state.compares += 1;
        state.remaining.shift();
        if (side === "left") {
            state.leftCards.push(card);
        } else {
            state.rightCards.push(card);
        }

        if (state.remaining.length === 0) {
            state.phase = "pass_ready";
            setFeedback(
                "success",
                "✅",
                `Reststapel leer! Klicke auf „Durchlauf ${state.passes + 1} abschließen“, um die neuen Stapel auf dem Tisch abzulegen.`
            );
        } else {
            setFeedback(
                "neutral",
                "✨",
                `Gut! ${card} liegt ${side === "left" ? "links (< " + state.pivot + ")" : "rechts (> " + state.pivot + ")"}. Nächste Karte oben: ${state.remaining[0]}.`
            );
        }

        renderAll();
    }

    function finishPass() {
        if (state.phase !== "pass_ready") return;

        state.passes += 1;

        const replacement = [];
        if (state.leftCards.length === 1) {
            replacement.push({ type: "done", value: state.leftCards[0] });
        } else if (state.leftCards.length > 1) {
            replacement.push({ type: "pile", cards: [...state.leftCards] });
        }

        replacement.push({ type: "done", value: state.pivot });

        if (state.rightCards.length === 1) {
            replacement.push({ type: "done", value: state.rightCards[0] });
        } else if (state.rightCards.length > 1) {
            replacement.push({ type: "pile", cards: [...state.rightCards] });
        }

        state.log.unshift({
            pass: state.passes,
            pivot: state.pivot,
            left: [...state.leftCards],
            right: [...state.rightCards]
        });

        state.segments.splice(state.activeSegIndex, 1, ...replacement);

        const nextIdx = findNextPileIndex();
        if (nextIdx === -1) {
            state.activeSegIndex = -1;
            state.phase = "complete";
            setFeedback("success", "🎉", `Geschafft! Alle ${state.initialCards.length} Karten sind in ${state.passes} Durchläufen sortiert.`);
        } else {
            state.activeSegIndex = nextIdx;
            state.phase = "pick_pivot";
            const nextPile = state.segments[nextIdx];
            setFeedback(
                "neutral",
                "👉",
                `Durchlauf ${state.passes} fertig! Als Nächstes ist der linke Stapel dran (${nextPile.cards.length} Karten, oben: ${nextPile.cards[0]}).`
            );
        }

        state.pivot = null;
        state.remaining = [];
        state.leftCards = [];
        state.rightCards = [];
        renderAll();
    }

    // Touch + Maus Drag direkt von der obersten Karte des Reststapels
    function attachPointerDrag(cardEl, cardNum) {
        cardEl.addEventListener("pointerdown", (e) => {
            if (state.phase !== "partition" || e.button > 0) return;
            const startX = e.clientX;
            const startY = e.clientY;
            let dragging = false;
            let ghost = null;

            const onMove = (mv) => {
                const dx = mv.clientX - startX;
                const dy = mv.clientY - startY;
                if (!dragging && Math.hypot(dx, dy) > 8) {
                    dragging = true;
                    ghost = createCardElement(cardNum, ["draw-style", "drag-ghost"]);
                    document.body.appendChild(ghost);
                    cardEl.style.opacity = "0.35";
                }
                if (dragging && ghost) {
                    ghost.style.left = `${mv.clientX}px`;
                    ghost.style.top = `${mv.clientY}px`;
                    updateHoverZones(mv.clientX, mv.clientY);
                }
            };

            const onUp = (up) => {
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
                window.removeEventListener("pointercancel", onUp);
                cardEl.style.opacity = "";

                if (ghost) {
                    ghost.remove();
                    ghost = null;
                }
                const hitSide = getZoneUnderPoint(up.clientX, up.clientY);
                clearZoneHover();
                if (dragging && hitSide) {
                    sortNextCard(hitSide);
                }
            };

            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
            window.addEventListener("pointercancel", onUp);
        });
    }

    function isPointInside(el, x, y) {
        if (!el || typeof el.getBoundingClientRect !== "function") return false;
        const r = el.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }

    function getZoneUnderPoint(x, y) {
        if (isPointInside(activeZoneLeftEl, x, y)) return "left";
        if (isPointInside(activeZoneRightEl, x, y)) return "right";
        return null;
    }

    function updateHoverZones(x, y) {
        const hit = getZoneUnderPoint(x, y);
        if (activeZoneLeftEl) activeZoneLeftEl.classList.toggle("drag-over", hit === "left");
        if (activeZoneRightEl) activeZoneRightEl.classList.toggle("drag-over", hit === "right");
    }

    function clearZoneHover() {
        if (activeZoneLeftEl) activeZoneLeftEl.classList.remove("drag-over");
        if (activeZoneRightEl) activeZoneRightEl.classList.remove("drag-over");
    }

    function buildActiveTableStation() {
        const station = document.createElement("div");
        station.className = "active-table-station";
        station.id = "active-table-station";

        // 1. Oben: Der Reststapel (schrumpft live mit jeder sortierten Karte!)
        const restRow = document.createElement("div");
        restRow.className = "rest-deck-row";

        if (state.phase === "partition") {
            const meta = document.createElement("div");
            meta.className = "rest-meta";
            meta.innerHTML =
                `<span>Reststapel (oberste Karte ziehen oder tippen)</span>` +
                `<span class="rest-count-pill">noch ${state.remaining.length} ${state.remaining.length === 1 ? "Karte" : "Karten"}</span>`;
            restRow.appendChild(meta);

            const drawWrap = document.createElement("div");
            drawWrap.className = "deck-visual";
            drawWrap.id = "draw-card-holder";

            if (state.remaining.length >= 3) {
                const l2 = document.createElement("div");
                l2.className = "deck-layer l2";
                drawWrap.appendChild(l2);
            }
            if (state.remaining.length >= 2) {
                const l1 = document.createElement("div");
                l1.className = "deck-layer l1";
                drawWrap.appendChild(l1);
            }

            const drawCard = createCardElement(state.remaining[0], ["draw-style", "deck-top-btn"]);
            attachPointerDrag(drawCard, state.remaining[0]);
            drawWrap.appendChild(drawCard);
            restRow.appendChild(drawWrap);

            if (state.remaining.length > 1) {
                const restList = document.createElement("div");
                restList.className = "pile-contents-hint";
                restList.textContent = `darunter: ${state.remaining.slice(1).join(", ")}`;
                restRow.appendChild(restList);
            }
        } else {
            const emptyBox = document.createElement("div");
            emptyBox.className = "rest-empty-box";

            const emptyLabel = document.createElement("span");
            emptyLabel.className = "rest-empty-label";
            emptyLabel.textContent = "Reststapel leer ✓ – Alle Karten verteilt!";
            emptyBox.appendChild(emptyLabel);

            const finishBtn = document.createElement("button");
            finishBtn.type = "button";
            finishBtn.className = "btn btn-primary";
            finishBtn.id = "finish-pass-btn";
            finishBtn.innerHTML = `<span aria-hidden="true">✨</span> Durchlauf ${state.passes + 1} abschließen`;
            finishBtn.addEventListener("click", finishPass);
            emptyBox.appendChild(finishBtn);

            restRow.appendChild(emptyBox);
        }
        station.appendChild(restRow);

        // 2. Darunter: Links (< Pivot) | Pivot | Rechts (> Pivot) direkt auf dem Tisch
        const trio = document.createElement("div");
        trio.className = "partition-trio";

        const leftBtn = document.createElement("button");
        leftBtn.type = "button";
        leftBtn.className = "drop-zone zone-left";
        leftBtn.id = "zone-left";
        leftBtn.disabled = state.phase !== "partition";
        leftBtn.innerHTML =
            `<div class="zone-header">` +
            `<span class="zone-arrow" aria-hidden="true">⬅️</span>` +
            `<div><strong>Stapel LINKS</strong><span class="zone-rule">kleiner (&lt; ${state.pivot})</span></div>` +
            `</div>`;
        const leftCardsWrap = document.createElement("div");
        leftCardsWrap.className = "zone-cards";
        state.leftCards.forEach((n) => leftCardsWrap.appendChild(createCardElement(n, ["mini"])));
        leftBtn.appendChild(leftCardsWrap);
        leftBtn.addEventListener("click", () => sortNextCard("left"));

        const pivotPedestal = document.createElement("div");
        pivotPedestal.className = "pivot-pedestal";
        pivotPedestal.innerHTML = `<span class="pedestal-label">PIVOT</span>`;
        const pivotSlot = document.createElement("div");
        pivotSlot.id = "pivot-card-slot";
        pivotSlot.appendChild(createCardElement(state.pivot, ["pivot-style"]));
        pivotPedestal.appendChild(pivotSlot);
        const pedSub = document.createElement("span");
        pedSub.className = "pedestal-sub";
        pedSub.textContent = "fest in der Mitte";
        pivotPedestal.appendChild(pedSub);

        const rightBtn = document.createElement("button");
        rightBtn.type = "button";
        rightBtn.className = "drop-zone zone-right";
        rightBtn.id = "zone-right";
        rightBtn.disabled = state.phase !== "partition";
        rightBtn.innerHTML =
            `<div class="zone-header">` +
            `<div><strong>Stapel RECHTS</strong><span class="zone-rule">größer (&gt; ${state.pivot})</span></div>` +
            `<span class="zone-arrow" aria-hidden="true">➡️</span>` +
            `</div>`;
        const rightCardsWrap = document.createElement("div");
        rightCardsWrap.className = "zone-cards";
        state.rightCards.forEach((n) => rightCardsWrap.appendChild(createCardElement(n, ["mini"])));
        rightBtn.appendChild(rightCardsWrap);
        rightBtn.addEventListener("click", () => sortNextCard("right"));

        activeZoneLeftEl = leftBtn;
        activeZoneRightEl = rightBtn;

        trio.appendChild(leftBtn);
        trio.appendChild(pivotPedestal);
        trio.appendChild(rightBtn);
        station.appendChild(trio);

        return station;
    }

    function renderMagicTable() {
        magicTableEl.innerHTML = "";
        activeZoneLeftEl = null;
        activeZoneRightEl = null;

        state.segments.forEach((seg, idx) => {
            if (seg.type === "done") {
                const card = createCardElement(seg.value, ["done-card"]);
                card.title = `Karte ${seg.value} liegt an ihrer endgültigen Position`;
                magicTableEl.appendChild(card);
                return;
            }

            const isActive = idx === state.activeSegIndex;
            if (isActive && (state.phase === "partition" || state.phase === "pass_ready")) {
                magicTableEl.appendChild(buildActiveTableStation());
                return;
            }

            // Kompakter Stapel direkt auf dem Tisch
            const pileSlot = document.createElement("div");
            pileSlot.className = "pile-slot " + (isActive ? "active-pick" : "waiting");

            const badge = document.createElement("span");
            badge.className = "pile-badge";
            badge.textContent = isActive
                ? `Aktiver Stapel (${seg.cards.length})`
                : `Stapel (${seg.cards.length})`;
            pileSlot.appendChild(badge);

            pileSlot.appendChild(buildDeckVisual(seg.cards, isActive));

            const hint = document.createElement("span");
            hint.className = "pile-contents-hint";
            hint.textContent = isActive
                ? `Tippe auf ${seg.cards[0]} (darunter: ${seg.cards.slice(1).join(", ")})`
                : `Karten: ${seg.cards.join(", ")}`;
            pileSlot.appendChild(hint);

            magicTableEl.appendChild(pileSlot);
        });
    }

    function renderStepAndComplete() {
        completeStageEl.classList.toggle("hidden", state.phase !== "complete");

        if (state.phase === "pick_pivot") {
            stepBadgeEl.textContent = `Durchlauf ${state.passes + 1} · Schritt 1`;
            stepInstructionEl.textContent = "Tippe auf die oberste Karte des markierten Stapels auf dem Tisch, um sie als Pivot zu legen.";
        } else if (state.phase === "partition") {
            stepBadgeEl.textContent = `Durchlauf ${state.passes + 1} · Schritt 2`;
            stepInstructionEl.textContent = `Nimm Karte für Karte vom Reststapel: kleiner (< ${state.pivot}) nach links, größer (> ${state.pivot}) nach rechts.`;
        } else if (state.phase === "pass_ready") {
            stepBadgeEl.textContent = `Durchlauf ${state.passes + 1} · Fertig`;
            stepInstructionEl.textContent = "Schließe den Durchlauf ab, um die neuen Stapel auf dem Tisch abzulegen.";
        } else {
            stepBadgeEl.textContent = "Fertig!";
            stepInstructionEl.textContent = "Jeder Stapel besteht nur noch aus einer einzelnen Karte – alles sortiert!";
            completeSummaryEl.textContent =
                `Du hast alle ${state.initialCards.length} Karten mit ${state.compares} Vergleichen in ${state.passes} Durchläufen sortiert.`;
        }
    }

    function renderStatsAndLog() {
        passCountEl.textContent = String(state.passes);
        compareCountEl.textContent = String(state.compares);

        const doneCount = state.segments.filter((s) => s.type === "done").length;
        sortedProgressEl.textContent = `${doneCount} / ${state.initialCards.length}`;

        if (state.log.length === 0) {
            logListEl.innerHTML = '<p class="log-empty">Noch kein Durchlauf abgeschlossen.</p>';
            return;
        }

        logListEl.innerHTML = "";
        state.log.forEach((entry) => {
            const div = document.createElement("div");
            div.className = "log-entry";
            const leftText = entry.left.length ? entry.left.join(", ") : "leer";
            const rightText = entry.right.length ? entry.right.join(", ") : "leer";
            div.innerHTML =
                `<div class="log-entry-head">Durchlauf ${entry.pass}: Pivot [${entry.pivot}]</div>` +
                `<div class="log-entry-body">Links: [${leftText}] · Rechts: [${rightText}]</div>`;
            logListEl.appendChild(div);
        });
    }

    function renderAll() {
        renderMagicTable();
        renderStepAndComplete();
        renderStatsAndLog();
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
            if (state.phase === "partition") {
                if (e.key === "ArrowLeft") sortNextCard("left");
                if (e.key === "ArrowRight") sortNextCard("right");
            }
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

        modeButtons.forEach((btn) => {
            btn.addEventListener("click", () => startMode(btn.dataset.mode));
        });

        resetBtn.addEventListener("click", () => startMode(state.mode));

        quizCheckBtn.addEventListener("click", () => {
            const val = Number(quizInputEl.value);
            if (!val) {
                quizFeedbackEl.textContent = "Bitte gib eine Zahl ein.";
                quizFeedbackEl.className = "quiz-feedback err";
                return;
            }
            if (val === state.passes) {
                quizFeedbackEl.textContent = `Richtig! Es waren genau ${state.passes} Durchläufe. 🎉`;
                quizFeedbackEl.className = "quiz-feedback ok";
            } else {
                quizFeedbackEl.textContent = "Noch nicht ganz – schau rechts beim Zähler („Durchläufe“) nach!";
                quizFeedbackEl.className = "quiz-feedback err";
            }
        });

        setupModals();
        startMode("simple5");
    }

    init();
})();
