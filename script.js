/* =========================
   取得遊戲物件
========================= */
const game = document.getElementById("game");
const player = document.getElementById("player");
const joystick = document.getElementById("joystick");
const stick = document.getElementById("stick");

/* =========================
   玩家位置
========================= */
let x = innerWidth / 2;
let y = innerHeight / 2;

/* =========================
   搖桿狀態
========================= */
let active = false;
let dx = 0;
let dy = 0;

/* =========================
   移動速度與限制
========================= */
const speed = 4.5;
const maxDistance = 39; // 搖桿最大移動距離

/* =========================
   更新玩家
========================= */
function updatePlayer() {
    const halfW = player.offsetWidth / 2;
    const halfH = player.offsetHeight / 2;

    /* 搖桿方向 (dx = 左右, dy = 上下) */
    x += dx * speed;
    y += dy * speed;

    /* 防止角色離開畫面 */
    x = Math.max(halfW, Math.min(innerWidth - halfW, x));
    y = Math.max(halfH, Math.min(innerHeight - halfH, y));

    /* 更新角色位置 */
    player.style.left = x + "px";
    player.style.top = y + "px";

    /* 下一幀 */
    requestAnimationFrame(updatePlayer);
}

/* =========================
   移動搖桿
========================= */
function moveStick(clientX, clientY) {
    const rect = joystick.getBoundingClientRect();

    /* 搖桿中心 */
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    /* 計算方向 */
    let vx = clientX - cx;
    let vy = clientY - cy;

    /* 距離 */
    const distance = Math.hypot(vx, vy);

    /* 限制最大距離 */
    if (distance > maxDistance) {
        vx = vx / distance * maxDistance;
        vy = vy / distance * maxDistance;
    }

    /* 移動搖桿視覺 */
    stick.style.left = `calc(50% + ${vx}px)`;
    stick.style.top = `calc(50% + ${vy}px)`;

    /* 計算移動方向比例給角色使用 */
    dx = vx / maxDistance;
    dy = vy / maxDistance;
}

/* =========================
   放開搖桿
========================= */
function resetStick() {
    active = false;
    dx = 0;
    dy = 0;

    /* 搖桿回中心 */
    stick.style.left = "50%";
    stick.style.top = "50%";
}

/* =========================
   手指按下
========================= */
joystick.addEventListener("pointerdown", e => {
    active = true;
    joystick.setPointerCapture(e.pointerId);
    moveStick(e.clientX, e.clientY);
});

/* =========================
   手指移動
========================= */
joystick.addEventListener("pointermove", e => {
    if (active) {
        moveStick(e.clientX, e.clientY);
    }
});

/* =========================
   手指放開或取消
========================= */
joystick.addEventListener("pointerup", resetStick);
joystick.addEventListener("pointercancel", resetStick);

/* =========================
   螢幕尺寸改變
========================= */
addEventListener("resize", () => {
    x = Math.max(player.offsetWidth / 2, Math.min(innerWidth - player.offsetWidth / 2, x));
    y = Math.max(player.offsetHeight / 2, Math.min(innerHeight - player.offsetHeight / 2, y));
});

/* =========================
   初始化
========================= */
player.style.left = x + "px";
player.style.top = y + "px";

/* 開始遊戲迴圈 */
updatePlayer();
