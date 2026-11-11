import type { LevelDef } from '../engine/types';

export interface UIHandlers {
  onPlay(index: number): void;
  onReset(): void;
  onLeaveLevel(): void;
  /** 切换静音，返回切换后的状态。 */
  onToggleMute(): boolean;
}

const NUMERALS = ['一', '二', '三', '四', '五', '六'];
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** HTML 叠加层：标题页、选关页、关内 HUD、过关提示、通关页。 */
export class UI {
  private readonly app = $('app');
  private readonly screens = ['screen-title', 'screen-select', 'screen-end'].map((id) => $(id));
  private readonly hud = $('hud');
  private readonly hint = $('hint');
  private readonly toastEl = $('toast');
  private readonly list = $('level-list');
  private readonly muteBtn = $<HTMLButtonElement>('btn-mute');
  private unlocked = 1;

  constructor(private readonly levels: LevelDef[], private readonly handlers: UIHandlers, muted: boolean) {
    $('btn-start').addEventListener('click', () => this.showSelect());
    $('btn-home').addEventListener('click', () => this.showTitle());
    $('btn-again').addEventListener('click', () => this.showSelect());
    $('btn-back').addEventListener('click', () => {
      handlers.onLeaveLevel();
      this.showSelect();
    });
    $('btn-reset').addEventListener('click', () => handlers.onReset());
    this.muteBtn.addEventListener('click', () => this.setMuted(handlers.onToggleMute()));
    this.setMuted(muted);
  }

  setUnlocked(n: number): void {
    this.unlocked = n;
  }

  private show(id: string | null): void {
    for (const s of this.screens) s.classList.toggle('hidden', s.id !== id);
    this.hud.classList.toggle('hidden', id !== null);
    this.hint.classList.toggle('hidden', id !== null);
    this.toastEl.classList.add('hidden');
  }

  private setMuted(muted: boolean): void {
    this.muteBtn.classList.toggle('muted', muted);
    this.muteBtn.setAttribute('aria-label', muted ? '打开声音' : '静音');
    this.muteBtn.title = muted ? '打开声音' : '静音';
  }

  showTitle(): void {
    this.show('screen-title');
  }

  showSelect(): void {
    this.list.replaceChildren(
      ...this.levels.map((level, i) => {
        const btn = document.createElement('button');
        btn.className = 'level-card';
        btn.disabled = i >= this.unlocked;
        btn.style.setProperty('--c1', level.palette.bgTop);
        btn.style.setProperty('--c2', level.palette.bgBottom);
        const num = document.createElement('span');
        num.className = 'num';
        num.textContent = NUMERALS[i];
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = btn.disabled ? '未解锁' : level.name;
        btn.append(num, name);
        btn.addEventListener('click', () => this.handlers.onPlay(i));
        return btn;
      }),
    );
    this.show('screen-select');
  }

  showLevel(level: LevelDef, index: number): void {
    this.show(null);
    const p = level.palette;
    this.app.style.setProperty('--bg-top', p.bgTop);
    this.app.style.setProperty('--bg-bottom', p.bgBottom);
    this.app.style.setProperty('--glow', p.glow);
    // 浅色背景上用深色字，深色背景上用白字
    const top = parseInt(p.bgTop.slice(1), 16);
    const luma = 0.299 * (top >> 16) + 0.587 * ((top >> 8) & 255) + 0.114 * (top & 255);
    this.app.classList.toggle('dark', luma < 128);
    $('level-title').textContent = `${NUMERALS[index]} · ${level.name}`;
    this.hint.textContent = level.hint;
  }

  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
  }

  showEnd(): void {
    this.show('screen-end');
  }
}
