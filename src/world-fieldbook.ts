import {Color3,Mesh,MeshBuilder,StandardMaterial,TransformNode,Vector3} from '@babylonjs/core';
import {FIELD_ROUTES,fieldContent,fieldNodes,type FieldNode} from '../shared/fieldbook';
import type {Snapshot} from './simulation';
import type {World} from './world';
import {regionGroundHeight} from './regions';
import {HOME_FOREST_PATH} from './villa-site';

/** Small authored mechanisms share materials. No discovery is put on the map. */
export function buildFieldVisuals(w:World){
 const nodes=fieldNodes(w.regionId),materials:StandardMaterial[]=[],updates:((s:Snapshot,t:number)=>void)[]=[];
 const mat=(name:string,hex:string,glow=0)=>{const m=new StandardMaterial('field '+name,w.scene);m.diffuseColor=Color3.FromHexString(hex);m.specularColor.setAll(.06);m.emissiveColor=m.diffuseColor.scale(glow);materials.push(m);return m;};
 if(!nodes.length)return{update(_s:Snapshot,_t:number){},dispose(){}};
 const bark=mat('weathered bark','#74614c'),wood=mat('warm willow','#b9a178'),brass=mat('quiet brass','#b79a64'),leaf=mat('folded sage','#6f956c'),paper=mat('linen paper','#e8dbb2'),glow=mat('warm response','#ffe6a9',.55),blue=mat('moon dew','#a5dae0',.7),dark=mat('unlit inset','#504e42');
 const attach=(m:Mesh,parent:TransformNode,material=wood)=>{m.parent=parent;m.material=material;m.isPickable=false;m.receiveShadows=true;m.metadata={fieldVisual:true,cameraObstacle:false};w.shadows.addShadowCaster(m);return m;};
 const box=(p:TransformNode,x:number,y:number,z:number,width:number,height:number,depth:number,m=wood)=>{const o=MeshBuilder.CreateBox('field fitted wood',{width,height,depth},w.scene);o.position.set(x,y,z);return attach(o,p,m);};
 const ball=(p:TransformNode,x:number,y:number,z:number,diameter:number,m=glow)=>{const o=MeshBuilder.CreateSphere('field soft form',{diameter,segments:10},w.scene);o.position.set(x,y,z);return attach(o,p,m);};
 const rod=(p:TransformNode,x:number,y:number,z:number,height:number,diameter:number,m=wood)=>{const o=MeshBuilder.CreateCylinder('field turned support',{height,diameter,tessellation:12},w.scene);o.position.set(x,y,z);return attach(o,p,m);};
 const ring=(p:TransformNode,x:number,y:number,z:number,d:number,m=brass)=>{const o=MeshBuilder.CreateTorus('field ring',{diameter:d,thickness:.055,tessellation:24},w.scene);o.position.set(x,y,z);o.rotation.x=Math.PI/2;return attach(o,p,m);};
 const leafShape=(p:TransformNode,x:number,y:number,z:number,scale=1)=>{const o=ball(p,x,y,z,.7,leaf);o.scaling.set(.5*scale,1.6*scale,.12*scale);o.rotation.z=.4;return o;};
 for(const n of nodes){const root=new TransformNode('field/'+n.id,w.scene);root.parent=w.root;root.position.set(n.x,regionGroundHeight(w.regionId,n.x,n.z),n.z);root.metadata={fieldNode:n.id,contentId:n.contentId};
  const progress=(s:Snapshot)=>s.fieldbook?.steps[n.contentId]??0,done=(s:Snapshot)=>s.fieldbook?.completed.includes(n.contentId)??false;
  if(n.visual==='hollow'){
   const hollow=ring(root,0,.48,0,.82,bark);hollow.scaling.y=.7;const cover=leafShape(root,0,.48,-.07,1.1);const flies=[-.2,0,.2].map((x,i)=>ball(root,x,.3+i*.1,.05,.065,glow));
   updates.push((s,t)=>{cover.rotation.z=progress(s)?1.35:.1;flies.forEach((f,i)=>{f.setEnabled(progress(s)>0);f.position.y=.3+i*.15+(done(s)?(.2+Math.sin(t+i)*.08):0);});});
  }else if(n.visual==='vane'){
   rod(root,0,.64,0,1.28,.09,bark);const pivot=new TransformNode('field wind leaf pivot',w.scene);pivot.parent=root;pivot.position.y=1.25;leafShape(pivot,.23,0,0,.7).rotation.z=Math.PI/2;box(pivot,0,0,0,.65,.04,.04,brass);
   for(let i=0;i<4;i++){const a=i*Math.PI/2;box(root,Math.sin(a)*.4,.12,Math.cos(a)*.4,.07,.025,.12,i===(n.index===1?2:3)?paper:bark);}
   updates.push((s,t)=>{const v=n.contentId==='wind-shell'?((progress(s)>>n.index)&1)*2:s.fieldbook?.steps[n.contentId+(n.index===1?':a':':b')]??0;pivot.rotation.y=v*Math.PI/2+(done(s)?Math.sin(t)*.09:0);});
  }else if(n.visual==='dew'||n.visual==='cap'||n.visual==='glow'){
   const scale=n.visual==='glow'?.85:1;rod(root,0,.37*scale,0,.74*scale,.11,paper);const cap=ball(root,0,.73*scale,0,.85*scale,leaf);cap.scaling.y=.3;
   const bead=ball(root,0,.55*scale,-.22,.11,n.visual==='dew'?blue:glow);
   if(n.visual==='cap')for(let i=0;i<=n.index;i++)box(root,-.13+i*.13,.875,-.1,.035,.012,.15,paper);
   updates.push((s,t)=>{const hour=(9+s.time/30)%24,lit=n.visual==='dew'?hour>=19||hour<6:n.visual==='glow'?n.index<=progress(s):done(s)||[0,2,1].slice(0,progress(s)).includes(n.index);bead.setEnabled(lit);cap.material=lit?glow:leaf;bead.position.y=.55*scale+Math.sin(t*2+n.index)*.025;});
  }else if(n.visual==='stone'){
   for(let i=0;i<3;i++){const stone=ball(root,0,.15+i*.21,0,.66-i*.09,bark);stone.scaling.y=.45;}
   const turn=new TransformNode('field carved top stone',w.scene);turn.parent=root;turn.position.y=.65;
   for(let i=0;i<3;i++)box(turn,-.14+i*.14,.013,0,.035,.022,.35,paper);
   updates.push(s=>{turn.rotation.y=(n.contentId==='wind-mobile'?s.fieldbook?.steps[n.contentId+':b']??0:progress(s))*Math.PI/2;});
  }else if(n.visual==='pocket'){
   rod(root,.3,.83,0,1.66,.09,bark);box(root,0,1.63,0,.7,.07,.07,bark);const cover=leafShape(root,0,1.18,0,.85),seed=ball(root,0,.5,0,.13,brass);
   updates.push(s=>{cover.rotation.z=progress(s)?1.5:.2;seed.setEnabled(progress(s)===1&&!done(s));});
  }else if(n.visual==='basket'||n.visual==='chest'){
   box(root,0,.26,0,.72,.48,.5,bark);for(const x of [-.29,.29])box(root,x,.3,-.26,.045,.5,.025,brass);
   const lid=new TransformNode('field hinged lid',w.scene);lid.parent=root;lid.position.set(0,.5,.25);box(lid,0,.02,-.25,.75,.06,.55,wood);ring(root,0,.65,0,.25,brass);
   if(n.contentId==='woodland-hide'){leafShape(root,-.18,.58,-.29,.3);leafShape(root,.18,.58,-.29,.3);}
   updates.push(s=>{lid.rotation.x=done(s)?-1.05:0;});
  }else if(n.visual==='ribbon'||n.visual==='bouquet'){
   const flowers=new TransformNode('field tied flower bunch',w.scene);flowers.parent=root;
   for(let i=0;i<3;i++){rod(flowers,(i-1)*.16,.27,0,.5,.027,leaf);ball(flowers,(i-1)*.16,.54+(i%2)*.1,0,.17,paper);}
   const tie=ring(root,0,.33,0,.28,brass);tie.scaling.y=.45;
   updates.push(s=>{root.setEnabled(n.visual!=='ribbon'||progress(s)<2);tie.setEnabled(n.visual==='ribbon'||progress(s)>=3);});
  }else if(n.visual==='lamp'){
   rod(root,0,.75,0,1.5,.09,bark);const pane=box(root,0,1.45,0,.30,.38,.27,dark);box(root,0,1.68,0,.4,.06,.36,brass);const handle=box(root,.26,1.20,0,.09,.36,.05,brass);
   updates.push(s=>{const lit=n.index===0?done(s):!!(progress(s)&(1<<n.index));pane.material=lit&&s.homeLights!==false?glow:dark;handle.rotation.z=lit?.6:-.6;});
  }else if(n.visual==='mobile'){
   rod(root,0,1.3,0,2.6,.12,bark);box(root,.4,2.55,0,.95,.08,.1,wood);const pivot=new TransformNode('field mobile wind chimes',w.scene);pivot.parent=root;pivot.position.set(.48,2.3,0);
   for(let i=0;i<3;i++){box(pivot,(i-1)*.18,-.1,0,.014,.4,.014,bark);rod(pivot,(i-1)*.18,-.46-i*.06,0,.35+i*.12,.055,brass);}
   updates.push((s,t)=>{pivot.rotation.z=done(s)?Math.sin(t*2.2)*.12:0;});
  }else if(n.visual==='clue'){
   box(root,0,.35,0,.5,.7,.25,bark);const sheet=box(root,0,.73,0,.48,.025,.31,paper);sheet.rotation.y=n.index===1?.25:-.25;leafShape(root,0,.81,0,.23).material=n.index===1?brass:blue;
  }else if(n.visual==='ring'){
   rod(root,-.75,.9,0,1.8,.06,brass);rod(root,.75,.9,0,1.8,.06,brass);const flag=box(root,-.45,1.65,0,.65,.3,.022,paper);flag.rotation.y=.2;
   const flightRoot=new TransformNode('field flight route '+n.contentId,w.scene);flightRoot.parent=w.root;const rings=FIELD_ROUTES[n.contentId].map((q,i)=>{const o=ring(flightRoot,q.x,q.y,q.z,4.4,blue);const next=FIELD_ROUTES[n.contentId][Math.min(i+1,FIELD_ROUTES[n.contentId].length-1)];o.rotation.y=Math.atan2(next.x-q.x,next.z-q.z);return o;});
   updates.push((s,t)=>{const a=s.fieldPlay,on=a?.siteId===n.contentId&&a.kind==='flight'&&a.phase!=='invited'&&a.phase!=='result';flightRoot.setEnabled(!!on);if(!on)return;const role=w.scene.metadata?.fieldViewRole??'gold',next=a!.next[role as 'gold'|'white'];rings.forEach((o,i)=>{o.setEnabled(i>=next);o.material=i===next?glow:blue;o.scaling.setAll(i===next?1+Math.sin(t*2)*.018:1);});});
  }
 }
 if(w.regionId==='player-home-villa'){
  const boundary=new TransformNode('field hide boundary',w.scene);boundary.parent=w.root;
  for(let i=1;i<HOME_FOREST_PATH.length;i++){const [ax,az]=HOME_FOREST_PATH[i-1],[bx,bz]=HOME_FOREST_PATH[i],len=Math.hypot(bx-ax,bz-az),steps=Math.ceil(len/7);for(let k=0;k<=steps;k++)for(const side of [-1,1]){const x=ax+(bx-ax)*k/steps-(bz-az)/len*8*side,z=az+(bz-az)*k/steps+(bx-ax)/len*8*side;if(x>-39&&z>-36)continue;rod(boundary,x,.61,z,.7,.03,wood);const pennant=box(boundary,x,.95,z,.22,.17,.016,paper);pennant.rotation.y=Math.atan2(bx-ax,bz-az);}}
  updates.push(s=>boundary.setEnabled(s.fieldPlay?.kind==='hide'&&!['invited','result'].includes(s.fieldPlay.phase)));
 }
 return{update(s:Snapshot,t:number){for(const fn of updates)fn(s,t);},dispose(){materials.forEach(m=>m.dispose(false,false));}};
}
