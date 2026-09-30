import * as THREE from 'three';

const COUNT = 260;

// Suspended specks drifting in the water column; they sell the volume between camera and plants.
export function createParticles(scene) {
  const positions = new Float32Array(COUNT * 3);
  const seeds = [];
  for (let i = 0; i < COUNT; i++) {
    positions.set(
      [
        THREE.MathUtils.randFloat(-0.6, 0.6),
        THREE.MathUtils.randFloat(-0.25, 0.32),
        THREE.MathUtils.randFloat(-0.2, 0.45),
      ],
      i * 3,
    );
    seeds.push(Math.random() * 100);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);

  const material = new THREE.PointsMaterial({
    size: 0.0018,
    map: new THREE.CanvasTexture(canvas),
    color: 0xd8e6c4,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  scene.add(new THREE.Points(geometry, material));

  return (dt, t) => {
    for (let i = 0; i < COUNT; i++) {
      const s = seeds[i];
      positions[i * 3] += Math.sin(t * 0.13 + s) * 0.0015 * dt;
      positions[i * 3 + 1] += (Math.sin(t * 0.09 + s * 1.3) * 0.002 - 0.0006) * dt;
      positions[i * 3 + 2] += Math.cos(t * 0.11 + s) * 0.0012 * dt;
      if (positions[i * 3 + 1] < -0.25) positions[i * 3 + 1] = 0.32;
    }
    geometry.attributes.position.needsUpdate = true;
  };
}
