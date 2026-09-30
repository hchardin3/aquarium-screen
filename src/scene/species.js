// Species: model, look (GLSL pattern snippets) and behavior parameters. Units: meters, seconds.
//
// Pattern snippets run in the fragment shader with:
//   vAlong  0 at the nose .. 1 at the tail-fin tip
//   vHeight -1 belly .. 1 back (body half-height), > 1 on dorsal fins, < -1 on ventral fins
// Body snippets set `vec3 c` (albedo) and may add to `totalEmissiveRadiance`; fin snippets set
// `vec3 c` and `float a` (alpha).

const EYE = /* glsl */ `
  c *= 1.0 - 0.85 * smoothstep(0.32, 0.18, length(vec2((vAlong - EYE_AT) * 9.0, vHeight - 0.2)));
`;

export const SPECIES = [
  {
    name: 'silver_tetra',
    count: 36,
    scale: [0.85, 1.15],
    behavior: 'school',
    box: { min: [-0.4, -0.04, -0.12], max: [0.4, 0.22, 0.16] },
    cruise: 0.05,
    maxSpeed: 0.09,
    fleeSpeed: 0.25,
    fleeRadius: 0.1,
    neighbor: 0.07,
    personal: 0.032,
    beat: [7, 9],
    amp: 0.045,
    material: { metalness: 0.55, roughness: 0.32 },
    body: /* glsl */ `
      vec3 back = vec3(0.30, 0.32, 0.26);
      vec3 flank = vec3(0.78, 0.80, 0.80);
      vec3 belly = vec3(0.95, 0.93, 0.88);
      c = mix(flank, back, smoothstep(0.15, 0.75, vHeight));
      c = mix(c, belly, smoothstep(-0.2, -0.8, vHeight));
      float stripe = exp(-pow((vHeight - 0.12) / 0.14, 2.0))
                   * smoothstep(0.18, 0.35, vAlong) * smoothstep(0.78, 0.6, vAlong);
      c = mix(c, vec3(0.35, 0.75, 0.85), stripe * 0.65);
      #define EYE_AT 0.06
      ${EYE}`,
    fins: /* glsl */ `
      c = vec3(0.9, 0.88, 0.82);
      a = mix(0.55, 0.25, smoothstep(0.7, 1.0, vAlong));`,
  },
  {
    name: 'cardinal_tetra',
    count: 40,
    scale: [0.85, 1.1],
    behavior: 'school',
    box: { min: [-0.38, -0.16, -0.1], max: [0.38, 0.06, 0.16] },
    cruise: 0.045,
    maxSpeed: 0.08,
    fleeSpeed: 0.24,
    fleeRadius: 0.1,
    neighbor: 0.06,
    personal: 0.026,
    beat: [8, 10],
    amp: 0.045,
    material: { metalness: 0.3, roughness: 0.35 },
    body: /* glsl */ `
      vec3 back = vec3(0.22, 0.20, 0.14);
      vec3 red = vec3(0.78, 0.07, 0.05);
      vec3 blue = vec3(0.08, 0.55, 1.0);
      c = mix(red, back, smoothstep(0.45, 0.7, vHeight));
      c = mix(c, vec3(0.85, 0.75, 0.72), smoothstep(-0.75, -0.95, vHeight) * 0.4);
      // Iridescent neon stripe from eye to adipose; it glows slightly in the dim tank.
      float stripe = smoothstep(0.2, 0.08, abs(vHeight - 0.3))
                   * smoothstep(0.06, 0.12, vAlong) * smoothstep(0.66, 0.56, vAlong);
      c = mix(c, blue, stripe);
      totalEmissiveRadiance += blue * stripe * 0.35;
      #define EYE_AT 0.06
      ${EYE}`,
    fins: /* glsl */ `
      c = vec3(0.9, 0.85, 0.8);
      a = 0.3;`,
  },
  {
    name: 'angelfish',
    count: 3,
    scale: [0.85, 1.1],
    behavior: 'solitary',
    box: { min: [-0.3, -0.06, -0.1], max: [0.3, 0.16, 0.1] },
    cruise: 0.03,
    maxSpeed: 0.05,
    fleeSpeed: 0.13,
    fleeRadius: 0.14,
    maxAccel: 0.06,
    personal: 0.12,
    beat: [3, 4],
    amp: 0.03,
    maxPitch: 0.15,
    material: { metalness: 0.35, roughness: 0.4 },
    body: /* glsl */ `
      c = mix(vec3(0.82, 0.82, 0.76), vec3(0.62, 0.56, 0.40), smoothstep(0.2, 0.9, vHeight));
      // Vertical bars: through the eye, mid-body, and the tail base.
      float bars = smoothstep(0.045, 0.02, abs(vAlong - 0.09))
                 + smoothstep(0.045, 0.02, abs(vAlong - 0.33))
                 + 0.8 * smoothstep(0.035, 0.015, abs(vAlong - 0.58));
      c = mix(c, vec3(0.05, 0.05, 0.05), clamp(bars, 0.0, 1.0) * 0.85);
      #define EYE_AT 0.05
      ${EYE}`,
    fins: /* glsl */ `
      c = vec3(0.78, 0.77, 0.70);
      float bars = smoothstep(0.03, 0.012, abs(vAlong - 0.33)) + smoothstep(0.03, 0.01, abs(vAlong - 0.58));
      c = mix(c, vec3(0.05), clamp(bars, 0.0, 1.0) * 0.8);
      // Dark leading edge on the sails
      c *= 1.0 - 0.6 * smoothstep(1.6, 2.4, abs(vHeight));
      a = mix(0.8, 0.45, smoothstep(2.0, 3.2, abs(vHeight)));`,
  },
  {
    name: 'panda_cory',
    count: 5,
    scale: [0.9, 1.1],
    behavior: 'bottom',
    box: { min: [-0.3, -0.25, 0.02], max: [0.3, -0.2, 0.12] },
    cruise: 0.022,
    maxSpeed: 0.03,
    fleeSpeed: 0.18,
    fleeRadius: 0.09,
    beat: [9, 6],
    amp: 0.03,
    material: { metalness: 0.15, roughness: 0.5 },
    body: /* glsl */ `
      c = mix(vec3(0.84, 0.78, 0.71), vec3(0.70, 0.62, 0.52), smoothstep(0.2, 0.9, vHeight));
      float mask = smoothstep(0.02, 0.0, abs(vAlong - 0.1) - 0.045);            // eye mask
      mask += smoothstep(0.02, 0.0, abs(vAlong - 0.36) - 0.07) * smoothstep(0.2, 0.5, vHeight); // dorsal patch
      mask += smoothstep(0.015, 0.0, abs(vAlong - 0.71) - 0.03);               // tail spot
      c = mix(c, vec3(0.04, 0.035, 0.03), clamp(mask, 0.0, 1.0));`,
    fins: /* glsl */ `
      c = vec3(0.85, 0.8, 0.75);
      // Black first dorsal
      c = mix(c, vec3(0.05), step(1.0, vHeight) * step(vAlong, 0.5));
      a = 0.6;`,
  },
];
