const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("screenOverlay");
const overlayTitle = overlay.querySelector("strong");
const overlayText = overlay.querySelector("span");
const coinImage = new Image();
coinImage.src = "assets/solana-coin.png";
const createSessionId = () => {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};
const sessionId = sessionStorage.getItem("bimosolSessionId") || createSessionId();
sessionStorage.setItem("bimosolSessionId", sessionId);
const sessionBestKey = `bimosolBest:${sessionId}`;

const game = {
  mode: "ready",
  width: canvas.width,
  height: canvas.height,
  bird: { x: 138, y: 180, vy: 0, radius: 14 },
  pipes: [],
  coins: [],
  score: 0,
  best: Number(sessionStorage.getItem(sessionBestKey) || 0),
  spawnTimer: 0,
  groundOffset: 0,
  coinFlash: 0,
  lastTime: 0,
};

const physics = {
  gravity: 1040,
  flap: -330,
  maxFall: 430,
  pipeSpeed: 150,
  pipeInterval: 1.48,
  gap: 150,
  pipeWidth: 54,
  coinSize: 34,
  coinValue: 3,
};

function setOverlay(title, text, visible = true) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.toggle("hidden", !visible);
}

function resetGame() {
  game.mode = "playing";
  game.bird.y = game.height * 0.48;
  game.bird.vy = 0;
  game.pipes = [];
  game.coins = [];
  game.score = 0;
  game.spawnTimer = 0;
  game.coinFlash = 0;
  spawnPipe();
  setOverlay("", "", false);
}

function flap() {
  if (game.mode === "ready" || game.mode === "dead") {
    resetGame();
  }

  if (game.mode === "paused") {
    game.mode = "playing";
    setOverlay("", "", false);
  }

  if (game.mode === "playing") {
    game.bird.vy = physics.flap;
  }
}

function pauseGame() {
  if (game.mode === "playing") {
    game.mode = "paused";
    setOverlay("PAUSED", "press P to resume");
    return;
  }

  if (game.mode === "paused") {
    game.mode = "playing";
    setOverlay("", "", false);
    return;
  }

  resetGame();
}

function endGame() {
  if (game.mode === "dead") {
    return;
  }

  game.mode = "dead";
  game.best = Math.max(game.best, game.score);
  sessionStorage.setItem(sessionBestKey, String(game.best));
  setOverlay("GAME OVER", "tap the screen to restart");
}

function spawnPipe() {
  const margin = 46;
  const usable = game.height - physics.gap - margin * 2;
  const top = margin + Math.random() * usable;
  const pipeX = game.width + 14;

  game.pipes.push({
    x: pipeX,
    top,
    bottom: top + physics.gap,
    passed: false,
  });

  if (Math.random() > 0.25) {
    game.coins.push({
      x: pipeX + physics.pipeWidth * 0.5,
      y: top + physics.gap * 0.5 + (Math.random() - 0.5) * 52,
      size: physics.coinSize,
      collected: false,
      spin: Math.random() * Math.PI * 2,
    });
  }
}

function update(dt) {
  if (game.mode !== "playing") {
    return;
  }

  game.spawnTimer += dt;
  game.groundOffset = (game.groundOffset + physics.pipeSpeed * dt) % 34;
  game.coinFlash = Math.max(0, game.coinFlash - dt);

  if (game.spawnTimer >= physics.pipeInterval) {
    game.spawnTimer = 0;
    spawnPipe();
  }

  game.bird.vy = Math.min(game.bird.vy + physics.gravity * dt, physics.maxFall);
  game.bird.y += game.bird.vy * dt;

  for (const pipe of game.pipes) {
    pipe.x -= physics.pipeSpeed * dt;

    if (!pipe.passed && pipe.x + physics.pipeWidth < game.bird.x - game.bird.radius) {
      pipe.passed = true;
      game.score += 1;
    }

    if (hitsPipe(pipe)) {
      endGame();
    }
  }

  game.pipes = game.pipes.filter((pipe) => pipe.x > -physics.pipeWidth - 20);

  for (const coin of game.coins) {
    coin.x -= physics.pipeSpeed * dt;
    coin.spin += dt * 4;

    if (!coin.collected && hitsCoin(coin)) {
      coin.collected = true;
      game.score += physics.coinValue;
      game.coinFlash = 0.65;
    }
  }

  game.coins = game.coins.filter((coin) => !coin.collected && coin.x > -coin.size - 20);

  if (game.bird.y < game.bird.radius + 4 || game.bird.y > game.height - game.bird.radius - 12) {
    endGame();
  }
}

function hitsPipe(pipe) {
  const birdLeft = game.bird.x - game.bird.radius;
  const birdRight = game.bird.x + game.bird.radius;
  const birdTop = game.bird.y - game.bird.radius;
  const birdBottom = game.bird.y + game.bird.radius;
  const pipeLeft = pipe.x;
  const pipeRight = pipe.x + physics.pipeWidth;

  if (birdRight < pipeLeft || birdLeft > pipeRight) {
    return false;
  }

  return birdTop < pipe.top || birdBottom > pipe.bottom;
}

function hitsCoin(coin) {
  const dx = game.bird.x - coin.x;
  const dy = game.bird.y - coin.y;
  const collectRadius = game.bird.radius + coin.size * 0.42;

  return dx * dx + dy * dy < collectRadius * collectRadius;
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, game.height);
  sky.addColorStop(0, "#baf1ce");
  sky.addColorStop(.58, "#8ee3d5");
  sky.addColorStop(1, "#d9ef81");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, game.width, game.height);

  ctx.fillStyle = "rgba(255, 248, 199, .92)";
  drawCloud(72, 78, 26);
  drawCloud(454, 52, 20);

  ctx.fillStyle = "#83cd4c";
  ctx.fillRect(0, game.height - 26, game.width, 26);
  ctx.strokeStyle = "#101318";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, game.height - 26);
  ctx.lineTo(game.width, game.height - 26);
  ctx.stroke();

  ctx.strokeStyle = "rgba(16, 19, 24, .28)";
  ctx.lineWidth = 2;
  for (let x = -game.groundOffset; x < game.width; x += 34) {
    ctx.beginPath();
    ctx.moveTo(x, game.height - 12);
    ctx.lineTo(x + 16, game.height - 19);
    ctx.stroke();
  }
}

function drawCloud(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, Math.PI, 0);
  ctx.arc(x + r * .85, y, r * .72, Math.PI, 0);
  ctx.arc(x + r * 1.45, y, r * .5, Math.PI, 0);
  ctx.lineTo(x + r * 1.95, y + r * .5);
  ctx.lineTo(x - r * .2, y + r * .5);
  ctx.closePath();
  ctx.fill();
}

function drawPipes() {
  for (const pipe of game.pipes) {
    drawPipe(pipe.x, -8, physics.pipeWidth, pipe.top + 8);
    drawPipe(pipe.x, pipe.bottom, physics.pipeWidth, game.height - pipe.bottom);
  }
}

function drawCoins() {
  for (const coin of game.coins) {
    const pulse = 1 + Math.sin(coin.spin * 2) * 0.06;
    const size = coin.size * pulse;

    ctx.save();
    ctx.translate(coin.x, coin.y);
    ctx.rotate(Math.sin(coin.spin) * 0.08);

    if (coinImage.complete && coinImage.naturalWidth > 0) {
      ctx.drawImage(coinImage, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = "#111722";
      ctx.strokeStyle = "#8ee3ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawPipe(x, y, width, height) {
  ctx.fillStyle = "#72ca42";
  ctx.strokeStyle = "#101318";
  ctx.lineWidth = 4;
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x, y, width, height);

  const capY = y <= 0 ? y + height - 16 : y;
  ctx.fillStyle = "#05cba8";
  ctx.fillRect(x - 7, capY, width + 14, 16);
  ctx.strokeRect(x - 7, capY, width + 14, 16);
}

function drawBird() {
  const tilt = Math.max(-0.42, Math.min(0.55, game.bird.vy / 430));

  ctx.save();
  ctx.translate(game.bird.x, game.bird.y);
  ctx.rotate(tilt);

  ctx.fillStyle = "#ffea26";
  ctx.strokeStyle = "#101318";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, game.bird.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(5, -5, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#101318";
  ctx.beginPath();
  ctx.arc(6.5, -5, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f72566";
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(28, 6);
  ctx.lineTo(12, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f6c843";
  ctx.beginPath();
  ctx.ellipse(-8, 6, 7, 10, -.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawHud() {
  ctx.fillStyle = "#101318";
  ctx.font = "700 24px Fredoka, Arial";
  ctx.fillText(String(game.score), game.width / 2 - 8, 36);

  ctx.font = "700 13px Inter, Arial";
  ctx.fillText(`BEST ${game.best}`, 16, 25);

  if (game.coinFlash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, game.coinFlash * 2);
    ctx.fillStyle = "#7b35ff";
    ctx.font = "700 18px Fredoka, Arial";
    ctx.fillText(`+${physics.coinValue} SOL`, game.width - 96, 28);
    ctx.restore();
  }
}

function render(time = 0) {
  const rawDt = (time - game.lastTime) / 1000 || 0;
  const dt = Math.min(rawDt, 0.033);
  game.lastTime = time;

  update(dt);
  drawBackground();
  drawPipes();
  drawCoins();
  drawBird();
  drawHud();

  requestAnimationFrame(render);
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  flap();
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    flap();
  }

  if (event.code === "Enter") {
    resetGame();
  }

  if (event.code === "KeyP") {
    pauseGame();
  }
});

drawBackground();
drawBird();
drawHud();
requestAnimationFrame(render);
