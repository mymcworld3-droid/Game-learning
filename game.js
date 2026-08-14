const game = document.querySelector(".game");
const player = document.querySelector(".player");

let playerX = 100;
let playerY = 200;
let joystickX = 0;
let joystickY = 0;
let activePointerId = null;

const speed = 4;
const maxJoystickDistance = 45;

// 建立虛擬搖桿
const joystick = document.createElement("div");
const joystickKnob = document.createElement("div");

joystick.className = "joystick";
joystickKnob.className = "joystick-knob";
joystick.appendChild(joystickKnob);
game.appendChild(joystick);

function resetJoystick() {
    activePointerId = null;
    joystickX = 0;
    joystickY = 0;
    joystickKnob.style.transform = "translate(0px, 0px)";
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

// 使用 Pointer Events，同時支援滑鼠、觸控與觸控筆
joystick.addEventListener("pointerdown", (event) => {
    activePointerId = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    moveJoystick(event.clientX, event.clientY);
    event.preventDefault();
});

joystick.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointerId) return;
    moveJoystick(event.clientX, event.clientY);
    event.preventDefault();
});

joystick.addEventListener("pointerup", (event) => {
    if (event.pointerId === activePointerId) resetJoystick();
});

joystick.addEventListener("pointercancel", (event) => {
    if (event.pointerId === activePointerId) resetJoystick();
});

joystick.addEventListener("lostpointercapture", () => {
    if (activePointerId !== null) resetJoystick();
});

// 玩家移動
function updatePlayer() {
    const maxX = Math.max(0, game.clientWidth - player.offsetWidth);
    const maxY = Math.max(0, game.clientHeight - player.offsetHeight);

    playerX += joystickX * speed;
    playerY += joystickY * speed;

    // 根據實際遊戲畫面大小限制玩家位置，不再寫死 760x460
    playerX = Math.max(0, Math.min(maxX, playerX));
    playerY = Math.max(0, Math.min(maxY, playerY));

    player.style.left = `${playerX}px`;
    player.style.top = `${playerY}px`;

    requestAnimationFrame(updatePlayer);
}

updatePlayer();
