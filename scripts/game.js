let game = {
    score: 0,
    currentGame: [],
    playerMoves: [],
    turnNumber: 0,
    lastButton: "",
    turnInProgress: false,
    initials: "AAA",
    choices: ["button1", "button2", "button3", "button4"],
};


// --- Difficulty --------------------------------------------------------------
// Playback speeds up as the score climbs, with a floor so it stays playable.
function getInterval(score) {
    return Math.max(400, 1000 - score * 60);
}

// How long a button stays lit. Kept to a fraction of the interval so there is
// always a dark gap between flashes — otherwise, at the speed floor, a repeated
// button would blur into a single continuous light.
function getLightDuration(score) {
    return Math.round(getInterval(score) * 0.4);
}

// --- Sound -------------------------------------------------------------------
// One tone per button via the Web Audio API — no audio files needed. Guarded so
// it silently no-ops where AudioContext is unavailable (e.g. jsdom/tests).
const TONES = { button1: 329.63, button2: 261.63, button3: 220.0, button4: 164.81 };
let audioCtx = null;

function audioContextClass() {
    return typeof AudioContext !== "undefined" ? AudioContext
        : typeof webkitAudioContext !== "undefined" ? webkitAudioContext
        : null;
}

// Browsers block audio until a user gesture. Called from the New game click so
// the computer's first playback (which runs on a timer) isn't silent.
function unlockAudio() {
    let Ctx = audioContextClass();
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended" && audioCtx.resume) audioCtx.resume();
}

function playSound(circ) {
    let Ctx = audioContextClass();
    if (!Ctx || !TONES[circ]) return;
    if (!audioCtx) audioCtx = new Ctx();
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = TONES[circ];
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
}

// --- Leaderboard -------------------------------------------------------------
// The board lives on the CritticWars arcade API: one entry per set of initials,
// holding their best score. The hosting page may point the game at a different
// endpoint (and add fetch options such as credentials or headers) by defining
// SIMON_CONFIG before this script loads.
const DEFAULT_SCORES_URL = "https://critticwars.com/api/arcade/simon/scores";
const DEFAULT_INITIALS = "AAA";
const INITIALS_KEY = "simonInitials";

function scoresUrl() {
    return (typeof SIMON_CONFIG !== "undefined" && SIMON_CONFIG.scoresUrl) || DEFAULT_SCORES_URL;
}

function fetchOptions(options) {
    let base = typeof SIMON_CONFIG !== "undefined" ? SIMON_CONFIG.fetchOptions || {} : {};
    return Object.assign({}, base, options, {
        headers: Object.assign({ Accept: "application/json" }, base.headers, options.headers),
    });
}

// Initials are exactly three letters, always upper-case, like an arcade
// cabinet. Anything that doesn't yield three letters falls back to AAA so a
// blank or mistyped entry never blocks a game.
function normaliseInitials(raw) {
    let letters = String(raw || "").toUpperCase().replace(/[^A-Z]/g, "");
    return letters.length >= 3 ? letters.slice(0, 3) : DEFAULT_INITIALS;
}

function rememberInitials(initials) {
    try {
        localStorage.setItem(INITIALS_KEY, initials);
    } catch (e) {
        // storage unavailable (e.g. private browsing) — nothing to remember
    }
}

function recallInitials() {
    try {
        return localStorage.getItem(INITIALS_KEY) || "";
    } catch (e) {
        return "";
    }
}

async function loadScores() {
    let response = await fetch(scoresUrl(), fetchOptions({ method: "GET" }));
    if (!response.ok) throw new Error(`Leaderboard request failed (${response.status})`);
    let data = await response.json();
    return data.scores || [];
}

async function submitScore(initials, score) {
    let response = await fetch(
        scoresUrl(),
        fetchOptions({
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initials: normaliseInitials(initials), score: score }),
        })
    );
    if (!response.ok) throw new Error(`Score submission failed (${response.status})`);
    return response.json();
}

function renderScoreboard(rows, status) {
    let list = document.getElementById("scoreboard-list");
    if (!list) return;
    if (status === "loading") {
        list.innerHTML = '<li class="scoreboard-status">Loading…</li>';
        return;
    }
    if (status === "error") {
        list.innerHTML = '<li class="scoreboard-status">Leaderboard unavailable</li>';
        return;
    }
    if (!rows || rows.length === 0) {
        list.innerHTML = '<li class="scoreboard-status">No scores yet — be the first!</li>';
        return;
    }
    list.innerHTML = rows
        .map(
            (s, i) =>
                `<li><span class="rank">${s.rank || i + 1}</span><span class="name">${escapeHtml(
                    s.name
                )}</span><span class="pts">${s.score}</span></li>`
        )
        .join("");
}

async function refreshScoreboard() {
    renderScoreboard([], "loading");
    try {
        renderScoreboard(await loadScores());
    } catch (e) {
        renderScoreboard([], "error");
    }
}

// Sends a finished game to the board and tells the player where they stand.
// A board that can't be reached is reported, never silently dropped.
async function recordResult(initials, score) {
    let title = "Game over!";
    let text;
    try {
        let result = await submitScore(initials, score);
        renderScoreboard(result.scores);
        let entry = result.entry;
        text = entry.improved
            ? `${initials} scored ${score}. New personal best — #${entry.rank} on the board!`
            : `${initials} scored ${score}. Your best is still ${entry.score} (#${entry.rank}).`;
    } catch (e) {
        text = `${initials} scored ${score}. Couldn't reach the leaderboard, so this one wasn't recorded.`;
    }
    Swal.fire({ icon: "error", position: "center", title: title, text: text });
}

// Keeps the initials field to upper-case letters as the player types.
function bindInitialsInput() {
    let input = document.getElementById("player-initials");
    if (!input) return;
    input.value = recallInitials();
    input.addEventListener("input", () => {
        input.value = input.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
    });
}

function initPage() {
    bindInitialsInput();
    return refreshScoreboard();
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
}

// --- Game flow ---------------------------------------------------------------
function newGame() {
    game.score = 0;
    game.currentGame = [];
    game.playerMoves = [];
    game.turnNumber = 0;
    game.lastButton = "";
    game.turnInProgress = true;

    let input = document.getElementById("player-initials");
    game.initials = normaliseInitials(input ? input.value : "");
    if (input) input.value = game.initials;
    rememberInitials(game.initials);

    unlockAudio();

    for (let circle of document.getElementsByClassName("circle")) {
        if (circle.getAttribute("data-listener") !== "true") {
            circle.addEventListener("click", handlePlayerClick);
            circle.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handlePlayerClick(e);
                }
            });
            circle.setAttribute("data-listener", "true");
        }
    }
    showScore();
    addTurn();
}

function handlePlayerClick(e) {
    if (game.currentGame.length > 0 && !game.turnInProgress) {
        let move = e.currentTarget.getAttribute("id");
        game.lastButton = move;
        lightsOn(move);
        game.playerMoves.push(move);
        playerTurn();
    }
}

function addTurn() {
    game.playerMoves = [];
    game.currentGame.push(game.choices[Math.floor(Math.random() * 4)]);
    showTurns();
}

function showScore() {
    document.getElementById("score").innerText = game.score;
}

function lightsOn(circ) {
    document.getElementById(circ).classList.add("light");
    playSound(circ);
    setTimeout(() => {
        document.getElementById(circ).classList.remove("light");
    }, getLightDuration(game.score));
}

function showTurns() {
    game.turnInProgress = true;
    game.turnNumber = 0;
    let turns = setInterval(() => {
        lightsOn(game.currentGame[game.turnNumber]);
        game.turnNumber++;
        if (game.turnNumber >= game.currentGame.length) {
            clearInterval(turns);
            game.turnInProgress = false;
        }
    }, getInterval(game.score));
}

function playerTurn() {
    let i = game.playerMoves.length - 1;
    if (game.currentGame[i] === game.playerMoves[i]) {
        if (game.currentGame.length == game.playerMoves.length) {
            game.score++;
            showScore();
            game.turnInProgress = true;
            setTimeout(() => {
                addTurn();
            }, 1000);
        }
    } else {
        game.turnInProgress = true;
        game.lastResult = recordResult(game.initials, game.score);
    }
}

if (typeof module !== "undefined") {
    module.exports = {
        game,
        newGame,
        showScore,
        addTurn,
        lightsOn,
        showTurns,
        playerTurn,
        handlePlayerClick,
        getInterval,
        getLightDuration,
        normaliseInitials,
        loadScores,
        submitScore,
        recordResult,
        renderScoreboard,
        refreshScoreboard,
        bindInitialsInput,
        initPage,
    };
}
