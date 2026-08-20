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
    radiusX: 31, 
    radiusY: 24, 
    
    // 玩家基礎戰鬥數值
    level: 1,
    hp: 1145,         
    maxHp: 1145,
    displayHp: 1145,  
    atk: 66,          
    spd: 650,         
    energy: 100,
    maxEnergy: 100,

    atkSpeed: 500,    // 攻速 0.5 秒
    lastAtkTime: 0    
};

// 背包系統狀態
const inventory = {
    open: false,             // 背包是否開啟
    currentTab: "weapon",    // 當前分頁: "weapon" (武器) 或 "armor" (防具)
    cols: 7,                 // 7 欄
    rows: 4,                 // 4 列 (共 28 格)
    
    // 武器分頁物品欄 (28格)
    weaponSlots: [
        { name: "新手木劍", icon: "🗡️", atk: 10 },
        { name: "鐵製長劍", icon: "⚔️", atk: 25 },
        null, null, null, null, null,
        null, null, null, null, null, null, null,
        null, null, null, null, null, null, null,
        null, null, null, null, null, null, null
    ],
    
    // 防具分頁物品欄 (28格)
    armorSlots: [
        { name: "布製皮甲", icon: "👕", def: 5 },
        { name: "騎士盾牌", icon: "🛡️", def: 15 },
        null, null, null, null, null,
        null, null, null, null, null, null, null,
        null, null, null, null, null, null, null,
        null, null, null, null, null, null, null
    ]
};

// 雙搖桿系統狀態
const moveJoy = { active: false, originX: 0, originY: 0, stickX: 0, stickY: 0, maxDist: 39, opacity: 0 };
const atkJoy  = { active: false, originX: 0, originY: 0, stickX: 0, stickY: 0, maxDist: 39, opacity: 0, angle: 0, isDragging: false };

let dx = 0;
let dy = 0;
const eyeMaxOffset = 5;
let handAngle = Math.PI / 4; 

let movePointerId = null;
let atkPointerId = null;

const attacks = [];

/* =========================
   輸入監聽 (背包 + 雙搖桿)
========================= */
canvas.addEventListener("pointerdown", e => {
    canvas.setPointerCapture(e.pointerId);

    // 1. 檢查是否點擊右上角背包按鈕
    const btnSize = 48;
    const btnX = cw - btnSize - 16;
    const btnY = 16;

    if (e.clientX >= btnX && e.clientX <= btnX + btnSize &&
        e.clientY >= btnY && e.clientY <= btnY + btnSize) {
        inventory.open = !inventory.open; // 開啟 / 關閉背包
        return;
    }

    // 2. 如果背包開啟中，處理靠右側背包內部的點擊 (切換 Tab 或關閉)
    if (inventory.open) {
        const panelW = 340;
        const panelH = 260;
        const panelX = cw - panelW - 20; // 靠右側點擊邊界
        const panelY = (ch - panelH) / 2;

        // 點擊關閉按鈕 [X]
        if (e.clientX >= panelX + panelW - 35 && e.clientX <= panelX + panelW - 10 &&
            e.clientY >= panelY + 10 && e.clientY <= panelY + 35) {
            inventory.open = false;
            return;
        }

        // 點擊 "武器" 分頁
        if (e.clientX >= panelX + 16 && e.clientX <= panelX + 96 &&
            e.clientY >= panelY + 40 && e.clientY <= panelY + 68) {
            inventory.currentTab = "weapon";
            return;
        }

        // 點擊 "防具" 分頁
        if (e.clientX >= panelX + 104 && e.clientX <= panelX + 184 &&
            e.clientY >= panelY + 40 && e.clientY <= panelY + 68) {
            inventory.currentTab = "armor";
            return;
        }

        // 如果點擊在背包面板內部，直接消耗點擊事件，不觸發搖桿
        if (e.clientX >= panelX && e.clientX <= panelX + panelW &&
            e.clientY >= panelY && e.clientY <= panelY + panelH) {
            return;
        }
    }

    // 3. 搖桿控制
    if (e.clientX < cw / 2 && e.clientY > ch / 2) {
        if (movePointerId === null) {
            movePointerId = e.pointerId;
            moveJoy.active = true;
            moveJoy.originX = e.clientX; moveJoy.originY = e.clientY;
            moveJoy.stickX = e.clientX; moveJoy.stickY = e.clientY;
            updateMoveJoy(e.clientX, e.clientY);
        }
    }
    else if (e.clientX > cw / 2 && e.clientY > ch / 2) {
        if (atkPointerId === null) {
            atkPointerId = e.pointerId;
            atkJoy.active = true;
            atkJoy.originX = e.clientX; atkJoy.originY = e.clientY;
            atkJoy.stickX = e.clientX; atkJoy.stickY = e.clientY;
            atkJoy.angle = handAngle; 
            atkJoy.isDragging = false;
            updateAtkJoy(e.clientX, e.clientY);
        }
    }
});

canvas.addEventListener("pointermove", e => {
    if (e.pointerId === movePointerId && moveJoy.active) {
        updateMoveJoy(e.clientX, e.clientY);
    } else if (e.pointerId === atkPointerId && atkJoy.active) {
        updateAtkJoy(e.clientX, e.clientY);
    }
});

function handlePointerUp(e) {
    if (e.pointerId === movePointerId) {
        moveJoy.active = false;
        movePointerId = null;
        dx = 0; dy = 0;
    } else if (e.pointerId === atkPointerId) {
        atkJoy.active = false;
        atkPointerId = null;
        atkJoy.isDragging = false;
    }
}

canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", handlePointerUp);

function updateMoveJoy(cx, cy) {
    let vx = cx - moveJoy.originX;
    let vy = cy - moveJoy.originY;
    const dist = Math.hypot(vx, vy);

    if (dist > moveJoy.maxDist) {
        vx = (vx / dist) * moveJoy.maxDist;
        vy = (vy / dist) * moveJoy.maxDist;
    }

    moveJoy.stickX = moveJoy.originX + vx;
    moveJoy.stickY = moveJoy.originY + vy;
    dx = vx / moveJoy.maxDist;
    dy = vy / moveJoy.maxDist;
}

function updateAtkJoy(cx, cy) {
    let vx = cx - atkJoy.originX;
    let vy = cy - atkJoy.originY;
    const dist = Math.hypot(vx, vy);

    if (dist > atkJoy.maxDist) {
        vx = (vx / dist) * atkJoy.maxDist;
        vy = (vy / dist) * atkJoy.maxDist;
    }

    atkJoy.stickX = atkJoy.originX + vx;
    atkJoy.stickY = atkJoy.originY + vy;

    if (dist > 5) {
        atkJoy.isDragging = true;
        atkJoy.angle = Math.atan2(vy, vx);
    } else {
        atkJoy.isDragging = false;
    }
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
    const actualMoveSpeed = (player.spd / 650) * 4.5;
    player.x += dx * actualMoveSpeed;
    player.y += dy * actualMoveSpeed;

    player.x = Math.max(player.radiusX, Math.min(cw - player.radiusX, player.x));
    player.y = Math.max(player.radiusY, Math.min(ch - player.radiusY, player.y));

    // 2. 搖桿淡入淡出
    moveJoy.opacity = moveJoy.active ? Math.min(1, moveJoy.opacity + 0.15) : Math.max(0, moveJoy.opacity - 0.15);
    atkJoy.opacity = atkJoy.active ? Math.min(1, atkJoy.opacity + 0.15) : Math.max(0, atkJoy.opacity - 0.15);

    // 3. UI 數值
    if (player.displayHp > player.hp) {
        player.displayHp -= (player.displayHp - player.hp) * 0.08; 
        if (player.displayHp - player.hp < 0.5) player.displayHp = player.hp; 
    } else {
        player.displayHp = player.hp; 
    }
    if (player.energy < player.maxEnergy) {
        player.energy = Math.min(player.maxEnergy, player.energy + 0.3);
    }

    // 4. 長按攻擊邏輯 (當背包關閉時才能攻擊)
    if (atkJoy.active && !inventory.open) {
        let now = Date.now();
        if (now - player.lastAtkTime >= player.atkSpeed) {
            player.lastAtkTime = now;
            let spawnAngle = atkJoy.isDragging ? atkJoy.angle : handAngle;
            spawnFist(spawnAngle);
        }
    }

    // 5. 更新攻擊動畫進度
    for (let i = attacks.length - 1; i >= 0; i--) {
        let atk = attacks[i];
        atk.progress += 0.08;
        if (atk.progress >= 1) {
            attacks.splice(i, 1);
        }
    }
}

function spawnFist(angle) {
    attacks.push({
        x: player.x,
        y: player.y,
        angle: angle,
        progress: 0 
    });
}

function draw() {
    // 1. 背景網格
    ctx.fillStyle = "#263746";
    ctx.fillRect(0, 0, cw, ch);

    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < cw; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, ch); }
    for (let y = 0; y < ch; y += 40) { ctx.moveTo(0, y); ctx.lineTo(cw, y); }
    ctx.stroke();

    // 2. 玩家與攻擊
    drawPlayer();

    // 3. 玩家頭頂 UI
    drawPlayerUI();

    // 4. 搖桿 (背包開啟時依然保留移動搖桿)
    if (moveJoy.opacity > 0) drawJoystick(moveJoy, "#ffffff");
    if (atkJoy.opacity > 0 && !inventory.open) drawJoystick(atkJoy, "#e74c3c");

    // 5. 繪製右上角背包按鈕與背包面板
    drawInventoryUI();
}

/* =========================
   繪製函式細節
========================= */
function drawPlayerUI() {
    const levelRadius = 11;
    const hpBarWidth = 54;     
    const energyBarWidth = 38; 
    const hpHeight = 7;     
    const energyHeight = 3; 
    const barSpacing = 2;   
    const gap = 5;          

    const totalWidth = (levelRadius * 2) + gap + hpBarWidth;
    const startX = player.x - (totalWidth / 2);
    const cx = startX + levelRadius;
    const cy = player.y - player.radiusY - 32; 

    const barStartX = cx + levelRadius + gap;
    const barStartY = cy - (hpHeight + energyHeight + barSpacing) / 2;

    const hpRadius = 3.5;    
    const energyRadius = 1.5; 

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; 
    ctx.beginPath(); ctx.roundRect(barStartX, barStartY, hpBarWidth, hpHeight, hpRadius); ctx.fill();

    let displayHpWidth = Math.max(0, hpBarWidth * (player.displayHp / player.maxHp));
    ctx.fillStyle = "#ffffff"; 
    ctx.beginPath(); ctx.roundRect(barStartX, barStartY, displayHpWidth, hpHeight, hpRadius); ctx.fill();

    let hpWidth = Math.max(0, hpBarWidth * (player.hp / player.maxHp));
    ctx.fillStyle = "#2ecc71"; 
    ctx.beginPath(); ctx.roundRect(barStartX, barStartY, hpWidth, hpHeight, hpRadius); ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,0.8)"; 
    ctx.lineWidth = 1.5; 
    ctx.beginPath(); ctx.roundRect(barStartX, barStartY, hpBarWidth, hpHeight, hpRadius); ctx.stroke();

    const energyStartY = barStartY + hpHeight + barSpacing;
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; 
    ctx.beginPath(); ctx.roundRect(barStartX, energyStartY, energyBarWidth, energyHeight, energyRadius); ctx.fill();

    let energyWidth = Math.max(0, energyBarWidth * (player.energy / player.maxEnergy));
    ctx.fillStyle = "#f39c12"; 
    ctx.beginPath(); ctx.roundRect(barStartX, energyStartY, energyWidth, energyHeight, energyRadius); ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,0.8)"; 
    ctx.lineWidth = 1; 
    ctx.beginPath(); ctx.roundRect(barStartX, energyStartY, energyBarWidth, energyHeight, energyRadius); ctx.stroke();

    ctx.fillStyle = "#2c3e50"; 
    ctx.beginPath(); ctx.arc(cx, cy, levelRadius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#f1c40f"; ctx.lineWidth = 2.5; ctx.stroke();
    
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 13px system-ui, sans-serif"; 
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(player.level, cx, cy + 1); 
}

function drawPlayer() {
    const px = player.x;
    const py = player.y;

    if (atkJoy.isDragging) {
        let angleDiff = atkJoy.angle - handAngle;
        angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
        handAngle += angleDiff * 0.3; 
    } else if (dx !== 0 || dy !== 0) {
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

    // B. 身體
    if (sprites.body.complete && sprites.body.naturalWidth !== 0) {
        ctx.drawImage(sprites.body, px - 35, py - 28, 70, 56);
    }

    // C. 眼睛
    if (sprites.eyes.complete && sprites.eyes.naturalWidth !==
