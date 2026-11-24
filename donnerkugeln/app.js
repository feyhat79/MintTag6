(() => {
    "use strict";

    const BALL_COUNT = 9;
    const MAX_PER_PAN = 4;
    const TILT_ANGLE = 11; // Grad
    const BEAM_RADIUS = 175; // SVG-Abstand Drehpunkt -> Haken

    const state = {
        heavyIndex: 0,
        // 'tray' | 'left' | 'right'
        locations: Array(BALL_COUNT).fill("tray"),
        leftOrder: [],
        rightOrder: [],
        selectedTray: new Set(),
        weighedBalls: new Set(),
        ruledOut: new Set(),
        noteMode: false,
        weighings: 0,
        history: [],
        gameActive: true,
        isAnimating: false,
        currentAngle: 0,
        scaleAnimId: null,
        roundNumber: 1,
        // Abgeschlossene Runden: { round, weighings, won, lucky }
        completedRounds: [],
        bestWeighings: null,
        pickedGuessIndex: null,
        certificateAutoShown: false,
        theme: "dark"
    };

    // DOM-Referenzen
    const traySectionEl = document.getElementById("tray-section");
    const trayEl = document.getElementById("balls-tray");
    const noteModeBtn = document.getElementById("note-mode-btn");
    const selectionHintEl = document.getElementById("selection-hint");
    const panLeftZone = document.getElementById("pan-left-zone");
    const panRightZone = document.getElementById("pan-right-zone");
    const panLeftBallsEl = document.getElementById("pan-left-balls");
    const panRightBallsEl = document.getElementById("pan-right-balls");
    const panLeftLabel = document.getElementById("pan-left-label");
    const panRightLabel = document.getElementById("pan-right-label");
    const clearLeftBtn = document.getElementById("clear-left-btn");
    const clearRightBtn = document.getElementById("clear-right-btn");

    const beamGroup = document.getElementById("scale-beam-group");
    const panLeftSvg = document.getElementById("pan-left-svg");
    const panRightSvg = document.getElementById("pan-right-svg");
    const scaleIndLeft = document.getElementById("scale-ind-left");
    const scaleIndCenter = document.getElementById("scale-ind-center");
    const scaleIndRight = document.getElementById("scale-ind-right");

    const balanceHintEl = document.getElementById("balance-hint");
    const weighBtn = document.getElementById("weigh-btn");
    const clearScaleBtn = document.getElementById("clear-scale-btn");
    const guessBtn = document.getElementById("guess-btn");
    const newGameBtn = document.getElementById("new-game-btn");

    const weighCountEl = document.getElementById("weigh-count");
    const currentRoundNumEl = document.getElementById("current-round-num");
    const bestScoreEl = document.getElementById("best-score");
    const lastResultBox = document.getElementById("last-result-box");
    const resultIconEl = document.getElementById("result-icon");
    const resultTitleEl = document.getElementById("result-title");
    const resultDetailEl = document.getElementById("result-detail");
    const historyListEl = document.getElementById("history-list");

    const roundBadgesEl = document.getElementById("round-badges");
    const masteryCardEl = document.getElementById("mastery-card");
    const masteryTitleEl = document.getElementById("mastery-title");
    const masteryDescEl = document.getElementById("mastery-desc");
    const openCertBtn = document.getElementById("open-cert-btn");

    const themeBtn = document.getElementById("theme-btn");
    const storyBtn = document.getElementById("story-btn");
    const storyModal = document.getElementById("story-modal");
    const guessModal = document.getElementById("guess-modal");
    const guessInfoText = document.getElementById("guess-info-text");
    const guessGridEl = document.getElementById("guess-grid");
    const confirmGuessBtn = document.getElementById("confirm-guess-btn");
    const certificateModal = document.getElementById("certificate-modal");
    const certRankEl = document.getElementById("cert-rank");
    const certSummaryEl = document.getElementById("cert-summary");
    const certRoundsEl = document.getElementById("cert-rounds");
    const certNewGameBtn = document.getElementById("cert-new-game-btn");
    const toastEl = document.getElementById("toast");

    let toastTimer = null;

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
            // Ignorieren, falls Speicher blockiert ist
        }
    }

    function updateScaleIndicators(mode) {
        scaleIndLeft.classList.toggle("active", mode === "left");
        scaleIndCenter.classList.toggle("active", mode === "neutral");
        scaleIndRight.classList.toggle("active", mode === "right");
    }

    function showToast(message) {
        toastEl.textContent = message;
        toastEl.classList.add("visible");
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toastEl.classList.remove("visible");
        }, 2400);
    }

    // --- Waagen-Geometrie & Physik-Animation ---
    function applyScaleAngle(angleDeg) {
        state.currentAngle = angleDeg;
        const rad = (angleDeg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        beamGroup.setAttribute("transform", `rotate(${angleDeg.toFixed(3)} 280 74)`);

        const dxL = BEAM_RADIUS * (1 - cos);
        const dyL = -BEAM_RADIUS * sin;
        const dxR = -BEAM_RADIUS * (1 - cos);
        const dyR = BEAM_RADIUS * sin;

        panLeftSvg.setAttribute("transform", `translate(${dxL.toFixed(2)} ${dyL.toFixed(2)})`);
        panRightSvg.setAttribute("transform", `translate(${dxR.toFixed(2)} ${dyR.toFixed(2)})`);

        // HTML-Dropzones exakt über dem Schalenrand (105, 185) bzw. (455, 185) halten
        panLeftZone.style.left = `${((105 + dxL) / 560) * 100}%`;
        panLeftZone.style.top = `${((185 + dyL) / 270) * 100}%`;

        panRightZone.style.left = `${((455 + dxR) / 560) * 100}%`;
        panRightZone.style.top = `${((185 + dyR) / 270) * 100}%`;
    }

    function animateScaleTo(targetAngle, durationMs = 900) {
        if (state.scaleAnimId) {
            cancelAnimationFrame(state.scaleAnimId);
            state.scaleAnimId = null;
        }

        const startAngle = state.currentAngle;
        const delta = targetAngle - startAngle;
        if (Math.abs(delta) < 0.05) {
            applyScaleAngle(targetAngle);
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            const startTime = performance.now();

            function easeOutBackGentle(t) {
                const c1 = 1.25;
                const c3 = c1 + 1;
                return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
            }

            function step(now) {
                const elapsed = now - startTime;
                const progress = Math.min(1, elapsed / durationMs);
                const eased = easeOutBackGentle(progress);
                applyScaleAngle(startAngle + delta * eased);

                if (progress < 1) {
                    state.scaleAnimId = requestAnimationFrame(step);
                } else {
                    state.scaleAnimId = null;
                    applyScaleAngle(targetAngle);
                    resolve();
                }
            }

            state.scaleAnimId = requestAnimationFrame(step);
        });
    }

    // --- Spielinitialisierung ---
    function startNewRound(incrementRoundNumber = false) {
        if (state.isAnimating) return;
        if (incrementRoundNumber) {
            state.roundNumber += 1;
        }

        state.heavyIndex = Math.floor(Math.random() * BALL_COUNT);
        state.locations.fill("tray");
        state.leftOrder = [];
        state.rightOrder = [];
        state.selectedTray.clear();
        state.weighedBalls.clear();
        state.ruledOut.clear();
        state.noteMode = false;
        state.weighings = 0;
        state.history = [];
        state.gameActive = true;
        state.pickedGuessIndex = null;

        updateScaleIndicators("neutral");
        animateScaleTo(0, 400);
        setResultBox(
            "neutral",
            "⚖️",
            "Bereit zum Wiegen",
            "Finde die eine Kugel mit dem Sternensplitter."
        );
        renderAll();
    }

    function setResultBox(variant, icon, title, detail) {
        lastResultBox.className = `last-result ${variant}`;
        resultIconEl.textContent = icon;
        resultTitleEl.textContent = title;
        resultDetailEl.textContent = detail;
    }

    // --- Kugel-Element erzeugen ---
    function createBallElement(index, extraClass = "") {
        const ball = document.createElement("div");
        ball.className = "ball";
        if (extraClass) ball.classList.add(extraClass);
        ball.dataset.index = String(index);
        ball.textContent = String(index + 1);
        ball.setAttribute("role", "button");
        const isWeighed = state.weighedBalls.has(index);
        const isRuledOut = state.ruledOut.has(index);
        ball.setAttribute(
            "aria-label",
            `Donnerkugel ${index + 1}${isWeighed ? ", bereits gewogen" : ""}${isRuledOut ? ", ausgeschlossen" : ""}`
        );

        if (isWeighed) {
            ball.classList.add("is-weighed");
        }
        if (isRuledOut) {
            ball.classList.add("is-ruled-out");
        }

        if (state.locations[index] === "tray" && state.selectedTray.has(index)) {
            ball.classList.add("selected");
        }

        if (!state.gameActive) {
            if (index === state.heavyIndex) {
                ball.classList.add("is-heavy-revealed");
            } else if (state.pickedGuessIndex === index) {
                ball.classList.add("is-wrong-revealed");
            }
        }

        ball.addEventListener("pointerdown", onBallPointerDown);
        return ball;
    }

    // --- Rendering ---
    function renderTray() {
        trayEl.innerHTML = "";
        for (let i = 0; i < BALL_COUNT; i++) {
            const slot = document.createElement("div");
            slot.className = "ball-slot";

            const num = document.createElement("span");
            num.className = "slot-number";
            num.textContent = String(i + 1);
            slot.appendChild(num);

            if (state.locations[i] === "tray") {
                slot.appendChild(createBallElement(i));
            }
            trayEl.appendChild(slot);
        }
    }

    function renderPans() {
        panLeftBallsEl.innerHTML = "";
        for (const idx of state.leftOrder) {
            panLeftBallsEl.appendChild(createBallElement(idx));
        }

        panRightBallsEl.innerHTML = "";
        for (const idx of state.rightOrder) {
            panRightBallsEl.appendChild(createBallElement(idx));
        }

        const hasSelection = state.gameActive && state.selectedTray.size > 0;
        const canAcceptLeft = hasSelection && state.leftOrder.length < MAX_PER_PAN;
        const canAcceptRight = hasSelection && state.rightOrder.length < MAX_PER_PAN;

        panLeftLabel.textContent = canAcceptLeft
            ? "◀ Hierher (Links)"
            : `Links (${state.leftOrder.length}/${MAX_PER_PAN})`;
        panRightLabel.textContent = canAcceptRight
            ? "Hierher (Rechts) ▶"
            : `Rechts (${state.rightOrder.length}/${MAX_PER_PAN})`;

        clearLeftBtn.classList.toggle("hidden", !state.gameActive || state.leftOrder.length === 0);
        clearRightBtn.classList.toggle("hidden", !state.gameActive || state.rightOrder.length === 0);

        panLeftZone.classList.toggle("can-accept", canAcceptLeft);
        panRightZone.classList.toggle("can-accept", canAcceptRight);
    }

    function renderControlsAndStatus() {
        weighCountEl.textContent = String(state.weighings);
        currentRoundNumEl.textContent = String(state.roundNumber);
        bestScoreEl.textContent = state.bestWeighings !== null ? `${state.bestWeighings} W.` : "–";

        const leftCount = state.leftOrder.length;
        const rightCount = state.rightOrder.length;
        const canWeigh = state.gameActive && !state.isAnimating && leftCount > 0 && leftCount === rightCount;

        weighBtn.disabled = !canWeigh;
        clearScaleBtn.disabled = !state.gameActive || state.isAnimating || (leftCount === 0 && rightCount === 0);
        guessBtn.disabled = !state.gameActive || state.isAnimating;
        noteModeBtn.disabled = !state.gameActive || state.isAnimating;
        noteModeBtn.classList.toggle("is-active", state.noteMode);
        noteModeBtn.setAttribute("aria-pressed", String(state.noteMode));
        traySectionEl.classList.toggle("note-mode-active", state.noteMode);

        if (!state.gameActive) {
            balanceHintEl.textContent = "Runde beendet – tippe auf „Neues Spiel“ für die nächste Probe.";
            balanceHintEl.className = "balance-status-hint";
            newGameBtn.classList.remove("btn-ghost");
            newGameBtn.classList.add("btn-primary");
        } else {
            newGameBtn.classList.remove("btn-primary");
            newGameBtn.classList.add("btn-ghost");
            if (leftCount === 0 && rightCount === 0) {
                balanceHintEl.textContent = "Lege gleich viele Kugeln auf beide Schalen.";
                balanceHintEl.className = "balance-status-hint";
            } else if (leftCount !== rightCount) {
                balanceHintEl.textContent = `Ungleich viele Kugeln: ${leftCount} links, ${rightCount} rechts.`;
                balanceHintEl.className = "balance-status-hint unequal";
            } else {
                balanceHintEl.textContent = `Bereit: ${leftCount} gegen ${rightCount} Kugeln wiegen!`;
                balanceHintEl.className = "balance-status-hint ready";
            }
        }

        selectionHintEl.classList.remove("active-selection", "note-mode-hint");
        if (state.noteMode) {
            selectionHintEl.textContent =
                "Notiz-Modus: Tippe Kugeln an, um sie als „normal“ durchzustreichen";
            selectionHintEl.classList.add("note-mode-hint");
        } else if (state.selectedTray.size > 0) {
            selectionHintEl.textContent =
                `${state.selectedTray.size} Kugel(n) gewählt – tippe jetzt auf Links oder Rechts!`;
            selectionHintEl.classList.add("active-selection");
        } else {
            selectionHintEl.textContent =
                "Tippe Kugeln an & dann auf eine Schale – oder ziehe sie auf die Waage";
        }
    }

    function renderHistory() {
        historyListEl.innerHTML = "";
        if (state.history.length === 0) {
            const empty = document.createElement("li");
            empty.className = "history-empty";
            empty.textContent = "Noch keine Wiegung durchgeführt.";
            historyListEl.appendChild(empty);
            return;
        }

        // Neueste Wiegung oben oder chronologisch? Chronologisch (1, 2, 3...) ist für Kinder logischer.
        state.history.forEach((entry) => {
            const li = document.createElement("li");
            li.className = "history-item";

            const top = document.createElement("div");
            top.className = "history-row-top";

            const step = document.createElement("span");
            step.className = "history-step";
            step.textContent = `Wiegung ${entry.step}`;

            const outcome = document.createElement("span");
            outcome.className = `history-outcome ${entry.result}`;
            let symbol = "=";
            if (entry.result === "left") {
                outcome.textContent = "Links schwerer";
                symbol = ">";
            } else if (entry.result === "right") {
                outcome.textContent = "Rechts schwerer";
                symbol = "<";
            } else {
                outcome.textContent = "Gleichgewicht";
                symbol = "=";
            }

            top.appendChild(step);
            top.appendChild(outcome);

            const compare = document.createElement("div");
            compare.className = "history-compare";

            const leftGroup = document.createElement("div");
            leftGroup.className = "mini-balls";
            entry.left.forEach((idx) => {
                const mb = document.createElement("span");
                mb.className = "mini-ball";
                mb.textContent = String(idx + 1);
                leftGroup.appendChild(mb);
            });

            const sym = document.createElement("span");
            sym.className = "compare-symbol";
            sym.textContent = symbol;

            const rightGroup = document.createElement("div");
            rightGroup.className = "mini-balls right-side";
            entry.right.forEach((idx) => {
                const mb = document.createElement("span");
                mb.className = "mini-ball";
                mb.textContent = String(idx + 1);
                rightGroup.appendChild(mb);
            });

            compare.appendChild(leftGroup);
            compare.appendChild(sym);
            compare.appendChild(rightGroup);

            li.appendChild(top);
            li.appendChild(compare);
            historyListEl.appendChild(li);
        });

        historyListEl.scrollTop = historyListEl.scrollHeight;
    }

    function renderRoundBadges() {
        const validWins = state.completedRounds.filter((r) => r.won && !r.lucky);
        const pills = roundBadgesEl.querySelectorAll(".round-pill");

        pills.forEach((pill, i) => {
            pill.classList.remove("won", "optimal");
            const win = validWins[i];
            if (win) {
                pill.textContent = `${win.weighings}✓`;
                pill.title = `Spiel ${i + 1}: mit ${win.weighings} Wiegungen gelöst`;
                pill.classList.add(win.weighings === 2 ? "optimal" : "won");
            } else {
                pill.textContent = String(i + 1);
                pill.title = `Spiel ${i + 1} noch offen`;
            }
        });

        if (validWins.length >= 3) {
            masteryCardEl.classList.remove("hidden");
            const optimalCount = validWins.filter((r) => r.weighings === 2).length;
            if (optimalCount >= 3) {
                masteryTitleEl.textContent = "Königlicher Waffenschmied!";
                masteryDescEl.textContent =
                    `Du hast alle ${validWins.length} Spiele mit der kleinstmöglichen Anzahl (2 Wiegungen) gemeistert.`;
            } else if (optimalCount >= 1) {
                masteryTitleEl.textContent = "3 Spiele gemeistert!";
                masteryDescEl.textContent =
                    `Klasse! Du hast bereits die 2-Wiegungen-Strategie entdeckt. Schaffst du sie jetzt jedes Mal?`;
            } else {
                masteryTitleEl.textContent = "3 Spiele gemeistert!";
                masteryDescEl.textContent =
                    `Super Ausdauer! Kleiner Meister-Tipp: Es geht garantiert in noch weniger als 3 Wiegungen.`;
            }
        } else {
            masteryCardEl.classList.add("hidden");
        }
    }

    function renderAll() {
        renderTray();
        renderPans();
        renderControlsAndStatus();
        renderHistory();
        renderRoundBadges();
    }

    // --- Kugeln bewegen ---
    function moveBallTo(index, target) {
        if (!state.gameActive || state.isAnimating) return false;
        const current = state.locations[index];
        if (current === target) return false;

        if (target === "left" && state.leftOrder.length >= MAX_PER_PAN) {
            showToast(`In die linke Schale passen maximal ${MAX_PER_PAN} Kugeln.`);
            return false;
        }
        if (target === "right" && state.rightOrder.length >= MAX_PER_PAN) {
            showToast(`In die rechte Schale passen maximal ${MAX_PER_PAN} Kugeln.`);
            return false;
        }

        // Aus alter Position entfernen
        if (current === "left") {
            state.leftOrder = state.leftOrder.filter((id) => id !== index);
        } else if (current === "right") {
            state.rightOrder = state.rightOrder.filter((id) => id !== index);
        }
        state.selectedTray.delete(index);

        // In neue Position einfügen
        state.locations[index] = target;
        if (target === "left") {
            state.leftOrder.push(index);
        } else if (target === "right") {
            state.rightOrder.push(index);
        }

        // Nach dem Umlegen der Kugeln Waage wieder neutral stellen
        updateScaleIndicators("neutral");
        if (Math.abs(state.currentAngle) > 0.1) {
            animateScaleTo(0, 350);
        }

        renderAll();
        return true;
    }

    function clearScale() {
        if (!state.gameActive || state.isAnimating) return;
        for (const idx of state.leftOrder) state.locations[idx] = "tray";
        for (const idx of state.rightOrder) state.locations[idx] = "tray";
        state.leftOrder = [];
        state.rightOrder = [];
        updateScaleIndicators("neutral");
        animateScaleTo(0, 400);
        renderAll();
    }

    function clearSinglePan(pan) {
        if (!state.gameActive || state.isAnimating) return;
        if (pan === "left") {
            for (const idx of state.leftOrder) state.locations[idx] = "tray";
            state.leftOrder = [];
        } else {
            for (const idx of state.rightOrder) state.locations[idx] = "tray";
            state.rightOrder = [];
        }
        updateScaleIndicators("neutral");
        if (Math.abs(state.currentAngle) > 0.1) {
            animateScaleTo(0, 350);
        }
        renderAll();
    }

    function toggleNoteMode() {
        if (!state.gameActive || state.isAnimating) return;
        state.noteMode = !state.noteMode;
        if (state.noteMode) {
            state.selectedTray.clear();
        }
        renderAll();
    }

    // --- Drag & Drop + Tap über Pointer Events (iPad & Desktop) ---
    let dragSession = null;
    let suppressPanClick = false;

    function clearDropHover() {
        panLeftZone.classList.remove("drop-hover");
        panRightZone.classList.remove("drop-hover");
        trayEl.classList.remove("drop-hover");
    }

    function detectDropTarget(clientX, clientY) {
        const el = document.elementFromPoint(clientX, clientY);
        if (!el) return null;
        if (el.closest("#pan-left-zone")) return "left";
        if (el.closest("#pan-right-zone")) return "right";
        if (el.closest("#balls-tray")) return "tray";
        return null;
    }

    function onBallPointerDown(e) {
        if (!state.gameActive || state.isAnimating) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;

        const ballEl = e.currentTarget;
        const index = parseInt(ballEl.dataset.index, 10);

        dragSession = {
            pointerId: e.pointerId,
            index,
            sourceLocation: state.locations[index],
            ballEl,
            startX: e.clientX,
            startY: e.clientY,
            isDragging: false,
            ghostEl: null
        };
    }

    window.addEventListener("pointermove", (e) => {
        if (!dragSession || e.pointerId !== dragSession.pointerId) return;

        const dx = e.clientX - dragSession.startX;
        const dy = e.clientY - dragSession.startY;

        if (!dragSession.isDragging && Math.hypot(dx, dy) > 10) {
            dragSession.isDragging = true;
            dragSession.ballEl.classList.add("dragging-source");

            const ghost = dragSession.ballEl.cloneNode(true);
            ghost.classList.remove("dragging-source", "selected");
            ghost.classList.add("drag-ghost");
            document.body.appendChild(ghost);
            dragSession.ghostEl = ghost;
        }

        if (dragSession.isDragging && dragSession.ghostEl) {
            dragSession.ghostEl.style.left = `${e.clientX}px`;
            dragSession.ghostEl.style.top = `${e.clientY}px`;

            clearDropHover();
            const target = detectDropTarget(e.clientX, e.clientY);
            if (target === "left" && dragSession.sourceLocation !== "left") {
                panLeftZone.classList.add("drop-hover");
            } else if (target === "right" && dragSession.sourceLocation !== "right") {
                panRightZone.classList.add("drop-hover");
            } else if (target === "tray" && dragSession.sourceLocation !== "tray") {
                trayEl.classList.add("drop-hover");
            }
        }
    });

    function finishPointerSession(e, cancelled = false) {
        if (!dragSession || e.pointerId !== dragSession.pointerId) return;

        const session = dragSession;
        dragSession = null;

        clearDropHover();
        if (session.ghostEl) {
            session.ghostEl.remove();
        }
        session.ballEl.classList.remove("dragging-source");

        if (cancelled) return;

        if (session.isDragging) {
            const target = detectDropTarget(e.clientX, e.clientY);
            if (target && target !== session.sourceLocation) {
                moveBallTo(session.index, target);
            }
            if (session.sourceLocation !== "tray") {
                suppressPanClick = true;
                setTimeout(() => { suppressPanClick = false; }, 60);
            }
        } else {
            // Kurzer Tap
            if (session.sourceLocation !== "tray") {
                suppressPanClick = true;
                setTimeout(() => { suppressPanClick = false; }, 60);
            }
            handleBallTap(session.index);
        }
    }

    window.addEventListener("pointerup", (e) => finishPointerSession(e, false));
    window.addEventListener("pointercancel", (e) => finishPointerSession(e, true));

    function handleBallTap(index) {
        if (!state.gameActive || state.isAnimating) return;
        const loc = state.locations[index];

        if (loc === "tray") {
            if (state.noteMode) {
                if (state.ruledOut.has(index)) {
                    state.ruledOut.delete(index);
                } else {
                    state.ruledOut.add(index);
                }
                renderTray();
                renderControlsAndStatus();
                return;
            }

            if (state.selectedTray.has(index)) {
                state.selectedTray.delete(index);
            } else {
                state.selectedTray.add(index);
            }
            renderTray();
            renderPans();
            renderControlsAndStatus();
        } else {
            // Kugel auf einer Waagschale angetippt -> direkt zurück auf den Tisch
            moveBallTo(index, "tray");
        }
    }

    // Antippen einer Waagschale legt ausgewählte Kugeln hinein
    function handlePanZoneTap(targetPan, e) {
        if (!state.gameActive || state.isAnimating) return;
        if (suppressPanClick || e.target.closest(".ball") || e.target.closest(".pan-clear-btn")) return;

        if (state.selectedTray.size === 0) {
            showToast("Tippe zuerst oben auf eine Kugel oder ziehe sie direkt hierher.");
            return;
        }

        const currentLen = targetPan === "left" ? state.leftOrder.length : state.rightOrder.length;
        const freeSlots = MAX_PER_PAN - currentLen;

        if (freeSlots <= 0) {
            showToast(`Diese Schale ist voll (max. ${MAX_PER_PAN} Kugeln).`);
            return;
        }

        const toMove = Array.from(state.selectedTray).sort((a, b) => a - b);
        let movedCount = 0;

        for (const idx of toMove) {
            if (movedCount >= freeSlots) break;
            state.selectedTray.delete(idx);
            state.locations[idx] = targetPan;
            if (targetPan === "left") {
                state.leftOrder.push(idx);
            } else {
                state.rightOrder.push(idx);
            }
            movedCount += 1;
        }

        if (toMove.length > freeSlots) {
            showToast(`Nur ${freeSlots} Platz frei – restliche Kugeln bleiben ausgewählt.`);
        }

        updateScaleIndicators("neutral");
        if (Math.abs(state.currentAngle) > 0.1) {
            animateScaleTo(0, 350);
        }

        renderAll();
    }

    panLeftZone.addEventListener("click", (e) => handlePanZoneTap("left", e));
    panRightZone.addEventListener("click", (e) => handlePanZoneTap("right", e));
    panLeftZone.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handlePanZoneTap("left", e);
        }
    });
    panRightZone.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handlePanZoneTap("right", e);
        }
    });

    // --- Wiegevorgang ---
    async function performWeighing() {
        if (!state.gameActive || state.isAnimating) return;
        if (state.leftOrder.length === 0 || state.leftOrder.length !== state.rightOrder.length) return;

        state.isAnimating = true;
        state.selectedTray.clear();
        renderControlsAndStatus();

        // Exakte Ganzzahlen (10 normal, 11 schwer) vermeiden Rundungsfehler
        const leftWeight = state.leftOrder.reduce(
            (sum, idx) => sum + (idx === state.heavyIndex ? 11 : 10),
            0
        );
        const rightWeight = state.rightOrder.reduce(
            (sum, idx) => sum + (idx === state.heavyIndex ? 11 : 10),
            0
        );

        let result = "equal";
        let targetAngle = 0;
        if (leftWeight > rightWeight) {
            result = "left";
            targetAngle = -TILT_ANGLE;
        } else if (rightWeight > leftWeight) {
            result = "right";
            targetAngle = TILT_ANGLE;
        }

        // Kurzes Einpendeln zur Mitte, dann Ausschlag
        updateScaleIndicators("neutral");
        await animateScaleTo(0, 220);
        await animateScaleTo(targetAngle, 950);
        updateScaleIndicators(result === "equal" ? "neutral" : result);

        state.weighings += 1;
        state.leftOrder.forEach((idx) => state.weighedBalls.add(idx));
        state.rightOrder.forEach((idx) => state.weighedBalls.add(idx));
        state.history.push({
            step: state.weighings,
            left: [...state.leftOrder],
            right: [...state.rightOrder],
            result
        });

        const leftNames = state.leftOrder.map((i) => i + 1).join(", ");
        const rightNames = state.rightOrder.map((i) => i + 1).join(", ");

        if (result === "left") {
            setResultBox(
                "left-heavy",
                "↙️",
                `Wiegung ${state.weighings}: Links ist schwerer!`,
                `Links [${leftNames}] sinkt nach unten gegen Rechts [${rightNames}].`
            );
        } else if (result === "right") {
            setResultBox(
                "right-heavy",
                "↘️",
                `Wiegung ${state.weighings}: Rechts ist schwerer!`,
                `Rechts [${rightNames}] sinkt nach unten gegen Links [${leftNames}].`
            );
        } else {
            setResultBox(
                "equal",
                "⚖️",
                `Wiegung ${state.weighings}: Gleichgewicht!`,
                `[${leftNames}] und [${rightNames}] sind gleich schwer.`
            );
        }

        state.isAnimating = false;
        renderAll();
    }

    // --- Lösung abgeben (Modal) ---
    function openGuessModal() {
        if (!state.gameActive || state.isAnimating) return;

        state.pickedGuessIndex = null;
        confirmGuessBtn.disabled = true;

        const wText = state.weighings === 1 ? "1 Wiegung" : `${state.weighings} Wiegungen`;
        guessInfoText.innerHTML =
            `Du hast bisher <strong>${wText}</strong> durchgeführt. Tippe auf die Kugel, in der der Sternensplitter steckt:`;

        guessGridEl.innerHTML = "";
        for (let i = 0; i < BALL_COUNT; i++) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "guess-option";
            btn.dataset.index = String(i);
            btn.innerHTML = `<span class="mini-sphere">${i + 1}</span><span>Kugel ${i + 1}</span>`;
            btn.addEventListener("click", () => {
                guessGridEl.querySelectorAll(".guess-option").forEach((el) => el.classList.remove("picked"));
                btn.classList.add("picked");
                state.pickedGuessIndex = i;
                confirmGuessBtn.disabled = false;
            });
            guessGridEl.appendChild(btn);
        }

        guessModal.classList.remove("hidden");
    }

    function submitGuess() {
        if (state.pickedGuessIndex === null || !state.gameActive) return;

        const guessed = state.pickedGuessIndex;
        const won = guessed === state.heavyIndex;
        const lucky = won && state.weighings <= 1;

        state.gameActive = false;
        state.noteMode = false;
        state.selectedTray.clear();
        guessModal.classList.add("hidden");

        state.completedRounds.push({
            round: state.roundNumber,
            weighings: state.weighings,
            won,
            lucky
        });

        if (won && !lucky) {
            if (state.bestWeighings === null || state.weighings < state.bestWeighings) {
                state.bestWeighings = state.weighings;
            }
        }

        if (won) {
            if (lucky) {
                setResultBox(
                    "won",
                    "🍀",
                    `Treffer! Kugel ${guessed + 1} war es – aber war das Glück?`,
                    `Mit nur ${state.weighings} Wiegung kann man bei 9 Kugeln noch nicht sicher sein. Teste eine Strategie, die garantiert klappt!`
                );
            } else if (state.weighings === 2) {
                setResultBox(
                    "won",
                    "🏆",
                    `Meisterhaft! Kugel ${guessed + 1} in nur 2 Wiegungen!`,
                    `Das ist die kleinstmögliche Anzahl an Wiegungen, mit der man die schwere Kugel garantiert findet!`
                );
            } else {
                setResultBox(
                    "won",
                    "🎉",
                    `Richtig! Kugel ${guessed + 1} nach ${state.weighings} Wiegungen gefunden!`,
                    `Gute Arbeit! Meinst du, du schaffst es in der nächsten Runde mit noch weniger Wiegungen?`
                );
            }
        } else {
            setResultBox(
                "lost",
                "❌",
                `Knapp daneben: Kugel ${guessed + 1} war normal.`,
                `Der Sternensplitter steckte in Kugel ${state.heavyIndex + 1} (oben golden markiert). Starte ein neues Spiel!`
            );
        }

        renderAll();

        const validWins = state.completedRounds.filter((r) => r.won && !r.lucky);
        if (won && !lucky && validWins.length === 3 && !state.certificateAutoShown) {
            state.certificateAutoShown = true;
            setTimeout(openCertificateModal, 550);
        }
    }

    function openCertificateModal() {
        const validWins = state.completedRounds.filter((r) => r.won && !r.lucky);
        if (validWins.length < 3) return;

        const optimalCount = validWins.filter((r) => r.weighings === 2).length;
        if (optimalCount >= 3) {
            certRankEl.textContent = "Königlicher Waffenschmied ⭐";
            certSummaryEl.textContent =
                `Du hast alle ${validWins.length} Prüfungs-Spiele in der kleinstmöglichen Anzahl von nur 2 Wiegungen gemeistert!`;
        } else if (optimalCount >= 1) {
            certRankEl.textContent = "Meister der Balkenwaage 🏆";
            certSummaryEl.textContent =
                `Du hast ${validWins.length} Prüfungs-Spiele erfolgreich gelöst – und dabei die optimale 2-Wiegungen-Strategie bewiesen!`;
        } else {
            certRankEl.textContent = "Geselle der Schmiede ⚒️";
            certSummaryEl.textContent =
                `Du hast ${validWins.length} Prüfungs-Spiele erfolgreich gelöst! Tipp: Es geht sogar garantiert mit nur 2 Wiegungen.`;
        }

        certRoundsEl.innerHTML = "";
        validWins.forEach((win, i) => {
            const pill = document.createElement("div");
            pill.className = "cert-round-pill" + (win.weighings === 2 ? " optimal" : "");
            pill.textContent = `Spiel ${i + 1}: ${win.weighings} Wieg.${win.weighings === 2 ? " ⭐" : " ✓"}`;
            certRoundsEl.appendChild(pill);
        });

        certificateModal.classList.remove("hidden");
    }

    // --- Modals schließen ---
    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-close-modal");
            document.getElementById(id).classList.add("hidden");
        });
    });

    [storyModal, guessModal, certificateModal].forEach((backdrop) => {
        backdrop.addEventListener("click", (e) => {
            if (e.target === backdrop) {
                backdrop.classList.add("hidden");
            }
        });
    });

    // --- Hauptbuttons ---
    weighBtn.addEventListener("click", performWeighing);
    clearScaleBtn.addEventListener("click", clearScale);
    clearLeftBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        clearSinglePan("left");
    });
    clearRightBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        clearSinglePan("right");
    });
    noteModeBtn.addEventListener("click", toggleNoteMode);
    guessBtn.addEventListener("click", openGuessModal);
    confirmGuessBtn.addEventListener("click", submitGuess);
    newGameBtn.addEventListener("click", () => startNewRound(true));
    storyBtn.addEventListener("click", () => storyModal.classList.remove("hidden"));
    openCertBtn.addEventListener("click", openCertificateModal);
    certNewGameBtn.addEventListener("click", () => {
        certificateModal.classList.add("hidden");
        startNewRound(true);
    });
    themeBtn.addEventListener("click", () => {
        applyTheme(state.theme === "dark" ? "light" : "dark");
    });

    // Start
    try {
        const savedTheme = localStorage.getItem("donnerkugeln-theme");
        if (savedTheme === "light" || savedTheme === "dark") {
            applyTheme(savedTheme);
        } else {
            applyTheme("dark");
        }
    } catch (_) {
        applyTheme("dark");
    }
    applyScaleAngle(0);
    startNewRound(false);
})();
