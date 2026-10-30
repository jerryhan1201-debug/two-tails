import{MaterialPluginBase,type Material,type UniformBuffer,type Scene,type AbstractEngine,type SubMesh}from'@babylonjs/core';
/** Screen coverage shared by all pieces of one dog. Surviving pixels keep ordinary
 * opaque depth testing/writing, so a collar/eye/back ear cannot bleed through fur.
 * Fixed screen pattern: no temporal noise, extra camera, depth pass or geometry. */
export class ActorOcclusion extends MaterialPluginBase{
 constructor(material:Material,private coverage:()=>number){super(material,'dog-self-occlusion',210,{},true,true);}
 getUniforms(){return{externalUniforms:['dogCoverage'],fragment:'uniform float dogCoverage;'};}
 bindForSubMesh(_ubo:UniformBuffer,_scene:Scene,_engine:AbstractEngine,sub:SubMesh){sub.effect?.setFloat('dogCoverage',this.coverage());}
 getCustomCode(type:string){return type==='fragment'?{
  CUSTOM_FRAGMENT_DEFINITIONS:`float dogBayer2(vec2 p){return mod(p.x+p.y,2.0)*2.0+mod(p.y,2.0);}`,
  CUSTOM_FRAGMENT_MAIN_BEGIN:`if(dogCoverage<1.0){vec2 p=floor(gl_FragCoord.xy);float threshold=(16.0*dogBayer2(mod(p,2.0))+4.0*dogBayer2(mod(floor(p/2.0),2.0))+dogBayer2(mod(floor(p/4.0),2.0))+0.5)/64.0;if(dogCoverage<=threshold)discard;}`,
 }:null;}
}
