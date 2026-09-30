"""Planted-tank background plates for the live wallpaper.

Renders, from the camera the Three.js scene uses (fov_y 35 deg, 0.95 m from tank center):
  public/plates/back.jpg   full aquascape
  public/plates/front.png  foreground rocks/plants only (RGBA), drawn over the live fish
  public/plates/sway.png   plant coverage in alpha, drives the live sway distortion

Style reference: dense Vallisneria-planted tank with a diagonal driftwood branch, dark
dragon-stone-like rocks, gravel, dark green background. Wood, rock and gravel use CC0 Poly Haven
scans (fetch first: python3 assets/src/fetch_textures.py); plants, moss and water are procedural.

Run: blender -b --factory-startup -P assets/src/aquascape.py -- [--preview] [--pass back,front,sway]
Blender axes: X right, Y away from camera, Z up. Three.js maps (x, y, z) -> (x, z, -y).
"""

import math
import os
import random
import sys

import bpy
from mathutils import Vector, noise

PREVIEW = "--preview" in sys.argv
ARGS = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
PASSES = ARGS[ARGS.index("--pass") + 1].split(",") if "--pass" in ARGS else ["back", "front", "sway"]
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "plates")
TEXTURES = os.path.join(ROOT, "assets", "textures")

FLOOR_Z = -0.25
CAM_DIST = 0.95
FOV_Y = 35.0

random.seed(7)


# ---------------------------------------------------------------- helpers


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def collection(name):
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


def mesh_object(name, verts, faces, col, smooth=True, colors=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    if smooth:
        me.shade_smooth()
    if colors is not None:
        attr = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
        for i, c in enumerate(colors):
            attr.data[i].color = (*c, 1.0)
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    return ob


def material(name):
    mat = bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except AttributeError:
        pass
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    return mat, nt, bsdf


def node(nt, idname, **inputs):
    n = nt.nodes.new(idname)
    for k, v in inputs.items():
        n.inputs[k].default_value = v
    return n


def link(nt, a, b):
    nt.links.new(a, b)


def ramp(nt, stops):
    r = nt.nodes.new("ShaderNodeValToRGB")
    els = r.color_ramp.elements
    while len(els) > 1:
        els.remove(els[-1])
    els[0].position, els[0].color = stops[0][0], (*stops[0][1], 1)
    for pos, col in stops[1:]:
        e = els.new(pos)
        e.color = (*col, 1)
    return r


def bump(nt, bsdf, height_socket, strength, distance=0.002):
    b = node(nt, "ShaderNodeBump", Strength=strength, Distance=distance)
    link(nt, height_socket, b.inputs["Height"])
    link(nt, b.outputs["Normal"], bsdf.inputs["Normal"])


# ---------------------------------------------------------------- materials


def plant_material(name, base, tip):
    """Leafy green with per-blade color variation (Col attribute) and backlit translucency."""
    mat, nt, bsdf = material(name)
    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "Col"
    bsdf.inputs["Roughness"].default_value = 0.45
    bsdf.inputs["Specular IOR Level"].default_value = 0.35
    # Col.r = per-blade tint, Col.g = height along blade (dark base, lighter tip)
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    link(nt, attr.outputs["Color"], sep.inputs["Color"])
    grad = ramp(nt, [(0.0, tuple(c * 0.35 for c in base)), (0.35, base), (1.0, tip)])
    link(nt, sep.outputs["Green"], grad.inputs["Fac"])
    tint = node(nt, "ShaderNodeHueSaturation")
    link(nt, grad.outputs["Color"], tint.inputs["Color"])
    vary = node(nt, "ShaderNodeMapRange")
    vary.inputs["To Min"].default_value = 0.75
    vary.inputs["To Max"].default_value = 1.25
    link(nt, sep.outputs["Red"], vary.inputs["Value"])
    link(nt, vary.outputs["Result"], tint.inputs["Value"])
    hue = node(nt, "ShaderNodeMapRange")
    hue.inputs["To Min"].default_value = 0.46
    hue.inputs["To Max"].default_value = 0.54
    link(nt, sep.outputs["Red"], hue.inputs["Value"])
    link(nt, hue.outputs["Result"], tint.inputs["Hue"])
    link(nt, tint.outputs["Color"], bsdf.inputs["Base Color"])

    trans = nt.nodes.new("ShaderNodeBsdfTranslucent")
    link(nt, tint.outputs["Color"], trans.inputs["Color"])
    mix = node(nt, "ShaderNodeMixShader", Fac=0.25)
    out = nt.nodes.get("Material Output")
    link(nt, bsdf.outputs["BSDF"], mix.inputs[1])
    link(nt, trans.outputs["BSDF"], mix.inputs[2])
    link(nt, mix.outputs["Shader"], out.inputs["Surface"])
    return mat


def pbr_material(name, texture, tile, value=1.0, saturation=1.0, bump_strength=0.6, rough_add=0.0, tint=None):
    """Photo-scanned CC0 texture (assets/textures/<texture>), box-projected in object space.

    tile: real-world size of one texture repeat, in meters.
    """
    mat, nt, bsdf = material(name)
    folder = os.path.join(TEXTURES, texture)
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = node(nt, "ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (1 / tile,) * 3
    link(nt, coord.outputs["Object"], mapping.inputs["Vector"])

    def image(kind, color):
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = bpy.data.images.load(os.path.join(folder, f"{kind}.jpg"))
        n.image.colorspace_settings.name = "sRGB" if color else "Non-Color"
        n.projection = "BOX"
        n.projection_blend = 0.35
        link(nt, mapping.outputs["Vector"], n.inputs["Vector"])
        return n

    diff = image("diff", True)
    grade = node(nt, "ShaderNodeHueSaturation", Value=value, Saturation=saturation)
    link(nt, diff.outputs["Color"], grade.inputs["Color"])
    if tint is not None:
        mul = nt.nodes.new("ShaderNodeMix")
        mul.data_type = "RGBA"
        mul.blend_type = "MULTIPLY"
        mul.inputs["Factor"].default_value = 1.0
        link(nt, grade.outputs["Color"], mul.inputs["A"])
        mul.inputs["B"].default_value = (*tint, 1)
        link(nt, mul.outputs["Result"], bsdf.inputs["Base Color"])
    else:
        link(nt, grade.outputs["Color"], bsdf.inputs["Base Color"])
    rough = image("rough", False)
    radd = nt.nodes.new("ShaderNodeMath")
    radd.operation = "ADD"
    radd.use_clamp = True
    radd.inputs[1].default_value = rough_add
    link(nt, rough.outputs["Color"], radd.inputs[0])
    link(nt, radd.outputs["Value"], bsdf.inputs["Roughness"])
    bump(nt, bsdf, image("disp", False).outputs["Color"], bump_strength, tile * 0.03)
    return mat


def wood_material():
    # Waterlogged driftwood: darker and warmer than dry willow.
    return pbr_material(
        "Driftwood", "bark_willow_02", 0.12, value=0.5, bump_strength=1.6, tint=(0.45, 0.27, 0.14)
    )


def rock_material():
    return pbr_material("Rock", "dark_rock", 0.25, value=0.45, bump_strength=0.9)


def gravel_material():
    # Aquarium gravel is finer than river pebbles: shrink the tile so stones read as 3-6 mm.
    return pbr_material("Gravel", "ganges_river_pebbles", 0.12, value=0.4, bump_strength=1.0, tint=(0.85, 0.72, 0.55))


def backdrop_material():
    mat, nt, bsdf = material("Backdrop")
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    link(nt, coord.outputs["Object"], sep.inputs["Vector"])
    grad = nt.nodes.new("ShaderNodeMapRange")
    grad.inputs["From Min"].default_value = -0.3
    grad.inputs["From Max"].default_value = 0.4
    link(nt, sep.outputs["Z"], grad.inputs["Value"])
    col = ramp(nt, [(0.0, (0.002, 0.006, 0.003)), (1.0, (0.012, 0.045, 0.022))])
    link(nt, grad.outputs["Result"], col.inputs["Fac"])
    bsdf.inputs["Base Color"].default_value = (0.0, 0.0, 0.0, 1)
    link(nt, col.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 1.0
    return mat


def water_material():
    mat = bpy.data.materials.new("Water")
    try:
        mat.use_nodes = True
    except AttributeError:
        pass
    nt = mat.node_tree
    nt.nodes.remove(nt.nodes.get("Principled BSDF"))
    vol = node(nt, "ShaderNodeVolumeAbsorption", Density=1.1)
    vol.inputs["Color"].default_value = (0.62, 0.86, 0.72, 1)
    link(nt, vol.outputs["Volume"], nt.nodes.get("Material Output").inputs["Volume"])
    return mat


# ---------------------------------------------------------------- geometry


def blades(specs, name, col, mat):
    """Ribbon leaves. Each spec: base, height, width, lean (vec2), facing angle, twist."""
    verts, faces, colors = [], [], []
    for s in specs:
        seg = s.get("segments", 12)
        tint = random.random()
        start = len(verts)
        for i in range(seg + 1):
            t = i / seg
            lx, ly = s["lean"]
            bend = t * t
            c = Vector(
                (
                    s["base"][0] + lx * bend * s["height"],
                    s["base"][1] + ly * bend * s["height"],
                    s["base"][2] + s["height"] * t * (1 - 0.35 * bend * math.hypot(lx, ly)),
                )
            )
            a = s["angle"] + s["twist"] * t
            w = s["width"] * (1 - t**3) * (0.7 + 0.3 * math.sin(math.pi * min(1, t * 1.3)))
            side = Vector((math.cos(a), math.sin(a), 0)) * (w / 2)
            verts += [tuple(c - side), tuple(c + side)]
            colors += [(tint, t, 0), (tint, t, 0)]
        for i in range(seg):
            a = start + 2 * i
            faces.append((a, a + 1, a + 3, a + 2))
    ob = mesh_object(name, verts, faces, col, colors=colors)
    ob.data.materials.append(mat)
    return ob


def substrate_height(x, y):
    slope = 0.07 * min(1, max(0, (y + 0.2) / 0.55)) ** 1.3
    return FLOOR_Z + slope + 0.012 * noise.noise(Vector((x * 6, y * 6, 0.3)))


def substrate(col):
    nx, ny = 240, 120
    x0, x1, y0, y1 = -1.0, 1.0, -0.4, 0.45
    verts, faces = [], []
    for j in range(ny + 1):
        for i in range(nx + 1):
            x = x0 + (x1 - x0) * i / nx
            y = y0 + (y1 - y0) * j / ny
            verts.append((x, y, substrate_height(x, y)))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    ob = mesh_object("Substrate", verts, faces, col)
    ob.data.materials.append(gravel_material())
    return ob


def rock(name, center, size, col, mat, seed):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=1.0)
    ob = bpy.context.active_object
    for c in ob.users_collection:
        c.objects.unlink(ob)
    col.objects.link(ob)
    ob.name = name
    # Craggy, taller-than-wide dragon-stone silhouette.
    ob.scale = (size * random.uniform(0.8, 1.1), size * random.uniform(0.6, 0.9), size * random.uniform(1.0, 1.4))
    ob.location = center
    ob.rotation_euler = (random.uniform(-0.3, 0.3), random.uniform(-0.3, 0.3), random.uniform(0, 6.28))
    for tex_type, scale, strength in (("VORONOI", 0.45, 0.45), ("CLOUDS", 0.2, 0.15)):
        tex = bpy.data.textures.new(f"{name}_{tex_type}", tex_type)
        tex.noise_scale = scale
        if tex_type == "CLOUDS":
            tex.noise_depth = 4
        m = ob.modifiers.new(tex_type, "DISPLACE")
        m.texture = tex
        m.strength = strength
        m.texture_coords = "LOCAL"
        tex.noise_scale = scale * (0.8 + 0.15 * seed)
    ob.data.shade_smooth()
    ob.data.materials.append(mat)
    return ob


def branch_points(p0, p1, bend, n=24):
    p0, p1, bend = Vector(p0), Vector(p1), Vector(bend)
    pts = []
    for i in range(n + 1):
        t = i / n
        p = p0.lerp(p1, t) + bend * math.sin(math.pi * t)
        p += Vector(noise.noise_vector(p * 12)) * 0.01
        pts.append(p)
    return pts


def driftwood(col):
    wood = wood_material()
    parts = []
    specs = [
        # trunk: upper-left down to lower-right, like the reference
        (branch_points((-0.55, 0.12, 0.42), (0.22, 0.02, FLOOR_Z + 0.02), (0.02, 0, 0.06)), 0.032, 0.022),
        (branch_points((-0.12, 0.08, 0.12), (0.30, 0.14, 0.30), (0, 0, 0.04)), 0.016, 0.004),
        (branch_points((0.05, 0.05, -0.06), (0.48, 0.10, 0.05), (0, 0, 0.05)), 0.014, 0.004),
        (branch_points((-0.30, 0.10, 0.24), (-0.52, 0.16, 0.05), (0, 0, 0.03)), 0.012, 0.003),
        (branch_points((0.18, 0.04, -0.19), (0.40, 0.00, -0.23), (0, 0, 0.02)), 0.018, 0.008),
        (branch_points((0.22, 0.12, 0.22), (0.36, 0.20, 0.38), (0, 0, 0.0)), 0.007, 0.002),
    ]
    for i, (pts, r0, r1) in enumerate(specs):
        cu = bpy.data.curves.new(f"Branch{i}", "CURVE")
        cu.dimensions = "3D"
        cu.bevel_depth = 1.0
        cu.bevel_resolution = 4
        cu.use_fill_caps = True
        sp = cu.splines.new("POLY")
        sp.points.add(len(pts) - 1)
        for k, p in enumerate(pts):
            t = k / (len(pts) - 1)
            sp.points[k].co = (*p, 1)
            sp.points[k].radius = (r0 + (r1 - r0) * t) * (1 + 0.35 * noise.noise(p * 25))
        ob = bpy.data.objects.new(f"Branch{i}", cu)
        col.objects.link(ob)
        parts.append(ob)

    for ob in parts:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.convert(target="MESH")
    bpy.ops.object.join()
    trunk = bpy.context.active_object
    trunk.name = "Driftwood"
    sub = trunk.modifiers.new("Subdiv", "SUBSURF")
    sub.levels = sub.render_levels = 1
    tex = bpy.data.textures.new("WoodDisp", "CLOUDS")
    tex.noise_scale = 0.02
    disp = trunk.modifiers.new("Disp", "DISPLACE")
    disp.texture = tex
    disp.strength = 0.012
    trunk.data.materials.clear()
    trunk.data.materials.append(wood)
    trunk.data.shade_smooth()
    return trunk


def vallisneria(n, xr, yr, hr, lean=0.25):
    specs = []
    for _ in range(n):
        x, y = random.uniform(*xr), random.uniform(*yr)
        h = random.uniform(*hr)
        specs.append(
            {
                "base": (x, y, substrate_height(x, y) - 0.005),
                "height": h,
                "width": random.uniform(0.004, 0.009),
                "lean": (random.gauss(0, lean), random.gauss(0, lean * 0.5)),
                "angle": random.uniform(0, math.pi),
                "twist": random.uniform(-2.5, 2.5),
                "segments": 14,
            }
        )
    return specs


def sword_plant(cx, cy, leaves, size):
    specs = []
    base_z = substrate_height(cx, cy)
    for k in range(leaves):
        ang = k / leaves * 2 * math.pi + random.uniform(-0.2, 0.2)
        out = random.uniform(0.5, 1.1)
        specs.append(
            {
                "base": (cx, cy, base_z),
                "height": size * random.uniform(0.7, 1.1),
                "width": size * random.uniform(0.14, 0.2),
                "lean": (math.cos(ang) * out, math.sin(ang) * out * 0.7),
                "angle": ang + math.pi / 2,
                "twist": random.uniform(-0.4, 0.4),
                "segments": 10,
            }
        )
    return specs


def carpet(n, xr, yr):
    specs = []
    for _ in range(n):
        x, y = random.uniform(*xr), random.uniform(*yr)
        specs.append(
            {
                "base": (x, y, substrate_height(x, y) - 0.002),
                "height": random.uniform(0.008, 0.025),
                "width": random.uniform(0.0015, 0.003),
                "lean": (random.gauss(0, 0.6), random.gauss(0, 0.6)),
                "angle": random.uniform(0, math.pi),
                "twist": 0.0,
                "segments": 3,
            }
        )
    return specs


# ---------------------------------------------------------------- scene


def build():
    reset()
    scene = bpy.context.scene
    cols = {n: collection(n) for n in ("Plants", "Wood", "Rocks", "Ground", "Front", "Env", "Water")}

    substrate(cols["Ground"])
    blades(carpet(2500, (-0.75, 0.75), (0.0, 0.25)), "Carpet", cols["Ground"],
           plant_material("CarpetLeaf", (0.03, 0.10, 0.015), (0.10, 0.22, 0.04)))

    rock_mat = rock_material()
    rock("RockBackL", (-0.30, 0.18, FLOOR_Z + 0.03), 0.07, cols["Rocks"], rock_mat, 1)
    rock("RockMidR", (0.28, 0.10, FLOOR_Z + 0.02), 0.05, cols["Rocks"], rock_mat, 2)
    rock("RockSmall", (0.05, 0.02, FLOOR_Z + 0.005), 0.025, cols["Rocks"], rock_mat, 3)
    rock("RockFrontL", (-0.50, -0.10, FLOOR_Z + 0.04), 0.14, cols["Front"], rock_mat, 4)
    rock("RockFrontR", (0.52, -0.06, FLOOR_Z + 0.05), 0.15, cols["Front"], rock_mat, 5)

    driftwood(cols["Wood"])

    vall = plant_material("Vallisneria", (0.025, 0.09, 0.015), (0.12, 0.26, 0.04))
    specs = vallisneria(1500, (-0.9, 0.9), (0.18, 0.40), (0.2, 0.75))
    specs += vallisneria(500, (-0.85, -0.45), (-0.02, 0.2), (0.25, 0.6))
    specs += vallisneria(500, (0.40, 0.85), (-0.02, 0.2), (0.25, 0.6))
    blades(specs, "Vallisneria", cols["Plants"], vall)

    sword = plant_material("Sword", (0.03, 0.10, 0.02), (0.10, 0.22, 0.05))
    swords = []
    for cx, cy, size in ((-0.12, 0.12, 0.14), (0.40, 0.16, 0.16), (-0.55, 0.10, 0.12)):
        swords += sword_plant(cx, cy, 16, size)
    blades(swords, "Swords", cols["Plants"], sword)

    front_leaf = plant_material("FrontLeaf", (0.04, 0.16, 0.025), (0.18, 0.40, 0.06))
    fspecs = vallisneria(140, (-0.62, -0.40), (-0.2, -0.1), (0.15, 0.4), lean=0.35)
    fspecs += vallisneria(160, (0.40, 0.66), (-0.2, -0.08), (0.2, 0.45), lean=0.35)
    blades(fspecs, "FrontGrass", cols["Front"], front_leaf)

    # Dark background wall
    bpy.ops.mesh.primitive_plane_add(size=1)
    wall = bpy.context.active_object
    for c in wall.users_collection:
        c.objects.unlink(wall)
    cols["Env"].objects.link(wall)
    wall.scale = (3.0, 1.2, 1)
    wall.rotation_euler = (math.radians(90), 0, 0)
    wall.location = (0, 0.46, 0.05)
    wall.data.materials.append(backdrop_material())

    # Water volume tint (camera sits inside it too)
    bpy.ops.mesh.primitive_cube_add(size=1)
    water = bpy.context.active_object
    for c in water.users_collection:
        c.objects.unlink(water)
    cols["Water"].objects.link(water)
    water.scale = (3.0, 2.6, 1.4)
    water.location = (0, -0.3, 0.1)
    water.data.materials.append(water_material())

    # Tank light: broad LED bar above plus a slightly raking key for texture on wood and rocks.
    area = bpy.data.lights.new("TankLED", "AREA")
    area.shape = "RECTANGLE"
    area.size, area.size_y = 1.6, 0.35
    area.energy = 30
    area.color = (1.0, 0.97, 0.9)
    la = bpy.data.objects.new("TankLED", area)
    la.location = (0, 0.05, 0.55)
    cols["Env"].objects.link(la)
    sun = bpy.data.lights.new("Key", "SUN")
    sun.energy = 0.7
    sun.angle = math.radians(4)
    sun.color = (1.0, 0.98, 0.92)
    ls = bpy.data.objects.new("Key", sun)
    ls.rotation_euler = (math.radians(25), math.radians(-12), 0)
    cols["Env"].objects.link(ls)

    world = bpy.data.worlds.new("World")
    scene.world = world
    try:
        world.use_nodes = True
    except AttributeError:
        pass
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.002, 0.006, 0.004, 1)

    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens_unit = "FOV"
    cam_data.sensor_fit = "VERTICAL"
    cam_data.angle_y = math.radians(FOV_Y)
    cam_data.clip_start = 0.01
    cam_data.dof.use_dof = True
    cam_data.dof.focus_distance = CAM_DIST
    cam_data.dof.aperture_fstop = 2.8
    cam = bpy.data.objects.new("Cam", cam_data)
    cam.location = (0, -CAM_DIST, 0)
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.collection.objects.link(cam)
    scene.camera = cam
    return cols


def setup_render(samples):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == "OPTIX"
    scene.cycles.device = "GPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.cycles.volume_bounces = 0
    scale = 50 if PREVIEW else 100
    scene.render.resolution_x, scene.render.resolution_y = 1920, 1080
    scene.render.resolution_percentage = scale
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = 0.0
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass


def layer_flags(**flags):
    """flags: collection name -> 'normal' | 'indirect' | 'holdout' | 'exclude'."""
    vl = bpy.context.scene.view_layers[0]
    for lc in vl.layer_collection.children:
        mode = flags.get(lc.name, "normal")
        lc.exclude = mode == "exclude"
        lc.holdout = mode == "holdout"
        lc.indirect_only = mode == "indirect"


def render(path, fmt, transparent):
    scene = bpy.context.scene
    scene.render.film_transparent = transparent
    scene.render.image_settings.file_format = fmt
    if fmt == "JPEG":
        scene.render.image_settings.color_mode = "RGB"
        scene.render.image_settings.quality = 92
    else:
        scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("wrote", path)


def main():
    os.makedirs(OUT, exist_ok=True)
    build()
    samples = 48 if PREVIEW else 384

    setup_render(samples)
    if "back" in PASSES:
        layer_flags()
        render(os.path.join(OUT, "back.jpg"), "JPEG", False)

    if "front" in PASSES:
        # No water volume here: with a transparent film Cycles turns absorption into alpha, which
        # would lay a semi-opaque dark sheet over the whole live scene.
        back_only = ("Plants", "Wood", "Rocks", "Ground", "Env")
        layer_flags(Water="exclude", **{n: "indirect" for n in back_only})
        render(os.path.join(OUT, "front.png"), "PNG", True)

    if "sway" not in PASSES:
        return
    bpy.context.scene.cycles.samples = 16
    bpy.context.scene.cycles.use_denoising = False
    layer_flags(Wood="holdout", Rocks="holdout", Ground="holdout", Front="holdout", Env="holdout", Water="exclude")
    render(os.path.join(OUT, "sway.png"), "PNG", True)


main()
