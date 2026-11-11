import type { Axis, Vec3 } from './types';

export const AXIS_INDEX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

export const posKey = (v: Vec3): string => `${v[0]},${v[1]},${v[2]}`;

/** 绕 pivot 的某根轴转 turns 个 90°（右手系，与 Three.js 的 rotation 同向）。 */
export function rotateQuarter(v: Vec3, pivot: Vec3, axis: Axis, turns: number): Vec3 {
  let x = v[0] - pivot[0];
  let y = v[1] - pivot[1];
  let z = v[2] - pivot[2];
  const n = ((turns % 4) + 4) % 4;
  for (let i = 0; i < n; i++) {
    if (axis === 'y') [x, z] = [z, -x];
    else if (axis === 'x') [y, z] = [-z, y];
    else [x, y] = [-y, x];
  }
  return [x + pivot[0], y + pivot[1], z + pivot[2]];
}

/**
 * 相机固定在 (1,1,1) 方向的正交投影。
 * 屏幕右方向是 (1,0,-1)/√2，上方向是 (-1,2,-1)/√6。
 */
export function project(v: Vec3): [number, number] {
  return [(v[0] - v[2]) / Math.SQRT2, (2 * v[1] - v[0] - v[2]) / Math.sqrt(6)];
}

/** 沿 x 或 z 走一格在屏幕上的长度。 */
export const STEP_LEN = Math.sqrt(2 / 3);

export function screenDist(a: Vec3, b: Vec3): number {
  const [ax, ay] = project(a);
  const [bx, by] = project(b);
  return Math.hypot(ax - bx, ay - by);
}

/**
 * 屏幕格坐标：沿视线 (1,1,1) 平移不改变屏幕位置，
 * 所以把方块沿视线推到 y=0 平面，得到的 (x-y, z-y) 相同就表示屏幕上重合。
 */
export function lattice(v: Vec3): [number, number] {
  return [v[0] - v[1], v[2] - v[1]];
}
