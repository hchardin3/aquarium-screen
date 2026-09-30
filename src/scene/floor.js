import * as THREE from 'three';
import { TANK } from './tank.js';

// Sand floor lit by animated caustics injected into a standard PBR material.
export function createFloor(scene) {
  const uniforms = { uTime: { value: 0 } };
  const material = new THREE.MeshStandardMaterial({ color: 0xc8b28a, roughness: 1 });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform float uTime;
        varying vec3 vWorldPos;
        // Iterated domain-warp caustic pattern.
        float caustic(vec2 uv, float t) {
          vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
          vec2 i = p;
          float c = 1.0;
          for (int n = 0; n < 4; n++) {
            float tt = t * (1.0 - (3.5 / float(n + 1)));
            i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
            c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / 0.005), p.y / (cos(i.y + tt) / 0.005)));
          }
          c = 1.17 - pow(c / 4.0, 1.4);
          return pow(abs(c), 8.0);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        float cst = caustic(vWorldPos.xz * 0.9, uTime * 0.35);
        totalEmissiveRadiance += diffuseColor.rgb * vec3(0.55, 0.85, 0.9) * cst * 0.9;`,
      );
  };

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30, 1, 1), material);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, TANK.floorY, -12);
  scene.add(floor);

  return (_dt, t) => {
    uniforms.uTime.value = t;
  };
}
