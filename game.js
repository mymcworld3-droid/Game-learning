const game = document.querySelector(".game");
const world = document.querySelector(".world");
const player = document.querySelector(".player");
const mapPanel = document.querySelector(".map-panel");
const mapButton = document.querySelector(".map-button");
const closeMap = document.querySelector("#closeMap");
const mapPlayerMarker = document.querySelector("#mapPlayerMarker");
const zoneName = document.querySelector("#zoneName");
const zoneLevel = document.querySelector("#zoneLevel");

// Newbie Plains: 6x6 tiles, 640px each.
const WORLD_WIDTH = 3840;
const WORLD_HEIGHT = 3840;
const PLAYER_SIZE = 64;
const CAMERA_ZOOM = 1.45;
const SPEED = 4;
const MAX_JOYSTICK_DISTANCE = 45;

// Spawn is placed in the southern meadow/town approach of Newbie Plains.
const spawnPoint = { x: 500, y: 3460 };

const zones = [
    { name: "新手平原", level: "Lv.1–5", x: 1650, y: 1700 },
    { name: "新手村", level: "安全區", x: 1640, y: 1580 },
    { name: "北部森林入口", level: "Lv.3–5", x: 1500, y: 520 },
    { name: "東側河谷", level: "Lv.2–5", x: 3220, y: 1850 },
    { name: "南部農田", level: "Lv.1–3", x: 650, y: 3150 }
];

let playerX = spawnPoint.x;
let playerY = spawnPoint.y;
let joystickX = 0;
let joystickY = 0;
let joystickPointerId = null;
const activePointers = new Set();

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
