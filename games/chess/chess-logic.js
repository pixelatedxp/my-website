let board   = null;
let game    = new Chess();
let stockfish = null;
let playerTurn = true;

let lastEval    = 0;
let currentEval = 0;
let moveCount   = 0;
let lastPlayerMove = null;

let hintsUsed = 0;
let askingForHint = false;
let hintUsedThisTurn = false;

let lastCommentTime = 0;
let lastCommentMove = 0;
const TIME_COOLDOWN = 4000;
const MOVE_COOLDOWN = 3;

let onceFlags = { endgame: false, earlyQueen: false, opening: false };

const botChat    = document.getElementById('botChat');
const moveHistEl = document.getElementById('moveHistory');
const statusEl   = document.getElementById('gameStatus');

const quotes = {
    start: [
        "Welcome to the lab. Sitting at 1500 Elo. Your move.",
        "1500 Elo. Let's see what you've got.",
        "White, right? You have the advantage. For now.",
        "I've been waiting. Show me something interesting.",
        "Let's play. Don't disappoint me.",
        "A new game. Try to last a bit longer this time."
    ],
    win: [
        "Checkmate. As expected.",
        "Game over. That was swift.",
        "You fought well. Just not well enough.",
        "That's mate. Thanks for the game.",
        "Did you really think that would work? Checkmate.",
        "I saw that mate 5 moves ago."
    ],
    lose: [
        "Wait… how? Beginner's luck.",
        "I let you win. Clearly.",
        "Impressive. Genuinely. Don't expect it again.",
        "You got me. I miscalculated.",
        "Well played. That was actually good.",
        "I didn't see that coming. Checkmate."
    ],
    draw: [
        "Playing for a draw? Cowardly.",
        "We've been here before. Repetition.",
        "Repetition. Bold strategy.",
        "A draw. Boring.",
        "We're equal. For now.",
        "Neither of us can break through. Draw."
    ],
    queenThreat: [
        "Threatening my queen? Cute.",
        "I see you looking at my queen.",
        "You want the queen, don't you?",
        "Watch where you point that piece.",
        "My queen is fine right where she is.",
        "A bold threat."
    ],
    check: {
        winning: ["Check. I've got you running.", "Watch your king.", "Check. It's tightening.", "You're cornered.", "Pressure is on.", "Check. Everywhere you go, I'm there."],
        losing:  ["Check. Annoying.", "Fine, check.", "Pushing me back.", "Trying to force something?", "Check. I'll just step aside.", "You're fighting hard."],
        neutral: ["Check.", "Checking already?", "You're pushing.", "Feeling brave.", "Watch your king.", "Check. Let's see your response."]
    },
    brilliant: [
        "Okay, I didn't expect that.",
        "That's a brilliant move.",
        "Nicely calculated.",
        "Wow. I'll give you that.",
        "Wait, that actually works. Impressive.", // High eval swing
        "I completely missed that. Good job."
    ],
    blunder: {
        winning: ["Are you sure about that?", "Blunders are free. Take more.", "That's… questionable.", "Interesting, if you enjoy losing.", "You just threw the game away.", "Thanks for the free advantage.", "Did your mouse slip?"],
        losing: ["Wait, did you just blunder?", "You're giving me a chance?", "That was a mistake.", "I'll take that gift.", "You had the win and you played that?", "Letting me back in the game?"]
    },
    good: {
        winning: ["Decent move, but not enough.", "Nice try.", "Solid, but I'm still ahead.", "You see it, but it's too late.", "Good move. Won't save you."],
        losing: ["Yeah, that's strong.", "You're suffocating me.", "I can't find a way out.", "Very solid play.", "This is getting difficult.", "I hate that move."],
        neutral: ["Nice move.", "That's decent.", "Hmm. Solid.", "I see what you're doing.", "Good positional play.", "Developing nicely."]
    },
    mistake: {
        winning: ["Another mistake. This is too easy.", "You're falling apart.", "That felt like a mistake.", "Mm. That will hurt.", "Inaccuracy.", "You're playing into my hands."],
        losing: ["A mistake? Finally.", "You're slipping.", "That wasn't your best move.", "I might have a chance now.", "Not the most accurate.", "You're letting the pressure get to you."]
    },
    captureQueen: {
        winning: ["Got your queen.", "The queen falls.", "I'll be taking that queen.", "Your most powerful piece, gone.", "Say goodbye to the lady.", "Thanks for the queen."],
        losing: ["You took my queen?!", "There goes my queen...", "Okay, that hurts.", "I needed that queen.", "Well... this is grim.", "You're ruthless."]
    },
    capturePiece: {
        winning: ["I'll take that.", "Thanks for the piece.", "Mine now.", "Another piece off the board.", "You're losing material.", "I'm just gobbling everything."],
        losing: ["I'll let that one go.", "You're getting aggressive.", "Alright. I see how it is.", "You actually saw that.", "Trading down?", "Losing pieces... not good."],
        neutral: ["A piece comes off the board.", "Trades.", "Simplifying?", "Material exchange.", "I see, taking the piece."]
    },
    capturePawn: {
        winning: ["A pawn. Thanks.", "Small wins add up.", "Every pawn counts.", "Snacking on pawns.", "I'll take the pawn.", "Free pawn."],
        losing: ["Taking pawns while I attack?", "A pawn? Generous.", "I guess you wanted that pawn.", "Small annoyance.", "You take a pawn, I take the game?", "Go ahead, take the pawn."],
        neutral: ["Pawn taken.", "Capturing a pawn.", "A slight imbalance now.", "Trading pawns.", "A tiny advantage."]
    },
    endgame: ["Endgame now.", "Let's see your technique.", "This is where games are decided.", "Few pieces left. Pure calculation now.", "The board is clear. Let's finish this."],
    earlyQueen: ["Bringing the queen out early? Bold.", "Early queen? Risky…", "Bold… or reckless. We'll see.", "The queen is out. Don't let her get trapped.", "Aggressive start. I respect it."],
    castling: ["Castling. Smart king safety.", "Playing it safe.", "Running away already?", "Good instinct.", "Tucking the king away.", "Solidifying the defense."],
    promotion: ["You promoted. Respect… kind of.", "A new queen joins the fray.", "That pawn made it all the way.", "Promotion. Dangerous.", "You let that pawn make it?"],
    hint: [
        "Need help already?",
        "Asking Stockfish for help? Pathetic.",
        "I saw that move too.",
        "You really can't see it yourself?",
        "Using a hint. I'll note that.",
        "Sure, let the machine play for you.",
        "I guess calculation isn't your strong suit.",
        "Stockfish says... wait, you should figure it out.",
        "Are you learning anything from this?",
        "A hint? Really?",
        "I can wait while your engine thinks.",
        "Do you want me to literally flip the board for you?",
        "Oh, taking the coward's way out."
    ]
};

function pick(arr) {
    if (!arr || arr.length === 0) return "...";
    return arr[Math.floor(Math.random() * arr.length)];
}

function getToneArray(obj) {
    if (Array.isArray(obj)) return obj;

    if (lastEval > 150 && obj.losing) return obj.losing;

    if (lastEval < -150 && obj.winning) return obj.winning;
    return obj.neutral || obj.losing || obj.winning;
}

function say(text, force = false) {
    const now = Date.now();
    if (!force) {
        if (now - lastCommentTime < TIME_COOLDOWN) return;
        if (moveCount - lastCommentMove < MOVE_COOLDOWN) return;
    }
    lastCommentTime = now;
    lastCommentMove = moveCount;

    botChat.style.opacity = '0.4';
    setTimeout(() => { botChat.innerText = text; botChat.style.opacity = '1'; }, 80);
}

function updateHistory() {
    const hist = game.history();
    const resBtn = document.getElementById('resignBtn');
    const controls = document.getElementById('controlsRow');

    if (hist.length > 0) {
        controls.style.opacity = '1';
        controls.style.pointerEvents = 'auto';
    }
    if (hist.length >= 8) {
        resBtn.disabled = false;
        resBtn.title = '';
    }

    let html = '<div class="move-history-header">Move History</div>';
    for (let i = 0; i < hist.length; i += 2) {
        html += `<div class="move-row">
            <span class="num">${Math.floor(i/2 + 1)}.</span>
            <span class="white-move">${hist[i]}</span>
            <span class="black-move">${hist[i+1] || ''}</span>
        </div>`;
    }
    moveHistEl.innerHTML = html;
    moveHistEl.scrollTop = moveHistEl.scrollHeight;
}

function updateCapturedPieces() {
    const fen = game.fen().split(' ')[0];
    const initial = { p: 8, n: 2, b: 2, r: 2, q: 1, P: 8, N: 2, B: 2, R: 2, Q: 1 };
    const current = { p: 0, n: 0, b: 0, r: 0, q: 0, P: 0, N: 0, B: 0, R: 0, Q: 0 };
    for (let char of fen) {
        if (current[char] !== undefined) current[char]++;
    }

    let whiteCaptured = [];
    ['q','r','b','n','p'].forEach(p => {
        let diff = initial[p] - current[p];
        for (let i = 0; i < diff; i++) {
            whiteCaptured.push(`<img src="https://chessboardjs.com/img/chesspieces/wikipedia/b${p.toUpperCase()}.png" class="captured-piece">`);
        }
    });

    let blackCaptured = [];
    ['Q','R','B','N','P'].forEach(p => {
        let diff = initial[p] - current[p];
        for (let i = 0; i < diff; i++) {
            blackCaptured.push(`<img src="https://chessboardjs.com/img/chesspieces/wikipedia/w${p}.png" class="captured-piece">`);
        }
    });

    document.getElementById('playerCaptured').innerHTML = whiteCaptured.join('');
    document.getElementById('botCaptured').innerHTML = blackCaptured.join('');
}

function setStatus(text) { statusEl.innerText = text; }

function updateEvalBar(evalCp) {
    const container = document.getElementById('evalContainer');
    if (!document.getElementById('evalToggle').checked) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';

    let fillPct = 50 + (evalCp / 10);
    fillPct = Math.max(0, Math.min(100, fillPct));

    document.getElementById('evalFill').style.height = fillPct + '%';

    let displayScore = (Math.abs(evalCp) / 100).toFixed(1);
    if (evalCp > 0) displayScore = '+' + displayScore;
    else if (evalCp < 0) displayScore = '-' + displayScore;

    document.getElementById('evalScore').innerText = displayScore;
}

const NAMED_OPENINGS = [
    { moves: ['e4','e5','Nf3','Nc6','Bc4'],          name: 'Italian Game' },
    { moves: ['e4','e5','Nf3','Nc6','Bb5'],          name: 'Ruy Lopez' },
    { moves: ['e4','c5'],                             name: 'Sicilian Defense' },
    { moves: ['e4','e6'],                             name: 'French Defense' },
    { moves: ['e4','c6'],                             name: 'Caro-Kann' },
    { moves: ['d4','d5','c4'],                        name: "Queen's Gambit" },
    { moves: ['d4','Nf6','c4','g6'],                  name: "King's Indian" },
    { moves: ['d4','Nf6','Nf3','d5','Bf4'],           name: 'London System' },
    { moves: ['Nf3','d5','g3'],                       name: "King's Indian Attack" },
    { moves: ['e4','e5','Nf3','Nf6'],                 name: "Petrov's Defense" },
    { moves: ['d4','d5','c4','e6','Nc3','Nf6','Bg5'], name: 'Orthodox QGD' },
];

function detectOpening() {
    const hist = game.history();
    for (const op of NAMED_OPENINGS) {
        if (op.moves.every((m, i) => hist[i] === m)) return op.name;
    }
    return null;
}

function threatensQueen(boardStateFen) {
    if (!onceFlags.queenThreat) onceFlags.queenThreat = 0;
    if (onceFlags.queenThreat > 2) return false;

    let tokens = boardStateFen.split(' ');
    tokens[1] = 'w';
    tokens[3] = '-';
    let shadow = new Chess(tokens.join(' '));
    if (!shadow) return false;
    let moves = shadow.moves({verbose: true});
    return moves.some(m => m.captured === 'q');
}

function processPlayerMoveWithEval(evalCp, move) {
    const delta = evalCp - lastEval;

    if (delta >= 200) {
        say(pick(getToneArray(quotes.brilliant)), true);
        lastEval = evalCp;
        return;
    } else if (delta <= -200) {
        say(pick(getToneArray(quotes.blunder)), true);
        lastEval = evalCp;
        return;
    }

    if (move.captured === 'q') {
        say(pick(getToneArray(quotes.captureQueen)), true);
        lastEval = evalCp;
        return;
    }

    if (threatensQueen(game.fen())) {
        say(pick(quotes.queenThreat), true);
        onceFlags.queenThreat++;
        lastEval = evalCp;
        return;
    }

    const prevSide = lastEval >= 50 ? 'player' : (lastEval <= -50 ? 'bot' : 'even');
    const nowSide  = evalCp  >= 50 ? 'player' : (evalCp  <= -50 ? 'bot' : 'even');
    if (prevSide !== nowSide && Math.abs(delta) >= 150) {
        say(pick(["That changes things.", "Momentum just flipped.", "The tide turns."]));
        lastEval = evalCp;
        return;
    }

    if (delta >= 100) {
        say(pick(getToneArray(quotes.good)));
    } else if (delta <= -100) {
        say(pick(getToneArray(quotes.mistake)));
    }

    else if (move.captured) {
        if (['r','b','n'].includes(move.captured)) {
            say(pick(getToneArray(quotes.capturePiece)));
        } else {
            say(pick(getToneArray(quotes.capturePawn)));
        }
    } else if (move.flags && move.flags.includes('k')) {
        say(pick(quotes.castling));
    } else if (moveCount === 1) {
        const m = move.san;
        if (m === 'e4')  say(pick(["Classic. Let's see where this goes.", "e4. Predictable, but solid."]));
        else if (m === 'd4')  say(pick(["d4. A queen's pawn player.", "Solid opening. I respect it."]));
        else if (m === 'c4')  say(pick(["The English. Curious.", "c4. Flexible… or evasive?"]));
        else if (m === 'Nf3') say(pick(["Knight first. Classical.", "Developing. Smart."]));
        else say(pick(["Unusual…", "That's a choice.", "Interesting start."]));
    } else if (!onceFlags.opening && moveCount >= 5 && moveCount <= 9) {
        const opening = detectOpening();
        if (opening) {
            say(pick([`The ${opening}. Classic.`, `${opening}. I know this one.`, `${opening} — we're playing properly.`]));
            onceFlags.opening = true;
        }
    } else if (!onceFlags.earlyQueen && move.piece === 'q' && moveCount <= 9) {
        say(pick(quotes.earlyQueen));
        onceFlags.earlyQueen = true;
    }

    lastEval = evalCp;
}

function processBotMove(move) {
    if (game.in_checkmate()) {
        say(pick(quotes.win), true);
        setStatus('Checkmate! Pixel wins.');
        return;
    }
    if (game.in_draw()) {
        say(pick(quotes.draw), true);
        setStatus('Draw.');
        return;
    }
    if (game.in_check()) {
        say(pick(getToneArray(quotes.check)), true);
        setStatus("Check! Your King is attacked.");
        return;
    }

    if (move.captured) {
        if (move.captured === 'q')      say(pick(getToneArray(quotes.captureQueen)), true);
        else if (['r','b','n'].includes(move.captured)) say(pick(getToneArray(quotes.capturePiece)));
        else                            say(pick(getToneArray(quotes.capturePawn)));
    }

    else if (move.flags && move.flags.includes('p')) {
        say(pick(quotes.promotion));
    }

    if (!onceFlags.endgame && moveCount > 30) {
        const pieces = game.fen().split(' ')[0].replace(/[^rnbqkpRNBQKP]/g, '');
        if (pieces.length <= 10) {
            say(pick(quotes.endgame), true);
            onceFlags.endgame = true;
        }
    }
    hintUsedThisTurn = false;
    setStatus('White to move.');
}

let waitingForEval = false;

function initEngine() {
    try {
        stockfish = new Worker('stockfish.js');
        stockfish.onmessage = function(e) {
            const msg = e.data;
            if (typeof msg !== 'string') return;

            if (msg.startsWith('info') && msg.includes('score cp')) {
                const match = msg.match(/score cp (-?\d+)/);
                if (match) {
                    currentEval = parseInt(match[1]);
                    if (!playerTurn) currentEval = -currentEval;
                    updateEvalBar(currentEval);
                }
            } else if (msg.startsWith('info') && msg.includes('score mate')) {

                const match = msg.match(/score mate (-?\d+)/);
                if (match) {
                    let m = parseInt(match[1]);

                    currentEval = m > 0 ? 10000 : -10000;
                    if (!playerTurn) currentEval = -currentEval;
                    updateEvalBar(currentEval);
                }
            }

            if (msg.startsWith('bestmove')) {
                if (askingForHint) {
                    askingForHint = false;
                    const mv = msg.split(' ')[1];
                    if (mv && mv !== '(none)') {
                        $('.square-55d63').removeClass('highlight-hint');
                        $('.square-' + mv.slice(0, 2)).addClass('highlight-hint');
                        $('.square-' + mv.slice(2, 4)).addClass('highlight-hint');
                    }
                } else if (waitingForEval) {
                    waitingForEval = false;
                    processPlayerMoveWithEval(currentEval, lastPlayerMove);
                    askEngineMove();
                } else {
                    const mv = msg.split(' ')[1];
                    if (mv && mv !== '(none)') {
                        const move = game.move({
                            from: mv.slice(0, 2),
                            to:   mv.slice(2, 4),
                            promotion: 'q'
                        });
                        if (move) {
                            moveCount++;
                            board.position(game.fen());
                            updateHistory();
                            updateCapturedPieces();
                            playerTurn = true;
                            processBotMove(move);
                        }
                    }
                }
            }
        };
        stockfish.postMessage('uci');
        stockfish.postMessage('setoption name Skill Level value 7');
        stockfish.postMessage('isready');
        setStatus('White to move.');
    } catch(err) {
        console.error('Engine error:', err);
        setStatus('Engine Error. Playing local mode.');
    }
}

function askEngineEvalThenMove() {
    if (!stockfish) return;
    setStatus('Thinking...');
    waitingForEval = true;
    stockfish.postMessage('position fen ' + game.fen());
    stockfish.postMessage('go depth 8');
}

function askEngineMove() {
    if (!stockfish) return;
    stockfish.postMessage('position fen ' + game.fen());
    stockfish.postMessage('go depth 12');
}

function onDragStart(source, piece) {
    if (!playerTurn)      return false;
    if (game.game_over()) return false;
    if (piece.startsWith('b')) return false;

    $('.square-55d63').removeClass('highlight-hint');
    return true;
}

function onDrop(source, target) {
    const move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';

    playerTurn = false;
    moveCount++;
    lastPlayerMove = move;
    updateHistory();
    updateCapturedPieces();

    if (game.in_checkmate()) {
        say(pick(quotes.lose), true);
        setStatus('Checkmate! You win.');
        return;
    }
    if (game.in_draw()) {
        say(pick(quotes.draw), true);
        setStatus("Draw.");
        return;
    }
    if (game.in_check()) {
        say(pick(getToneArray(quotes.check)), true);
        setStatus("Check! Your King is attacked.");
    } else if (move.flags && move.flags.includes('p')) {
        say(pick(quotes.promotion));
    }

    if (!game.game_over()) {
        askEngineEvalThenMove();
    }
}

function onSnapEnd() { board.position(game.fen()); }

board = Chessboard('myBoard', {
    draggable:   true,
    position:    'start',
    onDragStart: onDragStart,
    onDrop:      onDrop,
    onSnapEnd:   onSnapEnd,
    pieceTheme:  'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
});

initEngine();

document.getElementById('evalToggle').addEventListener('change', () => {
    updateEvalBar(currentEval);
});

document.getElementById('resetBtn').addEventListener('click', () => {
    game = new Chess();
    board.start();
    playerTurn = true;
    moveCount  = 0;
    lastEval   = 0;
    lastCommentTime = 0;
    lastCommentMove = 0;
    waitingForEval = false;
    hintsUsed = 0;
    askingForHint = false;
    hintUsedThisTurn = false;
    onceFlags = { endgame: false, earlyQueen: false, opening: false, queenThreat: 0 };

    $('.square-55d63').removeClass('highlight-hint');
    const controls = document.getElementById('controlsRow');
    controls.style.opacity = '0';
    controls.style.pointerEvents = 'none';

    const resBtn = document.getElementById('resignBtn');
    resBtn.disabled = true;
    resBtn.title = 'Available after 4 moves';

    updateHistory();
    updateCapturedPieces();
    updateEvalBar(0);
    setStatus('White to move.');
    say(pick(["New game. Let's see if you've improved.", "Again? Bold.", "Fresh board. Same result, probably."]), true);
});

document.getElementById('resignBtn').addEventListener('click', () => {
    if (!game.game_over() && playerTurn) {
        document.getElementById('resignBtn').disabled = true;
        document.getElementById('hintBtn').disabled = true;
        setStatus('You resigned. Pixel wins.');
        say(pick(["Smart. Accepting the inevitable.", "Fair enough.", "I'll take it.", "Checkmate was around the corner anyway."]), true);
        playerTurn = false;

        setTimeout(() => {
            document.getElementById('resetBtn').click();
        }, 1500);
    }
});

document.getElementById('hintBtn').addEventListener('click', () => {
    if (!playerTurn || game.game_over()) return;
    if (askingForHint || !stockfish || hintUsedThisTurn) return;

    hintsUsed++;
    hintUsedThisTurn = true;
    let msg = pick(quotes.hint);
    if (hintsUsed >= 3) {
        msg = pick([
            "Another hint? Unbelievable.",
            "At this point, just let Stockfish play.",
            "Are you even playing anymore?",
            "This is getting embarrassing.",
            "You are literally just clicking what it tells you.",
            "I'm considering this a resign.",
            "You're not fooling anyone. I know you're stuck.",
            "Hint button working overtime.",
            "If you need another hint, maybe try checkers?",
            "Is the engine playing me or are you?",
            "Please, try using your own brain for once.",
            "Stockfish to the rescue. Again.",
            "I should just start playing against Stockfish directly.",
            "Do you lack object permanence?",
            "Clicking 'Hint' is not a chess strategy.",
            "I'm updating my Elo. Beating you gives me nothing.",
            "The hint button must be worn out by now.",
            "Can I get a hint too? Oh wait, I don't need one.",
            "I hope you're writing these moves down.",
            "This is a chess match, not a Stockfish tutorial."
        ]);
    }
    say(msg, true);

    askingForHint = true;
    stockfish.postMessage('position fen ' + game.fen());
    stockfish.postMessage('go depth 10');
});

setTimeout(() => {
    say(pick(quotes.start), true);
}, 500);