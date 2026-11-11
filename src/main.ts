import './style.css';
import { Sfx } from './audio/sfx';
import { Game } from './engine/game';
import { solve } from './engine/solver';
import { levels } from './levels';
import { World } from './render/world';
import { UI } from './ui/ui';

const SAVE_KEY = 'huilang.save.v1';

interface Save {
  unlocked: number;
  muted: boolean;
}

function loadSave(): Save {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}') as Partial<Save>;
    const unlocked = Math.min(levels.length, Math.max(1, Math.floor(Number(raw.unlocked) || 1)));
    return { unlocked, muted: !!raw.muted };
  } catch {
    return { unlocked: 1, muted: false };
  }
}

const save = loadSave();
const persist = () => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // 隐私模式下存不了就算了，本次会话内进度仍然有效
  }
};

const sfx = new Sfx();
sfx.muted = save.muted;
window.addEventListener('pointerdown', () => sfx.unlock());

const world = new World(document.getElementById('stage') as HTMLCanvasElement, sfx);
let current = -1;
let game: Game | null = null;

const ui = new UI(
  levels,
  {
    onPlay: (i) => play(i),
    onReset: () => current >= 0 && play(current),
    onLeaveLevel: () => {
      current = -1;
    },
    onToggleMute: () => {
      save.muted = !save.muted;
      sfx.setMuted(save.muted);
      persist();
      return save.muted;
    },
  },
  save.muted,
);
ui.setUnlocked(save.unlocked);

function play(index: number): void {
  current = index;
  game = new Game(levels[index]);
  ui.showLevel(levels[index], index);
  world.load(game, () => onWin(index));
}

function onWin(index: number): void {
  save.unlocked = Math.max(save.unlocked, Math.min(levels.length, index + 2));
  persist();
  ui.setUnlocked(save.unlocked);
  if (index + 1 >= levels.length) {
    current = -1;
    ui.showEnd();
    return;
  }
  ui.toast(`「${levels[index].name}」已走通`);
  window.setTimeout(() => {
    if (current === index) play(index + 1);
  }, 1500);
}

ui.showTitle();

if (import.meta.env.DEV) {
  // 开发时的验收钩子：按求解器给出的步骤自动走一遍当前关
  (window as unknown as Record<string, unknown>).__huilang = {
    play,
    world,
    get game() {
      return game;
    },
    solution: () => (game ? solve(game.level) : null),
    async autoplay() {
      if (!game) return false;
      for (const step of solve(game.level)?.steps ?? []) {
        if (step.type === 'op') await world.operateTo(step.mech, step.state);
        else await world.walkTo(step.to);
      }
      return game.won;
    },
  };
}
