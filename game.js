const game = document.querySelector(".game");
const world = document.querySelector(".world");
const player = document.querySelector(".player");
const mapPanel = document.querySelector(".map-panel");
const mapButton = document.querySelector(".map-button");
const closeMap = document.querySelector("#closeMap");
const mapPlayerMarker = document.querySelector("#mapPlayerMarker");
const zoneName = document.querySelector("#zoneName");
const zoneLevel = document.querySelector("#zoneLevel");

const WORLD_WIDTH = 3200;
const WORLD_HEIGHT = 2200;
const PLAYER_SIZE = 64;

// 目前先把遊戲視野調整成偏 MOBA / 傳說對決的比例：
// 世界放大後，角色、地形與場景物件都會更容易辨識。
// 之後製作正式角色素材時，只需要調整這個倍率即可微調視野。
const CAMERA_ZOOM = 1.45;
const SPEED = 4;
const MAX_JOYSTICK_DISTANCE = 45;

const spawnPoint = { x: 1580, y: 1510 };

// 預留給未來怪物系統使用的區域
const monsterZones = [
    { id: "A", x: 720, y: 1100, radius: 210, level: "Lv.5–10" },
    { id: "B", x: 1020, y: 1550, radius: 180, level: "Lv.10–15" },
    { id: "C", x: 2180, y: 780, radius: 210, level: "Lv.15–25" },
    { id: "D", x: 2550, y: 1000, radius: 190, level: "Lv.20–30" },
    { id: "E", x: 2200, y: 1450, radius: 220, level: "Lv.25–35" },
    { id: "F", x: 550, y: 620, radius: 150, level: "Lv.30+" }
];

const zones = [
    { name: "新手平原", level: "Lv.1–5", x: 1580, y: 1510 },
    { name: "迷霧森林", level: "Lv.5–20", x: 720, y: 1100 },
    { name: "古代遺跡", level: "Lv.20–30", x: 1320, y: 1260 },
    { name: "熔岩火山", level: "Lv.40+", x: 2140, y: 400 },
    { name: "黃金沙漠", level: "Lv.25–35", x: 2550, y: 900 },
    { name: "雪山之巔", level: "Lv.30+", x: 650, y: 420 }
];

let playerX = spawnPoint.x;
let playerY = spawnPoint.y;
let joystickX = 0;
let joystickY = 0;
let joystickPointerId = null;
const activePointers = new Set();

// ======================
// 自由位置虛擬搖桿
// 只有螢幕左下 1/4 區域可以建立搖桿。
// 使用 Pointer Events 保留多重觸控：第二根手指不會讓第一根手指失效。
// ======================
const joystick = document.createElement("div");
const joystickKnob = document.createElement("div");
joystick.className = "joystick";
joystickKnob.className = "joystick-knob";
joystick.appendChild(joystickKnob);
game.appendChild(joystick);
joystick.style.display = "none";

function isJoystickZone(clientX, clientY) {
    const rect = game.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    return x >= 0 && x <= rect.width / 2 && y >= rect.height / 2 && y <= rect.height;
}

function showJoystick(clientX, clientY) {
    const rect = game.getBoundingClientRect();
    const halfSize = joystick.offsetWidth / 2;
    let x = clientX - rect.left;
    let y = clientY - rect.top;

    x = Math.max(halfSize, Math.min(rect.width - halfSize, x));
    y = Math.max(halfSize, Math.min(rect.height - halfSize, y));

    joystick.style.left = `${x}px`;
    joystick.style.top = `${y}px`;
    joystick.style.display = "flex";
}

function resetJoystick() {
    joystickPointerId = null;
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

    if (distance > MAX_JOYSTICK_DISTANCE) {
        dx = (dx / distance) * MAX_JOYSTICK_DISTANCE;
        dy = (dy / distance) * MAX_JOYSTICK_DISTANCE;
    }

    joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    joystickX = dx / MAX_JOYSTICK_DISTANCE;
    joystickY = dy / MAX_JOYSTICK_DISTANCE;
}

game.addEventListener("pointerdown", (event) => {
    activePointers.add(event.pointerId);

    if (mapPanel.classList.contains("open")) return;
    if (event.target.closest("button, .map-panel")) return;
    if (!isJoystickZone(event.clientX, event.clientY)) return;
    if (joystickPointerId !== null) return;

    joystickPointerId = event.pointerId;
    game.setPointerCapture(event.pointerId);
    showJoystick(event.clientX, event.clientY);
    moveJoystick(event.clientX, event.clientY);
    event.preventDefault();
});

game.addEventListener("pointermove", (event) => {
    if (event.pointerId !== joystickPointerId) return;
    moveJoystick(event.clientX, event.clientY);
    event.preventDefault();
});

function releasePointer(event) {
    activePointers.delete(event.pointerId);
    if (event.pointerId === joystickPointerId) resetJoystick();
}

game.addEventListener("pointerup", releasePointer);
game.addEventListener("pointercancel", releasePointer);

game.addEventListener("lostpointercapture", (event) => {
    if (event.pointerId === joystickPointerId) resetJoystick();
});

// ======================
// 開放世界鏡頭
// CAMERA_ZOOM 讓世界與角色一起放大，讓畫面比例更接近 MOBA。
// 鏡頭仍然以玩家為中心，並且會限制在世界邊界內。
// ======================
function updateCamera() {
    const viewWidth = game.clientWidth;
    const viewHeight = game.clientHeight;
    const scaledWorldWidth = WORLD_WIDTH * CAMERA_ZOOM;
    const scaledWorldHeight = WORLD_HEIGHT * CAMERA_ZOOM;
    const playerCenterX = (playerX + PLAYER_SIZE / 2) * CAMERA_ZOOM;
    const playerCenterY = (playerY + PLAYER_SIZE / 2) * CAMERA_ZOOM;

    const targetX = viewWidth / 2 - playerCenterX;
    const targetY = viewHeight / 2 - playerCenterY;
    const minX = Math.min(0, viewWidth - scaledWorldWidth);
    const minY = Math.min(0, viewHeight - scaledWorldHeight);
    const cameraX = Math.max(minX, Math.min(0, targetX));
    const cameraY = Math.max(minY, Math.min(0, targetY));

    world.style.transform = `translate3d(${cameraX}px, ${cameraY}px, 0) scale(${CAMERA_ZOOM})`;
}

function updateZoneInfo() {
    let nearest = zones[0];
    let nearestDistance = Infinity;

    for (const zone of zones) {
        const distance = Math.hypot(playerX - zone.x, playerY - zone.y);
        if (distance < nearestDistance) {
            nearest = zone;
            nearestDistance = distance;
        }
    }

    zoneName.textContent = nearest.name;
    zoneLevel.textContent = nearest.level;
}

function updateMapMarker() {
    mapPlayerMarker.style.left = `${(playerX / WORLD_WIDTH) * 100}%`;
    mapPlayerMarker.style.top = `${(playerY / WORLD_HEIGHT) * 100}%`;
}

mapButton.addEventListener("click", () => {
    resetJoystick();
    mapPanel.classList.add("open");
    mapPanel.setAttribute("aria-hidden", "false");
    updateMapMarker();
});

closeMap.addEventListener("click", () => {
    mapPanel.classList.remove("open");
    mapPanel.setAttribute("aria-hidden", "true");
});

function updatePlayer() {
    playerX += joystickX * SPEED;
    playerY += joystickY * SPEED;

    playerX = Math.max(0, Math.min(WORLD_WIDTH - PLAYER_SIZE, playerX));
    playerY = Math.max(0, Math.min(WORLD_HEIGHT - PLAYER_SIZE, playerY));

    player.style.left = `${playerX}px`;
    player.style.top = `${playerY}px`;

    updateCamera();
    updateZoneInfo();
    updateMapMarker();
    requestAnimationFrame(updatePlayer);
}

player.style.left = `${playerX}px`;
player.style.top = `${playerY}px`;
updatePlayer();
