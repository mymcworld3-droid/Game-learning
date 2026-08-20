/* =========================
   畫布與環境設定
========================= */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let cw = window.innerWidth;
let ch = window.innerHeight;

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

    atkJoy.originX = cw - JOYSTICK_RADIUS - 40; 
    atkJoy.originY = ch - JOYSTICK_RADIUS - 40; 
    updateSkillButtonsPosition();
}

window.addEventListener("resize", resizeCanvas);

/* =========================
   載入遊戲圖片素材
========================= */
const sprites = {
    body: new Image(),
    eyes: new Image(),
    hand: new Image(),
    // 新增武器與技能圖示
    weaponMoyan: new Image(),
    skillMoyan: new Image()
};

sprites.body.src = "asset/body.png";
sprites.eyes.src = "asset/eyes.png";
sprites.hand.src = "asset/hand.png";
sprites.weaponMoyan.src = "asset/weapons/魔炎熾魂刀.jpeg";
sprites.skillMoyan.src = "asset/skills/魔炎熾魂刀.jpeg";

/* =========================
   武器與遊戲物件狀態
========================= */
// 武器資料庫
const WEAPON_DB = {
    "moyan": {
        id: "moyan",
        name: "魔炎熾魂刀",
        icon: sprites.weaponMoyan,
        skillIcon: sprites.skillMoyan,
        desc: "普攻：火屬性傷害 (攻擊力*2)，間隔0.75秒。\n被動：擊中目標獲1層魔炎(+4%攻速, +20攻擊)最疊5層，持續5秒。\n技能：瞬移並釋放火海(攻擊*2傷害，燃燒5秒，沉默1秒)",
        baseAtkMult: 2,
        atkInterval: 750, 
        skillCooldown: 8000 // 技能冷卻 8 秒
    }
};

const player = {
    x: cw / 2, y: ch / 2,
    radiusX: 31, radiusY: 24, 
    
    level: 1,
    hp: 1145, maxHp: 1145, displayHp: 1145,  
    baseAtk: 66, atk: 66,       // 分離出基礎與當前攻擊力
    spd: 650, 
    energy: 100, maxEnergy: 100,

    baseAtkSpeed: 500, atkSpeed: 500, 
    lastAtkTime: 0,
    
    // --- 新增：裝備與狀態系統 ---
    equippedWeapons: [null, null, null], // 裝配欄位 1, 2, 3
    activeWeaponSlot: 0,                 // 目前手持的欄位索引 (0~2)
    lastSkillTimes: [0, 0, 0],           // 各欄位技能上次使用時間
    
    // 被動 Buff 狀態
    buffs: {
        moyanStacks: 0,
        moyanTimer: 0
    }
};

const inventory = {
    open: false,             
    currentTab: "weapon",    
    cols: 4,                 
    rows: 7, 
    
    scrollY: 0, maxScrollY: 0,
    isDragging: false, lastTouchY: 0, dragPointerId: null,
    
    weaponSlots: new Array(28).fill(null),
    armorSlots: new Array(28).fill(null),
    
    // --- 新增：物品詳細資訊介面狀態 ---
    selectedSlotIndex: null, // 被點選的物品欄位
    selectedItemType: null   // "weapon" 或 "armor"
};

// 遊戲一開始發放武器
inventory.weaponSlots[0] = WEAPON_DB["moyan"];

const moveJoy = { active: false, originX: 0, originY: 0, stickX: 0, stickY: 0, maxDist: 39, opacity: 0 };
const atkJoy  = { active: false, originX: 0, originY: 0, opacity: 0.3, angle: 0, isDragging: false };

let dx = 0, dy = 0;
const eyeMaxOffset = 5;
let handAngle = Math.PI / 4; 

let movePointerId = null, atkPointerId = null;
const attacks = [];
const effects = []; // 存放技能特效 (如火海)

// 技能按鈕的位置資料
const skillBtns = [
    { x: 0, y: 0, radius: 25 },
    { x: 0, y: 0, radius: 25 },
    { x: 0, y: 0, radius: 25 }
];

function updateSkillButtonsPosition() {
    // 圍繞在攻擊搖桿左上方的弧形排列
    skillBtns[0].x = cw - 210; skillBtns[0].y = ch - 80;
    skillBtns[1].x = cw - 180; skillBtns[1].y = ch - 150;
    skillBtns[2].x = cw - 110; skillBtns[2].y = ch - 200;
}
resizeCanvas();

/* =========================
   輸入監聽與互動
========================= */
canvas.addEventListener("pointerdown", e => {
    canvas.setPointerCapture(e.pointerId);

    const btnSize = 48;
    const btnX = cw - btnSize - 16, btnY = 16;

    // 1. 右上角背包按鈕
    if (e.clientX >= btnX && e.clientX <= btnX + btnSize && e.clientY >= btnY && e.clientY <= btnY + btnSize) {
        inventory.open = !inventory.open;
        inventory.selectedSlotIndex = null; // 關閉/開啟時重置詳情
        return;
    }

    if (inventory.open) {
        const panelW = Math.min(280, cw - 32); 
        const panelX = cw - panelW - 16; 
        const panelY = btnY + btnSize + 16; 
        const panelH = ch - panelY - 16; 

        // 關閉背包按鈕 (X)
        if (e.clientX >= panelX + panelW - 40 && e.clientX <= panelX + panelW && e.clientY >= panelY && e.clientY <= panelY + 40) {
            inventory.open = false;
            return;
        }

        // 處理詳情介面 (Detail Popup) 的按鈕點擊
        if (inventory.selectedSlotIndex !== null) {
            const detailX = panelX + 16, detailY = panelY + 60, detailW = panelW - 32, detailH = 200;
            // 點擊返回 (關閉詳情)
            if (e.clientX >= detailX + detailW - 30 && e.clientX <= detailX + detailW && e.clientY >= detailY && e.clientY <= detailY + 30) {
                inventory.selectedSlotIndex = null;
                return;
            }
            // 點擊裝配 1, 2, 3
            if (e.clientY >= detailY + detailH - 45 && e.clientY <= detailY + detailH - 15) {
                const btnW = (detailW - 32) / 3;
                for (let i=0; i<3; i++) {
                    let bx = detailX + 10 + i*(btnW + 6);
                    if (e.clientX >= bx && e.clientX <= bx + btnW) {
                        // 裝備該武器到指定欄位
                        let item = inventory.currentTab === "weapon" ? inventory.weaponSlots[inventory.selectedSlotIndex] : null;
                        if(item && inventory.currentTab === "weapon") {
                            player.equippedWeapons[i] = item;
                            player.lastSkillTimes[i] = 0; // 重置該槽冷卻
                        }
                        inventory.selectedSlotIndex = null; // 裝備後關閉詳情
                        return;
                    }
                }
            }
            return; // 若點在詳情內其他地方，阻擋往下觸發
        }

        // 頁籤切換
        const tabW = (panelW - 32 - 8) / 2; 
        if (e.clientY >= panelY + 42 && e.clientY <= panelY + 68) {
            if (e.clientX >= panelX + 16 && e.clientX <= panelX + 16 + tabW) {
                inventory.currentTab = "weapon"; inventory.scrollY = 0; return;
            } else if (e.clientX >= panelX + 16 + tabW + 8 && e.clientX <= panelX + panelW - 16) {
                inventory.currentTab = "armor"; inventory.scrollY = 0; return;
            }
        }

        // 點擊網格物品 (開啟詳情)
        const topOffset = 84;
        const gridAreaY = panelY + topOffset;
        if (e.clientX >= panelX && e.clientX <= panelX + panelW && e.clientY >= gridAreaY && e.clientY <= panelY + panelH) {
            
            // 計算點中了哪個格子
            const availableW = panelW - 32;
            const slotGap = 6;
            const slotSize = Math.floor((availableW - (inventory.cols - 1) * slotGap) / inventory.cols);
            const gridStartX = panelX + (panelW - (inventory.cols * slotSize + (inventory.cols - 1) * slotGap)) / 2;
            
            let clickedCol = Math.floor((e.clientX - gridStartX) / (slotSize + slotGap));
            let clickedRow = Math.floor((e.clientY - gridAreaY + inventory.scrollY) / (slotSize + slotGap));

            if (clickedCol >= 0 && clickedCol < inventory.cols) {
                let index = clickedRow * inventory.cols + clickedCol;
                let currentSlots = inventory.currentTab === "weapon" ? inventory.weaponSlots : inventory.armorSlots;
                if (index >= 0 && index < currentSlots.length && currentSlots[index]) {
                    inventory.selectedSlotIndex = index;
                    return; // 開啟詳情後跳出
                }
            }

            // 若點到空白處，視為拖曳起始
            inventory.isDragging = true;
            inventory.lastTouchY = e.clientY;
            inventory.dragPointerId = e.pointerId;
            return;
        }
    }

    if (!inventory.open) {
        // 檢查技能按鈕點擊
        for (let i = 0; i < 3; i++) {
            let btn = skillBtns[i];
            let dist = Math.hypot(e.clientX - btn.x, e.clientY - btn.y);
            if (dist <= btn.radius) {
                activateSkill(i);
                return;
            }
        }
    }

    // 攻擊搖桿控制
    const distToAtkCenter = Math.hypot(e.clientX - atkJoy.originX, e.clientY - atkJoy.originY);
    if (distToAtkCenter <= JOYSTICK_RADIUS) {
        if (atkPointerId === null) {
            atkPointerId = e.pointerId;
            atkJoy.active = true;
            updateAtkAim(e.clientX, e.clientY); 
        }
    }
    // 移動搖桿控制
    else if (e.clientX < cw / 2 && e.clientY > ch / 2) {
        if (movePointerId === null) {
            movePointerId = e.pointerId;
            moveJoy.active = true;
            moveJoy.originX = e.clientX; moveJoy.originY = e.clientY;
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
        updateAtkAim(e.clientX, e.clientY);
    }
});

function handlePointerUp(e) {
    if (inventory.isDragging && e.pointerId === inventory.dragPointerId) {
        inventory.isDragging = false; inventory.dragPointerId = null;
    }
    if (e.pointerId === movePointerId) {
        moveJoy.active = false; movePointerId = null; dx = 0; dy = 0;
    } else if (e.pointerId === atkPointerId) {
        atkJoy.active = false; atkPointerId = null; atkJoy.isDragging = false;
    }
}
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", handlePointerUp);

function updateMoveJoy(cx, cy) {
    let vx = cx - moveJoy.originX, vy = cy - moveJoy.originY;
    const dist = Math.hypot(vx, vy);
    if (dist > moveJoy.maxDist) { vx = (vx / dist) * moveJoy.maxDist; vy = (vy / dist) * moveJoy.maxDist; }
    moveJoy.stickX = moveJoy.originX + vx; moveJoy.stickY = moveJoy.originY + vy;
    dx = vx / moveJoy.maxDist; dy = vy / moveJoy.maxDist;
}

function updateAtkAim(cx, cy) {
    let vx = cx - atkJoy.originX, vy = cy - atkJoy.originY;
    const dist = Math.hypot(vx, vy);
    if (dist > 5) { atkJoy.isDragging = true; atkJoy.angle = Math.atan2(vy, vx); } 
    else { atkJoy.isDragging = false; }
}

// --- 技能發動邏輯 ---
function activateSkill(slotIndex) {
    let weapon = player.equippedWeapons[slotIndex];
    if (!weapon) return;
    
    // 切換當前武器普攻型態
    player.activeWeaponSlot = slotIndex;
    
    // 檢查技能冷卻
    let now = Date.now();
    if (now - player.lastSkillTimes[slotIndex] >= weapon.skillCooldown) {
        // 發動技能！
        player.lastSkillTimes[slotIndex] = now;
        
        if (weapon.id === "moyan") {
            // 魔炎刀技能：瞬移並放火海
            // 往當前朝向瞬移 150 px
            player.x += Math.cos(handAngle) * 150;
            player.y += Math.sin(handAngle) * 150;
            // 邊界限制
            player.x = Math.max(player.radiusX, Math.min(cw - player.radiusX, player.x));
            player.y = Math.max(player.radiusY, Math.min(ch - player.radiusY, player.y));
            
            // 在新地點產生火海 (持續 5 秒)
            effects.push({
                type: "fireSea",
                x: player.x,
                y: player.y,
                radius: 0, // 會有個擴展動畫
                maxRadius: 120,
                duration: 5000,
                startTime: now,
                // 未來可於此記錄傷害倍率與沉默標記給敵人物件讀取
                damageMult: 2 
            });
        }
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
    // --- 狀態更新 (Buffs 與武器屬性) ---
    let currentWeapon = player.equippedWeapons[player.activeWeaponSlot];
    
    // 處理魔炎 Buff 倒數
    if (player.buffs.moyanStacks > 0) {
        player.buffs.moyanTimer -= 16.6; // 大約 60fps
        if (player.buffs.moyanTimer <= 0) {
            player.buffs.moyanStacks = 0; // 時間到，層數歸零
        }
    }

    // 計算當前面板屬性
    let dynamicAtk = player.baseAtk;
    let dynamicAtkSpeed = player.baseAtkSpeed;
    
    if (currentWeapon && currentWeapon.id === "moyan") {
        dynamicAtkSpeed = currentWeapon.atkInterval;
    }
    
    // 疊加被動效果 (每層 +20攻, -4% 攻擊間隔(即+攻速))
    dynamicAtk += 20 * player.buffs.moyanStacks;
    dynamicAtkSpeed = dynamicAtkSpeed * (1 - 0.04 * player.buffs.moyanStacks);
    
    player.atk = dynamicAtk;
    player.atkSpeed = dynamicAtkSpeed;


    // --- 移動與攻擊判定 ---
    const actualMoveSpeed = (player.spd / 650) * 4.5;
    player.x += dx * actualMoveSpeed;
    player.y += dy * actualMoveSpeed;
    player.x = Math.max(player.radiusX, Math.min(cw - player.radiusX, player.x));
    player.y = Math.max(player.radiusY, Math.min(ch - player.radiusY, player.y));

    moveJoy.opacity = moveJoy.active ? Math.min(1, moveJoy.opacity + 0.15) : Math.max(0, moveJoy.opacity - 0.15);
    atkJoy.opacity = atkJoy.active ? Math.min(0.8, atkJoy.opacity + 0.15) : Math.max(0.3, atkJoy.opacity - 0.15);

    if (player.displayHp > player.hp) {
        player.displayHp -= (player.displayHp - player.hp) * 0.08; 
        if (player.displayHp - player.hp < 0.5) player.displayHp = player.hp; 
    } else { player.displayHp = player.hp; }
    if (player.energy < player.maxEnergy) { player.energy = Math.min(player.maxEnergy, player.energy + 0.3); }

    // 觸發普攻
    if (atkJoy.active && !inventory.open) {
        let now = Date.now();
        if (now - player.lastAtkTime >= player.atkSpeed) {
            player.lastAtkTime = now;
            let spawnAngle = atkJoy.isDragging ? atkJoy.angle : handAngle;
            spawnFist(spawnAngle);
            
            // 如果拿的是魔炎刀，給予魔炎被動疊加 (實戰中應放在拳頭打到敵人時判定，目前雛形先放這裡)
            if (currentWeapon && currentWeapon.id === "moyan") {
                player.buffs.moyanStacks = Math.min(5, player.buffs.moyanStacks + 1);
                player.buffs.moyanTimer = 5000; // 刷新持續時間 5 秒
            }
        }
    }

    // 特效/攻擊物件進度更新
    for (let i = attacks.length - 1; i >= 0; i--) {
        let atk = attacks[i];
        atk.progress += 0.08;
        if (atk.progress >= 1) attacks.splice(i, 1);
    }
    
    let now = Date.now();
    for (let i = effects.length - 1; i >= 0; i--) {
        let eff = effects[i];
        if (eff.type === "fireSea") {
            let elapsed = now - eff.startTime;
            eff.radius = Math.min(eff.maxRadius, eff.radius + 8); // 火海擴散動畫
            if (elapsed >= eff.duration) {
                effects.splice(i, 1);
            }
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

    // 繪製地上的特效 (火海)
    drawEffects();

    drawPlayer();
    drawPlayerUI();

    if (!inventory.open) {
        if (moveJoy.opacity > 0) drawJoystick(moveJoy, "#ffffff", true);
        if (atkJoy.opacity > 0) drawJoystick(atkJoy, "#e74c3c", false); 
        drawSkillButtons();
    }

    drawInventoryUI();
}

/* =========================
   繪製函式細節
========================= */
function drawEffects() {
    let now = Date.now();
    effects.forEach(eff => {
        if (eff.type === "fireSea") {
            let timeLeft = (eff.duration - (now - eff.startTime)) / eff.duration;
            ctx.fillStyle = `rgba(231, 76, 60, ${0.4 * timeLeft})`;
            ctx.beginPath();
            ctx.arc(eff.x, eff.y, eff.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // 內圈燃燒效果
            ctx.fillStyle = `rgba(241, 196, 15, ${0.3 * timeLeft})`;
            ctx.beginPath();
            ctx.arc(eff.x, eff.y, eff.radius * 0.7, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

function drawSkillButtons() {
    let now = Date.now();
    for (let i = 0; i < 3; i++) {
        let btn = skillBtns[i];
        let weapon = player.equippedWeapons[i];
        let isActive = (i === player.activeWeaponSlot);
        
        // 按鈕底座
        ctx.fillStyle = isActive ? "rgba(241, 196, 15, 0.4)" : "rgba(0, 0, 0, 0.4)";
        ctx.strokeStyle = isActive ? "#f1c40f" : "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(btn.x, btn.y, btn.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        if (weapon) {
            // 如果武器圖片讀取完成，畫技能圖
            if (weapon.skillIcon && weapon.skillIcon.complete && weapon.skillIcon.naturalWidth !== 0) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(btn.x, btn.y, btn.radius - 2, 0, Math.PI*2);
                ctx.clip();
                ctx.drawImage(weapon.skillIcon, btn.x - btn.radius, btn.y - btn.radius, btn.radius*2, btn.radius*2);
                ctx.restore();
            } else {
                ctx.fillStyle = "#fff";
                ctx.font = "12px system-ui";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("技", btn.x, btn.y);
            }
            
            // 繪製冷卻遮罩 (CD)
            let elapsed = now - player.lastSkillTimes[i];
            if (elapsed < weapon.skillCooldown) {
                let ratio = 1 - (elapsed / weapon.skillCooldown);
                ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
                ctx.beginPath();
                ctx.moveTo(btn.x, btn.y);
                ctx.arc(btn.x, btn.y, btn.radius, -Math.PI/2, -Math.PI/2 + Math.PI*2 * ratio, false);
                ctx.fill();
            }
        }
    }
}

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
    ctx.fillText(player.level, cx, cy); 
    
    // 魔炎 Buff 層數文字特效提示 (在血條上方)
    if (player.buffs.moyanStacks > 0) {
        ctx.fillStyle = "#e74c3c";
        ctx.font = "bold 12px system-ui";
        ctx.fillText(`🔥 魔炎 x${player.buffs.moyanStacks}`, player.x, cy - 20);
    }
}

function drawPlayer() {
    const px = player.x, py = player.y;
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

    if (sprites.body.complete && sprites.body.naturalWidth !== 0) { ctx.drawImage(sprites.body, px - 35, py - 28, 70, 56); }
    if (sprites.eyes.complete && sprites.eyes.naturalWidth !== 0) { ctx.drawImage(sprites.eyes, px - 19 + eyeOffsetX, py - 12 + eyeOffsetY, 38, 12); }

    attacks.forEach(atk => {
        const reach = Math.sin(atk.progress * Math.PI) * 55; 
        const fx = atk.x + Math.cos(atk.angle) * (player.radiusX + reach);
        const fy = atk.y + Math.sin(atk.angle) * (player.radiusY + reach);
        if (sprites.hand.complete && sprites.hand.naturalWidth !== 0) { ctx.drawImage(sprites.hand, fx - 15, fy - 15, 30, 30); }
    });

    if (attacks.length === 0) {
        const orbitRx = player.radiusX + 16, orbitRy = player.radiusY + 16; 
        const handX = px + Math.cos(handAngle) * orbitRx, handY = py + Math.sin(handAngle) * orbitRy;
        if (sprites.hand.complete && sprites.hand.naturalWidth !== 0) { ctx.drawImage(sprites.hand, handX - 10, handY - 10, 20, 20); }
    }
}

function drawInventoryUI() {
    const btnSize = 48, btnX = cw - btnSize - 16, btnY = 16;

    ctx.fillStyle = inventory.open ? "#e74c3c" : "rgba(30, 41, 59, 0.85)";
    ctx.beginPath(); ctx.roundRect(btnX, btnY, btnSize, btnSize, 12); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(btnX, btnY, btnSize, btnSize, 12); ctx.stroke();
    
    ctx.fillStyle = "#ffffff"; ctx.font = "24px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("🎒", btnX + btnSize / 2, btnY + btnSize / 2);

    if (!inventory.open) return;

    const panelW = Math.min(280, cw - 32), panelX = cw - panelW - 16, panelY = btnY + btnSize + 16, panelH = ch - panelY - 16; 

    // 繪製背景面板
    ctx.fillStyle = "rgba(30, 41, 59, 0.95)"; ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 16); ctx.fill();
    ctx.strokeStyle = "#475569"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 16); ctx.stroke();

    ctx.fillStyle = "#ffffff"; ctx.font = "bold 16px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.fillText("🎒 玩家背包", panelX + 18, panelY + 24);
    ctx.fillStyle = "#94a3b8"; ctx.font = "bold 16px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText("✖", panelX + panelW - 22, panelY + 24);

    const isWeapon = inventory.currentTab === "weapon";
    const tabW = (panelW - 32 - 8) / 2; 

    ctx.fillStyle = isWeapon ? "#3b82f6" : "#334155"; ctx.beginPath(); ctx.roundRect(panelX + 16, panelY + 42, tabW, 26, 6); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.font = "13px system-ui, sans-serif"; ctx.fillText("⚔️ 武器", panelX + 16 + (tabW / 2), panelY + 55);

    ctx.fillStyle = !isWeapon ? "#3b82f6" : "#334155"; ctx.beginPath(); ctx.roundRect(panelX + 16 + tabW + 8, panelY + 42, tabW, 26, 6); ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.fillText("🛡️ 防具", panelX + 16 + tabW + 8 + (tabW / 2), panelY + 55);

    const slotGap = 6, gridPaddingX = 16, topOffset = 84, gridAreaH = panelH - topOffset - 16; 
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
    ctx.beginPath(); ctx.rect(panelX, panelY + topOffset, panelW, gridAreaH); ctx.clip();

    const gridStartY = panelY + topOffset - inventory.scrollY;

    for (let i = 0; i < currentSlots.length; i++) {
        const r = Math.floor(i / inventory.cols), c = i % inventory.cols;
        const sx = gridStartX + c * (slotSize + slotGap), sy = gridStartY + r * (slotSize + slotGap);

        if (sy + slotSize < panelY + topOffset || sy > panelY + panelH) continue;

        ctx.fillStyle = "rgba(15, 23, 42, 0.8)"; ctx.beginPath(); ctx.roundRect(sx, sy, slotSize, slotSize, 6); ctx.fill();
        ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(sx, sy, slotSize, slotSize, 6); ctx.stroke();

        const item = currentSlots[i];
        if (item) {
            if (item.icon && item.icon.complete) {
                ctx.drawImage(item.icon, sx + 2, sy + 2, slotSize - 4, slotSize - 4);
            } else {
                ctx.fillStyle = "#ffffff"; ctx.font = "14px system-ui"; ctx.fillText("⚔️", sx + slotSize / 2, sy + slotSize / 2); 
            }
        }
    }
    ctx.restore();

    if (inventory.maxScrollY > 0) {
        const sbW = 4, sbX = panelX + panelW - 8, sbY = panelY + topOffset;
        const thumbH = Math.max(20, (gridAreaH / gridTotalH) * gridAreaH);
        const thumbY = sbY + (inventory.scrollY / inventory.maxScrollY) * (gridAreaH - thumbH);
        ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.beginPath(); ctx.roundRect(sbX, sbY, sbW, gridAreaH, 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.beginPath(); ctx.roundRect(sbX, thumbY, sbW, thumbH, 2); ctx.fill();
    }

    // --- 繪製物品詳情疊加介面 (Detail Popup) ---
    if (inventory.selectedSlotIndex !== null) {
        let item = currentSlots[inventory.selectedSlotIndex];
        if (item) {
            const detailX = panelX + 16, detailY = panelY + 60, detailW = panelW - 32, detailH = 200;
            ctx.fillStyle = "rgba(15, 23, 42, 0.98)";
            ctx.beginPath(); ctx.roundRect(detailX, detailY, detailW, detailH, 8); ctx.fill();
            ctx.strokeStyle = "#f1c40f"; ctx.lineWidth = 2; ctx.stroke();
            
            // 關閉按鈕
            ctx.fillStyle = "#e74c3c"; ctx.font = "14px system-ui"; ctx.textAlign="right";
            ctx.fillText("✖", detailX + detailW - 8, detailY + 20);
            
            // 物品名稱
            ctx.fillStyle = "#f1c40f"; ctx.font = "bold 16px system-ui"; ctx.textAlign="left";
            ctx.fillText(item.name, detailX + 12, detailY + 20);
            
            // 描述
            ctx.fillStyle = "#cbd5e1"; ctx.font = "12px system-ui"; 
            ctx.textAlign = "left"; ctx.textBaseline = "top";
            let lines = item.desc.split('\n');
            for(let i=0; i<lines.length; i++) {
                ctx.fillText(lines[i], detailX + 12, detailY + 40 + i*18);
            }
            
            // 裝配按鈕 (1, 2, 3)
            ctx.textBaseline = "middle"; ctx.textAlign="center";
            const btnW = (detailW - 32) / 3;
            for (let i = 0; i < 3; i++) {
                let bx = detailX + 10 + i * (btnW + 6);
                let by = detailY + detailH - 45;
                ctx.fillStyle = "#3b82f6";
                ctx.beginPath(); ctx.roundRect(bx, by, btnW, 30, 4); ctx.fill();
                ctx.fillStyle = "#fff";
                ctx.fillText(`裝配${i+1}`, bx + btnW/2, by + 15);
            }
        }
    }
}

function drawJoystick(joy, coreColor, showKnob) {
    ctx.globalAlpha = joy.opacity;
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(joy.originX, joy.originY, JOYSTICK_RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    if (showKnob) {
        ctx.fillStyle = coreColor === "#ffffff" ? "rgba(255,255,255,0.72)" : "rgba(231, 76, 60, 0.72)";
        ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(joy.stickX, joy.stickY, 36, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else {
        ctx.fillStyle = "rgba(231, 76, 60, 0.5)"; ctx.beginPath(); ctx.arc(joy.originX, joy.originY, 20, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"; ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(joy.originX - 10, joy.originY); ctx.lineTo(joy.originX + 10, joy.originY);
        ctx.moveTo(joy.originX, joy.originY - 10); ctx.lineTo(joy.originX, joy.originY + 10); ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
}

gameLoop();
