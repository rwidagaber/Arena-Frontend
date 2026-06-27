# 3D Body Model assets

The 3D Body feature (`BodyModelComponent`) renders the member's physique with
[three.js](https://threejs.org/) (MIT).

### What renders, in order

The component uses the first of these that loads:

1. **`male.glb` / `female.glb`** — gendered MakeHuman meshes with real body morph
   targets (see contract below). *Add these for the best, personalized result.*
2. **`makehuman_base.obj`** — the bundled **MakeHuman base mesh** (CC0), body only.
   A seamless (no joint gaps) neutral human, shown grey with studio lighting + soft
   shadow and **BMI-based scaling**. This is the current default preview.
3. **`mannequin.glb`** — grey rigged mannequin fallback (has an idle pose).
4. **Procedural human** — code-generated figure, only if nothing else loads.

```
public/models/
  makehuman_base.obj   <-- bundled default (seamless MakeHuman base, CC0)
  mannequin.glb        <-- fallback rigged mannequin
  male.glb             <-- optional: realistic + true gendered morphing
  female.glb           <-- optional
```

Served at `/models/<file>.glb`.

> **`mannequin.glb`** is the grey humanoid from the three.js example assets
> (originally a Mixamo character, royalty-free). It's recolored to a uniform matte
> grey at load. Replace it with your own MakeHuman output anytime — see below.

## Morph-target contract (IMPORTANT)

Each GLB must contain a body mesh with **morph targets (shape keys) named exactly**:

| Morph target name | Driven by member metric                    | 0.0 → 1.0 means        |
| ----------------- | ------------------------------------------ | ---------------------- |
| `bodyMass`        | BMI (weight ÷ height²), ~18.5 → 35          | lean → heavy           |
| `bodyFat`         | Body-fat %, ~8 → 35                          | low fat → high fat     |
| `muscle`          | Skeletal muscle mass, ~25 kg → 50 kg        | soft → muscular        |

Stature (height) is applied at runtime as a uniform scale, so it does **not** need a
morph target. Gender selects which file loads (`Male` → `male.glb`, else
`female.glb`). The normalization ranges live in `metricsToInfluences()` in
`src/app/components/body-model/body-model.component.ts` — adjust there if needed.

## How to author the assets (free tools only)

Everything here is free. **MakeHuman-exported meshes are CC0** (public domain), so
they're safe to ship — no attribution required. The Blender step is automated by
`build_glb.py` in this folder, so you only do the MakeHuman exports + run one
command.

### 1. MakeHuman — http://www.makehumancommunity.org/  (Downloads)

Do this for the **male**, then repeat for the **female**.

1. **Modelling → Main** tab. This is where you move sliders. Don't touch the
   Topology/Proxy or swap geometry between exports — only sliders — or the meshes
   won't share topology.
2. (Optional, keeps it clean) **Geometries** tab → set Eyes / Teeth / Eyebrows /
   Eyelashes / Tongue to *None*, so only the body exports.
3. Set the **Gender** slider fully to male (for the male set) / female (female set).
   Leave **Height** neutral — the app scales height itself.
4. Export each of the following as **Wavefront (.obj)** via **Files → Export**
   (Mesh Format: Wavefront obj, Scale: meter, Feet on ground: on), into THIS folder:

   | Sliders to set                          | Save as            | Becomes shape key |
   | --------------------------------------- | ------------------ | ----------------- |
   | neutral / lean (Weight & Muscle ~mid)   | `male_base.obj`    | Basis (required)  |
   | **Weight → max**                        | `male_heavy.obj`   | `bodyMass` (req.) |
   | high body fat (Weight high, low muscle) | `male_fat.obj`     | `bodyFat` (opt.)  |
   | **Muscle → max**                        | `male_muscle.obj`  | `muscle` (opt.)   |

   …and `female_base.obj`, `female_heavy.obj`, `female_fat.obj`, `female_muscle.obj`.
   Only `*_base` and `*_heavy` are required; the others are optional polish.

### 2. Blender — automated  (https://www.blender.org/)

With the OBJs in this folder, run from a terminal:

```
blender --background --python build_glb.py
```

The script imports each gender's OBJs, turns the variants into shape keys named
exactly `bodyMass` / `bodyFat` / `muscle`, and writes `male.glb` + `female.glb` here.
It warns and skips any variant whose topology doesn't match the base.

*(Manual alternative: import the OBJs, select a variant then shift-select the base
last, **Object → Join as Shapes**, rename the new shape keys, then **File → Export →
glTF 2.0 (.glb)** with **Shape Keys** enabled.)*

### 3. Done

`male.glb` / `female.glb` now sit in this folder. Reload the app — the 3D Body
section loads them instead of the bundled mannequin, gender picks the right file,
and the progress-timeline slider drives the morph targets from each log's BMI.
Tune the BMI→influence ranges in `metricsToInfluences()` if the change feels too
strong or too subtle.
