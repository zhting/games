import { StageOneArt } from './stage-one-art.mjs?v=permanent-monsoon-1';
import { HDActorArt } from './hd-actors.mjs?v=base-up-lift-1';
import { BASE_ACTORS, BASE_KIT } from './stage-two-atlas.mjs?v=base-hd-2';
import { BASE_UPWARD, baseActorPose } from './base-actor-poses.mjs?v=base-up-lift-1';
export { baseActorPose } from './base-actor-poses.mjs?v=base-up-lift-1';
import { drawShieldField } from './actor-status.mjs?v=energy-field-1';
import { BASE_SOLDIER, baseSoldierScale } from './base-soldier.mjs?v=base-soldier-size-1';
import { drawRiotShield } from './riot-shield.mjs?v=riot-shield-1';
import { baseRoomTheme, nextBaseRoomTheme, baseRoomSignals } from './stage-two-rooms.mjs?v=room-identities-1';
import { baseCoreShielded } from './base-shooting.mjs?v=base-up-lift-1';
import { redSupplyUniform } from './base-supply.mjs?v=red-supply-1';
import { bossDevicesRemaining, drawBossBubble } from './base-boss.mjs?v=base-up-lift-1';

export const STAGE_TWO_ASSETS=Object.freeze({
  corridor:'/games/contra2026/assets/stage2/corridor-hd.png',
  power:'/games/contra2026/assets/stage2/corridor-power.png',
  armory:'/games/contra2026/assets/stage2/corridor-armory.png',
  command:'/games/contra2026/assets/stage2/corridor-command.png',
  kit:'/games/contra2026/assets/stage2/mechanisms-hd.png',
  bossWall:'/games/contra2026/assets/stage2/control-wall-hd.png',
  rearBlue:'/games/contra2026/assets/stage2/commando-back-blue.png',
  rearRed:'/games/contra2026/assets/stage2/commando-back-red.png',
  rearUp:'/games/contra2026/assets/stage2/commando-upward-v1.png',
  frontEnemy:'/games/contra2026/assets/stage2/soldier-front.png',
  environment:'/games/contra2026/assets/stage1/environment.png'
});
export const BASE_VIEW=Object.freeze({floor:204,rear:{x:96,y:40,w:192,h:100},barrierZ:.3});
export const baseScale=z=>1-.5*z;
export const basePoint=(u,z)=>({x:192+u*baseScale(z),y:BASE_VIEW.floor-64*z});
// The terminals stay fixed while the discharge changes shape at 24 Hz.
export function barrierArc(time,row=0){
  const tick=Math.floor(time*24),y=184.8-(row?24:8)*.85,points=[[34,y]];
  for(let x=36;x<350;x+=2){
    const edge=Math.min(1,(x-34)/12,(350-x)/12);
    points.push([x,y+edge*(Math.sin(x*1.73+tick*2.17+row*4)*1.05+Math.sin(x*.59-tick*1.31)*.8)]);
  }
  points.push([350,y]);return points;
}
/** Stage-two simulation keeps its original projection. Only artwork uses native display pixels. */
export class StageTwoArt extends StageOneArt{
  constructor(options){
    super({...options,assets:STAGE_TWO_ASSETS});this.baseArt=options.baseArt;
    if(this.baseArt)this.hdActors=this.baseArt.hdActors;
    // Rear-view prone art is foreshortened in depth, not a miniature standing figure.
    const sheets=Object.fromEntries(Object.entries(BASE_ACTORS).map(([role,sheet])=>{
      const scale=role==='enemy'?BASE_SOLDIER.height/sheet.frames.idle.bounds[3]:sheet.scale;
      // A horizontal body keeps the standing artwork's pixel scale. The generic
      // legacy 11-unit death-height limit would miniaturize this detailed pose.
      return[role,{...sheet,scale,frames:{...sheet.frames,dead:{...sheet.frames.dead,scale},...(BASE_UPWARD[role]?{up:BASE_UPWARD[role]}:{})}}];
    }));
    sheets.supply={...sheets.enemy,key:'supplyEnemy'};
    this.baseActors=new HDActorArt(options.createCanvas,this.images,{poseSheets:sheets,runSheets:sheets,runRig:null,deathSheets:null,deadPose:'dead',proneHeight:26});
  }
  prepare(destination){
    const width=destination.canvas?.width||1536,height=destination.canvas?.height||864;
    if(this.surface.width!==width||this.surface.height!==height)this.baseActors.clear();
    super.prepare(destination);
  }
  kitFrame(name,w,h){
    if(!this.loaded.has('kit'))return null;
    const key=`kit:${name}:${w}:${h}`;if(this.cache.has(key))return this.cache.get(key);
    const frame=this.createCanvas();frame.width=Math.ceil(w*this.scale);frame.height=Math.ceil(h*this.scale);
    const g=frame.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
    g.drawImage(this.images.kit,...BASE_KIT.frames[name],0,0,frame.width,frame.height);this.cache.set(key,frame);return frame;
  }
  kit(name,x,y,w,h){const image=this.kitFrame(name,w,h);if(image)this.g.drawImage(image,x,y,w,h);return!!image;}
  metalBeam(x,y,w,h){
    const g=this.g,vertical=h>w,shade=g.createLinearGradient(x,y,vertical?x+w:x,vertical?y:y+h);
    for(const [stop,color]of [[0,'#243330'],[.18,'#b7c3b2'],[.38,'#6d7e72'],[.65,'#485a50'],[.82,'#a4b29e'],[1,'#172522']])shade.addColorStop(stop,color);
    g.fillStyle=shade;g.fillRect(x,y,w,h);
    this.line(x,y,x+w,y,'#c7ceba',.35);this.line(x+w,y,x+w,y+h,'#07100d',.65);
    for(let pos=5;pos<(vertical?h:w)-2;pos+=13){
      const xx=vertical?x+w/2:x+pos,yy=vertical?y+pos:y+h/2;
      this.disc(xx,yy,.38,'#182721');this.disc(xx-.12,yy-.12,.13,'#e3e6cb');
    }
  }
  backdrop(B=this.state?.base){
    const theme=baseRoomTheme(B),key='corridor:'+theme.id;
    let backdrop=this.cache.get(key);
    if(!backdrop){
      backdrop=this.createCanvas();backdrop.width=this.surface.width;backdrop.height=this.surface.height;
      const g=backdrop.getContext('2d');g.fillStyle='#07151e';g.fillRect(0,0,backdrop.width,backdrop.height);
      if(this.loaded.has(theme.asset)){
        const source=this.images[theme.asset],xx=[0,540,1136,1674],yy=[0,235,558,941],dx=[0,96,288,384],dy=[0,40,140,216];
        // Register the painted back wall with the unchanged shootable surface.
        for(let row=0;row<3;row++)for(let col=0;col<3;col++)g.drawImage(source,
          xx[col]/1674*source.naturalWidth,yy[row]/941*source.naturalHeight,
          (xx[col+1]-xx[col])/1674*source.naturalWidth,(yy[row+1]-yy[row])/941*source.naturalHeight,
          dx[col]*this.scale,dy[row]*this.scale,(dx[col+1]-dx[col])*this.scale,(dy[row+1]-dy[row])*this.scale);
      }
      this.cache.set(key,backdrop);
    }
    this.g.drawImage(backdrop,0,0,384,216);
  }
  roomIdentity(B){
    if(B.def.boss==='eye')return;
    const g=this.g,theme=baseRoomTheme(B);
    // A small physical lintel sign remains readable in solo and cooperative HUD layouts.
    this.rect(150,46,84,14,'#060b0d');this.rect(151,47,82,12,theme.panel);
    this.line(152,47,232,47,'#7f8882',.7);this.line(152,59,232,59,'#030707',1);
    this.hudText(theme.code,157,49.5,theme.accent,6.8);
    this.line(170,49,170,57,'#52625c',.6);
    this.hudText(theme.name,199,50,theme.accent,6,'center',56);
    for(const light of baseRoomSignals(B,this.state.time)){
      g.save();g.globalAlpha=light.alpha;this.rect(light.x,light.y,light.w,light.h,theme.accent);g.restore();
    }
  }
  bossWall(B){
    const g=this.g,key='control-wall';let image=this.cache.get(key);
    if(!image){
      image=this.createCanvas();image.width=Math.ceil(248*this.scale);image.height=Math.ceil(108*this.scale);
      const ink=image.getContext('2d');ink.imageSmoothingEnabled=true;ink.imageSmoothingQuality='high';
      if(this.loaded.has('bossWall'))ink.drawImage(this.images.bossWall,0,0,1900,809,0,0,image.width,image.height);
      else{ink.fillStyle='#182421';ink.fillRect(0,0,image.width,image.height);}
      this.cache.set(key,image);
    }
    g.drawImage(image,68,37,248,108);
    for(let i=0;i<13;i++)this.rect(82+i*17,42,3,.8,i%4===(this.state.t>>4)%4?'#d58f43':'#507b70');
    if(B.def.boss==='eye'){
      // Two rows of three independent red devices sit below the travelling ring.
      this.rect(103,86,180,55,'#070b09');
      for(const y of [86,113,140]){
        this.metalBeam(102,y,182,3);
      }
      for(const x of [103,162,223,282]){
        this.metalBeam(x,89,2,51);
      }
      this.rect(97,52,190,31,'#020607');
      for(const y of [51,83]){
        this.metalBeam(95,y,194,2);
      }
      for(const x of [95,287])this.metalBeam(x,51,2,34);
      if(B.bossPhase==='reveal'){
        const phase=1-Math.min(1,B.revealT/1.2);
        drawBossBubble(g,192,71,3+phase*11,2+phase*6,this.state.time,true);
      }
    }
    // The control chamber retains the original's ribbed red floor margins.
    for(let y=149;y<216;y+=3){
      const margin=7+(y-149)*.75;
      this.line(15,y,15+margin,y,'rgba(144,44,28,.65)',.65);
      this.line(369-margin,y,369,y,'rgba(144,44,28,.65)',.65);
    }
  }
  portal(B){
    if(!B.cleared||B.def.boss)return;
    const g=this.g;
    g.save();g.beginPath();[[160,58],[170,53],[215,54],[225,65],[223,101],[229,137],[157,140],[162,117],[156,91]].forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.clip();
    const dark=g.createLinearGradient(158,60,224,140);dark.addColorStop(0,'#01080c');dark.addColorStop(.65,'#03111a');dark.addColorStop(1,'#15303d');g.fillStyle=dark;g.fillRect(155,50,76,92);
    for(let i=0;i<5;i++){
      const inset=i*5;g.strokeStyle=`rgba(92,136,149,${.35-i*.045})`;g.lineWidth=.55;g.strokeRect(159+inset,56+inset,66-inset*2,84-inset*2);
    }
    g.restore();
    // Fractured steel highlights along the actual breach, rather than a solid box border.
    for(const [x,y,xx,yy]of [[160,58,168,54],[158,86,160,69],[158,107,161,117],[215,55,223,64],[224,81,222,101],[224,116,228,135]]){
      this.line(x,y,xx,yy,'#1b262e',1.6);this.line(x+.5,y,xx+.5,yy,'#8a9491',.45);
    }
    this.line(159,137,224,137,'#8e9b99',1.2);this.line(159,139,224,139,'#15222a',1.5);
  }
  target(target,B){
    const {x,y,w,h,k}=target,dead=target.hp<=0,g=this.g;
    // The core's explosion reveals the passage; no wreck remains across its floor.
    if(k==='core'&&dead)return;
    if(k==='device'){
      this.kit(dead?'coreBroken':'core',x-3,y-1,w+6,h+2);
      if(!dead){
        this.metalBeam(x+4,y+2,w-8,3);
        const cx=x+w/2,cy=y+h*.57,lens=g.createRadialGradient(cx-1.4,cy-1.6,.4,cx,cy,4.5);
        lens.addColorStop(0,target.flash>0?'#fffbe4':'#ffb278');lens.addColorStop(.35,'#ed5732');lens.addColorStop(.7,'#ac231d');lens.addColorStop(1,'#3e1519');
        this.disc(cx,cy,5.3,'#192326');g.fillStyle=lens;g.beginPath();g.arc(cx,cy,4.5,0,Math.PI*2);g.fill();
        this.line(cx-2,cy-2,cx+.6,cy-2.7,'#ffe0a0',.55);
      }
      return;
    }
    if(target.mover){
      if(dead)return;
      drawBossBubble(g,x+w/2,y+h/2,w/2,h/2,this.state.time,true);
      if(target.flash>0){g.save();g.globalAlpha=.5;this.disc(x+w/2,y+h/2,w*.36,'#e5edff');g.restore();}
      return;
    }
    if(k==='switch'&&B.cleared)return;
    if(k==='switch'){
      const cx=x+w/2;
      g.save();g.translate(cx,y);g.scale(1,-1);
      if(!this.kit('post',-3,0,6,19))this.rect(-2,0,4,19,'#647983');g.restore();
      this.line(cx,y+h,cx,114,'#13232a',3);this.line(cx,y+h,cx,114,dead?'#3b4c50':'#b96d43',1);
      if(!dead){const yy=y+h+((this.state.time*8)%14);this.disc(cx,yy,.8,'#ffd790');}
    }
    const name=k==='bcore'?(dead?'bossBroken':'boss'):k==='core'?(dead?'coreBroken':'core'):(dead?'gunBroken':'gun');
    const art=k==='bcore'?{x:x-10,y:y-17,w:w+20,h:h+24}:{x:x-1,y:y-1,w:w+2,h:h+2};
    if(!this.kit(name,art.x,art.y,art.w,art.h))this.rect(x,y,w,h,dead?'#17232a':'#6a7f86');
    if(dead)return;
    if(target.flash>0){
      const frame=this.kitFrame(name,art.w,art.h),key='target-flash:'+name+':'+art.w+':'+art.h;let mask=this.cache.get(key);
      if(frame&&!mask){mask=this.createCanvas();mask.width=frame.width;mask.height=frame.height;const ink=mask.getContext('2d');ink.drawImage(frame,0,0);ink.globalCompositeOperation='source-in';ink.fillStyle='#fff6d1';ink.fillRect(0,0,mask.width,mask.height);this.cache.set(key,mask);}
      if(mask){g.save();g.globalAlpha=Math.max(0,target.flash/.06)*.38;g.drawImage(mask,art.x,art.y,art.w,art.h);g.restore();}
    }
    if(k==='switch'){
      const cx=x+w/2,cy=y+h*.52;
      this.disc(cx,cy,3.3,'#0a0c10');this.disc(cx,cy,2.1,target.flash>0?'#fff3c9':'#c33b20');
      this.disc(cx,cy-.35,1.05,'#ffb65a');this.line(cx-2,y+3,cx+2,y+3,'#d4e1e0',.65);
      g.save();g.globalAlpha=.14+.1*Math.sin(this.state.time*5);this.light(cx,cy,4.5,'rgba(255,116,47,.55)');g.restore();
    }
    if(k==='core'&&baseCoreShielded(B,this.state.empT)){
      for(let i=0;i<4;i++){
        const yy=y+3+i*4;
        this.rect(x+3,yy,w-6,2.6,'#304850');this.line(x+3,yy,x+w-3,yy,'#a5b8b6',.65);
      }
    }
    if(k==='core'||k==='bcore'){
      g.save();g.globalAlpha=.18+.1*Math.sin(this.state.time*4);this.light(x+w/2,y+h*.54,w*.32,'rgba(255,133,45,.52)');g.restore();
    }
  }
  barrier(){
    const g=this.g,t=this.state.time;
    this.kit('post',26,147,10,38);this.kit('post',348,147,10,38);
    g.save();g.lineJoin='round';g.lineCap='round';
    for(let row=0;row<2;row++){
      const points=barrierArc(t,row),pulse=.75+.2*Math.sin(t*37+row*2);
      g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));
      g.strokeStyle=`rgba(46,177,237,${pulse*.16})`;g.lineWidth=4;g.stroke();
      g.strokeStyle=`rgba(87,209,253,${pulse*.5})`;g.lineWidth=1.6;g.stroke();
      g.strokeStyle=`rgba(220,253,255,${pulse})`;g.lineWidth=.48;g.stroke();
      // Short forked discharges travel along each strand rather than pulsing a static line.
      for(let i=0;i<3;i++){
        const index=5+((Math.floor(t*32)+i*47+row*31)%145),[x,y]=points[index],side=(i+row)%2?1:-1;
        this.line(x,y,x+2,y+side*3,'rgba(169,240,255,.65)',.4);
        this.line(x+2,y+side*3,x+5,y+side*1.5,'rgba(169,240,255,.4)',.3);
      }
    }
    g.restore();
    this.disc(31,149,.55,'#e3faff');this.disc(353,149,.55,'#e3faff');
  }
  figure(p,role='blue',size=1,enemy=false,transition=0){
    if(p.deathHidden)return;
    const g=this.g,giant=p.giantT>0&&!enemy?2:1,world={...p,giantT:0};
    const artPose=baseActorPose(p,enemy,transition>0);
    if(!p.spin&&!p.dead){g.save();g.fillStyle='rgba(0,7,12,.27)';g.beginPath();g.ellipse(p.x,p.y-.2,(enemy?6:9)*size*giant,1.4*size*giant,0,0,Math.PI*2);g.fill();g.restore();}
    const hit=(this.state.fx||[]).find(f=>f.k==='impact'&&f.material==='shield'&&f.t<.2&&Math.abs(f.x-p.x)<20);
    if(!enemy){
      drawShieldField(g,p,this.state.time,true);
      drawRiotShield(g,p,this.state.time,hit?1-hit.t/.2:0);
    }
    g.save();g.translate(p.x,p.y);g.scale(size*giant,size*giant);
    if(enemy&&p.flash>0)g.filter='brightness(1.65) saturate(.65)';
    if(p.aimDx&&!p.prone&&!p.spin)g.transform(1,0,-p.aimDx*.2,1,0,0);
    if(transition>0)g.globalAlpha*=1-transition*.65;
    this.baseActors.draw(g,{...world,artPose,ay:p.aimUp?-1:0,statusTime:this.state.time},role,this.scale*size*giant);
    g.restore();
    if(p.dead||enemy)return;
    drawShieldField(g,p,this.state.time,false,hit?1-hit.t/.2:0);
    if(p.flashT>0&&!(this.state.base?.trans>0)&&!this.state.base?.dead)this.muzzle(p.fx+(p.flashUp?0:5*giant),p.fy);
  }
  supplyUniform(){
    if(this.images.supplyEnemy?.naturalWidth)return;
    const source=this.images.frontEnemy;if(!(source?.naturalWidth>0))return;
    const canvas=this.createCanvas();canvas.width=source.naturalWidth;canvas.height=source.naturalHeight;
    const ink=canvas.getContext('2d');ink.drawImage(source,0,0);
    const pixels=ink.getImageData(0,0,canvas.width,canvas.height);redSupplyUniform(pixels.data);ink.putImageData(pixels,0,0);
    // HDActorArt accepts this CanvasImageSource using the same atlas dimensions.
    canvas.naturalWidth=canvas.width;canvas.naturalHeight=canvas.height;this.images.supplyEnemy=canvas;
  }
  soldiers(B,near=false){
    const list=[...B.sol.filter(s=>!s.dead).map(s=>({z:s.z,s})),...B.rol.filter(r=>!r.dead).map(r=>({z:r.z,r}))].sort((a,b)=>b.z-a.z);
    for(const thing of list){
      if((thing.z<.3)!==near)continue;
      if(thing.s){
        const s=thing.s,point=basePoint(s.u,s.z),scale=baseSoldierScale(s.z),moving=s.st!=='aim';
        if(s.dropKind)this.supplyUniform();
        this.figure({...s,...point,onGround:true,vx:moving?62:0,anim:(s.anim||0)*1.25},s.dropKind?'supply':'enemy',scale,true);
      }else{
        const r=thing.r,point=basePoint(r.u0+(r.ut-r.u0)*(1-r.z),r.z),diameter=(r.spd>.5?10:8)*baseScale(r.z);
        this.g.save();this.g.translate(point.x,point.y-diameter/2);this.g.rotate(r.a);this.kit('mine',-diameter/2,-diameter/2,diameter,diameter);this.g.restore();
      }
    }
  }
  shots(G){
    if(G.base?.trans>0||G.base?.dead)return;
    const g=this.g;
    for(const b of G.eb)if(!b.dead){
      if(b.bubble){drawBossBubble(g,b.x,b.y,b.r,b.r*.8,G.time+(b.phase||0));continue;}
      this.light(b.x,b.y,(b.r||2)+1.5,'rgba(255,111,61,.5)');this.disc(b.x,b.y,(b.r||2)*.72,'#ff9c4f');this.disc(b.x-.2,b.y-.2,(b.r||2)*.3,'#fff1cf');
    }
    for(const b of G.pb){
      if(b.dead)continue;const progress=Math.min(1,b.t||0),radius=Math.max(.5,1.5*(1-.6*progress));
      const owner=b.owner===2?G.p2:G.p,shift=b.upward?0:5*(owner?.giantT>0?2:1),x=b.x+shift*(1-progress);
      const direction=Math.atan2(b.ye-b.y0,b.xe-b.x0-shift),length=b.k==='laser'?11:4;
      this.line(x-Math.cos(direction)*length,b.y-Math.sin(direction)*length,x,b.y,b.k==='laser'?'#95eaff':'#ffe8b6',b.k==='laser'?1.4:.8);
      this.disc(x,b.y,radius,b.k==='fire'?'#ffc05c':'#fff7df');
      if(b.k==='fire')this.light(x,b.y,3,'rgba(255,144,39,.6)');
    }
    for(const grenade of G.gr)if(!grenade.dead){g.save();g.translate(grenade.x,grenade.y);g.rotate(grenade.a||0);this.kit('mine',-2.2,-2.2,4.4,4.4);g.restore();}
  }
  groundItems(G){
    const g=this.g;
    for(const item of G.items)if(!item.dead){
      g.save();g.fillStyle='rgba(0,6,9,.32)';g.beginPath();g.ellipse(item.x,BASE_VIEW.floor-.3,5,.9,0,0,Math.PI*2);g.fill();g.restore();
      this.capsule(item.x,item.y-5,item.kind,false);
    }
  }
  sideLifts(G,players){
    const B=G.base;if(B.def.boss!=='eye')return;
    for(const side of [-1,1]){
      const x=side<0?13:341,rider=players.find(p=>p.liftSide===side);
      const py=rider?rider.y:204;
      if(py+6>=0&&py<216){
        this.metalBeam(x,py,30,4);
        this.rect(x,py+4,30,2,'#642c23');
        for(let xx=x+2;xx<x+29;xx+=5)this.line(xx,py+1,xx+2,py+3,'#4a5a4e',.6);
      }
    }
  }
  effects(effects){
    super.effects(effects.filter(f=>f.k!=='baseMineBlast'));
    const g=this.g;
    for(const f of effects){
      if(f.k!=='baseMineBlast'||f.dead)continue;
      const p=Math.min(1,f.t/f.life),radius=3+23*Math.sqrt(p);
      g.save();g.globalAlpha=(1-p)*.65;g.beginPath();g.ellipse(f.x,f.y+3,radius,radius*.22,0,0,Math.PI*2);
      g.strokeStyle='#ffc98a';g.lineWidth=1.1*(1-p)+.2;g.stroke();
      this.light(f.x,f.y-3,16*(1-p),'rgba(255,157,47,.5)');g.restore();
    }
  }
  hud(G,options){
    const g=this.g,B=G.base;g.save();
    const shade=g.createLinearGradient(0,0,0,38);shade.addColorStop(0,'rgba(2,13,20,.96)');shade.addColorStop(.7,'rgba(2,13,20,.82)');shade.addColorStop(1,'rgba(2,13,20,0)');g.fillStyle=shade;g.fillRect(0,0,384,38);
    this.playerHud(G,G.p,{x:8,blue:false,role:StageOneArt.playerRole(options.online),inventory:G.inv,selection:G.sel,cooldown:G.nadeCd,infinite:options.settings.inf==='on',local:!options.guest});
    if(options.online&&G.p2)this.playerHud(G,G.p2,{x:248,blue:true,inventory:G.inv2,selection:G.sel2,cooldown:G.nadeCd2,infinite:options.settings.inf==='on',local:!!options.guest});
    else {const theme=baseRoomTheme(B);this.hudText('第二关',376,4,'#e1e6db',7,'right');this.hudText(theme.code+' · '+theme.name,376,17,theme.accent,5.8,'right');}
    this.hudText('最高分  '+String(Math.max(options.highScore||0,G.score)).padStart(6,'0'),192,5,'#b8c4b9',6,'center',84);
    const target=B.targets.find(t=>t.k==='bcore'),core=B.targets.find(t=>t.k==='core');
    if(target&&!B.dead){
      this.hudText('中枢',151,17.5,'#c9b884',5.3);this.rect(166,17.5,66,5.5,'#4b605d');this.rect(166.5,18,65,4.5,'#111c20');
      this.rect(167,18.5,64*Math.max(0,target.hp/target.max),3.5,B.phase2?'#ef8b48':'#b16c3f');
      for(let i=1;i<4;i++)this.rect(167+i*16,18.5,.45,3.5,'#19262b');
    }else this.hudText(B.dead?'中枢已摧毁':B.def.boss==='eye'?B.bossPhase==='reveal'?'上方装置启动中':`下层装置 ${bossDevicesRemaining(B)} / 6`:B.cleared?'通道已开启':B.targets.some(t=>t.k==='switch'&&t.hp>0)?'跳跃射击上方机关':`${baseRoomTheme(B).code} 区 · ${core&&baseCoreShielded(B,G.empT)?'先摧毁炮台':'核心已暴露'}`,192,18,'#b4c8c7',5.3,'center',90);
    if(G.bannerT>0&&G.bannerText)this.hudText(G.bannerText,192,43,'#e4c995',6,'center',230);
    if(B.bossPhase==='mover'&&!B.dead&&!(G.bannerT>0))this.hudText('按上举枪 · 射击顶部装置',192,38,'#d9e8bd',6,'center',180);
    if(B.cleared&&B.trans<=0&&!B.def.boss){
      this.hudText('前往'+nextBaseRoomTheme(B).name+' · 按上前进',192,151,'#d9e8de',6,'center',120);
      const yy=164+Math.sin(G.time*4)*1.2;this.line(188,yy,192,yy-4,'#c1dfd8',1);this.line(192,yy-4,196,yy,'#c1dfd8',1);
    }
    if(B.exitReady)this.hudText(options.players.some(p=>p.liftSide)?'乘升降梯前往第三关':'两侧升降梯已开放 · 向左 / 右进入',192,154,'#d9e8bd',6,'center',220);
    g.restore();
  }
  render(destination,G,options){
    this.prepare(destination);this.state=G;const g=this.g,B=G.base;
    if(G.mode==='intro'){
      this.backdrop();g.save();g.globalAlpha=.82;this.rect(0,0,384,216,'#020c13');g.restore();
      this.hudText('第二关',192,63,'#e7e8db',16,'center');this.hudText('地下指挥所',192,88,'#d1b376',8,'center');
      this.figure({x:options.online?174:192,y:158,onGround:true},StageOneArt.playerRole(options.online));
      if(options.online)this.figure({x:213,y:158,onGround:true},'blue');
      this.present(destination);return;
    }
    const trans=B.trans>0?Math.max(0,Math.min(1,1-B.trans/1.3)):0;
    g.save();if(G.shake>0)g.translate(Math.sin(G.t*1.71)*G.shake*.55,Math.cos(G.t*1.13)*G.shake*.35);
    if(trans>0){g.translate(192,105);g.scale(1+trans*trans*1.25,1+trans*trans*1.25);g.translate(-192,-105);}
    this.backdrop(B);if(B.def.boss)this.bossWall(B);this.roomIdentity(B);this.portal(B);
    for(const target of B.targets)this.target(target,B);
    // Floor drops travel with the same advancing room transform, behind the actors.
    this.groundItems(G);
    g.restore();
    if(B.trans>0){
      const phase=(G.time*1.1)%1;
      for(let i=0;i<6;i++){const z=(i/6+phase)%1,point=basePoint(0,z);this.line(96*z,point.y,384-96*z,point.y,baseRoomTheme(B).trail,.45);}
    }
    this.soldiers(B);if(!B.cleared&&!B.def.boss&&!B.dead)this.barrier();this.soldiers(B,true);
    this.shots(G);
    this.sideLifts(G,options.players);
    if(G.decoyT>0)this.figure({x:G.decoyX,y:204,onGround:true,camoT:1},'blue');
    for(const [i,p]of options.players.entries()){
      const point=trans>0?{...p,x:p.x+(192-p.x)*trans*.4,y:p.y-trans*48,vx:60,onGround:true}:p;
      this.figure(point,StageOneArt.playerRole(options.online,i),1-trans*.4,false,trans);
    }
    this.effects(G.fx);this.hud(G,options);
    if(G.flashT>0){g.save();g.globalAlpha=Math.min(.6,G.flashT*2);this.rect(0,0,384,216,'#fff7e8');g.restore();}
    this.present(destination);
  }
}
