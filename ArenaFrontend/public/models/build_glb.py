"""
Combine MakeHuman OBJ exports into morph-target GLBs for the 3D Body feature.

This turns several MakeHuman exports of the SAME base body (one lean, one heavy,
optionally one high-fat and one muscular) into a single GLB per gender whose shape
keys are named exactly `bodyMass`, `bodyFat`, `muscle` — the names the Angular
component (`body-model.component.ts`) drives from the member's BMI / progress.

USAGE
-----
1. Export the OBJs from MakeHuman into THIS folder (see names below).
2. Run (Blender 3.6+ / 4.x):

       blender --background --python build_glb.py

   (On Windows, if `blender` isn't on PATH, use the full path, e.g.
    "C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe")

3. It writes `male.glb` and `female.glb` next to this script. The app picks them
   up automatically on reload — no code changes.

EXPECTED INPUT FILES (in this folder)
-------------------------------------
   male_base.obj      (required)  neutral / lean male  -> the "Basis" shape
   male_heavy.obj     (required)  Weight slider at max -> shape key 'bodyMass'
   male_fat.obj       (optional)  high body fat        -> shape key 'bodyFat'
   male_muscle.obj    (optional)  Muscle slider at max -> shape key 'muscle'
   female_base.obj / female_heavy.obj / female_fat.obj / female_muscle.obj

CRITICAL: every variant must share the base's topology (same vertex count/order).
In MakeHuman that means: only move the sliders between exports — do NOT change the
Topology/Proxy or swap geometry. (Removing eyes/teeth/etc. under the Geometries tab
before exporting keeps things simplest, but isn't required as long as it's the same
for every export of that gender.)
"""

import bpy
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# (shape-key name, input-file suffix). First is required; the rest are optional.
VARIANTS = [
    ("bodyMass", "heavy"),
    ("bodyFat", "fat"),
    ("muscle", "muscle"),
]


def import_obj(path):
    """Import an OBJ and return it as a single merged mesh object."""
    before = set(bpy.data.objects)
    bpy.ops.wm.obj_import(filepath=path)
    new = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    if not new:
        raise RuntimeError(f"No mesh found in {path}")
    if len(new) > 1:
        bpy.ops.object.select_all(action="DESELECT")
        for o in new:
            o.select_set(True)
        bpy.context.view_layer.objects.active = new[0]
        bpy.ops.object.join()
        new = [bpy.context.view_layer.objects.active]
    return new[0]


def build(gender):
    base_path = os.path.join(HERE, f"{gender}_base.obj")
    if not os.path.exists(base_path):
        print(f"[skip] {gender}: missing {gender}_base.obj")
        return

    base = import_obj(base_path)
    base.name = f"{gender}_body"
    # Guarantee a Basis shape key so join_shapes appends onto it.
    base.shape_key_add(name="Basis", from_mix=False)

    for key_name, suffix in VARIANTS:
        vpath = os.path.join(HERE, f"{gender}_{suffix}.obj")
        if not os.path.exists(vpath):
            continue
        variant = import_obj(vpath)
        if len(variant.data.vertices) != len(base.data.vertices):
            print(
                f"[warn] {gender}_{suffix}: vertex count "
                f"{len(variant.data.vertices)} != base {len(base.data.vertices)} "
                f"-> skipped (topology changed; use sliders only)."
            )
            bpy.data.objects.remove(variant, do_unlink=True)
            continue
        bpy.ops.object.select_all(action="DESELECT")
        variant.select_set(True)
        base.select_set(True)
        bpy.context.view_layer.objects.active = base
        bpy.ops.object.join_shapes()
        base.data.shape_keys.key_blocks[-1].name = key_name
        bpy.data.objects.remove(variant, do_unlink=True)

    bpy.ops.object.select_all(action="DESELECT")
    base.select_set(True)
    bpy.context.view_layer.objects.active = base
    out = os.path.join(HERE, f"{gender}.glb")
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format="GLB",
        use_selection=True,
        export_morph=True,
    )
    keys = [k.name for k in base.data.shape_keys.key_blocks]
    print(f"[ok] wrote {gender}.glb  shape keys: {keys}")


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for gender in ("male", "female"):
        build(gender)
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.object.delete()
    print("Done.")


if __name__ == "__main__":
    main()
