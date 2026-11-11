import { AXIS_INDEX, posKey, rotateQuarter } from './geometry';
import type { BlockDef, LevelDef, MechDef, MechState, Vec3 } from './types';

export interface Edge {
  to: string;
  kind: 'solid' | 'illusion';
}
export type Graph = Map<string, Edge[]>;

export function mechById(level: LevelDef, id: string): MechDef {
  const def = level.mechanisms.find((m) => m.id === id);
  if (!def) throw new Error(`未知机关 ${id}`);
  return def;
}

export function blockById(level: LevelDef, id: string): BlockDef {
  const block = level.blocks.find((b) => b.id === id);
  if (!block) throw new Error(`未知方块 ${id}`);
  return block;
}

export const stateCount = (def: MechDef): number => (def.type === 'rotator' ? 4 : def.stops.length);

/** 角色能否站在机关上跟着动：滑动平台可以，旋转机关只有竖直轴可以。 */
export const isRideable = (def: MechDef): boolean => def.type === 'slider' || def.axis === 'y';

export function initialState(level: LevelDef): MechState {
  const state: MechState = {};
  for (const m of level.mechanisms) state[m.id] = m.initial;
  return state;
}

/** 全部机关状态的组合。 */
export function allStates(level: LevelDef): MechState[] {
  let out: MechState[] = [{}];
  for (const m of level.mechanisms) {
    const next: MechState[] = [];
    for (const s of out) for (let i = 0; i < stateCount(m); i++) next.push({ ...s, [m.id]: i });
    out = next;
  }
  return out;
}

export function blockPos(level: LevelDef, block: BlockDef, mech: MechState): Vec3 {
  if (!block.mech) return block.pos;
  const def = mechById(level, block.mech);
  const s = mech[def.id];
  if (def.type === 'rotator') return rotateQuarter(block.pos, def.pivot, def.axis, s);
  const p: [number, number, number] = [block.pos[0], block.pos[1], block.pos[2]];
  p[AXIS_INDEX[def.axis]] += def.stops[s];
  return p;
}

export function whenMatches(when: MechState, mech: MechState): boolean {
  return Object.keys(when).every((id) => mech[id] === when[id]);
}

/** 当前机关状态下生效的行走图。实体边由几何相邻推出，视错觉边取自关卡声明。 */
export function buildGraph(level: LevelDef, mech: MechState): Graph {
  const graph: Graph = new Map();
  const at = new Map<string, string>();
  const nodes = level.blocks.filter((b) => b.walk);
  for (const b of nodes) {
    graph.set(b.id, []);
    at.set(posKey(blockPos(level, b, mech)), b.id);
  }
  for (const b of nodes) {
    const [x, y, z] = blockPos(level, b, mech);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const other = at.get(posKey([x + dx, y, z + dz]));
      if (other) graph.get(b.id)!.push({ to: other, kind: 'solid' });
    }
  }
  for (const e of level.illusions) {
    if (!whenMatches(e.when, mech)) continue;
    graph.get(e.a)?.push({ to: e.b, kind: 'illusion' });
    graph.get(e.b)?.push({ to: e.a, kind: 'illusion' });
  }
  return graph;
}

/** BFS 最短路，返回含起点和终点的节点序列；不可达返回 null。 */
export function findPath(graph: Graph, from: string, to: string): string[] | null {
  if (!graph.has(from) || !graph.has(to)) return null;
  if (from === to) return [from];
  const prev = new Map<string, string>([[from, from]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    for (const e of graph.get(cur)!) {
      if (prev.has(e.to)) continue;
      prev.set(e.to, cur);
      if (e.to === to) {
        const path = [to];
        while (path[0] !== from) path.unshift(prev.get(path[0])!);
        return path;
      }
      queue.push(e.to);
    }
  }
  return null;
}
