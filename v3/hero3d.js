// AMAX v8: scroll-driven 3D electrical workspace. three@0.160.0 (pinned).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const Q = new URLSearchParams(location.search);
const root = document.documentElement;
const stage = document.querySelector('.h3d');
const holder = stage.querySelector('.h3d-canvas');
const chapters = [...stage.querySelectorAll('.h3d-ch')];
const dots = [...stage.querySelectorAll('.h3d-dots i')];
const small = Math.min(innerWidth, innerHeight) < 700;
const fail = (why) => { root.classList.remove('three'); root.classList.add('no3d'); console.warn('3D off:', why); const l=document.querySelector('.lift'); if(l) l.classList.remove('done'); };

// ---------- motion tokens ----------
const E = {
  out: t => 1 - Math.pow(1 - t, 3),
  io: t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2,
  pop: t => { const c1=1.70158, c3=c1+1; return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2); },
};
const clamp = (x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const seg = (t,a,b)=>clamp((t-a)/(b-a));
const lerp = (a,b,t)=>a+(b-a)*t;

// ---------- renderer ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: !small, powerPreference: 'high-performance' });
} catch (e) { fail('webgl'); throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = !small;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
holder.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0e0e0c');
scene.fog = new THREE.Fog('#0e0e0c', 9, 18);
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(renderer), 0.04).texture;
scene.environmentIntensity = 0.35;

const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);

// ---------- sweep shader (line drawing -> solid) ----------
const U = { uSweep: { value: -6 }, uEdge: { value: new THREE.Color('#ff1010') } };
function sweepify(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSweep = U.uSweep; sh.uniforms.uEdge = U.uEdge;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;uniform float uSweep;uniform vec3 uEdge;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\nfloat sx = vW.x*0.9 + vW.y*0.35;\nif (sx > uSweep) discard;\nfloat edge = smoothstep(uSweep-0.12, uSweep, sx);\ngl_FragColor.rgb = mix(gl_FragColor.rgb, uEdge, edge*0.85);');
  };
  return mat;
}
const lineMat = new THREE.ShaderMaterial({
  uniforms: { uSweep: U.uSweep, uCol: { value: new THREE.Color('#8a8a84') } },
  transparent: true, depthWrite: false,
  vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
  fragmentShader: 'varying vec3 vW; uniform float uSweep; uniform vec3 uCol; void main(){ float sx = vW.x*0.9 + vW.y*0.35; float a = smoothstep(uSweep-0.05, uSweep+0.25, sx); if(a<0.01) discard; gl_FragColor = vec4(uCol, 0.75*a); }'
});
const lined = [];
function add(mesh, parent = scene, edges = true) {
  if (mesh.material) sweepify(mesh.material);
  mesh.castShadow = !small; mesh.receiveShadow = !small;
  parent.add(mesh);
  if (edges && mesh.geometry) {
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 28), lineMat);
    mesh.add(l); lined.push(l);
  }
  return mesh;
}
const std = (c, r = .6, m = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra });

// ---------- canvas textures ----------
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4; return t;
}
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const plaster = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#2b2a27'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { const v = 30 + rnd() * 28 | 0; g.fillStyle = `rgba(${v},${v},${v - 3},.35)`; g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 3, 2 + rnd() * 3); }
});
plaster.wrapS = plaster.wrapT = THREE.RepeatWrapping; plaster.repeat.set(4, 2);
const wood = canvasTex(1024, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8a5a34'); gr.addColorStop(1, '#6e4426');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) { const y = rnd() * h; g.strokeStyle = `rgba(${40 + rnd() * 30 | 0},${22 + rnd() * 14 | 0},10,${.12 + rnd() * .18})`; g.lineWidth = .6 + rnd() * 1.6; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * .01 + i) * 3); g.stroke(); }
  for (let x = 0; x < w; x += 128) { g.fillStyle = 'rgba(30,16,6,.35)'; g.fillRect(x, 0, 2, h); }
});
const concrete = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#1b1b19'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 6000; i++) { const v = 22 + rnd() * 18 | 0; g.fillStyle = `rgba(${v},${v},${v},.5)`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
});
concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping; concrete.repeat.set(6, 6);
let lcdText = '';
const lcdCanvas = document.createElement('canvas'); lcdCanvas.width = 256; lcdCanvas.height = 128;
const lcdTex = new THREE.CanvasTexture(lcdCanvas); lcdTex.colorSpace = THREE.SRGBColorSpace;
function drawLCD(txt) {
  if (txt === lcdText) return; lcdText = txt;
  const g = lcdCanvas.getContext('2d');
  g.fillStyle = '#1a0606'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = 'rgba(255,16,16,.12)'; g.font = 'bold 74px "Courier New",monospace'; g.textAlign = 'right'; g.fillText('888.8', 232, 92);
  g.fillStyle = '#ff2a1a'; g.fillText(txt, 232, 92);
  g.font = 'bold 22px Arial'; g.fillText('V~', 246, 118);
  lcdTex.needsUpdate = true;
}
drawLCD('000.0');

// ---------- room ----------
const wall = add(new THREE.Mesh(new THREE.PlaneGeometry(14, 6), std('#ffffff', .95, 0, { map: plaster })), scene, false);
wall.position.set(0, 1.6, -1.0);
const floor = add(new THREE.Mesh(new THREE.PlaneGeometry(14, 10), std('#ffffff', .9, 0, { map: concrete })), scene, false);
floor.rotation.x = -Math.PI / 2; floor.position.set(0, -1.9, 2);
// red/grey slash stripe painted on the wall (brand)
for (const [x, c, w] of [[-3.6, '#c20d0d', .5], [-2.95, '#4a4a46', .28]]) {
  const s = add(new THREE.Mesh(new THREE.PlaneGeometry(w, 8), std(c, .9)), scene, false);
  s.position.set(x, 1.4, -0.995); s.rotation.z = -0.42;
}

// bench
const bench = add(new THREE.Mesh(new RoundedBoxGeometry(5.2, 0.14, 1.7, 2, .02), std('#ffffff', .55, 0, { map: wood })));
bench.position.set(-0.4, -0.07, -0.05);
for (const x of [-2.8, 2.0]) { const leg = add(new THREE.Mesh(new THREE.BoxGeometry(.1, 1.8, 1.4), std('#1d1d1b', .6, .4))); leg.position.set(x, -1.0, -0.05); }

// AMAX logo sign (real logo file)
const logoImg = new Image(); logoImg.src = 'img/amax-logo.svg?v=8';
const logoTex = canvasTex(1024, 300, () => {});
logoImg.onload = () => { const c = logoTex.image, g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); const r = Math.min(c.width / logoImg.width, c.height / logoImg.height) * .9; g.drawImage(logoImg, (c.width - logoImg.width * r) / 2, (c.height - logoImg.height * r) / 2, logoImg.width * r, logoImg.height * r); logoTex.needsUpdate = true; dirty = true; };
const logo = add(new THREE.Mesh(new THREE.PlaneGeometry(1.7, .5), new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, roughness: .5 })), scene, false);
logo.position.set(0.3, 2.5, -0.98); logo.scale.setScalar(.8);

// real AMAX photos pinned to the wall (prints)
const loader = new THREE.TextureLoader();
const prints = [['img/g14-800.jpg', -0.15, 1.72, .05, .7], ['img/g11-800.jpg', 0.62, 1.82, -.06, .6], ['img/c10-800.jpg', 0.85, 1.12, .04, .5]];
for (const [src, x, y, rz, s] of prints) {
  const tex = loader.load(src + '?v=8', () => dirty = true); tex.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group(); g.position.set(x, y, -0.97); g.rotation.z = rz; scene.add(g);
  add(new THREE.Mesh(new THREE.BoxGeometry(s * 1.08, s * .82, .012), std('#f2efe8', .8)), g);
  const ph = add(new THREE.Mesh(new THREE.PlaneGeometry(s, s * .72), new THREE.MeshStandardMaterial({ map: tex, roughness: .7 })), g, false);
  ph.position.z = .008; ph.position.y = s * .03;
  const pin = add(new THREE.Mesh(new THREE.SphereGeometry(.022, 10, 8), std('#ff1010', .4)), g, false); pin.position.set(0, s * .36, .02);
}

// ---------- breaker panel ----------
const panel = new THREE.Group(); panel.position.set(1.7, 1.25, -0.86); scene.add(panel);
add(new THREE.Mesh(new RoundedBoxGeometry(1.15, 1.75, .26, 2, .02), std('#5d5f5b', .5, .55)), panel);
const dead = add(new THREE.Mesh(new THREE.BoxGeometry(.95, 1.55, .02), std('#9a9b96', .55, .45)), panel, false); dead.position.z = .135;
const door = new THREE.Group(); door.position.set(.575, 0, .15); panel.add(door);
const dm = add(new THREE.Mesh(new RoundedBoxGeometry(1.15, 1.75, .03, 2, .01), std('#8f918d', .42, .65)), door); dm.position.x = .575;
door.rotation.y = 1.9;
const lbl = add(new THREE.Mesh(new THREE.PlaneGeometry(.5, .7), std('#efece2', .9)), door, false); lbl.position.set(.575, .1, -.02); lbl.rotation.y = Math.PI;
const toggles = [];
const main = add(new THREE.Mesh(new THREE.BoxGeometry(.42, .2, .07), std('#141413', .5)), panel); main.position.set(0, .62, .17);
for (let col = 0; col < 2; col++) for (let row = 0; row < 8; row++) {
  const b = add(new THREE.Mesh(new THREE.BoxGeometry(.3, .105, .06), std('#161615', .55)), panel, row < 4);
  b.position.set(col ? .17 : -.17, .4 - row * .125, .165);
  const tg = new THREE.Group(); tg.position.set(col ? .1 : -.1, 0, .03); b.add(tg);
  const tm = add(new THREE.Mesh(new THREE.BoxGeometry(.07, .05, .05), std(row % 3 === 0 ? '#ff1010' : '#e9e7e0', .5)), tg, false); tm.position.z = .02;
  tg.rotation.y = col ? -.5 : .5; toggles.push({ tg, col, i: row + col * 8 });
}
// conduit from panel up to ceiling and across
const emt = std('#b8bab6', .35, .85);
const cond = (pts, r = .035) => add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.02), 64, r, 10), emt), scene, false);
cond([[1.55, 2.12, -0.88], [1.55, 2.85, -0.88], [1.4, 3.0, -0.88], [-0.4, 3.0, -0.88], [-0.6, 3.0, -0.75], [-0.6, 3.0, -0.3]]);
cond([[1.85, 2.12, -0.88], [1.85, 4.0, -0.88]]);
cond([[1.7, 0.37, -0.88], [1.7, -0.3, -0.88], [1.5, -0.45, -0.88], [-0.2, -0.45, -0.95]], .028);

// outlet on the wall
const outlet = new THREE.Group(); outlet.position.set(0.25, 0.62, -0.97); scene.add(outlet);
add(new THREE.Mesh(new RoundedBoxGeometry(.24, .38, .03, 2, .01), std('#efede6', .5)), outlet);
for (const y of [.085, -.085]) {
  add(new THREE.Mesh(new RoundedBoxGeometry(.15, .11, .02, 2, .02), std('#f6f4ee', .45)), outlet, false).position.set(0, y, .02);
  for (const x of [-.03, .03]) add(new THREE.Mesh(new THREE.BoxGeometry(.012, .04, .01), std('#111', .9)), outlet, false).position.set(x, y + .01, .032);
}

// ---------- multimeter ----------
const mm = new THREE.Group(); mm.position.set(-0.45, 0.02, 0.15); mm.rotation.set(-1.05, 0.18, 0); scene.add(mm);
const body = add(new THREE.Mesh(new RoundedBoxGeometry(.72, 1.3, .2, 4, .07), std('#d41414', .62, 0, { })), mm);
const face = add(new THREE.Mesh(new RoundedBoxGeometry(.58, 1.12, .05, 3, .03), std('#1c1c1a', .45, .1)), mm, false); face.position.z = .09;
const lcd = add(new THREE.Mesh(new THREE.PlaneGeometry(.46, .23), new THREE.MeshStandardMaterial({ map: lcdTex, emissive: '#ffffff', emissiveMap: lcdTex, emissiveIntensity: .55, roughness: .25 })), mm, false);
lcd.position.set(0, .36, .117);
const dialG = new THREE.Group(); dialG.position.set(0, -.06, .12); mm.add(dialG);
const dial = add(new THREE.Mesh(new THREE.CylinderGeometry(.16, .17, .06, 40), std('#111110', .4, .2)), dialG); dial.rotation.x = Math.PI / 2;
const ptr = add(new THREE.Mesh(new THREE.BoxGeometry(.03, .13, .02), std('#ff1010', .4)), dialG, false); ptr.position.set(0, .07, .035);
const ring = add(new THREE.Mesh(new THREE.TorusGeometry(.215, .006, 6, 48), std('#555550', .5, .5)), mm, false); ring.position.set(0, -.06, .117);
const jacks = [];
for (const [x, c] of [[-.17, '#111'], [0, '#111'], [.17, '#ff1010']]) {
  const j = add(new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .03, 20), std('#0a0a0a', .5)), mm, false);
  j.rotation.x = Math.PI / 2; j.position.set(x, -.43, .11);
  const r2 = add(new THREE.Mesh(new THREE.TorusGeometry(.05, .008, 6, 24), std(c, .45)), mm, false); r2.position.set(x, -.43, .125);
  jacks.push(new THREE.Vector3(x, -.43, .13));
}
// probes + leads
const probeMat = { red: std('#d41414', .5), blk: std('#151514', .5) };
const probes = {};
for (const k of ['blk', 'red']) {
  const g = new THREE.Group(); scene.add(g);
  add(new THREE.Mesh(new THREE.CylinderGeometry(.028, .022, .32, 14), probeMat[k]), g, false).position.y = -.16;
  add(new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .03, 14), probeMat[k]), g, false).position.y = -.32;
  const tip = add(new THREE.Mesh(new THREE.CylinderGeometry(.006, .002, .1, 8), std('#d9d9d4', .25, .9)), g, false); tip.position.y = .04;
  probes[k] = g;
}
const leadMesh = { red: null, blk: null };
const leadPose = { // [rest pos, inserted pos] in world, probe points "up" axis toward tip
  blk: [new THREE.Vector3(0.35, 0.05, 0.55), new THREE.Vector3(0.22, 0.55, -0.86)],
  red: [new THREE.Vector3(0.6, 0.05, 0.4), new THREE.Vector3(0.28, 0.55, -0.86)],
};
const tmpV = new THREE.Vector3();
function poseProbes(k01) {
  for (const k of ['blk', 'red']) {
    const g = probes[k];
    const [a, b] = leadPose[k];
    const e = E.io(k01);
    const lift = Math.sin(e * Math.PI) * .35;
    g.position.set(lerp(a.x, b.x, e), lerp(a.y, b.y, e) + lift, lerp(a.z, b.z, e));
    // rest: lying on bench (rotate to horizontal); inserted: pointing into wall (-z)
    g.rotation.set(lerp(-Math.PI / 2 + .02, -Math.PI / 2, e), 0, lerp(k === 'red' ? -1.2 : -0.9, 0, e));
    if (e > 0.98) g.rotation.set(-Math.PI / 2, 0, 0);
    // lead: from jack (world) to probe tail
    const jack = mm.localToWorld(tmpV.copy(jacks[k === 'red' ? 2 : 0]));
    const tail = g.localToWorld(new THREE.Vector3(0, -.34, 0));
    const mid1 = new THREE.Vector3().lerpVectors(jack, tail, .33); mid1.y = Math.min(jack.y, tail.y) - .02; mid1.z += .25;
    const mid2 = new THREE.Vector3().lerpVectors(jack, tail, .7); mid2.y = 0.03; mid2.z += .15;
    const curve = new THREE.CatmullRomCurve3([jack.clone(), mid1, mid2, tail]);
    if (leadMesh[k]) { leadMesh[k].geometry.dispose(); leadMesh[k].geometry = new THREE.TubeGeometry(curve, 40, .012, 8); }
    else { leadMesh[k] = add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, .012, 8), probeMat[k]), scene, false); }
  }
}
// a coil of yellow cable + a wire nut cup on the bench
const hel=[];for(let i=0;i<=360;i++){const u=i/360*Math.PI*2*6;hel.push(new THREE.Vector3(Math.cos(u)*.3,.035+i/360*.2,Math.sin(u)*.3));}
const coil = add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hel),720,.022,8), std('#d9b52a', .45)), scene, false); coil.position.set(-1.7, 0, .35);
const tail=add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-1.4,.06,.35],[-1.1,.02,.55],[-0.9,.02,.75],[-0.85,.02,.95]].map(p=>new THREE.Vector3(...p))),40,.022,8), std('#d9b52a', .45)), scene, false);
const cup = add(new THREE.Mesh(new THREE.CylinderGeometry(.16, .13, .26, 24, 1, true), std('#202020', .6)), scene); cup.position.set(1.3, .13, .25);
for (let i = 0; i < 7; i++) { const n = add(new THREE.Mesh(new THREE.ConeGeometry(.045, .07, 10), std(['#ff1010', '#e8c51d', '#ff7a00'][i % 3], .5)), scene, false); n.position.set(1.3 + (rnd() - .5) * .16, .25 + rnd() * .05, .25 + (rnd() - .5) * .16); n.rotation.set(rnd() * 3, rnd() * 3, 0); }

// ---------- pendant light (chapter 3) ----------
const pend = new THREE.Group(); pend.position.set(-0.6, 3.0, -0.3); scene.add(pend);
add(new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, 1.25, 6), std('#111', .6)), pend, false).position.y = -.62;
const shadePts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; shadePts.push(new THREE.Vector2(.06 + Math.pow(t, 1.6) * .34, -t * .32)); }
const shade = add(new THREE.Mesh(new THREE.LatheGeometry(shadePts, 40), std('#121211', .45, .3, { side: THREE.DoubleSide })), pend); shade.position.y = -1.25;
const bulbMat = new THREE.MeshStandardMaterial({ color: '#2a2418', emissive: '#ffcf8a', emissiveIntensity: 0, roughness: .2 });
const bulb = add(new THREE.Mesh(new THREE.SphereGeometry(.075, 20, 14), bulbMat), pend, false); bulb.position.y = -1.5;
const glowMat = new THREE.MeshBasicMaterial({ color: '#000000', side: THREE.DoubleSide }); const glow = new THREE.Mesh(new THREE.CircleGeometry(.39, 40), glowMat); glow.rotation.x = Math.PI/2; glow.position.y = -1.565; pend.add(glow);
const pSpot = new THREE.SpotLight('#ffc27a', 0, 6, .75, .7, 1.4); pSpot.position.set(0, -1.45, 0); pend.add(pSpot); pSpot.target.position.set(0, -3, 0); pend.add(pSpot.target); pSpot.castShadow = !small; pSpot.shadow.mapSize.set(512,512);

// ---------- lights ----------
scene.add(new THREE.HemisphereLight('#d8d4c8', '#18120c', .35));
const key = new THREE.SpotLight('#ffe2bf', 55, 14, .62, .55, 1.6); key.position.set(-3.2, 4.6, 3.6); key.target.position.set(0, 0.3, -0.6);
key.castShadow = !small; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.radius = 4;
scene.add(key, key.target);
const rim = new THREE.PointLight('#ff2a1a', 4, 6, 2); rim.position.set(2.8, 1.2, 1.2); scene.add(rim);
const pendL = new THREE.PointLight('#ffc98a', 0, 7, 1.6); pendL.position.set(-0.6, 1.6, -0.3); pendL.castShadow = false; scene.add(pendL);
const panelL = new THREE.SpotLight('#fff1dc', 0, 6, .4, .6, 1.5); panelL.position.set(0.6, 2.8, 1.8); panelL.target = panel; scene.add(panelL);

// ---------- camera path (chapters) ----------
const SHOTS = [
  { p: [-0.1, 1.55, 3.9], t: [-0.15, 0.55, -0.3], fov: 34 },   // 1: bench + multimeter
  { p: [0.85, 1.55, 2.25], t: [1.7, 1.2, -0.85], fov: 34 },    // 2: panel
  { p: [-1.1, 1.75, 4.6], t: [-0.3, 1.45, -0.4], fov: 38 },   // 3: pendant + whole bench
];
const PSHOTS = [
  { p: [-0.3, 1.6, 3.5], t: [-0.25, 0.3, -0.3], fov: 34 },
  { p: [1.2, 1.7, 2.6], t: [1.7, 1.35, -0.85], fov: 32 },
  { p: [-0.5, 2.3, 4.6], t: [-0.4, 1.4, -0.4], fov: 36 },
];
const cp = new THREE.Vector3(), ct = new THREE.Vector3();
function cameraAt(p, t, mx, my) {
  const s = p * (SHOTS.length - 1); const i = Math.min(SHOTS.length - 2, Math.floor(s)); const f = E.io(clamp(s - i));
  const S = camera.aspect < 1 ? PSHOTS : SHOTS; const A = S[i], B = S[i + 1];
  cp.set(lerp(A.p[0], B.p[0], f), lerp(A.p[1], B.p[1], f), lerp(A.p[2], B.p[2], f));
  ct.set(lerp(A.t[0], B.t[0], f), lerp(A.t[1], B.t[1], f), lerp(A.t[2], B.t[2], f));
  // intro dolly-in
  const intro = E.out(seg(t, 0, 2.6));
  cp.z += (1 - intro) * 1.4; cp.y += (1 - intro) * .35;
  // gentle pointer parallax (desktop)
  cp.x += mx * .12; cp.y += my * .06;
  camera.position.copy(cp); camera.lookAt(ct);
  const portrait = camera.aspect < 1;
  camera.fov = lerp(A.fov, B.fov, f) * (portrait ? 1.55 : 1) + (portrait ? 4 : 0);
  camera.updateProjectionMatrix();
}

// ---------- frame as a pure function of (t, p) ----------
function renderAt(t, p, mx = 0, my = 0) {
  // intro: line drawing sweeps to solid, dial turns, probes go in, LCD reads
  U.uSweep.value = lerp(-3.4, 5.2, E.io(seg(t, 0.2, 2.3)));
  dialG.rotation.z = lerp(1.3, 0, E.pop(seg(t, 1.0, 1.55)));
  poseProbes(seg(t, 1.45, 2.25));
  drawLCD(t < 1.1 ? '' : t < 2.3 ? '000.0' : '120.4');
  lcd.material.emissiveIntensity = t < 1.1 ? 0 : .6;
  // chapter 2: door already open, breakers snap on in sequence, panel lit
  const c2 = seg(p, .18, .5);
  for (const b of toggles) b.tg.rotation.y = (b.col ? -1 : 1) * lerp(.5, -.5, E.pop(seg(c2, b.i / 18, b.i / 18 + .16)));
  panelL.intensity = 9 * E.out(seg(p, .15, .45));
  // chapter 3: pendant on, room warms
  const c3 = E.out(seg(p, .62, .92));
  bulbMat.emissiveIntensity = c3 * 14; glowMat.color.setRGB(c3*1.0, c3*.78, c3*.5); pendL.intensity = c3 * 6; pSpot.intensity = c3 * 60;
  key.intensity = 55 - c3 * 30; scene.environmentIntensity = .35 - c3 * .15; rim.intensity = 4 * (1 - c3 * .6);
  renderer.toneMappingExposure = 1 + c3 * .08;
  cameraAt(p, t, mx, my);
  renderer.render(scene, camera);
}
window.renderAt = (t, p = 0) => { frozen = { t, p }; renderAt(t, p); };

// ---------- sizing ----------
function size() {
  const w = holder.clientWidth, h = holder.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  // frame subject off-centre: desktop pushes scene right of the copy, portrait pushes it up
  if (w > h * 1.05 && w > 900) camera.setViewOffset(w, h, -w * .17, 0, w, h);
  else if (w <= h) camera.setViewOffset(w, h, 0, h * .17, w, h);
  else camera.clearViewOffset();
  dirty = true;
}
let dirty = true, frozen = null;
addEventListener('resize', size); size();

// ---------- scroll -> one smoothed progress value ----------
let pT = 0, pC = 0, mx = 0, my = 0, mxC = 0, myC = 0;
function readScroll() {
  const r = stage.getBoundingClientRect(); const run = stage.offsetHeight - innerHeight;
  pT = clamp(-r.top / Math.max(1, run));
}
addEventListener('scroll', readScroll, { passive: true }); readScroll();
if (matchMedia('(hover:hover)').matches) addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });

function ui(p, t) {
  const n = chapters.length; const s = p * (n - 1);
  chapters.forEach((c, i) => {
    const d = Math.abs(s - i);
    const vis = clamp(1 - (d - .18) / .3);
    const o = i === 0 ? vis * clamp((t - 1.7) / .5) : vis;
    c.style.opacity = o.toFixed(3);
    c.style.visibility = o < .02 ? 'hidden' : 'visible';
    c.toggleAttribute('inert', o < .5);
  });
  dots.forEach((d, i) => d.classList.toggle('on', Math.round(s) === i));
  stage.style.setProperty('--hint', clamp(1 - p * 6) * clamp((t - 2.6) / .5));
}

// ---------- loop ----------
const T0 = performance.now(); let slow = 0, frames = 0, last = T0, visible = true;
new IntersectionObserver(es => visible = es[0].isIntersecting).observe(stage);
const qT = Q.has('t') ? +Q.get('t') : null, qP = Q.has('p') ? +Q.get('p') : null;
function tick(now) {
  requestAnimationFrame(tick);
  const dt = now - last; last = now;
  if (!visible || document.hidden) return;
  const t = qT ?? (now - T0) / 1000;
  pC += ((qP ?? pT) - pC) * (qP != null ? 1 : .1);
  mxC += (mx - mxC) * .06; myC += (my - myC) * .06;
  const moving = t < 3.2 || Math.abs((qP ?? pT) - pC) > 1e-4 || Math.abs(mx - mxC) > 1e-3 || Math.abs(my - myC) > 1e-3;
  if (!moving && !dirty) return;
  dirty = false;
  renderAt(t, pC, mxC, myC); ui(pC, t);
  // performance guard: if the device can't hold ~24fps during the intro, fall back to the 2D hero
  if (t > .6 && t < 3 && !Q.has('force3d')) { frames++; if (dt > 42) slow++; if (frames > 45 && slow / frames > .5) { fail('slow'); renderer.setAnimationLoop(null); } }
}
root.classList.add('three-ready');
requestAnimationFrame(tick);
