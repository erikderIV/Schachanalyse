const chessBoard    = document.getElementById("chessBoard");
const blackEval     = document.getElementById("blackEvaluation");
const whiteEval     = document.getElementById("whiteEvaluation");
const pgnContainer  = document.getElementById("pgnContainer");
const evalScore     = document.getElementById("evalScore");
const coordFile     = document.getElementById("coordFile");

const pieces ={white:{king:"♔",queen:"♕",rook:"♖",bishop:"♗",knight:"♘",pawn:"♙"},black:{king:"♚",queen:"♛",rook:"♜",bishop:"♝",knight:"♞",pawn:"♟"}};
const backRank = ["rook","knight","bishop","queen","king","bishop","knight","rook"];

let resolveClick = null;

let selectedSqr = null;

let moveHistory = [];
let moveIndex = 0;

let stockfish = null;
let currentAnalysisId = 0;

function createPiece(t,c){return {type: t, color: c};}
function getPiece(g,c,r){return g[c+r*8];}
function startGame(){moveIndex = 0; moveHistory = [];buildBoard(); moveHistory.push(setStartingPosition()); initStockfish(); gameLoop();}
function indexToSquare(index) {
    const file = String.fromCharCode(97 + (index % 8));
    const rank = 8 - Math.floor(index / 8);
    return file + rank;
}

/* -- Gameloop -- */

async function gameLoop(){
	const squares = chessBoard.children;
	let from = null;
	let to = null;

	while (true){
		const move = moveHistory[moveIndex];

		const fen = generateFEN(move);

		refreshBoard(move);
		if (selectedSqr !== null){selectedSqr.classList.remove('selected');}
		selectedSqr = null;

		if (from === null){
			from = await waitForSquareClick();
		}
		if (move.grid[from] === null){from = null; continue;}
		if (move.grid[from].color !== move.mc) {from = null; continue;}

		const aS = getLegalMoves(from, move);
		createMoveMarkers(aS);

		selectedSqr = squares[from];
		selectedSqr.classList.add('selected');

		to = await waitForSquareClick();

		if (move.grid[to] !== null){
			if (move.grid[to].color === move.mc){
				from = to;
				to = null;
			}
		}

		if (!aS.includes(to)) continue;

		let choice = "queen";

		if (move.grid[from].type === "pawn"){
			const lr = move.mc === "white" ? 0 : 7;

			if (Math.floor(to/8) === lr){

				let input = prompt("Promotion (q = Queen, r = Rook, b = Bishop, n = Knight):", "q");

				input = input ? input.toLowerCase() : "q";

				const valid = ["q","r","b","n"];
				if (!valid.includes(input)) input = "q";

				switch(input){
					case "r": choice = "rook"; break;
					case "b": choice = "bishop"; break;
					case "n": choice = "knight"; break;
					default:  choice = "queen";
				}
			}
		}
		moveIndex++;

		moveHistory[moveIndex] = makeMove(from, to, move, choice);
		
		analyseUntilMoveChanges(moveIndex);
    }
}

function makeMove(from, to, move, prom = "queen"){
	let board = copyGrid(move.grid);
	let k = move.k;
	let q = move.q;
	let K = move.K;
	let Q = move.Q;
	let hm = move.hm;
	let mi = move.mi;
	let en = null;
	let ec = move.mc === "white" ? "black" : "white";

	if (board[from].type === "pawn"){
		hm = 0;
	}
	else if (board[to] !== null){
		hm = 0;
	}
	else{
		hm++;
	}

	if (board[from].color === "black"){
		mi++;
	}

	if (k){
		if (from === 7 || to === 7){
			k = false;
		}
	}
	if (q){
		if (from === 0 || to === 0){
			q = false
		}
	}
	if (K){
		if (from === 63 || to === 63)
		{
			K = false;
		}
	}
	if (Q){
		if (from === 55 || to === 55){
			Q = false;
		}
	}

	if (Q || K){
		if (from === 60 || to === 60){
			Q = false;
			K = false;
		}
	}

	if (q || k){
		if (from === 4 || to === 4){
			q = false;
			k = false;
		}
	}

	if (move.grid[from].type === "pawn"){
		const dir = move.grid[from].color === "white" ? -8 : 8;
		if (move.en === to){
			board[to - dir] = null;
		}

		if (to - from === dir * 2){
			en = to - dir;
		}

		const lr = move.mc === "white" ? 0 : 7;

		if (Math.floor(to/8) === lr){
			board[to] = createPiece(prom, move.grid[from].color);
			board[from] = null;
			return {k, q, K, Q, en, grid: board, mc: ec};
		}
	}

	if (move.grid[from].type === "king"){
		if (from - to === 2){
			board[from - 1] = board[from - 4];
			board[from - 4] = null;
		}

		if (from - to === - 2){
			board[from + 1] = board[from + 3];
			board[from + 3] = null;
		}
	}

	board[to] = board[from];
	board[from] = null;

	return {k: k, q: q, K: K, Q: Q, en: en, grid: board, mc: ec, hm: hm, mi: mi};
}

function generateFEN(move){
	let fen = "";
	for (let y = 0; y < 8; y++){
		let i = 0;
		for (let x = 0; x < 8; x++){
			const piece = move.grid[x + y * 8];

			if (piece === null){
				i++;
				continue;
			}
			else{
				if (i !== 0){
					fen += i;
					i = 0;
				}

				switch (piece.color){
					case "white":
						switch(piece.type){
							case "pawn":
								fen += "P";
							break;
							case "knight":
								fen += "N";
							break;
							case "bishop":
								fen += "B";
							break;
							case "rook":
								fen += "R";
							break;
							case "queen":
								fen += "Q";
							break;
							case "king":
								fen += "K";
							break;
						}
					break;
					case "black":
						switch(piece.type){
							case "pawn":
								fen += "p";
							break;
							case "knight":
								fen += "n";
							break;
							case "bishop":
								fen += "b";
							break;
							case "rook":
								fen += "r";
							break;
							case "queen":
								fen += "q";
							break;
							case "king":
								fen += "k";
							break;
						}
					break;
				}
			}
		}

		if (i !== 0){
			fen += i;
			i = 0;
		}

		if (y === 7) continue;

		fen += "/";
	}

	const mc = move.mc === "white" ? "w" : "b";

	fen += " " + mc + " ";

	if (move.K){
		fen += "K";
	}
	if (move.Q){
		fen += "Q";
	}
	if (move.k){
		fen += "k";
	}
	if (move.q){
		fen += "q";
	}
	
	if (!move.K && !move.Q && !move.k && !move.q) {
		fen += "-";
	}
	
	fen += " ";
	
	fen += move.en !== null ? indexToSquare(move.en) : "-";

	fen += " " + move.hm + " " + move.mi;

	return fen;
}

    /* -- Board -- */
function setStartingPosition(){
	let board = new Array(64).fill(null);
	for(let r = 0; r < 8; r++){
		for(let c = 0; c < 8; c++){
			let piece = null;
			if (r === 7){piece = createPiece(backRank[c], "white");}
			else if (r === 6){piece = createPiece("pawn", "white");}
			else if (r === 0){piece = createPiece(backRank[c], "black");}
			else if (r === 1){piece = createPiece("pawn", "black");}
			board[c+r*8] = piece;
		}
	}
	return {k: true, q: true, K: true, Q: true, en: null, grid: board, mc: "white", hm: 0, mi: 1};
}

function buildBoard(){
	chessBoard.innerHTML = "";
	for (let r = 0; r < 8; r++) {
		for (let c = 0; c < 8; c++) {
			const sq = document.createElement('div');
			const index = c + r * 8;
			sq.classList.add("square", (r + c) % 2 === 0 ? "light" : "dark");
			sq.addEventListener("click", () => {onClick(index);});
			chessBoard.appendChild(sq);
		}
	}
}

function onClick(index){
	if(resolveClick){
		resolveClick(index);
		resolveClick = null;
	}
}

function waitForSquareClick() {
	return new Promise(resolve => {
		resolveClick = resolve;
	});
}

function refreshBoard(move){
	const squares = chessBoard.children;
	for (let r = 0; r < 8; r++) {
		for (let c = 0; c < 8; c++) {
			const piece = move.grid[c+r*8]
			if (piece === null){
				squares[c+r*8].textContent = "";
			}
			else{
				squares[c+r*8].textContent = pieces[piece.color][piece.type];
			}
		}
	}
}

function createMoveMarkers(indxs){
	const squares = chessBoard.children;

	document.querySelectorAll(".canMoveMarker")
	.forEach(marker => marker.remove());

	indxs.forEach( index => {
		const marker = document.createElement('div');
		marker.classList.add('canMoveMarker');
		squares[index].appendChild(marker);
	});
}

/* -- Stockfish -- */

function initStockfish() {
	stockfish = new Worker('stockfish-18-lite-single.js'); 
	stockfish.onmessage = (e) => {
		const line = e.data;

		if (line.startsWith('info') && line.includes('score cp')) {
			const match = line.match(/score cp (-?\d+)/);
			if (match) {
				const p = parseInt(match[1]) / 100;
				console.log('Bewertung: ', p);
				updateEvaluation(p);
			}
		}

		// Matt Score
		if (line.startsWith('info') && line.includes('score mate')) {
			const match = line.match(/score mate (-?\d+)/);
			if (match) {
				const mateIn = parseInt(match[1]);
				console.log('Matt in Zügen:', mateIn);
			}
		}

		// Best Move
		if (line.startsWith('bestmove')) {
			const bestMove = line.split(' ')[1];
			console.log('Bester Zug:', bestMove);
		}
	};
	stockfish.postMessage("uci");
	stockfish.postMessage("isready");
}
async function analyseUntilMoveChanges(startIndex) {
	currentAnalysisId++;
    const analysisId = currentAnalysisId;

    const move = moveHistory[startIndex];
    const fen = generateFEN(move);

    stockfish.postMessage("stop");
    stockfish.postMessage(`position fen ${fen}`);
    stockfish.postMessage("go depht 20");

    console.log("Analyse gestartet:", analysisId);

    while (moveIndex === startIndex && analysisId === currentAnalysisId) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    stockfish.postMessage("stop");
}

    /* -- Move Logik -- */

function getLegalMoves(index, move){
	const piece = move.grid[index];
	const aS = new Set();

	if (piece === null) return aS;

	for (let value of getPossibleMoves(index, move)){
		const simMove = makeMove(index, value, move);

		if (isInCheck(move.mc, simMove)) continue;

		aS.add(value);
	}

	return [...aS];
}

function getPossibleMoves(index, move){
	const piece = move.grid[index];
	const aS= new Set();

	if (piece === null) return aS;

	switch(piece.type){
		case "pawn":
			for (let value of getPawnPossibleMoves(index, move)){
				aS.add(value);
			}
		break;
		case "knight":
			for (let value of getKnightPossibleMoves(index, move)){
				aS.add(value);
			}
		break;
		case "bishop":
			for (let value of slideMoves(index, [[1,1],[1,-1],[-1,1],[-1,-1]], move)){
				aS.add(value);
			}
		break;
		case "rook":
			for (let value of slideMoves(index, [[1,0],[-1,0],[0,1],[0,-1]], move)){
				aS.add(value);
			}
		break;
		case "queen":
			for (let value of slideMoves(index, [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]], move)){
				aS.add(value);
			}
		break;
		case "king":
			for (let value of getKingPossibleMoves(index, move)){
				aS.add(value);
			}
		break;
	}
	return [...aS];
}

function getPawnPossibleMoves(index, move){
	const piece = move.grid[index];
	if (!piece) return new Set();

	const aS = new Set();
	const dir = piece.color === "white" ? -1 : 1;
	const r = Math.floor(index / 8);
	const c = index % 8;

	const l = piece.color === "white" ? (r === 6 ? 2 : 1) : (r === 1 ? 2 : 1);

	for (let i = 1; i <= l; i++){
		const ny = r + i * dir;
		if (ny < 0 || ny >= 8) break;
		if (move.grid[ny*8 + c] !== null) break;
		aS.add(ny*8 + c);
	}

	for (let dx of [-1, 1]){
		const nx = c + dx;
		const ny = r + dir;
		if (nx < 0 || nx >= 8 || ny < 0 || ny >= 8) continue;
		const tP = move.grid[ny*8 + nx];
		if (tP && tP.color !== piece.color){
			aS.add(ny*8 + nx);
		}
		if (ny*8 + nx === move.en){
			aS.add(ny*8 +nx);
		}
	}
	return aS;
}

function getKnightPossibleMoves(index, move){
	const piece = move.grid[index];
	const r = Math.floor(index / 8);
	const c = index % 8;

	if (!piece) return new Set();

	const aS = new Set();
	for (let [dc, dr] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]){
		const nc = c + dc;
		const nr = r + dr;

		if (nc >= 8 || nc < 0 || nr >= 8 || nr < 0) continue;

		if (move.grid[nc + nr * 8] !== null){
			if (move.grid[nc + nr * 8].color === piece.color) continue;
		}
		aS.add(nc + nr * 8);
	}
	return aS;
}

function slideMoves(index, dir, move){
	const aS = new Set();
	const piece = move.grid[index];
	const r = Math.floor(index / 8);
	const c = index % 8;

	for (let [dx, dy] of dir){
		for (let i = 1; i < 8; i++){
			const nc = c + dx * i;
			const nr = r + dy * i;

			if (nc >= 8 || nc < 0 || nr >= 8 || nr < 0) break;

			if (move.grid[nc + nr * 8] !== null){
				if (move.grid[nc + nr * 8].color === piece.color) break;

				aS.add(nc + nr * 8);

				break;
			}
			aS.add(nc + nr * 8);
		}
	}
	return aS;
}

function getKingPossibleMoves(index, move){
	const aS = new Set();
	const piece = move.grid[index];
	const r = Math.floor(index / 8);
	const c = index % 8;
	const ec = piece.color === "white" ? "black" : "white";

	for (let x = -1; x <= 1; x++){
		for (let y = -1; y <= 1; y++){
			if (x === 0 && y === 0) continue;

			const nc = x + c;
			const nr = y + r;

			if (nc >= 8 || nc < 0 || nr >= 8 || nr < 0) continue;

			if (move.grid[nc + nr * 8] !== null){
				if (move.grid[nc + nr * 8].color === piece.color) continue;
			}
			aS.add(nc + nr * 8);
		}
	}

	if (c === 4 && !isSquareAttacked(index, ec, move)){
		let con = true;
		if (move.grid[r*8] !== null){
			if (move.grid[r*8].type === "rook"){

				for (let i = 1; i <= 3; i++){
					if (move.grid[r*8 + i] !== null){
						con = false;
					}

					if (isSquareAttacked(r*8+i, ec, move)){
						con = false;
					}
				}

				if (piece.color === "white"){
					if (!move.Q){
						con = false;
					}
				}
				else{
					if (!move.q){
						con = false;
					}
				}

				if (con){
					aS.add(2+r*8);
				}
			}
		}
		con = true;

		if (move.grid[r * 8 + 7] !== null){
			if (move.grid[r * 8 + 7].type === "rook"){

				for (let i = 1; i <= 2; i++){
					if (move.grid[r*8+7-i] !== null){
						con = false;
					}

					if (isSquareAttacked(r*8+7-i, ec, move)){
						con = false;
					}
				}

				if (piece.color === "white"){
					if (!move.K){
						con = false;
					}
				}
				else{
					if (!move.k){
						con = false;
					}
				}
				if (con){
					aS.add(6+r*8);
				}
			}
		}
	}
	return aS;
}

function isInCheck(c, move){
	let kingIndex;

	for (let i = 0; i < 64; i++){
		const piece = move.grid[i];

		if (piece === null) continue;
		if (piece.color !== c) continue;
		if (piece.type !== "king") continue;

		kingIndex = i;
	}

	const ec = c === "white" ? "black" : "white";

	if (isSquareAttacked(kingIndex, ec, move)) return true;

	return false;
}

function isSquareAttacked(index, c, move){
		const aS = new Set();
		for (let i = 0; i < 64; i++){
		const piece = move.grid[i];

		if (piece === null) continue;
		if (piece.color !== c) continue;

		if (piece.type === "pawn"){
			const dir = piece.color === "white" ? -8 : 8;
			for (let dx of [-1, 1]){
				const s = dx + i + dir;
				aS.add(dx + i + dir);
			}
		}
		else if (piece.type ==="king"){
			for (let x = -1; x <= 1; x++){
				for (let y = -1; y <= 1; y++){
					if (y === 0 && x === 0) continue;
					aS.add(i + x + y * 8);
				}
			}
		}
		else{
			for (let value of getPossibleMoves(i, move)){
				aS.add(value);
			}
		}
	}
	if ([...aS].includes(index)) return true;
	return false;
}

    /* -- Eval Bar -- */
    function normalize(x) { return 1 / (1 + Math.exp(-0.55 * x)); }

function updateEvaluation(ev) {
	const w = 320 * normalize(ev);
	const b = 320 - w;
	whiteEval.style.height = w + "px";
	blackEval.style.height = b + "px";

	const sign = ev > 0 ? "+" : "";
	evalScore.textContent = sign + ev.toFixed(1);
	evalScore.style.color = ev >= 0 ? "#c8a96e" : "#5c5c5c";
}

    /* -- PGN -- */
function updatePGN() {
	const tokens = PGN.trim().split(/\s+/);
	let i = 0;
	while (i < tokens.length){
		const tok = tokens[i];
		if (/^\d+\./.test(tok)) {
			const row   = document.createElement('div');
			row.classList.add('pgn-row');

			const num  = document.createElement('span');
			num.classList.add('pgn-num');
			num.textContent = tok;
			row.appendChild(num);

			for (let m = 0; m < 2; m++) {
				const move = document.createElement('span');
				move.classList.add('pgn-move');
				i++;
				if (i < tokens.length && !/^\d+\./.test(tokens[i])) {
					move.textContent = tokens[i];
				}
				row.appendChild(move);
			}
			pgnContainer.appendChild(row);
		}
		i++;
	}
}

startGame();
analyseUntilMoveChanges(moveIndex);

function copyGrid(g){
	let grid = new Array(64).fill(null);
	for (let i = 0; i < 64; i++){
		grid[i] = g[i];
	}
	return grid;
}

/*
Regeln der Zug Bewertungen

Brilliant: Eine Aufopferung eines Stückes ohne den Vorteil zu verlieren um 0.5 delta
Great Move: Der Einzige Zug der den Vorteil beibehält
Best Move: Der Beste Zug der Engine
Excellent: Nicht der Beste Zug doch keine Verschlechterung um mehr als 0.1 delta
Good Move: Keine Höhere abweichung als 0.25
Unaccurate Move: Höhere Abweichung als 0.25 aber noch nicht von +1 auf 0 oder von 0 auf - 
Blunder: Dein Zug hat dir das Spiel gekostet also von vorteil auf 0 oder auf *-1 delta
Missed: Dein Gegner hat dir eine Chance gelassen zu gewinnen mit einem Prinzip und du hast es nicht gesehen

*/




