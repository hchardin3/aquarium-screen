import * as THREE from 'three';
import { CAMERA } from './scene/tank.js';
import { createPlates, createLightRays } from './scene/plates.js';
import { createFish } from './scene/fish.js';
import { createBubbles } from './scene/bubbles.js';
import { createParticles } from './scene/particles.js';
import { createPointer } from './scene/pointer.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
// The plates are already tone-mapped by Blender (AgX); keep live objects in the same space.
renderer.toneMapping = THREE.NoToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Stand-in for the water absorption baked into the plates.
scene.fog = new THREE.Fog(0x0d2213, 0.6, 2.6);

const camera = new THREE.PerspectiveCamera(
  CAMERA.fovY,
  window.innerWidth / window.innerHeight,
  0.01,
  10,
);
camera.position.set(0, 0, CAMERA.z);

scene.add(new THREE.HemisphereLight(0x9cc48f, 0x0c1a0c, 0.7));
const tankLight = new THREE.DirectionalLight(0xfff4e2, 1.3);
tankLight.position.set(0.2, 1, 0.35);
scene.add(tankLight);

const pointer = createPointer(camera, renderer.domElement);
const updaters = [
  createPlates(scene),
  createFish(scene, renderer, pointer),
  createBubbles(scene),
  createParticles(scene),
  createLightRays(scene),
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
