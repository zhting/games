import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { InputBuffer, packWorld, unpackWorld, encodeInput } from '../../games/contra2026/js/coop-core.mjs';
import { StageOneArt, FORTRESS_ART, FORTRESS_TARGETS, FORTRESS_EXIT } from '../../games/contra2026/js/stage-one-art.mjs';
import { StageTwoArt } from '../../games/contra2026/js/stage-two-art.mjs';
import { baseUpMuzzle } from '../../games/contra2026/js/base-actor-poses.mjs';
import { OPENING_DURATION, OPENING_PAGES } from '../../games/contra2026/js/opening-story.mjs';
import { drawSupplySaucer } from '../../games/contra2026/js/supply-saucer.mjs';
import { BASE_SOLDIER, baseSoldierScale } from '../../games/contra2026/js/base-soldier.mjs';
import { BASE_HIGH_SWITCH, baseShotHeight, baseTargetAtHeight, baseCoreShielded, baseHomingTarget } from '../../games/contra2026/js/base-shooting.mjs';
import { baseSupplyKind } from '../../games/contra2026/js/base-supply.mjs';
import { BASE_BOSS_DEVICES, BASE_BOSS_MOVER, bossDevicesRemaining, movingBossX, advanceBossLift } from '../../games/contra2026/js/base-boss.mjs';
import { canEnterExit, beginExitEntry, advanceExitEntry, teamInsideExit } from '../../games/contra2026/js/stage-one-exit.mjs';
import { ReferenceMusic, StageMusicSession, referenceTrackForScene, musicForScene, stageMusicOptions, stageMusicPool, normalizeStageMusic } from '../../games/contra2026/js/reference-music.mjs';
import { musicRecord } from '../../games/contra2026/js/music-records.mjs';
import { OPEN_STAGES, LAST_OPEN_STAGE, STAGE_RELEASE_MESSAGE, isStageOpen, nextOpenStage } from '../../games/contra2026/js/release-stages.mjs';
import { beginDeath, advanceDeath, deathVisual } from '../../games/contra2026/js/player-death.mjs';
import { addImpact } from '../../games/contra2026/js/impact-effects.mjs';
import { GIANT_POWER, startGiant, endGiant, updateGiant, hitGiant, giantCrushBox, giantPowerLabel, drawGiantStomp } from '../../games/contra2026/js/giant-power.mjs';

// Run the real inline game engine with a no-op drawing surface. No production
// mutation hooks are exposed; the test hook is injected into this VM only.
function engine() {
  const elements = new Map(), storage = new Map();
  const gradient = { addColorStop() {} };
  const context = new Proxy({
    measureText: text => ({ width: String(text).length * 6 }),
    createLinearGradient: () => gradient, createRadialGradient: () => gradient,
  }, { get: (o, key) => key in o ? o[key] : () => {}, set: (o, key, value) => (o[key] = value, true) });
  let document;
  function element() {
    const classes = new Set();
    return {
      hidden: true, value: '1', style: { setProperty() {} }, clientWidth: 768, clientHeight: 432,
      classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c), toggle(c, enabled) { if (enabled) classes.add(c); else classes.delete(c); } },
      getContext: () => context, addEventListener() {}, setAttribute() {}, getAttribute() { return null; },
      querySelector() { return null; }, querySelectorAll: () => [],
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 768, height: 432 }),
      focus() { document.activeElement = this; }, blur() {},
    };
  }
  document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    createElement: element, addEventListener() {}, body: element(), activeElement: null, hidden: false,
  };
  class Network {
    playing = false; role = 'host'; room = ''; remote = new InputBuffer();
    constructor(callbacks) { this.callbacks = callbacks; }
    leave() { this.playing = false; this.room = ''; }
  }
  const sandbox = {
    document, navigator: { maxTouchPoints: 0, getGamepads: () => [] },
    location: { href: 'http://localhost/games/contra2026/', origin: 'http://localhost', search: '' },
    matchMedia: () => ({ matches: false }), addEventListener() {}, requestAnimationFrame() {},
    innerWidth: 768, innerHeight: 432, performance: { now: () => 0 },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    Image: class { complete = false; naturalWidth = 0; },
    URL, URLSearchParams, Math, Date, Set, Map, console, setTimeout, clearTimeout, setInterval, clearInterval,
    CoopClient: Network, packWorld, unpackWorld, StageOneArt, StageTwoArt, baseUpMuzzle, FORTRESS_ART, FORTRESS_TARGETS,
    ReferenceMusic, StageMusicSession, referenceTrackForScene, musicForScene, stageMusicOptions, stageMusicPool, normalizeStageMusic, musicRecord, OPEN_STAGES, LAST_OPEN_STAGE, STAGE_RELEASE_MESSAGE, isStageOpen, nextOpenStage, OPENING_DURATION, OPENING_PAGES, drawSupplySaucer, BASE_SOLDIER, baseSoldierScale,
    beginDeath, advanceDeath,
    addImpact,
    GIANT_POWER, startGiant, endGiant, updateGiant, hitGiant, giantCrushBox, giantPowerLabel, drawGiantStomp,
    BASE_HIGH_SWITCH, baseShotHeight, baseTargetAtHeight, baseCoreShielded, baseHomingTarget,
    baseSupplyKind,
    BASE_BOSS_DEVICES, BASE_BOSS_MOVER, bossDevicesRemaining, movingBossX, advanceBossLift,
    FORTRESS_EXIT, canEnterExit, beginExitEntry, advanceExitEntry, teamInsideExit,
  };
  sandbox.window = sandbox;
  const html = fs.readFileSync(new URL('../../games/contra2026/index.html', import.meta.url), 'utf8');
  let source = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n').replace(/^import .*$/gm, '');
  source = source.replace('// ================= loop =================', `
    window.engine = { G, K, SET, coop, reset, step, render, collide, collideBasePlayer, withPlayer2, startStage, startUWOpening, unlockUW, stageClear, element: id => document.getElementById(id),
      keepTeamOnScreen, updateCamera, loadRoom, collidePartnerHazards, updateEnemies, updateBoss, solids, BRIDGES, inWall, xMax, stageOneArt, Music, stageMusicSession, useSpecial, killPlayer, killSoldier,
      resizeWindow(width, height, dpr = 1) { $('wrap').clientWidth = width; $('wrap').clientHeight = height; window.devicePixelRatio = dpr; resize(); },
      resolution: () => ({ canvas: [cv.width, cv.height], backgrounds: backgroundResolution, sky: SKY && [SKY.width, SKY.height] }),
      play(stage, online = true) { coop.playing = online; reset(stage); setMode('play'); } };
    // ================= loop =================`);
  vm.runInNewContext(source, sandbox, { filename: 'contra2026-engine.js' });
  return sandbox.engine;
}

test('公开入口只开放前两关，旧秘籍与隐藏按钮不能启动后续关卡，唱片设置同样限前两关',()=>{
  const e=engine();e.play(1,false);e.G.p.weapon='laser';const player=e.G.p;
  for(const stage of [0,3,4,8,9,16,17,'2',1.5]){
    assert.equal(e.startStage(stage),false);assert.equal(e.G.stage,1);assert.equal(e.G.mode,'play');assert.equal(e.G.p,player);
  }
  assert.equal(e.startUWOpening(false),false);e.unlockUW('old cheat');
  assert.equal(e.G.stage,1);assert.equal(e.G.p.weapon,'laser');
  for(let stage=3;stage<=16;stage++){
    const button=e.element(stage<=8?'btnSel'+stage:'btnSelW'+(stage-8));
    assert.equal(button.hidden,true);assert.equal(button.disabled,true);
  }
  assert.equal((e.element('set-music-stage').innerHTML.match(/<option /g)||[]).length,2);
});

test('第二关结算在主客机均显示两关通关，隐藏下一关入口并保留重玩',()=>{
  const host=engine(),guest=engine();host.play(2,true);guest.play(2,true);guest.coop.role='guest';
  host.stageClear();
  assert.equal(host.G.stage,2);assert.equal(host.G.mode,'clear');
  guest.coop.callbacks.state(JSON.parse(JSON.stringify(packWorld([host.G,host.solids,host.BRIDGES,host.SET]))));
  for(const e of [host,guest]){
    assert.equal(e.element('btnNext').hidden,true);assert.equal(e.element('clearTitle').textContent,'前两关通关');
    assert.match(e.element('clearSub').textContent,/后续关卡制作中/);assert.equal(e.G.stage,2);
  }
});

test('真实引擎随机音乐在重新入关时重抽，暂停和第二关各房间保持本次选择',()=>{
  const e=engine();let draws=0;e.SET.stageMusic[2]='random';
  e.stageMusicSession.random=()=>draws++===0?0:.99;
  e.play(2,false);assert.equal(e.stageMusicSession.inspect().choice,'original');
  for(const room of [1,2,3]){e.loadRoom(room);e.Music.sync();}
  e.G.mode='pause';e.Music.sync();e.G.mode='play';e.Music.start(true);
  assert.equal(draws,1);assert.equal(e.stageMusicSession.inspect().choice,'original');
  e.play(2,false);assert.equal(draws,2);assert.equal(e.stageMusicSession.inspect().choice,'chiptune');
  assert.equal(e.SET.stageMusic[2],'random');
});

test('客机随机音乐独立于房主设置，同关新 intro 重抽一次且后续快照不重抽',()=>{
  const host=engine(),guest=engine();let draws=0;
  host.play(2,true);host.SET.stageMusic[2]='off';
  guest.SET.stageMusic[2]='random';guest.stageMusicSession.random=()=>draws++===0?0:.99;
  guest.play(2,true);guest.coop.role='guest';
  const sync=()=>guest.coop.callbacks.state(JSON.parse(JSON.stringify(packWorld([host.G,host.solids,host.BRIDGES,host.SET]))));
  sync();assert.equal(draws,1);assert.equal(guest.SET.stageMusic[2],'random');
  host.G.mode='intro';sync();assert.equal(draws,2);assert.equal(guest.stageMusicSession.inspect().choice,'chiptune');
  sync();host.G.mode='play';sync();host.G.mode='pause';sync();host.G.mode='play';sync();
  assert.equal(draws,2);assert.equal(guest.SET.stageMusic[2],'random');
});

test('实际高清片头绘制六段完整字幕，并按原时长进入第一关', () => {
  const e=engine();e.play(1,false);const drawn=[];
  e.stageOneArt.hudText=(text)=>drawn.push(text);
  e.G.mode='cine';e.G.cine={kind:'open',t:0,typed:0,skip:false,ev:{}};
  for(const page of OPENING_PAGES){
    drawn.length=0;e.G.cine.t=(page.from+page.to)/2;e.render();
    for(const line of page.lines)assert.ok(drawn.includes(line),line);
    assert.ok(drawn.some(text=>text.includes(page.tag)));
  }
  e.G.cine.t=OPENING_DURATION-.01;e.step();
  assert.equal(e.G.cine,null);assert.equal(e.G.stage,1);assert.equal(e.G.mode,'intro');
});

test('字幕片头仍可通过回车提前跳过，直接进入第一关',()=>{
  const e=engine();e.play(1,false);
  e.G.mode='cine';e.G.cine={kind:'open',t:2,typed:0,skip:false,ev:{}};
  e.step();e.K.Enter=true;e.step();
  assert.equal(e.G.cine,null);assert.equal(e.G.stage,1);assert.equal(e.G.mode,'intro');
});

test('飞碟侧翼可被真实子弹击落，下坠中不可拾取，第一次落地后才展开字母道具',()=>{
  const e=engine();e.play(1,false);e.G.en=[];e.G.eb=[];e.G.podTrig=[];e.G.spawnT=999;
  const pod={x:120,y:60,y0:60,t:0,kind:'S'};e.G.pods=[pod];
  e.G.pb=[{k:'b',x:130,y:60,vx:270,vy:0,dmg:1}];e.collide();
  assert.equal(pod.dead,true);assert.equal(e.G.items.length,1);
  const item=e.G.items[0];assert.equal(item.fromPod,true);assert.equal(item.landed,false);assert.ok(item.vy>0);
  Object.assign(e.G.p,{x:item.x,y:item.y+7,invT:999});e.collide();
  assert.ok(!item.dead);assert.equal(e.G.p.weapon,'rifle');
  Object.assign(e.G.p,{x:40,y:112,vy:0,onGround:true});
  for(let i=0;i<120&&!item.landed;i++)e.step();
  assert.equal(item.landed,true);assert.equal(item.rest,true);assert.equal(item.y,112);assert.equal(item.vx,0);assert.equal(item.vy,0);
  assert.ok(!item.dead);Object.assign(e.G.p,{x:item.x,y:item.y});e.collide();
  assert.equal(item.dead,true);assert.equal(e.G.p.weapon,'spread');
});

test('双人同步保留飞碟的下坠和展开状态，已落地补给可由二号玩家拾取',()=>{
  const e=engine();e.play(1,true);e.G.en=[];e.G.eb=[];e.G.podTrig=[];e.G.spawnT=999;
  e.G.items=[{x:120,y:111,vx:0,vy:50,kind:'L',fromPod:true,landed:false}];
  const falling=unpackWorld(JSON.parse(JSON.stringify(packWorld(e.G))));
  assert.equal(falling.items[0].fromPod,true);assert.equal(falling.items[0].landed,false);
  for(let i=0;i<4;i++)e.step();
  const item=e.G.items[0],landed=unpackWorld(JSON.parse(JSON.stringify(packWorld(e.G))));
  assert.equal(item.landed,true);assert.equal(landed.items[0].landed,true);
  Object.assign(e.G.p2,{x:item.x,y:item.y,invT:999});e.collide();
  assert.equal(item.dead,true);assert.equal(e.G.p2.weapon,'laser');assert.equal(e.G.p.weapon,'rifle');
});

test('主线八关双人模拟与绘制，世界时间只推进一次，两人各自发射子弹', () => {
  for (let stage = 1; stage <= 8; stage++) {
    const e = engine(); e.play(stage);
    e.K.KeyD = e.K.KeyJ = true;
    e.coop.remote.push(encodeInput({ left: true, fire: true, jump: true }));
    const shooters = new Set();
    for (let tick = 0; tick < 30; tick++) { e.step(); e.G.pb.forEach(b => shooters.add(b.owner)); if (tick % 5 === 0) e.render(); }
    assert.ok(Math.abs(e.G.time - .5) < .001, `stage ${stage}: world time`);
    assert.equal(e.G.p.pid, 1, `stage ${stage}: 1P context restored`);
    assert.equal(e.G.p2.pid, 2, `stage ${stage}: 2P context restored`);
    assert.ok(shooters.has(1), `stage ${stage}: 1P shots`);
    assert.ok(shooters.has(2), `stage ${stage}: 2P shots`);
    const copy = unpackWorld(JSON.parse(JSON.stringify(packWorld([e.G, e.solids, e.BRIDGES]))));
    assert.equal(copy[0].p2.pid, 2);
    assert.ok(JSON.stringify(packWorld([e.G, e.solids, e.BRIDGES])).length < 240 * 1024, 'snapshot fits relay payload');
  }
});

test('第一关实际敌兵移动时推进步态，冻结停止位移与动画，联机快照保留动作相位', () => {
  const e = engine(); e.play(1, false);
  const runner = { t: 'run', x: 140, y: 112, vx: 62, vy: 0, hp: 1, on: true, sup: null, dec: false, anim: 0, flash: 0 };
  e.G.en = [runner]; e.G.spawnT = 100;
  for (let i = 0; i < 20; i++) e.step();
  assert.ok(runner.x > 160); assert.ok(runner.anim > 3); assert.equal(runner.on, true);
  const copy = unpackWorld(JSON.parse(JSON.stringify(packWorld([e.G, e.solids, e.BRIDGES]))));
  assert.equal(copy[0].en[0].anim, runner.anim);
  const before = { x: runner.x, anim: runner.anim }; e.G.freezeT = 2;
  for (let i = 0; i < 20; i++) e.step();
  assert.equal(runner.x, before.x); assert.equal(runner.anim, before.anim);
  e.G.freezeT = 0; e.step();
  assert.ok(runner.x > before.x); assert.ok(runner.anim > before.anim);
});

function runnerScene(online=false){
  const e=engine();e.play(1,online);e.G.spawnT=999;e.G.eb=[];e.G.pods=[];e.G.items=[];
  Object.assign(e.G.p,{x:40,y:112,onGround:true,invT:0});
  if(online)Object.assign(e.G.p2,{x:75,y:112,onGround:true,invT:0});
  const soldier={t:'run',x:200,y:112,vx:-62,vy:0,hp:1,on:true,dec:false,anim:0,flash:0,fireT:0};e.G.en=[soldier];
  return{e,soldier};
}

test('第一关跑兵停步预瞄、水平单发后恢复移动并延长间隔，真实弹丸能击中玩家',()=>{
  const {e,soldier}=runnerScene();e.G.p.invT=999;
  e.step();assert.equal(soldier.attack.phase,'aim');assert.equal(soldier.x,200);assert.equal(e.G.eb.length,0);
  for(let i=0;i<12;i++)e.step();assert.equal(e.G.eb.length,0,'visible warning before the first shot');
  for(let i=0;i<8;i++)e.step();assert.equal(e.G.eb.filter(b=>b.from==='runner').length,1);assert.equal(soldier.x,200);
  assert.ok(e.G.eb.every(b=>b.vx<0&&b.vy===0));
  for(let i=0;i<15;i++)e.step();assert.equal(soldier.attack,null);assert.ok(soldier.x<200);assert.ok(soldier.anim>0);
  assert.ok(soldier.fireT>2.8);
  const hit=runnerScene();let died=false;
  for(let i=0;i<160&&!died;i++){hit.e.step();died=hit.e.G.p.dead;}
  assert.ok(died,'new bullets use real player collision');assert.ok(hit.soldier.x>hit.e.G.p.x+35,'death is not contact with the soldier');
});

test('第一关跑兵、固定射手和炮台对高低目标均只左右水平单发，冷却期不连射',()=>{
  for(const type of ['run','snp','tur'])for(const x of [40,350])for(const y of [40,170]){
    const e=engine();e.play(1,false);Object.assign(e.G.p,{x,y,invT:999});e.G.podTrig=[];e.G.spawnT=999;
    const enemy={t:type,x:200,y:type==='tur'?96:112,hp:6,vx:0,vy:0,on:true,idx:3,rotT:0,fireT:0,anim:0};
    e.G.en=[enemy];e.G.eb=[];
    for(let i=0;i<90;i++)e.updateEnemies();
    assert.equal(e.G.eb.length,1,`${type} at ${x},${y}: one shot during cooldown`);
    const b=e.G.eb[0];assert.equal(b.vy,0);assert.equal(b.g,0);assert.equal(Math.sign(b.vx),x<200?-1:1);
    if(type==='run')assert.equal(enemy.ay,0);
    if(type==='snp')assert.equal(enemy.ay,0);
    if(type==='tur')assert.equal(enemy.idx,x<200?6:0);
  }
});

test('第一关关底两门炮每次只有一发水平弹，取消散射与抛物弹并延长冷却',()=>{
  for(const gun of [0,1])for(const phase2 of [false,true]){
    const e=engine();e.play(1,false);e.G.camX=2950;e.G.en=[];e.G.eb=[];
    Object.assign(e.G.p,{x:3180,y:40,invT:999});e.G.boss.active=true;e.G.boss.phase2=phase2;
    e.G.boss.parts[1-gun].hp=0;e.G.boss.parts[gun].fireT=0;
    for(let i=0;i<120;i++)e.updateBoss();
    assert.equal(e.G.eb.length,1);assert.equal(e.G.eb[0].vy,0);assert.equal(e.G.eb[0].g,0);assert.ok(e.G.eb[0].vx<0);
    assert.ok(e.G.boss.parts[gun].fireT>1);
  }
});

test('跑兵攻击冻结后计时暂停，迷彩、离屏或敌兵腾空时不发射，其他关卡保留原逻辑',()=>{
  const {e,soldier}=runnerScene();e.G.p.invT=999;e.step();const time=soldier.attack.t;
  e.G.freezeT=2;for(let i=0;i<25;i++)e.step();assert.equal(soldier.attack.t,time);assert.equal(e.G.eb.length,0);
  e.G.freezeT=0;for(let i=0;i<20;i++)e.step();assert.ok(e.G.eb.some(b=>b.from==='runner'));
  const copy=unpackWorld(JSON.parse(JSON.stringify(packWorld(e.G))));assert.equal(copy.en[0].attack.phase,soldier.attack.phase);assert.equal(copy.eb[0].from,'runner');
  for(const change of ['camo','offscreen','airborne','otherStage']){
    const quiet=runnerScene();quiet.e.G.p.invT=999;
    if(change==='camo')quiet.e.G.p.camoT=10;
    if(change==='offscreen'){quiet.soldier.x=400;quiet.soldier.vx=0;quiet.e.G.p.x=220;}
    if(change==='airborne'){quiet.soldier.on=false;quiet.soldier.y=10;quiet.soldier.vy=-100;}
    if(change==='otherStage'){quiet.e.play(5,false);quiet.e.G.en=[quiet.soldier];quiet.e.G.spawnT=999;quiet.e.G.p.invT=999;}
    for(let i=0;i<18;i++)quiet.e.step();
    assert.equal(quiet.e.G.eb.filter(b=>b.from==='runner').length,0,change);
  }
});

test('双人中一号阵亡后跑兵仍会瞄准并射击存活的二号角色',()=>{
  const {e,soldier}=runnerScene(true);beginDeath(e.G.p);e.G.p2.invT=999;
  for(let i=0;i<25;i++)e.step();assert.ok(e.G.eb.some(b=>b.from==='runner'));assert.equal(soldier.fireFace,-1);
  const b=e.G.eb.find(b=>b.from==='runner');assert.ok(b.vx<0);
  const t=(e.G.p2.x-soldier.shotX)/b.vx,y=soldier.shotY+b.vy*t;
  assert.ok(y>e.G.p2.y-28&&y<e.G.p2.y,'bullet aims at surviving partner body');
});

test('前两关全屏与高像素密度不生成 4K 旧背景，其他关卡按对应分辨率恢复背景', () => {
  const e = engine(); e.play(1, false); e.resizeWindow(1920, 1100); e.render();
  assert.deepEqual([...e.resolution().canvas], [1920, 1080]);
  e.resizeWindow(1920, 1100, 2); e.render();
  assert.deepEqual([...e.resolution().canvas], [3840, 2160]);
  assert.equal(e.resolution().backgrounds, 0, 'stage 1 does not allocate unused legacy backdrops');
  e.play(2, false); e.render();
  assert.deepEqual([...e.resolution().canvas], [3840, 2160]);
  assert.equal(e.resolution().backgrounds,0,'stage 2 has independent HD artwork');
  e.play(3,false);e.render();
  assert.deepEqual([...e.resolution().canvas], [1536, 864]);
  assert.equal(e.resolution().backgrounds, 4);
  assert.deepEqual([...e.resolution().sky], [1536, 864]);
  e.play(1, false); e.resizeWindow(768, 448); e.render();
  assert.deepEqual([...e.resolution().canvas], [768, 432]);
  e.play(3, false); e.render();
  assert.equal(e.resolution().backgrounds, 2, 'same canvas size still refreshes stale background density');
  assert.deepEqual([...e.resolution().sky], [768, 432]);
});

test('2P 拾取武器、受伤和过关继承独立于 1P；同屏镜头保留后方玩家', () => {
  const e = engine(); e.play(1);
  e.G.p.x = 40; e.G.p2.x = 120; e.G.p2.invT = 0;
  e.G.items.push({ kind: 'M', x: 120, y: e.G.p2.y - 8 }); e.collide();
  assert.equal(e.G.p.weapon, 'rifle'); assert.equal(e.G.p2.weapon, 'machine');
  e.G.p2.weapon = 'spread'; e.reset(2, true);
  assert.equal(e.G.p2.weapon, 'spread'); assert.equal(e.G.p.weapon, 'rifle');
  e.play(1); e.G.p2.x = 120; e.G.p2.invT = 0;
  e.G.eb.push({ x: 120, y: e.G.p2.y - 16, r: 3 }); e.collide();
  assert.equal(e.G.p.dead, false); assert.equal(e.G.p2.dead, true);
  e.play(1); e.G.p.x = 600; e.G.p2.x = 200;
  e.keepTeamOnScreen(); e.updateCamera();
  assert.ok(e.G.p.x - e.G.p2.x <= 336);
  assert.ok(e.G.p2.x >= e.G.camX + 18);
});

test('单人十六关仍能初始化、运行和绘制，离开联机后没有第二角色', () => {
  for (let stage = 1; stage <= 16; stage++) {
    const e = engine(); e.play(stage, false);
    for (let tick = 0; tick < 6; tick++) e.step();
    e.render(); assert.equal(e.G.p2, undefined, `solo stage ${stage}`);
  }
});

test('有限生命耗尽时，2P 阵亡仍允许存活的 1P 继续', () => {
  const e = engine(); e.play(1); e.G.lives = 0;
  e.G.p2.dead = true; e.G.p2.deadT = 0;
  e.step(); assert.equal(e.G.mode, 'play'); assert.equal(e.G.p.dead, false);
});

test('玩家中弹后击退下落、贴地停留、淡出消失后复活；双人快照保留死亡进度',()=>{
  for(const online of [false,true])for(const id of online?[1,2]:[1]){
    const e=engine();e.play(1,online);
    const corpse=id===2?e.G.p2:e.G.p;
    Object.assign(corpse,{x:120,y:online?70:112,invT:0,onGround:!online});
    e.G.eb.push({x:corpse.x,y:corpse.y-16,r:3});e.collide();
    assert.equal(corpse.dead,true);assert.equal(corpse.onGround,false);
    let rose=false,fell=false,landed=false,faded=false,hidden=false,returned=false;
    for(let tick=0;tick<180;tick++){
      e.step();assert.ok(Number.isFinite(corpse.x)&&Number.isFinite(corpse.y));
      rose ||= corpse.vy<0;fell ||= corpse.vy>0;
      if(corpse.deathGrounded){
        landed=true;assert.equal(corpse.y,112);assert.equal(corpse.vy,0);
        const visual=deathVisual(corpse);faded ||= visual.alpha>0&&visual.alpha<1;
        hidden ||= !visual.visible;
        if(online){const copied=unpackWorld(JSON.parse(JSON.stringify(packWorld(corpse))));assert.equal(copied.deathLandT,corpse.deathLandT);assert.equal(copied.deathHidden,corpse.deathHidden);}
      }
      const current=id===2?e.G.p2:e.G.p;
      if(current!==corpse){assert.equal(corpse.deathHidden,true);assert.equal(current.dead,false);assert.ok(current.invT>0);returned=true;break;}
    }
    assert.ok(rose&&fell&&landed&&faded&&hidden&&returned,`complete sequence online=${online}, player=${id}`);
  }
});

test('双人生命耗尽后遗体消失，存活队友继续游戏且遗体不会重新显示',()=>{
  const e=engine();e.play(1);e.SET.inf='off';e.G.lives=1;e.G.p.invT=99;
  Object.assign(e.G.p2,{x:120,y:112,invT:0});e.G.eb.push({x:120,y:96,r:3});e.collide();
  const corpse=e.G.p2;
  for(let tick=0;tick<160;tick++)e.step();
  assert.equal(e.G.mode,'play');assert.equal(e.G.p.dead,false);assert.equal(e.G.p2,corpse);
  assert.equal(corpse.deathHidden,true);assert.equal(deathVisual(corpse).visible,false);
});

test('第一关新岩台与出生点、炮台和补给箱的支撑面一致', () => {
  const e = engine(); e.play(1);
  assert.equal(e.G.p.y, 112); assert.equal(e.G.p2.y, 112);
  assert.equal(e.G.p.support.y, e.G.p.y);
  assert.equal(e.solids.find(s=>s.g&&s.x===240).y,144);
  assert.ok(!e.solids.some(s=>!s.g&&!s.bridge&&s.x<500),'开局的高岸与低岸不再叠加悬浮草台');
  assert.equal(e.G.en.find(e=>e.t==='snp'&&e.x===410).y,144);
  for (const box of e.G.en.filter(e => e.t === 'box')) {
    const floor = e.solids.find(s => s.g && !s.water && box.x >= s.x && box.x < s.x + s.w);
    assert.equal(box.y, floor.y);
  }
  const turret = e.G.en.find(e => e.t === 'tur' && e.x === 888);
  assert.equal(turret.y + 16, 152);
  const floors = e.solids.filter(s => s.g && !s.water).sort((a,b) => a.x - b.x);
  for (let i = 1; i < floors.length; i++) {
    assert.ok(Math.abs(floors[i].y - floors[i - 1].y) <= 32, '岩台高差在正常跳跃范围内');
  }
});

test('第一关重绘的箱体在关闭时完整阻挡子弹，打开后相同上半部命中会造成伤害',()=>{
  const e=engine();e.play(1,false);const box=e.G.en.find(e=>e.t==='box');e.G.en=[box];
  for(const open of [false,true]){
    box.open=open;const hp=box.hp;
    const shot={k:'b',x:box.x,y:box.y-19,vx:270,vy:0,dmg:1};e.G.pb=[shot];e.collide();
    assert.equal(shot.dead,true);assert.equal(box.hp,hp-(open?1:0));
  }
});

test('第一关核心的美术位置与子弹通道一致，可命中核心；装甲仍阻挡其他高度的子弹', () => {
  const e = engine(); e.play(1); e.G.camX = 2950; e.G.en = []; e.G.spawnT = 99;
  e.G.boss.active = true; e.G.boss.parts[0].fireT = e.G.boss.parts[1].fireT = 99;
  const core = e.G.boss.parts[2], center = core.y + core.h / 2;
  assert.equal(e.xMax(10), FORTRESS_ART.wallX - 10);
  assert.equal(e.inWall(FORTRESS_ART.wallX - 1, 100), false, 'barrel-to-wall space must not be invisible armor');
  assert.equal(e.inWall(FORTRESS_ART.wallX + 1, center), false);
  assert.equal(e.inWall(FORTRESS_ART.wallX + 1, 90), true);
  e.G.pb.push({ k:'b', x:3188, y:center, vx:270, vy:0, dmg:1 });
  for (let tick = 0; tick < 30; tick++) e.step();
  assert.equal(core.hp, 59);
  e.G.pb.push({ k:'b', x:3188, y:90, vx:270, vy:0, dmg:1 });
  for (let tick = 0; tick < 30; tick++) e.step();
  assert.equal(core.hp, 59);
});

test('贴近要塞时实际斜上输入能击中反应堆，单人与二号玩家都可攻击',()=>{
  for(const partner of [false,true]){
    const e=engine();e.play(1,partner);e.G.camX=FORTRESS_ART.levelEnd-384;e.G.en=[];e.G.spawnT=999;e.G.boss.active=true;
    e.G.boss.parts[0].fireT=e.G.boss.parts[1].fireT=999;
    const actor=partner?e.G.p2:e.G.p;
    Object.assign(actor,{x:FORTRESS_ART.wallX-10,y:176,vx:0,vy:0,onGround:true,invT:999,weapon:'rifle',cool:0});
    e.G.p.invT=999;e.SET.autofire='on';
    for(let i=0;i<40;i++){
      if(partner)e.coop.remote.push(encodeInput({right:true,up:true,fire:true}));
      else e.K.KeyD=e.K.KeyW=e.K.KeyJ=true;
      e.step();
    }
    assert.ok(e.G.boss.parts[2].hp<60,partner?'2P diagonal shot reaches core':'solo diagonal shot reaches core');
    assert.equal(e.G.boss.parts[0].hp,20);assert.equal(e.G.boss.parts[1].hp,20);
  }
});

test('反应堆斜向射击通道支持各武器，偏离开口的弹道仍被装甲挡住',()=>{
  for(const weapon of ['rifle','spread','laser','fire','homing']){
    const e=engine();e.play(1,false);e.G.camX=FORTRESS_ART.levelEnd-384;e.G.en=[];e.G.spawnT=999;e.G.boss.active=true;
    e.G.boss.parts[0].hp=e.G.boss.parts[1].hp=0;
    Object.assign(e.G.p,{x:FORTRESS_ART.wallX-10,y:176,onGround:true,vx:0,vy:0,invT:999,weapon,cool:0});
    e.SET.autofire='on';e.K.KeyW=e.K.KeyD=e.K.KeyJ=true;
    for(let i=0;i<45;i++)e.step();assert.ok(e.G.boss.parts[2].hp<60,weapon);
  }
  for(const shot of [{x:FORTRESS_ART.wallX+1,y:90,vx:270,vy:0},{x:3180,y:148,vx:190,vy:-190},{x:FORTRESS_ART.wallX+1,y:165,vx:270,vy:0}]){
    const e=engine();e.play(1,false);e.G.camX=FORTRESS_ART.levelEnd-384;e.G.en=[];e.G.spawnT=999;e.G.boss.active=true;e.G.p.invT=999;
    e.G.boss.parts[0].fireT=e.G.boss.parts[1].fireT=999;
    const b={k:'b',...shot,dmg:1};e.G.pb=[b];
    for(let i=0;i<60;i++)e.step();
    assert.equal(e.G.boss.parts[2].hp,60);assert.ok(b.dead,'misaligned projectile is not granted a core hit');
  }
});

test('第一关上下炮口可实际击中，核心摧毁后打开入口并等待角色进入', () => {
  const e = engine(); e.play(1, false); e.G.camX = FORTRESS_ART.levelEnd - 384;
  e.G.en = []; e.G.spawnT = 99; e.G.boss.active = true;
  e.G.boss.parts[0].fireT = e.G.boss.parts[1].fireT = 99;
  for (const part of e.G.boss.parts) {
    e.G.pb.push({ k: 'b', x: part.x - 6, y: part.y + part.h / 2, vx: 270, vy: 0, dmg: 1 });
    for (let tick = 0; tick < 3; tick++) e.step();
    assert.equal(part.hp, part.max - 1, part.k);
  }
  const core = e.G.boss.parts[2]; core.hp = 1;
  e.G.pb.push({ k: 'b', x: core.x - 6, y: core.y + core.h / 2, vx: 270, vy: 0, dmg: 1 });
  for (let tick = 0; tick < 3; tick++) e.step();
  assert.equal(e.G.boss.dead, true); assert.ok(e.G.boss.deadT > .9);
  assert.ok(Number.isFinite(core.destroyedAt) && core.destroyedAt <= e.G.time);
  assert.ok(e.G.boss.parts.every(part=>part.hp<=0&&part.destroyedAt===core.destroyedAt),'core destruction leaves no active-looking turrets');
  const copy=unpackWorld(JSON.parse(JSON.stringify(packWorld([e.G,e.solids,e.BRIDGES]))));
  assert.equal(copy[0].boss.parts[2].destroyedAt,core.destroyedAt,'damage effects share the simulation clock in both clients');
  for(let tick=0;tick<300;tick++)e.step();
  assert.equal(e.G.stage,1);assert.equal(e.G.mode,'play');assert.equal(e.G.boss.exitOpen,true,'destroying the core alone must not clear the stage');
});

function openFortressExit(e){
  e.G.camX=FORTRESS_ART.levelEnd-384;e.G.en=[];e.G.spawnT=99;e.G.boss.active=true;
  const core=e.G.boss.parts[2];core.hp=1;
  e.G.pb=[{k:'b',x:core.x-1,y:core.y+core.h/2,vx:270,vy:0,dmg:1}];e.collide();
  for(let i=0;i<75;i++)e.step();assert.equal(e.G.boss.exitOpen,true);
}

function atExitApproach(e,p){
  Object.assign(p,{x:FORTRESS_ART.wallX-12,y:176,vx:0,vy:0,onGround:true,spin:false,
    support:e.solids.find(s=>s.g&&p.x>=s.x&&p.x<s.x+s.w),invT:0});
}

test('通道打开后走近不会过关，实际跳跃进入后自动到第二关并保留装备与分数',()=>{
  const e=engine();e.play(1,false);openFortressExit(e);
  e.G.score=12345;e.G.p.weapon='spread';atExitApproach(e,e.G.p);
  e.K.KeyD=true;for(let i=0;i<90;i++)e.step();
  assert.equal(e.G.stage,1);assert.equal(e.G.p.exitEntered,undefined);
  atExitApproach(e,e.G.p);e.K.KeyK=true;e.step();e.K.KeyK=false;
  let entering=false,hidden=false;
  for(let i=0;i<180&&e.G.stage===1;i++){
    e.step();entering ||= !!e.G.p.enteringExit;hidden ||= !!e.G.p.exitEntered;
    if(e.G.p.enteringExit){const copy=unpackWorld(JSON.parse(JSON.stringify(packWorld(e.G))));assert.equal(copy.p.enteringExit.t,e.G.p.enteringExit.t);}
  }
  assert.ok(entering&&hidden);assert.equal(e.G.stage,2);assert.equal(e.G.mode,'intro');
  assert.equal(e.G.score,12345);assert.equal(e.G.p.weapon,'spread');assert.equal(e.G.p.exitEntered,undefined);
});

test('双人通关等待仍存活的队友进入，已经进洞的角色不会被移动输入拉回',()=>{
  const e=engine();e.play(1,true);openFortressExit(e);
  const p=e.G.p;Object.assign(p,{x:FORTRESS_EXIT.x+FORTRESS_EXIT.w/2,y:FORTRESS_EXIT.y+FORTRESS_EXIT.h/2+14,onGround:false,vy:0});
  e.step();assert.ok(p.enteringExit);
  for(let i=0;i<55;i++)e.step();assert.equal(e.G.stage,1);assert.equal(p.exitEntered,true);
  const insideX=p.x;e.K.KeyA=true;for(let i=0;i<30;i++)e.step();e.K.KeyA=false;assert.equal(p.x,insideX);
  assert.ok(insideX>FORTRESS_EXIT.x+FORTRESS_EXIT.w+15,'player finishes behind the right wall, not at the center of the hole');
  const partner=e.G.p2;partner.weapon='laser';atExitApproach(e,partner);
  e.coop.remote.push(encodeInput({right:true,jump:true}));e.step();
  e.coop.remote.push(encodeInput({right:true}));
  for(let i=0;i<180&&e.G.stage===1;i++){e.coop.remote.push(encodeInput({right:true}));e.step();}
  assert.equal(e.G.stage,2);assert.equal(e.G.mode,'intro');assert.equal(e.G.p2.weapon,'laser');
});

test('进入要塞后沿通道持续向右，落到洞内地面后保持高度，尺寸状态不变',()=>{
  const p={x:FORTRESS_EXIT.trigger.x+1,y:FORTRESS_EXIT.y+25,giantT:0,anim:0};
  const startX=p.x;beginExitEntry(p,FORTRESS_EXIT);
  let previousX=p.x;
  for(let i=0;i<39;i++){
    advanceExitEntry(p,FORTRESS_EXIT,1/60);
    assert.ok(p.x>previousX);previousX=p.x;
    if(i>=10)assert.equal(p.y,FORTRESS_EXIT.y+FORTRESS_EXIT.h-2);
    assert.equal(p.giantT,0);assert.equal(p.face,1);
  }
  assert.ok(p.x>FORTRESS_EXIT.x+FORTRESS_EXIT.w+15);assert.ok(p.x>startX+40);
  assert.equal(p.exitEntered,true);assert.equal(p.enteringExit,null);
});

test('真实子弹命中炮口、核心、装甲和士兵时生成不同反馈，伤害规则保持正确',()=>{
  const e=engine();e.play(1,false);e.G.en=[];e.G.spawnT=99;e.G.boss.active=true;
  for(const part of e.G.boss.parts){
    e.G.fx=[];const before=part.hp;
    e.G.pb=[{k:'b',x:(part.hitBox||part).x-1,y:part.y+part.h/2,vx:270,vy:0,dmg:1}];e.collide();
    assert.equal(part.hp,before-1);
    const impact=e.G.fx.find(f=>f.k==='impact');assert.ok(impact);
    assert.equal(impact.material,part.k==='core'?'core':'metal');assert.equal(impact.x,(part.hitBox||part).x);
  }
  const core=e.G.boss.parts[2],health=core.hp;
  e.G.fx=[];e.G.pb=[{k:'b',x:FORTRESS_ART.wallX+1,y:90,vx:270,vy:0,dmg:1}];e.collide();
  assert.equal(core.hp,health);assert.equal(e.G.fx[0].material,'metal');assert.equal(e.G.fx[0].x,FORTRESS_ART.wallX);
  e.G.fx=[];e.G.en=[{t:'run',x:180,y:112,hp:3,on:true}];
  e.G.pb=[{k:'b',x:180,y:96,vx:270,vy:0,dmg:1}];e.collide();
  assert.equal(e.G.en[0].hp,2);assert.equal(e.G.fx[0].material,'body');
});

test('二号客户端收到同为 play 的中枢快照时，也同步切换第二关参考音乐',()=>{
  const e=engine();e.play(2,true);e.coop.role='guest';const tracks=[];
  e.Music.sync=()=>tracks.push(referenceTrackForScene(e.G));
  const state=unpackWorld(JSON.parse(JSON.stringify(packWorld(e.G))));
  state.base.def={boss:'eye'};state.base.room=3;
  e.coop.callbacks.state(packWorld([state,e.solids,e.BRIDGES,{}]));
  assert.deepEqual(tracks,['stage2boss']);
  e.coop.callbacks.state(packWorld([state,e.solids,e.BRIDGES,{}]));assert.equal(tracks.length,1,'normal snapshots do not restart audio');
});

test('第二关防爆盾仍抵挡三次实际子弹，第四次才触发死亡且不影响队友',()=>{
  const e=engine();e.play(2,true);Object.assign(e.G.p,{invT:0,shieldT:0,riot:3});e.G.p2.riot=3;
  for(let i=0;i<4;i++){
    const p=e.G.p;e.G.eb=[{base:true,t:.9,x:p.x,y:p.y-15,r:2,x0:p.x,y0:120,x1:p.x,y1:p.y-15}];
    e.collideBasePlayer();
    assert.equal(p.riot,Math.max(0,2-i));assert.equal(p.dead,i===3);assert.equal(e.G.p2.riot,3);
  }
});

test('第二关放大后的敌兵枪口与命中范围同步，第四关保持原投射规则',()=>{
  for(const stage of [2,4]){
    const e=engine();e.play(stage,false);const B=e.G.base;
    B.spawned=B.def.sol;B.rolled=B.def.rol;B.rol=[];B.targets.forEach(t=>t.fireT=999);e.G.eb=[];
    B.sol=[{u:0,z:.5,st:'aim',t:0,anim:0}];e.G.p.invT=999;
    e.step();const shot=e.G.eb.find(b=>b.x0===192);assert.ok(shot);
    const height=stage===2?BASE_SOLDIER.muzzleHeight*baseSoldierScale(.5):18*.75;
    assert.ok(Math.abs(shot.y0-(204-64*.5-height))<.0001,'shot begins at the visible barrel');
    const soldier=B.sol[0];soldier.st='aim';soldier.t=999;
    e.G.pb=[{k:'b',owner:1,t:.49,spd:.6,x0:201.5,y0:166,xe:201.5,ye:129,dmg:1}];
    e.step();assert.equal(!!soldier.dead,stage===2,'wider visible body can be hit without changing the legacy fourth stage');
  }
});

test('第二关真实投射射击保留核心防护、炮台拆除、开门推进和 Boss 摧毁流程',()=>{
  for(const online of [false,true]){
    const e=engine();e.play(2,online);const B=e.G.base;
    e.G.p.invT=999;if(e.G.p2)e.G.p2.invT=999;
    B.spawned=B.def.sol;B.rolled=B.def.rol;B.sol=[];B.rol=[];
    const fire=(target,dmg,ye=129)=>{
      e.G.fx=[];e.G.pb=[{k:'b',owner:1,t:.99,spd:1.8,x0:192,y0:166,xe:target.x+target.w/2,ye,x:192,y:166,dmg}];e.step();
    };
    const core=B.targets.find(t=>t.k==='core');fire(core,12);assert.equal(core.hp,12);assert.ok(e.G.fx.some(f=>f.material==='shield'));
    for(const gun of B.targets.filter(t=>t.k==='gun')){fire(gun,4);assert.ok(gun.hp<=0);}
    fire(core,12);assert.equal(core.hp,12);assert.equal(B.cleared,false);
    const upper=B.targets.find(t=>t.k==='switch');fire(upper,4,upper.y+upper.h/2);assert.ok(upper.hp<=0);
    fire(core,12);assert.ok(B.cleared);assert.equal(B.trans,0);
    const before=JSON.stringify(packWorld([e.G]));e.render();assert.equal(JSON.stringify(packWorld([e.G])),before,'art does not change simulation');
    e.K.KeyW=true;e.step();e.K.KeyW=false;assert.ok(B.trans>0);
    for(let i=0;i<85;i++)e.step();assert.equal(B.room,1);assert.equal(B.cleared,false);
    e.loadRoom(3);
    for(const target of B.targets)fire(target,8,target.y+target.h/2);
    assert.equal(B.bossPhase,'reveal');assert.equal(B.targets.some(t=>t.k==='bcore'),false);
    ticks(e,75);const boss=B.targets.find(t=>t.k==='bcore');assert.ok(boss);boss.fireT=999;
    fire(boss,50,boss.y+boss.h/2);assert.ok(B.dead);
    ticks(e,190);assert.equal(e.G.mode,'play');assert.equal(B.exitReady,true);
    e.K.KeyA=true;
    for(let i=0;i<280&&e.G.stage===2;i++){
      if(online)e.coop.remote.push(encodeInput({right:true}));
      e.step();
    }
    assert.equal(e.G.stage,2);assert.equal(e.G.mode,'clear');
  }
});

test('第二关跟踪导弹先清除两侧设施，跳跃后打掉高位机关，再锁定核心，单人与二号玩家均有效',()=>{
  for(const online of [false,true])for(const room of [0,1,2]){
    const e=engine();e.play(2,online);e.loadRoom(room);e.SET.autofire='on';
    const B=e.G.base,shooter=online?e.G.p2:e.G.p;
    for(const p of [e.G.p,...(e.G.p2?[e.G.p2]:[])])p.invT=999;
    Object.assign(shooter,{x:192,weapon:'homing',cool:0});
    B.spawned=B.def.sol;B.rolled=999;B.sol=[];B.rol=[];B.coreT=999;
    B.targets.forEach(t=>t.fireT=999);
    const sides=B.targets.filter(t=>t.k==='gun'||t.k==='sat'),core=B.targets.find(t=>t.k==='core'||t.k==='bcore'),upper=B.targets.find(t=>t.k==='switch');
    let coreHit=false;
    if(!online)e.K.KeyJ=true;
    for(let tick=0;tick<1400&&!B.cleared&&!B.dead;tick++){
      const jump=!!upper&&upper.hp>0&&sides.every(t=>t.hp<=0)&&tick%55===0;
      if(online)e.coop.remote.push(encodeInput({fire:true,jump}));else e.K.KeyK=jump;
      const hp=core.hp;e.step();
      if(core.hp<hp){
        coreHit=true;assert.ok(sides.every(t=>t.hp<=0),`room ${room}, player ${shooter.pid}: core hit before side targets cleared`);
        assert.ok(!upper||upper.hp<=0,'upper lock must also be destroyed before the core');
      }
    }
    assert.ok(sides.every(t=>t.hp<=0),`room ${room}: all side targets destroyed`);
    assert.ok(coreHit&&core.hp<=0,`room ${room}: automatic lock switches to the center`);
    assert.ok(room===3?B.dead:B.cleared);
  }
});

function quietBaseRoom(room=0,online=false){
  const e=engine();e.play(2,online);e.loadRoom(room);e.SET.autofire='on';
  const B=e.G.base;B.spawned=B.def.sol;B.rolled=999;B.sol=[];B.rol=[];B.coreT=999;
  B.targets.forEach(t=>t.fireT=999);e.G.eb=[];
  for(const p of [e.G.p,...(online?[e.G.p2]:[])])Object.assign(p,{x:192,y:204,invT:999,onGround:true});
  e.step();return e;
}

function shootBaseTarget(e,target,damage=99){
  e.G.pb=[{k:'b',owner:1,t:.99,spd:1.8,x0:e.G.p.x,y0:166,xe:target.x+target.w/2,ye:target.y+target.h/2,dmg:damage}];e.step();
}
function activateMovingBoss(e){
  for(const target of e.G.base.targets.filter(t=>t.k==='device'))shootBaseTarget(e,target);
  ticks(e,75);return e.G.base.targets.find(t=>t.mover);
}

test('第二关开枪前进会清除两人的弹丸、手雷和枪口光；自动与手动过门后均可继续射击',()=>{
  for(const online of [false,true])for(const automatic of [false,true])for(const weapon of ['rifle','machine','spread','laser','fire','homing']){
    const e=quietBaseRoom(0,online),B=e.G.base,actors=[e.G.p,...(online?[e.G.p2]:[])];
    for(const target of B.targets.filter(t=>t.k!=='core'))shootBaseTarget(e,target);
    shootBaseTarget(e,B.targets.find(t=>t.k==='core'));assert.equal(B.cleared,true);
    for(const p of actors)Object.assign(p,{weapon,cool:0});
    e.K.KeyJ=true;if(online)e.coop.remote.push(encodeInput({fire:true}));e.step();
    assert.equal(new Set(e.G.pb.map(b=>b.owner)).size,actors.length,'both players have visible in-flight shots');
    e.K.KeyI=true;if(online)e.coop.remote.push(encodeInput({fire:true,nade:true}));e.step();assert.ok(e.G.gr.length>0);
    e.K.KeyI=false;if(automatic)B.clearT=0;else e.K.KeyW=true;
    if(online)e.coop.remote.push(encodeInput({fire:true}));e.step();
    assert.ok(B.trans>0);assert.equal(e.G.pb.length+e.G.eb.length+e.G.gr.length,0);
    for(const p of actors){assert.equal(p.flashT,0);assert.equal(p.wantFire,false);}
    for(let tick=0;tick<12;tick++){
      e.K.KeyI=tick%2===0;
      if(online)e.coop.remote.push(encodeInput({fire:true,nade:tick%2===0}));e.step();
      assert.equal(e.G.pb.length+e.G.eb.length+e.G.gr.length,0,'holding fire or throwing cannot leave a frozen projectile');
    }
    const snapshot=unpackWorld(JSON.parse(JSON.stringify(packWorld(e.G))));
    assert.equal(snapshot.pb.length+snapshot.eb.length+snapshot.gr.length,0);assert.ok(snapshot.base.trans>0);e.render();
    e.K.KeyW=e.K.KeyI=false;
    for(let tick=0;tick<90&&B.room===0;tick++){if(online)e.coop.remote.push(encodeInput({fire:true}));e.step();}
    assert.equal(B.room,1);const shooters=new Set();
    for(let tick=0;tick<40;tick++){if(online)e.coop.remote.push(encodeInput({fire:true}));e.step();for(const b of e.G.pb)shooters.add(b.owner);}
    assert.equal(shooters.size,actors.length,`${weapon}: holding fire resumes for every player in the new room`);
  }
});

test('第二关关底依次摧毁两排六个独立装置，再延迟启动顶部核心；冻结暂停启动和运动',()=>{
  const e=quietBaseRoom(3),B=e.G.base;
  assert.equal(B.targets.length,6);assert.equal(bossDevicesRemaining(B),6);
  assert.deepEqual([...new Set(B.targets.map(t=>t.y))],[91,119]);
  assert.deepEqual([...new Set(B.targets.map(t=>t.x))],[116,177,238]);
  for(const target of B.targets.slice(0,5))shootBaseTarget(e,target);
  ticks(e,90);assert.equal(B.bossPhase,'devices');assert.ok(!B.targets.some(t=>t.mover));
  shootBaseTarget(e,B.targets[5]);assert.equal(B.bossPhase,'reveal');assert.equal(bossDevicesRemaining(B),0);
  const timer=B.revealT;e.G.freezeT=10;ticks(e,100);assert.equal(B.revealT,timer);
  e.G.freezeT=0;ticks(e,75);const boss=B.targets.find(t=>t.mover);assert.ok(boss);assert.equal(B.bossPhase,'mover');
  const start=boss.x;ticks(e,30);assert.notEqual(boss.x,start);assert.ok(boss.x>=111&&boss.x<=243);
  e.G.freezeT=10;const frozen=boss.x,shots=B.bubbleShots;ticks(e,100);assert.equal(boss.x,frozen);assert.equal(B.bubbleShots,shots);
});

test('真实跳跃和跟踪弹能依次清掉六装置及移动核心，普通平射不能直接锁定顶部核心',()=>{
  for(const online of [false,true]){
    const e=quietBaseRoom(3,online),B=e.G.base,p=online?e.G.p2:e.G.p;
    p.weapon='homing';let locks=0;
    for(let tick=0;tick<3600&&!B.dead;tick++){
      const bottom=B.targets.find(t=>t.k==='device'&&t.y===119&&t.hp>0),upper=B.targets.find(t=>t.k==='device'&&t.y===91&&t.hp>0);
      const target=bottom||upper;
      if(target)p.x=2*(target.x+target.w/2)-192;
      const jump=!bottom&&(!!upper||B.bossPhase==='mover')&&tick%55===0;
      if(online)e.coop.remote.push(encodeInput({fire:true,jump}));else{e.K.KeyJ=true;e.K.KeyK=jump;}
      e.step();locks+=e.G.pb.filter(b=>b.lock==='bcore').length;
    }
    assert.equal(B.dead,true,`player ${p.pid}: ${JSON.stringify({phase:B.bossPhase,targets:B.targets.map(t=>({k:t.k,hp:t.hp,x:t.x,y:t.y})),p:{x:p.x,y:p.y,cool:p.cool,dead:p.dead},locks})}`);assert.ok(locks>0);
    assert.equal(bossDevicesRemaining(B),0);assert.ok(B.bubbleShots>0);
  }
  const e=quietBaseRoom(3),boss=activateMovingBoss(e);boss.fireT=999;
  e.G.p.weapon='homing';e.K.KeyJ=true;ticks(e,140);
  assert.equal(boss.hp,boss.max);assert.ok(e.G.pb.every(b=>b.lock!=='bcore'));
});

test('顶部核心出现后两人均可站立举枪，六种武器向上命中；松开上键恢复普通弹道',()=>{
  for(const mode of ['solo','host','guest'])for(const weapon of ['rifle','machine','spread','laser','fire','homing']){
    const online=mode!=='solo',remote=mode==='guest',e=quietBaseRoom(3,online),boss=activateMovingBoss(e),p=remote?e.G.p2:e.G.p;
    e.G.freezeT=999;boss.fireT=999;boss.hp=999;
    Object.assign(p,{x:2*(boss.x+boss.w/2)-192,y:204,onGround:true,vy:0,weapon,cool:0});e.G.pb=[];
    const input=up=>{if(remote)e.coop.remote.push(encodeInput({up,fire:true}));else{e.K.KeyW=up;e.K.KeyJ=true;}e.step();};
    input(true);assert.equal(p.aimUp,true);assert.equal(p.y,204);assert.equal(p.spin,false);
    const shots=e.G.pb.filter(b=>b.owner===p.pid);assert.ok(shots.length);
    const origin=baseUpMuzzle(p,mode==='host'?'red':'blue');
    for(const b of shots){assert.equal(b.upward,true);assert.equal(b.ye,boss.y+boss.h/2);assert.equal(b.x0,origin.x);assert.equal(b.y0,origin.y);}
    const snapshot=unpackWorld(JSON.parse(JSON.stringify(packWorld(e.G))));
    assert.equal((remote?snapshot.p2:snapshot.p).aimUp,true);assert.ok(snapshot.pb.some(b=>b.upward));
    for(let i=0;i<120;i++)input(true);
    assert.ok(boss.hp<999,`${weapon}, player ${p.pid}: upward ground fire must damage the top core`);
    p.cool=0;e.G.pb=[];input(false);assert.equal(p.aimUp,false);
    assert.ok(e.G.pb.filter(b=>b.owner===p.pid).every(b=>!b.upward&&b.ye===129));
    assert.doesNotThrow(()=>e.render());
  }
});

test('向上举枪仅在第二关顶部核心阶段启用，移动和跳跃时枪口仍与举枪姿势对齐',()=>{
  for(const room of [0,1,2,3]){
    const e=quietBaseRoom(room);e.G.p.cool=0;e.K.KeyW=e.K.KeyJ=true;e.step();
    assert.equal(e.G.p.aimUp,false);assert.ok(e.G.pb.every(b=>!b.upward&&b.ye===129));
  }
  for(const online of [false,true])for(const giant of [false,true]){
    const e=quietBaseRoom(3,online);activateMovingBoss(e);e.G.freezeT=999;
    const p=online?e.G.p2:e.G.p;if(giant)startGiant(p);p.cool=0;e.G.pb=[];
    if(online)e.coop.remote.push(encodeInput({up:true,right:true,fire:true}));else e.K.KeyW=e.K.KeyD=e.K.KeyJ=true;
    e.step();assert.equal(p.aimUp,true);assert.ok(p.vx>0);assert.equal(p.aimDx,0);
    const origin=baseUpMuzzle(p),shot=e.G.pb.find(b=>b.owner===p.pid);
    assert.equal(shot.x0,origin.x);assert.equal(shot.y0,origin.y);
    p.cool=0;e.G.pb=[];
    if(online)e.coop.remote.push(encodeInput({up:true,jump:true,fire:true}));else{e.K.KeyD=false;e.K.KeyK=true;}
    e.step();assert.ok(p.y<204);assert.equal(p.aimUp,true);assert.equal(p.spin,false);
    assert.ok(e.G.pb.some(b=>b.owner===p.pid&&b.upward&&b.ye===71));
  }
});

test('移动核心每次发出一个蓝色气泡，气泡逐渐变大，冻结暂停，卧倒、跳跃和护盾均有效',()=>{
  const e=quietBaseRoom(3),B=e.G.base,boss=activateMovingBoss(e);boss.fireT=0;e.step();
  assert.equal(B.bubbleShots,1);assert.equal(e.G.eb.filter(b=>b.bubble).length,1);
  const bubble=e.G.eb.find(b=>b.bubble),radius=bubble.r;ticks(e,25);assert.ok(bubble.r>radius);assert.equal(B.bubbleShots,1);
  e.G.freezeT=10;const frozen=[bubble.x,bubble.y,bubble.r,bubble.t];ticks(e,60);
  assert.deepEqual([bubble.x,bubble.y,bubble.r,bubble.t],frozen);
  for(const defense of ['standing','prone','jump','shield','giant']){
    const scene=quietBaseRoom(3),p=scene.G.p;
    Object.assign(p,{invT:0,prone:defense==='prone',y:defense==='jump'?154:204,shieldT:defense==='shield'?10:0});
    if(defense==='giant')startGiant(p);
    scene.G.eb=[{base:true,bubble:true,t:.99,x:p.x,y:186,r:6.5,x0:192,y0:71,x1:192,y1:186}];scene.collideBasePlayer();
    assert.equal(p.dead,defense==='standing',defense);
    if(defense==='shield')assert.equal(scene.G.eb[0].dead,true);
  }
  e.G.freezeT=0;boss.fireT=999;ticks(e,160);assert.equal(e.G.eb.filter(b=>b.bubble).length,0);
});

test('中枢摧毁后等待角色进入任意一侧升降梯，全尺寸升到顶部后完成前两关',()=>{
  for(const side of [-1,1]){
    const e=quietBaseRoom(3),B=e.G.base,boss=activateMovingBoss(e);
    shootBaseTarget(e,boss);e.G.p.weapon='laser';e.G.inv=['u','d'];e.G.p.shieldT=20;
    const score=e.G.score,lives=e.G.lives,scale=e.G.p.giantT;
    ticks(e,250);assert.equal(e.G.stage,2);assert.equal(e.G.mode,'play');assert.equal(B.exitReady,true);
    e.K[side<0?'KeyA':'KeyD']=true;
    for(let i=0;i<140&&!e.G.p.liftSide;i++)e.step();assert.equal(e.G.p.liftSide,side);
    const y=e.G.p.y;ticks(e,50);assert.ok(e.G.p.y<y);assert.equal(e.G.p.giantT,scale);
    assert.doesNotThrow(()=>e.render(),'active shields and elevator riders render together');
    for(let i=0;i<200&&e.G.stage===2;i++)e.step();
    assert.equal(e.G.stage,2);assert.equal(e.G.mode,'clear');assert.equal(e.G.p.weapon,'laser');
    assert.equal(e.G.score,score);assert.equal(e.G.lives,lives);assert.deepEqual(Array.from(e.G.inv),['u','d']);assert.equal(e.G.p.liftDone,true);
  }
});

test('中枢摧毁后清除空中弹丸，等待和乘梯时按住两人的射击或手雷都不残留静止子弹',()=>{
  const e=quietBaseRoom(3,true),boss=activateMovingBoss(e);
  e.G.gr=[{base:true,t:0,x0:190,y0:174,xe:192,ye:71,a:0}];
  for(const p of [e.G.p,e.G.p2])Object.assign(p,{cool:0,flashT:.05,wantFire:true});
  shootBaseTarget(e,boss);assert.equal(e.G.base.dead,true);
  assert.equal(e.G.pb.length+e.G.eb.length+e.G.gr.length,0);
  e.K.KeyJ=e.K.KeyA=true;
  for(let tick=0;tick<300;tick++){
    e.K.KeyI=tick%2===0;e.coop.remote.push(encodeInput({fire:true,nade:tick%2===0}));e.step();
    assert.equal(e.G.stage,2);assert.equal(e.G.pb.length+e.G.eb.length+e.G.gr.length,0);
    for(const p of [e.G.p,e.G.p2])assert.equal(p.flashT,0);
  }
  assert.equal(e.G.p.liftSide,-1);assert.equal(e.G.p.liftDone,true);assert.ok(!e.G.p2.liftSide);
});

test('双人升降梯等待存活队友，已乘梯角色不会被输入拉回，快照保留核心气泡与升降状态',()=>{
  const e=quietBaseRoom(3,true),B=e.G.base,boss=activateMovingBoss(e);boss.fireT=0;e.step();
  let snapshot=unpackWorld(JSON.parse(JSON.stringify(packWorld(e.G))));
  assert.equal(snapshot.base.bossPhase,'mover');assert.equal(snapshot.base.bossTime,B.bossTime);assert.equal(snapshot.eb[0].bubble,true);
  shootBaseTarget(e,boss);ticks(e,100);e.K.KeyA=true;
  for(let i=0;i<300;i++)e.step();assert.equal(e.G.stage,2);assert.equal(e.G.p.liftDone,true);assert.ok(!e.G.p2.liftDone);
  const before=[e.G.p.x,e.G.p.y];e.K.KeyA=false;e.K.KeyD=true;ticks(e,40);assert.deepEqual([e.G.p.x,e.G.p.y],before);
  snapshot=unpackWorld(JSON.parse(JSON.stringify(packWorld(e.G))));assert.equal(snapshot.p.liftDone,true);assert.equal(snapshot.p.liftSide,-1);
  const world=JSON.stringify(packWorld(e.G));e.render();assert.equal(JSON.stringify(packWorld(e.G)),world);
  for(let i=0;i<300&&e.G.stage===2;i++){e.coop.remote.push(encodeInput({right:true}));e.step();}
  assert.equal(e.G.stage,2);assert.equal(e.G.mode,'clear');assert.ok(e.G.p2);assert.equal(e.G.p2.liftDone,true);
});

test('第二关各房间在普通波次间生成红色补给兵，每个携带一种装备，第四关保持普通士兵',()=>{
  for(const stage of [2,4])for(const room of [0,1,2]){
    const e=quietBaseRoom(room);
    if(stage===4){e.play(4,false);e.loadRoom(room);e.G.p.invT=999;}
    const B=e.G.base,carriers=[];B.spawned=0;B.targets.forEach(t=>t.fireT=999);B.rolled=999;
    for(let wave=1;wave<=B.def.sol;wave++){
      B.sol=[];B.spawnT=0;e.step();const soldier=B.sol[0];assert.ok(soldier);
      if(soldier.dropKind){carriers.push({wave,kind:soldier.dropKind});assert.equal(soldier.st,'walk');}
    }
    assert.deepEqual(carriers,stage===2?[...B.def.supply].map((kind,i)=>({wave:2+i*3,kind})):[]);
    assert.equal(e.G.items.length,0,'enemies must be defeated to release supplies');
  }
});

test('红色补给兵被真实子弹击败就掉落一次，绿色士兵和自行撤退的红兵都不掉落',()=>{
  for(const red of [false,true]){
    const e=quietBaseRoom(),B=e.G.base,s={u:72,z:.5,st:'aim',t:999,anim:0,dropKind:red?'L':null};B.sol=[s];
    const copy=unpackWorld(JSON.parse(JSON.stringify(packWorld(e.G))));assert.equal(copy.base.sol[0].dropKind,s.dropKind);
    e.G.p.x=264;e.K.KeyJ=true;
    for(let i=0;i<60&&!s.dead;i++)e.step();
    assert.ok(s.dead);assert.equal(e.G.items.length,red?1:0);assert.equal(B.cleared,false);
    const score=e.G.score;e.killSoldier(s);assert.equal(e.G.score,score);assert.equal(e.G.items.length,red?1:0);
    if(red){const it=e.G.items[0];assert.equal(it.kind,'L');assert.equal(it.x,246);assert.ok(it.y<172);assert.equal(it.fromSoldier,true);assert.ok(!it.rest);}
  }
  const e=quietBaseRoom();e.G.base.sol=[{u:250,z:.5,st:'leave',dir:1,anim:0,dropKind:'S'}];e.step();assert.equal(e.G.items.length,0);assert.equal(e.G.score,0);
});

test('红兵掉落在战斗中落地并由二号玩家拾取，联机快照保留道具状态与来源',()=>{
  const e=quietBaseRoom(0,true),B=e.G.base,s={u:72,z:.5,st:'aim',t:999,anim:0,dropKind:'L'};B.sol=[s];
  e.G.p.x=60;e.G.p2.x=264;
  for(let i=0;i<60&&!s.dead;i++){e.coop.remote.push(encodeInput({fire:true}));e.step();}
  assert.ok(s.dead);const item=e.G.items[0];assert.ok(item&&!item.rest);assert.equal(e.G.p2.weapon,'rifle');
  for(let i=0;i<90&&!item.rest;i++)e.step();
  assert.equal(item.rest,true);assert.equal(item.y,204);assert.equal(item.x,246);assert.equal(B.cleared,false);
  const copy=unpackWorld(JSON.parse(JSON.stringify(packWorld(e.G))));assert.equal(copy.items[0].fromSoldier,true);assert.equal(copy.items[0].rest,true);
  e.G.p2.x=item.x;e.withPlayer2(e.collideBasePlayer);
  assert.equal(item.dead,true);assert.equal(e.G.p2.weapon,'laser');assert.equal(e.G.p.weapon,'rifle');
});

test('手雷和巨大化踩踏击败红色补给兵也能掉落装备',()=>{
  const grenade=quietBaseRoom();grenade.G.base.sol=[{u:30,z:.65,st:'aim',t:999,anim:0,dropKind:'S'}];
  grenade.K.KeyI=true;grenade.step();grenade.K.KeyI=false;ticks(grenade,46);
  assert.equal(grenade.G.items.length,1);assert.equal(grenade.G.items[0].kind,'S');assert.equal(grenade.G.base.cleared,false);
  const giant=quietBaseRoom();giant.G.inv=['u'];giant.G.sel=0;giant.useSpecial();
  giant.G.base.sol=[{u:8,z:0,st:'charge',anim:0,dropKind:'d'}];giant.collideBasePlayer();
  assert.equal(giant.G.items.length,1);assert.equal(giant.G.items[0].kind,'d');assert.equal(giant.G.p.dead,false);
});

test('第二关开门与自动清场不再生成装备，已击落的物品保留原地，第四关原有奖励不变',()=>{
  for(const stage of [2,4]){
    const e=quietBaseRoom();if(stage===4){e.play(4,false);e.G.p.invT=999;}
    const B=e.G.base;B.spawned=B.def.sol;B.rolled=999;B.targets.forEach(t=>{if(t.k!=='core')t.hp=0;});
    B.sol=[{u:100,z:.1,st:'charge',anim:0,dropKind:'L'}];
    const item={base:true,x:280,y:204,vy:0,rest:true,kind:'S',fromSoldier:true};e.G.items=[item];
    e.G.pb=[{k:'b',t:.99,spd:1.8,x0:192,y0:166,xe:192,ye:129,dmg:12}];e.step();
    assert.equal(B.cleared,true);assert.equal(e.G.items.length,stage===2?1:3);
    assert.equal(e.G.items[0],item);assert.equal(item.x,280);assert.equal(item.y,204);
    if(stage===2){e.G.p.x=280;e.collideBasePlayer();assert.equal(e.G.p.weapon,'spread');}
  }
});

test('第二关三个普通房间都有高位机关，站立时所有武器和地面手雷都不能打坏它或绕过开门条件',()=>{
  for(const room of [0,1,2]){
    const e=quietBaseRoom(room),upper=e.G.base.targets.find(t=>t.k==='switch');
    assert.ok(upper);assert.ok(upper.y+upper.h<116);assert.ok(baseCoreShielded(e.G.base));
    const copy=unpackWorld(JSON.parse(JSON.stringify(packWorld(e.G))));assert.equal(copy.base.targets.find(t=>t.k==='switch').hp,4);
  }
  for(const weapon of ['rifle','machine','spread','laser','fire','homing','grenade']){
    const e=quietBaseRoom(),B=e.G.base,upper=B.targets.find(t=>t.k==='switch'),core=B.targets.find(t=>t.k==='core');
    e.G.p.weapon=weapon==='grenade'?'rifle':weapon;e.G.empT=99;
    if(weapon==='grenade')e.K.KeyI=true;else e.K.KeyJ=true;
    ticks(e,240);
    assert.equal(upper.hp,4,weapon);assert.equal(core.hp,12,weapon);assert.equal(B.cleared,false,weapon);
    assert.ok(baseCoreShielded(B,e.G.empT),'EMP cannot bypass the upper physical lock');
  }
  const fourth=engine();fourth.play(4,false);assert.ok(fourth.G.base.targets.every(t=>t.k!=='switch'));
});

test('实际跳跃射击能用六种武器命中高位机关，单人和二号玩家均能独立完成',()=>{
  for(const online of [false,true])for(const weapon of ['rifle','machine','spread','laser','fire','homing']){
    const e=quietBaseRoom(0,online),p=online?e.G.p2:e.G.p,upper=e.G.base.targets.find(t=>t.k==='switch');p.weapon=weapon;
    const heights=[];
    for(let tick=0;tick<500&&upper.hp>0;tick++){
      const jump=tick%55===0;
      if(online)e.coop.remote.push(encodeInput({fire:true,jump}));else{e.K.KeyJ=true;e.K.KeyK=jump;}
      e.step();for(const b of e.G.pb)if(b.owner===p.pid)heights.push(b.ye);
    }
    assert.ok(upper.hp<=0,`${weapon}, ${p.pid}P must destroy the elevated mechanism`);
    assert.ok(heights.some(y=>y<=100),`${weapon}: jumping raises the actual rear-wall trajectory`);
    assert.equal(p.dead,false);assert.ok(e.G.fx.some(f=>f.k==='boom'));
  }
});

test('第二关上方弹道会越过站在下方的敌兵，第四关仍保留原来的射击高度',()=>{
  for(const elevated of [false,true]){
    const e=quietBaseRoom(),soldier={u:0,z:.5,st:'aim',t:99,anim:0};e.G.base.sol=[soldier];
    e.G.pb=[{k:'b',owner:1,t:.49,spd:.6,x0:192,y0:elevated?125:166,xe:192,ye:elevated?89:129,dmg:1}];
    e.step();assert.equal(!!soldier.dead,!elevated);assert.equal(!!e.G.pb[0],elevated);
  }
  assert.equal(baseShotHeight({y:150},4),129);assert.ok(baseShotHeight({y:150},2)<90);
});

test('高位机关可被腾空投出的手雷破坏，命中后炮台停止射击并保持损坏状态',()=>{
  const e=quietBaseRoom(),B=e.G.base,upper=B.targets.find(t=>t.k==='switch');
  Object.assign(e.G.p,{y:150,vy:0,onGround:false});e.K.KeyI=true;e.step();e.K.KeyI=false;
  assert.ok(e.G.gr[0].ye<100);ticks(e,48);assert.ok(upper.hp<=0);
  assert.equal(B.cleared,false);e.G.eb=[];upper.fireT=0;ticks(e,20);assert.equal(e.G.eb.length,0);
  const state=JSON.stringify(packWorld(e.G));e.render();assert.equal(JSON.stringify(packWorld(e.G)),state);
});

function mineScene(online=false){
  const e=engine();e.play(2,online);const B=e.G.base;
  B.spawned=B.def.sol;B.rolled=99;B.sol=[];B.targets.forEach(t=>t.fireT=999);
  e.G.eb=[];e.G.fx=[];
  for(const p of [e.G.p,...(online?[e.G.p2]:[])])Object.assign(p,{x:192,y:204,vy:0,onGround:true,invT:0});
  return e;
}

test('敌方手雷到前沿必定爆炸一次，出现火焰烟尘，联机快照保留爆炸',()=>{
  const e=mineScene(),r={u0:0,ut:110,z:.001,a:0,spd:.42};e.G.base.rol=[r];
  e.step();assert.ok(r.dead);assert.ok(e.G.fx.some(f=>f.k==='boom'));assert.equal(e.G.fx.filter(f=>f.k==='smoke').length,3);
  assert.equal(e.G.fx.filter(f=>f.k==='baseMineBlast').length,1);assert.equal(e.G.p.dead,false);
  const blast=e.G.fx.find(f=>f.k==='baseMineBlast');assert.equal(blast.x,302);assert.equal(blast.z,0);
  const copy=unpackWorld(JSON.parse(JSON.stringify(packWorld(e.G))));assert.equal(copy.fx.find(f=>f.k==='baseMineBlast').x,blast.x);
  for(let i=0;i<8;i++)e.step();assert.equal(e.G.fx.filter(f=>f.k==='baseMineBlast').length,1);
});

test('手雷接触即爆，双人各自结算防护，不能被一人的护盾吞掉整次爆炸',()=>{
  const e=mineScene(true);e.G.p.shieldT=2;
  const r={u0:0,ut:0,z:.025,a:0,spd:.42};e.G.base.rol=[r];
  e.step();assert.ok(r.dead);assert.equal(e.G.p.dead,false);assert.equal(e.G.p2.dead,true);
  assert.equal(e.G.fx.filter(f=>f.k==='baseMineBlast').length,1);
  assert.deepEqual([...e.G.fx.find(f=>f.k==='baseMineBlast').hitPlayers],[1,2]);
});

test('跳跃能躲过地面手雷，冻结暂停手雷运动与引爆，卧倒射击对齐新姿势',()=>{
  const e=mineScene();Object.assign(e.G.p,{y:160,vy:-20,onGround:false});
  e.G.base.rol=[{u0:0,ut:0,z:.001,a:0,spd:.42}];e.step();assert.equal(e.G.p.dead,false);assert.ok(e.G.fx.some(f=>f.k==='baseMineBlast'));
  const f=mineScene();f.G.freezeT=1;const r={u0:0,ut:0,z:.001,a:0,spd:.42};f.G.base.rol=[r];
  for(let i=0;i<10;i++)f.step();assert.equal(r.z,.001);assert.ok(!r.dead);assert.ok(!f.G.fx.some(v=>v.k==='baseMineBlast'));
  f.G.freezeT=0;f.G.p.invT=2;f.step();assert.ok(r.dead);assert.equal(f.G.p.dead,false);
  const p=mineScene();p.K.KeyS=p.K.KeyJ=true;p.step();assert.ok(p.G.p.prone);assert.equal(p.G.pb[0].y0,178);
});

function giantScene(stage=1,online=false){
  const e=stage===2?mineScene(online):engine();
  if(stage!==2)e.play(stage,online);
  e.SET.inf='off';
  e.G.en=[];e.G.eb=[];e.G.pods=[];e.G.items=[];e.G.podTrig=[];e.G.spawnT=999;
  if(e.G.base){e.G.base.sol=[];e.G.base.rol=[];e.G.base.coreT=999;e.G.base.targets.forEach(t=>t.fireT=999);}
  for(const p of [e.G.p,...(online?[e.G.p2]:[])])Object.assign(p,{x:stage===1?40:192,y:stage===1?112:204,vy:0,onGround:true,invT:0});
  e.G.inv=['u'];e.G.sel=0;e.useSpecial();
  return e;
}
function ticks(e,n){for(let i=0;i<n;i++)e.step();}
function playerShot(e,p=e.G.p){
  const b={x:p.x,y:p.y-18,r:1,vx:-90,vy:0};e.G.eb=[b];e.collide();return b;
}

test('拾取蘑菇后按道具键巨大化，前两秒连续中弹不耗护甲，跳跃保持脚朝下',()=>{
  const e=engine();e.play(1,false);e.G.en=[];e.G.eb=[];e.G.pods=[];e.G.podTrig=[];e.G.spawnT=999;e.G.inv=[];e.G.p.invT=0;
  const item={kind:'u',x:e.G.p.x,y:e.G.p.y,rest:true};e.G.items=[item];e.collide();
  assert.ok(item.dead);assert.deepEqual([...e.G.inv],['u']);assert.equal(e.G.p.giantT,0);
  e.step();e.K.KeyL=true;e.step();e.K.KeyL=false;
  const p=e.G.p;assert.equal(e.G.inv.length,0);assert.equal(p.giantT,15);assert.equal(p.giantHits,3);assert.equal(p.giantGraceT,2);
  for(let i=0;i<20;i++){assert.ok(playerShot(e).dead);assert.equal(p.giantHits,3);}
  ticks(e,90);assert.ok(playerShot(e).dead);assert.equal(p.giantHits,3);assert.ok(p.giantT>13);
  e.K.KeyK=true;e.step();e.K.KeyK=false;assert.ok(p.vy<0);assert.equal(p.spin,false);
  assert.equal(p.dead,false);assert.equal(e.G.deaths,0);assert.match(giantPowerLabel(p),/免疫/);
});

test('巨大化承受三次独立攻击后缩小，连发只结算一次，保留武器生命并提供缩小保护',()=>{
  const e=giantScene(),p=e.G.p,lives=e.G.lives;p.weapon='spread';ticks(e,122);
  for(const remaining of [2,1,0]){
    assert.ok(playerShot(e).dead);assert.equal(p.giantHits,remaining);assert.equal(p.dead,false);assert.equal(e.G.lives,lives);
    if(remaining){
      assert.ok(p.giantT>0);assert.match(giantPowerLabel(p),new RegExp(`护甲${remaining}次`));
      for(let i=0;i<12;i++)playerShot(e);assert.equal(p.giantHits,remaining,'one burst cannot drain all armor');
      ticks(e,49);
    }
  }
  assert.equal(p.giantT,0);assert.ok(p.invT>1);assert.equal(p.weapon,'spread');assert.equal(e.G.deaths,0);
  playerShot(e);assert.equal(p.dead,false);e.G.eb=[];ticks(e,76);playerShot(e);
  assert.equal(p.dead,true);assert.equal(e.G.lives,lives-1);assert.equal(p.weapon,'rifle');
});

test('巨大化脚下摧毁步兵、炮台及关闭的补给箱，只计分和掉落一次；普通人和上升跳跃不踩坏设施',()=>{
  for(const state of ['normal','ascending','giant']){
    const e=giantScene(),p=e.G.p;
    if(state==='normal')endGiant(p,false);
    if(state==='ascending'){p.vy=-80;p.onGround=false;}
    const turret={t:'tur',x:50,y:96,hp:6,open:false},box={t:'box',x:50,y:112,hp:6,open:false,item:'S'};
    e.G.en=[turret,box];
    if(state==='giant')e.G.en.push({t:'run',x:30,y:112,hp:1});
    const score=e.G.score;e.collide();
    if(state!=='giant'){assert.ok(!turret.dead&&!box.dead,state);assert.equal(e.G.score,score);continue;}
    assert.ok(e.G.en.every(v=>v.dead));assert.equal(e.G.score-score,1100);assert.equal(e.G.items.length,1);assert.equal(e.G.items[0].kind,'S');
    assert.equal(e.G.fx.filter(f=>f.k==='stomp').length,3);
    e.collide();assert.equal(e.G.score-score,1300);assert.equal(e.G.items.length,1);assert.ok(e.G.items[0].dead);
    e.collide();assert.equal(e.G.score-score,1300,'destroyed facilities and collected loot cannot score again');
    const before=JSON.stringify(packWorld(e.G));e.render();assert.equal(JSON.stringify(packWorld(e.G)),before);
  }
  assert.equal(giantCrushBox({giantT:1,x:30,y:100,vy:10,onGround:false})?.w,32);
  assert.equal(giantCrushBox({giantT:1,x:30,y:100,vy:-10,onGround:false}),null);
});

test('巨大化下降踩中要塞炮台沿用部件破坏流程，不能通过一次碰撞直接摧毁整个要塞',()=>{
  const e=giantScene(),p=e.G.p,B=e.G.boss;B.active=true;
  const gun=B.parts.find(pt=>pt.k==='gunA'),core=B.parts.find(pt=>pt.k==='core'),hp=core.hp;
  Object.assign(p,{x:gun.x+gun.w/2,y:gun.y+2,onGround:false,vy:100});e.collide();
  assert.ok(gun.hp<=0);assert.equal(typeof gun.destroyedAt,'number');assert.ok(p.giantCrushT>0);
  assert.equal(core.hp,hp);assert.equal(B.dead,false);assert.ok(e.G.fx.some(f=>f.k==='stomp'));
  Object.assign(p,{x:core.x+core.w/2,y:core.y+2});e.collide();assert.equal(core.hp,hp,'same contact has a stomp cooldown');
});

test('巨大化在前两关持续十五秒，暂停不计时，时间到自动缩小且不扣命',()=>{
  for(const stage of [1,2]){
    const e=giantScene(stage),p=e.G.p,lives=e.G.lives;
    e.G.mode='pause';ticks(e,90);assert.equal(p.giantT,15);assert.equal(p.giantGraceT,2);
    e.G.mode='play';ticks(e,60);assert.ok(Math.abs(p.giantT-14)<1e-6);
    ticks(e,839);assert.ok(p.giantT>0);assert.equal(p.dead,false);
    e.step();assert.equal(p.giantT,0);assert.equal(p.giantHits,0);assert.ok(p.invT>1);assert.equal(e.G.lives,lives);assert.equal(p.dead,false);
  }
});

test('第二关手雷爆炸同样消耗巨大化护甲，巨大化能够压倒冲到身边的敌兵',()=>{
  const e=giantScene(2),p=e.G.p,B=e.G.base;
  const grenade=()=>{const r={u0:0,ut:0,z:.025,a:0,spd:.42};B.rol=[r];e.step();assert.ok(r.dead);};
  grenade();assert.equal(p.giantHits,3);ticks(e,122);
  B.sol=[{u:0,z:0,st:'charge',anim:0}];e.collideBasePlayer();assert.ok(B.sol[0].dead);assert.ok(e.G.fx.some(f=>f.k==='stomp'));
  for(const remaining of [2,1,0]){grenade();assert.equal(p.giantHits,remaining);assert.equal(p.dead,false);ticks(e,49);}
  assert.equal(p.giantT,0);assert.equal(e.G.deaths,0);
});

test('双人巨大化的护甲与计时各自独立，快照完整保留，重复吃蘑菇刷新强化',()=>{
  const e=giantScene(1,true),a=e.G.p,b=e.G.p2;
  e.withPlayer2(()=>{e.G.inv=['u'];e.G.sel=0;e.useSpecial();});
  b.x=140;ticks(e,122);assert.ok(Math.abs(a.giantT-b.giantT)<1e-9);assert.ok(Math.abs(a.giantT-(15-122/60))<1e-6);
  playerShot(e,b);assert.equal(b.giantHits,2);assert.equal(a.giantHits,3);
  const copy=unpackWorld(JSON.parse(JSON.stringify(packWorld(e.G))));
  for(const key of ['giantT','giantHits','giantGraceT','giantHitT','giantCrushT'])assert.equal(copy.p2[key],b[key],key);
  e.withPlayer2(()=>{e.G.inv=['u'];e.G.sel=0;e.useSpecial();});
  assert.equal(b.giantT,15);assert.equal(b.giantHits,3);assert.equal(b.giantGraceT,2);assert.equal(b.giantHitT,0);assert.ok(a.giantT<13);
});

test('巨大化仍会在掉出场景时死亡，复活不继承巨大化或旧护甲',()=>{
  const e=giantScene(),old=e.G.p;old.y=260;old.onGround=false;e.step();
  assert.ok(old.dead);assert.equal(old.giantT,0);assert.equal(old.giantHits,0);assert.equal(old.giantGraceT,0);
  for(let i=0;i<200&&e.G.p.dead;i++)e.step();
  assert.equal(e.G.p.dead,false);assert.notEqual(e.G.p,old);assert.equal(e.G.p.giantT,0);assert.equal(e.G.p.giantHits,0);
});
