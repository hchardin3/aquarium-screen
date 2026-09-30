import * as THREE from 'three';

const fullscreenVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Iterated domain-warp caustic pattern, used as a light shimmer on lit surfaces.
const causticGlsl = /* glsl */ `
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
  }
`;

function fullscreenQuad(material, renderOrder) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  return mesh;
}

function loadTexture(loader, url) {
  const tex = loader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

// Pre-rendered aquascape (assets/src/aquascape.py). The back plate sways its plants using the
// sway mask and gets a caustic shimmer; the front plate is drawn over the fish.
export function createPlates(scene) {
  const loader = new THREE.TextureLoader();
  const uniforms = {
    uTime: { value: 0 },
    uBack: { value: loadTexture(loader, './plates/back.jpg') },
    uSway: { value: loader.load('./plates/sway.png') },
    uAspect: { value: window.innerWidth / window.innerHeight },
  };

  const back = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: fullscreenVertex,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uAspect;
      uniform sampler2D uBack;
      uniform sampler2D uSway;
      varying vec2 vUv;
      ${causticGlsl}
      void main() {
        // Blurred mask (mip bias) so edges bend instead of tearing.
        float plant = texture2D(uSway, vUv, 2.5).a;
        float wave = sin(uTime * 0.8 + vUv.x * 11.0 + vUv.y * 4.0)
                   + 0.5 * sin(uTime * 1.7 + vUv.x * 23.0);
        vec2 uv = vUv + vec2(wave * 0.0018 * plant * vUv.y, 0.0);
        vec3 col = texture2D(uBack, uv).rgb;

        float lum = dot(col, vec3(0.3, 0.59, 0.11));
        float c = caustic(vec2(vUv.x * uAspect, vUv.y) * 2.2 + vec2(0.0, uTime * 0.01), uTime * 0.25);
        col += col * c * 0.45 * smoothstep(0.015, 0.2, lum);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });

  const front = new THREE.ShaderMaterial({
    uniforms: { uFront: { value: loadTexture(loader, './plates/front.png') } },
    depthTest: false,
    depthWrite: false,
    transparent: true,
    vertexShader: fullscreenVertex,
    fragmentShader: /* glsl */ `
      uniform sampler2D uFront;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(uFront, vUv);
        #include <colorspace_fragment>
      }
    `,
  });

  scene.add(fullscreenQuad(back, -10));
  scene.add(fullscreenQuad(front, 10));

  window.addEventListener('resize', () => {
    uniforms.uAspect.value = window.innerWidth / window.innerHeight;
  });

  return (_dt, t) => {
    uniforms.uTime.value = t;
  };
}

// Soft slanted light shafts from the tank light, added over everything.
export function createLightRays(scene) {
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    depthTest: false,
    depthWrite: false,
    transparent: true,
    blending: THREE.AdditiveBlending,
    vertexShader: fullscreenVertex,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float x = vUv.x + (1.0 - vUv.y) * 0.18;
        float r = sin(x * 17.0 + uTime * 0.07) * sin(x * 29.0 - uTime * 0.05);
        r = pow(max(r, 0.0), 3.0) * smoothstep(0.15, 1.0, vUv.y);
        gl_FragColor = vec4(vec3(0.55, 0.7, 0.45) * r * 0.05, 1.0);
      }
    `,
  });
  scene.add(fullscreenQuad(material, 20));
  return (_dt, t) => {
    material.uniforms.uTime.value = t;
  };
}
