const COLS = 15;
const ROWS = 20;  // 30 - 10 = 20行
let BLOCK_SIZE = 30;
const TICK_SPEED = 500;
const GAME_OVER_LINE = 3;  // 上から3行目
const WIN_LINE = 17;      // 下から3行目（20 - 3 = 17）

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');

const RANDOM_COLORS = [
    'rgba(255, 165, 0, 0.7)',    // オレンジ
    'rgba(255, 20, 147, 0.7)',   // ピンク
    'rgba(50, 205, 50, 0.7)',    // ライムグリーン
    'rgba(30, 144, 255, 0.7)',   // ドッジャーブルー
    'rgba(138, 43, 226, 0.7)',   // ブルーバイオレット
    'rgba(0, 255, 255, 0.7)'     // シアン
];

function getRandomColor() {
    return RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
}

const SHAPES = {
    I: [[1, 1, 1, 1]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    Z: [[1, 1, 0], [0, 1, 1]],
    J: [[1, 0, 0], [1, 1, 1]],
    L: [[0, 0, 1], [1, 1, 1]]
};

class Game {
    constructor() {
        this.board = this.createBoard();
        this.score = 0;
        this.isGameOver = false;
        this.isPaused = false;
        this.isStarted = false;
        this.currentPiece = null;
        this.nextPiece = null;
        this.dropCounter = 0;
        this.lastTime = 0;
        this.particles = [];
        this.gapRowTimer = 0;
        this.gapRowInterval = 8000;
        this.animatingBlocks = [];
        this.isAnimating = false;
        this.gameOverReason = '';
        this.isGameWon = false;
        
        this.init();
    }
    
    createBoard() {
        const board = [];
        for (let row = 0; row < ROWS; row++) {
            board[row] = new Array(COLS).fill(0);
        }
        return board;
    }
    
    init() {
        this.resizeCanvas();
        this.nextPiece = this.createPiece();
        this.setupKeyboardControls();
        this.updateScore();
        this.drawNextPiece();
        this.draw();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Initialize mobile score display
        const gameHeader = document.querySelector('.game-header');
        if (gameHeader) {
            gameHeader.setAttribute('data-score', '0');
        }
    }
    
    resizeCanvas() {
        const gameBoard = document.querySelector('.game-board');
        const rect = gameBoard.getBoundingClientRect();
        
        const maxWidth = rect.width - 20;
        const maxHeight = rect.height - 20;
        
        const aspectRatio = COLS / ROWS;
        let canvasWidth = Math.min(maxWidth, maxHeight * aspectRatio);
        let canvasHeight = canvasWidth / aspectRatio;
        
        if (canvasHeight > maxHeight) {
            canvasHeight = maxHeight;
            canvasWidth = canvasHeight * aspectRatio;
        }
        
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        BLOCK_SIZE = canvasWidth / COLS;
    }
    
    startGame() {
        this.isStarted = true;
        this.generateInitialBlocks();
        this.spawnPiece();
        this.gameLoop();
        document.getElementById('startOverlay').style.display = 'none';
    }
    
    createPiece() {
        const types = 'ILJOTSZ';
        const type = types[Math.floor(Math.random() * types.length)];
        const shape = SHAPES[type];
        const color = getRandomColor();
        
        return {
            type: type,
            shape: shape,
            color: color,
            x: Math.floor((COLS - shape[0].length) / 2),
            y: 0
        };
    }
    
    spawnPiece() {
        this.currentPiece = this.nextPiece;
        this.nextPiece = this.createPiece();
        this.drawNextPiece();
        
        if (this.collision()) {
            this.gameOverReason = 'テトロミノが配置できません';
            this.gameOver();
        } else if (this.checkGameOverCondition()) {
            this.gameOverReason = 'ブロックが危険ラインを超えました';
            this.gameOver();
        }
    }
    
    checkGameOverCondition() {
        for (let row = 0; row < GAME_OVER_LINE; row++) {
            for (let col = 0; col < COLS; col++) {
                if (this.board[row][col] !== 0) {
                    return true;
                }
            }
        }
        return false;
    }
    
    checkWinCondition() {
        for (let row = 0; row < WIN_LINE; row++) {
            for (let col = 0; col < COLS; col++) {
                if (this.board[row][col] !== 0) {
                    return false;
                }
            }
        }
        return true;
    }
    
    generateInitialBlocks() {
        for (let row = ROWS - 12; row < ROWS; row++) {  // 8行目から19行目（下から12行）
            const density = Math.random() * 0.4 + 0.4;
            const blocksToFill = Math.floor(COLS * density);
            const positions = [];
            
            while (positions.length < blocksToFill) {
                const pos = Math.floor(Math.random() * COLS);
                if (!positions.includes(pos)) {
                    positions.push(pos);
                }
            }
            
            let currentPos = 0;
            while (currentPos < positions.length) {
                const color = getRandomColor();
                const clusterSize = Math.floor(Math.random() * 3) + 2;
                
                for (let i = 0; i < clusterSize && currentPos < positions.length; i++) {
                    this.board[row][positions[currentPos]] = color;
                    currentPos++;
                }
            }
        }
    }
    
    rotate(piece) {
        const rotated = [];
        const rows = piece.shape.length;
        const cols = piece.shape[0].length;
        
        for (let col = 0; col < cols; col++) {
            rotated[col] = [];
            for (let row = rows - 1; row >= 0; row--) {
                rotated[col][rows - 1 - row] = piece.shape[row][col];
            }
        }
        
        return rotated;
    }
    
    collision(offsetX = 0, offsetY = 0, shape = null) {
        const pieceShape = shape || this.currentPiece.shape;
        const x = this.currentPiece.x + offsetX;
        const y = this.currentPiece.y + offsetY;
        
        for (let row = 0; row < pieceShape.length; row++) {
            for (let col = 0; col < pieceShape[row].length; col++) {
                if (pieceShape[row][col]) {
                    const boardX = x + col;
                    const boardY = y + row;
                    
                    if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
                        return true;
                    }
                    
                    if (boardY >= 0 && this.board[boardY][boardX]) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    merge() {
        const shape = this.currentPiece.shape;
        const x = this.currentPiece.x;
        const y = this.currentPiece.y;
        
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    this.board[y + row][x + col] = this.currentPiece.color;
                }
            }
        }
        
        this.score += 10;
        
        if (this.checkGameOverCondition()) {
            this.gameOverReason = 'ブロックが危険ラインを超えました';
            this.gameOver();
        } else if (this.checkWinCondition()) {
            this.gameWon();
        }
    }
    
    clearLines() {
        let linesCleared = 0;
        const linesToClear = [];
        
        for (let row = ROWS - 1; row >= 0; row--) {
            if (this.board[row].every(cell => cell !== 0)) {
                linesToClear.push(row);
                linesCleared++;
            }
        }
        
        if (linesToClear.length > 0) {
            this.createLineParticles(linesToClear);
            
            linesToClear.sort((a, b) => b - a);
            
            for (const row of linesToClear) {
                this.board.splice(row, 1);
                this.board.unshift(new Array(COLS).fill(0));
            }
            
            const scores = [100, 300, 500, 800];
            this.score += scores[Math.min(linesCleared - 1, 3)];
        }
        
        this.checkColorMatches();
    }
    
    checkColorMatches() {
        const visited = Array(ROWS).fill().map(() => Array(COLS).fill(false));
        const groupsToRemove = [];
        
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                if (!visited[row][col] && this.board[row][col] !== 0) {
                    const group = this.findConnectedBlocks(row, col, this.board[row][col], visited);
                    if (group.length >= 11) {
                        groupsToRemove.push({
                            blocks: group,
                            color: this.board[row][col]
                        });
                    }
                }
            }
        }
        
        if (groupsToRemove.length > 0) {
            for (const group of groupsToRemove) {
                const colorCount = this.countBlocksByColor(group.color);
                this.removeAllColorBlocks(group.color);
                this.score += 120 * colorCount;
            }
            this.applyFullGravity();
        }
    }
    
    countBlocksByColor(color) {
        let count = 0;
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                if (this.board[row][col] === color) {
                    count++;
                }
            }
        }
        return count;
    }
    
    removeAllColorBlocks(color) {
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                if (this.board[row][col] === color) {
                    const x = col * BLOCK_SIZE + BLOCK_SIZE / 2;
                    const y = row * BLOCK_SIZE + BLOCK_SIZE / 2;
                    
                    for (let i = 0; i < 8; i++) {
                        this.particles.push({
                            x: x,
                            y: y,
                            vx: (Math.random() - 0.5) * 10,
                            vy: Math.random() * -8 - 2,
                            life: 1.0,
                            color: color,
                            size: Math.random() * 6 + 4
                        });
                    }
                    
                    this.board[row][col] = 0;
                }
            }
        }
    }
    
    findConnectedBlocks(row, col, color, visited) {
        if (row < 0 || row >= ROWS || col < 0 || col >= COLS || 
            visited[row][col] || this.board[row][col] !== color || this.board[row][col] === 0) {
            return [];
        }
        
        visited[row][col] = true;
        const group = [{row, col}];
        
        group.push(...this.findConnectedBlocks(row - 1, col, color, visited));
        group.push(...this.findConnectedBlocks(row + 1, col, color, visited));
        group.push(...this.findConnectedBlocks(row, col - 1, color, visited));
        group.push(...this.findConnectedBlocks(row, col + 1, color, visited));
        
        return group;
    }
    
    
    
    applyFullGravity(removedBlocks = null) {
        this.isAnimating = true;
        const animationSteps = [];
        
        for (let col = 0; col < COLS; col++) {
            let writePos = ROWS - 1;
            
            for (let row = ROWS - 1; row >= 0; row--) {
                if (this.board[row][col] !== 0) {
                    if (row !== writePos) {
                        animationSteps.push({
                            color: this.board[row][col],
                            fromRow: row,
                            toRow: writePos,
                            col: col
                        });
                        this.board[row][col] = 0;
                    }
                    writePos--;
                }
            }
        }
        
        this.animateGravity(animationSteps);
    }
    
    animateGravity(animationSteps) {
        if (animationSteps.length === 0) {
            this.isAnimating = false;
            setTimeout(() => {
                this.checkColorMatches();
                if (this.checkWinCondition()) {
                    this.gameWon();
                }
            }, 100);
            return;
        }
        
        this.animatingBlocks = animationSteps.map(step => ({
            ...step,
            currentRow: step.fromRow,
            progress: 0
        }));
        
        this.startGravityAnimation();
    }
    
    startGravityAnimation() {
        const animationDuration = 100;
        const startTime = Date.now();
        
        const animate = () => {
            const currentTime = Date.now();
            const elapsed = currentTime - startTime;
            
            let allCompleted = true;
            
            for (const block of this.animatingBlocks) {
                if (block.currentRow < block.toRow) {
                    const targetProgress = elapsed / animationDuration;
                    const distance = block.toRow - block.fromRow;
                    const newRow = block.fromRow + Math.min(targetProgress * distance, distance);
                    
                    if (newRow >= block.toRow) {
                        block.currentRow = block.toRow;
                        this.board[block.toRow][block.col] = block.color;
                    } else {
                        block.currentRow = newRow;
                        allCompleted = false;
                    }
                }
            }
            
            if (allCompleted) {
                this.animatingBlocks = [];
                this.isAnimating = false;
                setTimeout(() => {
                    this.checkColorMatches();
                    if (this.checkWinCondition()) {
                        this.gameWon();
                    }
                }, 100);
            } else {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    createLineParticles(rows) {
        for (const row of rows) {
            for (let col = 0; col < COLS; col++) {
                const color = this.board[row][col];
                if (color) {
                    const x = col * BLOCK_SIZE + BLOCK_SIZE / 2;
                    const y = row * BLOCK_SIZE + BLOCK_SIZE / 2;
                    
                    for (let i = 0; i < 5; i++) {
                        this.particles.push({
                            x: x,
                            y: y,
                            vx: (Math.random() - 0.5) * 8,
                            vy: Math.random() * -5 - 2,
                            life: 1.0,
                            color: color,
                            size: Math.random() * 6 + 4
                        });
                    }
                }
            }
        }
    }
    
    updateParticles(deltaTime) {
        const gravity = 0.5;
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            p.x += p.vx;
            p.y += p.vy;
            p.vy += gravity;
            p.life -= deltaTime / 1000;
            
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    
    drop() {
        this.currentPiece.y++;
        
        if (this.collision()) {
            this.currentPiece.y--;
            this.merge();
            this.clearLines();
            this.spawnPiece();
        }
        
        this.dropCounter = 0;
    }
    
    move(dir) {
        this.currentPiece.x += dir;
        
        if (this.collision()) {
            this.currentPiece.x -= dir;
        }
    }
    
    rotatePiece() {
        const rotated = this.rotate(this.currentPiece);
        const prevShape = this.currentPiece.shape;
        
        this.currentPiece.shape = rotated;
        
        if (this.collision()) {
            this.currentPiece.shape = prevShape;
        }
    }
    
    hardDrop() {
        while (!this.collision(0, 1)) {
            this.currentPiece.y++;
        }
        this.drop();
    }
    
    addGapRow() {
        this.board.shift();
        
        const gapRow = new Array(COLS).fill('temp_filled');
        const gaps = Math.floor(Math.random() * 3) + 2;
        const gapPositions = [];
        
        while (gapPositions.length < gaps) {
            const pos = Math.floor(Math.random() * COLS);
            if (!gapPositions.includes(pos)) {
                gapPositions.push(pos);
            }
        }
        
        for (const pos of gapPositions) {
            gapRow[pos] = 0;
        }
        
        this.addClusteredColors(gapRow);
        
        this.board.push(gapRow);
        
        if (this.collision()) {
            this.gameOverReason = '歯抜け行が追加できません';
            this.gameOver();
        } else if (this.checkGameOverCondition()) {
            this.gameOverReason = 'ブロックが危険ラインを超えました';
            this.gameOver();
        }
    }
    
    addClusteredColors(row) {
        const filledPositions = [];
        for (let i = 0; i < COLS; i++) {
            if (row[i] !== 0) {
                filledPositions.push(i);
            }
        }
        
        let currentPos = 0;
        while (currentPos < filledPositions.length) {
            const color = getRandomColor();
            const clusterSize = Math.floor(Math.random() * 3) + 2;
            
            for (let i = 0; i < clusterSize && currentPos < filledPositions.length; i++) {
                row[filledPositions[currentPos]] = color;
                currentPos++;
            }
        }
    }
    
    draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        this.drawGrid();
        this.drawBoard();
        this.drawGameOverLine();
        this.drawWinLine();
        this.drawPiece();
        this.drawParticles();
    }
    
    drawGrid() {
        ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
        ctx.lineWidth = 1;
        
        for (let col = 0; col <= COLS; col++) {
            const x = col * BLOCK_SIZE;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        for (let row = 0; row <= ROWS; row++) {
            const y = row * BLOCK_SIZE;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }
    
    drawGameOverLine() {
        const y = GAME_OVER_LINE * BLOCK_SIZE;
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    drawWinLine() {
        const y = WIN_LINE * BLOCK_SIZE;
        ctx.strokeStyle = '#00ff7f';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    drawBoard() {
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                if (this.board[row][col]) {
                    this.drawBlock(col * BLOCK_SIZE, row * BLOCK_SIZE, this.board[row][col]);
                }
            }
        }
        
        for (const block of this.animatingBlocks) {
            this.drawBlock(
                block.col * BLOCK_SIZE,
                block.currentRow * BLOCK_SIZE,
                block.color
            );
        }
    }
    
    drawPiece() {
        if (!this.currentPiece) return;
        
        const shape = this.currentPiece.shape;
        const color = this.currentPiece.color;
        
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    this.drawBlock(
                        (this.currentPiece.x + col) * BLOCK_SIZE,
                        (this.currentPiece.y + row) * BLOCK_SIZE,
                        color
                    );
                }
            }
        }
    }
    
    drawBlock(x, y, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, BLOCK_SIZE, BLOCK_SIZE);
        
        const gradient = ctx.createLinearGradient(x, y, x + BLOCK_SIZE, y + BLOCK_SIZE);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x + 2, y + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
        
        const highlightGradient = ctx.createRadialGradient(
            x + BLOCK_SIZE * 0.3, y + BLOCK_SIZE * 0.3, 0,
            x + BLOCK_SIZE * 0.3, y + BLOCK_SIZE * 0.3, BLOCK_SIZE * 0.5
        );
        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = highlightGradient;
        ctx.fillRect(x + 4, y + 4, BLOCK_SIZE / 2, BLOCK_SIZE / 2);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
    }
    
    drawParticles() {
        for (const p of this.particles) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(p.x - p.size / 3, p.y - p.size / 3, p.size / 3, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.globalAlpha = 1;
        }
    }
    
    drawNextPiece() {
        nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
        
        const shape = this.nextPiece.shape;
        const color = this.nextPiece.color;
        const blockSize = 25;
        
        const offsetX = (nextCanvas.width - shape[0].length * blockSize) / 2;
        const offsetY = (nextCanvas.height - shape.length * blockSize) / 2;
        
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    const x = offsetX + col * blockSize;
                    const y = offsetY + row * blockSize;
                    
                    nextCtx.fillStyle = color;
                    nextCtx.fillRect(x, y, blockSize, blockSize);
                    
                    nextCtx.fillStyle = `${color}88`;
                    nextCtx.fillRect(x + 2, y + 2, blockSize - 4, blockSize - 4);
                    
                    nextCtx.strokeStyle = `${color}CC`;
                    nextCtx.lineWidth = 1;
                    nextCtx.strokeRect(x + 0.5, y + 0.5, blockSize - 1, blockSize - 1);
                }
            }
        }
    }
    
    updateScore() {
        document.getElementById('score').textContent = this.score;
        // Update mobile score display
        const gameHeader = document.querySelector('.game-header');
        if (gameHeader) {
            gameHeader.setAttribute('data-score', this.score);
        }
    }
    
    
    gameOver() {
        this.isGameOver = true;
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOverReason').textContent = this.gameOverReason;
        document.getElementById('gameOverOverlay').style.display = 'flex';
    }
    
    gameWon() {
        this.isGameWon = true;
        this.isGameOver = true;
        document.getElementById('finalScore').textContent = this.score;
        const reasonElement = document.getElementById('gameOverReason');
        reasonElement.textContent = '勝利！すべてのブロックが緑線より下に収まりました！';
        reasonElement.className = 'game-over-reason victory';
        document.querySelector('.game-over-content h2').className = 'victory';
        document.getElementById('gameOverOverlay').style.display = 'flex';
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        document.getElementById('pauseOverlay').style.display = this.isPaused ? 'flex' : 'none';
    }
    
    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            if (this.isGameOver || !this.isStarted) return;
            
            if (e.key === ' ') {
                e.preventDefault();
                this.togglePause();
                return;
            }
            
            if (this.isPaused) return;
            
            switch(e.key) {
                case 'ArrowLeft':
                    this.move(-1);
                    break;
                case 'ArrowRight':
                    this.move(1);
                    break;
                case 'ArrowUp':
                    this.rotatePiece();
                    break;
                case 'ArrowDown':
                    this.drop();
                    break;
            }
        });
        
        // Touch controls setup
        this.setupTouchControls();
    }
    
    setupTouchControls() {
        const btnLeft = document.getElementById('btnLeft');
        const btnRight = document.getElementById('btnRight');
        const btnDown = document.getElementById('btnDown');
        const btnRotate = document.getElementById('btnRotate');
        const btnPause = document.getElementById('btnPause');
        
        // Prevent default touch behaviors
        const preventDefaults = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };
        
        // Long press settings
        const LONG_PRESS_DELAY = 200; // Initial delay before starting repeat
        const REPEAT_INTERVAL = 50; // Interval between repeats
        
        // Long press handlers
        const setupLongPress = (button, action) => {
            let pressTimer = null;
            let intervalTimer = null;
            
            const startPress = (e) => {
                preventDefaults(e);
                if (this.isGameOver || !this.isStarted || this.isPaused) return;
                
                // Execute action immediately
                action();
                
                // Start long press after delay
                pressTimer = setTimeout(() => {
                    intervalTimer = setInterval(() => {
                        if (!this.isGameOver && this.isStarted && !this.isPaused) {
                            action();
                        } else {
                            clearInterval(intervalTimer);
                        }
                    }, REPEAT_INTERVAL);
                }, LONG_PRESS_DELAY);
            };
            
            const endPress = (e) => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
                if (intervalTimer) {
                    clearInterval(intervalTimer);
                    intervalTimer = null;
                }
            };
            
            // Touch events
            button.addEventListener('touchstart', startPress);
            button.addEventListener('touchend', endPress);
            button.addEventListener('touchcancel', endPress);
            
            // Mouse events for PC
            button.addEventListener('mousedown', startPress);
            button.addEventListener('mouseup', endPress);
            button.addEventListener('mouseleave', endPress);
        };
        
        // Setup long press for movement buttons
        if (btnLeft) {
            setupLongPress(btnLeft, () => this.move(-1));
        }
        
        if (btnRight) {
            setupLongPress(btnRight, () => this.move(1));
        }
        
        if (btnDown) {
            setupLongPress(btnDown, () => this.drop());
        }
        
        // Rotate and Pause buttons (single press only)
        if (btnRotate) {
            btnRotate.addEventListener('touchstart', (e) => {
                preventDefaults(e);
                if (!this.isGameOver && this.isStarted && !this.isPaused) {
                    this.rotatePiece();
                }
            });
            btnRotate.addEventListener('click', (e) => {
                preventDefaults(e);
                if (!this.isGameOver && this.isStarted && !this.isPaused) {
                    this.rotatePiece();
                }
            });
        }
        
        if (btnPause) {
            btnPause.addEventListener('touchstart', (e) => {
                preventDefaults(e);
                if (!this.isGameOver && this.isStarted) {
                    this.togglePause();
                }
            });
            btnPause.addEventListener('click', (e) => {
                preventDefaults(e);
                if (!this.isGameOver && this.isStarted) {
                    this.togglePause();
                }
            });
        }
        
        // Prevent scrolling and zooming on the game area
        document.addEventListener('touchmove', (e) => {
            if (e.target.closest('.game-container')) {
                e.preventDefault();
            }
        }, { passive: false });
    }
    
    gameLoop(time = 0) {
        if (this.isGameOver || !this.isStarted) return;
        
        const deltaTime = time - this.lastTime;
        this.lastTime = time;
        
        if (!this.isPaused && !this.isAnimating) {
            this.dropCounter += deltaTime;
            this.gapRowTimer += deltaTime;
            
            if (this.dropCounter > TICK_SPEED) {
                this.drop();
            }
            
            if (this.gapRowTimer > this.gapRowInterval) {
                this.addGapRow();
                this.gapRowTimer = 0;
            }
        }
        
        if (!this.isPaused) {
            this.updateParticles(deltaTime);
        }
        
        this.draw();
        this.updateScore();
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }
}

let game;

function startGame() {
    if (game) {
        game.startGame();
    }
}

function restartGame() {
    document.getElementById('gameOverOverlay').style.display = 'none';
    document.getElementById('startOverlay').style.display = 'flex';
    document.getElementById('gameOverReason').className = 'game-over-reason';
    document.querySelector('.game-over-content h2').className = '';
    game = new Game();
}

window.onload = () => {
    game = new Game();
};