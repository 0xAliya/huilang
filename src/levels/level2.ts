import type { LevelDef } from '../engine/types';
import { column, walk } from './helpers';

/**
 * 错位：低处的栈道和高处的塔在 3D 上不相连。
 * 塔顶的横臂转到状态 1 时，臂端在画面上正好接在栈道尽头（差 3 层，沿视线重合）。
 * 走上横臂后再转一次，横臂把人送到对面的终点平台。
 */
export const level2: LevelDef = {
  id: 'cuowei',
  name: '错位',
  hint: '看起来连着的路，就是连着的',
  minOps: 2,
  palette: {
    bgTop: '#d5f3e4',
    bgBottom: '#58a9aa',
    glow: '#f4fff2',
    path: '#f2fcf3',
    stone: '#3f8d92',
    mech: '#ffb768',
    goal: '#ffffff',
  },
  start: 'a0',
  goal: 'g2',
  mechanisms: [
    {
      type: 'rotator',
      id: 'arm',
      pivot: [0, 3, 0],
      axis: 'y',
      initial: 0,
      handle: { pos: [0, 1, 0], normal: [0, 0, 1] },
    },
  ],
  illusions: [{ a: 'a5', b: 'arm2', when: { arm: 1 } }],
  blocks: [
    // 低处栈道（y=0）
    walk('a0', -1, 0, -9),
    walk('a1', -2, 0, -9),
    walk('a2', -3, 0, -9),
    walk('a3', -3, 0, -8),
    walk('a4', -3, 0, -7),
    walk('a5', -3, 0, -6),
    // 塔顶横臂（y=3）
    walk('pivot', 0, 3, 0, 'arm'),
    walk('arm1', 1, 3, 0, 'arm'),
    walk('arm2', 2, 3, 0, 'arm'),
    // 终点平台（y=3）
    walk('g0', -3, 3, 0),
    walk('g1', -3, 3, 1),
    walk('g2', -3, 3, 2),
    // 装饰
    ...column('ct', 0, 2, 0, 4),
    ...column('cg', -3, 2, 2, 4),
    ...column('ca', -3, -1, -9, 3),
    ...column('cs', -1, -1, -9, 2),
  ],
};
