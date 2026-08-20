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

    // === [新增] 攻擊機制屬性 ===
    atkSpeed: 500,    // 攻速 0.5 秒 (500毫秒)
    lastAtkTime: 0    // 記錄上次攻擊時間
};

// === [修改處] 雙搖桿系統狀態 ===
const moveJoy = { active: false, originX: 0, originY: 0, stickX: 0, stickY: 0, maxDist: 39, opacity: 0 };
const atkJoy  = { active: false, originX: 0, originY: 0, stickX: 0, stickY: 0, maxDist: 39, opacity: 0, angle: 0, isDragging: false };

let dx = 0;
let dy = 0;
const eyeMaxOffset = 5;
let handAngle = Math.PI / 4; 

// 追蹤多點觸控的 ID
let movePointerId = null;
let atkPointerId = null;

// === [新增] 儲存普攻特效的陣列 ===
const attacks = [];

/* =========================
   輸入監聽 (支援多點觸控的雙搖桿)
========================= */
canvas.addEventListener("pointerdown", e => {
    canvas.setPointerCapture(e.pointerId);

    // 判斷落點是否在「左下四分之一」 (移動)
    if (e.clientX < cw / 2 && e.clientY > ch / 2) {
        if (movePointerId === null) {
            movePointerId = e.pointerId;
            moveJoy.active = true;
            moveJoy.originX = e.clientX; moveJoy.originY = e.clientY;
            moveJoy.stickX = e.clientX; moveJoy.stickY = e.clientY;
            updateMoveJoy(e.clientX, e.clientY);
        }
    }
    // 判斷落點是否在「右下四分之一」 (攻擊)
    else if (e.clientX > cw / 2 && e.clientY > ch / 2) {
        if (atkPointerId === null) {
            atkPointerId = e.pointerId;
            atkJoy.active = true;
            atkJoy.originX = e.clientX; atkJoy.originY = e.clientY;
            atkJoy.stickX = e.clientX; atkJoy.stickY = e.clientY;
            atkJoy.angle = handAngle; // 預設攻擊方向為當前面向方向
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
canvas.addEventListener("pointerout", handlePointerUp);

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

    // 當攻擊搖桿拖曳超過 5px 時，判定為瞄準模式
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

    // === [重點新增] 4. 處理長按攻擊邏輯 ===
    if (atkJoy.active) {
        let now = Date.now();
        // 檢查是否超過 0.5 秒冷卻
        if (now - player.lastAtkTime >= player.atkSpeed) {
            player.lastAtkTime = now;
            // 發射拳頭 (如果有拖曳就朝拖曳方向，否則朝當前角色面朝方向)
            let spawnAngle = atkJoy.isDragging ? atkJoy.angle : handAngle;
            spawnFist(spawnAngle);
        }
    }

    // 5. 更新所有正在打出的拳頭動畫進度
    for (let i = attacks.length - 1; i >= 0; i--) {
        let atk = attacks[i];
        atk.progress += 0.08; // 出拳的速度 (約 12 幀打完)
        if (atk.progress >= 1) {
            attacks.splice(i, 1); // 打完收拳
        }
    }
}

// 產生拳頭攻擊
function spawnFist(angle) {
    attacks.push({
        x: player.x,
        y: player.y,
        angle: angle,
        progress: 0 // 出拳進度 (0 到 1)
    });
}

function draw() {
    // 清空背景
    ctx.fillStyle = "#263746";
    ctx.fillRect(0, 0, cw, ch);

    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < cw; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, ch); }
    for (let y = 0; y < ch; y += 40) { ctx.moveTo(0, y); ctx.lineTo(cw, y); }
    ctx.stroke();

    // 繪製角色與攻擊特效
    drawPlayer();

    // 繪製 UI
    drawPlayerUI();

    // 繪製左右搖桿
    if (moveJoy.opacity > 0) drawJoystick(moveJoy, "#ffffff"); // 移動搖桿 (白色核心)
    if (atkJoy.opacity > 0) drawJoystick(atkJoy, "#e74c3c");   // 攻擊搖桿 (紅色核心提示)
}

/* =========================
   繪製函式細節
========================= */
function drawPlayerUI() {
    const levelRadius = 11, barWidth = 54, hpHeight = 7, energyHeight = 3, barSpacing = 2, gap = 5;          
    const totalWidth = (levelRadius * 2) + gap + barWidth;
    const startX = player.x - (totalWidth / 2);
    const cx = startX + levelRadius;
    const cy = player.y - player.radiusY - 32; 

    const barStartX = cx + levelRadius + gap;
    const barStartY = cy - (hpHeight + energyHeight + barSpacing) / 2;

    // [HP 背景]
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; 
    ctx.fillRect(barStartX, barStartY, barWidth, hpHeight);
    
    // [HP 緩衝特效 (白色)]
    ctx.fillStyle = "#ffffff"; 
    ctx.fillRect(barStartX, barStartY, barWidth * (player.displayHp / player.maxHp), hpHeight);
    
    // === [修改處] HP 當前血量 (改成綠色) ===
    ctx.fillStyle = "#2ecc71"; // 經典的生命值綠色
    ctx.fillRect(barStartX, barStartY, barWidth * (player.hp / player.maxHp), hpHeight);
    
    // [HP 邊框]
    ctx.strokeStyle = "rgba(0,0,0,0.8)"; 
    ctx.lineWidth = 1.5; 
    ctx.strokeRect(barStartX, barStartY, barWidth, hpHeight);

    // [能量 背景]
    const energyStartY = barStartY + hpHeight + barSpacing;
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; 
    ctx.fillRect(barStartX, energyStartY, barWidth, energyHeight);
    
    // [能量 當前值 (橘色)]
    ctx.fillStyle = "#f39c12"; 
    ctx.fillRect(barStartX, energyStartY, barWidth * (player.energy / player.maxEnergy), energyHeight);
    
    // [能量 邊框]
    ctx.strokeStyle = "rgba(0,0,0,0.8)"; 
    ctx.lineWidth = 1; 
    ctx.strokeRect(barStartX, energyStartY, barWidth, energyHeight);

    // [等級圓圈]
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

    // === [修改處] 決定面向角度 ===
    if (atkJoy.isDragging) {
        // 如果正在拖曳攻擊搖桿，強制看向攻擊方向
        let angleDiff = atkJoy.angle - handAngle;
        angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
        handAngle += angleDiff * 0.3; // 轉頭速度較快
    } else if (dx !== 0 || dy !== 0) {
        // 否則看向移動方向
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
    if (sprites.eyes.complete && sprites.eyes.naturalWidth !== 0) {
        ctx.drawImage(sprites.eyes, px - 19 + eyeOffsetX, py - 12 + eyeOffsetY, 38, 12);
    }

    // D. 普攻特效 (利用數學 Sin 函數做來回突刺動畫)
    attacks.forEach(atk => {
        // progress 從 0 -> 1，Math.sin(0~PI) 會做出平滑的伸出與收回效果
        const reach = Math.sin(atk.progress * Math.PI) * 55; // 拳頭最遠打到 55px 外
        const fx = atk.x + Math.cos(atk.angle) * (player.radiusX + reach);
        const fy = atk.y + Math.sin(atk.angle) * (player.radiusY + reach);

        if (sprites.hand.complete && sprites.hand.naturalWidth !== 0) {
            // 將 hand 圖片稍微放大(30x30)當作拳頭
            ctx.drawImage(sprites.hand, fx - 15, fy - 15, 30, 30);
        }
    });

    // E. 靜態待機圓形手 (如果有攻擊在打，就把靜態手藏起來)
    if (attacks.length === 0) {
        const orbitRx = player.radiusX + 16; 
        const orbitRy = player.radiusY + 16; 
        const handX = px + Math.cos(handAngle) * orbitRx;
        const handY = py + Math.sin(handAngle) * orbitRy;
        if (sprites.hand.complete && sprites.hand.naturalWidth !== 0) {
            ctx.drawImage(sprites.hand, handX - 10, handY - 10, 20, 20);
        }
    }
}

// 共用的繪製搖桿函式
function drawJoystick(joy, coreColor) {
    ctx.globalAlpha = joy.opacity;

    // 大圓底座
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(joy.originX, joy.originY, 75, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 小圓中心點
    ctx.fillStyle = coreColor === "#ffffff" ? "rgba(255,255,255,0.72)" : "rgba(231, 76, 60, 0.72)";
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(joy.stickX, joy.stickY, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 1.0;
}

// 啟動遊戲
gameLoop();
