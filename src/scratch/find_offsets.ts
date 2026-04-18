import { type Asset, type MeshInstance, type RenderComponent } from 'playcanvas';

interface ContainerResourceLike {
  instantiateRenderEntity(): { findComponents(type: 'render'): RenderComponent[]; destroy(): void };
}

export function findMeshIslandCenters(asset: Asset): void {
  if (!isContainerResource(asset.resource)) {
    return;
  }

  const modelEntity = asset.resource.instantiateRenderEntity();

  console.log('--- Model Island Finder ---');
  const meshInstances = modelEntity.findComponents('render').flatMap((render) => render.meshInstances ?? []);

  meshInstances.forEach((meshInstance: MeshInstance, index: number) => {
    const aabb = meshInstance.aabb;
    console.log(`MeshInstance ${index}:`);
    console.log(`  Name: ${meshInstance.node.name}`);
    console.log(`  Center: ${aabb.center.x}, ${aabb.center.y}, ${aabb.center.z}`);
    console.log(`  HalfExtents: ${aabb.halfExtents.x}, ${aabb.halfExtents.y}, ${aabb.halfExtents.z}`);
  });

  modelEntity.destroy();
}

function isContainerResource(resource: Asset['resource']): resource is ContainerResourceLike {
  return typeof resource === 'object' && resource !== null && 'instantiateRenderEntity' in resource;
}
