import type { LevelDef } from '../engine/types';
import { column, walk } from './helpers';

/** 初阶：一座断桥，转 90° 接通两岸。 */
export const level1: LevelDef = {
  id: 'chujie',
  name: '初阶',
  hint: '轻点路面行走 · 拨动金色转轮，让断桥接上',
  minOps: 1,
  palette: {
    bgTop: '#ffe3cf',
    bgBottom: '#f3a0a8',
    glow: '#fff6dc',
    path: '#fff0e2',
    stone: '#e9949a',
    mech: '#f7b955',
    goal: '#ffffff',
  },
  start: 'l0',
  goal: 'r3',
  mechanisms: [
    {
      type: 'rotator',
      id: 'bridge',
      pivot: [4, 0, 0],
      axis: 'y',
      initial: 1,
      handle: { pos: [4, -2, 0], normal: [0, 0, 1] },
    },
  ],
  illusions: [],
  blocks: [
    // 左岸
    walk('l0', 0, 0, 3),
    walk('l1', 0, 0, 2),
    walk('l2', 0, 0, 1),
    walk('l3', 0, 0, 0),
    walk('l4', 1, 0, 0),
    walk('l5', 2, 0, 0),
    // 断桥（状态 0 时沿 x 接通）
    walk('br0', 3, 0, 0, 'bridge'),
    walk('br1', 4, 0, 0, 'bridge'),
    walk('br2', 5, 0, 0, 'bridge'),
    // 右岸
    walk('r0', 6, 0, 0),
    walk('r1', 7, 0, 0),
    walk('r2', 7, 0, -1),
    walk('r3', 7, 0, -2),
    // 装饰
    ...column('cl', 0, -1, 3, 2),
    ...column('cm', 2, -1, 0, 3),
    ...column('cp', 4, -1, 0, 3),
    ...column('cr', 6, -1, 0, 3),
    ...column('cg', 7, -1, -2, 2),
    ...column('tw', 7, 2, -3, 5),
  ],
};
