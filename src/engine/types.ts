export type Vec3 = readonly [number, number, number];
export type Axis = 'x' | 'y' | 'z';

/** 每个机关当前所处的离散状态。 */
export type MechState = Record<string, number>;

export interface BlockDef {
  id: string;
  /** 整数格坐标。属于机关的方块写的是机关状态 0 时的位置。 */
  pos: Vec3;
  /** 顶面是否是可行走节点。 */
  walk?: boolean;
  /** 所属机关 id。 */
  mech?: string;
}

/** 旋转机关：绕固定轴，每个状态 90°，共 4 个状态。 */
export interface RotatorDef {
  type: 'rotator';
  id: string;
  pivot: Vec3;
  axis: Axis;
  initial: number;
  /** 转轮把手：贴在哪个方块的哪个面上（世界坐标，不随机关转）。 */
  handle?: { pos: Vec3; normal: Vec3 };
}

/** 滑动平台：沿单轴移动，停在 stops 列出的偏移量上。 */
export interface SliderDef {
  type: 'slider';
  id: string;
  axis: Axis;
  stops: number[];
  initial: number;
}

export type MechDef = RotatorDef | SliderDef;

/** 视错觉边：3D 上不相邻，投影后相邻；只在 when 条件满足时生效。 */
export interface IllusionDef {
  a: string;
  b: string;
  when: MechState;
}

export interface Palette {
  bgTop: string;
  bgBottom: string;
  glow: string;
  path: string;
  stone: string;
  mech: string;
  goal: string;
}

export interface LevelDef {
  id: string;
  name: string;
  hint: string;
  palette: Palette;
  blocks: BlockDef[];
  mechanisms: MechDef[];
  illusions: IllusionDef[];
  start: string;
  goal: string;
  /** 通关所需的最少机关操作数，由求解器测试校验。 */
  minOps: number;
}
