import * as THREE from 'three';
import { TANK } from './scene/tank.js';
import { createBackdrop } from './scene/backdrop.js';
import { createFloor } from './scene/floor.js';
import { createBubbles } from './scene/bubbles.js';
import { createFish } from './scene/fish.js';
import { createPointer } from './scene/pointer.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a3a4a, 0.55);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 20);
camera.position.set(0, 0, TANK.cameraZ);

scene.add(new THREE.HemisphereLight(0x9fd8ff, 0x0b1a1f, 1.2));
const sun = new THREE.DirectionalLight(0xdff6ff, 1.6);
sun.position.set(0.3, 2, 0.5);
scene.add(sun);

const updaters = [
  createBackdrop(scene),
  createFloor(scene),
  createBubbles(scene),
  createFish(scene, createPointer(camera, renderer.domElement)),
];

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const timer = new THREE.Timer();
renderer.setAnimationLoop((now) => {
  timer.update(now);
  // Clamp so a long pause (hidden window) doesn't teleport everything.
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = timer.getElapsed();
  for (const update of updaters) update(dt, t);
  renderer.render(scene, camera);
});
