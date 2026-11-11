import * as THREE from 'three';
import type { Sfx } from '../audio/sfx';
import type { Game } from '../engine/game';
import { AXIS_INDEX, project } from '../engine/geometry';
import { allStates, blockPos } from '../engine/graph';
import type { Axis, LevelDef, MechDef, Vec3 } from '../engine/types';
import { Hero } from './hero';

const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const UP = new THREE.Vector3(-1, 2, -1).normalize();
const VIEW = new THREE.Vector3(1, 1, 1).normalize();
const AXIS_VEC: Record<Axis, Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const BOX = new THREE.BoxGeometry(1, 1, 1);
const STEP_TIME = 0.24;
const CLICK_SLOP = 6;

const v3 = (p: Vec3) => new THREE.Vector3(p[0], p[1], p[2]);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const linear = (t: number) => t;

type Hit = { kind: 'node'; id: string } | { kind: 'mech'; id: string };

interface Tween {
  t: number;
  dur: number;
  ease: (t: number) => number;
  fn: (k: number) => void;
  done: () => void;
}

interface Press {
  pointer: number;
  x: number;
  y: number;
  hit: Hit | null;
  moved: boolean;
  /** 正在实时拖动滑动平台。 */
  live: boolean;
  startVisual: number;
}

/** 场景、相机、动画与输入。逻辑状态都在 Game 里，这里只负责表现。 */
export class World {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  private readonly raycaster = new THREE.Raycaster();
  private readonly hero = new Hero();

  private game!: Game;
  private onWin: () => void = () => {};
  private root: THREE.Group | null = null;
  private meshes = new Map<string, THREE.Mesh>();
  private groups = new Map<string, THREE.Group>();
  private wheels = new Map<string, THREE.Object3D>();
  /** 机关当前的显示值：旋转机关是「转了几个 90°」，滑动平台是偏移量。可以是小数。 */
  private visual: Record<string, number> = {};
  private pickables: THREE.Object3D[] = [];
  private gem: THREE.Mesh | null = null;
  private bounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  private pxPerUnit = 1;

  private tweens: Tween[] = [];
  private gen = 0;
  private time = 0;
  private last = 0;
  private press: Press | null = null;
  private pendingTarget: string | null = null;
  /** 行走或通关动画期间由动画直接给出角色位置。 */
  private heroPos: THREE.Vector3 | null = null;
  private heroBob = 0;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly sfx: Sfx) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.75);
    sun.position.set(0.35, 1, 0.6);
    this.scene.add(sun);

    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onCancel);
    window.addEventListener('resize', () => this.fit());
    requestAnimationFrame(this.frame);
  }

  // ---------- 搭建 ----------

  load(game: Game, onWin: () => void): void {
    this.gen++;
    this.game = game;
    this.onWin = onWin;
    this.tweens = [];
    this.press = null;
    this.pendingTarget = null;
    this.heroPos = null;
    this.heroBob = 0;
    this.disposeRoot();

    const level = game.level;
    const pal = level.palette;
    const root = new THREE.Group();
    this.root = root;
    this.scene.add(root);

    const mats = {
      path: new THREE.MeshLambertMaterial({ color: pal.path }),
      stone: new THREE.MeshLambertMaterial({ color: pal.stone }),
      mech: new THREE.MeshLambertMaterial({ color: pal.mech }),
      trim: new THREE.MeshLambertMaterial({ color: new THREE.Color(pal.mech).multiplyScalar(0.72) }),
      light: new THREE.MeshLambertMaterial({ color: pal.path }),
    };

    for (const def of level.mechanisms) {
      const group = new THREE.Group();
      if (def.type === 'rotator') group.position.copy(v3(def.pivot));
      root.add(group);
      this.groups.set(def.id, group);
      this.visual[def.id] = def.type === 'rotator' ? game.mech[def.id] : def.stops[game.mech[def.id]];
    }

    for (const b of level.blocks) {
      const mesh = new THREE.Mesh(BOX, b.mech ? mats.mech : b.walk ? mats.path : mats.stone);
      mesh.userData = { block: b.id, walk: !!b.walk, mech: b.mech };
      this.meshes.set(b.id, mesh);
      this.pickables.push(mesh);
      if (!b.mech) {
        mesh.position.copy(v3(b.pos));
        root.add(mesh);
        continue;
      }
      const def = game.def(b.mech);
      const group = this.groups.get(b.mech)!;
      mesh.position.copy(v3(b.pos));
      if (def.type === 'rotator') mesh.position.sub(v3(def.pivot));
      else {
        this.addGrips(mesh, def.id, mats.trim);
        root.add(this.makeRail(b.pos, def, mats.trim));
      }
      group.add(mesh);
    }

    for (const def of level.mechanisms) {
      if (def.type === 'rotator' && def.handle) root.add(this.makeWheel(def, mats.trim, mats.light));
      this.applyVisual(def.id);
    }

    this.addGoalMarker(level, pal.goal);
    this.hero.reset();
    root.add(this.hero.group);

    this.computeBounds(level);
    this.fit();
  }

  private disposeRoot(): void {
    if (this.root) {
      this.scene.remove(this.root);
      this.root.remove(this.hero.group);
      const seen = new Set<THREE.Material>();
      this.root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (mesh.geometry !== BOX) mesh.geometry.dispose();
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) seen.add(m);
      });
      seen.forEach((m) => m.dispose());
    }
    this.root = null;
    this.meshes.clear();
    this.groups.clear();
    this.wheels.clear();
    this.visual = {};
    this.pickables = [];
    this.gem = null;
  }

  /** 滑动平台朝相机的两个侧面各贴一块饰板，提示可拖动。 */
  private addGrips(mesh: THREE.Mesh, mechId: string, mat: THREE.Material): void {
    for (const normal of [[1, 0, 0], [0, 0, 1]] as const) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.05), mat);
      plate.position.set(normal[0] * 0.5, 0, normal[2] * 0.5);
      if (normal[0]) plate.rotation.y = Math.PI / 2;
      plate.rotation.z = Math.PI / 4;
      plate.userData = { mech: mechId };
      mesh.add(plate);
      this.pickables.push(plate);
    }
  }

  /** 滑轨：贴在方块背向相机的棱上，方块在的地方被挡住，空出来的地方露出来。 */
  private makeRail(pos: Vec3, def: Extract<MechDef, { type: 'slider' }>, mat: THREE.Material): THREE.Mesh {
    const min = Math.min(...def.stops);
    const max = Math.max(...def.stops);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, max - min + 1, 8), mat);
    const center: [number, number, number] = [pos[0] - 0.5, pos[1] - 0.5, pos[2] - 0.5];
    const i = AXIS_INDEX[def.axis];
    center[i] = pos[i] + (min + max) / 2;
    rail.position.set(center[0], center[1], center[2]);
    if (def.axis === 'x') rail.rotation.z = Math.PI / 2;
    if (def.axis === 'z') rail.rotation.x = Math.PI / 2;
    return rail;
  }

  private makeWheel(
    def: Extract<MechDef, { type: 'rotator' }>,
    rim: THREE.Material,
    peg: THREE.Material,
  ): THREE.Object3D {
    const { pos, normal } = def.handle!;
    const mount = new THREE.Group();
    mount.position.set(pos[0] + normal[0] * 0.56, pos[1] + normal[1] * 0.56, pos[2] + normal[2] * 0.56);
    mount.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v3(normal));
    const spin = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 24), rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 12), peg);
    spin.add(disc, hub);
    for (let i = 0; i < 4; i++) {
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), peg);
      knob.position.set(Math.cos((i * Math.PI) / 2) * 0.24, 0.08, Math.sin((i * Math.PI) / 2) * 0.24);
      spin.add(knob);
    }
    spin.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.userData = { mech: def.id };
        this.pickables.push(o);
      }
    });
    mount.add(spin);
    this.wheels.set(def.id, spin);
    return mount;
  }

  private addGoalMarker(level: LevelDef, color: string): void {
    const goal = this.meshes.get(level.goal)!;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.24, 0.34, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.505;
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
    );
    gem.position.y = 1.35;
    goal.add(ring, gem);
    this.gem = gem;
  }

  private applyVisual(id: string): void {
    const def = this.game.def(id);
    const group = this.groups.get(id)!;
    const value = this.visual[id];
    if (def.type === 'rotator') {
      group.rotation.set(0, 0, 0);
      group.rotation[def.axis] = (value * Math.PI) / 2;
      const wheel = this.wheels.get(id);
      if (wheel) wheel.rotation.y = value * Math.PI;
    } else {
      const a = AXIS_VEC[def.axis];
      group.position.set(a[0] * value, a[1] * value, a[2] * value);
    }
  }

  // ---------- 相机 ----------

  /** 取所有机关状态下全部方块的屏幕包围盒，保证怎么转都不出画。 */
  private computeBounds(level: LevelDef): void {
    const b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    for (const state of allStates(level)) {
      for (const block of level.blocks) {
        const [x, y] = project(blockPos(level, block, state));
        b.minX = Math.min(b.minX, x - 0.75);
        b.maxX = Math.max(b.maxX, x + 0.75);
        b.minY = Math.min(b.minY, y - 0.85);
        b.maxY = Math.max(b.maxY, y + (block.walk ? 1.7 : 0.85));
      }
    }
    this.bounds = b;
  }

  fit(): void {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    const padX = 18;
    const padTop = 72;
    const padBottom = 78;
    const b = this.bounds;
    const scale = Math.min((w - 2 * padX) / (b.maxX - b.minX), (h - padTop - padBottom) / (b.maxY - b.minY), 84);
    this.pxPerUnit = scale;
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2 + (padTop - padBottom) / 2 / scale;
    const center = RIGHT.clone().multiplyScalar(cx).addScaledVector(UP, cy);
    this.camera.left = -w / 2 / scale;
    this.camera.right = w / 2 / scale;
    this.camera.top = h / 2 / scale;
    this.camera.bottom = -h / 2 / scale;
    this.camera.position.copy(center).addScaledVector(VIEW, 120);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(center);
    this.camera.updateProjectionMatrix();
  }

  // ---------- 动画 ----------

  private tween(dur: number, fn: (k: number) => void, ease = easeInOut): Promise<void> {
    return new Promise((done) => this.tweens.push({ t: 0, dur, ease, fn, done }));
  }

  private frame = (now: number): void => {
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0);
    this.last = now;
    this.time += dt;

    const running = this.tweens;
    this.tweens = [];
    for (const tw of running) {
      tw.t += dt / tw.dur;
      const k = Math.min(1, tw.t);
      tw.fn(tw.ease(k));
      if (k >= 1) tw.done();
      else this.tweens.push(tw);
    }

    if (this.root) {
      const pos = this.hero.group.position;
      if (this.heroPos) pos.copy(this.heroPos);
      else this.topOf(this.game.node, pos);
      pos.y += this.heroBob;
      this.hero.update(this.time);
      if (this.gem) {
        this.gem.rotation.y = this.time * 1.2;
        this.gem.position.y = 1.35 + Math.sin(this.time * 2) * 0.06;
      }
      this.renderer.render(this.scene, this.camera);
    }
    requestAnimationFrame(this.frame);
  };

  /** 节点顶面中心的世界坐标（跟着机关的当前显示位置走）。 */
  private topOf(id: string, out = new THREE.Vector3()): THREE.Vector3 {
    this.meshes.get(id)!.getWorldPosition(out);
    out.y += 0.5;
    return out;
  }

  private flash(id: string, color: string): void {
    const mesh = this.meshes.get(id);
    if (!mesh) return;
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86), mat);
    quad.rotation.x = -Math.PI / 2;
    quad.position.y = 0.51;
    mesh.add(quad);
    void this.tween(0.5, (k) => {
      mat.opacity = 0.8 * (1 - k);
      quad.scale.setScalar(1 - 0.25 * k);
      if (k >= 1) {
        mesh.remove(quad);
        quad.geometry.dispose();
        mat.dispose();
      }
    }, linear);
  }

  private deny(id?: string): void {
    this.sfx.deny();
    if (id) this.flash(id, '#ff5a6e');
  }

  // ---------- 行走 ----------

  /** 走到目标节点。行走途中再次调用会改道。 */
  async walkTo(target: string): Promise<void> {
    const g = this.game;
    if (g.won || g.animating) return;
    if (g.walking) {
      this.pendingTarget = target;
      return;
    }
    let path = g.pathTo(target);
    if (!path) return this.deny(target);
    if (path.length < 2) return;
    this.flash(target, '#ffffff');

    const gen = this.gen;
    g.startWalk();
    for (let i = 1; i < path.length; i++) {
      await this.stepAnim(path[i - 1], path[i]);
      if (gen !== this.gen) return;
      g.arrive(path[i]);
      this.sfx.step();
      if (this.pendingTarget) {
        const next = g.pathTo(this.pendingTarget);
        if (next) {
          if (next.length > 1) this.flash(this.pendingTarget, '#ffffff');
          path = next;
          i = 0;
        } else this.deny(this.pendingTarget);
        this.pendingTarget = null;
      }
    }
    this.heroPos = null;
    this.heroBob = 0;
    if (g.endWalk()) await this.winAnim();
  }

  private stepAnim(a: string, b: string): Promise<void> {
    const from = this.topOf(a);
    const to = this.topOf(b);
    // 视错觉边：两端沿视线差 k 层。全程贴着靠近相机的那一层走，
    // 正交投影下屏幕位置连续，换层发生在这一步的起点或终点，看不出跳变。
    const k = Math.round(to.y - from.y);
    if (k > 0) from.addScaledVector(new THREE.Vector3(1, 1, 1), k);
    else if (k < 0) to.addScaledVector(new THREE.Vector3(1, 1, 1), -k);
    this.hero.face(to.x - from.x, to.z - from.z);
    this.heroPos = from.clone();
    return this.tween(STEP_TIME, (t) => {
      this.heroPos!.lerpVectors(from, to, t);
      this.heroBob = Math.sin(t * Math.PI) * 0.07;
    }, linear);
  }

  private async winAnim(): Promise<void> {
    const gen = this.gen;
    this.sfx.win();
    const base = this.topOf(this.game.node);
    const startRot = this.hero.group.rotation.y;
    const gem = this.gem;
    this.heroPos = base.clone();
    await this.tween(1.3, (k) => {
      this.heroPos!.set(base.x, base.y + k * 0.9, base.z);
      this.hero.group.rotation.y = startRot + k * Math.PI * 4;
      this.hero.group.scale.setScalar(1 - k * k);
      if (gem) {
        gem.scale.setScalar(1 + k * 3);
        (gem.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - k);
      }
    });
    if (gen === this.gen) this.onWin();
  }

  // ---------- 机关 ----------

  /** 把机关转/滑到 target 状态；dir 只对旋转机关有意义。 */
  private async operate(id: string, target: number, dir: 1 | -1 = 1): Promise<boolean> {
    const g = this.game;
    const def = g.def(id);
    if (!g.beginOperate(id, target)) {
      this.deny();
      return false;
    }
    const gen = this.gen;
    const from = this.visual[id];
    const to = def.type === 'rotator' ? from + dir : def.stops[target];
    const dur = def.type === 'rotator' ? 0.6 : 0.2 + 0.12 * Math.abs(to - from);
    this.sfx.mech(target);
    await this.tween(dur, (k) => {
      this.visual[id] = from + (to - from) * k;
      this.applyVisual(id);
    });
    if (gen !== this.gen) return false;
    this.visual[id] = def.type === 'rotator' ? target : to;
    this.applyVisual(id);
    g.endOperate();
    return true;
  }

  /** 供脚本驱动（演示/验收）：直接把机关操作到指定状态。 */
  operateTo(id: string, state: number): Promise<boolean> {
    const def = this.game.def(id);
    const dir = def.type === 'rotator' && (state - this.game.mech[id] + 4) % 4 === 3 ? -1 : 1;
    return this.operate(id, state, dir);
  }

  // ---------- 输入 ----------

  private pick(e: PointerEvent): Hit | null {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.pickables, false)[0];
    if (!hit) return null;
    const data = hit.object.userData as { block?: string; walk?: boolean; mech?: string };
    if (data.block && data.walk) {
      // 机关上的可行走方块：点顶面是走过去，点侧面是操作机关
      const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : null;
      if (!data.mech || (normal && normal.y > 0.5)) return { kind: 'node', id: data.block };
    }
    return data.mech ? { kind: 'mech', id: data.mech } : null;
  }

  private onDown = (e: PointerEvent): void => {
    this.sfx.unlock();
    if (this.press || !this.root || this.game.won) return;
    const hit = this.pick(e);
    this.press = { pointer: e.pointerId, x: e.clientX, y: e.clientY, hit, moved: false, live: false, startVisual: 0 };
    if (hit?.kind === 'mech' && this.game.def(hit.id).type === 'slider' && this.game.canOperate(hit.id)) {
      this.press.live = true;
      this.press.startVisual = this.visual[hit.id];
    }
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onMove = (e: PointerEvent): void => {
    const p = this.press;
    if (!p || e.pointerId !== p.pointer) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Math.hypot(dx, dy) > CLICK_SLOP) p.moved = true;
    if (!p.live || p.hit?.kind !== 'mech') return;
    const def = this.game.def(p.hit.id);
    if (def.type !== 'slider') return;
    // 把指针位移投到滑动轴的屏幕方向上
    const [ax, ay] = project(AXIS_VEC[def.axis]);
    const sx = ax * this.pxPerUnit;
    const sy = -ay * this.pxPerUnit;
    const delta = (dx * sx + dy * sy) / (sx * sx + sy * sy);
    const min = Math.min(...def.stops);
    const max = Math.max(...def.stops);
    this.visual[def.id] = Math.min(max, Math.max(min, p.startVisual + delta));
    this.applyVisual(def.id);
  };

  private onUp = (e: PointerEvent): void => {
    const p = this.press;
    if (!p || e.pointerId !== p.pointer) return;
    this.press = null;
    if (!p.hit) return;
    if (p.hit.kind === 'node') {
      if (!p.moved) void this.walkTo(p.hit.id);
      return;
    }
    const id = p.hit.id;
    const g = this.game;
    const def = g.def(id);
    if (def.type === 'rotator') {
      const dx = e.clientX - p.x;
      if (p.moved && Math.abs(dx) < 14) return;
      const dir = p.moved && dx < 0 ? -1 : 1;
      void this.operate(id, g.nextState(id, dir), dir);
      return;
    }
    if (!p.live) return this.deny();
    const target = p.moved ? g.snap(id, this.visual[id]) : g.nextState(id);
    if (target !== g.mech[id]) {
      void this.operate(id, target);
      return;
    }
    // 没拖过半程：弹回原位
    const from = this.visual[id];
    const to = def.stops[target];
    void this.tween(0.18, (k) => {
      this.visual[id] = from + (to - from) * k;
      this.applyVisual(id);
    });
  };

  private onCancel = (e: PointerEvent): void => {
    const p = this.press;
    if (!p || e.pointerId !== p.pointer) return;
    this.press = null;
    if (p.live && p.hit?.kind === 'mech') {
      const def = this.game.def(p.hit.id);
      if (def.type === 'slider') {
        this.visual[def.id] = def.stops[this.game.mech[def.id]];
        this.applyVisual(def.id);
      }
    }
  };
}
