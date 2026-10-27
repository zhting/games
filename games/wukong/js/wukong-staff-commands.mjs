// Human commands use the merged keyboard/pad/touch directions. Capture a short
// press now, so releasing or changing direction during recovery cannot change it.
export const STAFF_COMMAND_BUFFER=.42;
export const STAFF_MOTION_WINDOW=.32;
export const STAFF_COMMANDS=Object.freeze(Object.fromEntries([
  ['thrust','弓步直捣','← / → + J','thrust','sweep'],
  ['lift','挑棍撩天','↑ + J','uppercut','lift'],
  ['low','伏身扫堂','↓ + J','lowSweep','sweep'],
  ['wheel','绕顶花棍','↖ / ↗ + J','skyWheel','sweep',2],
  ['sweep','横扫千军','↙ / ↘ + J','sweepingFinish','smash',3],
  ['flower','莲花回环','↓，再 ← / → + J','lotusChain','smash',3],
  ['airThrust','凌空直刺','空中 ← / → + J','airThrust','spin'],
  ['airLift','腾空挑棍','空中 ↑ + J','risingSpin','lift',2]
].map(([id,name,keys,variant,kind,combo])=>[id,Object.freeze({id,name,keys,variant,kind,combo})])));

export function clearStaffCommands(p){if(p.staffIntent)p.wantFire=false;delete p.staffIntent;delete p.staffCommandMotion;}
const directions=input=>({h:(input.right?1:0)-(input.left?1:0),v:(input.down?1:0)-(input.up?1:0)});
export function advanceStaffCommands(p,input,dt){
  if(p.staffIntent){
    p.staffIntent.remaining-=dt;
    if(p.staffIntent.remaining<0){delete p.staffIntent;p.wantFire=false;}
  }
  if(p.dead||p.dive||p.hurt||p.enteringExit||p.exitEntered||p.staff?.kind==='ultimate'||p.staffCharge?.active){
    clearStaffCommands(p);p.wantFire=false;return;
  }
  const {h,v}=directions(input);
  let motion=p.staffCommandMotion;
  if(motion){motion.downT=Math.max(0,motion.downT-dt);motion.flowerT=Math.max(0,motion.flowerT-dt);}
  if(v<0){delete p.staffCommandMotion;motion=null;}
  const downEdge=!!input.downEdge||v>0&&!p.staffDownHeld;
  if(downEdge&&v>0&&!h&&p.onGround)motion=p.staffCommandMotion={downT:STAFF_MOTION_WINDOW,flowerT:0,face:p.face||1};
  else if(motion?.downT>0&&h&&v>=0){motion.downT=0;motion.flowerT=STAFF_MOTION_WINDOW;motion.face=h;}
  if(motion&&!motion.downT&&!motion.flowerT){delete p.staffCommandMotion;motion=null;}
  if(input.fireEdge){
    p.staffIntent={h,v,face:h||p.face||1,flower:!!motion?.flowerT&&h===motion.face,remaining:STAFF_COMMAND_BUFFER};
    // One directional motion buys one command, never a string of later flowers.
    if(p.staffIntent.flower)delete p.staffCommandMotion;
    p.wantFire=true;
  }
}

export function staffCommand(p,input,airborne){
  const intent=p.staffIntent||{...directions(input),face:p.face||1};
  const {h,v}=intent;
  const id=airborne?(v<0?'airLift':h&&v===0?'airThrust':null)
    :intent.flower?'flower':h&&v<0?'wheel':h&&v>0?'sweep':v<0?'lift':v>0?'low':h?'thrust':null;
  return {move:id?STAFF_COMMANDS[id]:null,face:intent.face,up:v<0,down:v>0};
}
