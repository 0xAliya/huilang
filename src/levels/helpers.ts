import type { BlockDef } from '../engine/types';

/** 可行走方块。 */
export const walk = (id: string, x: number, y: number, z: number, mech?: string): BlockDef => ({
  id,
  pos: [x, y, z],
  walk: true,
  mech,
});

/** 装饰立柱：从 yTop 往下 n 块，不可行走。 */
export const column = (id: string, x: number, yTop: number, z: number, n: number): BlockDef[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${id}${i}`, pos: [x, yTop - i, z] as const }));
