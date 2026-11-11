import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/game';
import { project, rotateQuarter } from '../src/engine/geometry';
import { buildGraph, findPath, initialState } from '../src/engine/graph';
import { solve } from '../src/engine/solver';
import type { LevelDef } from '../src/engine/types';

const palette = { bgTop: '', bgBottom: '', glow: '', path: '', stone: '', mech: '', goal: '' };

/**
 * a(0,0,0) - b(1,0,0) | 缺口 | 旋转臂 p(3,0,0)+q | 缺口 | c(5,0,0)
 * q 在状态 0 位于 (3,0,1)，状态 1 → (4,0,0) 接 c，状态 3 → (2,0,0) 接 b。
 * h(1,2,2) 与 a 构成视错觉边，仅 R=2 时生效。
 * 滑块 s 沿 y 有三个停靠点；x1 属于横轴旋转机关 X（不可搭乘）。
 */
const level: LevelDef = {
  id: 't',
  name: 't',
  hint: '',
  palette,
  minOps: 3,
  start: 'a',
  goal: 'c',
  mechanisms: [
    { type: 'rotator', id: 'R', pivot: [3, 0, 0], axis: 'y', initial: 0 },
    { type: 'slider', id: 'S', axis: 'y', stops: [0, 2, 4], initial: 0 },
    { type: 'rotator', id: 'X', pivot: [0, 0, 5], axis: 'x', initial: 0 },
  ],
  illusions: [{ a: 'a', b: 'h', when: { R: 2 } }],
  blocks: [
    { id: 'a', pos: [0, 0, 0], walk: true },
    { id: 'b', pos: [1, 0, 0], walk: true },
    { id: 'p', pos: [3, 0, 0], walk: true, mech: 'R' },
    { id: 'q', pos: [3, 0, 1], walk: true, mech: 'R' },
    { id: 'c', pos: [5, 0, 0], walk: true },
    { id: 'h', pos: [1, 2, 2], walk: true },
    { id: 's', pos: [9, 0, 9], walk: true, mech: 'S' },
    { id: 'x1', pos: [0, 0, 5], walk: true, mech: 'X' },
  ],
};

describe('几何', () => {
  it('转四次 90° 回到原位', () => {
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(rotateQuarter([2, 3, 5], [1, 1, 1], axis, 4)).toEqual([2, 3, 5]);
    }
    expect(rotateQuarter([1, 0, 0], [0, 0, 0], 'y', 1)).toEqual([0, 0, -1]);
  });

  it('沿视线平移不改变屏幕位置', () => {
    const a = project([2, 0, -3]);
    const b = project([5, 3, 0]);
    expect(a[0]).toBeCloseTo(b[0], 9);
    expect(a[1]).toBeCloseTo(b[1], 9);
  });
});

describe('寻路', () => {
  it('可达与不可达', () => {
    const g = buildGraph(level, initialState(level));
    expect(findPath(g, 'a', 'b')).toEqual(['a', 'b']);
    expect(findPath(g, 'a', 'a')).toEqual(['a']);
    expect(findPath(g, 'a', 'p')).toBeNull();
    expect(findPath(g, 'a', 'c')).toBeNull();
  });

  it('实体边随机关状态开关', () => {
    const base = initialState(level);
    expect(findPath(buildGraph(level, { ...base, R: 3 }), 'a', 'p')).toEqual(['a', 'b', 'q', 'p']);
    expect(findPath(buildGraph(level, { ...base, R: 1 }), 'p', 'c')).toEqual(['p', 'q', 'c']);
    expect(findPath(buildGraph(level, { ...base, R: 1 }), 'a', 'p')).toBeNull();
  });

  it('条件视错觉边只在声明的状态生效', () => {
    const base = initialState(level);
    for (const r of [0, 1, 3]) {
      expect(findPath(buildGraph(level, { ...base, R: r }), 'a', 'h')).toBeNull();
    }
    const g = buildGraph(level, { ...base, R: 2 });
    expect(findPath(g, 'a', 'h')).toEqual(['a', 'h']);
    expect(g.get('h')).toContainEqual({ to: 'a', kind: 'illusion' });
  });
});

describe('机关', () => {
  it('旋转状态循环', () => {
    const game = new Game(level);
    expect(game.nextState('R')).toBe(1);
    expect(game.nextState('R', -1)).toBe(3);
    game.operate('R', 3);
    expect(game.nextState('R')).toBe(0);
  });

  it('滑动平台吸附到最近的停靠点', () => {
    const game = new Game(level);
    expect(game.snap('S', 0.9)).toBe(0);
    expect(game.snap('S', 1.1)).toBe(1);
    expect(game.snap('S', 3.2)).toBe(2);
    expect(game.snap('S', 99)).toBe(2);
    game.operate('S', 2);
    expect(game.nodePos('s')).toEqual([9, 4, 9]);
  });

  it('角色行走时机关锁定', () => {
    const game = new Game(level);
    game.startWalk();
    expect(game.canOperate('R')).toBe(false);
    expect(game.operate('R', 1)).toBe(false);
    expect(game.mech.R).toBe(0);
    game.endWalk();
    expect(game.operate('R', 1)).toBe(true);
  });

  it('机关动画结束后才重算生效的边', () => {
    const game = new Game(level);
    expect(game.beginOperate('R', 3)).toBe(true);
    expect(game.pathTo('p')).toBeNull();
    expect(game.beginOperate('S', 1)).toBe(false);
    game.endOperate();
    expect(game.pathTo('p')).toEqual(['a', 'b', 'q', 'p']);
  });

  it('角色站在机关上时随机关移动', () => {
    const game = new Game(level);
    game.operate('R', 3);
    game.arrive('q');
    expect(game.nodePos()).toEqual([2, 0, 0]);
    game.operate('R', 0);
    game.operate('R', 1);
    expect(game.node).toBe('q');
    expect(game.nodePos()).toEqual([4, 0, 0]);
    expect(game.pathTo('c')).toEqual(['q', 'c']);
  });

  it('横轴旋转机关上站着人时不能转', () => {
    const game = new Game(level);
    expect(game.canOperate('X')).toBe(true);
    game.arrive('x1');
    expect(game.canOperate('X')).toBe(false);
    expect(game.canOperate('R')).toBe(true);
  });

  it('到达终点即通关，之后不再接受操作', () => {
    const game = new Game(level);
    game.startWalk();
    game.arrive('c');
    expect(game.endWalk()).toBe(true);
    expect(game.operate('R', 1)).toBe(false);
  });
});

describe('求解器', () => {
  it('给出最少操作数和可执行的步骤', () => {
    const sol = solve(level)!;
    expect(sol.ops).toBe(3);
    expect(sol.steps.filter((s) => s.type === 'op')).toHaveLength(3);
  });

  it('无解时返回 null', () => {
    expect(solve({ ...level, goal: 's' })).toBeNull();
  });
});
