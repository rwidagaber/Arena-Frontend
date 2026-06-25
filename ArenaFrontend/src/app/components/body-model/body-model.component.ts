import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  NgZone,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
  afterNextRender,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ProgressLogDto } from '../../core/services/progress-report.service';

/**
 * Normalized morph influences (each 0..1, except height which is a scale
 * factor around 1.0). These are the contract between the metric mapping and
 * both the procedural placeholder and the real GLB morph targets.
 */
export interface BodyInfluences {
  /** Overall body mass (driven by BMI). */
  mass: number;
  /** Body-fat softness. */
  bodyFat: number;
  /** Muscularity. */
  muscle: number;
  /** Uniform scale factor for stature. */
  height: number;
}

const REFERENCE_HEIGHT_CM = 170;

/** Clamp a value into [0, 1] after min–max normalization. */
export function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

export function bmiFrom(weightKg: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const h = heightCm / 100;
  return weightKg / (h * h);
}

/** Maps raw member metrics to normalized body influences. Pure + testable. */
export function metricsToInfluences(
  weightKg: number | null | undefined,
  bodyFat: number | null | undefined,
  muscleMassKg: number | null | undefined,
  heightCm: number | null | undefined,
): BodyInfluences {
  const bmi = bmiFrom(weightKg, heightCm);
  // BMI ~18.5 (lean) .. 35 (obese) maps to 0..1 body mass.
  const mass = bmi != null ? normalize(bmi, 18.5, 35) : 0.35;
  // Body fat % ~8 (athletic) .. 35 (high).
  const fat = bodyFat != null ? normalize(bodyFat, 8, 35) : mass * 0.6;
  // Skeletal muscle mass ~25kg .. 50kg.
  const muscle = muscleMassKg != null ? normalize(muscleMassKg, 25, 50) : 0.4;
  // Stature: gentle scale so proportions stay believable.
  const heightScale = heightCm
    ? Math.min(1.08, Math.max(0.92, heightCm / REFERENCE_HEIGHT_CM))
    : 1;
  return { mass, bodyFat: fat, muscle, height: heightScale };
}

/** "Female" | "F" | "female" -> 'female', everything else -> 'male'. */
export function normalizeGender(gender: string | null | undefined): 'male' | 'female' {
  return (gender ?? '').trim().toLowerCase().startsWith('f') ? 'female' : 'male';
}

const MORPH_NAMES: Record<keyof Omit<BodyInfluences, 'height'>, string> = {
  mass: 'bodyMass',
  bodyFat: 'bodyFat',
  muscle: 'muscle',
};

export type BodyShape =
  | 'hourglass' | 'pear' | 'apple' | 'rectangle' | 'invertedTriangle' | 'diamond' | 'trapezoid' | 'triangle';

/**
 * Per-region fat weights for each body shape (from the male/female body-type
 * chart). Each value scales how much that region inflates; `waist` may be
 * negative to cinch the waist. Regions are applied along surface normals, so
 * `belly`/`bust` grow forward, `glutesBack` grows backward, `hips`/`thighs`/
 * `shoulders` grow sideways.
 */
interface ShapePreset {
  shoulders: number;
  bust: number;
  waist: number;
  belly: number;
  hips: number;
  thighs: number;
  glutesBack: number;
}

const SHAPE_PRESETS: Record<BodyShape, ShapePreset> = {
  hourglass:        { shoulders: 0.10, bust: 0.32, waist: -0.28, belly: 0.03, hips: 0.42, thighs: 0.24, glutesBack: 0.36 },
  pear:             { shoulders: 0.0,  bust: 0.14, waist: 0.0,   belly: 0.05, hips: 0.5,  thighs: 0.34, glutesBack: 0.42 },
  apple:            { shoulders: 0.14, bust: 0.16, waist: 0.34,  belly: 0.58, hips: 0.2,  thighs: 0.07, glutesBack: 0.05 },
  rectangle:        { shoulders: 0.24, bust: 0.2,  waist: 0.24,  belly: 0.26, hips: 0.28, thighs: 0.2,  glutesBack: 0.15 },
  invertedTriangle: { shoulders: 0.55, bust: 0.34, waist: 0.06,  belly: 0.07, hips: 0.04, thighs: 0.04, glutesBack: 0.0 },
  diamond:          { shoulders: 0.1,  bust: 0.12, waist: 0.3,   belly: 0.42, hips: 0.44, thighs: 0.26, glutesBack: 0.2 },
  trapezoid:        { shoulders: 0.5,  bust: 0.3,  waist: 0.12,  belly: 0.12, hips: 0.12, thighs: 0.1,  glutesBack: 0.05 },
  triangle:         { shoulders: 0.07, bust: 0.12, waist: 0.24,  belly: 0.26, hips: 0.46, thighs: 0.28, glutesBack: 0.22 },
};

/** Shapes offered per gender (matching the body-type chart). First = default. */
const SHAPES_BY_GENDER: Record<'male' | 'female', BodyShape[]> = {
  female: ['hourglass', 'pear', 'apple', 'rectangle', 'invertedTriangle', 'diamond'],
  male: ['trapezoid', 'invertedTriangle', 'rectangle', 'apple', 'triangle'],
};

const BODY_SHAPE_STORAGE_KEY = 'arena.bodyShape';

@Component({
  selector: 'app-body-model',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule],
  templateUrl: './body-model.component.html',
  styleUrl: './body-model.component.scss',
})
export class BodyModelComponent {
  /** Member gender ("Male"/"Female"); selects the base mesh. */
  gender = input<string | null>(null);
  /** Stature in cm; drives uniform scale. */
  heightCm = input<number | null>(null);
  /** Progress history (any order); the left menu lists these. */
  logs = input<ProgressLogDto[]>([]);
  /** Goal weight (kg) from the member's target; adds a projected "goal" view. */
  targetWeightKg = input<number | null>(null);

  private host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private zone = inject(NgZone);
  private destroyRef = inject(DestroyRef);

  /** Whether WebGL is usable; false -> the template shows a fallback. */
  protected webglOk = signal(true);
  protected usingPlaceholder = signal(true);

  /** Logs sorted oldest -> newest so the menu reads top = past. */
  protected sortedLogs = computed(() =>
    [...this.logs()].sort((a, b) => +new Date(a.loggedAt) - +new Date(b.loggedAt)),
  );

  protected hasGoal = computed(() => {
    const t = this.targetWeightKg();
    return t != null && t > 0;
  });

  /** What the user picked from the left menu; null = use the default. */
  private picked = signal<{ kind: 'log'; index: number } | { kind: 'goal' } | null>(null);

  /** Resolved selection: validates the pick, defaults to the most recent log. */
  protected selection = computed<{ kind: 'log'; index: number } | { kind: 'goal' } | null>(() => {
    const n = this.sortedLogs().length;
    const p = this.picked();
    if (p?.kind === 'goal' && this.hasGoal()) return p;
    if (p?.kind === 'log' && n > 0) return { kind: 'log', index: Math.min(p.index, n - 1) };
    if (n > 0) return { kind: 'log', index: n - 1 };
    return this.hasGoal() ? { kind: 'goal' } : null;
  });

  protected isGoalSelected = computed(() => this.selection()?.kind === 'goal');
  protected selectedLogIndex = computed(() => {
    const s = this.selection();
    return s?.kind === 'log' ? s.index : -1;
  });
  protected selectedLog = computed<ProgressLogDto | null>(() => {
    const s = this.selection();
    return s?.kind === 'log' ? this.sortedLogs()[s.index] ?? null : null;
  });
  protected hasViews = computed(() => this.sortedLogs().length > 0 || this.hasGoal());
  protected goalBmi = computed(() => bmiFrom(this.targetWeightKg(), this.heightCm()));

  selectLog(index: number): void {
    this.picked.set({ kind: 'log', index });
  }
  selectGoal(): void {
    this.picked.set({ kind: 'goal' });
  }

  /** BMI for a given weight using the member's height (for menu labels). */
  protected bmiOf(weightKg: number | null | undefined): number | null {
    return bmiFrom(weightKg, this.heightCm());
  }

  // ── Body type (user-chosen shape) ──
  /** Body shapes available for the current gender. */
  protected availableShapes = computed(() => SHAPES_BY_GENDER[normalizeGender(this.gender())]);
  /** The user's explicit pick (persisted); null = gender default. */
  private pickedShape = signal<BodyShape | null>(this.readSavedShape());
  /** Resolved shape: the pick if valid for this gender, else the gender default. */
  protected activeShape = computed<BodyShape>(() => {
    const list = this.availableShapes();
    const s = this.pickedShape();
    return s && list.includes(s) ? s : list[0];
  });

  setShape(shape: BodyShape): void {
    this.pickedShape.set(shape);
    try {
      localStorage.setItem(BODY_SHAPE_STORAGE_KEY, shape);
    } catch {
      /* storage unavailable — keep in-memory only */
    }
  }

  private readSavedShape(): BodyShape | null {
    try {
      return (localStorage.getItem(BODY_SHAPE_STORAGE_KEY) as BodyShape) || null;
    } catch {
      return null;
    }
  }

  // three.js objects (created in browser only).
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private controls?: OrbitControls;
  private rafId = 0;
  private resizeObs?: ResizeObserver;
  /** Plays the rigged model's idle clip (natural standing pose + breathing). */
  private mixer?: THREE.AnimationMixer;
  private clock = new THREE.Clock();

  /** Procedural human pieces, grouped by region for per-frame morphing. */
  private placeholder?: {
    root: THREE.Group;
    torso: THREE.Object3D[]; // girth scales with mass + fat
    belly: THREE.Mesh; // grows forward with fat + mass
    chest: THREE.Object3D[]; // pecs / bust — scale with mass + fat
    hips: THREE.Object3D[]; // scale with mass + fat
    limbs: THREE.Object3D[]; // thicken with mass + muscle
    shoulders: THREE.Object3D[]; // scale with muscle
  };
  /** Loaded GLB meshes that expose morph targets. */
  private morphMeshes: THREE.Mesh[] = [];
  private modelRoot?: THREE.Object3D;
  /** Gender currently rendered, to avoid needless rebuilds/reloads. */
  private lastGender?: 'male' | 'female';
  /** True when the loaded GLB exposes our bodyMass/bodyFat/muscle morphs. */
  private hasBodyMorphs = false;
  /** True when the shared generic grey mannequin (not a gendered mesh) is shown. */
  private usingGenericModel = false;
  /**
   * Continuous (non-skinned) meshes we deform by anatomical region to fake
   * realistic fat distribution — used when the mesh has no real morph targets.
   */
  private deformTargets: {
    geom: THREE.BufferGeometry;
    rest: Float32Array; // original vertex positions
    restN: Float32Array; // original vertex normals (inflate direction)
    minY: number;
    height: number;
    cx: number;
    cz: number;
  }[] = [];
  /** Signature of the last applied fat deform, to skip redundant rebuilds. */
  private fatSig = '';

  // Smoothly-interpolated influence state read by the render loop.
  private current: BodyInfluences = { mass: 0.35, bodyFat: 0.35, muscle: 0.4, height: 1 };
  private target: BodyInfluences = { mass: 0.35, bodyFat: 0.35, muscle: 0.4, height: 1 };

  constructor() {
    // Recompute the morph target whenever the selected view / height changes.
    // The "goal" view projects body shape from the member's target weight.
    effect(() => {
      const s = this.selection();
      if (s?.kind === 'goal') {
        this.target = metricsToInfluences(this.targetWeightKg(), null, null, this.heightCm());
      } else if (s?.kind === 'log') {
        const log = this.sortedLogs()[s.index];
        this.target = metricsToInfluences(
          log?.weight ?? null,
          log?.bodyFat ?? null,
          log?.muscleMass ?? null,
          this.heightCm(),
        );
      } else {
        this.target = metricsToInfluences(null, null, null, this.heightCm());
      }
    });

    // Reload the body when gender changes (after the scene exists).
    effect(() => {
      const g = normalizeGender(this.gender());
      if (!this.renderer || g === this.lastGender) return;
      this.lastGender = g;
      // The generic mannequin already serves both genders — no reload needed.
      if (this.modelRoot && this.usingGenericModel) return;
      this.tryLoadModel(g);
    });

    afterNextRender(() => this.initScene());
    this.destroyRef.onDestroy(() => this.dispose());
  }

  // ── three.js setup ───────────────────────────────────────────────

  private initScene(): void {
    const el = this.host().nativeElement;
    const width = el.clientWidth || 320;
    const height = el.clientHeight || 420;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      this.webglOk.set(false);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;

    // Image-based lighting from a soft studio room — the biggest quality win.
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0.4, 1.05, 4.6);
    this.camera = camera;

    // Warm key + cool fill (three-point) for natural skin modelling.
    scene.add(new THREE.HemisphereLight(0xfff4ea, 0x33384a, 0.45));
    const key = new THREE.DirectionalLight(0xfff1e0, 2.1);
    key.position.set(2.5, 5, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 20;
    key.shadow.camera.left = -2;
    key.shadow.camera.right = 2;
    key.shadow.camera.top = 3;
    key.shadow.camera.bottom = -1;
    key.shadow.bias = -0.0005;
    key.shadow.radius = 6;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9ec1ff, 0.7);
    rim.position.set(-3, 2.5, -2.5);
    scene.add(rim);

    // Ground plane that only shows the shadow (transparent elsewhere).
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.ShadowMaterial({ opacity: 0.28 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.95, 0);
    controls.enablePan = false;
    controls.minDistance = 2.6;
    controls.maxDistance = 6.5;
    controls.minPolarAngle = Math.PI * 0.15;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.9;
    controls.update();
    this.controls = controls;

    // Show the procedural human immediately; upgrade to a gendered GLB if present.
    this.lastGender = normalizeGender(this.gender());
    this.buildPlaceholder(this.lastGender);
    this.tryLoadModel(this.lastGender);

    this.resizeObs = new ResizeObserver(() => this.onResize());
    this.resizeObs.observe(el);

    // Render loop runs outside Angular to avoid change-detection churn.
    this.zone.runOutsideAngular(() => {
      const tick = () => {
        this.rafId = requestAnimationFrame(tick);
        const dt = this.clock.getDelta();
        this.mixer?.update(dt);
        this.stepInfluences();
        this.controls?.update();
        this.renderer!.render(this.scene!, this.camera!);
      };
      tick();
    });
  }

  private onResize(): void {
    if (!this.renderer || !this.camera) return;
    const el = this.host().nativeElement;
    const w = el.clientWidth || 320;
    const h = el.clientHeight || 420;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Ease current influences toward target, then apply to the active body. */
  private stepInfluences(): void {
    const lerp = (a: number, b: number) => a + (b - a) * 0.12;
    this.current = {
      mass: lerp(this.current.mass, this.target.mass),
      bodyFat: lerp(this.current.bodyFat, this.target.bodyFat),
      muscle: lerp(this.current.muscle, this.target.muscle),
      height: lerp(this.current.height, this.target.height),
    };
    if (this.modelRoot) {
      if (this.hasBodyMorphs) this.applyToMorphs(this.current);
      else if (this.deformTargets.length) this.applyFatDistribution(this.current);
      else this.applyModelApprox(this.current);
    } else if (this.placeholder) {
      this.applyToPlaceholder(this.current);
    }
  }

  /**
   * Redistributes "fat" on a continuous mesh by pushing torso vertices outward
   * only where each body type actually stores it — instead of scaling the whole
   * model. Male: belly/waist (belly protrudes forward). Female: hips/thighs/bust.
   * Recomputed only when the influence meaningfully changes.
   */
  private applyFatDistribution(inf: BodyInfluences): void {
    // Stature scales the whole body uniformly (taller = proportionally bigger).
    if (this.modelRoot) {
      const base = this.modelRoot.userData['baseScale'] ?? 1;
      this.modelRoot.scale.setScalar(base * inf.height);
    }

    const shape = this.activeShape();
    const p = SHAPE_PRESETS[shape] ?? SHAPE_PRESETS.rectangle;
    const female = this.lastGender === 'female';
    const sig = `${female}|${shape}|${inf.mass.toFixed(3)}|${inf.bodyFat.toFixed(3)}`;
    if (sig === this.fatSig) return;
    this.fatSig = sig;

    // Amount is BMI-driven (height is already folded into BMI): near-base when
    // lean, growing strongly as BMI rises. inf.mass = normalize(BMI, 18.5..35),
    // so ~0.2 ≈ a healthy BMI. Body fat % nudges it up a little when known.
    const level = (inf.mass - 0.2) / 0.8;
    const mag = Math.max(0.05, 0.1 + level * 1.2) + inf.bodyFat * 0.15;
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
    const smooth = (e0: number, e1: number, x: number) => {
      const t = clamp01((x - e0) / (e1 - e0));
      return t * t * (3 - 2 * t);
    };

    for (const t of this.deformTargets) {
      const attr = t.geom.attributes['position'] as THREE.BufferAttribute;
      const out = attr.array as Float32Array;
      const a = t.rest;
      const n = t.restN;
      for (let i = 0; i < a.length; i += 3) {
        const bx = a[i], by = a[i + 1], bz = a[i + 2];
        const nx = n[i], ny = n[i + 1], nz = n[i + 2];
        const h = (by - t.minY) / t.height; // 0 feet .. 1 head
        const rx = bx - t.cx, rz = bz - t.cz;
        const r = Math.hypot(rx, rz);

        // Mask off arms (far from the vertical axis) and head/feet extremes.
        const limbMask = 1 - smooth(0.16, 0.24, r / t.height);
        const vert = clamp01((h - 0.05) / 0.08) * (1 - smooth(0.78, 0.92, h));
        const gate = limbMask * vert;

        const g = (c: number, w: number) => Math.exp(-((h - c) * (h - c)) / (2 * w * w));
        const front = Math.max(0, nz); // belly/bust point forward
        const back = Math.max(0, -nz); // glutes point backward
        const side = Math.abs(nx); // hips/thighs/shoulders point sideways

        // Weighted, direction-aware fat amount along the surface normal. The
        // small constant adds all-over fullness so heavier bodies round out
        // everywhere, not only in the body-type zones.
        const w =
          (0.12 +
            p.shoulders * g(0.72, 0.06) * side +
            p.bust * g(0.66, 0.05) * front +
            p.belly * g(0.52, 0.06) * front +
            p.waist * g(0.56, 0.05) + // uniform; negative cinches the waist
            p.hips * g(0.47, 0.05) * side +
            p.thighs * g(0.37, 0.075) * side +
            p.glutesBack * g(0.47, 0.06) * back) *
          gate;

        // Structural gender shaping (always on, independent of BMI): male reads
        // with a flat chest, broader shoulders and narrower hips; female with a
        // little bust and hip.
        const gb = female
          ? (0.5 * g(0.66, 0.05) * front + 0.25 * g(0.47, 0.05) * side) * gate
          : (-0.45 * g(0.66, 0.05) * front + 0.5 * g(0.72, 0.06) * side - 0.3 * g(0.47, 0.05) * side) * gate;

        const disp = (w * mag * 0.045 + gb * 0.03) * t.height;
        out[i] = bx + nx * disp;
        out[i + 1] = by + ny * disp;
        out[i + 2] = bz + nz * disp;
      }
      attr.needsUpdate = true;
      t.geom.computeVertexNormals();
    }
  }

  /**
   * For a real mesh without body morph targets (e.g. the generic mannequin):
   * approximate mass/fat by gently widening, and stature by scaling height.
   */
  private applyModelApprox(inf: BodyInfluences): void {
    if (!this.modelRoot) return;
    const base = this.modelRoot.userData['baseScale'] ?? 1;
    const widen = 1 + inf.mass * 0.16 + inf.bodyFat * 0.08;
    this.modelRoot.scale.set(base * widen, base * inf.height, base * widen);
  }

  // ── GLB model ────────────────────────────────────────────────────

  private tryLoadModel(gender: 'male' | 'female'): void {
    // Prefer a gendered MakeHuman mesh with real morphs; otherwise show the
    // seamless MakeHuman base mesh; then the grey mannequin; finally procedural.
    this.loadCandidate(
      [
        { url: `models/${gender}.glb`, kind: 'glb', generic: false },
        { url: `models/makehuman_base.obj`, kind: 'obj', generic: true },
        { url: `models/mannequin.glb`, kind: 'glb', generic: true },
      ],
      0,
    );
  }

  private loadCandidate(
    list: { url: string; kind: 'glb' | 'obj'; generic: boolean }[],
    i: number,
  ): void {
    if (i >= list.length) {
      this.usingPlaceholder.set(true); // keep the procedural human
      return;
    }
    const { url, kind, generic } = list[i];
    const next = () => this.loadCandidate(list, i + 1);
    if (kind === 'obj') {
      new OBJLoader().load(url, (obj) => this.onModelLoaded(obj, [], generic), undefined, next);
    } else {
      new GLTFLoader().load(
        url,
        (gltf) => this.onModelLoaded(gltf.scene, gltf.animations, generic),
        undefined,
        next,
      );
    }
  }

  private onModelLoaded(root: THREE.Object3D, animations: THREE.AnimationClip[], generic: boolean): void {
    // Drop placeholder + any previous model.
    this.clearModel();
    if (this.placeholder) {
      this.scene?.remove(this.placeholder.root);
      this.disposeObject(this.placeholder.root);
      this.placeholder = undefined;
    }

    // Clean matte-grey clay material for the generic mannequin, so it looks like a
    // polished studio model regardless of the source textures.
    const grey = generic
      ? new THREE.MeshStandardMaterial({ color: 0xb7bcc6, roughness: 0.5, metalness: 0.0 })
      : null;

    this.morphMeshes = [];
    this.hasBodyMorphs = false;
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      // OBJ meshes ship without normals — compute smooth ones for lit shading.
      if (mesh.geometry && !mesh.geometry.attributes['normal']) {
        mesh.geometry.computeVertexNormals();
      }
      if (grey) mesh.material = grey;
      mesh.castShadow = true;
      mesh.frustumCulled = false; // skinned meshes report a misleading bbox

      // For a continuous (non-skinned) generic mesh, capture rest vertices so we
      // can redistribute fat by region instead of uniformly scaling.
      if (generic && !(mesh as unknown as THREE.SkinnedMesh).isSkinnedMesh && mesh.geometry) {
        // Weld coincident vertices into a watertight, shared-normal mesh. The raw
        // OBJ is non-indexed with per-face normals, which would tear apart when
        // inflated along normals.
        const old = mesh.geometry;
        old.deleteAttribute('uv');
        old.deleteAttribute('normal');
        const geom = mergeVertices(old);
        geom.computeVertexNormals();

        geom.computeBoundingBox();
        const bb = geom.boundingBox!;
        const minY = bb.min.y;
        const height = Math.max(1e-3, bb.max.y - bb.min.y);

        // Bake athletic wear via vertex colours so the model isn't nude — a band
        // over the pelvis (shorts) and chest (top). It conforms to the mesh and
        // deforms with it, so it never clips.
        const pos = geom.attributes['position'].array as Float32Array;
        const colors = new Float32Array(pos.length);
        const skin = [0.74, 0.76, 0.8];
        const cloth = [0.15, 0.18, 0.25];
        for (let i = 0; i < pos.length; i += 3) {
          const h = (pos[i + 1] - minY) / height;
          const dressed = (h > 0.42 && h < 0.55) || (h > 0.6 && h < 0.72);
          const c = dressed ? cloth : skin;
          colors[i] = c[0];
          colors[i + 1] = c[1];
          colors[i + 2] = c[2];
        }
        geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        mesh.geometry = geom;
        old.dispose();
        mesh.material = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.6,
          metalness: 0.0,
        });

        this.deformTargets.push({
          geom,
          rest: pos.slice(),
          restN: (geom.attributes['normal'].array as Float32Array).slice(),
          minY,
          height,
          cx: (bb.min.x + bb.max.x) / 2,
          cz: (bb.min.z + bb.max.z) / 2,
        });
      }
      if (mesh.morphTargetDictionary) {
        this.morphMeshes.push(mesh);
        if (['bodyMass', 'bodyFat', 'muscle'].some((n) => n in mesh.morphTargetDictionary!)) {
          this.hasBodyMorphs = true;
        }
      }
    });

    this.usingGenericModel = generic;
    this.frameAndAdd(root);
    this.modelRoot = root;
    this.usingPlaceholder.set(false);

    // Drop the stiff T-pose: play the idle clip if the rig has one, so the model
    // stands naturally (arms down) with a subtle breathing motion.
    if (animations.length) {
      const idle = animations.find((a) => /idle/i.test(a.name)) ?? animations[0];
      this.mixer = new THREE.AnimationMixer(root);
      this.mixer.clipAction(idle).play();
    }
  }

  /** Center the model on the floor and scale it to a ~1.8m frame. */
  private frameAndAdd(root: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const scale = size.y > 0 ? 1.8 / size.y : 1;
    root.userData['baseScale'] = scale;
    root.scale.setScalar(scale);
    root.position.sub(center.multiplyScalar(scale));
    root.position.y += (size.y * scale) / 2;
    this.scene?.add(root);
  }

  private applyToMorphs(inf: BodyInfluences): void {
    for (const mesh of this.morphMeshes) {
      const dict = mesh.morphTargetDictionary!;
      const infl = mesh.morphTargetInfluences!;
      for (const key of ['mass', 'bodyFat', 'muscle'] as const) {
        const i = dict[MORPH_NAMES[key]];
        if (i != null) infl[i] = inf[key];
      }
    }
    if (this.modelRoot) this.modelRoot.scale.setScalar((this.modelRoot.userData['baseScale'] ?? 1) * inf.height);
  }

  // ── Procedural human (no external assets) ────────────────────────

  private rebuildPlaceholder(gender: 'male' | 'female'): void {
    if (this.placeholder) {
      this.scene?.remove(this.placeholder.root);
      this.disposeObject(this.placeholder.root);
      this.placeholder = undefined;
    }
    this.buildPlaceholder(gender);
  }

  /**
   * Builds a smooth, anatomically-proportioned human figure from a lathed torso
   * plus capsule limbs and sphere joints. Heights are in metres (feet at y≈0).
   * Gender shifts the shoulder/hip ratio; the timeline morphs it via the region
   * arrays in {@link applyToPlaceholder}.
   */
  private buildPlaceholder(gender: 'male' | 'female'): void {
    const root = new THREE.Group();
    // Skin-like shading: soft sheen + warm tone reads far more like flesh than a
    // flat plastic material under the studio IBL.
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xd29a78,
      roughness: 0.55,
      metalness: 0.0,
      sheen: 0.4,
      sheenColor: new THREE.Color(0xffd8be),
      sheenRoughness: 0.8,
    });
    mat.envMapIntensity = 1.0;

    const female = gender === 'female';
    const shoulderHalf = female ? 0.155 : 0.20;
    const hipHalf = female ? 0.17 : 0.145;

    const torso: THREE.Object3D[] = [];
    const chest: THREE.Object3D[] = [];
    const hips: THREE.Object3D[] = [];
    const limbs: THREE.Object3D[] = [];
    const shoulders: THREE.Object3D[] = [];

    const sphere = (r: number) => new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), mat);
    // A sphere shaped at the geometry level, so mesh.scale stays free for morphing.
    const shapedSphere = (r: number, sx: number, sy: number, sz: number) => {
      const g = new THREE.SphereGeometry(r, 32, 24);
      g.scale(sx, sy, sz);
      return new THREE.Mesh(g, mat);
    };
    const capsule = (r: number, len: number) =>
      new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 14, 28), mat);

    // Head + neck.
    const head = shapedSphere(0.105, 0.92, 1.12, 1.0);
    head.position.y = 1.66;
    root.add(head);
    const neck = capsule(0.045, 0.05);
    neck.position.y = 1.55;
    root.add(neck);

    // Torso as a smooth surface of revolution, flattened front-to-back.
    const profile = [
      [0.001, 0.88], [hipHalf * 0.95, 0.9], [hipHalf, 0.96],
      [female ? 0.115 : 0.125, 1.06], [female ? 0.14 : 0.15, 1.18],
      [shoulderHalf * 0.85, 1.3], [shoulderHalf, 1.4],
      [0.075, 1.49], [0.05, 1.52], [0.001, 1.53],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const torsoMesh = new THREE.Mesh(new THREE.LatheGeometry(profile, 32), mat);
    root.add(torsoMesh);
    torso.push(torsoMesh);

    // Belly — hidden inside the torso when lean, protrudes with fat/mass.
    const belly = sphere(0.12);
    belly.position.set(0, 1.04, 0.04);
    root.add(belly);

    // Chest: flatter pecs (male) / bust (female) for a clearer human silhouette.
    for (const s of [-1, 1]) {
      const c = female
        ? shapedSphere(0.06, 1.0, 0.95, 0.95)
        : shapedSphere(0.058, 1.1, 0.55, 0.6);
      c.position.set(s * (female ? 0.06 : 0.072), female ? 1.2 : 1.27, female ? 0.085 : 0.07);
      root.add(c);
      chest.push(c);
    }

    // Deltoids.
    for (const s of [-1, 1]) {
      const d = sphere(0.07);
      d.position.set(s * shoulderHalf, 1.4, 0);
      root.add(d);
      shoulders.push(d);
    }
    // Glutes / hip mass.
    for (const s of [-1, 1]) {
      const g = sphere(female ? 0.105 : 0.09);
      g.position.set(s * 0.085, 0.9, -0.01);
      root.add(g);
      hips.push(g);
    }

    // Arms: upper + elbow + forearm + hand.
    for (const s of [-1, 1]) {
      const ax = s * (shoulderHalf + 0.03);
      const upper = capsule(0.05, 0.22);
      upper.position.set(ax, 1.27, 0);
      upper.rotation.z = s * 0.06;
      root.add(upper);
      limbs.push(upper);

      const elbow = sphere(0.045);
      elbow.position.set(ax + s * 0.02, 1.11, 0);
      root.add(elbow);

      const fore = capsule(0.042, 0.2);
      fore.position.set(ax + s * 0.03, 0.97, 0.01);
      fore.rotation.z = s * 0.04;
      root.add(fore);
      limbs.push(fore);

      const hand = shapedSphere(0.05, 0.7, 1.1, 0.4);
      hand.position.set(ax + s * 0.04, 0.83, 0.02);
      root.add(hand);
    }

    // Legs: thigh + knee + calf + foot.
    for (const s of [-1, 1]) {
      const lx = s * 0.085;
      const thigh = capsule(0.08, 0.26);
      thigh.position.set(lx, 0.66, 0);
      root.add(thigh);
      limbs.push(thigh);

      const knee = sphere(0.06);
      knee.position.set(lx, 0.48, 0);
      root.add(knee);

      const calf = capsule(0.055, 0.26);
      calf.position.set(lx, 0.3, 0);
      root.add(calf);
      limbs.push(calf);

      const foot = shapedSphere(0.07, 0.6, 0.45, 1.3);
      foot.position.set(lx, 0.05, 0.05);
      root.add(foot);
    }

    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    this.scene?.add(root);
    this.placeholder = { root, torso, belly, chest, hips, limbs, shoulders };
    this.applyToPlaceholder(this.current);
  }

  private applyToPlaceholder(inf: BodyInfluences): void {
    const p = this.placeholder;
    if (!p) return;

    // Torso girth: width grows with mass, depth grows more with fat. The 0.72
    // factor keeps the chest elliptical (wider than deep) at every size.
    const torsoX = 1 + inf.mass * 0.3 + inf.bodyFat * 0.12;
    const torsoZ = 0.72 * (1 + inf.mass * 0.32 + inf.bodyFat * 0.3);
    for (const t of p.torso) t.scale.set(torsoX, 1, torsoZ);

    // Belly: tiny (tucked inside) when lean, bulging forward when heavy.
    const b = Math.max(0, inf.mass - 0.2) * 0.9 + inf.bodyFat * 0.9;
    p.belly.scale.set(0.6 + b * 0.55, 0.55 + b * 0.5, 0.45 + b * 0.7);
    p.belly.position.z = 0.02 + b * 0.06;

    // Chest (pecs / bust) fills out a little with mass + fat.
    const chestS = 1 + inf.mass * 0.16 + inf.bodyFat * 0.22;
    for (const c of p.chest) c.scale.setScalar(chestS);

    // Hips / glutes.
    const hipS = 1 + inf.mass * 0.25 + inf.bodyFat * 0.22;
    for (const h of p.hips) h.scale.setScalar(hipS);

    // Shoulders broaden mainly with muscle.
    const shS = 1 + inf.muscle * 0.35 + inf.mass * 0.1;
    for (const s of p.shoulders) s.scale.setScalar(shS);

    // Limbs thicken with mass + muscle (length unchanged).
    const limbXZ = 1 + inf.mass * 0.18 + inf.muscle * 0.35;
    for (const l of p.limbs) l.scale.set(limbXZ, 1, limbXZ);

    p.root.scale.y = inf.height;
  }

  // ── teardown ─────────────────────────────────────────────────────

  private clearModel(): void {
    this.morphMeshes = [];
    this.deformTargets = [];
    this.fatSig = '';
    this.mixer?.stopAllAction();
    this.mixer = undefined;
    if (this.modelRoot) {
      this.scene?.remove(this.modelRoot);
      this.disposeObject(this.modelRoot);
      this.modelRoot = undefined;
    }
  }

  private disposeObject(obj: THREE.Object3D): void {
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const m = mesh.material as THREE.Material | THREE.Material[];
        Array.isArray(m) ? m.forEach((x) => x.dispose()) : m?.dispose();
      }
    });
  }

  private dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.mixer?.stopAllAction();
    this.resizeObs?.disconnect();
    this.controls?.dispose();
    if (this.placeholder) this.disposeObject(this.placeholder.root);
    if (this.modelRoot) this.disposeObject(this.modelRoot);
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.scene?.clear();
  }
}
