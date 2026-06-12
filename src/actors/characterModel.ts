import {
  type AnimationGroup,
  ImportMeshAsync,
  type Scene,
  TransformNode,
} from "@babylonjs/core";

export interface CharacterModel {
  /** Parent this under the player root; origin at the character's feet. */
  root: TransformNode;
  /** Animation groups keyed by clip name (e.g. "Idle", "Running_A"). */
  animations: Map<string, AnimationGroup>;
}

/**
 * Loads a rigged GLB and scales it so its bounding height equals
 * targetHeight (the physics capsule height stays the source of truth).
 */
export async function loadCharacterModel(
  url: string,
  scene: Scene,
  targetHeight: number,
): Promise<CharacterModel> {
  const result = await ImportMeshAsync(url, scene);

  // The glTF loader auto-plays the first animation group — stop everything.
  for (const group of result.animationGroups) {
    group.stop();
  }

  const glbRoot = result.meshes[0];
  if (!glbRoot) {
    throw new Error(`No meshes in ${url}`);
  }

  const { min, max } = glbRoot.getHierarchyBoundingVectors(true);
  const modelHeight = max.y - min.y;
  const scale = modelHeight > 0 ? targetHeight / modelHeight : 1;

  const root = new TransformNode("characterRoot", scene);
  glbRoot.parent = root;
  glbRoot.scaling.scaleInPlace(scale);

  const animations = new Map<string, AnimationGroup>();
  for (const group of result.animationGroups) {
    animations.set(group.name, group);
  }

  return { root, animations };
}
