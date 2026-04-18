import {
  Application,
  FILLMODE_FILL_WINDOW,
  Mouse,
  RESOLUTION_AUTO,
  TouchDevice
} from 'playcanvas';

export const createPlayCanvasApp = (canvas: HTMLCanvasElement): Application => {
  const app = new Application(canvas, {
    mouse: new Mouse(document.body),
    touch: new TouchDevice(document.body)
  });

  app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(RESOLUTION_AUTO);

  return app;
};
