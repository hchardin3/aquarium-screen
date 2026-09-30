import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SWIM } from './tank.js';

const COUNT = 48;
const CRUISE = 0.05; // m/s, about 1.5 body lengths per second
const MAX_SPEED = 0.09;
const FLEE_SPEED = 0.25;
const NEIGHBOR = 0.07;
const PERSONAL = 0.032;
const FLEE_RADIUS = 0.1;

// Swim wave + silver tetra pattern, computed from object-space position (model faces +Z).
const NOSE_Z = 0.0143;
const LENGTH = 0.0143 + 0.0135 + 0.0095;
const HALF_H = 0.004;

function swimShader(material, { body }) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        attribute float aPhase;
        attribute float aAmp;
        varying float vAlong;
        varying float vHeight;`,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        float along = clamp((${NOSE_Z.toFixed(4)} - position.z) / ${LENGTH.toFixed(4)}, 0.0, 1.0);
        float bend = along * along;
        transformed.x += sin(aPhase - along * 5.5) * bend * aAmp;
        vAlong = along;
        vHeight = position.y / ${HALF_H.toFixed(4)};`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        varying float vAlong;
        varying float vHeight;`,
      )
      .replace(
        '#include <color_fragment>',
        body
          ? /* glsl */ `#include <color_fragment>
        vec3 back = vec3(0.30, 0.32, 0.26);
        vec3 flank = vec3(0.78, 0.80, 0.80);
        vec3 belly = vec3(0.95, 0.93, 0.88);
        vec3 c = mix(flank, back, smoothstep(0.15, 0.75, vHeight));
        c = mix(c, belly, smoothstep(-0.2, -0.8, vHeight));
        // Iridescent lateral stripe
        float stripe = exp(-pow((vHeight - 0.12) / 0.14, 2.0))
                     * smoothstep(0.18, 0.35, vAlong) * smoothstep(0.78, 0.6, vAlong);
        c = mix(c, vec3(0.35, 0.75, 0.85), stripe * 0.65);
        // Dark eye spot near the nose
        c *= 1.0 - 0.8 * smoothstep(0.35, 0.2, length(vec2((vAlong - 0.07) * 9.0, vHeight - 0.15)));
        diffuseColor.rgb = c;`
          : /* glsl */ `#include <color_fragment>
        diffuseColor.a *= mix(0.55, 0.25, smoothstep(0.7, 1.0, vAlong));`,
      );
  };
}

function environmentMap(renderer) {
  // Soft top-lit tank environment so the silver bodies pick up plausible reflections.
  const envScene = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          float y = normalize(vDir).y;
          vec3 c = mix(vec3(0.03, 0.06, 0.03), vec3(0.12, 0.24, 0.10), smoothstep(-0.3, 0.2, y));
          c = mix(c, vec3(0.9, 0.95, 0.85), smoothstep(0.55, 0.95, y));
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    }),
  );
  envScene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  return pmrem.fromScene(envScene, 0.02).texture;
}

export function createSchool(scene, renderer, pointer) {
  const fish = Array.from({ length: COUNT }, () => ({
    pos: new THREE.Vector3(
      THREE.MathUtils.randFloat(-0.15, 0.15),
      THREE.MathUtils.randFloat(-0.02, 0.1),
      THREE.MathUtils.randFloat(-0.05, 0.1),
    ),
    vel: new THREE.Vector3(1, 0, 0)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28)
      .multiplyScalar(CRUISE),
    scale: THREE.MathUtils.randFloat(0.85, 1.15),
    phase: Math.random() * Math.PI * 2,
    fear: 0,
  }));
  const goal = new THREE.Vector3();
  let goalTimer = 0;
  let body = null;
  let fins = null;

  const envMap = environmentMap(renderer);
  new GLTFLoader().load('./models/tetra.glb', (gltf) => {
    const bodyGeo = gltf.scene.getObjectByName('Body').geometry;
    const finGeo = gltf.scene.getObjectByName('Fins').geometry;
    const phase = new THREE.InstancedBufferAttribute(new Float32Array(COUNT), 1);
    const amp = new THREE.InstancedBufferAttribute(new Float32Array(COUNT), 1);
    for (const geo of [bodyGeo, finGeo]) {
      geo.setAttribute('aPhase', phase);
      geo.setAttribute('aAmp', amp);
    }

    const bodyMat = new THREE.MeshStandardMaterial({
      metalness: 0.55,
      roughness: 0.32,
      envMap,
      envMapIntensity: 0.8,
    });
    swimShader(bodyMat, { body: true });
    const finMat = new THREE.MeshStandardMaterial({
      color: 0xe8e4d8,
      roughness: 0.5,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    swimShader(finMat, { body: false });

    body = new THREE.InstancedMesh(bodyGeo, bodyMat, COUNT);
    fins = new THREE.InstancedMesh(finGeo, finMat, COUNT);
    for (const m of [body, fins]) {
      m.frustumCulled = false;
      scene.add(m);
    }
  });

  const acc = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const align = new THREE.Vector3();
  const center = new THREE.Vector3();
  const sep = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const basis = new THREE.Matrix4();
  const scaleM = new THREE.Matrix4();

  function pickGoal() {
    goal.set(
      THREE.MathUtils.randFloat(SWIM.min.x * 0.8, SWIM.max.x * 0.8),
      THREE.MathUtils.randFloat(SWIM.min.y * 0.6, SWIM.max.y * 0.8),
      THREE.MathUtils.randFloat(SWIM.min.z, SWIM.max.z * 0.7),
    );
    goalTimer = THREE.MathUtils.randFloat(7, 14);
  }
  pickGoal();

  return (dt) => {
    goalTimer -= dt;
    if (goalTimer <= 0) pickGoal();
    const cursor = pointer.position;

    for (let i = 0; i < COUNT; i++) {
      const f = fish[i];
      acc.set(0, 0, 0);
      align.set(0, 0, 0);
      center.set(0, 0, 0);
      sep.set(0, 0, 0);
      let n = 0;
      for (let j = 0; j < COUNT; j++) {
        if (i === j) continue;
        const o = fish[j];
        const d = f.pos.distanceTo(o.pos);
        if (d < NEIGHBOR) {
          align.add(o.vel);
          center.add(o.pos);
          n++;
          if (d < PERSONAL) sep.add(tmp.subVectors(f.pos, o.pos).divideScalar(d * d + 1e-6));
        }
        // Panic spreads through the school.
        if (d < NEIGHBOR * 0.8) f.fear = Math.max(f.fear, o.fear * 0.75);
      }
      if (n > 0) {
        acc.addScaledVector(align.divideScalar(n).sub(f.vel), 0.9);
        acc.addScaledVector(center.divideScalar(n).sub(f.pos), 0.3);
      }
      acc.addScaledVector(sep, 0.0015);
      acc.addScaledVector(tmp.subVectors(goal, f.pos), 0.03);

      // Flee the cursor (distance measured in the screen plane).
      if (cursor) {
        tmp.subVectors(f.pos, cursor);
        tmp.z = 0;
        const d = tmp.length();
        if (d < FLEE_RADIUS) {
          f.fear = Math.max(f.fear, 1 - d / FLEE_RADIUS);
          acc.addScaledVector(tmp.normalize(), 3.0 * (1 - d / FLEE_RADIUS));
        }
      }
      f.fear = Math.max(0, f.fear - dt * 1.0);

      // Soft walls.
      for (const axis of ['x', 'y', 'z']) {
        const lo = SWIM.min[axis] - f.pos[axis];
        const hi = f.pos[axis] - SWIM.max[axis];
        if (lo > 0) acc[axis] += lo * 8;
        if (hi > 0) acc[axis] -= hi * 8;
      }

      const maxAcc = 0.25 + f.fear * 2.5;
      acc.clampLength(0, maxAcc);
      f.vel.addScaledVector(acc, dt);
      f.vel.y *= 1 - 1.2 * dt; // tetras swim level; damp climbing and diving
      const top = MAX_SPEED + (FLEE_SPEED - MAX_SPEED) * f.fear;
      const speed = f.vel.length();
      if (speed > top) f.vel.multiplyScalar(top / speed);
      if (speed < CRUISE * 0.4) f.vel.multiplyScalar((CRUISE * 0.4) / Math.max(speed, 1e-5));
      f.pos.addScaledVector(f.vel, dt);

      // Tail beat: faster and wider when darting.
      const s = f.vel.length() / CRUISE;
      f.phase += dt * (7 + 9 * Math.min(s, 5));
    }

    if (!body) return;
    const phaseAttr = body.geometry.getAttribute('aPhase');
    const ampAttr = body.geometry.getAttribute('aAmp');
    for (let i = 0; i < COUNT; i++) {
      const f = fish[i];
      fwd.copy(f.vel).normalize();
      fwd.y = THREE.MathUtils.clamp(fwd.y, -0.35, 0.35);
      fwd.normalize();
      right.crossVectors(worldUp, fwd).normalize();
      up.crossVectors(fwd, right);
      basis.makeBasis(right, up, fwd);
      basis.multiply(scaleM.makeScale(f.scale, f.scale, f.scale));
      basis.setPosition(f.pos);
      body.setMatrixAt(i, basis);
      fins.setMatrixAt(i, basis);
      phaseAttr.array[i] = f.phase;
      ampAttr.array[i] = 0.0016 + 0.0012 * Math.min(f.vel.length() / CRUISE - 1, 2);
    }
    body.instanceMatrix.needsUpdate = true;
    fins.instanceMatrix.needsUpdate = true;
    phaseAttr.needsUpdate = true;
    ampAttr.needsUpdate = true;
  };
}
