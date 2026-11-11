import {
  blockById,
  blockPos,
  buildGraph,
  findPath,
  initialState,
  isRideable,
  mechById,
  stateCount,
  type Edge,
  type Graph,
} from './graph';
import type { LevelDef, MechDef, MechState, Vec3 } from './types';

/** 一局游戏的纯逻辑状态：角色所在节点、机关状态、当前生效的行走图。 */
export class Game {
  mech: MechState = {};
  node = '';
  walking = false;
  animating = false;
  won = false;
  ops = 0;
  private graph: Graph = new Map();

  constructor(readonly level: LevelDef) {
    this.reset();
  }

  reset(): void {
    this.mech = initialState(this.level);
    this.node = this.level.start;
    this.walking = false;
    this.animating = false;
    this.won = false;
    this.ops = 0;
    this.graph = buildGraph(this.level, this.mech);
  }

  def(id: string): MechDef {
    return mechById(this.level, id);
  }

  nodePos(id: string = this.node): Vec3 {
    return blockPos(this.level, blockById(this.level, id), this.mech);
  }

  canOperate(id: string): boolean {
    if (this.walking || this.animating || this.won) return false;
    const standingOn = blockById(this.level, this.node).mech;
    return !(standingOn === id && !isRideable(this.def(id)));
  }

  /** 点击一次机关后的下一个状态（循环）。 */
  nextState(id: string, dir: 1 | -1 = 1): number {
    const n = stateCount(this.def(id));
    return (this.mech[id] + dir + n) % n;
  }

  /** 滑动平台松手时吸附到离 offset 最近的停靠点，返回其状态序号。 */
  snap(id: string, offset: number): number {
    const def = this.def(id);
    if (def.type !== 'slider') throw new Error(`${id} 不是滑动平台`);
    let best = 0;
    def.stops.forEach((s, i) => {
      if (Math.abs(s - offset) < Math.abs(def.stops[best] - offset)) best = i;
    });
    return best;
  }

  /** 开始一次机关操作。动画期间行走图保持旧的，直到 endOperate。 */
  beginOperate(id: string, state: number): boolean {
    if (!this.canOperate(id)) return false;
    if (state === this.mech[id] || state < 0 || state >= stateCount(this.def(id))) return false;
    this.mech = { ...this.mech, [id]: state };
    this.animating = true;
    this.ops++;
    return true;
  }

  endOperate(): void {
    this.animating = false;
    this.graph = buildGraph(this.level, this.mech);
  }

  operate(id: string, state: number): boolean {
    if (!this.beginOperate(id, state)) return false;
    this.endOperate();
    return true;
  }

  edges(id: string): Edge[] {
    return this.graph.get(id) ?? [];
  }

  pathTo(target: string, from: string = this.node): string[] | null {
    if (this.animating || this.won) return null;
    return findPath(this.graph, from, target);
  }

  startWalk(): void {
    this.walking = true;
  }

  arrive(id: string): void {
    this.node = id;
  }

  /** 结束行走，返回是否通关。 */
  endWalk(): boolean {
    this.walking = false;
    if (this.node === this.level.goal) this.won = true;
    return this.won;
  }
}
