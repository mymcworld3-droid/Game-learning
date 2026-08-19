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
    speed: 4.5
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

// === [新增] 手部環繞角度追蹤 ===
let handAngle = Math.PI / 4; // 初始角度預設在右下角 (45度)

/* =========================
   輸入監聽 (直接綁定 Canvas)
========================= */
canvas.addEventListener("pointerdown", e => {
    joystick.active = true;
    canvas.setPointerCapture(e.pointerId);

    // 設定搖桿中心位置為點擊位置
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

    // 計算移動比例給玩家使用
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
    // 玩家移動
    player.x += dx * player.speed;
    player.y += dy * player.speed;

    // 邊界限制
    player.x = Math.max(player.radiusX, Math.min(cw - player.radiusX, player.x));
    player.y = Math.max(player.radiusY, Math.min(ch - player.radiusY, player.y));

    // 搖桿淡入淡出動畫
    if (joystick.active) {
        joystick.opacity = Math.min(1, joystick.opacity + 0.15); // 漸顯
    } else {
        joystick.opacity = Math.max(0, joystick.opacity - 0.15); // 漸隱
    }
}

function draw() {
    // 1. 清空畫布與繪製網格背景
    ctx.fillStyle = "#263746";
    ctx.fillRect(0, 0, cw, ch);

    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    // 繪製垂直與水平網格線 (40px)
    for (let x = 0; x < cw; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, ch); }
    for (let y = 0; y < ch; y += 40) { ctx.moveTo(0, y); ctx.lineTo(cw, y); }
    ctx.stroke();

    // 2. 繪製玩家 (史萊姆)
    drawPlayer();

    // 3. 繪製搖桿 (當不透明度大於 0 時)
    if (joystick.opacity > 0) {
        drawJoystick();
    }
}

/* =========================
   繪製函式細節
========================= */
function drawPlayer() {
    const px = player.x;
    const py = player.y;

    /* ==============================================
       === [修改處 1] 計算方向與角度 ===
    ============================================== */
    if (dx !== 0 || dy !== 0) {
        // 只有當搖桿有推動時，才更新目標角度與平滑過渡
        let targetAngle = Math.atan2(dy, dx);
        
        let angleDiff = targetAngle - handAngle;
        angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
        handAngle += angleDiff * 0.15; 
    }
    // 💡 如果搖桿放開 (dx 與 dy 為 0)，程式就不會進入上面的 if，
    // handAngle 就會保持在最後的角度，不會再彈回原位！

    /* ==============================================
       === [修改處 2] 讓眼睛也跟著最後的角度停住 ===
    ============================================== */
    // 改用 cos 和 sin 配合 handAngle 來計算眼睛偏移，這樣眼睛也會停在最後看的方向
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

    // 設定手部的橢圓軌道半徑 (比身體稍微大一點點，創造環繞感)
    const orbitRx = player.radiusX + 16; 
    const orbitRy = player.radiusY + 16; 

    // 利用三角函數計算出環繞的 X 與 Y 座標
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

    // 大圓 (搖桿底座)
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(joystick.originX, joystick.originY, 75, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 小圓 (搖桿中心點)
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(joystick.stickX, joystick.stickY, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 恢復透明度
    ctx.globalAlpha = 1.0;
}

// 啟動遊戲
gameLoop();
