
    const chessBoard    = document.getElementById("chessBoard");
    const blackEval     = document.getElementById("blackEvaluation");
    const whiteEval     = document.getElementById("whiteEvaluation");
    const pgnContainer  = document.getElementById("pgnContainer");
    const evalScore     = document.getElementById("evalScore");
    const coordFile     = document.getElementById("coordFile");

    const pieces ={white:{king:"♔",queen:"♕",rook:"♖",bishop:"♗",knight:"♘",pawn:"♙"},black:{king:"♚",queen:"♛",rook:"♜",bishop:"♝",knight:"♞",pawn:"♟"}};
    const backRank = ["rook","knight","bishop","queen","king","bishop","knight","rook"];

    let PGN = "1. e4 e5 2. d4 d5 3. Nf3 Nc6 4. Bb5 a6";

    let board = new Array(64).fill(null);

    let resolveClick = null;

    let mc = "white";

    let selectedSqr = null;

    function createPiece(t,c){return {type: t, color: c, hasMoved: false};}
    function getPiece(c,r){return board[c+r*8];}
    function startGame(){buildBoard();setStartingPosition();refreshBoard(); gameLoop();}

    /* ── Gameloop ── */

    async function gameLoop(){
		let from = null;
		let to = null;
        while (true) {
            if (selectedSqr !== null){selectedSqr.classList.remove('selected');}
            selectedSqr = null;
			from = null;
            const squares = chessBoard.children;
            from = await waitForSquareClick();
            selectedSqr = squares[from];
            if (board[from] === null) continue;
            if (board[from].color !== mc) continue;
            const aS = getPossibleMoves(from);
            createMoveMarkers(aS);
            selectedSqr.classList.add('selected');
			
            to = await waitForSquareClick();

			if (aS.contains(to)){
				board[to] = board[from];
				board[from] = null;
			}

            refreshBoard();
        }
    }

    /* ── Board ── */
    function setStartingPosition(){
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

    function refreshBoard(){
        const squares = chessBoard.children;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[c+r*8]
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

    /* ── Move Logik ── */

    function getPossibleMoves(index){
        const piece = board[index];
        const aS= new Set();

        if (piece === null) return;

        switch(piece.type){
            case "pawn":
                for (let value of getPawnPossibleMoves(index)){
                    aS.add(value);
                }
                break;
            case "knight":
                break;
            case "bishop":
                break;
            case "rook":
                break;
            case "queen":
                break;
            case "king":
                break;
        }

        return [...aS];
    }

    function getPawnPossibleMoves(index){
    const piece = board[index];
    if (!piece) return new Set();

    const aS = new Set();
    const dir = piece.color === "white" ? -1 : 1;
    const r = Math.floor(index / 8);
    const c = index % 8;

    const l = piece.color === "white" ? (r === 6 ? 2 : 1) : (r === 1 ? 2 : 1);

    for (let i = 1; i <= l; i++){
        const ny = r + i * dir;
        if (ny < 0 || ny >= 8) break;
        if (board[ny*8 + c] !== null) break;
        aS.add(ny*8 + c);
    }

    for (let dx of [-1, 1]){
        const nx = c + dx;
        const ny = r + dir;
        if (nx < 0 || nx >= 8 || ny < 0 || ny >= 8) continue;
        const tP = board[ny*8 + nx];
        if (tP && tP.color !== piece.color){
            aS.add(ny*8 + nx);
        }
    }

    return aS;
}

    /* ── Eval Bar ── */
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

    /* ── PGN ── */
    function updatePGN() {
      const tokens = PGN.trim().split(/\s+/);
      let i = 0;
      while (i < tokens.length) {
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
