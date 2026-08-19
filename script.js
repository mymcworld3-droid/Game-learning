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
   遊戲物件狀態
========================= */
// 史萊姆玩家
const player = {
    x: cw / 2,
    y: ch / 2,
    radiusX: 31, // 寬度 62 的一半
    radiusY: 24, // 高度 48 的一半
    speed: 4.5,
    
    // === [新增] 玩家戰鬥數值 ===
    level: 1,
    hp: 100,
    maxHp: 100,
    displayHp: 100, // 用於製作扣血時的「白色緩衝殘影」效果
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
    // 1. 玩家移動
    player.x += dx * player.speed;
    player.y += dy * player.speed;

    // 邊界限制
    player.x = Math.max(player.radiusX, Math.min(cw - player.radiusX, player.x));
    player.y = Math.max(player.radiusY, Math.min(ch - player.radiusY, player.y));

    // 2. 搖桿淡入淡出動畫
    if (joystick.active) {
        joystick.opacity = Math.min(1, joystick.opacity + 0.15);
    } else {
        joystick.opacity = Math.max(0, joystick.opacity - 0.15);
    }

    // === [新增] 3. 更新 UI 數值與緩衝動畫 ===
    // 處理血條的白色緩衝動畫 (讓 displayHp 平滑跟隨 hp)
    if (player.displayHp > player.hp) {
        player.displayHp -= (player.displayHp - player.hp) * 0.08; // 0.08 控制殘影消失的速度
        if (player.displayHp - player.hp < 0.5) player.displayHp = player.hp; 
    } else {
        player.displayHp = player.hp; // 回血時不顯示白色，直接跟上
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

    // 2. 繪製玩家 (史萊姆)
    drawPlayer();

    // 3. 繪製搖桿
    if (joystick.opacity > 0) {
        drawJoystick();
    }

    // === [新增] 4. 繪製畫面上方的 HUD (血條、能量、等級) ===
    drawHUD();
}

/* =========================
   繪製函式細節
========================= */
// === [新增] 繪製 HUD 介面 ===
function drawHUD() {
    const hudX = 20; // 距離螢幕左邊的邊距
    const hudY = 24; // 距離螢幕上面的邊距

    const levelRadius = 22; // 等級圓圈半徑
    const barWidth = 180;   // 血條長度
    const hpHeight = 16;    // 血條高度
    const energyHeight = 6; // 能量條高度 (較細)
    const barSpacing = 6;   // 血條與能量條的間距

    // 計算圓心座標
    const cx = hudX + levelRadius;
    const cy = hudY + levelRadius;

    /* --- 1. 繪製長條圖 (在圓圈右側) --- */
    const barStartX = cx + levelRadius + 8; // 圓圈右邊再空 8px
    const barStartY = cy - (hpHeight + energyHeight + barSpacing) / 2; // 置中對齊圓圈

    // [HP 背景] 深灰色
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(barStartX, barStartY, barWidth, hpHeight);

    // [HP 白色緩衝區] (負責顯示劇降殘影)
    const displayHpRatio = player.displayHp / player.maxHp;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(barStartX, barStartY, barWidth * displayHpRatio, hpHeight);

    // [HP 當前血量] 紅色 (直接畫在白色上面)
    const hpRatio = player.hp / player.maxHp;
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(barStartX, barStartY, barWidth * hpRatio, hpHeight);

    // [HP 邊框]
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.lineWidth = 2;
    ctx.strokeRect(barStartX, barStartY, barWidth, hpHeight);


    // [能量 背景] 深灰色
    const energyStartY = barStartY + hpHeight + barSpacing;
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(barStartX, energyStartY, barWidth, energyHeight);

    // [能量 當前值] 橘色
    const energyRatio = player.energy / player.maxEnergy;
    ctx.fillStyle = "#f39c12"; // 橘色
    ctx.fillRect(barStartX, energyStartY, barWidth * energyRatio, energyHeight);

    // [能量 邊框]
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barStartX, energyStartY, barWidth, energyHeight);


    /* --- 2. 繪製等級圓圈 (後畫，這樣可以稍微疊在血條上產生層次) --- */
    ctx.fillStyle = "#2c3e50"; // 圓圈底色 (深藍灰)
    ctx.beginPath();
    ctx.arc(cx, cy, levelRadius, 0, Math.PI * 2);
    ctx.fill();

    // 圓圈邊框
    ctx.strokeStyle = "#f1c40f"; // 金色
    ctx.lineWidth = 3;
    ctx.stroke();

    // 圓圈內的數字 (等級)
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(player.level, cx, cy + 1); // +1 為了視覺稍微向下對齊
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

    // B. 史萊姆身體 (橢圓)
    ctx.fillStyle = "#4ade80";
    ctx.strokeStyle = "#166534";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(px, py, player.radiusX, player.radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // C. 眼睛 (左眼與右眼)
    ctx.fillStyle = "#10251a";
    // 左眼
    ctx.beginPath();
    ctx.arc(px - 13 + eyeOffsetX, py - 6 + eyeOffsetY, 4, 0, Math.PI * 2);
    ctx.fill();
    // 右眼
    ctx.beginPath();
    ctx.arc(px + 13 + eyeOffsetX, py - 6 + eyeOffsetY, 4, 0, Math.PI * 2);
    ctx.fill();

    // 手部的橢圓軌道
    const orbitRx = player.radiusX + 16; 
    const orbitRy = player.radiusY + 16; 
    const handX = px + Math.cos(handAngle) * orbitRx;
    const handY = py + Math.sin(handAngle) * orbitRy;

    // D. 繪製圓形手
    ctx.fillStyle = "#4ade80";
    ctx.strokeStyle = "#166534";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(handX, handY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
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
// 為了讓你看到白色扣血特效，這裡設定每 3 秒自動扣一次血與能量
setInterval(() => {
    // 隨機扣除 15 ~ 45 點血量
    const damage = Math.floor(Math.random() * 30 + 15);
    player.hp -= damage;

    // 消耗 40 點能量 (能量會自動回復)
    player.energy -= 40;
    if (player.energy < 0) player.energy = 0;
    
    // 如果血量歸零，模擬升級並補滿血
    if (player.hp <= 0) {
        player.hp = player.maxHp;
        player.level += 1;
    }
}, 3000);

// 啟動遊戲
gameLoop();
