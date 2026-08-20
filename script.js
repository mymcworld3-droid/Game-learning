/* =========================
   畫布與環境設定 (支援高畫質螢幕防模糊)
========================= */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let cw = window.innerWidth;
let ch = window.innerHeight;

// === [新增] 定義固定搖桿的半徑 ===
const JOYSTICK_RADIUS = 75; 

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1; 
    cw = window.innerWidth;
    ch = window.innerHeight;
    
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); 

    if (typeof player !== 'undefined') {
        player.x = Math.max(player.radiusX, Math.min(cw - player.radiusX, player.x));
        player.y = Math.max(player.radiusY, Math.min(ch - player.radiusY, player.y));
    }

    // === [新增] 視窗改變時，更新攻擊搖桿的固定位置 (右下角) ===
    atkJoy.originX = cw - JOYSTICK_RADIUS - 40; 
    atkJoy.originY = ch - JOYSTICK_RADIUS - 40; 
}

window.addEventListener("resize", resizeCanvas);

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
const player = {
    x: cw / 2,
    y: ch / 2,
    radiusX: 31, 
    radiusY: 24, 
    
    level: 1,
    hp: 1145,         
    maxHp: 1145,
    displayHp: 1145,  
    atk: 66,          
    spd: 650,         
    energy: 100,
    maxEnergy: 100,

    atkSpeed: 500,    
    lastAtkTime: 0    
};

const inventory = {
    open: false,             
    currentTab: "weapon",    
    cols: 4,                 
    rows: 7, 
    
    scrollY: 0,
    maxScrollY: 0,
    isDragging: false,
    lastTouchY: 0,
    dragPointerId: null,
    
    weaponSlots: new Array(28).fill(null),
    armorSlots: new Array(28).fill(null)
};

const moveJoy = { active: false, originX: 0, originY: 0, stickX: 0, stickY: 0, maxDist: 39, opacity: 0 };
// === [修改] atkJoy opacity 預設為 0.3 (讓基座常駐微亮)，移除 stickX/Y，加入 angle ===
const atkJoy  = { active: false, originX: 0, originY: 0, opacity: 0.3, angle: 0, isDragging: false };

let dx = 0;
let dy = 0;
const eyeMaxOffset = 5;
let handAngle = Math.PI / 4; 

let movePointerId = null;
let atkPointerId = null;

const attacks = [];

// 初始化畫布尺寸 (同時會設定 atkJoy 的位置)
resizeCanvas();


/* =========================
   輸入監聽
========================= */
canvas.addEventListener("wheel", e => {
    if (!inventory.open) return;
    const btnSize = 48;
    const panelW = Math.min(280, cw - 32); 
    const panelX = cw - panelW - 16; 
    const panelY = btnSize + 32; 
    const panelH = ch - panelY - 16;

    if (e.clientX >= panelX && e.clientX <= panelX + panelW &&
        e.clientY >= panelY && e.clientY <= panelY + panelH) {
        inventory.scrollY += e.deltaY;
        inventory.scrollY = Math.max(0, Math.min(inventory.maxScrollY, inventory.scrollY));
    }
});

canvas.addEventListener("pointerdown", e => {
    canvas.setPointerCapture(e.pointerId);

    const btnSize = 48;
    const btnX = cw - btnSize - 16;
    const btnY = 16;

    // 1. 右上角背包按鈕
    if (e.clientX >= btnX && e.clientX <= btnX + btnSize &&
        e.clientY >= btnY && e.clientY <= btnY + btnSize) {
        inventory.open = !inventory.open; 
        return;
    }

    // 2. 背包內部點擊與滑動
    if (inventory.open) {
        const panelW = Math.min(280, cw - 32); 
        const panelX = cw - panelW - 16; 
        const panelY = btnY + btnSize + 16; 
        const panelH = ch - panelY - 16; 

        if (e.clientX >= panelX + panelW - 40 && e.clientX <= panelX + panelW &&
            e.clientY >= panelY && e.clientY <= panelY + 40) {
            inventory.open = false;
            return;
        }

        const tabW = (panelW - 32 - 8) / 2; 
        if (e.clientY >= panelY + 42 && e.clientY <= panelY + 68) {
            if (e.clientX >= panelX + 16 && e.clientX <= panelX + 16 + tabW) {
                inventory.currentTab = "weapon";
                inventory.scrollY = 0; 
                return;
            } else if (e.clientX >= panelX + 16 + tabW + 8 && e.clientX <= panelX + panelW - 16) {
                inventory.currentTab = "armor";
                inventory.scrollY = 0; 
                return;
            }
        }

        const gridAreaY = panelY + 84;
        if (e.clientX >= panelX && e.clientX <= panelX + panelW &&
            e.clientY >= gridAreaY && e.clientY <= panelY + panelH) {
            inventory.isDragging = true;
            inventory.lastTouchY = e.clientY;
            inventory.dragPointerId = e.pointerId;
            return;
        }

        if (e.clientX >= panelX && e.clientX <= panelX + panelW &&
            e.clientY >= panelY && e.clientY <= panelY + panelH) {
            return;
        }
    }

    // === [修改處] 3. 攻擊搖桿控制 (固定基座，僅範圍內觸發) ===
    // 計算點擊位置與攻擊搖桿基座中心的距離
    const distToAtkCenter = Math.hypot(e.clientX - atkJoy.originX, e.clientY - atkJoy.originY);
    
    // 如果點擊落在攻擊搖桿基座範圍內 (JOYSTICK_RADIUS)
    if (distToAtkCenter <= JOYSTICK_RADIUS) {
        if (atkPointerId === null) {
            atkPointerId = e.pointerId;
            atkJoy.active = true;
            // 直接根據點擊相對於中心的偏移計算瞄準角度
            updateAtkAim(e.clientX, e.clientY); 
        }
    }
    // 4. 移動搖桿控制 (如果在左半邊且不是點在攻擊搖桿上)
    else if (e.clientX < cw / 2 && e.clientY > ch / 2) {
        if (movePointerId === null) {
            movePointerId = e.pointerId;
            moveJoy.active = true;
            moveJoy.originX = e.clientX; moveJoy.originY = e.clientY;
            moveJoy.stickX = e.clientX; moveJoy.stickY = e.clientY;
            updateMoveJoy(e.clientX, e.clientY);
        }
    }
});

canvas.addEventListener("pointermove", e => {
    if (inventory.open && inventory.isDragging && e.pointerId === inventory.dragPointerId) {
        const deltaY = inventory.lastTouchY - e.clientY;
        inventory.scrollY += deltaY;
        inventory.scrollY = Math.max(0, Math.min(inventory.maxScrollY, inventory.scrollY));
        inventory.lastTouchY = e.clientY;
        return;
    }

    if (e.pointerId === movePointerId && moveJoy.active) {
        updateMoveJoy(e.clientX, e.clientY);
    } else if (e.pointerId === atkPointerId && atkJoy.active) {
        // === [修改處] 拖曳時更新瞄準角度 ===
        updateAtkAim(e.clientX, e.clientY);
    }
});

function handlePointerUp(e) {
    if (inventory.isDragging && e.pointerId === inventory.dragPointerId) {
        inventory.isDragging = false;
        inventory.dragPointerId = null;
    }

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

// === [新增] 更新攻擊瞄準角度的函式 ===
function updateAtkAim(cx, cy) {
    let vx = cx - atkJoy.originX;
    let vy = cy - atkJoy.originY;
    const dist = Math.hypot(vx, vy);

    if (dist > 5) {
        atkJoy.isDragging = true;
        atkJoy.angle = Math.atan2(vy, vx);
    } else {
        // 如果按得很靠近中心，就不特別轉頭
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
    const actualMoveSpeed = (player.spd / 650) * 4.5;
    player.x += dx * actualMoveSpeed;
    player.y += dy * actualMoveSpeed;

    player.x = Math.max(player.radiusX, Math.min(cw - player.radiusX, player.x));
    player.y = Math.max(player.radiusY, Math.min(ch - player.radiusY, player.y));

    // 移動搖桿淡入淡出
    moveJoy.opacity = moveJoy.active ? Math.min(1, moveJoy.opacity + 0.15) : Math.max(0, moveJoy.opacity - 0.15);
    // === [修改處] 攻擊搖桿基座常駐微亮 (0.3)，按下時變全亮 (0.8) ===
    atkJoy.opacity = atkJoy.active ? Math.min(0.8, atkJoy.opacity + 0.15) : Math.max(0.3, atkJoy.opacity - 0.15);

    if (player.displayHp > player.hp) {
        player.displayHp -= (player.displayHp - player.hp) * 0.08; 
        if (player.displayHp - player.hp < 0.5) player.displayHp = player.hp; 
    } else {
        player.displayHp = player.hp; 
    }
    if (player.energy < player.maxEnergy) {
        player.energy = Math.min(player.maxEnergy, player.energy + 0.3);
    }

    if (atkJoy.active && !inventory.open) {
        let now = Date.now();
        if (now - player.lastAtkTime >= player.atkSpeed) {
            player.lastAtkTime = now;
            let spawnAngle = atkJoy.isDragging ? atkJoy.angle : handAngle;
            spawnFist(spawnAngle);
        }
    }

    for (let i = attacks.length - 1; i >= 0; i--) {
        let atk = attacks[i];
        atk.progress += 0.08;
        if (atk.progress >= 1) {
            attacks.splice(i, 1);
        }
    }
}

function spawnFist(angle) {
    attacks.push({ x: player.x, y: player.y, angle: angle, progress: 0 });
}

function draw() {
    ctx.fillStyle = "#263746";
    ctx.fillRect(0, 0, cw, ch);

    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < cw; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, ch); }
    for (let y = 0; y < ch; y += 40) { ctx.moveTo(0, y); ctx.lineTo(cw, y); }
    ctx.stroke();

    drawPlayer();
    drawPlayerUI();

    if (!inventory.open) {
        if (moveJoy.opacity > 0) drawJoystick(moveJoy, "#ffffff", true);
        
        // === [修改處] 畫出固定在右下角的攻擊基座 (隱藏中心 Knob) ===
        if (atkJoy.opacity > 0) drawJoystick(atkJoy, "#e74c3c", false); 
    }

    drawInventoryUI();
}

/* =========================
   繪製函式細節
========================= */
function drawPlayerUI() {
    const levelRadius = 11, hpBarWidth = 54, energyBarWidth = 38, hpHeight = 7, energyHeight = 3, barSpacing = 2, gap = 5;          
    const totalWidth = (levelRadius * 2) + gap + hpBarWidth;
    const startX = player.x - (totalWidth / 2);
    const cx = startX + levelRadius;
    const cy = player.y - player.radiusY - 32; 

    const barStartX = cx + levelRadius + gap;
    const barStartY = cy - (hpHeight + energyHeight + barSpacing) / 2;
    const hpRadius = 3.5, energyRadius = 1.5; 

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; ctx.beginPath(); ctx.roundRect(barStartX, barStartY, hpBarWidth, hpHeight, hpRadius); ctx.fill();
    let displayHpWidth = Math.max(0, hpBarWidth * (player.displayHp / player.maxHp));
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.roundRect(barStartX, barStartY, displayHpWidth, hpHeight, hpRadius); ctx.fill();
    let hpWidth = Math.max(0, hpBarWidth * (player.hp / player.maxHp));
    ctx.fillStyle = "#2ecc71"; ctx.beginPath(); ctx.roundRect(barStartX, barStartY, hpWidth, hpHeight, hpRadius); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.8)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(barStartX, barStartY, hpBarWidth, hpHeight, hpRadius); ctx.stroke();

    const energyStartY = barStartY + hpHeight + barSpacing;
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; ctx.beginPath(); ctx.roundRect(barStartX, energyStartY, energyBarWidth, energyHeight, energyRadius); ctx.fill();
    let energyWidth = Math.max(0, energyBarWidth * (player.energy / player.maxEnergy));
    ctx.fillStyle = "#f39c12"; ctx.beginPath(); ctx.roundRect(barStartX, energyStartY, energyWidth, energyHeight, energyRadius); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.8)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(barStartX, energyStartY, energyBarWidth, energyHeight, energyRadius); ctx.stroke();

    ctx.fillStyle = "#2c3e50"; ctx.beginPath(); ctx.arc(cx, cy, levelRadius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#f1c40f"; ctx.lineWidth = 2.5; ctx.stroke();
    
    ctx.fillStyle = "#ffffff"; 
    ctx.font = "bold 13px system-ui, sans-serif"; 
    ctx.textAlign = "center"; 
    ctx.textBaseline = "middle";
    ctx.fillText(player.level, cx, cy); 
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

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(px, py + 12, player.radiusX, player.radiusY - 8, 0, 0, Math.PI * 2);
    ctx.fill();

    if (sprites.body.complete && sprites.body.naturalWidth !== 0) {
        ctx.drawImage(sprites.body, px - 35, py - 28, 70, 56);
    }

    if (sprites.eyes.complete && sprites.eyes.naturalWidth !== 0) {
        ctx.drawImage(sprites.eyes, px - 19 + eyeOffsetX, py - 12 + eyeOffsetY, 38, 12);
    }

    attacks.forEach(atk => {
        const reach = Math.sin(atk.progress * Math.PI) * 55; 
        const fx = atk.x + Math.cos(atk.angle) * (player.radiusX + reach);
        const fy = atk.y + Math.sin(atk.angle) * (player.radiusY + reach);
        if (sprites.hand.complete && sprites.hand.naturalWidth !== 0) {
            ctx.drawImage(sprites.hand, fx - 15, fy - 15, 30, 30);
        }
    });

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

function drawInventoryUI() {
    const btnSize = 48;
    const btnX = cw - btnSize - 16;
    const btnY = 16;

    ctx.fillStyle = inventory.open ? "#e74c3c" : "rgba(30, 41, 59, 0.85)";
    ctx.beginPath(); ctx.roundRect(btnX, btnY, btnSize, btnSize, 12); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(btnX, btnY, btnSize, btnSize, 12); ctx.stroke();
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "24px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🎒", btnX + btnSize / 2, btnY + btnSize / 2);

    if (!inventory.open) return;

    const panelW = Math.min(280, cw - 32);
    const panelX = cw - panelW - 16; 
    const panelY = btnY + btnSize + 16; 
    const panelH = ch - panelY - 16; 

    ctx.fillStyle = "rgba(30, 41, 59, 0.95)";
    ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 16); ctx.fill();
    ctx.strokeStyle = "#475569"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 16); ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("🎒 玩家背包", panelX + 18, panelY + 24);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✖", panelX + panelW - 22, panelY + 24);

    const isWeapon = inventory.currentTab === "weapon";
    const tabW = (panelW - 32 - 8) / 2; 

    ctx.fillStyle = isWeapon ? "#3b82f6" : "#334155";
    ctx.beginPath(); ctx.roundRect(panelX + 16, panelY + 42, tabW, 26, 6); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⚔️ 武器", panelX + 16 + (tabW / 2), panelY + 55);

    ctx.fillStyle = !isWeapon ? "#3b82f6" : "#334155";
    ctx.beginPath(); ctx.roundRect(panelX + 16 + tabW + 8, panelY + 42, tabW, 26, 6); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🛡️ 防具", panelX + 16 + tabW + 8 + (tabW / 2), panelY + 55);

    const slotGap = 6;
    const gridPaddingX = 16;
    const topOffset = 84; 
    const gridAreaH = panelH - topOffset - 16; 

    const availableW = panelW - (gridPaddingX * 2);
    const slotSize = Math.floor((availableW - (inventory.cols - 1) * slotGap) / inventory.cols);

    const gridTotalW = inventory.cols * slotSize + (inventory.cols - 1) * slotGap;
    const gridStartX = panelX + (panelW - gridTotalW) / 2; 

    const currentSlots = isWeapon ? inventory.weaponSlots : inventory.armorSlots;
    const totalRows = Math.ceil(currentSlots.length / inventory.cols);
    const gridTotalH = totalRows * slotSize + (totalRows - 1) * slotGap;

    inventory.maxScrollY = Math.max(0, gridTotalH - gridAreaH);
    inventory.scrollY = Math.max(0, Math.min(inventory.maxScrollY, inventory.scrollY));

    ctx.save();
    ctx.beginPath();
    ctx.rect(panelX, panelY + topOffset, panelW, gridAreaH);
    ctx.clip();

    const gridStartY = panelY + topOffset - inventory.scrollY;

    for (let i = 0; i < currentSlots.length; i++) {
        const r = Math.floor(i / inventory.cols);
        const c = i % inventory.cols;
        const sx = gridStartX + c * (slotSize + slotGap);
        const sy = gridStartY + r * (slotSize + slotGap);

        if (sy + slotSize < panelY + topOffset || sy > panelY + panelH) continue;

        ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
        ctx.beginPath(); ctx.roundRect(sx, sy, slotSize, slotSize, 6); ctx.fill();
        ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(sx, sy, slotSize, slotSize, 6); ctx.stroke();

        const item = currentSlots[i];
        if (item) {
            const fontSize = Math.max(14, Math.floor(slotSize * 0.5));
            ctx.fillStyle = "#ffffff";
            ctx.font = fontSize + "px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(item.icon, sx + slotSize / 2, sy + slotSize / 2); 
        }
    }
    
    ctx.restore();

    if (inventory.maxScrollY > 0) {
        const sbW = 4;
        const sbX = panelX + panelW - 8;
        const sbY = panelY + topOffset;
        const thumbH = Math.max(20, (gridAreaH / gridTotalH) * gridAreaH);
        const thumbY = sbY + (inventory.scrollY / inventory.maxScrollY) * (gridAreaH - thumbH);

        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.beginPath(); ctx.roundRect(sbX, sbY, sbW, gridAreaH, 2); ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath(); ctx.roundRect(sbX, thumbY, sbW, thumbH, 2); ctx.fill();
    }
}

// === [修改處] 增加 showKnob 參數，用來決定是否要畫中心的小圓點 ===
function drawJoystick(joy, coreColor, showKnob) {
    ctx.globalAlpha = joy.opacity;

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(joy.originX, joy.originY, JOYSTICK_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 只有在 showKnob 為 true 時才畫出中心圓 (移動搖桿使用)
    if (showKnob) {
        ctx.fillStyle = coreColor === "#ffffff" ? "rgba(255,255,255,0.72)" : "rgba(231, 76, 60, 0.72)";
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(joy.stickX, joy.stickY, 36, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    } else {
        // 攻擊搖桿：在基座中央畫個小小的準心圖案提示玩家這裡是攻擊區
        ctx.fillStyle = "rgba(231, 76, 60, 0.5)";
        ctx.beginPath();
        ctx.arc(joy.originX, joy.originY, 20, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        // 畫一個簡單的十字準心
        ctx.moveTo(joy.originX - 10, joy.originY);
        ctx.lineTo(joy.originX + 10, joy.originY);
        ctx.moveTo(joy.originX, joy.originY - 10);
        ctx.lineTo(joy.originX, joy.originY + 10);
        ctx.stroke();
    }

    ctx.globalAlpha = 1.0;
}

gameLoop();
