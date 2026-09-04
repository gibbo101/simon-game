/**
 * @jest-environment jsdom
 */

const {
    game, newGame, showScore, addTurn, lightsOn, showTurns, playerTurn,
    getInterval, getLightDuration, normaliseInitials, loadScores, submitScore,
    recordResult, renderScoreboard, refreshScoreboard, bindInitialsInput, initPage,
} = require("../game");

global.Swal = { fire: jest.fn(() => new Promise(() => { })) };

// The leaderboard API is mocked at the fetch level; each test decides what
// the server answers.
function jsonResponse(body, status = 200) {
    return Promise.resolve({ ok: status < 400, status: status, json: () => Promise.resolve(body) });
}

beforeEach(() => {
    global.fetch = jest.fn(() => jsonResponse({ game: "simon", board: "public", scores: [] }));
    Swal.fire.mockClear();
});

beforeAll(() => {
    let fs = require("fs");
    let fileContents = fs.readFileSync("index.html", "utf-8");
    document.open();
    document.write(fileContents);
    document.close();
    localStorage.clear();
});

describe("game object contains correct keys", () => {
    test("score key exists", () => {
        expect("score" in game).toBe(true);
    });
    test("currentGame key exists", () => {
        expect("currentGame" in game).toBe(true);
    });
    test("playerMoves key exists", () => {
        expect("playerMoves" in game).toBe(true);
    });
    test("choices key exists", () => {
        expect("choices" in game).toBe(true);
    });
    test("choices contain the correct ids", () => {
        expect(game.choices).toEqual(["button1", "button2", "button3", "button4"]);
    });
    test("turnNumber key exists", () => {
        expect("turnNumber" in game).toBe(true);
    });
    test("lastButton key exists", () => {
        expect("lastButton" in game).toBe(true);
    });
    test("turnInProgress key exists", () => {
        expect("turnInProgress" in game).toBe(true);
    });
    test("turnInProgress key value is false", () => {
        expect(game.turnInProgress).toBe(false);
    });
});

describe("newGame works correctly", () => {
    beforeAll(() => {
        game.score = 42;
        game.playerMoves = ["button1", "button2"];
        game.currentGame = ["button1", "button2"];
        document.getElementById("score").innerText = "42";
        game.turnNumber = 42;
        newGame();
    })
    test("should set game score to zero", () => {
        expect(game.score).toEqual(0);
    });
    test("should clear the playerMoves array", () => {
        expect(game.playerMoves.length).toBe(0);
    });
    test("should be one element in the computers array", () => {
        expect(game.currentGame.length).toBe(1);
    });    
    test("should display 0 for element with ID of score", () => {
        expect(document.getElementById("score").innerText).toEqual(0);
    });
    test("should set turnNumber to 0", () => {
        expect(game.turnNumber).toEqual(0);
    }); 
    test("expect data-listener to be true", () => {
        const elements = document.getElementsByClassName("circle");
        for (let element of elements) {
            expect(element.getAttribute("data-listener")).toEqual("true");
        };
    }); 
});

describe("gameplay works correctly", () => {
    beforeEach(() => {
        game.score = 0;
        game.currentGame = [];
        game.playerMoves = [];
        addTurn();
    });
    afterEach(() => {
        game.score = 0;
        game.currentGame = [];
        game.playerMoves = [];
    });
    test("Add turn adds a new turn to the game", () => {
        addTurn();
        expect(game.currentGame.length).toBe(2);
    });
    test("should add correct class to light up the buttons", () => {
        let button = document.getElementById(game.currentGame[0]);
        lightsOn(game.currentGame[0]);
        expect(button.classList).toContain("light");
    });
    test("showTurns should update game.turnNumber", () => {
        game.turnNumber = 42;
        showTurns();
        expect(game.turnNumber).toBe(0);
    });
    test("should increment the score if the turn is correct", () => {
        game.playerMoves.push(game.currentGame[0]);
        playerTurn();
        expect(game.score).toBe(1);
    });
    test("should call Swal.fire once the wrong move has been reported", async () => {
        game.playerMoves.push("wrong");
        playerTurn();
        await game.lastResult;
        expect(Swal.fire).toHaveBeenCalled();
    });
    test("should block clicks in the pause before the next sequence plays", () => {
        game.playerMoves.push(game.currentGame[0]);
        playerTurn();
        expect(game.turnInProgress).toBe(true);
    });
    test("should toggle  turnInProgress to true", () => {
        showTurns();
        expect(game.turnInProgress).toBe(true);
    });
    test("clicking during the computer sequence should fail", () => {
        showTurns();
        game.lastButton = "";
        document.getElementById("button2").click();
        expect(game.lastButton).toEqual("");
    });
});

describe("difficulty ramp", () => {
    test("playback is 1000ms at the start", () => {
        expect(getInterval(0)).toBe(1000);
    });
    test("playback speeds up as the score climbs", () => {
        expect(getInterval(5)).toBeLessThan(getInterval(0));
    });
    test("playback never drops below the 400ms floor", () => {
        expect(getInterval(100)).toBe(400);
    });
    test("a lit button always goes dark before the next flash", () => {
        for (let score of [0, 5, 10, 50, 100]) {
            expect(getLightDuration(score)).toBeLessThan(getInterval(score));
        }
    });
});

describe("initials", () => {
    test("are upper-cased and trimmed to three letters", () => {
        expect(normaliseInitials("lrg")).toBe("LRG");
        expect(normaliseInitials(" l-r g ")).toBe("LRG");
        expect(normaliseInitials("lrgx")).toBe("LRG");
    });
    test("fall back to AAA when fewer than three letters are given", () => {
        expect(normaliseInitials("")).toBe("AAA");
        expect(normaliseInitials("lr")).toBe("AAA");
        expect(normaliseInitials("l1g")).toBe("AAA");
        expect(normaliseInitials(undefined)).toBe("AAA");
    });
    test("the input only ever holds upper-case letters", () => {
        let input = document.getElementById("player-initials");
        bindInitialsInput();
        input.value = "a1b-c2d";
        input.dispatchEvent(new Event("input"));
        expect(input.value).toBe("ABC");
    });
    test("a new game reads the initials from the input and remembers them", () => {
        localStorage.clear();
        document.getElementById("player-initials").value = "grc";
        newGame();
        expect(game.initials).toBe("GRC");
        expect(document.getElementById("player-initials").value).toBe("GRC");
        expect(localStorage.getItem("simonInitials")).toBe("GRC");
    });
    test("remembered initials are restored on load", () => {
        localStorage.setItem("simonInitials", "ADA");
        document.getElementById("player-initials").value = "";
        bindInitialsInput();
        expect(document.getElementById("player-initials").value).toBe("ADA");
    });
});

describe("global leaderboard", () => {
    const rows = [
        { rank: 1, name: "GRC", score: 9 },
        { rank: 2, name: "ADA", score: 3 },
    ];

    test("loads the board from the arcade api", async () => {
        fetch.mockImplementationOnce(() => jsonResponse({ game: "simon", board: "public", scores: rows }));
        await expect(loadScores()).resolves.toEqual(rows);
        expect(fetch.mock.calls[0][0]).toBe("https://critticwars.com/api/arcade/simon/scores");
        expect(fetch.mock.calls[0][1].method).toBe("GET");
    });
    test("renders ranked entries", () => {
        renderScoreboard(rows);
        let items = document.querySelectorAll("#scoreboard-list li");
        expect(items).toHaveLength(2);
        expect(items[0].querySelector(".rank").textContent).toBe("1");
        expect(items[0].querySelector(".name").textContent).toBe("GRC");
        expect(items[0].querySelector(".pts").textContent).toBe("9");
    });
    test("escapes anything the server sends as a name", () => {
        renderScoreboard([{ rank: 1, name: "<b>", score: 1 }]);
        expect(document.querySelector("#scoreboard-list .name").innerHTML).toBe("&lt;b&gt;");
    });
    test("shows an empty message when nobody has played", async () => {
        await refreshScoreboard();
        expect(document.getElementById("scoreboard-list").textContent).toMatch(/No scores yet/);
    });
    test("shows an unavailable message when the api cannot be reached", async () => {
        fetch.mockImplementationOnce(() => Promise.reject(new Error("offline")));
        await refreshScoreboard();
        expect(document.getElementById("scoreboard-list").textContent).toMatch(/unavailable/);
    });
    test("submits initials and score as json", async () => {
        fetch.mockImplementationOnce(() =>
            jsonResponse({ entry: { name: "LRG", score: 4, rank: 1, improved: true }, scores: rows }, 201)
        );
        await submitScore("lrg", 4);
        let [url, options] = fetch.mock.calls[0];
        expect(url).toBe("https://critticwars.com/api/arcade/simon/scores");
        expect(options.method).toBe("POST");
        expect(options.headers["Content-Type"]).toBe("application/json");
        expect(JSON.parse(options.body)).toEqual({ initials: "LRG", score: 4 });
    });
    test("a wrong move sends the score to the board and reports the rank", async () => {
        fetch.mockImplementationOnce(() =>
            jsonResponse({ entry: { name: "GRC", score: 4, rank: 2, improved: true }, scores: rows }, 201)
        );
        game.initials = "GRC";
        game.score = 4;
        game.currentGame = ["button1"];
        game.playerMoves = ["button2"];
        playerTurn();
        await game.lastResult;
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ initials: "GRC", score: 4 });
        expect(Swal.fire.mock.calls[0][0].text).toMatch(/GRC scored 4.*#2/);
        expect(document.querySelectorAll("#scoreboard-list li")).toHaveLength(2);
    });
    test("a run that does not beat the personal best says so", async () => {
        fetch.mockImplementationOnce(() =>
            jsonResponse({ entry: { name: "GRC", score: 9, rank: 1, improved: false }, scores: rows }, 200)
        );
        await recordResult("GRC", 2);
        expect(Swal.fire.mock.calls[0][0].text).toMatch(/best is still 9/);
    });
    test("an unreachable board is reported rather than silently dropped", async () => {
        fetch.mockImplementationOnce(() => jsonResponse({ message: "Too Many Attempts." }, 429));
        await recordResult("GRC", 2);
        expect(Swal.fire.mock.calls[0][0].text).toMatch(/wasn't recorded/);
    });
    test("the hosting page can point the game at another board", async () => {
        global.SIMON_CONFIG = {
            scoresUrl: "/api/arcade/simon/players",
            fetchOptions: { credentials: "same-origin", headers: { "X-CSRF-TOKEN": "abc" } },
        };
        try {
            await loadScores();
            let [url, options] = fetch.mock.calls[0];
            expect(url).toBe("/api/arcade/simon/players");
            expect(options.credentials).toBe("same-origin");
            expect(options.headers["X-CSRF-TOKEN"]).toBe("abc");
            expect(options.headers.Accept).toBe("application/json");
        } finally {
            delete global.SIMON_CONFIG;
        }
    });
    test("initPage restores initials and loads the board", async () => {
        fetch.mockImplementationOnce(() => jsonResponse({ game: "simon", board: "public", scores: rows }));
        await initPage();
        expect(document.querySelectorAll("#scoreboard-list li")).toHaveLength(2);
    });
});
