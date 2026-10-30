import {
  Color3,
  Constants,
  DynamicTexture,
  Material,
  PBRMaterial,
  RawCubeTexture,
  Scene,
  SphericalPolynomial,
  StandardMaterial,
  Texture,
} from "@babylonjs/core";
import type { Biome } from "./content";

export type Surface =
  | "meadow"
  | "earth"
  | "bark"
  | "timber"
  | "plaster"
  | "stone"
  | "limestone"
  | "terracotta"
  | "masonry"
  | "path"
  | "trail"
  | "water";
const hex = (value: string) => Color3.FromHexString(value).toLinearSpace();

/** Shared authored albedo/normal sets, with a small procedural sky irradiance cube. */
export class EnvironmentMaterials {
  private textures = new Map<string, Texture>();
  private materials = new Map<string, PBRMaterial | StandardMaterial>();
  readonly environment: RawCubeTexture;
  constructor(
    private scene: Scene,
    readonly biome: Biome,
  ) {
    const night = ["graveyard", "castle", "dragon"].includes(biome);
    const sky = night ? [53, 67, 102] : [153, 190, 207];
    const horizon = night ? [80, 86, 113] : [215, 225, 225];
    const earth = night ? [39, 48, 52] : [147, 149, 146];
    const data: Uint8Array[] = [];
    const size = 32;
    for (let face = 0; face < 6; face++) {
      const pixels = new Uint8Array(size * size * 4);
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const t = face === 2 ? 0.94 : face === 3 ? 0 : 1 - y / (size - 1);
          for (let c = 0; c < 3; c++)
            pixels[(y * size + x) * 4 + c] =
              t > 0.5
                ? horizon[c] + (sky[c] - horizon[c]) * (t - 0.5) * 2
                : earth[c] + (horizon[c] - earth[c]) * t * 2;
          pixels[(y * size + x) * 4 + 3] = 255;
        }
      data.push(pixels);
    }
    this.environment = new RawCubeTexture(
      scene,
      data,
      size,
      Constants.TEXTUREFORMAT_RGBA,
      Constants.TEXTURETYPE_UNSIGNED_BYTE,
      true,
      false,
      Texture.TRILINEAR_SAMPLINGMODE,
    );
    this.environment.name = "authored-sky-irradiance";
    this.environment.gammaSpace = true;
    const irradiance = new SphericalPolynomial();
    const amb = night ? [0.17, 0.2, 0.28] : [0.37, 0.39, 0.42];
    for (const key of ["xx", "yy", "zz"] as const)
      irradiance[key].set(amb[0], amb[1], amb[2]);
    irradiance.y.set(0.035, 0.05, 0.07);
    this.environment.sphericalPolynomial = irradiance;
    scene.environmentTexture = this.environment;
    scene.environmentIntensity = night ? 0.58 : 0.58;
  }
  texture(name: string) {
    let texture = this.textures.get(name);
    if (!texture) {
      texture = new Texture(
        `${import.meta.env.BASE_URL}assets/environment/${name.startsWith("cc0/") ? name + ".jpg" : (name === "foliage" ? "foliage-v3" : name) + ".png"}`,
        this.scene,
        false,
        false,
        Texture.TRILINEAR_SAMPLINGMODE,
      );
      texture.name = "env-v2-" + name;
      texture.wrapU = Texture.WRAP_ADDRESSMODE;
      texture.wrapV = Texture.WRAP_ADDRESSMODE;
      texture.anisotropicFilteringLevel = 4;
      if (name.endsWith("-normal")) texture.gammaSpace = false;
      this.textures.set(name, texture);
    }
    return texture;
  }
  /** Linear PBR pigments for authored ceramic, canvas, produce and painted wood. */
  paint(tint: string, roughness = 0.84) {
    const key = `pigment:${tint}:${roughness}`;
    const cached = this.materials.get(key);
    if (cached) return cached as PBRMaterial;
    const m = new PBRMaterial(key, this.scene);
    m.albedoColor = hex(tint);
    m.metallic = 0;
    m.roughness = roughness;
    m.environmentIntensity = .45;
    m.maxSimultaneousLights = 4;
    this.materials.set(key, m);
    return m;
  }
  fabric(tint: string) {
    const key = "woven-linen:" + tint;
    const cached = this.materials.get(key);
    if(cached)return cached as PBRMaterial;
    let weave = this.textures.get("authored-linen-weave");
    if(!weave){
      const texture = new DynamicTexture("authored linen warp and weft",128,this.scene,true),ctx=texture.getContext();
      ctx.fillStyle="#f5f3ec";ctx.fillRect(0,0,128,128);
      for(let i=0;i<128;i+=4){ctx.fillStyle="rgba(104,100,89,.065)";ctx.fillRect(i,0,1,128);ctx.fillRect(0,i,128,1);ctx.fillStyle="rgba(255,255,255,.26)";ctx.fillRect(i+1,0,1,128);ctx.fillRect(0,i+1,128,1);}
      texture.wrapU=Texture.WRAP_ADDRESSMODE;texture.wrapV=Texture.WRAP_ADDRESSMODE;texture.anisotropicFilteringLevel=4;texture.update();weave=texture;this.textures.set("authored-linen-weave",texture);
    }
    const m=new PBRMaterial(key,this.scene);m.albedoColor=hex(tint);m.albedoTexture=weave;m.metallic=0;m.roughness=.98;m.environmentIntensity=.42;m.backFaceCulling=false;m.twoSidedLighting=true;m.maxSimultaneousLights=3;
    this.materials.set(key,m);return m;
  }
  lane() {
    const key='soft handworn earthen lane';const cached=this.materials.get(key);if(cached)return cached as PBRMaterial;
    const texture=new DynamicTexture(key,{width:512,height:512},this.scene,true),ctx=texture.getContext(),pixels=(ctx as CanvasRenderingContext2D).createImageData(512,512);let seed=781;
    const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let y=0;y<512;y++)for(let x=0;x<512;x++){
      const tau=Math.PI*2,k=(y*512+x)*4,u=x/512,v=y/512;
      const shoulder=.022*Math.sin(v*tau*3)+.014*Math.sin(v*tau*7+u*tau*2);
      const edge=Math.min(u,1-u)+shoulder,noise=(rand()-.5)*10;
      const grain=3*Math.sin(u*tau*11+Math.sin(v*tau*5))+.8*Math.cos((u+v)*tau*37);
      pixels.data[k]=149+noise+grain;pixels.data[k+1]=135+noise+grain;pixels.data[k+2]=111+noise+grain*.8;
      const fade=Math.max(0,Math.min(1,edge*6));pixels.data[k+3]=255*fade*fade*(3-2*fade);
    }ctx.putImageData(pixels,0,0);
    texture.hasAlpha=true;texture.wrapU=Texture.CLAMP_ADDRESSMODE;texture.wrapV=Texture.WRAP_ADDRESSMODE;texture.anisotropicFilteringLevel=4;texture.update();this.textures.set(key,texture);
    const m=new PBRMaterial(key,this.scene);m.albedoTexture=texture;m.useAlphaFromAlbedoTexture=true;m.transparencyMode=Material.MATERIAL_ALPHABLEND;m.roughness=.97;m.metallic=0;m.environmentIntensity=.43;m.disableDepthWrite=true;m.zOffset=0;m.backFaceCulling=false;m.maxSimultaneousLights=4;this.materials.set(key,m);return m;
  }
  moss() {
    const key='wet woodland moss';const cached=this.materials.get(key);if(cached)return cached as PBRMaterial;
    const tex=new DynamicTexture('authored moss fine scale',{width:512,height:512},this.scene,true),ctx=tex.getContext(),pixels=(ctx as CanvasRenderingContext2D).createImageData(512,512);
    let seed=4513;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let y=0;y<512;y++)for(let x=0;x<512;x++){const tau=Math.PI*2,n=Math.sin(x/512*tau*3+Math.sin(y/512*tau*2))*.016+Math.cos(y/512*tau*5-x/512*tau*2)*.011+Math.sin(x/512*tau*17+y/512*tau*13)*.008+(rand()-.5)*.065,k=(y*512+x)*4;pixels.data[k]=94+n*160;pixels.data[k+1]=116+n*170;pixels.data[k+2]=66+n*110;pixels.data[k+3]=255;}ctx.putImageData(pixels,0,0);
    for(let i=0;i<1500;i++){const x=rand()*512,y=rand()*512;ctx.strokeStyle=i%3?'rgba(147,162,85,.17)':'rgba(47,67,36,.13)';ctx.lineWidth=.5+rand()*.7;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+rand()*3-1.5,y-1-rand()*3);ctx.stroke();}tex.wrapU=Texture.WRAP_ADDRESSMODE;tex.wrapV=Texture.WRAP_ADDRESSMODE;tex.anisotropicFilteringLevel=4;tex.update();this.textures.set(key,tex);
    const m=new PBRMaterial(key,this.scene);m.albedoTexture=tex;m.albedoColor=Color3.White();m.bumpTexture=this.texture('cc0/forest_ground_04-normal');m.bumpTexture.level=.075;m.roughness=.94;m.metallic=0;m.environmentIntensity=.52;m.maxSimultaneousLights=4;this.materials.set(key,m);return m;
  }
  /** Small original material fields; highlights follow cap shape rather than photo patches. */
  organic(kind: "cap" | "stem", tint:string) {
    const key=`organic-${kind}-${tint}`;const cached=this.materials.get(key);if(cached)return cached as PBRMaterial;
    const texKey=`organic-field-${kind}`;let texture=this.textures.get(texKey);
    if(!texture){const dt=new DynamicTexture(texKey,{width:512,height:512},this.scene,true),ctx=dt.getContext();const pixels=(ctx as CanvasRenderingContext2D).createImageData(512,512);
      let seed=61739;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
      for(let y=0;y<512;y++)for(let x=0;x<512;x++){const u=x/512,v=y/512;const veins=kind==='stem'?Math.sin(u*180+Math.sin(v*13)*.8)*3+Math.sin(u*51+v*3)*4:Math.sin(u*33+Math.sin(v*11)*2)*2+Math.cos(u*17-v*21)*3;const value=238+veins+(rand()-.5)*6,k=(y*512+x)*4;pixels.data[k]=value;pixels.data[k+1]=value-2;pixels.data[k+2]=value-6;pixels.data[k+3]=255;}ctx.putImageData(pixels,0,0);dt.wrapU=Texture.WRAP_ADDRESSMODE;dt.wrapV=Texture.WRAP_ADDRESSMODE;dt.anisotropicFilteringLevel=4;dt.update();texture=dt;this.textures.set(texKey,dt);}
    const m=new PBRMaterial(key,this.scene);m.albedoColor=hex(tint);m.albedoTexture=texture;m.metallic=0;m.roughness=kind==='cap'?.64:.87;m.environmentIntensity=.48;m.maxSimultaneousLights=4;
    if(kind==='cap'){m.clearCoat.isEnabled=true;m.clearCoat.intensity=.12;m.clearCoat.roughness=.44;}else{m.subSurface.isTranslucencyEnabled=true;m.subSurface.translucencyIntensity=.12;m.subSurface.tintColor=hex('#e9c69a');}
    this.materials.set(key,m);return m;
  }
  surface(kind: Surface, tint = "#ffffff") {
    const key = kind + ":" + tint;
    const cached = this.materials.get(key);
    if (cached) return cached as PBRMaterial;
    const m = new PBRMaterial("surface-" + key, this.scene);
    m.albedoColor = hex(tint);
    if (kind === "meadow") {
      m.albedoColor =
        this.biome === "mountain"
          ? new Color3(0.95, 1.04, 1.1)
          : this.biome === "dragon"
            ? new Color3(0.72, 0.8, 0.98)
            : this.biome === "village"
              ? new Color3(0.65, 1.23, 0.68)
              : new Color3(0.84, 1.03, 0.83);
    }
    const source =
      kind === "meadow"
        ? this.biome === "mountain" || this.biome === "dragon"
          ? "forest_ground_04"
          : "grass_ground"
        : kind === "earth" || kind === "trail"
          ? "forest_ground_04"
          : kind === "bark"
            ? "bark_brown_02"
            : kind === "path"
              ? "mossy_cobblestone"
              : null;
    if(kind === "limestone") {
      let tex=this.textures.get("v5-handworked-limestone");
      if(!tex){
        const texture=new DynamicTexture("v5 handworked limestone fine grain",256,this.scene,true),ctx=texture.getContext();
        const pixels=(ctx as CanvasRenderingContext2D).createImageData(256,256);let seed=7021;
        const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
        for(let y=0;y<256;y++)for(let x=0;x<256;x++){const n=(random()-.5)*17+Math.sin(x*.06+y*.035)*2+Math.sin(y*.11-x*.03)*2,k=(y*256+x)*4;pixels.data[k]=179+n;pixels.data[k+1]=177+n;pixels.data[k+2]=161+n;pixels.data[k+3]=255;}
        ctx.putImageData(pixels,0,0);for(let i=0;i<440;i++){const x=random()*256,y=random()*256;ctx.fillStyle=i%3?'rgba(102,99,80,.12)':'rgba(229,225,203,.18)';ctx.beginPath();ctx.arc(x,y,.4+random()*.85,0,Math.PI*2);ctx.fill();}
        texture.wrapU=Texture.WRAP_ADDRESSMODE;texture.wrapV=Texture.WRAP_ADDRESSMODE;texture.anisotropicFilteringLevel=4;texture.update();this.textures.set("v5-handworked-limestone",texture);tex=texture;
      }
      m.albedoTexture=tex;
    } else m.albedoTexture = this.texture(source ? "cc0/" + source + "-albedo" : kind + "-albedo");
    m.bumpTexture = this.texture(
      source ? "cc0/" + source + "-normal" : (kind === "limestone" ? "stone" : kind) + "-normal",
    );
    if (source) {
      m.metallicTexture = this.texture("cc0/" + source + "-arm");
      m.metallicTexture.gammaSpace = false;
      m.useRoughnessFromMetallicTextureAlpha = false;
      m.useRoughnessFromMetallicTextureGreen = true;
      m.useMetallnessFromMetallicTextureBlue = true;
      m.useAmbientOcclusionFromMetallicTextureRed = true;
    }
    m.bumpTexture.level =
      kind === "limestone" ? .12 : kind === "water" ? 0.30 : kind === "plaster" ? 0.24 : kind === "bark" ? .32 : kind === "meadow" ? .35 : 0.58;
    m.metallic = 0;
    m.roughness =
      kind === "water"
        ? 0.26
        : kind === "timber"
          ? 0.77
          : kind === "terracotta"
            ? 0.88
            : 0.94;
    m.environmentIntensity = kind === "water" ? 0.85 : 0.55;
    m.useHorizonOcclusion = true;
    m.useRadianceOcclusion = true;
    m.maxSimultaneousLights = 4;
    if (kind === "path" || kind === "trail") {
      m.opacityTexture = this.texture(kind + "-albedo");
      m.opacityTexture.hasAlpha = true;
      m.transparencyMode = Material.MATERIAL_ALPHATESTANDBLEND;
      m.alphaCutOff = 0.03;
      m.backFaceCulling = false;
      // Decal paths lie a few millimetres above the sampled terrain. Do not let
      // transparent edge fragments write a competing depth surface.
      m.disableDepthWrite = true;
      m.zOffset = -1;
    }
    if (kind === "water") {
      m.albedoColor = hex("#82bdb0");
      m.alpha = 0.72;
      m.transparencyMode = Material.MATERIAL_ALPHABLEND;
      m.clearCoat.isEnabled = true;
      m.clearCoat.intensity = 0.65;
      m.clearCoat.roughness = 0.18;
    }
    this.materials.set(key, m);
    return m;
  }
  foliage(atlas: "foliage" | "fern" | "grass-blades", tint = "#ffffff") {
    const key = atlas + ":" + tint;
    const cached = this.materials.get(key);
    if (cached) return cached as StandardMaterial;
    const m = new StandardMaterial("living-leaf-" + key, this.scene);
    m.diffuseTexture = this.texture(atlas);
    m.diffuseTexture.hasAlpha = true;
    m.diffuseColor = Color3.FromHexString(tint);
    m.useAlphaFromDiffuseTexture = true;
    m.transparencyMode = Material.MATERIAL_ALPHATEST;
    m.alphaCutOff = 0.42;
    m.backFaceCulling = false;
    m.twoSidedLighting = atlas === "foliage";
    m.specularColor = new Color3(0.045, 0.065, 0.025);
    m.specularPower = 32;
    // A small transmitted green component keeps leaf undersides readable.
    m.emissiveColor = new Color3(0.068, 0.082, 0.045);
    m.maxSimultaneousLights = 4;
    this.materials.set(key, m);
    return m;
  }
  glass() {
    const key = "glass";
    const cached = this.materials.get(key);
    if (cached) return cached as PBRMaterial;
    const m = new PBRMaterial("warm-rippled-window-glass", this.scene);
    m.albedoColor = hex("#d8a864");
    m.emissiveColor = hex("#ffc882").scale(0.62);
    m.metallic = 0.12;
    m.roughness = 0.21;
    m.environmentIntensity = 0.7;
    m.clearCoat.isEnabled = true;
    m.clearCoat.intensity = 0.8;
    this.materials.set(key, m);
    return m;
  }
  activate(){this.scene.environmentTexture=this.environment;this.scene.environmentIntensity=.58;}
  dispose() {
    this.materials.forEach((m) => m.dispose(false, false));
    this.textures.forEach((t) => t.dispose());
    if (this.scene.environmentTexture === this.environment)
      this.scene.environmentTexture = null;
    this.environment.dispose();
  }
}
