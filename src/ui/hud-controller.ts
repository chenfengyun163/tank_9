import type { DomShellResult } from '../bootstrap/dom-shell';
import { APP_CONFIG } from '../core/config';
import { BUILDABLE_BUILDINGS, ContentRegistry, UNIT_CONFIG_BY_KIND } from '../core/content-registry';
import type {
  BuildMode,
  CommandMode,
  EntitySnapshot,
  GameState,
  ProductionKind,
  SessionPhase,
  TechnologyId
} from '../core/game-state';
import { TeamType } from '../core/team-type';
import {
  canAffordForUi,
  getAffordableReason,
  getAllCompletedTechnologies,
  getBuildAvailability,
  getProduceAvailability,
  getTechnologyButtonsForBuilding
} from '../core/unlock-rules';
import { type WorldViewportRect, worldViewportToMinimapRect } from './minimap-viewport';

interface HudCallbacks {
  onStartGame(): void;
  onRestart(): void;
  onBuildMode(mode: Exclude<BuildMode, 'none'>): void;
  onEnterAttackMoveMode(): void;
  onEnterPatrolMode(): void;
  onEnterRallyPointMode(): void;
  onProduce(buildingId: string, unitKind: ProductionKind): void;
  onResearch(buildingId: string, techId: TechnologyId): void;
}

export interface HudCameraState {
  focus: { x: number; z: number };
  zoom: number;
  viewportWorldRect: WorldViewportRect;
}

const PHASE_LABELS: Record<SessionPhase, string> = {
  boot: '未开始',
  playing: '进行中',
  victory: '胜利',
  defeat: '失败'
};

const BUILD_MODE_LABELS: Record<BuildMode, string> = {
  none: '标准',
  'buildings.resourceDropoff': '回收站',
  'buildings.barracks': '兵营',
  'buildings.vehicleFactory': '载具工厂',
  'buildings.powerPlant': '电站',
  'buildings.supplyDepot': '补给站',
  'buildings.defenseTower': '防御塔',
  'buildings.techLab': '科技中心'
};

const COMMAND_MODE_LABELS: Record<CommandMode, string> = {
  none: '标准',
  attackMove: '攻击移动',
  setRallyPoint: '设置集合点',
  patrol: '巡逻'
};

const ENTITY_LABELS: Record<EntitySnapshot['kind'], string> = {
  worker: '工程单位',
  scout: '侦察车',
  infantry: '步兵',
  lancer: '反甲步兵',
  tank: '前线坦克',
  artillery: '远程火炮',
  mainBase: '主基地',
  resourceDropoff: '回收站',
  barracks: '兵营',
  vehicleFactory: '载具工厂',
  powerPlant: '电站',
  supplyDepot: '补给站',
  defenseTower: '防御塔',
  techLab: '科技中心',
  resourceNode: '资源点'
};

export class HudController {
  private readonly topBar = document.createElement('div');
  private readonly selectionPanel = document.createElement('div');
  private readonly commandPanel = document.createElement('div');
  private readonly messageBar = document.createElement('div');
  private readonly banner = document.createElement('div');
  private readonly loadingOverlay = document.createElement('div');
  private readonly minimapPanel = document.createElement('div');
  private readonly minimapCanvas = document.createElement('canvas');
  private cameraState: HudCameraState = {
    focus: { x: APP_CONFIG.camera.lookAt.x, z: APP_CONFIG.camera.lookAt.z },
    zoom: 1,
    viewportWorldRect: { minX: -8, maxX: 8, minZ: -7, maxZ: 7 }
  };

  public constructor(private readonly shell: DomShellResult, private readonly callbacks: HudCallbacks) {
    this.setup();
    this.shell.hudRoot.append(
      this.topBar,
      this.selectionPanel,
      this.commandPanel,
      this.messageBar,
      this.minimapPanel,
      this.banner,
      this.loadingOverlay
    );
  }

  public setCameraState(cameraState: HudCameraState): void {
    this.cameraState = cameraState;
  }

  public render(state: Readonly<GameState>): void {
    this.renderTopBar(state);
    this.renderSelection(state);
    this.renderCommands(state);
    this.renderMessageBar(state);
    this.renderBanner(state);
    this.renderLoading(state);
    this.renderMinimap(state);
  }

  private setup(): void {
    this.panel(this.topBar, { top: '16px', left: '16px', right: '16px', minHeight: '56px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' });
    this.panel(this.selectionPanel, { top: '92px', left: '16px', width: '360px', minHeight: '280px' });
    this.panel(this.commandPanel, { top: '92px', right: '16px', width: '440px', minHeight: '360px', pointerEvents: 'auto' });
    this.panel(this.messageBar, { left: '50%', bottom: '16px', transform: 'translateX(-50%)', width: 'min(960px, calc(100% - 32px))', minHeight: '56px', display: 'flex', alignItems: 'center', gap: '12px' });
    this.panel(this.minimapPanel, { right: '16px', bottom: '86px', width: '246px', minHeight: '246px', pointerEvents: 'none' });
    this.minimapCanvas.width = 210;
    this.minimapCanvas.height = 210;
    this.minimapCanvas.style.width = '210px';
    this.minimapCanvas.style.height = '210px';
    this.minimapCanvas.style.borderRadius = '12px';
    this.minimapPanel.append(this.title('小地图'), this.minimapCanvas);

    this.banner.style.position = 'absolute';
    this.banner.style.inset = '0';
    this.banner.style.display = 'none';
    this.banner.style.alignItems = 'center';
    this.banner.style.justifyContent = 'center';
    this.banner.style.pointerEvents = 'none';

    this.loadingOverlay.style.position = 'absolute';
    this.loadingOverlay.style.inset = '0';
    this.loadingOverlay.style.display = 'none';
    this.loadingOverlay.style.alignItems = 'center';
    this.loadingOverlay.style.justifyContent = 'center';
    this.loadingOverlay.style.background = 'rgba(8, 12, 18, 0.95)';
    this.loadingOverlay.style.color = '#f5fbff';
    this.loadingOverlay.style.zIndex = '1000';
  }

  private panel(element: HTMLDivElement, styles: Record<string, string>): void {
    element.style.position = 'absolute';
    element.style.padding = '14px 16px';
    element.style.border = '1px solid rgba(255,255,255,0.1)';
    element.style.borderRadius = '16px';
    element.style.background = 'rgba(8,12,18,0.82)';
    element.style.backdropFilter = 'blur(10px)';
    element.style.boxShadow = '0 18px 36px rgba(0,0,0,0.22)';
    element.style.color = '#f5fbff';
    element.style.pointerEvents = styles.pointerEvents ?? 'none';
    for (const [k, v] of Object.entries(styles)) {
      element.style.setProperty(k.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`), v);
    }
  }

  private renderTopBar(state: Readonly<GameState>): void {
    const economy = state.economy.byTeam[TeamType.Player];
    const tier = state.research.byTeam[TeamType.Player].tier;
    this.topBar.replaceChildren();
    const metrics = document.createElement('div');
    metrics.style.display = 'flex';
    metrics.style.gap = '18px';
    metrics.innerHTML = [
      this.metric('人力', `${Math.floor(economy.manpower)}`),
      this.metric('电力', `${Math.floor(economy.power)}`),
      this.metric('人口', `${economy.supplyUsed}/${economy.supplyCap}`),
      this.metric('阶段', tier),
      this.metric('状态', PHASE_LABELS[state.session.phase]),
      this.metric('时间', this.clock(state.session.elapsedSeconds))
    ].join('');
    const groups = document.createElement('div');
    groups.style.display = 'flex';
    groups.style.gap = '6px';
    for (const [index, ids] of Object.entries(state.controlGroups.groups)) {
      const chip = document.createElement('div');
      chip.style.padding = '6px 8px';
      chip.style.borderRadius = '10px';
      chip.style.fontSize = '12px';
      chip.style.background = Number(index) === state.controlGroups.lastSelectedGroup ? 'rgba(41,81,112,0.78)' : 'rgba(255,255,255,0.04)';
      chip.textContent = `${index}: ${ids.length}`;
      groups.append(chip);
    }
    const actions = document.createElement('div');
    actions.style.pointerEvents = 'auto';
    actions.append(this.button(state.session.phase === 'boot' ? '开始游戏' : '重新开始', () => {
      if (state.session.phase === 'boot') this.callbacks.onStartGame();
      else this.callbacks.onRestart();
    }));
    this.topBar.append(metrics, groups, actions);
  }

  private renderSelection(state: Readonly<GameState>): void {
    this.selectionPanel.replaceChildren();
    const selected = state.selection.selectedIds.map((id) => state.entities.byId[id]).filter((e): e is EntitySnapshot => Boolean(e));
    this.selectionPanel.append(this.title('当前选中'));
    if (selected.length === 0) {
      this.selectionPanel.append(this.text('左键单选或框选，右键执行移动、攻击、采集、维修和建造。'));
      this.selectionPanel.append(this.text('快捷键：A 攻击移动，P 巡逻，S 停止，H 原地警戒，R 设置集合点。'));
      return;
    }
    for (const entity of selected) {
      const card = document.createElement('div');
      card.style.padding = '10px 12px';
      card.style.marginBottom = '8px';
      card.style.borderRadius = '12px';
      card.style.background = 'rgba(255,255,255,0.04)';
      const queue = state.production.queuesByEntityId[entity.id] ?? [];
      const activeResearch = state.research.byTeam[entity.team].activeByBuildingId[entity.id];
      card.innerHTML = `<div style="display:flex;justify-content:space-between;"><strong>${ENTITY_LABELS[entity.kind]}</strong><span>${entity.team === TeamType.Player ? '我方' : entity.team === TeamType.Enemy ? '敌方' : '中立'}</span></div><div style="margin-top:6px;">生命 ${Math.ceil(entity.hp)} / ${entity.maxHp}</div><div style="margin-top:6px;">${!entity.built ? `建造进度 ${Math.round((entity.buildProgress / Math.max(1, entity.buildTime)) * 100)}%` : entity.productionKinds.length > 0 ? `生产队列 ${queue.length}/${APP_CONFIG.gameplay.queueLimitPerBuilding}` : `命令 ${entity.order.type}`}</div><div style="margin-top:6px;">${activeResearch ? `研究中：${ContentRegistry.getTechnology(activeResearch.techId).name} ${Math.round((1 - activeResearch.remainingTime / activeResearch.totalTime) * 100)}%` : entity.rallyPoint ? `集合点 (${entity.rallyPoint.x.toFixed(1)}, ${entity.rallyPoint.z.toFixed(1)})` : '未设置集合点'}</div>`;
      this.selectionPanel.append(card);
    }
  }

  private renderCommands(state: Readonly<GameState>): void {
    this.commandPanel.replaceChildren();
    const selected = state.selection.selectedIds.map((id) => state.entities.byId[id]).filter((e): e is EntitySnapshot => Boolean(e));
    this.commandPanel.append(this.title('指令面板'));
    const lock = this.matchLock(state);
    if (lock) {
      this.commandPanel.append(this.text(lock));
      return;
    }
    if (selected.length === 0) {
      this.commandPanel.append(this.text('先选择工程单位、部队或生产建筑。'));
      return;
    }
    const first = selected[0];
    const allWorkers = selected.every((e) => e.kind === 'worker');
    const allUnits = selected.every((e) => e.category === 'unit');

    if (allWorkers) {
      this.commandPanel.append(this.title('建造菜单'));
      this.commandPanel.append(this.grid(BUILDABLE_BUILDINGS.map((buildMode) => {
        const rule = ContentRegistry.getRule(buildMode);
        const availability = getBuildAvailability(state, TeamType.Player, buildMode);
        const reason = availability.reason ?? getAffordableReason(state, TeamType.Player, rule.resourceCost, false);
        return this.action(`建造 ${rule.label}`, this.cost(rule.resourceCost, false), () => this.callbacks.onBuildMode(buildMode), reason);
      })));
    }

    if (allUnits) {
      this.commandPanel.append(this.title('战术命令'));
      this.commandPanel.append(this.grid([
        this.action('攻击移动 (A)', '沿途自动接敌', () => this.callbacks.onEnterAttackMoveMode(), null),
        this.action('巡逻 (P)', '往返巡逻路线', () => this.callbacks.onEnterPatrolMode(), null)
      ]));
    }

    if (selected.length === 1 && first.category === 'building') {
      if (first.productionKinds.length > 0) {
        this.commandPanel.append(this.action('设置集合点 (R)', '为新单位指定出兵方向', () => this.callbacks.onEnterRallyPointMode(), null));
      }
      if (first.built && first.productionKinds.length > 0) {
        const queueLength = state.production.queuesByEntityId[first.id]?.length ?? 0;
        this.commandPanel.append(this.title('生产队列'));
        this.commandPanel.append(this.grid(first.productionKinds.map((kind) => {
          const rule = ContentRegistry.getRule(UNIT_CONFIG_BY_KIND[kind]);
          const availability = getProduceAvailability(state, TeamType.Player, first, kind);
          const reason = availability.reason
            ?? (queueLength >= APP_CONFIG.gameplay.queueLimitPerBuilding ? '生产队列已满。' : null)
            ?? getAffordableReason(state, TeamType.Player, rule.resourceCost, true);
          return this.action(`生产 ${rule.label}`, this.cost(rule.resourceCost, true), () => this.callbacks.onProduce(first.id, kind), reason);
        })));
      }
      if (first.built && first.researchKinds.length > 0) {
        this.commandPanel.append(this.title('科技研究'));
        const active = state.research.byTeam[first.team].activeByBuildingId[first.id];
        const techButtons = getTechnologyButtonsForBuilding(state, first).map(({ tech, availability }) => {
          const reason = availability.status === 'completed'
            ? '已完成。'
            : availability.reason
              ?? (active ? '该建筑已有研究在进行中。' : null)
              ?? (!canAffordForUi(state, TeamType.Player, tech.cost, false) ? getAffordableReason(state, TeamType.Player, tech.cost, false) : null);
          const suffix = active?.techId === tech.id ? `${Math.round((1 - active.remainingTime / active.totalTime) * 100)}%` : `${Math.round(tech.researchTime)} 秒`;
          return this.action(tech.name, `${this.cost(tech.cost, false)} | ${suffix}`, () => this.callbacks.onResearch(first.id, tech.id), availability.status === 'available' && !active ? reason : reason);
        });
        this.commandPanel.append(this.grid(techButtons));
        const completed = getAllCompletedTechnologies(state, TeamType.Player);
        if (completed.length > 0) this.commandPanel.append(this.text(`已完成：${completed.map((t) => t.name).join('、')}`));
      }
    }

    const mode = state.orders.buildMode !== 'none' ? `建造 ${BUILD_MODE_LABELS[state.orders.buildMode]}` : COMMAND_MODE_LABELS[state.orders.commandMode];
    if (mode !== '标准') this.commandPanel.append(this.text(`当前模式：${mode}。右键确认，Esc 取消。`));
    this.commandPanel.append(this.text('提示：晶矿提供人力，能井提供电力。工人需要把资源运回主基地或回收站。'));
  }

  private renderMessageBar(state: Readonly<GameState>): void {
    this.messageBar.replaceChildren();
    const latest = state.orders.notifications.at(-1) ?? '战场已就绪。';
    this.messageBar.append(this.text(latest));
  }

  private renderBanner(state: Readonly<GameState>): void {
    const show = state.session.phase === 'boot' || state.session.phase === 'victory' || state.session.phase === 'defeat';
    this.banner.style.display = show ? 'flex' : 'none';
    this.banner.replaceChildren();
    if (!show) return;
    const panel = document.createElement('div');
    panel.style.minWidth = '340px';
    panel.style.padding = '28px';
    panel.style.borderRadius = '20px';
    panel.style.background = 'rgba(6,10,16,0.94)';
    panel.style.border = '1px solid rgba(255,255,255,0.1)';
    panel.style.pointerEvents = 'auto';
    panel.style.textAlign = 'center';
    const title = document.createElement('div');
    title.style.fontSize = '32px';
    title.style.fontWeight = '700';
    title.style.marginBottom = '12px';
    title.textContent = state.session.phase === 'boot' ? '遭遇战待开始' : state.session.phase === 'victory' ? '胜利' : '失败';
    panel.append(title, this.text(state.session.phase === 'boot' ? '点击“开始游戏”后，资源增长、AI 与战斗逻辑才会正式启动。' : state.session.phase === 'victory' ? '敌方主基地已被摧毁。' : '我方主基地已被摧毁。'), this.button(state.session.phase === 'boot' ? '开始游戏' : '重新开始', () => state.session.phase === 'boot' ? this.callbacks.onStartGame() : this.callbacks.onRestart()));
    this.banner.append(panel);
  }

  private renderLoading(state: Readonly<GameState>): void {
    this.loadingOverlay.style.display = state.session.isLoading ? 'flex' : 'none';
    this.loadingOverlay.textContent = state.session.isLoading ? `正在加载战场 ${Math.round(state.session.loadingProgress * 100)}%` : '';
  }

  private renderMinimap(state: Readonly<GameState>): void {
    const ctx = this.minimapCanvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = this.minimapCanvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#091019';
    ctx.fillRect(0, 0, width, height);
    const cellWidth = width / state.visibility.width;
    const cellHeight = height / state.visibility.depth;
    for (const cell of state.visibility.cells) {
      ctx.fillStyle = cell.status === 'visible' ? 'rgba(90,155,120,0.55)' : cell.status === 'explored' ? 'rgba(45,62,74,0.55)' : 'rgba(2,4,8,0.96)';
      ctx.fillRect(cell.x * cellWidth, cell.z * cellHeight, cellWidth + 1, cellHeight + 1);
    }
    for (const entityId of state.entities.allIds) {
      const entity = state.entities.byId[entityId];
      if (!entity?.alive) continue;
      if (entity.team === TeamType.Enemy && !this.isVisible(state, entity.position)) continue;
      const point = this.worldToMinimap(state, entity.position, width, height);
      ctx.fillStyle = entity.team === TeamType.Player ? '#6cd6ff' : entity.team === TeamType.Enemy ? '#ff7e6c' : entity.resourceType === 'power' ? '#d8d65a' : '#88d3c1';
      const size = entity.category === 'building' ? 5 : 3;
      ctx.fillRect(point.x - size * 0.5, point.y - size * 0.5, size, size);
    }
    for (const memory of Object.values(state.visibility.enemyMemories)) {
      if (memory.visible || !memory.alive) continue;
      const point = this.worldToMinimap(state, memory.position, width, height);
      ctx.strokeStyle = 'rgba(255,126,108,0.7)';
      ctx.strokeRect(point.x - 3, point.y - 3, 6, 6);
    }
    const rect = worldViewportToMinimapRect(this.cameraState.viewportWorldRect, state.world.width, state.world.depth, width, height);
    ctx.strokeStyle = '#f5fbff';
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  }

  private action(label: string, sublabel: string, onClick: () => void, reason: string | null): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '4px';
    wrap.append(this.button(label, onClick, Boolean(reason), reason ?? ''));
    const text = this.text(reason ?? sublabel);
    text.style.fontSize = '12px';
    text.style.color = reason ? '#9eb5c9' : '#b9ccdd';
    wrap.append(text);
    return wrap;
  }

  private grid(items: HTMLDivElement[]): HTMLDivElement {
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '1fr 1fr';
    grid.style.gap = '8px';
    for (const item of items) grid.append(item);
    return grid;
  }

  private button(label: string, onClick: () => void, disabled = false, tooltip = ''): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled = disabled;
    button.title = tooltip;
    button.style.pointerEvents = 'auto';
    button.style.padding = '10px 12px';
    button.style.border = '1px solid rgba(255,255,255,0.12)';
    button.style.borderRadius = '12px';
    button.style.background = disabled ? 'linear-gradient(180deg, #2c333c 0%, #202831 100%)' : 'linear-gradient(180deg, #17314c 0%, #102436 100%)';
    button.style.color = '#f5fbff';
    button.style.cursor = disabled ? 'not-allowed' : 'pointer';
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!disabled) onClick();
    });
    return button;
  }

  private title(text: string): HTMLDivElement {
    const title = document.createElement('div');
    title.textContent = text;
    title.style.fontSize = '12px';
    title.style.textTransform = 'uppercase';
    title.style.letterSpacing = '0.12em';
    title.style.color = '#9eb5c9';
    title.style.marginBottom = '10px';
    return title;
  }

  private text(value: string): HTMLDivElement {
    const element = document.createElement('div');
    element.style.fontSize = '14px';
    element.style.lineHeight = '1.5';
    element.style.color = '#d7e7f6';
    element.textContent = value;
    return element;
  }

  private metric(label: string, value: string): string {
    return `<div><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#99b2c9;">${label}</div><div style="font-size:18px;font-weight:600;color:#f7fbff;">${value}</div></div>`;
  }

  private matchLock(state: Readonly<GameState>): string | null {
    if (state.session.phase === 'boot') return '对局尚未开始，请先点击“开始游戏”。';
    if (state.session.phase === 'victory' || state.session.phase === 'defeat') return '本局已经结束，请重新开始。';
    return null;
  }

  private cost(cost: { manpower: number; power: number; supply: number }, includeSupply: boolean): string {
    return `人力 ${cost.manpower} / 电力 ${cost.power}${includeSupply && cost.supply > 0 ? ` / 人口 ${cost.supply}` : ''}`;
  }

  private clock(elapsedSeconds: number): string {
    const total = Math.max(0, Math.floor(elapsedSeconds));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  private worldToMinimap(state: Readonly<GameState>, position: { x: number; z: number }, width: number, height: number) {
    return { x: ((position.x + state.world.width * 0.5) / state.world.width) * width, y: ((position.z + state.world.depth * 0.5) / state.world.depth) * height };
  }

  private isVisible(state: Readonly<GameState>, position: { x: number; z: number }): boolean {
    const visibility = state.visibility;
    const cellX = Math.max(0, Math.min(visibility.width - 1, Math.floor((position.x + state.world.width * 0.5) / visibility.gridSize)));
    const cellZ = Math.max(0, Math.min(visibility.depth - 1, Math.floor((position.z + state.world.depth * 0.5) / visibility.gridSize)));
    return visibility.visibleCellKeys.includes(`${cellX}:${cellZ}`);
  }
}
