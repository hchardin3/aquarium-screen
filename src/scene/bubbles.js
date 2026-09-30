import * as THREE from 'three';
import { TANK } from './tank.js';

const COUNT = 120;
const EMITTERS = [
  [-0.75, -0.2],
  [0.6, -0.35],
];

// Air-stone bubble streams: instanced spheres that rise, wobble and speed up.
export function createBubbles(scene) {
  // Underwater bubbles read as a bright rim (total internal reflection) with a clear center.
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying float vRim;
      void main() {
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        vRim = 1.0 - abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vRim;
      void main() {
        float a = pow(vRim, 2.5) * 0.9 + 0.05;
        gl_FragColor = vec4(vec3(0.85, 0.97, 1.0), a);
      }
    `,
  });
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), material, COUNT);
  scene.add(mesh);

  const top = TANK.floorY + TANK.height;
  const bubbles = Array.from({ length: COUNT }, (_, i) => spawn(i, Math.random() * TANK.height));

  function spawn(i, height = 0) {
    const [x, z] = EMITTERS[i % EMITTERS.length];
    return {
      x,
      z,
      y: TANK.floorY + height,
      r: 0.002 + Math.random() * 0.005,
      speed: 0.12 + Math.random() * 0.1,
      phase: Math.random() * Math.PI * 2,
    };
  }

  const m = new THREE.Matrix4();
  return (dt, t) => {
    for (let i = 0; i < COUNT; i++) {
      const b = bubbles[i];
      b.y += b.speed * dt;
      b.speed += 0.02 * dt;
      if (b.y > top) bubbles[i] = spawn(i);
      const wobble = Math.sin(t * 6 + b.phase) * 0.006;
      m.makeScale(b.r, b.r * 0.85, b.r);
      m.setPosition(b.x + wobble, b.y, b.z + wobble * 0.5);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
}
