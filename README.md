# 回廊 Huilang

[中文](#中文) | [English](#english)

**在线试玩 / Play:** https://0xaliya.github.io/huilang/

---

## 中文

一个浏览器里的等距视错觉解谜游戏。规则只有一条：**看起来连着的路，就是连着的。**

首版三关，各引入一种机制：

| 关卡 | 机制 | 最少机关操作 |
| --- | --- | --- |
| 一 · 初阶 | 旋转机关 | 1 |
| 二 · 错位 | 视错觉连接 | 2 |
| 三 · 潮汐 | 滑动平台 + 组合 | 4 |

鼠标和触屏都能玩：点路面行走，点或拖转轮转动机关，上下拖动金色方块滑动平台。进度存在浏览器的 localStorage。

### 技术栈

- **Vite 8** — 开发服务器与打包
- **TypeScript 7** — 严格模式
- **Three.js** — 正交相机固定在 (1,1,1) 方向的等距渲染
- **Web Audio API** — 全部音效实时合成，没有音频文件
- **Vitest 5** — 单元测试与关卡校验
- **GitHub Pages** — 从 `gh-pages` 分支发布

美术全部是程序化几何体，没有贴图和模型文件。

### 原理

沿视线方向 (1,1,1) 平移一个方块，它在正交投影下的屏幕位置不变。所以两个 3D 上相隔很远的顶面，只要屏幕位置差一格，看起来就是相邻的。游戏把这种「视错觉边」当成真的路：角色走过去时沿视线换层，屏幕上位置连续，看不出跳变。

### 目录结构

```
src/
  engine/   行走图、寻路、机关状态、投影、求解器（纯逻辑，不依赖 Three.js）
  render/   场景、相机、角色与机关动画、输入拾取
  levels/   三关的数据
  ui/       HTML 叠加层界面
  audio/    合成音效
tests/      引擎单元测试、关卡校验
```

### 本地运行

```bash
npm install
npm run dev      # 开发服务器
npm test         # 测试
npm run build    # 类型检查 + 打包
npm run deploy   # 测试、打包并推到 gh-pages 分支
```

### 关卡校验

每一关都由测试自动验证：

- 求解器在「角色位置 × 全部机关状态」空间搜索，证明可通关，且最少操作数与设计一致
- 不动机关时终点不可达
- 每条视错觉边两端的屏幕距离正好是一格
- 画面上相邻的顶面一定连通，没有两个顶面在画面上重合
- 可行走的顶面和站在上面的角色不会被别的方块挡住

### 加一关

在 `src/levels/` 新建一个数据文件，声明方块、机关、视错觉边、起点、终点和 `minOps`，再加进 `src/levels/index.ts`。跑 `npm test`，上面的校验会自动套用到新关卡。

---

## English

An isometric optical-illusion puzzle game for the browser. It has one rule: **if a path looks connected, it is connected.**

The first version has three levels, each introducing one mechanic:

| Level | Mechanic | Minimum moves |
| --- | --- | --- |
| 1 · 初阶 (First Step) | Rotating mechanism | 1 |
| 2 · 错位 (Misaligned) | Illusion links | 2 |
| 3 · 潮汐 (Tide) | Sliding platforms, combined | 4 |

Works with mouse and touch: tap a tile to walk, tap or drag a wheel to rotate, drag the golden blocks up and down to slide them. Progress is saved in localStorage. The interface is in Chinese.

### Tech stack

- **Vite 8** — dev server and bundling
- **TypeScript 7** — strict mode
- **Three.js** — isometric rendering with an orthographic camera fixed along (1,1,1)
- **Web Audio API** — every sound is synthesized at runtime; there are no audio files
- **Vitest 5** — unit tests and level validation
- **GitHub Pages** — published from the `gh-pages` branch

All art is procedural geometry. There are no textures or model files.

### How it works

Moving a block along the view direction (1,1,1) does not change where it appears under orthographic projection. So two walkable tops that are far apart in 3D look adjacent whenever their screen positions are one tile apart. The game treats these "illusion edges" as real paths: the character switches depth along the view direction while crossing, and because its screen position stays continuous, the jump is invisible.

### Project layout

```
src/
  engine/   walk graph, pathfinding, mechanism state, projection, solver (pure logic, no Three.js)
  render/   scene, camera, character and mechanism animation, input picking
  levels/   data for the three levels
  ui/       HTML overlay screens
  audio/    synthesized sound effects
tests/      engine unit tests and level validation
```

### Running locally

```bash
npm install
npm run dev      # dev server
npm test         # tests
npm run build    # type-check and bundle
npm run deploy   # test, build and push to the gh-pages branch
```

### Level validation

Every level is checked automatically by the tests:

- A solver searches the space of character position × all mechanism states, proving the level is solvable and that the minimum number of moves matches the design
- The goal is unreachable without touching a mechanism
- The two ends of every illusion edge are exactly one tile apart on screen
- Tops that look adjacent on screen are always connected, and no two tops overlap on screen
- No block hides a walkable top or the character standing on it

### Adding a level

Create a data file in `src/levels/` declaring blocks, mechanisms, illusion edges, start, goal and `minOps`, then add it to `src/levels/index.ts`. Run `npm test`; the checks above apply to the new level automatically.
