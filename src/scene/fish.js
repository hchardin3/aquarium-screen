import * as THREE from 'three';
import { TANK } from './tank.js';

const COUNT = 10;
const FLEE_RADIUS = 0.3;

// PLACEHOLDER fish: primitive bodies with steering (wander, keep in tank, flee cursor).
// Replace the mesh with glTF models from the fish-asset pipeline; keep the steering.
export function createFish(scene, pointer) {
  const fish = Array.from({ length: COUNT }, () => {
    const size = 0.07 + Math.random() * 0.06;
    const body = placeholderMesh(size);
    scene.add(body.group);
    return {
      ...body,
      pos: randomPoint(),
      vel: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).setLength(0.1),
      target: randomPoint(),
      cruise: 0.08 + Math.random() * 0.05,
      phase: Math.random() * Math.PI * 2,
    };
  });

  const steer = new THREE.Vector3();
  const away = new THREE.Vector3();
  const lookAt = new THREE.Vector3();

  return (dt, t) => {
    for (const f of fish) {
      if (f.pos.distanceTo(f.target) < 0.1 || Math.random() < 0.002) f.target = randomPoint();

      steer.subVectors(f.target, f.pos).setLength(f.cruise).sub(f.vel).multiplyScalar(0.8);
      let maxSpeed = f.cruise;

      if (pointer.position) {
        away.subVectors(f.pos, pointer.position);
        const d = away.length();
        if (d < FLEE_RADIUS) {
          const urgency = 1 - d / FLEE_RADIUS;
          steer.add(away.setLength(1.5 * urgency));
          maxSpeed = f.cruise * (1 + 4 * urgency);
        }
      }

      f.vel.addScaledVector(steer, dt).clampLength(0.01, maxSpeed);
      f.pos.addScaledVector(f.vel, dt);
      clampToTank(f.pos);

      f.group.position.copy(f.pos);
      f.group.lookAt(lookAt.addVectors(f.pos, f.vel));
      const beat = 6 + (f.vel.length() / f.cruise) * 6;
      f.tail.rotation.y = Math.sin(t * beat + f.phase) * 0.5;
    }
  };
}

function placeholderMesh(size) {
  const material = new THREE.MeshStandardMaterial({ color: 0xd98a3a, roughness: 0.45 });
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), material);
  body.scale.set(size * 0.18, size * 0.35, size * 0.5);
  group.add(body);

  const tail = new THREE.Group();
  tail.position.z = -size * 0.45;
  const fin = new THREE.Mesh(new THREE.ConeGeometry(size * 0.25, size * 0.35, 4), material);
  fin.rotation.x = Math.PI / 2;
  fin.scale.x = 0.2;
  fin.position.z = -size * 0.15;
  tail.add(fin);
  group.add(tail);

  return { group, tail };
}

function randomPoint() {
  return new THREE.Vector3(
    (Math.random() - 0.5) * TANK.width * 0.85,
    TANK.floorY + 0.15 + Math.random() * (TANK.height - 0.3),
    (Math.random() - 0.5) * TANK.depth,
  );
}

function clampToTank(p) {
  p.x = THREE.MathUtils.clamp(p.x, -TANK.width / 2, TANK.width / 2);
  p.y = THREE.MathUtils.clamp(p.y, TANK.floorY + 0.05, TANK.floorY + TANK.height - 0.05);
  p.z = THREE.MathUtils.clamp(p.z, -TANK.depth / 2, TANK.depth / 2);
}
