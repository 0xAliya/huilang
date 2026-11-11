import type { LevelDef } from '../engine/types';
import { column, walk } from './helpers';

/**
 * 潮汐：一个滑动机关同时带着两块方块升降——近处的「轿厢」和远处的「桥板」。
 * 涨潮（高位）时轿厢接中层，落潮（低位）时轿厢接起点、桥板补上终点前的缺口。
 * 解法：落潮上轿厢 → 涨潮到中层 → 转横梁，画面上接到高层 → 落潮，桥板接通终点。
 */
export const level3: LevelDef = {
  id: 'chaoxi',
  name: '潮汐',
  hint: '金色的方块同起同落 · 上下拖动它们',
  minOps: 4,
  palette: {
    bgTop: '#2f2a5a',
    bgBottom: '#b8709c',
    glow: '#ffd9c2',
    path: '#ece2fb',
    stone: '#6c5ba3',
    mech: '#ffcf7a',
    goal: '#ffffff',
  },
  start: 's0',
  goal: 'e1',
  mechanisms: [
    { type: 'slider', id: 'tide', axis: 'y', stops: [0, 3], initial: 1 },
    {
      type: 'rotator',
      id: 'beam',
      pivot: [7, 5, 2],
      axis: 'y',
      initial: 1,
      handle: { pos: [7, 3, 2], normal: [0, 0, 1] },
    },
  ],
  illusions: [
    { a: 'm2', b: 'ba', when: { beam: 0 } },
    { a: 'm2', b: 'bb', when: { beam: 2 } },
  ],
  blocks: [
    // 起点（y=0）
    walk('s0', 0, 0, 3),
    walk('s1', 0, 0, 2),
    walk('s2', 0, 0, 1),
    // 轿厢：低位 y=0，高位 y=3
    walk('cabin', 0, 0, 0, 'tide'),
    // 中层（y=3）
    walk('m0', 1, 3, 0),
    walk('m1', 2, 3, 0),
    walk('m2', 3, 3, 0),
    // 横梁（y=5，状态 0/2 时沿 x）
    walk('ba', 6, 5, 2, 'beam'),
    walk('bp', 7, 5, 2, 'beam'),
    walk('bb', 8, 5, 2, 'beam'),
    // 高层（y=5）
    walk('u0', 9, 5, 2),
    walk('u1', 9, 5, 1),
    walk('u2', 9, 5, 0),
    // 桥板：低位 y=5 补缺口，高位 y=8
    walk('plank', 9, 5, -1, 'tide'),
    // 终点（y=5）
    walk('e0', 9, 5, -2),
    walk('e1', 9, 5, -3),
    // 装饰
    ...column('cs', 0, -1, 3, 2),
    ...column('cm', 3, 2, 0, 3),
    ...column('cb', 7, 4, 2, 4),
    ...column('cu', 9, 4, 2, 3),
    ...column('ce', 9, 4, -3, 3),
  ],
};
