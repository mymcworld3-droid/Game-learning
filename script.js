/* =========================
   畫布與環境設定
========================= */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let cw = canvas.width = window.innerWidth;
let ch = canvas.height = window.innerHeight;

window.addEventListener("resize", () => {
    cw = canvas.width = window.innerWidth;
    ch = canvas.height = window.innerHeight;
    // 確保改變視窗時角色不會跑出界
    player.x = Math.max(player.radiusX, Math.min(cw - player.radiusX, player.x));
    player.y = Math.max(player.radiusY, Math.min(ch - player.radiusY, player.y));
});

/* =========================
   載入遊戲圖片素材 (Sprites)
========================= */
const sprites = {
    body: new Image(),
    eyes: new Image(),
    hand: new Image()
};

// 指定圖片路徑 (確保與你的資料夾結構一致)
sprites.body.src = "asset/body.png";
sprites.eyes.src = "asset/eyes.png";
sprites.hand.src = "asset/hand.png";

/* =========================
   遊戲物件狀態
========================= */
// 史萊姆玩家
const player = {
    x: cw / 2,
    y: ch / 2,
    radiusX: 31, // 碰撞體寬度的一半 (維持原比例)
    radiusY: 24, // 碰撞體高度的一半 (維持原比例)
    
    // === [修改處] 玩家基礎戰鬥數值 ===
    level: 1,
    hp: 1145,         // 基礎血量 1145
    maxHp: 1145,
    displayHp: 1145,  // 用於製作扣血時的「白色緩衝殘影」效果
    atk: 66,          // 基礎攻擊力 66
    spd: 650,         // 基礎速度 650 (這會轉換為實際畫布移動像素)
    energy: 100,
    maxEnergy: 100
};

// 自由搖桿
const joystick = {
    active: false,
    originX: 0,
    originY: 0,
    stickX: 0,
    stickY: 0,
    maxDistance: 39,
    opacity: 0 // 用於淡入淡出動畫
};

// 全域方向向量 (-1 到 1)
let dx = 0;
let dy = 0;

// 偏移設定
const eyeMaxOffset = 5;

// 手部環繞角度追蹤
let handAngle = Math.PI / 4; 

/* =========================
   輸入監聽 (直接綁定 Canvas)
========================= */
canvas.addEventListener("pointerdown", e => {
    joystick.active = true;
    canvas.setPointerCapture(e.pointerId);

    joystick.originX = e.clientX;
    joystick.originY = e.clientY;
    joystick.stickX = e.clientX;
    joystick.stickY = e.clientY;
    
    updateJoystick(e.clientX, e.clientY);
});

canvas.addEventListener("pointermove", e => {
    if (joystick.active) {
        updateJoystick(e.clientX, e.clientY);
    }
});

function releaseStick() {
    joystick.active = false;
    dx = 0;
    dy = 0;
}

canvas.addEventListener("pointerup", releaseStick);
canvas.addEventListener("pointercancel", releaseStick);

function updateJoystick(clientX, clientY) {
    let vx = clientX - joystick.originX;
    let vy = clientY - joystick.originY;
    const distance = Math.hypot(vx, vy);

    if (distance > joystick.maxDistance) {
        vx = (vx / distance) * joystick.maxDistance;
        vy = (vy / distance) * joystick.maxDistance;
    }

    joystick.stickX = joystick.originX + vx;
    joystick.stickY = joystick.originY + vy;

    dx = vx / joystick.maxDistance;
    dy = vy / joystick.maxDistance;
}

/* =========================
   主迴圈與渲染邏輯
========================= */
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function update() {
    // === [修改處] 1. 玩家移動速度轉換 ===
    // 650 的數值會對應到 4.5 的實際畫布移動速度
    const actualMoveSpeed = (player.spd / 650) * 4.5;
    player.x += dx * actualMoveSpeed;
    player.y += dy * actualMoveSpeed;

    // 邊界限制
    player.x = Math.max(player.radiusX, Math.min(cw - player.radiusX, player.x));
    player.y = Math.max(player.radiusY, Math.min(ch - player.radiusY, player.y));

    // 2. 搖桿淡入淡出動畫
    if (joystick.active) {
        joystick.opacity = Math.min(1, joystick.opacity + 0.15);
    } else {
        joystick.opacity = Math.max(0, joystick.opacity - 0.15);
    }

    // 3. 更新 UI 數值與緩衝動畫
    if (player.displayHp > player.hp) {
        // 血量變多，緩衝動畫速度稍微放慢一點點會更有感
        player.displayHp -= (player.displayHp - player.hp) * 0.08; 
        if (player.displayHp - player.hp < 0.5) player.displayHp = player.hp; 
    } else {
        player.displayHp = player.hp; 
    }

    // 能量自動回復
    if (player.energy < player.maxEnergy) {
        player.energy = Math.min(player.maxEnergy, player.energy + 0.3);
    }
}

function draw() {
    // 1. 清空畫布與繪製網格背景
    ctx.fillStyle = "#263746";
    ctx.fillRect(0, 0, cw, ch);

    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < cw; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, ch); }
    for (let y = 0; y < ch; y += 40) { ctx.moveTo(0, y); ctx.lineTo(cw, y); }
    ctx.stroke();

    // 2. 繪製玩家 (史萊姆圖片渲染)
    drawPlayer();

    // 3. 繪製玩家頭頂的 UI
    drawPlayerUI();

    // 4. 繪製搖桿
    if (joystick.opacity > 0) {
        drawJoystick();
    }
}

/* =========================
   繪製函式細節
========================= */
function drawPlayerUI() {
    const levelRadius = 11; 
    const barWidth = 54;    
    const hpHeight = 7;     
    const energyHeight = 3; 
    const barSpacing = 2;   
    const gap = 5;          

    const totalWidth = (levelRadius * 2) + gap + barWidth;
    const startX = player.x - (totalWidth / 2);
    
    const cx = startX + levelRadius;
    const cy = player.y - player.radiusY - 32; 

    /* --- 1. 繪製長條圖 --- */
    const barStartX = cx + levelRadius + gap;
    const barStartY = cy - (hpHeight + energyHeight + barSpacing) / 2;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(barStartX, barStartY, barWidth, hpHeight);

    const displayHpRatio = player.displayHp / player.maxHp;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(barStartX, barStartY, barWidth * displayHpRatio, hpHeight);

    const hpRatio = player.hp / player.maxHp;
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(barStartX, barStartY, barWidth * hpRatio, hpHeight);

    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barStartX, barStartY, barWidth, hpHeight);

    const energyStartY = barStartY + hpHeight + barSpacing;
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(barStartX, energyStartY, barWidth, energyHeight);

    const energyRatio = player.energy / player.maxEnergy;
    ctx.fillStyle = "#f39c12"; 
    ctx.fillRect(barStartX, energyStartY, barWidth * energyRatio, energyHeight);

    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.lineWidth = 1; 
    ctx.strokeRect(barStartX, energyStartY, barWidth, energyHeight);

    /* --- 2. 繪製等級圓圈 --- */
    ctx.fillStyle = "#2c3e50"; 
    ctx.beginPath();
    ctx.arc(cx, cy, levelRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#f1c40f"; 
    ctx.lineWidth = 2.5; 
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px system-ui, sans-serif"; 
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(player.level, cx, cy + 1); 
}

function drawPlayer() {
    const px = player.x;
    const py = player.y;

    if (dx !== 0 || dy !== 0) {
        let targetAngle = Math.atan2(dy, dx);
        let angleDiff = targetAngle - handAngle;
        angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
        handAngle += angleDiff * 0.15; 
    }

    const eyeOffsetX = Math.cos(handAngle) * eyeMaxOffset;
    const eyeOffsetY = Math.sin(handAngle) * eyeMaxOffset;

    // A. 影子
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(px, py + 12, player.radiusX, player.radiusY - 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // B. 史萊姆身體圖片
    if (sprites.body.complete) {
        ctx.drawImage(sprites.body, px - 35, py - 28, 70, 56);
    }

    // C. 史萊姆雙眼圖片
    if (sprites.eyes.complete) {
        ctx.drawImage(sprites.eyes, px - 19 + eyeOffsetX, py - 12 + eyeOffsetY, 38, 12);
    }

    // 手部的橢圓軌道計算
    const orbitRx = player.radiusX + 16; 
    const orbitRy = player.radiusY + 16; 
    const handX = px + Math.cos(handAngle) * orbitRx;
    const handY = py + Math.sin(handAngle) * orbitRy;

    // D. 史萊姆圓形手圖片
    if (sprites.hand.complete) {
        ctx.drawImage(sprites.hand, handX - 10, handY - 10, 20, 20);
    }
}

function drawJoystick() {
    ctx.globalAlpha = joystick.opacity;

    // 大圓
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(joystick.originX, joystick.originY, 75, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 小圓
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(joystick.stickX, joystick.stickY, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 1.0;
}

/* =========================
   展示用：測試傷害與等級機制
========================= */
setInterval(() => {
    // === [修改處] 放大測試用的傷害值 (配合 1145 的血量) ===
    const damage = Math.floor(Math.random() * 300 + 150); // 隨機扣 150 ~ 450
    player.hp -= damage;

    player.energy -= 40;
    if (player.energy < 0) player.energy = 0;
    
    if (player.hp <= 0) {
        player.hp = player.maxHp;
        player.level += 1;
    }
}, 3000);

// 啟動遊戲
gameLoop();
