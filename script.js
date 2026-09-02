const IS_MAINTENANCE_MODE = false;
const OTHER_GAME_URL = "https://arcade-edition.onrender.com/";

const COLOR_PALETTE = [
    { name: 'Red', hex: '#FF3547', darkHex: '#CC0000' },
    { name: 'Blue', hex: '#0088FF', darkHex: '#0055B3' },
    { name: 'Green', hex: '#00C853', darkHex: '#007E33' },
    { name: 'Yellow', hex: '#FFB300', darkHex: '#B68000' }
];

let gameMode = ''; 
let aiLevel = 'beginner';
let gridSize = 6;
let numPlayers = 2;
let players = [];
let currentTurnIndex = 0;
let hLines = [];
let vLines = [];
let boxes = [];
let isProcessingAIMove = false;

let peer = null;
let connections = [];
let isHost = false;
let myPlayerIndex = 0;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let cellSize = 45;
const offset = 25;

function showScreen(screenId) {
    const currentActive = document.querySelector('.screen.active');
    const targetScreen = document.getElementById(screenId);

    if (currentActive === targetScreen) return;

    if (currentActive) {
        currentActive.classList.remove('fade-in');
        currentActive.classList.add('fade-out');

        setTimeout(() => {
            currentActive.classList.remove('active', 'fade-out');
            targetScreen.classList.add('active', 'fade-in');
        }, 350);
    } else {
        targetScreen.classList.add('active', 'fade-in');
    }
}

function checkMaintenanceStatus() {
    const overlay = document.getElementById('maintenance-overlay');
    if (IS_MAINTENANCE_MODE) {
        overlay.style.display = 'flex';
    } else {
        overlay.style.display = 'none';
    }
}

function redirectToOtherGame() {
    window.location.href = OTHER_GAME_URL;
}

function showCustomModal(title, contentHTML, buttonsHTML = null) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-body').innerHTML = contentHTML;
    const btnContainer = document.getElementById('modal-buttons');
    
    if (buttonsHTML) {
        btnContainer.innerHTML = buttonsHTML;
    } else {
        btnContainer.innerHTML = `<button class="btn-arcade btn-red" onclick="closeModal()">OK</button>`;
    }
    
    document.getElementById('custom-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('custom-modal').style.display = 'none';
}

function openNavMenu() { document.getElementById('nav-modal').style.display = 'flex'; }
function closeNavMenu() { document.getElementById('nav-modal').style.display = 'none'; }

function openAboutUs() {
    closeNavMenu();
    showCustomModal("ABOUT US", "<p>Welcome to Dots and Boxes Game!<br><br>Created by riyanshu.devl.Ai capture more boxes to win the game hope y'all enjoying my game feel free to contect me to suggest game or changes or check my other game's too.</p>");
}

function openHelp() {
    closeNavMenu();
    const helpContent = `
        <p style="font-size:15px; margin-bottom:15px; line-height:1.4;">
            If you have any questions and problem please contact us through mail or direct Instagram message.
        </p>
        <div style="display:flex; flex-direction:column; gap:12px; margin-top:10px;">
            <a href="mailto:riyanshusinh@gmail.com" style="color:#0088FF; font-size:16px; text-decoration:underline; font-weight:bold; word-break:break-all;">
                riyanshusinh@gmail.com
            </a>
            <a href="https://instagram.com/riyanshu_1233" target="_blank" style="color:#FF3547; font-size:16px; text-decoration:underline; font-weight:bold;">
                 @riyanshu_1233
            </a>
        </div>
    `;
    showCustomModal("HELP & SUPPORT", helpContent);
}

function showToast(message) {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.style.cssText = `
            position: fixed;
            top: 25px;
            left: 50%;
            transform: translateX(-50%);
            background: #FF3547;
            color: #FFF;
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: bold;
            font-size: 16px;
            z-index: 10000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.4);
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.style.opacity = '1';
    toast.style.display = 'block';

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => { toast.style.display = 'none'; }, 300);
    }, 3000);
}

function showGlobalNotice() {
    showCustomModal("NOTICE", "<p>Sorry, global mode is not available at the time.</p>");
}

function showPassPlaySettings() { showScreen('pass-screen'); }

function startPassAndPlay(playerCount) {
    gameMode = 'pass';
    numPlayers = playerCount;
    myPlayerIndex = 0;
    gridSize = playerCount === 2 ? 6 : (playerCount === 3 ? 8 : 9);
    
    players = [];
    for (let i = 0; i < playerCount; i++) {
        players.push({
            id: i,
            name: `Player ${i + 1}`,
            color: COLOR_PALETTE[i].hex,
            darkColor: COLOR_PALETTE[i].darkHex,
            score: 0
        });
    }
    initBoard();
}

function showAISettings() { showScreen('ai-screen'); }

function startAIMode(level) {
    gameMode = 'ai';
    aiLevel = level;
    myPlayerIndex = 0;
    gridSize = 6;
    numPlayers = 2;
    players = [
        { id: 0, name: 'You', color: COLOR_PALETTE[0].hex, darkColor: COLOR_PALETTE[0].darkHex, score: 0 },
        { id: 1, name: `AI (${level})`, color: COLOR_PALETTE[1].hex, darkColor: COLOR_PALETTE[1].darkHex, score: 0 }
    ];
    initBoard();
}

function showRoomMenu() { showScreen('room-menu-screen'); }

function createRoom() {
    const name = document.getElementById('player-name').value.trim() || "Host";
    const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    isHost = true;
    myPlayerIndex = 0;
    peer = new Peer('db-' + roomCode);

    peer.on('open', (id) => {
        document.getElementById('display-room-code').innerText = roomCode;
        players = [{ id: 0, name: name, color: COLOR_PALETTE[0].hex, darkColor: COLOR_PALETTE[0].darkHex, score: 0, peerId: id }];
        updateLobbyUI();
        showScreen('lobby-screen');
    });

    peer.on('connection', (conn) => {
        if(players.length >= 4) {
            conn.send({ type: 'REJECT', msg: 'Room Full' });
            conn.close();
            return;
        }
        
        conn.on('data', (data) => handleNetworkData(data, conn));
        conn.on('close', () => handlePlayerDisconnect(conn));
    });

    peer.on('error', () => { showCustomModal("ERROR", "Failed to create room code. Try again."); });
}

function joinRoom() {
    const name = document.getElementById('player-name').value.trim() || "Guest";
    const code = document.getElementById('join-code').value.trim();
    if(code.length !== 4) {
        showCustomModal("ERROR", "Enter a valid 4-digit code.");
        return;
    }

    isHost = false;
    peer = new Peer();

    peer.on('open', () => {
        const conn = peer.connect('db-' + code);
        connections = [conn];
        conn.on('open', () => conn.send({ type: 'JOIN', name: name }));
        conn.on('data', (data) => handleNetworkData(data, conn));
        conn.on('close', () => {
            showCustomModal("DISCONNECTED", "<p>Disconnected from room.</p>", `<button class="btn-arcade btn-red" onclick="closeModal(); exitGame();">Menu</button>`);
        });
    });

    peer.on('error', () => { showCustomModal("ERROR", "Room not found or connection error."); });
}

function handleNetworkData(data, conn) {
    if(isHost) {
        if(data.type === 'JOIN') {
            const idx = players.length;
            conn.playerIdx = idx;
            conn.playerName = data.name;
            connections.push(conn);

            players.push({ id: idx, name: data.name, color: COLOR_PALETTE[idx].hex, darkColor: COLOR_PALETTE[idx].darkHex, score: 0 });
            conn.send({ type: 'ASSIGN_INDEX', index: idx });
            broadcastLobbyState();
        } else if(data.type === 'MOVE') {
            makeMove(data.r, data.c, data.typeLine);
            broadcastGameState();
        }
    } else {
        if(data.type === 'ASSIGN_INDEX') {
            myPlayerIndex = data.index;
        } else if(data.type === 'LOBBY_UPDATE') {
            players = data.players;
            document.getElementById('display-room-code').innerText = data.code;
            updateLobbyUI();
            showScreen('lobby-screen');
        } else if(data.type === 'START_GAME') {
            gridSize = data.gridSize;
            players = data.players;
            gameMode = 'room';
            initBoard(false);
        } else if(data.type === 'GAME_STATE') {
            hLines = data.hLines;
            vLines = data.vLines;
            boxes = data.boxes;
            players = data.players;
            currentTurnIndex = data.currentTurnIndex;
            renderScoreboard();
            drawBoard();
            checkGameOver();
        } else if(data.type === 'PLAYER_LEFT') {
            showToast(`${data.leftPlayerName} left the game`);
        }
    }
}

function handlePlayerDisconnect(conn) {
    if (!isHost) return;
    
    const leftIdx = conn.playerIdx;
    const leftName = conn.playerName || `Player ${leftIdx + 1}`;

    connections = connections.filter(c => c !== conn);
    players = players.filter((_, idx) => idx !== leftIdx);

    connections.forEach((c) => {
        if (c.playerIdx > leftIdx) {
            c.playerIdx -= 1;
            c.send({ type: 'ASSIGN_INDEX', index: c.playerIdx });
        }
    });

    showToast(`${leftName} left the game`);
    
    connections.forEach(c => c.send({
        type: 'PLAYER_LEFT',
        leftPlayerName: leftName
    }));

    if (currentTurnIndex >= players.length) {
        currentTurnIndex = 0;
    }

    if (players.length < 2) {
        showCustomModal("GAME OVER", "<p>Not enough players to continue. Returning to menu.</p>", `<button class="btn-arcade btn-red" onclick="closeModal(); exitGame();">Menu</button>`);
        return;
    }

    renderScoreboard();
    broadcastGameState();
}

function broadcastLobbyState() {
    const code = document.getElementById('display-room-code').innerText;
    connections.forEach(c => c.send({ type: 'LOBBY_UPDATE', players: players, code: code }));
    updateLobbyUI();
}

function updateLobbyUI() {
    const list = document.getElementById('lobby-players-list');
    list.innerHTML = players.map(p => `
        <div class="player-card" style="background:${p.color};">
            <span>${p.name}</span>
        </div>
    `).join('');

    if(isHost) {
        const startBtn = document.getElementById('start-game-btn');
        startBtn.style.display = players.length >= 2 ? 'block' : 'none';
        document.getElementById('waiting-msg').style.display = players.length >= 2 ? 'none' : 'block';
    }
}

function startRoomGame() {
    if(!isHost) return;
    numPlayers = players.length;
    gridSize = numPlayers === 2 ? 6 : (numPlayers === 3 ? 8 : 9);
    currentTurnIndex = Math.floor(Math.random() * numPlayers);

    connections.forEach(c => c.send({
        type: 'START_GAME',
        gridSize: gridSize,
        players: players
    }));

    gameMode = 'room';
    initBoard();
}

function initBoard(broadcast = true) {
    hLines = Array(gridSize + 1).fill(null).map(() => Array(gridSize).fill(null));
    vLines = Array(gridSize).fill(null).map(() => Array(gridSize + 1).fill(null));
    boxes = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));

    cellSize = gridSize === 6 ? 48 : (gridSize === 8 ? 38 : 34);

    canvas.width = gridSize * cellSize + offset * 2;
    canvas.height = gridSize * cellSize + offset * 2;

    if(gameMode !== 'room') {
        currentTurnIndex = 0;
    }

    players.forEach(p => p.score = 0);

    isProcessingAIMove = false;
    showScreen('game-screen');
    renderScoreboard();
    drawBoard();

    canvas.onclick = handleCanvasClick;
    if(isHost && broadcast) broadcastGameState();
}

function drawBoard() {
    ctx.fillStyle = '#DECBA4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if (boxes[r][c] !== null) {
                ctx.fillStyle = boxes[r][c];
                ctx.fillRect(offset + c * cellSize + 2, offset + r * cellSize + 2, cellSize - 4, cellSize - 4);
            }
        }
    }

    ctx.strokeStyle = '#C9B890';
    ctx.lineWidth = 2;
    for (let r = 0; r <= gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if(!hLines[r][c]) {
                ctx.beginPath();
                ctx.moveTo(offset + c * cellSize, offset + r * cellSize);
                ctx.lineTo(offset + (c + 1) * cellSize, offset + r * cellSize);
                ctx.stroke();
            }
        }
    }
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c <= gridSize; c++) {
            if(!vLines[r][c]) {
                ctx.beginPath();
                ctx.moveTo(offset + c * cellSize, offset + r * cellSize);
                ctx.lineTo(offset + c * cellSize, offset + (r + 1) * cellSize);
                ctx.stroke();
            }
        }
    }

    for (let r = 0; r <= gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if (hLines[r][c] !== null) {
                ctx.strokeStyle = hLines[r][c];
                ctx.lineWidth = 5;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(offset + c * cellSize, offset + r * cellSize);
                ctx.lineTo(offset + (c + 1) * cellSize, offset + r * cellSize);
                ctx.stroke();
            }
        }
    }

    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c <= gridSize; c++) {
            if (vLines[r][c] !== null) {
                ctx.strokeStyle = vLines[r][c];
                ctx.lineWidth = 5;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(offset + c * cellSize, offset + r * cellSize);
                ctx.lineTo(offset + c * cellSize, offset + (r + 1) * cellSize);
                ctx.stroke();
            }
        }
    }

    for (let r = 0; r <= gridSize; r++) {
        for (let c = 0; c <= gridSize; c++) {
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(offset + c * cellSize, offset + r * cellSize, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#8C7A5B';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
}

function renderScoreboard() {
    const list = document.getElementById('players-score-list');
    list.innerHTML = players.map((p, idx) => {
        const isCurrentTurn = idx === currentTurnIndex;
        let turnLabel = "";

        if (isCurrentTurn) {
            if (gameMode === 'room') {
                turnLabel = (idx === myPlayerIndex) ? " (Your Turn)" : ` (${p.name}'s Turn)`;
            } else if (gameMode === 'ai') {
                turnLabel = (idx === 0) ? " (Your Turn)" : " (AI's Turn)";
            } else {
                turnLabel = " (Current Turn)";
            }
        }

        return `
            <div class="player-card ${isCurrentTurn ? 'active' : ''}" style="background:${p.color};">
                <span>${p.name}${turnLabel}</span>
                <span>${p.score} Boxes</span>
            </div>
        `;
    }).join('');
}

function handleCanvasClick(e) {
    if (gameMode === 'ai' && currentTurnIndex === 1) return;
    if (isProcessingAIMove) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - offset;
    const y = e.clientY - rect.top - offset;

    let closestLine = getClosestLine(x, y);
    if (!closestLine) return;

    if (gameMode === 'room') {
        if (currentTurnIndex !== myPlayerIndex) return;
        if (!isHost) {
            connections[0].send({ type: 'MOVE', r: closestLine.r, c: closestLine.c, typeLine: closestLine.type });
            return;
        }
    }

    makeMove(closestLine.r, closestLine.c, closestLine.type);
}

function getClosestLine(x, y) {
    const threshold = 14;
    for (let r = 0; r <= gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            let lx = c * cellSize + cellSize / 2;
            let ly = r * cellSize;
            if (Math.abs(x - lx) < cellSize / 2 && Math.abs(y - ly) < threshold) {
                if (hLines[r][c] === null) return { r, c, type: 'h' };
            }
        }
    }
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c <= gridSize; c++) {
            let lx = c * cellSize;
            let ly = r * cellSize + cellSize / 2;
            if (Math.abs(x - lx) < threshold && Math.abs(y - ly) < cellSize / 2) {
                if (vLines[r][c] === null) return { r, c, type: 'v' };
            }
        }
    }
    return null;
}

function makeMove(r, c, type) {
    let color = players[currentTurnIndex].darkColor;
    let scored = false;

    if (type === 'h') {
        hLines[r][c] = color;
        if (r > 0 && checkSquare(r - 1, c)) scored = true;
        if (r < gridSize && checkSquare(r, c)) scored = true;
    } else {
        vLines[r][c] = color;
        if (c > 0 && checkSquare(r, c - 1)) scored = true;
        if (c < gridSize && checkSquare(r, c)) scored = true;
    }

    if (!scored) {
        currentTurnIndex = (currentTurnIndex + 1) % players.length;
    }

    drawBoard();
    renderScoreboard();

    if (gameMode === 'room' && isHost) broadcastGameState();

    let isOver = checkGameOver();

    if (!isOver && gameMode === 'ai' && currentTurnIndex === 1) {
        isProcessingAIMove = true;
        setTimeout(triggerAIMove, 400);
    }
}

function checkSquare(r, c) {
    if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
        if (hLines[r][c] && hLines[r + 1][c] && vLines[r][c] && vLines[r][c + 1]) {
            if (boxes[r][c] === null) {
                boxes[r][c] = players[currentTurnIndex].color;
                players[currentTurnIndex].score++;
                return true;
            }
        }
    }
    return false;
}

function broadcastGameState() {
    connections.forEach(c => c.send({
        type: 'GAME_STATE',
        hLines: hLines,
        vLines: vLines,
        boxes: boxes,
        players: players,
        currentTurnIndex: currentTurnIndex
    }));
}

function triggerAIMove() {
    if (gameMode !== 'ai' || currentTurnIndex !== 1) return;
    let move = getAIMove();
    isProcessingAIMove = false;
    if (move) {
        makeMove(move.r, move.c, move.type);
    }
}

function getAIMove() {
    let availableMoves = [];
    for (let r = 0; r <= gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            if (hLines[r][c] === null) availableMoves.push({ r, c, type: 'h' });
        }
    }
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c <= gridSize; c++) {
            if (vLines[r][c] === null) availableMoves.push({ r, c, type: 'v' });
        }
    }

    if (availableMoves.length === 0) return null;

    for (let move of availableMoves) {
        if (willCompleteBox(move.r, move.c, move.type)) return move;
    }

    if (aiLevel === 'beginner') {
        return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }

    let safeMoves = availableMoves.filter(move => !willGiveBox(move.r, move.c, move.type));
    if (safeMoves.length > 0) {
        return safeMoves[Math.floor(Math.random() * safeMoves.length)];
    }

    return availableMoves[Math.floor(Math.random() * availableMoves.length)];
}

function willCompleteBox(r, c, type) {
    if (type === 'h') {
        if (r > 0 && countSquareSides(r - 1, c) === 3) return true;
        if (r < gridSize && countSquareSides(r, c) === 3) return true;
    } else {
        if (c > 0 && countSquareSides(r, c - 1) === 3) return true;
        if (c < gridSize && countSquareSides(r, c) === 3) return true;
    }
    return false;
}

function willGiveBox(r, c, type) {
    if (type === 'h') {
        if (r > 0 && countSquareSides(r - 1, c) === 2) return true;
        if (r < gridSize && countSquareSides(r, c) === 2) return true;
    } else {
        if (c > 0 && countSquareSides(r, c - 1) === 2) return true;
        if (c < gridSize && countSquareSides(r, c) === 2) return true;
    }
    return false;
}

function countSquareSides(r, c) {
    let count = 0;
    if (hLines[r][c]) count++;
    if (hLines[r + 1][c]) count++;
    if (vLines[r][c]) count++;
    if (vLines[r][c + 1]) count++;
    return count;
}

function checkGameOver() {
    let totalBoxes = gridSize * gridSize;
    let filledBoxes = players.reduce((sum, p) => sum + p.score, 0);

    if (filledBoxes === totalBoxes) {
        showFinalScoreboard();
        return true;
    }
    return false;
}

function replayGame() {
    closeModal();
    if (gameMode === 'room' && isHost) {
        startRoomGame();
    } else {
        initBoard();
    }
}

function showFinalScoreboard() {
    let sorted = [...players].sort((a, b) => b.score - a.score);
    let highestScore = sorted[0].score;
    let lowestScore = sorted[sorted.length - 1].score;

    let winners = sorted.filter(p => p.score === highestScore);
    let isDraw = winners.length > 1;

    let titleHTML = "";

    if (isDraw) {
        titleHTML = "MATCH DRAW!";
    } else if (gameMode === 'room' || gameMode === 'ai') {
        let myData = players[myPlayerIndex];
        if (myData.score === highestScore) {
            titleHTML = " YOU WIN!";
        } else if (myData.score === lowestScore) {
            titleHTML = " YOU LOOSE!";
        } else {
            titleHTML = "GAME OVER!";
        }
    } else {
        titleHTML = ` ${winners[0].name.toUpperCase()} WINS!`;
    }

    let listHTML = `<div class="rank-list">`;
    sorted.forEach((p, idx) => {
        let statusTag = '';
        if (!isDraw) {
            if (p.score === highestScore) {
                statusTag = '<b style="color:#00C853;">(Winner)</b>';
            } else if (p.score === lowestScore) {
                statusTag = '<span style="color:#FF3547; font-weight:bold;">(Looser)</span>';
            } else {
                statusTag = `<span style="color:#FFB300; font-weight:bold;">(${idx + 1}nd Rank)</span>`;
            }
        } else {
            if (p.score === highestScore) {
                statusTag = '<b style="color:#FFD700;">(Draw)</b>';
            }
        }

        listHTML += `
            <div class="rank-item">
                <span>#${idx + 1} ${p.name} ${statusTag}</span>
                <span><b>${p.score} Boxes</b></span>
            </div>
        `;
    });
    listHTML += `</div>`;

    let buttonsHTML = `
        <button class="btn-arcade btn-green" onclick="replayGame()">Replay</button>
        <button class="btn-arcade btn-gray" onclick="closeModal(); exitGame();">Back to Menu</button>
    `;

    showCustomModal(titleHTML, listHTML, buttonsHTML);
}

function exitGame() {
    if(peer) peer.destroy();
    showScreen('menu-screen');
}

checkMaintenanceStatus();
