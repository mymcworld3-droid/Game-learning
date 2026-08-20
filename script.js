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
    cols: 7,                 
    rows: 4,                 
    
    weaponSlots: [
        { name: "新手木劍", icon: "🗡️", atk: 10 },
        { name: "鐵製長劍", icon: "⚔️", atk: 25 },
        null, null, null, null, null,
        null, null, null, null, null, null, null,
        null, null, null, null, null, null, null,
        null, null, null, null, null, null, null
    ],
    
    armorSlots: [
        { name: "布製皮甲", icon: "👕", def: 5 },
        { name: "騎士盾牌", icon: "🛡️", def: 15 },
        null, null, null, null, null,
        null, null, null, null, null, null, null,
        null, null, null, null, null, null, null,
        null, null, null, null, null, null, null
    ]
};

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

    // 1. 檢查右上角背包按鈕
    const btnSize = 48;
    const btnX = cw - btnSize - 16;
    const btnY = 16;

    if (e.clientX >= btnX && e.clientX <= btnX + btnSize &&
        e.clientY >= btnY && e.clientY <= btnY + btnSize) {
        inventory.open = !inventory.open; 
        return;
    }

    // 2. 處理背包內部點擊 (如果背包開啟)
    if (inventory.open) {
        // === [修改處] 背包面板固定在右側 ===
        const panelW = 340;
        const panelH = 260;
        // 面板 X 座標：靠右側，留 16px 邊距
        const panelX = cw - panelW - 16; 
        // 面板 Y 座標：在背包按鈕下方
        const panelY = btnY + btnSize + 16; 

        if (e.clientX >= panelX + panelW - 35 && e.clientX <= panelX + panelW - 10 &&
            e.clientY >= panelY + 10 && e.clientY <= panelY + 35) {
            inventory.open = false;
            return;
        }

        if (e.clientX >= panelX + 16 && e.clientX <= panelX + 96 &&
            e.clientY >= panelY + 40 && e.clientY <= panelY + 68) {
            inventory.currentTab = "weapon";
            return;
        }

        if (e.clientX >= panelX + 104 && e.clientX <= panelX + 184 &&
            e.clientY >= panelY + 40 && e.clientY <= panelY + 68) {
            inventory.currentTab = "armor";
            return;
        }

        // 如果點在背包面板內，阻擋搖桿觸發
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
    const actualMoveSpeed = (player.spd / 650) * 4.5;
    player.x += dx * actualMoveSpeed;
    player.y += dy * actualMoveSpeed;

    player.x = Math.max(player.radiusX, Math.min(cw - player.radiusX, player.x));
    player.y = Math.max(player.radiusY, Math.min(ch - player.radiusY, player.y));

    moveJoy.opacity = moveJoy.active ? Math.min(1, moveJoy.opacity + 0.15) : Math.max(0, moveJoy.opacity - 0.15);
    atkJoy.opacity = atkJoy.active ? Math.min(1, atkJoy.opacity + 0.15) : Math.max(0, atkJoy.opacity - 0.15);

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
        if (moveJoy.opacity > 0) drawJoystick(moveJoy, "#ffffff");
        if (atkJoy.opacity > 0) drawJoystick(atkJoy, "#e74c3c");
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
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 13px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
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
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnSize, btnSize, 12);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnSize, btnSize, 12);
    ctx.stroke();

    ctx.font = "24px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🎒", btnX + btnSize / 2, btnY + btnSize / 2);

    if (!inventory.open) return;

    // === [修改處] 取消半透明全螢幕遮罩 ===
    // ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    // ctx.fillRect(0, 0, cw, ch);

    // === [修改處] 背包面板定位在螢幕右側 ===
    const panelW = 340;
    const panelH = 260;
    const panelX = cw - panelW - 16; 
    const panelY = btnY + btnSize + 16; 

    // 面板背景稍微增加一點透明度，確保不會完全遮死後方畫面
    ctx.fillStyle = "rgba(30, 41, 59, 0.95)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 16);
    ctx.fill();

    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 16);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("🎒 玩家背包", panelX + 18, panelY + 24);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✖", panelX + panelW - 22, panelY + 22);

    const isWeapon = inventory.currentTab === "weapon";

    ctx.fillStyle = isWeapon ? "#3b82f6" : "#334155";
    ctx.beginPath();
    ctx.roundRect(panelX + 16, panelY + 42, 80, 26, 6);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("⚔️ 武器", panelX + 56, panelY + 55);

    ctx.fillStyle = !isWeapon ? "#3b82f6" : "#334155";
    ctx.beginPath();
    ctx.roundRect(panelX + 104, panelY + 42, 80, 26, 6);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText("🛡️ 防具", panelX + 144, panelY + 55);

    const slotSize = 36;
    const slotGap = 6;
    const gridStartX = panelX + (panelW - (inventory.cols * (slotSize + slotGap) - slotGap)) / 2;
    const gridStartY = panelY + 80;

    const currentSlots = isWeapon ? inventory.weaponSlots : inventory.armorSlots;

    for (let r = 0; r < inventory.rows; r++) {
        for (let c = 0; c < inventory.cols; c++) {
            const index = r * inventory.cols + c;
            const sx = gridStartX + c * (slotSize + slotGap);
            const sy = gridStartY + r * (slotSize + slotGap);

            ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
            ctx.beginPath();
            ctx.roundRect(sx, sy, slotSize, slotSize, 6);
            ctx.fill();

            ctx.strokeStyle = "#334155";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(sx, sy, slotSize, slotSize, 6);
            ctx.stroke();

            const item = currentSlots[index];
            if (item) {
                ctx.font = "20px system-ui, sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(item.icon, sx + slotSize / 2, sy + slotSize / 2);
            }
        }
    }
}

function drawJoystick(joy, coreColor) {
    ctx.globalAlpha = joy.opacity;

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(joy.originX, joy.originY, 75, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = coreColor === "#ffffff" ? "rgba(255,255,255,0.72)" : "rgba(231, 76, 60, 0.72)";
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(joy.stickX, joy.stickY, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 1.0;
}

gameLoop();
