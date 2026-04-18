import { APP_CONFIG } from '../core/config';

export interface DomShellResult {
  appRoot: HTMLDivElement;
  canvas: HTMLCanvasElement;
  overlay: HTMLDivElement;
  hudRoot: HTMLDivElement;
  marquee: HTMLDivElement;
}

const applyShellStyles = (): void => {
  document.documentElement.lang = 'zh-CN';
  document.documentElement.style.width = '100%';
  document.documentElement.style.height = '100%';
  document.documentElement.lang = 'zh-CN';
  document.body.style.width = '100%';
  document.body.style.height = '100%';
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.style.background = '#05070b';
};

export const createDomShell = (): DomShellResult => {
  applyShellStyles();
  document.title = 'RTS 指挥战场';

  const appRoot = document.createElement('div');
  appRoot.id = APP_CONFIG.shell.appId;
  appRoot.style.position = 'relative';
  appRoot.style.width = '100%';
  appRoot.style.height = '100%';
  appRoot.style.fontFamily = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';
  appRoot.style.color = '#eff5ff';
  appRoot.style.background = '#05070b';
  appRoot.style.userSelect = 'none';

  const canvas = document.createElement('canvas');
  canvas.id = APP_CONFIG.shell.canvasId;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.background = 'linear-gradient(180deg, #1d2230 0%, #0f1116 100%)';

  const overlay = document.createElement('div');
  overlay.id = APP_CONFIG.shell.overlayId;
  overlay.style.position = 'absolute';
  overlay.style.inset = '0';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '1';

  const hudRoot = document.createElement('div');
  hudRoot.id = APP_CONFIG.shell.hudRootId;
  hudRoot.style.position = 'absolute';
  hudRoot.style.inset = '0';
  hudRoot.style.pointerEvents = 'none';
  hudRoot.style.zIndex = '2';

  const marquee = document.createElement('div');
  marquee.id = APP_CONFIG.shell.marqueeId;
  marquee.style.position = 'absolute';
  marquee.style.display = 'none';
  marquee.style.border = '1px solid rgba(107, 214, 255, 0.95)';
  marquee.style.background = 'rgba(76, 172, 218, 0.18)';
  marquee.style.pointerEvents = 'none';
  marquee.style.zIndex = '3';

  overlay.append(hudRoot, marquee);
  appRoot.append(canvas, overlay);
  document.body.replaceChildren(appRoot);

  return {
    appRoot,
    canvas,
    overlay,
    hudRoot,
    marquee
  };
};
