import { Asset, type AppBase } from 'playcanvas';

import type { AssetManifest } from './asset-manifest';

export const preloadGlbAssets = (
  app: AppBase,
  manifest: AssetManifest,
  onProgress?: (progress: number) => void
): Promise<Map<string, Asset>> => {
  if (manifest.glbAssets.length === 0) {
    onProgress?.(1);
    return Promise.resolve(new Map());
  }

  const result = new Map<string, Asset>();
  const total = manifest.glbAssets.length;
  let finished = 0;

  const updateProgress = (): void => {
    finished += 1;
    onProgress?.(finished / total);
  };

  const loadAsset = (entry: { key: string; url: string }): Promise<void> => new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.warn(`GLB load timed out for: ${entry.url}. Proceeding with fallback.`);
      updateProgress();
      resolve();
    }, 60000);

    const existing = app.assets.findByTag('glb-container').find((asset) => asset.name === entry.key);
    if (existing && existing.resource) {
      clearTimeout(timeoutId);
      result.set(entry.key, existing);
      updateProgress();
      resolve();
      return;
    }

    const asset = new Asset(entry.key, 'container', { url: entry.url });
    asset.tags.add('glb-container');
    app.assets.add(asset);

    asset.on('load', (loadedAsset: Asset) => {
      clearTimeout(timeoutId);
      if (loadedAsset.resource) {
        result.set(entry.key, loadedAsset);
      } else {
        console.warn(`GLB "${entry.key}" loaded but resource is missing.`);
      }
      updateProgress();
      resolve();
    });

    asset.on('error', (err: unknown) => {
      clearTimeout(timeoutId);
      console.error(`Failed to load GLB "${entry.url}":`, err);
      updateProgress();
      resolve();
    });

    app.assets.load(asset);
  });

  return Promise.all(manifest.glbAssets.map(loadAsset)).then(() => result);
};
