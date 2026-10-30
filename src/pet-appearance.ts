/** Studio10 self-contained rig and measured in-place locomotion calibration. */
export interface PetAppearance {
  version: string; rootUrl: string; file: string;
  walkSpeed: number; trotSpeed: number; trotEnter: number; trotLeave: number;
}
const current: PetAppearance = {
  version: 'hashiha-studio-10', rootUrl: '/assets/pets/hashiha/', file: 'hashiha-studio10-1a51bcce.glb',
  walkSpeed: .376235294117647, trotSpeed: 1.054285714285714, trotEnter: 1.1, trotLeave: .85,
};
export function petAppearance(): PetAppearance {
  return current;
}
