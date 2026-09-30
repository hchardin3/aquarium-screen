import * as THREE from 'three';

// Tracks the cursor projected onto the z=0 swim plane. On the desktop window, events only
// arrive while the cursor is over bare wallpaper; `position` is null otherwise.
export function createPointer(camera, element) {
  const state = { position: null };
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const ndc = new THREE.Vector2();
  const hit = new THREE.Vector3();

  element.addEventListener('pointermove', (e) => {
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    state.position = raycaster.ray.intersectPlane(plane, hit) ? hit.clone() : null;
  });
  element.addEventListener('pointerleave', () => {
    state.position = null;
  });

  return state;
}
