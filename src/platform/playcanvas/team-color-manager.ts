/**
 * 3D Asset Team Color and Art Replacement System
 * Handles dynamic repainting of low-poly models based on faction alignment.
 */

import * as pc from 'playcanvas';

export class TeamColorManager {
  /**
   * Applies a standard faction color to an entity's materials.
   * Art standard: Any mesh that needs to change color must use a material named "TeamColor_Mat".
   *
   * @param entity The root entity of the loaded GLB model
   * @param color The target faction color (e.g., Red, Blue, Green)
   * @param targetMaterialName The convention name used by 3D artists. Defaults to 'TeamColor_Mat'
   */
  static applyTeamColor(entity: pc.Entity, color: pc.Color, targetMaterialName = 'TeamColor_Mat'): void {
    if (!entity || !entity.render) {
      // If the entity itself isn't a render node, search through all descendants.
      const renderNodes = entity.findComponents('render') as pc.RenderComponent[];
      for (const node of renderNodes) {
        this.applyColorToRenderComponent(node, color, targetMaterialName);
      }
      return;
    }

    this.applyColorToRenderComponent(entity.render, color, targetMaterialName);
  }

  private static applyColorToRenderComponent(
    renderComponent: pc.RenderComponent,
    color: pc.Color,
    materialName: string
  ): void {
    if (!renderComponent.meshInstances) {
      return;
    }

    const meshInstances = renderComponent.meshInstances;

    // First pass: try matching the standard convention
    for (let i = 0; i < meshInstances.length; i += 1) {
      const meshInstance = meshInstances[i];
      if (meshInstance.material && meshInstance.material.name === materialName) {
        this.applyToInstance(meshInstance, color);
      }
    }

    // If the asset does not expose an explicit team-color material slot, keep its original materials.
    // Recoloring arbitrary meshes can accidentally tint ground-contact planes or baked shadow meshes.
  }

  private static applyToInstance(meshInstance: pc.MeshInstance, color: pc.Color): void {
    const standardMat = meshInstance.material as pc.StandardMaterial;
    if (!standardMat) return;

    const clonedMat = standardMat.clone();
    // Use a blend to keep some original texture/shading if it exists
    clonedMat.diffuse = color;
    clonedMat.update();
    meshInstance.material = clonedMat;
  }
}
