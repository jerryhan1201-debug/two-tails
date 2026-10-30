import {MaterialPluginBase, type PBRMaterial} from '@babylonjs/core';

/** Reuses the release's grain/UVs and lighting; only beach-owned sand gets this tint.
 * The shoreline's existing world height supplies a continuous wet/dry transition. */
export class IvoryBeachSand extends MaterialPluginBase {
 constructor(material:PBRMaterial){super(material,'v17-ivory-sand',220,{},true,true);}
 getCustomCode(type:string){return type==='fragment'?{
  CUSTOM_FRAGMENT_BEFORE_LIGHTS:`
   float sandGrain = dot(surfaceAlbedo, vec3(0.2126, 0.7152, 0.0722));
   float sandValue = clamp(0.44 + 0.52 * sandGrain, 0.44, 0.86);
   float drySand = smoothstep(0.08, 1.18, vPositionW.y);
   surfaceAlbedo = vec3(1.04, 1.01, 0.94) * sandValue * mix(0.76, 1.0, drySand);
  `,
 }:null;}
}
