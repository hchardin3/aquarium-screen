import * as THREE from 'three';

// Far water volume: vertical light falloff plus slowly drifting light shafts.
export function createBackdrop(scene) {
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFog: { value: scene.fog.color } },
    depthWrite: false,
    depthTest: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uFog;
      varying vec2 vUv;
      void main() {
        vec3 deep = vec3(0.004, 0.035, 0.05);
        vec3 shallow = vec3(0.06, 0.32, 0.40);
        vec3 col = mix(deep, shallow, pow(vUv.y, 1.6));

        // Light shafts: slanted bands that fade with depth.
        float x = vUv.x + (1.0 - vUv.y) * 0.25;
        float rays = sin(x * 13.0 + uTime * 0.15) * sin(x * 21.0 - uTime * 0.11) * 0.5 + 0.5;
        rays = pow(rays, 6.0) * smoothstep(0.1, 1.0, vUv.y);
        col += vec3(0.25, 0.45, 0.45) * rays * 0.35;

        // Below the horizon the floor fades into fog; match it exactly so there is no seam.
        col = mix(uFog, col, smoothstep(0.5, 0.75, vUv.y));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });

  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), material);
  // Drawn first behind everything; v=0.5 lines up with the horizon (camera at y=0).
  backdrop.position.z = -5;
  backdrop.renderOrder = -1;
  scene.add(backdrop);

  return (_dt, t) => {
    material.uniforms.uTime.value = t;
  };
}
