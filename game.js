const player = document.querySelector(".player");

let playerX = 100;
let playerY = 200;

let joystickActive = false;
let joystickX = 0;
let joystickY = 0;

const speed = 4;

// 移動玩家
function updatePlayer() {
    playerX += joystickX * speed;
    playerY += joystickY * speed;

    // 不讓玩家跑出遊戲區域
    playerX = Math.max(0, Math.min(760, playerX));
    playerY = Math.max(0, Math.min(460, playerY));

    player.style.left = playerX + "px";
    player.style.top = playerY + "px";

    requestAnimationFrame(updatePlayer);
}

updatePlayer();


// ======================
// 建立虛擬搖桿
// ======================

const game = document.querySelector(".game");

const joystick = document.createElement("div");
const joystickKnob = document.createElement("div");

joystick.className = "joystick";
joystickKnob.className = "joystick-knob";

joystick.appendChild(joystickKnob);
game.appendChild(joystick);


// ======================
// 搖桿控制
// ======================

function moveJoystick(x, y) {

    const rect = joystick.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = x - centerX;
    let dy = y - centerY;

    const distance = Math.sqrt(dx * dx + dy * dy);

    const maxDistance = 45;

    if (distance > maxDistance) {
        dx = dx / distance * maxDistance;
        dy = dy / distance * maxDistance;
    }

    joystickKnob.style.transform =
        `translate(${dx}px, ${dy}px)`;

    joystickX = dx / maxDistance;
    joystickY = dy / maxDistance;
}


// ======================
// 滑鼠
// ======================

joystick.addEventListener("mousedown", function () {
    joystickActive = true;
});

document.addEventListener("mousemove", function (event) {

    if (!joystickActive) return;

    moveJoystick(event.clientX, event.clientY);

});

document.addEventListener("mouseup", function () {

    joystickActive = false;

    joystickKnob.style.transform =
        "translate(0px, 0px)";

    joystickX = 0;
    joystickY = 0;

});


// ======================
// 手機觸控
// ======================

joystick.addEventListener("touchstart", function (event) {

    joystickActive = true;

    event.preventDefault();

}, { passive: false });


document.addEventListener("touchmove", function (event) {

    if (!joystickActive) return;

    const touch = event.touches[0];

    moveJoystick(touch.clientX, touch.clientY);

    event.preventDefault();

}, { passive: false });


document.addEventListener("touchend", function () {

    joystickActive = false;

    joystickKnob.style.transform =
        "translate(0px, 0px)";

    joystickX = 0;
    joystickY = 0;

});
