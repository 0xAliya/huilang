import { buildGraph, initialState, isRideable, stateCount, type Graph } from './graph';
import type { LevelDef, MechState } from './types';

export type SolveStep = { type: 'op'; mech: string; state: number } | { type: 'walk'; to: string };

export interface Solution {
  /** 最少机关操作数。 */
  ops: number;
  steps: SolveStep[];
}

interface Rec {
  node: string;
  mech: MechState;
  dist: number;
  prev?: Rec;
  step?: SolveStep;
}

/**
 * 在「角色节点 × 全部机关状态」空间做 0-1 BFS：走路代价 0，一次机关操作代价 1。
 * 一次操作 = 旋转机关转 90°，或滑动平台滑到另一个停靠点。
 */
export function solve(level: LevelDef): Solution | null {
  const ids = level.mechanisms.map((m) => m.id);
  const mechKey = (mech: MechState) => ids.map((i) => mech[i]).join(',');
  const key = (node: string, mech: MechState) => `${node}|${mechKey(mech)}`;
  const graphs = new Map<string, Graph>();
  const graphOf = (mech: MechState): Graph => {
    const k = mechKey(mech);
    let g = graphs.get(k);
    if (!g) graphs.set(k, (g = buildGraph(level, mech)));
    return g;
  };
  const mechOfBlock = new Map(level.blocks.map((b) => [b.id, b.mech]));

  const start: Rec = { node: level.start, mech: initialState(level), dist: 0 };
  const best = new Map<string, Rec>([[key(start.node, start.mech), start]]);
  const deque: Rec[] = [start];

  const relax = (cur: Rec, node: string, mech: MechState, cost: 0 | 1, step: SolveStep) => {
    const k = key(node, mech);
    const dist = cur.dist + cost;
    const old = best.get(k);
    if (old && old.dist <= dist) return;
    const rec: Rec = { node, mech, dist, prev: cur, step };
    best.set(k, rec);
    if (cost === 0) deque.unshift(rec);
    else deque.push(rec);
  };

  while (deque.length) {
    const cur = deque.shift()!;
    if (best.get(key(cur.node, cur.mech)) !== cur) continue;
    if (cur.node === level.goal) return toSolution(cur);
    for (const e of graphOf(cur.mech).get(cur.node) ?? []) {
      relax(cur, e.to, cur.mech, 0, { type: 'walk', to: e.to });
    }
    for (const def of level.mechanisms) {
      if (mechOfBlock.get(cur.node) === def.id && !isRideable(def)) continue;
      const s = cur.mech[def.id];
      const n = stateCount(def);
      const targets =
        def.type === 'rotator'
          ? [(s + 1) % n, (s + n - 1) % n]
          : def.stops.map((_, i) => i).filter((i) => i !== s);
      for (const t of new Set(targets)) {
        relax(cur, cur.node, { ...cur.mech, [def.id]: t }, 1, { type: 'op', mech: def.id, state: t });
      }
    }
  }
  return null;
}

function toSolution(end: Rec): Solution {
  const raw: SolveStep[] = [];
  for (let r: Rec | undefined = end; r?.step; r = r.prev) raw.unshift(r.step);
  const steps: SolveStep[] = [];
  for (const s of raw) {
    const last = steps[steps.length - 1];
    if (s.type === 'walk' && last?.type === 'walk') last.to = s.to;
    else steps.push({ ...s });
  }
  return { ops: end.dist, steps };
}
