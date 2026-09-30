import * as THREE from 'three';
import { FLOOR_Y } from './tank.js';

const COUNT = 70;
const TOP_Y = 0.34;
// Air stone hidden behind the front-left rock.
const EMITTER = new THREE.Vector3(-0.44, FLOOR_Y + 0.05, 0.02);

// Air-stone bubble stream: instanced spheres that rise, wobble and speed up.
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
        float a = pow(vRim, 2.5) * 0.8 + 0.04;
        gl_FragColor = vec4(vec3(0.85, 0.95, 0.85), a);
      }
    `,
  });
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), material, COUNT);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const spawn = (height = 0) => ({
    x: EMITTER.x + THREE.MathUtils.randFloatSpread(0.006),
    z: EMITTER.z + THREE.MathUtils.randFloatSpread(0.006),
    y: EMITTER.y + height,
    r: THREE.MathUtils.randFloat(0.0007, 0.0022),
    speed: THREE.MathUtils.randFloat(0.1, 0.16),
    phase: Math.random() * Math.PI * 2,
  });
  const bubbles = Array.from({ length: COUNT }, () => spawn(Math.random() * (TOP_Y - EMITTER.y)));

  const m = new THREE.Matrix4();
  return (dt, t) => {
    for (let i = 0; i < COUNT; i++) {
      const b = bubbles[i];
      b.y += b.speed * dt;
      b.speed += 0.03 * dt;
      if (b.y > TOP_Y) bubbles[i] = spawn();
      const wobble = Math.sin(t * 7 + b.phase) * 0.002;
      m.makeScale(b.r, b.r * 0.85, b.r);
      m.setPosition(b.x + wobble, b.y, b.z + wobble * 0.5);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
}
