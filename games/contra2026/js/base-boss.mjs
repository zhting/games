export const BASE_BOSS_DEVICES=Object.freeze([91,119].flatMap((y,row)=>[116,177,238].map((x,col)=>Object.freeze({k:'device',id:row*3+col,x,y,w:30,h:18,hp:8,max:8,flash:0,fireT:1.4+(row*3+col)*.5}))));
export const BASE_BOSS_MOVER=Object.freeze({k:'bcore',mover:true,x:177,y:62,w:30,h:18,hp:36,max:36,flash:0,fireT:.7});
export function bossDevicesRemaining(base){return base.targets.filter(t=>t.k==='device'&&t.hp>0).length;}
export function deviceAimHint(base){
  if(base.dead||base.bossPhase!=='devices')return null;
  const live=base.targets.filter(t=>t.k==='device'&&t.hp>0);
  if(!live.length)return null;
  return live.some(t=>t.y<110)?'按上举枪 · 射击上排装置':'松开上键 · 射击下排装置';
}
export function movingBossX(time){return 177+Math.sin(time*.92)*66;}
export function advanceBossLift(player,dt){
  if(!player.liftSide||player.liftDone)return;
  player.liftT=(player.liftT||0)+dt;
  const phase=Math.max(0,Math.min(1,(player.liftT-.25)/2.2)),ease=phase*phase*(3-2*phase);
  player.x=player.liftSide<0?28:356;player.y=204-ease*232;
  player.vx=player.vy=0;player.prone=player.spin=player.aimUp=false;player.onGround=true;
  player.aimDx=0;player.flashT=0;player.wantFire=false;
  if(phase>=1)player.liftDone=true;
}
export function drawBossBubble(g,x,y,rx,ry,time=0,emitter=false){
  g.save();g.translate(x,y);
  const glow=g.createRadialGradient(0,0,rx*.35,0,0,rx*1.45);
  glow.addColorStop(0,'rgba(40,80,210,0)');glow.addColorStop(.55,'rgba(82,116,255,.12)');glow.addColorStop(.8,'rgba(130,154,255,.35)');glow.addColorStop(1,'rgba(56,86,230,0)');
  g.fillStyle=glow;g.beginPath();g.ellipse(0,0,rx*1.4,ry*1.4,0,0,Math.PI*2);g.fill();
  if(emitter){g.fillStyle='#050b20';g.beginPath();g.ellipse(0,0,rx,ry,0,0,Math.PI*2);g.fill();}
  g.lineWidth=emitter?1.7:1.05;g.strokeStyle='#4549b0';g.beginPath();g.ellipse(0,0,rx,ry,0,0,Math.PI*2);g.stroke();
  g.lineWidth=emitter?.7:.55;g.strokeStyle='#c0c7ff';g.beginPath();g.ellipse(0,0,rx*.91,ry*.89,0,0,Math.PI*2);g.stroke();
  for(let i=0;i<9;i++){
    const angle=i*Math.PI*2/9+time*(emitter?.8:1.2),r=.94+Math.sin(time*12+i*2)*.08;
    g.strokeStyle=i%2?'#829dff':'#f0edff';g.lineWidth=emitter?1.1:.65;
    g.beginPath();g.moveTo(Math.cos(angle-.13)*rx*r,Math.sin(angle-.13)*ry*r);
    g.lineTo(Math.cos(angle)*rx*.82,Math.sin(angle)*ry*.82);g.lineTo(Math.cos(angle+.15)*rx*r,Math.sin(angle+.15)*ry*r);g.stroke();
  }
  g.strokeStyle='rgba(230,242,255,.92)';g.lineWidth=emitter?1:.6;g.beginPath();g.ellipse(-rx*.2,-ry*.23,rx*.45,ry*.48,-.2,3.3,4.8);g.stroke();
  if(emitter){g.fillStyle='#485fc0';for(const side of [-1,1])g.fillRect(side*rx*.35-1,-1,2,2);}
  g.restore();
}
