"""Fish models for the live wallpaper, one .glb per species, generated from body-plan parameters.

Species (reference body plans):
  silver_tetra   slender fusiform, forked caudal (generic silver/rummy-nose-type tetra), ~3.5 cm
  cardinal_tetra Paracheirodon axelrodi: small, slender, forked caudal, ~2.8 cm
  angelfish      Pterophyllum scalare: laterally compressed disc, long swept dorsal/anal sails,
                 lyre tail, filamentous ventral fins, ~11 cm with fins
  panda_cory     Corydoras panda: stout, flat belly, high back, tall first dorsal, adipose fin,
                 forked caudal, ~5 cm

Colors and patterns live in the Three.js shaders (src/scene/species.js); the glTF carries geometry
only: "Body" (closed, smooth) and "Fins" (thin, rendered double-sided).
Modeled facing Blender -Y with Z up, so each fish faces glTF/Three.js +Z with +Y up.

Run: blender -b --factory-startup -P assets/src/fish.py
"""

import math
import os

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "models")

RING = 16
SECTIONS = 22

SPECIES = {
    "silver_tetra": dict(
        length=0.027, half_h=0.0040, width=0.42, peak=0.45, fullness=0.75, arch=0.0006, belly=1.0,
        tail=dict(length=0.0095, spread=0.0048, fork=0.55),
        fins=[("top", 0.42, 0.58, 0.50, 0.0042), ("bottom", 0.58, 0.86, 0.80, 0.0022)],
        pectoral=0.0028,
    ),
    "cardinal_tetra": dict(
        length=0.021, half_h=0.0031, width=0.45, peak=0.42, fullness=0.8, arch=0.0004, belly=1.0,
        tail=dict(length=0.0072, spread=0.0036, fork=0.55),
        fins=[("top", 0.45, 0.58, 0.52, 0.0030), ("bottom", 0.60, 0.86, 0.80, 0.0017)],
        pectoral=0.002,
    ),
    "angelfish": dict(
        length=0.050, half_h=0.020, width=0.20, peak=0.40, fullness=0.6, arch=0.002, belly=1.0,
        tail=dict(length=0.020, spread=0.016, fork=0.25),
        # Long sails swept back past the tail base
        fins=[("top", 0.26, 0.95, 1.3, 0.048), ("bottom", 0.38, 0.95, 1.25, 0.042)],
        pectoral=0.006,
        filaments=dict(at=0.33, length=0.06),
    ),
    "panda_cory": dict(
        length=0.036, half_h=0.0070, width=0.75, peak=0.33, fullness=0.7, arch=0.0015, belly=0.45,
        tail=dict(length=0.011, spread=0.0062, fork=0.5),
        fins=[
            ("top", 0.30, 0.46, 0.40, 0.0085),  # tall first dorsal
            ("top", 0.80, 0.88, 0.86, 0.0018),  # adipose
            ("bottom", 0.70, 0.84, 0.82, 0.0030),
        ],
        pectoral=0.0075,
    ),
}


def make_profile(peak, fullness):
    # Warp t so the sine bump peaks at `peak`; fullness < 1 makes a deeper, rounder body.
    warp = math.log(0.5) / math.log(peak)
    return lambda t: math.sin(math.pi * (0.03 + 0.93 * min(t, 1.0) ** warp)) ** fullness


def build(p):
    L, H = p["length"], p["half_h"]
    nose, tail_y = -L / 2, L / 2
    prof = make_profile(p["peak"], p["fullness"])
    by = lambda t: nose + L * t  # noqa: E731
    zc = lambda t: p["arch"] * math.sin(math.pi * min(t, 1.0))  # noqa: E731

    # ---- body
    verts, faces = [(0.0, nose - L * 0.03, 0.0)], []
    for s in range(1, SECTIONS + 1):
        t = s / SECTIONS
        h = H * prof(t)
        w = h * p["width"]
        for k in range(RING):
            a = 2 * math.pi * k / RING
            sa = math.sin(a)
            z = zc(t) + h * sa * (p["belly"] if sa < 0 else 1.0)
            verts.append((w * math.cos(a), by(t), z))
    for k in range(RING):
        faces.append((0, 1 + (k + 1) % RING, 1 + k))
    for s in range(SECTIONS - 1):
        a0, a1 = 1 + s * RING, 1 + (s + 1) * RING
        for k in range(RING):
            k1 = (k + 1) % RING
            faces.append((a0 + k, a0 + k1, a1 + k1, a1 + k))
    last = 1 + (SECTIONS - 1) * RING
    verts.append((0.0, tail_y + L * 0.015, zc(1.0)))
    cap = len(verts) - 1
    for k in range(RING):
        faces.append((last + k, last + (k + 1) % RING, cap))
    body = (verts, faces)

    # ---- fins
    fv, ff = [], []

    def add(points, tris):
        base = len(fv)
        fv.extend(points)
        ff.extend(tuple(base + i for i in t) for t in tris)

    # Caudal: rows along the length so the swim wave bends it; the fork pulls the centre forward.
    tl, spread, fork = p["tail"]["length"], p["tail"]["spread"], p["tail"]["fork"]
    ped = H * prof(1.0)
    rows, pts, tris = 4, [], []
    for r in range(rows + 1):
        f = r / rows
        top = ped + (spread - ped) * f
        mid_y = tail_y + tl * min(f, (1 - fork) + fork * f * 0.2)
        pts += [(0.0, tail_y + tl * f, zc(1.0) + top), (0.0, mid_y, zc(1.0)), (0.0, tail_y + tl * f, zc(1.0) - top)]
    for r in range(rows):
        a, b = 3 * r, 3 * (r + 1)
        tris += [(a, b, b + 1), (a, b + 1, a + 1), (a + 1, b + 1, b + 2), (a + 1, b + 2, a + 2)]
    add(pts, tris)

    # Median fins: base along the body outline, tip possibly swept behind the base.
    for side, t0, t1, t_tip, height in p["fins"]:
        sgn = 1 if side == "top" else -1
        edge = lambda t: zc(t) + sgn * H * prof(t) * (p["belly"] if sgn < 0 else 1.0) * 0.92  # noqa: E731
        base_z_tip = edge(min(t_tip, 1.0))
        tip = (0.0, by(t_tip), base_z_tip + sgn * height)
        mid = (0.0, by((t0 + t1) / 2), edge((t0 + t1) / 2) + sgn * height * 0.55)
        # Fan from the leading base point: base0 -> mid -> tip -> base1 (rendered double-sided).
        add([(0.0, by(t0), edge(t0)), (0.0, by(t1), edge(t1)), mid, tip], [(0, 2, 3), (0, 3, 1)])

    # Pectorals: angled out and back behind the gill.
    ps = p["pectoral"]
    for sgn in (1, -1):
        t = 0.24
        x = H * prof(t) * p["width"] * sgn
        z = zc(t) - H * prof(t) * 0.35
        add([(x, by(t), z), (x, by(t) + ps * 0.45, z - ps * 0.15), (x + sgn * ps * 0.8, by(t) + ps, z - ps * 0.5)], [(0, 1, 2)])

    # Angelfish ventral filaments: long thin streamers hanging down and back.
    if "filaments" in p:
        t, fl = p["filaments"]["at"], p["filaments"]["length"]
        z0 = zc(t) - H * prof(t) * 0.9
        for sgn in (1, -1):
            x = sgn * 0.0012
            add(
                [(x, by(t), z0), (x, by(t) + 0.003, z0), (x, by(t) + fl * 0.45, z0 - fl * 0.9), (x, by(t) + fl * 0.43, z0 - fl * 0.9)],
                [(0, 1, 2), (0, 2, 3)],
            )
    return body, (fv, ff)


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
    os.makedirs(OUT, exist_ok=True)
    for name, params in SPECIES.items():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        body, fins = build(params)
        make("Body", body, smooth=True)
        make("Fins", fins, smooth=False)
        path = os.path.join(OUT, f"{name}.glb")
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_yup=True, export_apply=True)
        print("wrote", path)


main()
