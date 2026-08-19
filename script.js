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
   放開搖桿 (新增：放開時隱藏搖桿)
========================= */
function resetStick() {
    active = false;
    dx = 0;
    dy = 0;

    /* 搖桿回中心 */
    stick.style.left = "50%";
    stick.style.top = "50%";

    /* 隱藏搖桿 */
    joystick.style.opacity = "0";
}

/* =========================
   手指按下 (修改：綁定到 game，並動態定位搖桿)
========================= */
game.addEventListener("pointerdown", e => {
    active = true;
    game.setPointerCapture(e.pointerId);

    /* 取得搖桿的一半尺寸，用來校正中心點 */
    const joyHalfW = joystick.offsetWidth / 2;
    const joyHalfH = joystick.offsetHeight / 2;

    /* 清除原本 CSS 的 bottom 限制，並將搖桿移到手指按下的位置 */
    joystick.style.bottom = "auto";
    joystick.style.left = (e.clientX - joyHalfW) + "px";
    joystick.style.top = (e.clientY - joyHalfH) + "px";

    /* 顯示搖桿 */
    joystick.style.opacity = "1";

    moveStick(e.clientX, e.clientY);
});

/* =========================
   手指移動 (修改：綁定到 game)
========================= */
game.addEventListener("pointermove", e => {
    if (active) {
        moveStick(e.clientX, e.clientY);
    }
});

/* =========================
   手指放開或取消 (修改：綁定到 game)
========================= */
game.addEventListener("pointerup", resetStick);
game.addEventListener("pointercancel", resetStick);

/* =========================
   初始化 (新增：設定搖桿初始隱藏與漸變動畫)
========================= */
/* 請把這兩行加在腳本最底部，原本初始化 player 位置的附近 */
joystick.style.opacity = "0";
joystick.style.transition = "opacity 0.15s ease-out";
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
