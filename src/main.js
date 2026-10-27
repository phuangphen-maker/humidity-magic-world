import * as THREE from "three";
import "./style.css";
import { stages, KEY, fresh, score, answer, validSave } from "./data.js";
const $ = (id) => document.getElementById(id),
  overlay = $("overlay");
let state = null;
try {
  const s = JSON.parse(localStorage.getItem(KEY));
  if (validSave(s)) state = s;
} catch {}
let crystalCooldown = 0;
let playing = false,
  modal = false,
  hearts = 3,
  vy = 0,
  grounded = true,
  checkpoint = new THREE.Vector3(0, 0, 9),
  worldItems = [],
  coins = [],
  crystals = [],
  particles = [],
  time = 0,
  near = null,
  levelGroup,
  avatar,
  dragon;
const keys = {},
  stick = { x: 0, y: 0 };
let colliders = [];
let running = false,
  audio = null,
  music = false,
  musicTimer;
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    toast("บันทึกไม่ได้ โปรดตรวจสอบพื้นที่หรือการตั้งค่าเบราว์เซอร์");
  }
}
function toast(s) {
  $("toast").textContent = s;
  $("toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("toast").classList.remove("show"), 2600);
}
function tone(f = 600, d = 0.15) {
  if (!audio) return;
  const o = audio.createOscillator(),
    g = audio.createGain();
  o.type = "sine";
  o.frequency.value = f;
  g.gain.setValueAtTime(0.08, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + d);
  o.connect(g).connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + d);
}
function unlockAudio() {
  try {
    audio ??= new AudioContext();
    audio.resume();
  } catch {}
}
function toggleMusic() {
  unlockAudio();
  music = !music;
  clearInterval(musicTimer);
  if (music) {
    let n = 0;
    musicTimer = setInterval(
      () => tone([261, 329, 392, 523, 440, 392, 329, 293][n++ % 8], 0.8),
      650,
    );
  }
  toast(music ? "เปิดทำนองเวทมนตร์" : "ปิดเพลงแล้ว");
}
const renderer = new THREE.WebGLRenderer({
  canvas: $("world"),
  antialias: true,
  powerPreference: "high-performance",
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#d9e7f0");
scene.fog = new THREE.Fog("#d9e7f0", 28, 100);
const camera = new THREE.PerspectiveCamera(
  52,
  innerWidth / innerHeight,
  0.1,
  180,
);
camera.position.set(15, 15, 27);
scene.add(new THREE.HemisphereLight(0xffffff, 0x88799e, 2.3));
const sun = new THREE.DirectionalLight(0xfff1d0, 2.7);
sun.position.set(12, 25, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, {
  left: -25,
  right: 25,
  top: 25,
  bottom: -25,
  far: 70,
});
scene.add(sun);
function quality(low) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.7));
  renderer.shadowMap.enabled = !low;
  resize();
}
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
quality(matchMedia("(pointer:coarse)").matches);
const mat = (c, extra = {}) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...extra });
function mesh(g, m, x = 0, y = 0, z = 0, parent = levelGroup) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}
function box(w, h, d, c, x, y, z, p) {
  return mesh(new THREE.BoxGeometry(w, h, d), mat(c), x, y, z, p);
}
function sphere(r, c, x, y, z, p) {
  return mesh(new THREE.SphereGeometry(r, 16, 12), mat(c), x, y, z, p);
}
function tree(x, z) {
  // Keep the marked jump corridor clear of decorative tree colliders.
  if (Math.abs(x - 7) < 2 && Math.abs(z + 14) < 3) return;
  colliders.push({ x, z, r: 0.6 });
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  levelGroup.add(g);
  box(0.35, 2, 0.35, 0x9b7b79, 0, 1, 0, g);
  for (let i = 0; i < 3; i++)
    sphere(
      1.1 - i * 0.17,
      [0xb6cdb3, 0xd7b7db, 0xaccbd4][Math.abs(Math.round(x)) % 3],
      0,
      2.4 + i * 0.6,
      0,
      g,
    );
}
function castle(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 1, z);
  levelGroup.add(g);
  box(5, 4, 3, 0xf6e7e7, 0, 2, 0, g);
  for (const xx of [-3, 3]) {
    mesh(
      new THREE.CylinderGeometry(0.8, 0.9, 5, 12),
      mat(0xf9f1e9),
      xx,
      2.5,
      0,
      g,
    );
    mesh(new THREE.ConeGeometry(1.2, 2.2, 12), mat(0xb49bd2), xx, 6, 0, g);
  }
  box(1.2, 2, 0.1, 0x9d8db5, 0, 1, 0.155 + 1.5, g);
}
function label(text, x, y, z) {
  const c = document.createElement("canvas");
  c.width = 768;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff7e9";
  ctx.fillRect(0, 0, 768, 128);
  ctx.fillStyle = "#554268";
  ctx.font = "36px Tahoma";
  ctx.textAlign = "center";
  ctx.fillText(text, 384, 78);
  const texture = new THREE.CanvasTexture(c);
  const m = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(m);
  sprite.scale.set(5, 0.84, 1);
  sprite.position.set(x, y, z);
  levelGroup.add(sprite);
  return sprite;
}
function makeAvatar() {
  const g = new THREE.Group();
  levelGroup.add(g);
  const witch = state?.profile.avatar === "witch";
  const robe = witch ? 0xb48ac6 : 0x7e9fc9;
  mesh(new THREE.ConeGeometry(0.47, 1, 12), mat(robe), 0, 0.8, 0, g);
  sphere(0.48, 0xffd8ba, 0, 1.65, 0, g);
  mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 0.09, 20),
    mat(robe),
    0,
    2.05,
    0,
    g,
  );
  mesh(new THREE.ConeGeometry(0.47, 0.9, 16), mat(robe), 0, 2.48, 0, g);
  sphere(0.045, 0x463c58, -0.17, 1.7, 0.435, g);
  sphere(0.045, 0x463c58, 0.17, 1.7, 0.435, g);
  g.legs = [
    box(0.19, 0.42, 0.22, 0x594e74, -0.21, 0.23, 0, g),
    box(0.19, 0.42, 0.22, 0x594e74, 0.21, 0.23, 0, g),
  ];
  box(0.15, 0.65, 0.15, 0x966d63, 0.64, 1, 0.15, g).rotation.z = -0.4;
  sphere(0.12, 0xffe2a2, 0.78, 1.35, 0.15, g);
  return g;
}
function makeDragon() {
  const g = new THREE.Group();
  levelGroup.add(g);
  g.position.set(0, 2, -28);
  sphere(2, 0xa38ac7, 0, 0, 0, g);
  sphere(1.1, 0xb69ad8, 0, 1.7, 1, g);
  sphere(0.1, 0x332c48, -0.4, 2, 1.95, g);
  sphere(0.1, 0x332c48, 0.4, 2, 1.95, g);
  for (const side of [-1, 1]) {
    const wing = mesh(
      new THREE.ConeGeometry(2.5, 3.5, 3),
      mat(0xd0b2e7, { side: THREE.DoubleSide }),
      side * 2.6,
      1,
      0,
      g,
    );
    wing.rotation.z = side * 0.9;
  }
  return g;
}
function buildLevel() {
  if (levelGroup) {
    scene.remove(levelGroup);
    levelGroup.traverse((o) => {
      o.geometry?.dispose();
      if (o.material?.map) o.material.map.dispose();
      if (o.material) o.material.dispose();
    });
  }
  levelGroup = new THREE.Group();
  scene.add(levelGroup);
  worldItems = [];
  coins = [];
  crystals = [];
  particles = [];
  dragon = null;
  colliders = [];
  const l = state?.level ?? 0,
    s = stages[l];
  scene.background.set(s.color);
  scene.fog.color.set(s.color);
  box(24, 1, 52, 0xc9d7b5, 0, -0.55, -9);
  box(8, 0.06, 47, 0xeee0c7, 0, 0.005, -9);
  box(24, 1, 7, 0xd5c5e0, 0, -1.1, -9);
  for (let z = 12; z > -34; z -= 3) {
    for (const x of [-11.7, 11.7]) {
      box(0.12, 1.3, 0.12, 0xece5ef, x, 0.65, z);
      mesh(
        new THREE.BoxGeometry(0.06, 0.7, 3),
        mat(0xffffff, { transparent: true, opacity: 0.22 }),
        x,
        0.8,
        z - 1.5,
      );
    }
  }
  for (let i = 0; i < 16; i++) {
    tree((i % 2 ? 1 : -1) * (7 + (i % 3)), 10 - Math.floor(i / 2) * 6);
  }
  castle(-17, -24);
  castle(20, -40);
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    g.position.set(((i % 3) - 1) * 3, 1.3, 6 - Math.floor(i / 3) * 11);
    levelGroup.add(g);
    const o = mesh(
      new THREE.TorusGeometry(0.28, 0.1, 8, 16),
      mat(0xffd77d, { metalness: 0.5, roughness: 0.3 }),
      0,
      0,
      0,
      g,
    );
    coins.push({ g, id: l * 9 + i });
    if (state?.coins.includes(l * 9 + i)) g.visible = false;
  }
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    g.position.set([-2.6, 2.6, 0][i], 1.5, [0, -12, -23][i]);
    levelGroup.add(g);
    mesh(
      new THREE.OctahedronGeometry(0.55),
      mat([0x9de5e1, 0xe9abd8, 0xc4b1f4][i], {
        metalness: 0.25,
        roughness: 0.2,
      }),
      0,
      0,
      0,
      g,
    );
    mesh(
      new THREE.TorusGeometry(0.8, 0.035, 6, 36),
      mat(0xffe8ae),
      0,
      -0.6,
      0,
      g,
    ).rotation.x = Math.PI / 2;
    crystals.push({ g, id: l * 3 + i });
    if (state?.answered.includes(l * 3 + i)) g.visible = false;
  }
  const station = new THREE.Group();
  station.position.set(0, 0, -6);
  levelGroup.add(station);
  mesh(
    new THREE.CylinderGeometry(1.2, 1.5, 0.7, 8),
    mat(0xb4a0c9),
    0,
    0.35,
    0,
    station,
  );
  sphere(0.75, 0x9ddcda, 0, 1.3, 0, station);
  worldItems.push({ type: "mission", pos: station.position });
  colliders.push({ x: 0, z: -6, r: 1.65 });
  const portal = mesh(
    new THREE.TorusGeometry(2, 0.24, 12, 48),
    mat(0xb498d1, { emissive: 0x8065ac, emissiveIntensity: 0.35 }),
    0,
    2.1,
    -31,
  );
  worldItems.push({
    type: "portal",
    pos: new THREE.Vector3(0, 0, -30),
    mesh: portal,
  });
  // A narrow, clearly marked side-route pit: width 1.2m, jump range >4m.
  box(2, 0.08, 1.2, 0x51475f, 7, 0.03, -14);
  for (const z of [-14.7, -13.3]) box(2, 0.1, 0.16, 0xf3c96b, 7, 0.1, z);
  box(0.12, 1.5, 0.12, 0xb78377, 8.5, 0.75, -12.5);
  box(1.6, 0.7, 0.1, 0xf2bd85, 8.5, 1.5, -12.5);
  if (l === 0 || l === 4) {
    mesh(
      new THREE.CylinderGeometry(3.1, 3.1, 0.12, 48),
      mat(0x83cfd9, { metalness: 0.3, roughness: 0.2 }),
      -7,
      0.04,
      -6,
    );
    for (let i = 0; i < 8; i++)
      sphere(
        0.13,
        0xc4f3f5,
        -7 + Math.sin(i) * 1.5,
        0.2,
        -6 + Math.cos(i) * 1.5,
      );
  }
  if (l === 1) scene.fog.near = 12;
  else scene.fog.near = 28;
  if (l === 2) castle(7, -22);
  if (l === 4)
    for (let i = 0; i < 8; i++)
      sphere(0.32, 0xf1bed5, Math.sin(i) * 2 - 7, 0.4, -6 + Math.cos(i) * 2);
  if (l === 6) dragon = makeDragon();
  for (let i = 0; i < 12; i++) {
    const cloud = new THREE.Group();
    levelGroup.add(cloud);
    cloud.position.set(Math.sin(i * 2) * 26, 8 + (i % 3) * 2, -15 - i * 4);
    for (let j = 0; j < 3; j++)
      sphere(1.2, 0xfff8f5, j * 1.2, Math.sin(j), 0, cloud);
  }
  label("✦ " + s.title, 0, 6, -32);
  label("แท่นทดลอง · กด E", 0, 3, -6);
  label("ระวังหลุม · กระโดดหรือเดินอ้อม", 7, 2.8, -14);
  for (let i = 0; i < 6; i++) {
    const arc = mesh(
      new THREE.TorusGeometry(8 + i * 0.24, 0.1, 6, 64, Math.PI),
      mat([0xf1b0bd, 0xf3cc9e, 0xeee7aa, 0xb5dac2, 0xaacddf, 0xc8b1dd][i]),
      0,
      8,
      -44,
    );
    arc.rotation.z = 0;
  }
  avatar = makeAvatar();
  avatar.position.copy(checkpoint);
  vy = 0;
  hearts = 3;
  updateHud();
}
function updateHud() {
  if (!state) return;
  const gate = worldItems.find((item) => item.type === "portal");
  if (gate) {
    const ready =
      state.missions.includes(state.level) &&
      state.answered.filter((id) => Math.floor(id / 3) === state.level)
        .length === 3;
    gate.mesh.material.color.set(ready ? 0x8aebc5 : 0xb498d1);
    gate.mesh.material.emissive.set(ready ? 0x49b98d : 0x8065ac);
    gate.mesh.material.emissiveIntensity = ready ? 0.8 : 0.2;
  }
  $("stage").textContent =
    `บทที่ ${state.level + 1} / 7 · ${stages[state.level].title}`;
  $("player").textContent = `${state.profile.name} · ${state.profile.room}`;
  $("stats").textContent =
    `✦ ${score(state)} / 210   ◇ ${state.answered.filter((i) => Math.floor(i / 3) === state.level).length}/3   🪙 ${state.coins.filter((i) => Math.floor(i / 9) === state.level).length}/9   ${"♥".repeat(hearts)}`;
  $("objective").textContent = state.missions.includes(state.level)
    ? "✦ ภารกิจสำเร็จ! ค้นหาคริสตัลให้ครบ 3 ดวง แล้วไปประตูท้ายเกาะ"
    : `ภารกิจ: ${stages[state.level].mission} · เข้าใกล้แท่นกลางแล้วกด E`;
}
function open(html) {
  modal = true;
  keysReset();
  overlay.innerHTML = `<section class="panel">${html}</section>`;
}
function close() {
  modal = false;
  crystalCooldown = time + 1.8;
  overlay.innerHTML = "";
}
function keysReset() {
  Object.keys(keys).forEach((k) => (keys[k] = false));
  stick.x = stick.y = 0;
  running = false;
}
function home() {
  playing = false;
  modal = true;
  $("hud").hidden = true;
  overlay.innerHTML = `<section class="panel hero"><div><span class="eyebrow">โลกใบเล็กที่เต็มไปด้วยความมหัศจรรย์</span><h1>Humidity<br>Magic World<span style="color:#aa88bd">.</span></h1><p class="intro">ผจญภัยอาณาจักรเวทมนตร์แห่งความชื้น</p><p class="lore muted">สวมหมวกนักเวท ออกเดินทางผ่าน 7 อาณาจักร<br>ไขความลับของหยดน้ำ และปลุกมังกรแห่งความรู้</p><span class="badge">✦ วิทยาศาสตร์ ม.1 &nbsp; · &nbsp; 7 ด่านมหัศจรรย์</span></div><form class="form-card" id="signup"><span class="eyebrow">การผจญภัยของคุณเริ่มต้นที่นี่</span><h2>นักเวทคนใหม่</h2><small>เตรียมไม้กายสิทธิ์ แล้วออกเดินทางกัน</small><label>ชื่อ–นามสกุล<input name="name" required maxlength="80" placeholder="ชื่อของนักผจญภัย"></label><div class="row"><label>ห้องเรียน<select name="room">${["1/1", "1/6", "1/7", "1/10", "1/12", "1/13"].map((r) => `<option>ม.${r}</option>`).join("")}</select></label><label>เลขที่<input name="number" type="number" min="1" max="99" required placeholder="01"></label></div><label>เลือกนักเวทของคุณ</label><div class="avatars"><label><input type="radio" name="avatar" value="wizard" checked>🧙 พ่อมดน้อย</label><label><input type="radio" name="avatar" value="witch">🪄 แม่มดน้อย</label></div><button class="primary">เริ่มการผจญภัย &nbsp; →</button>${state ? '<button type="button" id="resume" class="gold" style="width:100%;margin-top:9px">เล่นต่อจากที่บันทึกไว้</button>' : ""}<div class="footer-actions"><button type="button" id="help">วิธีเล่น</button><button type="button" id="music">♫ เพลง</button></div><p class="muted">ผลเก็บเฉพาะเบราว์เซอร์นี้ ไม่มีการส่งคะแนนให้ครูอัตโนมัติ</p></form></section>`;
  $("signup").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const profile = Object.fromEntries(f);
    profile.name = profile.name.trim();
    if (!profile.name) return toast("กรุณากรอกชื่อ");
    if (state) {
      open(
        '<h2>เริ่มการผจญภัยใหม่?</h2><p>ความก้าวหน้าที่บันทึกในเครื่องนี้จะถูกแทนที่ ดาวน์โหลดผลเดิมก่อนเริ่มใหม่ได้</p><div class="footer-actions"><button id="download">ดาวน์โหลดผลเดิม</button><button id="confirm" class="primary">ยืนยันเริ่มใหม่</button><button id="cancel">ยกเลิก</button></div>',
      );
      $("download").onclick = download;
      $("confirm").onclick = () => begin(fresh(profile));
      $("cancel").onclick = home;
    } else begin(fresh(profile));
  };
  if ($("resume"))
    $("resume").onclick = () =>
      state.completed ? certificate() : begin(state);
  $("help").onclick = () => help(home);
  $("music").onclick = toggleMusic;
}
function begin(s) {
  unlockAudio();
  state = s;
  save();
  checkpoint.set(0, 0, state.checkpoint === state.level + 1 ? -9 : 9);
  buildLevel();
  playing = true;
  $("hud").hidden = false;
  close();
  camera.position.copy(avatar.position).add(new THREE.Vector3(0, 7, 11));
}
function help(back) {
  open(
    '<span class="eyebrow">คู่มือนักเวท</span><h2>ออกเดินทางอย่างมั่นใจ</h2><p>W/A/S/D เดิน · Shift วิ่ง · Space กระโดด · E ใช้เวทมนตร์/โต้ตอบ</p><p>มือถือ: ลากจอยสติ๊กด้านซ้าย ใช้ปุ่มด้านขวาเพื่อวิ่ง กระโดด และร่ายเวท เล่นแนวนอนจะเห็นทางชัดขึ้น</p><p>เดินใกล้คริสตัลเพื่อเปิดคำถาม ตอบถูกข้อแรกได้ 10 คะแนน ตอบผิดมีคำใบ้และลองใหม่ได้ ไม่เสียคะแนน หัวใจใช้เมื่อพลาดหลุม</p><p>ทำมินิเกมที่แท่นกลาง เก็บคริสตัล 3 ดวง แล้วเข้าประตู เหรียญ 9 เหรียญเป็นของสะสมเสริม ไม่เพิ่มคะแนนความรู้ จุดตรวจอยู่หลังแท่นกลาง</p><p>ทางหลักกว้างปลอดภัย หลุมเล็กอยู่ทางเสริมด้านขวา กระโดดผ่านหรือเดินอ้อมได้ เมื่อหัวใจหมดจะกลับจุดเริ่มด่านโดยยังเก็บความรู้ไว้</p><button id="back" class="primary">เข้าใจแล้ว</button>',
  );
  $("back").onclick = back;
}
function pause() {
  if (!playing) return;
  open(
    `<h2>พักใต้แสงดาว</h2><p>ความก้าวหน้าบันทึกไว้ในเครื่องนี้แล้ว</p><div class="footer-actions"><button id="continue" class="primary">เล่นต่อ</button><button id="guide">วิธีเล่น</button><button id="music">♫ เปิด/ปิดเพลง</button><button id="quality">ปรับกราฟิก</button><button id="safe">กลับจุดปลอดภัย</button><button id="download">ดาวน์โหลด CSV</button><button id="home">หน้าแรก / เริ่มใหม่</button></div>`,
  );
  $("continue").onclick = close;
  $("guide").onclick = () => help(pause);
  $("music").onclick = toggleMusic;
  $("quality").onclick = () => {
    quality(renderer.shadowMap.enabled);
    toast("ปรับคุณภาพกราฟิกแล้ว");
  };
  $("safe").onclick = () => {
    respawn(false);
    close();
  };
  $("download").onclick = download;
  $("home").onclick = home;
}
$("pause").onclick = pause;
function ask(id) {
  if (modal || time < crystalCooldown || state.answered.includes(id)) return;
  const q = stages[Math.floor(id / 3)].questions[id % 3];
  open(
    `<span class="eyebrow">คริสตัลแห่งความรู้ ${(id % 3) + 1} / 3</span><h3>${q.text}</h3><div class="options">${q.options.map((o, i) => `<button data-answer="${i}">${"กขคง"[i]}. ${o}</button>`).join("")}</div><div id="feedback" role="status"></div><button id="leave">กลับไปสำรวจ</button>`,
  );
  $("leave").onclick = close;
  overlay.querySelectorAll("[data-answer]").forEach(
    (b) =>
      (b.onclick = () => {
        const correct = Number(b.dataset.answer) === q.answer;
        if (correct) {
          answer(state, id);
          save();
          tone(880, 0.35);
          burst(avatar.position);
          crystals.find((c) => c.id === id).g.visible = false;
          overlay
            .querySelectorAll("[data-answer]")
            .forEach((o) => (o.disabled = true));
          $("feedback").innerHTML =
            `<div class="feedback">✦ ถูกต้อง! +10 คะแนน<br>${q.explain}</div>`;
          $("leave").textContent = "เก็บคริสตัลแล้ว ไปต่อ →";
          updateHud();
        } else {
          tone(180);
          $("feedback").innerHTML =
            `<div class="feedback">ลองใหม่ได้! คำใบ้: ${q.explain}</div>`;
        }
      }),
  );
}
function missionDone() {
  if (!state.missions.includes(state.level)) state.missions.push(state.level);
  save();
  tone(1046, 0.5);
  burst(avatar.position);
  updateHud();
  open(
    `<h2>✦ เวทมนตร์สำเร็จ!</h2><p>${["แสงอาทิตย์เพิ่มพลังให้น้ำระเหย กลายเป็นไอน้ำที่มองไม่เห็น อนุภาคเรืองแสงในเกมเป็นสัญลักษณ์แทนการระเหย", "12 ÷ 20 × 100 = 60% ป่าฟื้นคืนสมดุล หมอกเป็นหยดน้ำ ไม่ใช่ไอน้ำที่มองเห็น", "เมื่อไอน้ำจริงคงที่และเย็นลง RH เพิ่มขึ้น เพราะค่าอิ่มตัวลดลง", "ไฮโกรมิเตอร์อ่าน RH 80% เมื่ออุณหภูมิและลมเท่ากัน ผ้าแห้งช้ากว่าในอากาศชื้น", "ผิวเย็นถึงจุดน้ำค้าง 15°C ไอน้ำจึงควบแน่นเป็นหยดน้ำบนผิว", "อากาศชื้นเย็นจนอิ่มตัว ไอน้ำควบแน่นเป็นหยดน้ำในเมฆ หยดน้ำเติบโตจนตกเป็นฝน", "ผนึกทั้งสามเปิดแล้ว! เครื่องมือ จุดน้ำค้าง และเมฆล้วนเชื่อมโยงกับไอน้ำ"][state.level]}</p><button id="done" class="primary">กลับไปเก็บคริสตัล</button>`,
  );
  $("done").onclick = close;
}
function mission() {
  if (state.missions.includes(state.level))
    return toast("แท่นเวทมนตร์นี้ฟื้นฟูแล้ว ไปเก็บคริสตัลต่อได้");
  const l = state.level;
  if ([0, 1, 2, 4].includes(l)) {
    let drops = 0;
    let value = [0, 6, 30, 0, 25][l];
    const render = () => {
      const display =
        l === 0
          ? `พลังแสงอาทิตย์ ${value}% · หยดน้ำ ${drops}/3`
          : l === 1
            ? `ไอน้ำจริง ${value} / อิ่มตัว 20 g/m³ · RH ${(value / 20) * 100}%`
            : l === 2
              ? `${value}°C · ไอน้ำจริง 10 g/m³ · RH ≈ ${Math.round((10 / (value === 20 ? 17.3 : value === 25 ? 23 : 30.4)) * 100)}%`
              : `ผิวแก้ว ${value}°C · จุดน้ำค้าง 15°C ${value <= 15 ? "💧 เกิดน้ำค้างแล้ว" : "ยังไม่เกิดน้ำค้าง"}`;
      $("readout").textContent = display;
    };
    open(
      `<span class="eyebrow">ห้องทดลองโต้ตอบ · ด่าน ${l + 1}</span><h2>${stages[l].mission}</h2><p>${l === 0 ? "กดเรียกหยดน้ำ 3 ครั้ง แล้วเพิ่มพลังแสงอาทิตย์" : l === 1 ? "กำหนดให้ค่าอิ่มตัว 20 g/m³ ที่อุณหภูมิคงที่ ปรับไอน้ำจริงให้ได้ RH 60%" : l === 2 ? "ปริมาณไอน้ำจริงคงที่ เลื่อนอุณหภูมิแล้วสังเกต RH (ค่าประมาณ)" : "ทำให้ผิวเย็นลงโดยลากแถบอุณหภูมิ"}</p><div id="readout" class="instrument"></div>${l === 0 ? '<button id="drops">💧 เรียกหยดน้ำ</button>' : ""}<input id="slider" aria-label="ปรับค่าการทดลอง" type="range" min="${l === 0 ? 0 : l === 1 ? 0 : l === 2 ? 20 : 10}" max="${l === 0 ? 100 : l === 1 ? 20 : 30}" step="${l === 2 ? 5 : 1}" value="${value}"><div id="feedback"></div><div class="footer-actions"><button id="apply" class="primary">ร่ายเวทตามค่านี้</button><button id="back">กลับ</button></div>`,
    );
    render();
    if (l === 0)
      $("drops").onclick = () => {
        drops = Math.min(3, drops + 1);
        $("drops").textContent = `💧 เก็บหยดน้ำ ${drops}/3`;
        tone(500 + drops * 100);
        render();
      };
    $("slider").oninput = (e) => {
      value = Number(e.target.value);
      render();
    };
    $("apply").onclick = () => {
      if (
        l === 0
          ? value >= 80 && drops === 3
          : l === 1
            ? value === 12
            : l === 2
              ? value === 20
              : value <= 15
      )
        missionDone();
      else
        $("feedback").textContent =
          l === 0
            ? "เก็บหยดน้ำให้ครบ 3 หยด และเพิ่มแสงอย่างน้อย 80%"
            : l === 1
              ? "ใช้สูตร RH = ไอน้ำจริง / 20 × 100 ลองปรับใหม่"
              : "ลองลดอุณหภูมิตามภารกิจอีกครั้ง";
    };
    $("back").onclick = close;
  } else if (l === 3) {
    let step = 0;
    const prompts = [
      [
        "เลือกเครื่องมือวัดความชื้น",
        ["บารอมิเตอร์", "ไฮโกรมิเตอร์", "เทอร์มอมิเตอร์"],
        1,
      ],
      [
        "หน้าปัดไฮโกรมิเตอร์: ◴ RH 80% หมายถึงอะไร?",
        ["อุณหภูมิ 80°C", "ลมแรง 80%", "ความชื้นสัมพัทธ์ 80%"],
        2,
      ],
      [
        "RH 80% จับคู่สถานการณ์ใด เมื่อปัจจัยอื่นเท่ากัน?",
        ["ผ้าแห้งช้ากว่า RH 30%", "ผ้าแห้งเร็วที่สุด", "ไม่มีไอน้ำ"],
        0,
      ],
    ];
    const draw = () => {
      open(
        `<h2>โต๊ะเครื่องมือนักเวท · ${step + 1}/3</h2><div class="instrument">${prompts[step][0]}</div><div class="options">${prompts[step][1].map((s, i) => `<button data-choice="${i}">${s}</button>`).join("")}</div><p id="feedback"></p><button id="back">กลับ</button>`,
      );
      $("back").onclick = close;
      overlay.querySelectorAll("[data-choice]").forEach(
        (b) =>
          (b.onclick = () => {
            if (+b.dataset.choice === prompts[step][2]) {
              if (++step === 3) missionDone();
              else draw();
            } else
              $("feedback").textContent =
                "ลองอีกครั้ง: ไฮโกรมิเตอร์วัด RH และ RH สูงทำให้การระเหยช้าลง";
          }),
      );
    };
    draw();
  } else {
    const sequence =
      l === 5
        ? [
            "อากาศชื้นเย็นตัวจนอิ่มตัว",
            "ไอน้ำควบแน่นเป็นหยดน้ำ",
            "หยดน้ำรวมตัวและเติบโต",
            "หยดน้ำตกเป็นฝน",
          ]
        : [
            "ไฮโกรมิเตอร์วัดความชื้น",
            "เย็นถึงจุดน้ำค้างเริ่มควบแน่น",
            "เมฆเป็นหยดน้ำหรือผลึกน้ำแข็ง",
          ];
    let step = 0;
    const choices = l === 5 ? [2, 0, 3, 1] : [2, 0, 1];
    open(
      `<h2>${l === 5 ? "เรียงวงจรสายฝน" : "ปลดผนึกมังกร"}</h2><p>${l === 5 ? "เลือกกระบวนการตามลำดับจากเริ่มต้นจนเกิดฝน" : "เปิดผนึกตามลำดับ: เครื่องมือ → จุดน้ำค้าง → เมฆ"}</p><div id="sequence" class="instrument">รอเวทมนตร์ขั้นที่ 1</div><div class="options">${choices.map((i) => `<button data-step="${i}">${sequence[i]}</button>`).join("")}</div><p id="feedback"></p><button id="back">กลับ</button>`,
    );
    $("back").onclick = close;
    overlay.querySelectorAll("[data-step]").forEach(
      (b) =>
        (b.onclick = () => {
          if (+b.dataset.step === step) {
            b.disabled = true;
            tone(500 + step * 150);
            $("sequence").textContent = sequence[step];
            step++;
            if (step === sequence.length) missionDone();
          } else
            $("feedback").textContent =
              l === 5
                ? "เริ่มจากอากาศชื้นเย็นตัว แล้วควบแน่น ก่อนหยดน้ำโตและตกลงมา"
                : "เริ่มจากเครื่องมือวัด ตามด้วยจุดน้ำค้าง แล้วจึงเมฆ";
        }),
    );
  }
}
function portal() {
  const n = state.answered.filter(
    (i) => Math.floor(i / 3) === state.level,
  ).length;
  if (n < 3 || !state.missions.includes(state.level))
    return toast("ประตูต้องการคริสตัล 3 ดวง และภารกิจแท่นกลาง");
  tone(1200, 0.6);
  if (state.level === 6) {
    state.completed = true;
    save();
    certificate();
    return;
  }
  open(
    `<span class="eyebrow">อาณาจักรฟื้นคืนแล้ว</span><h2>ผ่านด่าน ${state.level + 1} ✦</h2><p>${stages[state.level].title}</p><div class="large-score">${score(state)} <small>/ 210 คะแนน</small></div><p>คริสตัล 3/3 · เหรียญ ${state.coins.filter((i) => Math.floor(i / 9) === state.level).length}/9</p><button id="next" class="primary">ไปด่านถัดไป →</button>`,
  );
  $("next").onclick = () => {
    state.level++;
    state.checkpoint = 0;
    save();
    begin(state);
  };
}
function certificate() {
  playing = false;
  $("hud").hidden = true;
  open(
    `<div class="certificate" style="padding:24px"><span class="eyebrow">Humidity Magic World</span><h2>ประกาศนียบัตรนักเวทแห่งความชื้น</h2><p>ขอมอบให้แก่</p><h2>${escape(state.profile.name)}</h2><p>${escape(state.profile.room)} เลขที่ ${escape(state.profile.number)}</p><p>สำเร็จการผจญภัยทั้ง 7 อาณาจักร<br>ผ่านคริสตัลความรู้ 21 ดวง</p><div class="large-score">${score(state)} / 210</div><p>✦ ผู้พิทักษ์คริสตัลราชัน ✦</p></div><p class="muted">คะแนนเป็นผลหลังลองตอบใหม่ได้ ไม่ใช่คะแนนสอบครั้งแรก ข้อมูลอยู่ในเครื่องนี้เท่านั้น</p><div class="footer-actions"><button id="download" class="primary">ดาวน์โหลดผล CSV</button><button id="again">เล่นใหม่ / หน้าแรก</button></div>`,
  );
  $("download").onclick = download;
  $("again").onclick = home;
}
function download() {
  if (!state) return;
  const cell = (v) => '"' + String(v).replaceAll('"', '""') + '"';
  const rows = [
    [
      "ชื่อ–นามสกุล",
      "ชั้น",
      "เลขที่",
      "คะแนน",
      "คะแนนเต็ม",
      "ด่านล่าสุด",
      "สถานะ",
      "หมายเหตุ",
    ],
    [
      state.profile.name,
      state.profile.room,
      state.profile.number,
      score(state),
      210,
      state.level + 1,
      state.completed ? "สำเร็จ" : "กำลังเล่น",
      "ลองตอบใหม่ได้; บันทึกเฉพาะเครื่องนี้",
    ],
  ];
  const csv =
    "\uFEFF" +
    rows
      .map((r) =>
        r
          .map((v) => cell(/^[=+@\-\t\r]/.test(String(v)) ? "'" + v : v))
          .join(","),
      )
      .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "humidity-magic-world-results.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function burst(pos) {
  for (let i = 0; i < 24; i++) {
    const p = sphere(
      0.07,
      [0xffe5a3, 0xbceee7, 0xe6b8e3][i % 3],
      pos.x,
      pos.y + 1,
      pos.z,
    );
    particles.push({
      mesh: p,
      v: new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 4,
        (Math.random() - 0.5) * 4,
      ),
      life: 1,
    });
  }
}
function respawn(hurt = true) {
  if (hurt) {
    hearts--;
    tone(150);
    if (hearts <= 0) {
      hearts = 3;
      checkpoint.set(0, 0, 9);
      state.checkpoint = 0;
      save();
      toast("หัวใจฟื้นแล้ว! กลับจุดเริ่มด่าน ความรู้ยังอยู่ครบ");
    } else toast("กลับจุดปลอดภัยแล้ว");
  }
  avatar.position.copy(checkpoint);
  vy = 0;
  grounded = true;
  updateHud();
}
function jump() {
  if (playing && !modal && grounded) {
    vy = 7;
    grounded = false;
    tone(300, 0.08);
  }
}
function interact() {
  if (!playing || modal) return;
  unlockAudio();
  tone(700);
  burst(avatar.position);
  if (near?.type === "mission") mission();
  else if (near?.type === "portal") portal();
  else toast("เข้าใกล้แท่นเวทมนตร์หรือประตู แล้วกด E");
}
addEventListener("keydown", (e) => {
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    ) &&
    playing
  )
    e.preventDefault();
  if (e.code === "Escape" && playing) {
    if (modal) close();
    else pause();
  }
  if (modal) return;
  keys[e.code] = true;
  if (!e.repeat && e.code === "Space") jump();
  if (!e.repeat && e.code === "KeyE") interact();
});
addEventListener("keyup", (e) => (keys[e.code] = false));
addEventListener("blur", () => {
  keysReset();
  if (playing && !modal) pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    keysReset();
    if (playing && !modal) pause();
  }
});
$("jump").onpointerdown = (e) => {
  e.preventDefault();
  jump();
};
$("magic").onpointerdown = (e) => {
  e.preventDefault();
  interact();
};
$("run").onpointerdown = (e) => {
  e.preventDefault();
  running = true;
  e.target.setPointerCapture(e.pointerId);
};
for (const event of ["pointerup", "pointercancel"])
  $("run").addEventListener(event, () => (running = false));
const joystick = $("joystick");
let pointer = null;
joystick.onpointerdown = (e) => {
  pointer = e.pointerId;
  joystick.setPointerCapture(pointer);
  moveStick(e);
};
function moveStick(e) {
  if (pointer !== e.pointerId) return;
  const r = joystick.getBoundingClientRect(),
    x = (e.clientX - r.left - r.width / 2) / (r.width / 2),
    y = (e.clientY - r.top - r.height / 2) / (r.height / 2),
    m = Math.max(1, Math.hypot(x, y));
  stick.x = x / m;
  stick.y = y / m;
  joystick.firstElementChild.style.transform = `translate(${stick.x * 25}px,${stick.y * 25}px)`;
}
joystick.onpointermove = moveStick;
for (const event of ["pointerup", "pointercancel"])
  joystick.addEventListener(event, () => {
    pointer = null;
    stick.x = stick.y = 0;
    joystick.firstElementChild.style.transform = "";
  });
let effectTick = 0;
let previous = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - previous) / 1000, 0.04);
  previous = now;
  time += dt;
  if (avatar && playing && !modal) {
    let dx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + stick.x,
      dz = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0) + stick.y;
    const len = Math.hypot(dx, dz),
      speed = keys.ShiftLeft || keys.ShiftRight || running ? 7 : 4;
    if (len > 0) {
      dx /= Math.max(1, len);
      dz /= Math.max(1, len);
      avatar.position.x = THREE.MathUtils.clamp(
        avatar.position.x + dx * speed * dt,
        -11,
        11,
      );
      avatar.position.z = THREE.MathUtils.clamp(
        avatar.position.z + dz * speed * dt,
        -32,
        13,
      );
      for (const wall of colliders) {
        const wx = avatar.position.x - wall.x,
          wz = avatar.position.z - wall.z,
          dist = Math.hypot(wx, wz);
        if (dist < wall.r) {
          avatar.position.x = wall.x + (dist ? wx / dist : 1) * wall.r;
          avatar.position.z = wall.z + (dist ? wz / dist : 0) * wall.r;
        }
      }
      avatar.rotation.y = Math.atan2(dx, dz);
      avatar.legs.forEach(
        (leg, i) =>
          (leg.rotation.x = Math.sin(time * speed * 3 + i * Math.PI) * 0.6),
      );
    } else avatar.legs.forEach((leg) => (leg.rotation.x = 0));
    const previousY = avatar.position.y;
    vy -= 18 * dt;
    avatar.position.y += vy * dt;
    const pit =
      Math.abs(avatar.position.x - 7) < 1 &&
      Math.abs(avatar.position.z + 14) < 0.6;
    if (avatar.position.y <= 0 && previousY >= 0 && !pit) {
      avatar.position.y = 0;
      vy = 0;
      grounded = true;
    } else if (pit && avatar.position.y <= 0) {
      grounded = false;
    }
    if (avatar.position.y < -3) respawn();
    if (avatar.position.z < -8 && state.checkpoint !== state.level + 1) {
      checkpoint.set(0, 0, -9);
      state.checkpoint = state.level + 1;
      save();
      toast("✦ บันทึกจุดตรวจแล้ว");
    }
    for (const c of coins) {
      if (
        c.g.visible &&
        c.g.position.distanceTo(
          avatar.position.clone().add(new THREE.Vector3(0, 1, 0)),
        ) < 1
      ) {
        c.g.visible = false;
        if (!state.coins.includes(c.id)) state.coins.push(c.id);
        save();
        tone(800, 0.1);
        updateHud();
      }
    }
    near = worldItems.find(
      (o) =>
        Math.hypot(o.pos.x - avatar.position.x, o.pos.z - avatar.position.z) <
        2.6,
    );
    $("hint").textContent = near
      ? near.type === "mission"
        ? "E · ร่ายเวทที่แท่นทดลอง"
        : "E · เปิดประตูเวทมนตร์"
      : "WASD เดิน · Shift วิ่ง · Space กระโดด";
    for (const c of crystals) {
      if (
        c.g.visible &&
        Math.hypot(
          c.g.position.x - avatar.position.x,
          c.g.position.z - avatar.position.z,
        ) < 1.35
      ) {
        ask(c.id);
        break;
      }
    }
    camera.position.lerp(
      avatar.position.clone().add(new THREE.Vector3(0, 7.5, 11)),
      1 - Math.exp(-dt * 5),
    );
    camera.lookAt(avatar.position.x, 1, avatar.position.z - 3);
  }
  if (playing && !modal && state.missions.includes(state.level)) {
    effectTick += dt;
    if (effectTick > 0.18) {
      effectTick = 0;
      if (state.level === 0) {
        const p = sphere(
          0.08,
          0xd9ffff,
          -7 + (Math.random() - 0.5) * 4,
          0.3,
          -6 + (Math.random() - 0.5) * 4,
        );
        particles.push({ mesh: p, v: new THREE.Vector3(0, 1.5, 0), life: 2 });
      }
      if (state.level === 5) {
        for (let i = 0; i < 4; i++) {
          const p = sphere(
            0.055,
            0x91c9ed,
            (Math.random() - 0.5) * 14,
            9,
            avatar.position.z - 8 + Math.random() * 12,
          );
          particles.push({ mesh: p, v: new THREE.Vector3(0, -8, 0), life: 1 });
        }
      }
    }
  }
  if (!playing) {
    camera.position.set(Math.sin(time * 0.08) * 17, 13, 25);
    camera.lookAt(0, 0, -8);
  }
  for (const c of [...coins, ...crystals]) {
    c.g.rotation.y += dt;
    c.g.children[0].position.y = Math.sin(time * 2 + c.id) * 0.12;
  }
  if (dragon) {
    dragon.position.y = 2 + Math.sin(time) * 0.3;
    if (state.missions.includes(6))
      dragon.rotation.y = Math.sin(time * 0.5) * 0.3;
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.v, dt);
    p.v.y -= dt * 4;
    p.mesh.scale.setScalar(Math.max(0, p.life));
    if (p.life <= 0) {
      levelGroup.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      particles.splice(i, 1);
    }
  }
  renderer.render(scene, camera);
}
if (import.meta.env.DEV)
  window.__humidity = {
    snapshot: () => ({
      position: avatar.position.toArray(),
      grounded,
      hearts,
      state: structuredClone(state),
      modal,
    }),
    place: (x, z) => {
      avatar.position.set(x, 0, z);
      vy = 0;
      grounded = true;
    },
    mission,
    portal,
  };
buildLevel();
home();
requestAnimationFrame(frame);
