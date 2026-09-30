"""Small schooling tetra (silver body, forked tail), about 3.5 cm long.

Species reference: generic silver tetra / rummy-nose-like body plan (slender fusiform body,
body depth about 1/3.5 of length, deeply forked caudal fin, triangular dorsal, long low anal
fin). Pattern and color are done in the Three.js shader from object-space position, so the
glTF carries geometry only.

Output meshes: "Body" (closed, smooth) and "Fins" (thin, double-sided in the renderer).
Modeled facing Blender -Y with Z up, so it faces glTF/Three.js +Z with +Y up.

Run: blender -b --factory-startup -P assets/src/tetra.py
"""

import math
import os

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "models", "tetra.glb")

BODY_LEN = 0.027
HALF_H = 0.0040
RING = 16
SECTIONS = 22
NOSE_Y = -BODY_LEN / 2
TAIL_Y = BODY_LEN / 2


def profile(t):
    """Half-height factor along the body (0 = nose, 1 = caudal peduncle)."""
    return math.sin(math.pi * (0.03 + 0.93 * t)) ** 0.75


def body_y(t):
    return NOSE_Y + BODY_LEN * t


def body_mesh():
    verts, faces = [], []
    verts.append((0.0, NOSE_Y - 0.0008, 0.0))  # nose tip
    for s in range(1, SECTIONS + 1):
        t = s / SECTIONS
        h = HALF_H * profile(t)
        w = h * 0.42
        zc = 0.0006 * math.sin(math.pi * t)  # slight dorsal arch
        for k in range(RING):
            a = 2 * math.pi * k / RING
            verts.append((w * math.cos(a), body_y(t), zc + h * math.sin(a)))
    for k in range(RING):
        faces.append((0, 1 + (k + 1) % RING, 1 + k))
    for s in range(SECTIONS - 1):
        a0, a1 = 1 + s * RING, 1 + (s + 1) * RING
        for k in range(RING):
            k1 = (k + 1) % RING
            faces.append((a0 + k, a0 + k1, a1 + k1, a1 + k))
    last = 1 + (SECTIONS - 1) * RING
    verts.append((0.0, TAIL_Y + 0.0004, 0.0))
    cap = len(verts) - 1
    for k in range(RING):
        faces.append((last + k, last + (k + 1) % RING, cap))
    return verts, faces


def fins_mesh():
    verts, faces = [], []

    def tri_fan(points, tris):
        base = len(verts)
        verts.extend(points)
        faces.extend(tuple(base + i for i in t) for t in tris)

    # Forked caudal fin, subdivided along its length so the swim wave bends it smoothly.
    ped = HALF_H * profile(1.0)
    tail_len, spread = 0.0095, 0.0048
    rows = 4
    pts = []
    for r in range(rows + 1):
        f = r / rows
        y = TAIL_Y + tail_len * f
        top = ped + (spread - ped) * f
        pts += [(0.0, y, top), (0.0, y, 0.0), (0.0, y, -top)]
    tris = []
    for r in range(rows):
        a, b = 3 * r, 3 * (r + 1)
        tris += [(a, b, b + 1), (a, b + 1, a + 1), (a + 1, b + 1, b + 2), (a + 1, b + 2, a + 2)]
    # Pull the centre of the trailing rows forward to cut the fork.
    for r in range(rows + 1):
        f = r / rows
        x, y, z = pts[3 * r + 1]
        pts[3 * r + 1] = (x, TAIL_Y + tail_len * min(f, 0.45 + 0.1 * f), z)
    tri_fan(pts, tris)

    # Dorsal fin
    t0, t1 = 0.42, 0.58
    h0, h1 = HALF_H * profile(t0), HALF_H * profile(t1)
    tri_fan(
        [(0, body_y(t0), h0 * 0.9), (0, body_y(t1), h1 * 0.9), (0, body_y(0.5), HALF_H + 0.0042)],
        [(0, 1, 2)],
    )
    # Anal fin: long and low
    t0, t1 = 0.58, 0.86
    h0, h1 = HALF_H * profile(t0), HALF_H * profile(t1)
    tri_fan(
        [(0, body_y(t0), -h0 * 0.9), (0, body_y(t1), -h1 * 0.9), (0, body_y(0.8), -HALF_H - 0.0022)],
        [(0, 2, 1)],
    )
    # Pectoral fins: small, angled out behind the gill
    for side in (1, -1):
        y = body_y(0.24)
        x = HALF_H * profile(0.24) * 0.42 * side
        tri_fan(
            [(x, y, -0.0012), (x, y + 0.0012, -0.0016), (x + side * 0.0028, y + 0.0042, -0.0024)],
            [(0, 1, 2)],
        )
    return verts, faces


def make(name, data, smooth):
    me = bpy.data.meshes.new(name)
    me.from_pydata(data[0], [], data[1])
    me.validate()
    if smooth:
        me.shade_smooth()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    make("Body", body_mesh(), smooth=True)
    make("Fins", fins_mesh(), smooth=False)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_yup=True, export_apply=True)
    print("wrote", OUT)


main()
