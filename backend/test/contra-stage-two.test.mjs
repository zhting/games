import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STAGE_TWO_ASSETS, baseActorPose, basePoint, baseScale, barrierArc, StageTwoArt } from '../../games/contra2026/js/stage-two-art.mjs';
import { BASE_ACTORS, BASE_KIT } from '../../games/contra2026/js/stage-two-atlas.mjs';
import { BASE_UPWARD, baseUpMuzzle } from '../../games/contra2026/js/base-actor-poses.mjs';
import { BASE_ROOM_THEMES, baseRoomTheme, nextBaseRoomTheme, baseRoomSignals } from '../../games/contra2026/js/stage-two-rooms.mjs';
import { BASE_SOLDIER, baseSoldierScale } from '../../games/contra2026/js/base-soldier.mjs';
import { beginDeath } from '../../games/contra2026/js/player-death.mjs';
import { redSupplyUniform } from '../../games/contra2026/js/base-supply.mjs';

test('红色补给兵只替换橄榄绿制服，皮肤、枪靴和透明像素保持原色',()=>{
  const colors=[[74,91,30,255],[170,187,65,255],[242,149,73,255],[82,53,25,255],[22,24,27,255],[175,181,186,255],[70,90,30,0]];
  const data=new Uint8ClampedArray(colors.flat());redSupplyUniform(data);
  for(let i=0;i<2;i++){assert.ok(data[i*4]>data[i*4+1]*3);assert.equal(data[i*4+3],255);}
  for(let i=2;i<colors.length;i++)assert.deepEqual([...data.slice(i*4,i*4+4)],colors[i]);
});

test('第二关红蓝角色死亡保持站姿原画比例，完整倒地后按原流程淡出',()=>{
  const make=()=>({getContext:()=>({drawImage(){}})});
  const art=new StageTwoArt({createCanvas:make,imageFactory:()=>({naturalWidth:1086})});
  for(const role of ['red','blue']){
    const sheet=BASE_ACTORS[role],stand=art.baseActors.frame(role,'idle',10),dead=art.baseActors.frame(role,'dead',10),bounds=sheet.frames.dead.bounds;
    assert.ok(Math.abs(dead.w/bounds[2]-stand.h/sheet.frames.idle.bounds[3])<.00001,'native pixels have the same scale before and after death');
    assert.ok(dead.w>=stand.h&&dead.w<stand.h*1.15,'lying body is as long as the standing body');
    assert.ok(dead.h>18);assert.ok(Math.abs(dead.y+dead.h)<.001);
    const draws=[],g=new Proxy({globalAlpha:1,drawImage:(...args)=>draws.push(args)},{get:(o,k)=>k in o?o[k]:(()=>{})});
    const p={face:1};beginDeath(p);art.baseActors.draw(g,p,role,10);
    assert.ok(draws[0][4]>=38,'airborne death retains full standing height');
    p.deathGrounded=true;p.deathLandT=.05;art.baseActors.draw(g,p,role,10);
    assert.equal(draws[1][3],dead.w);assert.equal(draws[1][4],dead.h);
    p.deathLandT=.2;art.baseActors.draw(g,p,role,10);assert.equal(draws[2][3],dead.w);
    p.deathLandT=.68;art.baseActors.draw(g,p,role,10);assert.equal(draws.length,3,'fully faded body is no longer drawn');
  }
});

test('第二关敌兵与主角同一基础身高，前中后景保持连续合理比例和脚底位置',()=>{
  const make=()=>({getContext:()=>({drawImage(){}})});
  const art=new StageTwoArt({createCanvas:make,imageFactory:()=>({naturalWidth:1086})});
  const hero=art.baseActors.frame('blue','idle',5),enemy=art.baseActors.frame('enemy','idle',5);
  assert.equal(enemy.h,BASE_SOLDIER.height);assert.ok(Math.abs(enemy.h-hero.h)<.01);
  for(const z of [0,.3,.5,.7,1]){
    const size=baseSoldierScale(z),ratio=enemy.h*size/hero.h;
    assert.ok(ratio>=.7-.001&&ratio<=1.001);if(z<=.3)assert.ok(ratio>=.9);
    assert.ok(Math.abs(enemy.y+enemy.h)<.01,'feet retain their projection anchor');
  }
  const draws=[],context={figure:(p,role,size)=>draws.push({p,role,size}),g:{save(){},restore(){},translate(){},rotate(){}},kit(){}};
  const B={sol:[{u:0,z:.7,st:'walk',anim:1},{u:0,z:.2,st:'aim',anim:0}],rol:[]};
  StageTwoArt.prototype.soldiers.call(context,B);StageTwoArt.prototype.soldiers.call(context,B,true);
  assert.equal(draws.length,2);assert.equal(draws[0].size,baseSoldierScale(.7));assert.equal(draws[1].size,baseSoldierScale(.2));
  assert.equal(draws[0].p.y,basePoint(0,.7).y);assert.equal(draws[1].p.y,basePoint(0,.2).y);
});

test('第二关高清机关与三张正背视角色图集存在，透明源图裁切不越界',()=>{
  for(const [key,url]of Object.entries(STAGE_TWO_ASSETS)){
    const png=fs.readFileSync(new URL('../..'+url,import.meta.url));
    assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');
    const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
    assert.ok(width>=1000,'source has native fine detail');
    if(BASE_ROOM_THEMES.some(theme=>theme.asset===key))continue;
    assert.equal(png[25],6,'sprite source retains RGBA alpha');
    const atlas=Object.values(BASE_ACTORS).find(sheet=>sheet.key===key);
    if(atlas){
      assert.deepEqual(atlas.size,[width,height]);assert.equal(Object.keys(atlas.frames).length,12);
      assert.ok(atlas.frames.idle.bounds[3]>=340);
      for(const frame of Object.values(atlas.frames)){
        const[x,y,w,h]=frame.bounds;assert.ok(x>=0&&y>=0&&x+w<=width&&y+h<=height);
      }
    }
    if(key==='kit')for(const[x,y,w,h]of Object.values(BASE_KIT.frames))assert.ok(x>=0&&y>=0&&x+w<=width&&y+h<=height);
  }
});

test('第二关四个房间选择独立背景，返回已缓存房间不串图，投影与目标平面保持一致',()=>{
  const images=[],draws=[];
  const make=()=>{const canvas={};canvas.getContext=()=>new Proxy({canvas,globalAlpha:1,drawImage:(...args)=>draws.push(args)},
    {get:(o,k)=>k in o?o[k]:()=>{}});return canvas;};
  const art=new StageTwoArt({createCanvas:make,imageFactory:()=>{const image={naturalWidth:1672,naturalHeight:941};images.push(image);return image;}});
  images.forEach(image=>image.onload());art.prepare({canvas:{width:1920,height:1080}});
  const rooms=[0,1,2,3].map(room=>({room,def:room===3?{boss:'eye'}:{}}));
  for(const [index,base]of rooms.entries()){
    const theme=baseRoomTheme(base),before=draws.length;art.backdrop(base);
    const painted=draws.slice(before).filter(d=>d[0]===art.images[theme.asset]);
    assert.equal(painted.length,9,theme.name);
    assert.deepEqual(painted[4].slice(5),[480,200,960,500],'后墙仍注册到原 96,40,192,100 投影平面');
    assert.equal(theme,BASE_ROOM_THEMES[index]);
    if(index<3)assert.equal(nextBaseRoomTheme(base),BASE_ROOM_THEMES[index+1]);
    const signals=baseRoomSignals(base,2);
    assert.deepEqual(signals,baseRoomSignals(base,2),'暂停时侧壁灯光不改变');
    assert.ok(signals.every(s=>(s.x<96||s.x>288)&&s.y+s.h<140),'装饰避开后墙目标和近景地面');
  }
  assert.equal(new Set(rooms.map(b=>baseRoomTheme(b).asset)).size,4);
  const count=draws.length;art.backdrop(rooms[1]);
  assert.equal(draws.length,count+1,'已有房间只合成缓存画面');
  assert.equal(draws.at(-1)[0],art.cache.get('corridor:power'));
  assert.equal(art.cache.get('corridor:power').width,1920);
  art.prepare({canvas:{width:768,height:432}});assert.equal(art.cache.size,0);
  art.backdrop(rooms[2]);assert.equal(art.cache.get('corridor:armory').width,768);
});

test('第二关独立背视步态包含八帧，站立、卧倒、翻滚和阵亡不继续跑步',()=>{
  const moving={vx:90,onGround:true},poses=new Set();
  for(let i=0;i<80;i++)poses.add(baseActorPose({...moving,anim:42/90*i/80*10}));
  assert.equal(poses.size,8);for(const pose of poses)assert.ok(BASE_ACTORS.blue.frames[pose]);
  for(const [change,pose]of [[{vx:0},'idle'],[{onGround:false},'idle'],[{prone:true},'prone'],[{spin:true},'roll'],[{dead:true},'dead']])assert.equal(baseActorPose({...moving,...change}),pose);
  assert.ok(baseActorPose({vx:0,anim:1},false,true).startsWith('run'));
  assert.deepEqual(basePoint(-160,1),{x:112,y:140});assert.deepEqual(basePoint(160,0),{x:352,y:204});assert.equal(baseScale(.3),.85);
});

test('红蓝举枪使用独立背视原画，枪口、跑动和巨大化共用同一锚点，整个人物统一描边',()=>{
  const make=()=>{const canvas={},ink=new Proxy({globalAlpha:1},{get:(o,k)=>k in o?o[k]:()=>{}});canvas.getContext=()=>ink;return canvas;};
  const art=new StageTwoArt({createCanvas:make,imageFactory:()=>({naturalWidth:1536})});
  const png=fs.readFileSync(new URL('../../games/contra2026/assets/stage2/commando-upward-v1.png',import.meta.url));
  const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
  for(const role of ['blue','red']){
    const meta=BASE_UPWARD[role],[x,y,w,h]=meta.bounds,up=art.baseActors.frame(role,'up',8);
    assert.ok(x>=0&&y>=0&&x+w<=width&&y+h<=height);assert.ok(meta.muzzle[1]>=y&&meta.muzzle[1]<y+10);
    assert.equal(up.h,h*meta.scale);assert.equal(up.y+up.h,0);assert.ok(up.h>50&&up.h<53);
    for(const giant of [false,true])for(const moving of [false,true]){
      const p={x:192,y:204,vx:moving?90:0,onGround:true,anim:1.3,aimUp:true,giantT:giant?10:0,giantGraceT:2},pose=baseActorPose(p);
      assert.equal(pose.startsWith('run'),moving);if(!moving)assert.equal(pose,'up');
      const muzzle=baseUpMuzzle(p,role),size=giant?2:1;
      assert.ok(muzzle.y<204-48*size&&muzzle.y>204-54*size);
      const draws=[],g=new Proxy({globalAlpha:1,drawImage:(...args)=>draws.push(args)},{get:(o,k)=>k in o?o[k]:()=>{}});
      art.baseActors.draw(g,{...p,artPose:pose,ay:-1},role,8);
      assert.equal(draws.length,6,'outline follows one finished figure, including moving legs');
      if(moving){const frame=art.baseActors.movingFrames.get(`${role}:aim:8`);assert.equal(draws[4][0],frame.canvas);assert.ok(frame.canvas.height>=frame.h*8);}
    }
  }
  assert.equal(baseActorPose({aimUp:true,onGround:true,vx:0},true),'idle');
});

test('两侧升降梯只绘制底板，越过原来的半高边界后继续升到顶部，完成后不重现地面底板',()=>{
  for(const side of [-1,1])for(const y of [204,140,88,60,20,0,-4,-28]){
    const beams=[],rects=[],context={metalBeam:(...args)=>beams.push(args),rect:(...args)=>rects.push(args),line(){}};
    const G={base:{def:{boss:'eye'},exitReady:true}},rider={liftSide:side,liftDone:y<0,y};
    StageTwoArt.prototype.sideLifts.call(context,G,[rider]);
    assert.ok(beams.every(b=>b[2]===30&&b[3]===4),'there are no vertical rails or ladder rungs');
    const beam=beams.find(b=>b[0]===(side<0?13:341));
    assert.equal(!!beam,y+6>=0);if(beam)assert.equal(beam[1],y,'the platform stays under the rider all the way to the top');
    assert.ok(rects.every(r=>r[2]===30&&r[3]===2),'no enclosing shaft is painted');
  }
});

test('第二关 4K 表面和机关缓存使用原生显示密度，缩小窗口会释放旧缓存',()=>{
  const images=[],draws=[];
  const make=()=>{const canvas={};canvas.getContext=()=>new Proxy({canvas,globalAlpha:1,drawImage:(...args)=>draws.push(args)}, {get:(o,k)=>k in o?o[k]:()=>{}});return canvas;};
  const art=new StageTwoArt({createCanvas:make,imageFactory:()=>{const image={};images.push(image);return image;}});
  for(const image of images)image.onload();assert.ok(art.ready);
  art.prepare({canvas:{width:3840,height:2160}});
  const frame=art.kitFrame('gun',20,16);assert.equal(frame.width,200);assert.equal(frame.height,160);
  assert.equal(art.kitFrame('gun',20,16),frame);
  art.prepare({canvas:{width:768,height:432}});assert.equal(art.cache.size,0);assert.equal(art.baseActors.cache.size,0);
  const small=art.kitFrame('gun',20,16);assert.equal(small.width,40);assert.equal(small.height,32);
});

test('第二关过门时掉落物跟随地面、隐藏旧弹丸，HUD 保持固定',()=>{
  for(const remaining of [0,1.3,.975,.65,.325,.01]){
    let matrix={sx:1,sy:1,x:0,y:0},floorMatrix,hudMatrix;
    const stack=[],icons=[],projectiles=[];
    const g=new Proxy({
      save(){stack.push({...matrix});},restore(){matrix=stack.pop();},
      translate(x,y){matrix.x+=x*matrix.sx;matrix.y+=y*matrix.sy;},
      scale(x,y){matrix.sx*=x;matrix.sy*=y;}
    },{get:(o,k)=>k in o?o[k]:()=>{}});
    const art={g,groundItems:StageTwoArt.prototype.groundItems,shots:StageTwoArt.prototype.shots,
      backdrop(){floorMatrix={...matrix};},hud(){hudMatrix={...matrix};},
      light(){projectiles.push('glow');},disc(){projectiles.push('bullet');},kit(){projectiles.push('grenade');},
      capsule(x,y,kind){icons.push({kind,x:x*matrix.sx+matrix.x,foot:(y+5)*matrix.sy+matrix.y,scale:matrix.sx});}};
    for(const method of ['prepare','roomIdentity','portal','target','soldiers','sideLifts','line','effects','present'])art[method]=()=>{};
    const G={mode:'play',base:{room:0,def:{},cleared:true,trans:remaining,targets:[]},time:2,t:120,
      items:[{x:112,y:204,kind:'L',rest:true},{x:272,y:204,kind:'S',rest:true},{x:190,y:204,kind:'F',dead:true}],
      eb:[{x:180,y:150,r:2}],pb:[{k:'laser',x:194,y:156,x0:192,y0:166,xe:192,ye:129,t:.3}],gr:[{x:200,y:170}],fx:[]};
    const before=JSON.stringify(G.items);
    StageTwoArt.prototype.render.call(art,{},G,{players:[]});
    assert.equal(projectiles.length>0,remaining===0,'stale network shots are hidden for the entire advance animation');
    assert.equal(icons.length,2);
    for(const [i,icon]of icons.entries()){
      assert.equal(icon.x,G.items[i].x*floorMatrix.sx+floorMatrix.x);
      assert.equal(icon.foot,204*floorMatrix.sy+floorMatrix.y);
      assert.equal(icon.scale,floorMatrix.sx);
      if(remaining>0&&remaining<1.3)assert.ok(icon.foot>204,'原地物品随近处地面离开屏幕下缘');
    }
    assert.deepEqual(hudMatrix,{sx:1,sy:1,x:0,y:0});
    assert.equal(JSON.stringify(G.items),before,'渲染不改写掉落位置或拾取状态');
  }
});

test('电弧折线随时间跳动，两端仍固定在接线柱，暂停时形状不变',()=>{
  for(const row of [0,1]){
    const a=barrierArc(2,row),b=barrierArc(2.12,row);
    assert.deepEqual(a,barrierArc(2,row));assert.notDeepEqual(a,b);
    assert.deepEqual(a[0],b[0]);assert.deepEqual(a.at(-1),b.at(-1));
    assert.ok(a.slice(1,-1).filter((p,i)=>Math.abs(p[1]-b[i+1][1])>.3).length>80);
    assert.ok(a.every(p=>Math.abs(p[1]-a[0][1])<2));
  }
});

test('蓝红角色卧倒保持与站姿接近的原画缩放，脚底锚点不跳动',()=>{
  const make=()=>({getContext:()=>({drawImage(){}})});
  const art=new StageTwoArt({createCanvas:make,imageFactory:()=>({naturalWidth:1086})});
  for(const role of ['blue','red']){
    const standing=art.baseActors.frame(role,'idle',5),prone=art.baseActors.frame(role,'prone',5);
    const native=BASE_ACTORS[role].frames.prone.bounds;
    assert.ok(prone.w>=standing.w,'prone shoulders/body do not become a miniature');
    assert.ok(prone.h>=25&&prone.h<=26);
    assert.ok(prone.w/native[2]>=BASE_ACTORS[role].scale*.9,'head and limbs retain native proportions');
    assert.ok(Math.abs(prone.y+prone.h)<.01,'same floor anchor');
  }
});
