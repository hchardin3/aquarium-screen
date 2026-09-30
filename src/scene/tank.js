// Meters, Three.js axes. Must match the camera in assets/src/aquascape.py (Blender (x, y, z) ->
// Three (x, z, -y)), otherwise the live fish won't sit in the pre-rendered tank.
export const CAMERA = { fovY: 35, z: 0.95 };

// Box the fish school swims in: in front of the back plants, behind the front rocks.
export const SWIM = {
  min: { x: -0.4, y: -0.16, z: -0.12 },
  max: { x: 0.4, y: 0.22, z: 0.18 },
};

// Floor level in front (for bubbles).
export const FLOOR_Y = -0.25;
