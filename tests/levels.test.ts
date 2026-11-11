import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/game';
import { lattice, posKey, screenDist, STEP_LEN } from '../src/engine/geometry';
import {
  allStates,
  blockPos,
  buildGraph,
  findPath,
  initialState,
  whenMatches,
} from '../src/engine/graph';
import { solve } from '../src/engine/solver';
import { levels } from '../src/levels';

/**
 * 会挡住某个顶面（或站在上面的角色）的方块，相对该顶面的屏幕格偏移。
 * 方块更靠近相机（da+db+3dy ≥ 1）且落在这些偏移上，就算遮挡。
 */
const OCCLUDER_OFFSETS = [
  [0, 0], [-1, 0], [0, -1], [-1, -1], [-2, -1], [-1, -2], [-2, -2],
];

describe.each(levels)('关卡「$name」', (level) => {
  const nodes = level.blocks.filter((b) => b.walk);
  const states = allStates(level);

  it('数据自洽', () => {
    const ids = level.blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    const nodeIds = new Set(nodes.map((b) => b.id));
    expect(nodeIds.has(level.start)).toBe(true);
    expect(nodeIds.has(level.goal)).toBe(true);
    for (const e of level.illusions) {
      expect(nodeIds.has(e.a)).toBe(true);
      expect(nodeIds.has(e.b)).toBe(true);
    }
    for (const b of level.blocks) {
      if (b.mech) expect(level.mechanisms.some((m) => m.id === b.mech)).toBe(true);
    }
  });

  it('任何机关状态下方块都不重叠', () => {
    for (const s of states) {
      const keys = level.blocks.map((b) => posKey(blockPos(level, b, s)));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('初始状态不操作机关时终点不可达', () => {
    const g = buildGraph(level, initialState(level));
    expect(findPath(g, level.start, level.goal)).toBeNull();
  });

  it(`可通关，最少机关操作数为 ${level.minOps}`, () => {
    const sol = solve(level);
    expect(sol).not.toBeNull();
    expect(sol!.ops).toBe(level.minOps);
  });

  it('按求解器步骤实际操作能通关', () => {
    const game = new Game(level);
    for (const step of solve(level)!.steps) {
      if (step.type === 'op') {
        expect(game.operate(step.mech, step.state)).toBe(true);
      } else {
        const path = game.pathTo(step.to);
        expect(path).not.toBeNull();
        game.startWalk();
        for (const n of path!.slice(1)) game.arrive(n);
        game.endWalk();
      }
    }
    expect(game.won).toBe(true);
    expect(game.ops).toBe(level.minOps);
  });

  it('视错觉边两端的屏幕距离等于一格步长，且近处一端在画面下方', () => {
    for (const e of level.illusions) {
      const a = level.blocks.find((b) => b.id === e.a)!;
      const b = level.blocks.find((b) => b.id === e.b)!;
      const matching = states.filter((s) => whenMatches(e.when, s));
      expect(matching.length).toBeGreaterThan(0);
      for (const s of matching) {
        const pa = blockPos(level, a, s);
        const pb = blockPos(level, b, s);
        expect(pa[1]).not.toBe(pb[1]);
        expect(Math.abs(screenDist(pa, pb) - STEP_LEN)).toBeLessThan(0.001);
        // 更高（更近）的一端必须在屏幕格的 +a/+b 方向，否则它的侧面会盖住远端顶面
        const [near, far] = pa[1] > pb[1] ? [pa, pb] : [pb, pa];
        const [na, nb] = lattice(near);
        const [fa, fb] = lattice(far);
        expect(na - fa + (nb - fb)).toBe(1);
      }
    }
  });

  it('画面上相邻的顶面一定连通，且没有两个顶面在画面上重合', () => {
    for (const s of states) {
      const graph = buildGraph(level, s);
      const placed = nodes.map((b) => ({ id: b.id, pos: blockPos(level, b, s) }));
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const [a1, b1] = lattice(placed[i].pos);
          const [a2, b2] = lattice(placed[j].pos);
          const d = Math.abs(a1 - a2) + Math.abs(b1 - b2);
          const where = `${placed[i].id}~${placed[j].id} @ ${JSON.stringify(s)}`;
          expect(d, `重合 ${where}`).not.toBe(0);
          if (d === 1) {
            const linked = graph.get(placed[i].id)!.some((e) => e.to === placed[j].id);
            expect(linked, `看着相邻却不连通 ${where}`).toBe(true);
          }
        }
      }
    }
  });

  it('可行走顶面和站在上面的角色不被方块遮挡', () => {
    for (const s of states) {
      const placed = level.blocks.map((b) => ({ id: b.id, walk: b.walk, pos: blockPos(level, b, s) }));
      for (const n of placed.filter((p) => p.walk)) {
        const [na, nb] = lattice(n.pos);
        for (const c of placed) {
          if (c.id === n.id) continue;
          const [ca, cb] = lattice(c.pos);
          const da = ca - na;
          const db = cb - nb;
          const dy = c.pos[1] - n.pos[1];
          const hit = OCCLUDER_OFFSETS.some(([oa, ob]) => oa === da && ob === db) && da + db + 3 * dy >= 1;
          expect(hit, `${c.id} 挡住 ${n.id} @ ${JSON.stringify(s)}`).toBe(false);
        }
      }
    }
  });
});
