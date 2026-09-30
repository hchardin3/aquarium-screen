import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SPECIES } from './species.js';

const worldUp = new THREE.Vector3(0, 1, 0);

// Gravel height under the fish, matching substrate_height() in assets/src/aquascape.py
// (Blender y = -z) without its small noise term.
function floorY(z) {
  const t = THREE.MathUtils.clamp((-z + 0.2) / 0.55, 0, 1);
  return -0.25 + 0.07 * t ** 1.3;
}

// Swim wave + species pattern, computed from object-space position (models face +Z).
function fishMaterial(spec, envMap, dims, isFin) {
  const material = isFin
    ? new THREE.MeshStandardMaterial({
        roughness: 0.5,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    : new THREE.MeshStandardMaterial({ ...spec.material, envMap, envMapIntensity: 0.8 });
  // All species share this onBeforeCompile source, so Three would reuse the first compiled program.
  material.customProgramCacheKey = () => `${spec.name}-${isFin ? 'fins' : 'body'}`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uNose: { value: dims.nose },
      uLen: { value: dims.length },
      uHalfH: { value: dims.halfH },
    });
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uNose;
        uniform float uLen;
        uniform float uHalfH;
        attribute float aPhase;
        attribute float aAmp;
        varying float vAlong;
        varying float vHeight;`,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        float along = clamp((uNose - position.z) / uLen, 0.0, 1.0);
        transformed.x += sin(aPhase - along * 5.5) * along * along * aAmp * uLen;
        vAlong = along;
        vHeight = position.y / uHalfH;`,
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
        isFin
          ? /* glsl */ `#include <color_fragment>
          vec3 c; float a;
          ${spec.fins}
          diffuseColor.rgb = c;
          diffuseColor.a *= a;`
          : /* glsl */ `#include <color_fragment>
          vec3 c;
          ${spec.body}
          diffuseColor.rgb = c;`,
      );
  };
  return material;
}

function environmentMap(renderer) {
  // Soft top-lit tank environment so metallic bodies pick up plausible reflections.
  const envScene = new THREE.Scene();
  envScene.add(
    new THREE.Mesh(
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
    ),
  );
  return new THREE.PMREMGenerator(renderer).fromScene(envScene, 0.02).texture;
}

const rand = (a, b) => THREE.MathUtils.randFloat(a, b);
const randIn = (box) =>
  new THREE.Vector3(
    rand(box.min[0], box.max[0]),
    rand(box.min[1], box.max[1]),
    rand(box.min[2], box.max[2]),
  );

class Group {
  constructor(spec) {
    this.spec = spec;
    this.fish = Array.from({ length: spec.count }, () => {
      const pos = randIn(spec.box);
      const heading = new THREE.Vector3(1, 0, 0).applyAxisAngle(worldUp, Math.random() * 6.28);
      return {
        pos,
        vel: heading.clone().multiplyScalar(spec.cruise),
        heading,
        target: randIn(spec.box),
        timer: rand(0, 5),
        scale: rand(...spec.scale),
        phase: Math.random() * Math.PI * 2,
        fear: 0,
      };
    });
    this.goal = randIn(spec.box);
    this.goalTimer = 0;
  }

  // ---- shared helpers
  flee(f, cursor, acc, strength) {
    if (!cursor) return;
    const away = new THREE.Vector3().subVectors(f.pos, cursor);
    away.z = 0;
    const d = away.length();
    const R = this.spec.fleeRadius;
    if (d < R) {
      f.fear = Math.max(f.fear, 1 - d / R);
      acc.addScaledVector(away.normalize(), strength * (1 - d / R));
    }
  }

  walls(f, acc, k = 8) {
    const { min, max } = this.spec.box;
    ['x', 'y', 'z'].forEach((axis, i) => {
      if (f.pos[axis] < min[i]) acc[axis] += (min[i] - f.pos[axis]) * k;
      if (f.pos[axis] > max[i]) acc[axis] -= (f.pos[axis] - max[i]) * k;
    });
  }

  integrate(f, acc, dt, maxAcc) {
    const s = this.spec;
    acc.clampLength(0, maxAcc);
    f.vel.addScaledVector(acc, dt);
    f.vel.y *= 1 - 1.2 * dt; // fish swim level; damp climbing and diving
    const top = s.maxSpeed + (s.fleeSpeed - s.maxSpeed) * f.fear;
    const speed = f.vel.length();
    if (speed > top) f.vel.multiplyScalar(top / speed);
    f.pos.addScaledVector(f.vel, dt);
  }

  // ---- behaviors
  school(dt, cursor) {
    const s = this.spec;
    this.goalTimer -= dt;
    if (this.goalTimer <= 0) {
      this.goal = randIn(s.box);
      this.goalTimer = rand(7, 14);
    }
    const acc = new THREE.Vector3();
    const align = new THREE.Vector3();
    const center = new THREE.Vector3();
    const sep = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    for (const f of this.fish) {
      acc.set(0, 0, 0);
      align.set(0, 0, 0);
      center.set(0, 0, 0);
      sep.set(0, 0, 0);
      let n = 0;
      for (const o of this.fish) {
        if (o === f) continue;
        const d = f.pos.distanceTo(o.pos);
        if (d < s.neighbor) {
          align.add(o.vel);
          center.add(o.pos);
          n++;
          if (d < s.personal) sep.add(tmp.subVectors(f.pos, o.pos).divideScalar(d * d + 1e-6));
          // Panic spreads through the school.
          if (d < s.neighbor * 0.8) f.fear = Math.max(f.fear, o.fear * 0.75);
        }
      }
      if (n > 0) {
        acc.addScaledVector(align.divideScalar(n).sub(f.vel), 0.9);
        acc.addScaledVector(center.divideScalar(n).sub(f.pos), 0.3);
      }
      acc.addScaledVector(sep, 0.0015);
      acc.addScaledVector(tmp.subVectors(this.goal, f.pos), 0.03);
      this.flee(f, cursor, acc, 3.0);
      f.fear = Math.max(0, f.fear - dt);
      this.walls(f, acc);
      this.integrate(f, acc, dt, 0.25 + f.fear * 2.5);
      const speed = f.vel.length();
      if (speed < s.cruise * 0.4) f.vel.multiplyScalar((s.cruise * 0.4) / Math.max(speed, 1e-5));
    }
  }

  // Slow, deliberate cruising between waypoints; keeps its distance from others of its kind.
  solitary(dt, cursor) {
    const s = this.spec;
    const acc = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    for (const f of this.fish) {
      f.timer -= dt;
      if (f.timer <= 0 || f.pos.distanceTo(f.target) < 0.04) {
        // Cruise mostly along the tank (side-on to the viewer), changing depth only a little.
        f.target = randIn(s.box);
        f.target.z = THREE.MathUtils.clamp(f.pos.z + rand(-0.03, 0.03), s.box.min[2], s.box.max[2]);
        f.timer = rand(10, 20);
      }
      acc.subVectors(f.target, f.pos).setLength(s.cruise).sub(f.vel).multiplyScalar(0.5);
      for (const o of this.fish) {
        if (o === f) continue;
        const d = f.pos.distanceTo(o.pos);
        if (d < s.personal)
          acc.addScaledVector(
            tmp.subVectors(f.pos, o.pos).normalize(),
            0.05 * (1 - d / s.personal),
          );
      }
      this.flee(f, cursor, acc, 0.6);
      f.fear = Math.max(0, f.fear - dt * 0.5);
      this.walls(f, acc, 3);
      this.integrate(f, acc, dt, s.maxAccel + f.fear * 0.3);
    }
  }

  // Corydoras: shuffle along the gravel, stop to root around, scoot on; dart away when startled.
  bottom(dt, cursor) {
    const s = this.spec;
    const acc = new THREE.Vector3();
    for (const f of this.fish) {
      f.timer -= dt;
      const moving = f.timer > 0 && !f.resting;
      if (f.timer <= 0) {
        f.resting = !f.resting;
        if (f.resting) {
          f.timer = rand(1.5, 4.5);
        } else {
          f.target = randIn(s.box);
          f.timer = rand(2, 5);
        }
      }
      acc.set(0, 0, 0);
      if (moving) {
        const to = new THREE.Vector3().subVectors(f.target, f.pos);
        to.y = 0;
        acc.add(
          to
            .setLength(s.cruise)
            .sub(new THREE.Vector3(f.vel.x, 0, f.vel.z))
            .multiplyScalar(2),
        );
      } else {
        f.vel.multiplyScalar(1 - 4 * dt); // settle
      }
      this.flee(f, cursor, acc, 2.0);
      if (f.fear > 0.3) f.resting = false;
      f.fear = Math.max(0, f.fear - dt * 1.5);
      this.walls(f, acc, 6);
      this.integrate(f, acc, dt, 0.15 + f.fear * 2);
      f.pos.y = floorY(f.pos.z) + 0.006 * f.scale;
      f.vel.y = 0;
    }
  }

  update(dt, cursor) {
    this[this.spec.behavior](dt, cursor);
  }
}

export function createFish(scene, renderer, pointer) {
  const envMap = environmentMap(renderer);
  const loader = new GLTFLoader();
  const groups = SPECIES.map((spec) => {
    const group = new Group(spec);
    loader.load(`./models/${spec.name}.glb`, (gltf) => {
      const bodyGeo = gltf.scene.getObjectByName('Body').geometry;
      const finGeo = gltf.scene.getObjectByName('Fins').geometry;
      bodyGeo.computeBoundingBox();
      finGeo.computeBoundingBox();
      const nose = bodyGeo.boundingBox.max.z;
      const dims = {
        nose,
        length: nose - Math.min(finGeo.boundingBox.min.z, bodyGeo.boundingBox.min.z),
        halfH: bodyGeo.boundingBox.max.y,
      };
      const phase = new THREE.InstancedBufferAttribute(new Float32Array(spec.count), 1);
      const amp = new THREE.InstancedBufferAttribute(new Float32Array(spec.count), 1);
      for (const geo of [bodyGeo, finGeo]) {
        geo.setAttribute('aPhase', phase);
        geo.setAttribute('aAmp', amp);
      }
      group.body = new THREE.InstancedMesh(
        bodyGeo,
        fishMaterial(spec, envMap, dims, false),
        spec.count,
      );
      group.fins = new THREE.InstancedMesh(
        finGeo,
        fishMaterial(spec, envMap, dims, true),
        spec.count,
      );
      for (const m of [group.body, group.fins]) {
        m.frustumCulled = false;
        scene.add(m);
      }
    });
    return group;
  });

  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const scaleM = new THREE.Matrix4();

  return (dt) => {
    for (const g of groups) {
      g.update(dt, pointer.position);
      if (!g.body) continue;
      const s = g.spec;
      const phaseAttr = g.body.geometry.getAttribute('aPhase');
      const ampAttr = g.body.geometry.getAttribute('aAmp');
      g.fish.forEach((f, i) => {
        const speed = f.vel.length();
        // Keep the last heading when (nearly) stopped, e.g. a resting cory.
        if (speed > 0.004)
          f.heading.lerp(fwd.copy(f.vel).divideScalar(speed), Math.min(1, dt * 8)).normalize();
        fwd.copy(f.heading);
        const maxPitch = s.maxPitch ?? 0.35;
        fwd.y = THREE.MathUtils.clamp(fwd.y, -maxPitch, maxPitch);
        if (s.behavior === 'bottom') fwd.y = f.resting ? -0.25 : -0.08; // nose down to root in the gravel
        fwd.normalize();
        right.crossVectors(worldUp, fwd).normalize();
        up.crossVectors(fwd, right);
        m.makeBasis(right, up, fwd)
          .multiply(scaleM.makeScale(f.scale, f.scale, f.scale))
          .setPosition(f.pos);
        g.body.setMatrixAt(i, m);
        g.fins.setMatrixAt(i, m);

        const effort = speed / s.cruise;
        f.phase += dt * (s.beat[0] + s.beat[1] * Math.min(effort, 5)) * (f.resting ? 0.3 : 1);
        phaseAttr.array[i] = f.phase;
        ampAttr.array[i] = s.amp * (0.6 + 0.4 * Math.min(effort, 3)) * (f.resting ? 0.3 : 1);
      });
      g.body.instanceMatrix.needsUpdate = true;
      g.fins.instanceMatrix.needsUpdate = true;
      phaseAttr.needsUpdate = true;
      ampAttr.needsUpdate = true;
    }
  };
}
