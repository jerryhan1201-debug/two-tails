/** Quiet deterministic distant storm, shared by lighting and local audio.
 * The 2.1-second sound delay is simulation time; no wall-clock timer survives exit. */
export function castleLightningAt(time:number){
 const t=Math.max(0,Number.isFinite(time)?time:0),id=Math.floor((t-18)/83),start=18+id*83,phase=t-start;
 const hour=(9+start/30)%24,day=Math.max(0,Math.min(1,(Math.sin((hour-6)/24*Math.PI*2)+.12)/.82)),cycle=Math.floor(Math.max(0,start)/150)%6;
 const eligible=id>=0&&(day<.28||cycle===1||cycle===4);
 return{id,start,phase,eligible,flash:eligible&&phase<1.4?Math.sin(phase/1.4*Math.PI)*.11:0,thunderAt:start+2.1};
}
