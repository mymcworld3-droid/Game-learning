const game = document.querySelector(".game");
const player = document.querySelector(".player");

let playerX = 100;
let playerY = 200;
let joystickX = 0;
let joystickY = 0;
let activePointerId = null;

const speed = 4;
const maxJoystickDistance = 45;

// 建立可移動的虛擬搖桿
const joystick = document.createElement("div");
const joystickKnob = document.createElement("div");
joystick.className = "joystick";
joystickKnob.className = "joystick-knob";
joystick.appendChild(joystickKnob);
game.appendChild(joystick);

// 搖桿預設隱藏；玩家按下遊戲畫面時，搖桿會出現在按下的位置
joystick.style.display = "none";

function showJoystick(clientX, clientY) {
    const rect = game.getBoundingClientRect();
    const halfSize = joystick.offsetWidth / 2;

    let x = clientX - rect.left;
    let y = clientY - rect.top;

    // 避免搖桿超出遊戲畫面
    x = Math.max(halfSize, Math.min(rect.width - halfSize, x));
    y = Math.max(halfSize, Math.min(rect.height - halfSize, y));

    joystick.style.left = `${x - halfSize}px`;
    joystick.style.top = `${y - halfSize}px`;
    joystick.style.bottom = "auto";
    joystick.style.display = "flex";
}

function resetJoystick() {
    activePointerId = null;
    joystickX = 0;
    joystickY = 0;
    joystickKnob.style.transform = "translate(0px, 0px)";
    joystick.style.display = "none";
}

function moveJoystick(clientX, clientY) {
    const rect = joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);

    if (distance > maxJoystickDistance) {
        dx = (dx / distance) * maxJoystickDistance;
        dy = (dy / distance) * maxJoystickDistance;
    }

    joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    joystickX = dx / maxJoystickDistance;
    joystickY = dy / maxJoystickDistance;
}

// 點擊/觸控遊戲畫面任何位置，都可以在該位置建立搖桿
// 點到現有搖桿時則直接控制它
 game.addEventListener("pointerdown", (event) => {
    if (activePointerId !== null) return;

    activePointerId = event.pointerId;
    showJoystick(event.clientX, event.clientY);
    game.setPointerCapture(event.pointerId);
    moveJoystick(event.clientX, event.clientY);
    event.preventDefault();
});

game.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointerId) return;
    moveJoystick(event.clientX, event.clientY);
    event.preventDefault();
});

game.addEventListener("pointerup", (event) => {
    if (event.pointerId === activePointerId) resetJoystick();
});

game.addEventListener("pointercancel", (event) => {
    if (event.pointerId === activePointerId) resetJoystick();
});

game.addEventListener("lostpointercapture", () => {
    if (activePointerId !== null) resetJoystick();
});

// 玩家移動
function updatePlayer() {
    const maxX = Math.max(0, game.clientWidth - player.offsetWidth);
    const maxY = Math.max(0, game.clientHeight - player.offsetHeight);

    playerX += joystickX * speed;
    playerY += joystickY * speed;

    playerX = Math.max(0, Math.min(maxX, playerX));
    playerY = Math.max(0, Math.min(maxY, playerY));

    player.style.left = `${playerX}px`;
    player.style.top = `${playerY}px`;

    requestAnimationFrame(updatePlayer);
}

updatePlayer();
