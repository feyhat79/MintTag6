(() => {
    "use strict";

    const DEVICES = [
        { id: "laptop", name: "Computer" },
        { id: "washer", name: "Waschmaschine" },
        { id: "tv", name: "Fernseher" },
        { id: "coffee", name: "Kaffeemaschine" },
        { id: "vacuum", name: "Staubsauger" }
    ];

    // Exakte Verkabelung gemäß Aufgabe 18
    const SWITCHES = {
        A: { id: "A", color: "#f97316", targets: ["tv", "coffee", "vacuum"] },
        B: { id: "B", color: "#3b82f6", targets: ["laptop", "washer", "coffee"] },
        C: { id: "C", color: "#16a34a", targets: ["laptop", "tv", "vacuum"] },
        D: { id: "D", color: "#eab308", targets: ["washer", "tv"] },
        E: { id: "E", color: "#dc2626", targets: ["tv", "vacuum"] }
    };

    const PRESETS = {
        intro: {
            id: "intro",
            title: "Einstieg: Nur den Computer einschalten",
            goalText: "Ziel: Am Ende soll <strong>nur der Computer</strong> eingeschaltet sein (Tipp: 2 Knöpfe genügen!).",
            targets: { laptop: true, washer: false, tv: false, coffee: false, vacuum: false }
        },
        main: {
            id: "main",
            title: "Original-Aufgabe: Fernseher & Kaffeemaschine",
            goalText: "Ziel: Am Ende sollen <strong>nur der Fernseher und die Kaffeemaschine</strong> eingeschaltet sein.",
            targets: { laptop: false, washer: false, tv: true, coffee: true, vacuum: false }
        },
        random: {
            id: "random",
            title: "Zufalls-Challenge: Neue Ziel-Schaltung",
            goalText: "",
            targets: { laptop: false, washer: false, tv: false, coffee: false, vacuum: false }
        }
    };

    const state = {
        currentMode: "main",
        presses: { A: 0, B: 0, C: 0, D: 0, E: 0 },
        hoverSwitch: null,
        pulseSwitch: null,
        pulseTimer: null,
        theme: "dark"
    };

    const themeBtn = document.getElementById("theme-btn");
    const storyBtn = document.getElementById("story-btn");
    const storyModal = document.getElementById("story-modal");

    const modeButtons = document.querySelectorAll(".mode-pill");
    const switchButtons = document.querySelectorAll(".switch-btn");
    const newRandomBtn = document.getElementById("new-random-btn");
    const resetBtn = document.getElementById("reset-btn");

    const circuitTitleEl = document.getElementById("circuit-title");
    const circuitGoalTextEl = document.getElementById("circuit-goal-text");
    const circuitBoardEl = document.getElementById("circuit-board");
    const wiringSvgEl = document.getElementById("wiring-svg");
    const devicesRowEl = document.getElementById("devices-row");

    const resultBannerEl = document.getElementById("result-banner");
    const resultIconEl = document.getElementById("result-icon");
    const resultTitleEl = document.getElementById("result-title");
    const resultDescEl = document.getElementById("result-desc");

    const activeSwitchesEl = document.getElementById("active-switches");
    const onCountEl = document.getElementById("on-count");
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

    function getDeviceState() {
        const result = { laptop: false, washer: false, tv: false, coffee: false, vacuum: false };
        Object.keys(SWITCHES).forEach((swKey) => {
            if (state.presses[swKey] % 2 === 1) {
                SWITCHES[swKey].targets.forEach((devId) => {
                    result[devId] = !result[devId];
                });
            }
        });
        return result;
    }

    function generateRandomChallenge() {
        const keys = ["A", "B", "C", "D", "E"];
        let targets = null;
        let onNames = [];

        // Sicherstellen, dass mindestens 1 und höchstens 4 Geräte an sein sollen
        while (!targets || onNames.length === 0 || onNames.length === 5) {
            const combo = {};
            keys.forEach((k) => {
                combo[k] = Math.random() < 0.5;
            });
            targets = { laptop: false, washer: false, tv: false, coffee: false, vacuum: false };
            keys.forEach((k) => {
                if (combo[k]) {
                    SWITCHES[k].targets.forEach((d) => {
                        targets[d] = !targets[d];
                    });
                }
            });
            onNames = DEVICES.filter((d) => targets[d.id]).map((d) => d.name);
        }

        PRESETS.random.targets = targets;
        const formatted = onNames.length === 1
            ? onNames[0]
            : `${onNames.slice(0, -1).join(", ")} und ${onNames[onNames.length - 1]}`;
        PRESETS.random.goalText = `Ziel: Am Ende sollen nur <strong>${formatted}</strong> eingeschaltet sein.`;
    }

    function createDeviceSvg(devId, isOn) {
        const screenFill = isOn ? "#22d3ee" : "#334155";
        const screenGlow = isOn ? 'stroke="#67e8f9" stroke-width="2"' : 'stroke="#0f172a" stroke-width="2"';

        if (devId === "laptop") {
            return `<svg class="device-svg" viewBox="0 0 84 70" aria-hidden="true">
                <rect x="16" y="12" width="52" height="34" rx="4" fill="#475569" stroke="#0f172a" stroke-width="2"/>
                <rect x="21" y="17" width="42" height="24" rx="2" fill="${screenFill}" ${screenGlow}/>
                <polygon points="10,48 74,48 80,60 4,60" fill="#cbd5e1" stroke="#0f172a" stroke-width="2" stroke-linejoin="round"/>
                <line x1="18" y1="53" x2="66" y2="53" stroke="#64748b" stroke-width="2" stroke-dasharray="4 3"/>
            </svg>`;
        }

        if (devId === "washer") {
            const ledColor = isOn ? "#22c55e" : "#475569";
            return `<svg class="device-svg" viewBox="0 0 84 70" aria-hidden="true">
                <rect x="18" y="8" width="48" height="56" rx="5" fill="#e2e8f0" stroke="#0f172a" stroke-width="2"/>
                <line x1="18" y1="20" x2="66" y2="20" stroke="#475569" stroke-width="1.6"/>
                <circle cx="28" cy="14" r="2.5" fill="${ledColor}"/>
                <circle cx="54" cy="14" r="2.5" fill="#475569"/>
                <circle cx="42" cy="40" r="14" fill="#94a3b8" stroke="#0f172a" stroke-width="2"/>
                <g class="washer-drum">
                    <circle cx="42" cy="40" r="10" fill="${isOn ? "#38bdf8" : "#64748b"}"/>
                    <path d="M35 37 Q42 33 49 39" fill="none" stroke="#e0f2fe" stroke-width="2.2" stroke-linecap="round"/>
                </g>
            </svg>`;
        }

        if (devId === "tv") {
            return `<svg class="device-svg" viewBox="0 0 84 70" aria-hidden="true">
                <rect x="10" y="10" width="64" height="42" rx="4" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>
                <rect x="15" y="15" width="54" height="32" rx="2" fill="${screenFill}" ${screenGlow}/>
                <rect x="36" y="52" width="12" height="7" fill="#334155"/>
                <rect x="26" y="58" width="32" height="5" rx="2.5" fill="#0f172a"/>
            </svg>`;
        }

        if (devId === "coffee") {
            const led = isOn ? "#ef4444" : "#475569";
            const steam = isOn
                ? `<g class="coffee-steam" stroke="#e2e8f0" stroke-width="2" fill="none" stroke-linecap="round">
                       <path d="M38 42 Q35 37 38 33"/>
                       <path d="M46 42 Q49 37 46 33"/>
                   </g>`
                : "";
            return `<svg class="device-svg" viewBox="0 0 84 70" aria-hidden="true">
                <rect x="20" y="12" width="44" height="50" rx="5" fill="#334155" stroke="#0f172a" stroke-width="2"/>
                <rect x="24" y="16" width="36" height="12" rx="2" fill="#1e293b"/>
                <circle cx="54" cy="22" r="2.8" fill="${led}"/>
                <rect x="28" y="32" width="28" height="24" rx="2" fill="#0f172a"/>
                ${steam}
                <path d="M34 45 H50 L48 54 H36 Z" fill="#ffffff" stroke="#475569" stroke-width="1.4"/>
            </svg>`;
        }

        // Staubsauger
        const wind = isOn
            ? `<path d="M12 48 H20 M10 53 H18" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round"/>`
            : "";
        return `<svg class="device-svg" viewBox="0 0 84 70" aria-hidden="true">
            <g class="vacuum-body">
                <path d="M34 48 C34 32 54 32 54 48 L50 56 H38 Z" fill="#dc2626" stroke="#0f172a" stroke-width="2"/>
                <circle cx="48" cy="54" r="6" fill="#475569" stroke="#0f172a" stroke-width="2"/>
                <path d="M42 36 C40 18 28 16 24 30 L18 52" fill="none" stroke="#94a3b8" stroke-width="3.5" stroke-linecap="round"/>
                <polygon points="10,54 24,49 26,57 12,58" fill="#334155" stroke="#0f172a" stroke-width="1.6"/>
                ${wind}
            </g>
        </svg>`;
    }

    function setBanner(variant, icon, title, desc) {
        resultBannerEl.className = `result-banner ${variant}`;
        resultIconEl.textContent = icon;
        resultTitleEl.textContent = title;
        resultDescEl.textContent = desc;
    }

    function renderDevices() {
        const current = getDeviceState();

        devicesRowEl.innerHTML = "";

        DEVICES.forEach((dev) => {
            const isOn = current[dev.id];

            const card = document.createElement("div");
            card.className = "device-card";
            card.dataset.device = dev.id;
            if (isOn) card.classList.add("is-on");

            card.innerHTML = `
                ${createDeviceSvg(dev.id, isOn)}
                <span class="device-name">${dev.name}</span>
                <span class="state-pill ${isOn ? "on" : "off"}">${isOn ? "EIN" : "AUS"}</span>
            `;

            devicesRowEl.appendChild(card);
        });

        requestAnimationFrame(drawWires);
    }

    function drawWires() {
        const SVG_NS = "http://www.w3.org/2000/svg";
        const boardRect = circuitBoardEl.getBoundingClientRect();
        wiringSvgEl.setAttribute("viewBox", `0 0 ${boardRect.width} ${boardRect.height}`);
        wiringSvgEl.innerHTML = "";

        Object.values(SWITCHES).forEach((sw) => {
            const swEl = circuitBoardEl.querySelector(`.switch-btn[data-switch="${sw.id}"]`);
            if (!swEl) return;
            const swRect = swEl.getBoundingClientRect();
            const isTop = sw.id === "A" || sw.id === "B" || sw.id === "C";
            const isActive = state.presses[sw.id] % 2 === 1;

            const x1 = swRect.left - boardRect.left + swRect.width / 2;
            const y1 = isTop
                ? swRect.bottom - boardRect.top - 4
                : swRect.top - boardRect.top + 4;

            const group = document.createElementNS(SVG_NS, "g");
            group.setAttribute("data-switch", sw.id);
            group.style.color = sw.color;

            sw.targets.forEach((devId) => {
                const devEl = circuitBoardEl.querySelector(`.device-card[data-device="${devId}"]`);
                if (!devEl) return;
                const devRect = devEl.getBoundingClientRect();
                const x2 = devRect.left - boardRect.left + devRect.width / 2;
                const y2 = isTop
                    ? devRect.top - boardRect.top + 4
                    : devRect.bottom - boardRect.top - 4;

                const pathData = `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`;

                const wirePath = document.createElementNS(SVG_NS, "path");
                wirePath.setAttribute("d", pathData);
                wirePath.setAttribute("stroke", sw.color);
                wirePath.setAttribute("class", "wire-line");
                group.appendChild(wirePath);

                if (isActive) {
                    const corePath = document.createElementNS(SVG_NS, "path");
                    corePath.setAttribute("d", pathData);
                    corePath.setAttribute("class", "wire-core");
                    group.appendChild(corePath);

                    // 3 feine, ruhige Licht-Kügelchen komplett innerhalb der Leitung
                    const duration = "3.3s";
                    const offsets = ["0s", "-1.1s", "-2.2s"];
                    offsets.forEach((beginOffset) => {
                        const particleGroup = document.createElementNS(SVG_NS, "g");

                        const glow = document.createElementNS(SVG_NS, "circle");
                        glow.setAttribute("r", "2.4");
                        glow.setAttribute("class", "wire-particle-glow");

                        const dot = document.createElementNS(SVG_NS, "circle");
                        dot.setAttribute("r", "1.45");
                        dot.setAttribute("class", "wire-particle");

                        const motion = document.createElementNS(SVG_NS, "animateMotion");
                        motion.setAttribute("dur", duration);
                        motion.setAttribute("repeatCount", "indefinite");
                        motion.setAttribute("begin", beginOffset);
                        motion.setAttribute("path", pathData);

                        const fade = document.createElementNS(SVG_NS, "animate");
                        fade.setAttribute("attributeName", "opacity");
                        fade.setAttribute("values", "0;1;1;0");
                        fade.setAttribute("keyTimes", "0;0.14;0.86;1");
                        fade.setAttribute("dur", duration);
                        fade.setAttribute("repeatCount", "indefinite");
                        fade.setAttribute("begin", beginOffset);

                        particleGroup.appendChild(glow);
                        particleGroup.appendChild(dot);
                        particleGroup.appendChild(motion);
                        particleGroup.appendChild(fade);
                        group.appendChild(particleGroup);
                    });
                }
            });

            wiringSvgEl.appendChild(group);
        });

        updateWireHighlights();
    }

    function updateWireHighlights() {
        const focusSwitch = state.hoverSwitch || state.pulseSwitch;
        wiringSvgEl.querySelectorAll(".wire-group, g[data-switch]").forEach((group) => {
            const id = group.getAttribute("data-switch");
            const isActive = state.presses[id] % 2 === 1;
            const classes = ["wire-group"];
            if (isActive) classes.push("is-active");
            if (state.pulseSwitch === id) classes.push("is-pulse");
            if (focusSwitch) {
                if (focusSwitch === id) {
                    classes.push("is-highlighted");
                } else if (!isActive) {
                    classes.push("is-dimmed");
                }
            }
            group.setAttribute("class", classes.join(" "));
        });
    }

    function renderSwitches() {
        switchButtons.forEach((btn) => {
            const id = btn.dataset.switch;
            const count = state.presses[id];
            const isOdd = count % 2 === 1;
            const countEl = document.getElementById(`count-${id}`);
            countEl.textContent = `${isOdd ? "EIN" : "AUS"} · ${count}×`;
            btn.classList.toggle("is-odd", isOdd);
            btn.setAttribute("aria-pressed", String(isOdd));
        });
    }

    function updateStatusAndBanner() {
        const level = getLevel();
        const current = getDeviceState();
        const activeKeys = Object.keys(SWITCHES).filter((k) => state.presses[k] % 2 === 1);
        const totalPresses = Object.values(state.presses).reduce((a, b) => a + b, 0);
        const onDevices = DEVICES.filter((d) => current[d.id]).map((d) => d.name);

        activeSwitchesEl.textContent = activeKeys.length > 0 ? activeKeys.join(", ") : "Keine";
        onCountEl.textContent = `${onDevices.length} / ${DEVICES.length}`;

        const solved = DEVICES.every((d) => current[d.id] === level.targets[d.id]);

        if (solved) {
            statusBadgeEl.textContent = "Ziel erreicht ✓";
            setBanner(
                "success",
                "🎉",
                `Geschafft! Mit den Knöpfen ${activeKeys.join(" + ")} stimmt die Schaltung exakt!`,
                "Jedes gewünschte Gerät ist eingeschaltet und alle anderen bleiben aus."
            );
            return;
        }

        if (totalPresses === 0) {
            statusBadgeEl.textContent = "Noch offen";
            setBanner(
                "neutral",
                "🔌",
                "Zu Beginn sind alle 5 Geräte ausgeschaltet!",
                "Tippe einen der Knöpfe A bis E an, um alle verbundenen Geräte umzuschalten. Fahre über einen Knopf, um seine Kabel zu markieren."
            );
            return;
        }

        statusBadgeEl.textContent = "Noch offen";
        setBanner(
            "info",
            "⚡",
            `Aktuell eingeschaltet: ${onDevices.length > 0 ? onDevices.join(", ") : "Kein Gerät"}`,
            "Beobachte, welche Geräte reagieren, und teste weitere Knopf-Kombinationen."
        );
    }

    function renderModeControls() {
        const level = getLevel();
        circuitTitleEl.textContent = level.title;
        circuitGoalTextEl.innerHTML = level.goalText;
        newRandomBtn.classList.toggle("hidden", state.currentMode !== "random");

        modeButtons.forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.mode === state.currentMode);
        });
    }

    function renderAll() {
        renderModeControls();
        renderSwitches();
        renderDevices();
        updateStatusAndBanner();
    }

    function resetPresses() {
        Object.keys(state.presses).forEach((k) => {
            state.presses[k] = 0;
        });
        state.pulseSwitch = null;
        renderAll();
    }

    function switchMode(modeId) {
        if (!PRESETS[modeId] || modeId === state.currentMode) return;
        state.currentMode = modeId;
        if (modeId === "random" && !PRESETS.random.goalText) {
            generateRandomChallenge();
        }
        resetPresses();
    }

    switchButtons.forEach((btn) => {
        const id = btn.dataset.switch;
        btn.addEventListener("click", () => {
            state.presses[id] += 1;
            state.pulseSwitch = id;
            if (state.pulseTimer) clearTimeout(state.pulseTimer);
            state.pulseTimer = setTimeout(() => {
                state.pulseSwitch = null;
                updateWireHighlights();
            }, 460);
            renderAll();
        });

        btn.addEventListener("mouseenter", () => {
            state.hoverSwitch = id;
            updateWireHighlights();
        });
        btn.addEventListener("mouseleave", () => {
            if (state.hoverSwitch === id) {
                state.hoverSwitch = null;
                updateWireHighlights();
            }
        });
    });

    modeButtons.forEach((btn) => {
        btn.addEventListener("click", () => switchMode(btn.dataset.mode));
    });

    newRandomBtn.addEventListener("click", () => {
        generateRandomChallenge();
        resetPresses();
    });

    resetBtn.addEventListener("click", resetPresses);

    window.addEventListener("resize", drawWires);

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
