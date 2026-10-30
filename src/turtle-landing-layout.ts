// A complete stone tongue in the existing pool basin. Player water masks remain
// in place. Its dry end joins the ordinary lawn; the submerged end supports only
// the turtle's body, rather than inventing a water floor for the heroes.
export const TURTLE_LANDING={x:13,width:5.6,start:30.2,end:34.2,dry:38.8,bottom:-.78};
export function turtleLandingY(x:number,z:number){const p=TURTLE_LANDING;if(Math.abs(x-p.x)>p.width/2||z<p.start||z>p.dry)return null;return z<p.end?-.72+(z-p.start)/(p.end-p.start)*1.14:.42-(z-p.end)/(p.dry-p.end)*.16;}
export const TURTLE_LANDING_TRIANGLES=[[30.2,-.72,34.2,.42],[34.2,.42,38.8,.26]].flatMap(([a,ya,b,yb],i)=>{const l=10.2,r=15.8,v=[[l,ya,a],[r,ya,a],[r,yb,b],[l,yb,b]],dy=yb-ya,dz=b-a,len=Math.hypot(dy,dz);return[{id:'turtle-stone-landing-'+i,role:'garden-bridge',vertices:[v[0],v[2],v[1]],normal:[0,dz/len,-dy/len]},{id:'turtle-stone-landing-'+i,role:'garden-bridge',vertices:[v[0],v[3],v[2]],normal:[0,dz/len,-dy/len]}];});
