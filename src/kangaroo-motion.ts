// Follow uses the complete delivered hop at a quicker cadence; regional idle
// wandering retains its authored one-second cycle and 0.62 m/s average.
export const KANGAROO_HOP_PERIOD=.72;
export const kangarooPhase=(time:number,epoch=0)=>Math.max(0,(time-epoch)/KANGAROO_HOP_PERIOD)%1;
export const kangarooSeconds=(time:number,epoch=0)=>kangarooPhase(time,epoch);
export const kangarooLandingAt=(time:number,epoch=0)=>time+(1-kangarooPhase(time,epoch))*KANGAROO_HOP_PERIOD;
function air(t:number){if(t<=0)return 0;const cycles=t/KANGAROO_HOP_PERIOD,whole=Math.floor(cycles),part=cycles-whole;return(whole*.6+Math.max(0,Math.min(.6,part-.24)))*KANGAROO_HOP_PERIOD;}
export function kangarooFrameSpeed(time:number,epoch:number,step:number,gap:number){const fraction=(air(time-epoch)-air(time-epoch-step))/Math.max(.001,step),average=4.8+Math.max(0,Math.min(.8,(gap-5)*.2));return average/.6*fraction;}
