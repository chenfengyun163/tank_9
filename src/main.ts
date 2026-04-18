import { bootstrapApp } from './bootstrap/app-bootstrap';
import { createDomShell } from './bootstrap/dom-shell';

(async () => {
  const shell = createDomShell();

  await bootstrapApp({
    shell
  });
})();
