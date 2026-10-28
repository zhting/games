import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { GamepadInput } from '../../games/contra2026/js/gamepad-input.mjs';
import { normalizeAudioMix, audioMixLevels } from '../../games/contra2026/js/audio-mix.mjs';
import { THIRTY_LIVES, ThirtyLivesCheat, inTitleLogo } from '../../games/contra2026/js/thirty-lives.mjs';
import { InputBuffer, packWorld, unpackWorld, encodeInput } from '../../games/contra2026/js/coop-core.mjs';
import { StageOneArt, FORTRESS_ART, FORTRESS_TARGETS, FORTRESS_EXIT } from '../../games/contra2026/js/stage-one-art.mjs';
import { StageTwoArt } from '../../games/contra2026/js/stage-two-art.mjs';
import { StageThreeArt } from '../../games/contra2026/js/stage-three-art.mjs';
import { StageFourArt } from '../../games/contra2026/js/stage-four-art.mjs';
import { StageFiveArt } from '../../games/contra2026/js/stage-five-art.mjs';
import * as snowCombat from '../../games/contra2026/js/stage-five-combat.mjs';
import { isLocalStageFivePreview } from '../../games/contra2026/js/local-stage-preview.mjs';
import * as baseFour from '../../games/contra2026/js/stage-four-layout.mjs';
import * as waterfall from '../../games/contra2026/js/stage-three-layout.mjs';
import * as waterfallArms from '../../games/contra2026/js/stage-three-arms.mjs';
import { baseUpMuzzle } from '../../games/contra2026/js/base-actor-poses.mjs';
import { OPENING_DURATION, OPENING_PAGES } from '../../games/contra2026/js/opening-story.mjs';
import { drawSupplySaucer } from '../../games/contra2026/js/supply-saucer.mjs';
import { drawExplosion, drawSupplyDisc, drawEquipmentTurret, drawEquipmentSupply } from '../../games/contra2026/js/combat-art.mjs';
import { BASE_SOLDIER, baseSoldierScale } from '../../games/contra2026/js/base-soldier.mjs';
import { BASE_HIGH_SWITCH, baseShotHeight, baseTargetAtHeight, baseCoreShielded, baseHomingTarget } from '../../games/contra2026/js/base-shooting.mjs';
import { baseSupplyKind } from '../../games/contra2026/js/base-supply.mjs';
import { BASE_BOSS_DEVICES, BASE_BOSS_MOVER, bossDevicesRemaining, movingBossX, advanceBossLift } from '../../games/contra2026/js/base-boss.mjs';
import { canEnterExit, beginExitEntry, advanceExitEntry, teamInsideExit } from '../../games/contra2026/js/stage-one-exit.mjs';
import { ReferenceMusic, StageMusicSession, referenceTrackForScene, musicForScene, stageMusicOptions, stageMusicPool, normalizeStageMusic } from '../../games/contra2026/js/reference-music.mjs';
import { CONTRA_TRACKS, fixedStageMusicKeys, fixedMusicTrack } from '../../games/contra2026/js/fixed-soundtrack.mjs';
import { versionedAssetUrl } from '../../games/contra2026/js/asset-url.mjs';
import { musicRecord } from '../../games/contra2026/js/music-records.mjs';
import { REFERENCE_TRACKS } from '../../games/contra2026/js/reference-music.mjs';
import { ResourcePreloader, gameResourceJobs, musicResourceJobs } from '../../games/contra2026/js/resource-preloader.mjs';
import { stageResourceJobs } from '../../games/contra2026/js/stage-resources.mjs';
import { OPEN_STAGES, LAST_OPEN_STAGE, STAGE_RELEASE_MESSAGE, isStageOpen, nextOpenStage } from '../../games/contra2026/js/release-stages.mjs';
import { beginDeath, advanceDeath, deathVisual } from '../../games/contra2026/js/player-death.mjs';
import { addImpact } from '../../games/contra2026/js/impact-effects.mjs';
import { GIANT_POWER, startGiant, endGiant, updateGiant, hitGiant, giantCrushBox, giantPowerLabel, drawGiantStomp } from '../../games/contra2026/js/giant-power.mjs';

// Run the real inline game engine with a no-op drawing surface. No production
// mutation hooks are exposed; the test hook is injected into this VM only.
function engine({getGamepads=()=>[],coldResources=false,previewStage5=false,touch=false,hostname='localhost',savedSettings=null}={}) {
  let fullscreenRequests=0;
  const elements = new Map(), storage = new Map(), documentEvents=new Map();
  if(savedSettings)storage.set('chiyan-settings',JSON.stringify(savedSettings));
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
    createElement: element, addEventListener(type,handler) {if(!documentEvents.has(type))documentEvents.set(type,[]);documentEvents.get(type).push(handler);}, body: element(), activeElement: null, hidden: false,
    documentElement:{requestFullscreen(){fullscreenRequests++;return Promise.resolve();}},
  };
  class Network {
    playing = false; role = 'host'; room = ''; remote = new InputBuffer();
    constructor(callbacks) { this.callbacks = callbacks; }
    leave() { this.playing = false; this.room = ''; }
  }
  const sandbox = {
    document, navigator: { maxTouchPoints: touch?5:0, getGamepads },
    location: { href: 'http://localhost/games/contra2026/', origin: 'http://localhost', hostname, search: previewStage5?'?preview=5':'' },
    matchMedia: () => ({ matches: false }), addEventListener() {}, requestAnimationFrame() {},
    innerWidth: 768, innerHeight: 432, performance: { now: () => 0 },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    Image: class { complete = false; naturalWidth = 0;
      set src(url){this.url=url;if(url)queueMicrotask(()=>{this.naturalWidth=this.naturalHeight=64;this.onload?.();});}
      get src(){return this.url;}
      decode(){return Promise.resolve();}
    },
    URL, URLSearchParams, Math, Date, Set, Map, console, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask, coldResources,
    ...waterfall,...waterfallArms,...baseFour,...snowCombat,
    THIRTY_LIVES, ThirtyLivesCheat, inTitleLogo, normalizeAudioMix, audioMixLevels,
    CoopClient: Network, packWorld, unpackWorld, StageOneArt, StageTwoArt, StageThreeArt, StageFourArt, StageFiveArt, isLocalStageFivePreview, GamepadInput, baseUpMuzzle, FORTRESS_ART, FORTRESS_TARGETS,
    REFERENCE_TRACKS, CONTRA_TRACKS, fixedStageMusicKeys, fixedMusicTrack, versionedAssetUrl, ResourcePreloader, gameResourceJobs, musicResourceJobs, stageResourceJobs,
    ReferenceMusic, StageMusicSession, referenceTrackForScene, musicForScene, stageMusicOptions, stageMusicPool, normalizeStageMusic, musicRecord, OPEN_STAGES, LAST_OPEN_STAGE, STAGE_RELEASE_MESSAGE, isStageOpen, nextOpenStage, OPENING_DURATION, OPENING_PAGES, drawSupplySaucer, BASE_SOLDIER, baseSoldierScale,
    beginDeath, advanceDeath,
    addImpact,
    drawExplosion, drawSupplyDisc, drawEquipmentTurret, drawEquipmentSupply,
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
    if(!coldResources)for(const stage of OPEN_STAGES)for(const job of stageJobs(stage))resourceCache.add(job.id);
    window.engine = { G, K, SET, coop, reset, step, render, collide, collideBasePlayer, withPlayer2, startGame, startStage, startAfterLoading, cancelLoading, stageResourcesReady, referenceMusic, resourceCache, startUWOpening, unlockUW, stageClear, element: id => document.getElementById(id),
      keepTeamOnScreen, updateCamera, loadRoom, collidePartnerHazards, updateEnemies, updateBullets, collidePlayer, damageEnemy, ebox, updateBoss, updateStage3, hitMech, bossParts, findTarget, solids, BRIDGES, inWall, xMax, stageOneArt, stageThreeArt, Music, stageMusicSession, useSpecial, killPlayer, killSoldier, hitTarget, baseBlast, stageFourArt, stageFiveArt, hitTank, hitFlyingFortress, hitBossPart, placeTank, pBox, toTitle, infiniteLives, gameplaySettings, syncSettingsUI, inspect:()=>window.Contra2026.inspect(),
      resizeWindow(width, height, dpr = 1) { $('wrap').clientWidth = width; $('wrap').clientHeight = height; window.devicePixelRatio = dpr; resize(); },
      resolution: () => ({ canvas: [cv.width, cv.height], backgrounds: backgroundResolution, sky: SKY && [SKY.width, SKY.height] }),
      play(stage, online = true) { coop.playing = online; reset(stage); setMode('play'); } };
    // ================= loop =================`);
  vm.runInNewContext(source, sandbox, { filename: 'contra2026-engine.js' });
  sandbox.engine.dispatchDocument=(type,event)=>{for(const handler of documentEvents.get(type)||[])handler({preventDefault(){},cancelable:true,...event});};
  sandbox.engine.fullscreenRequests=()=>fullscreenRequests;
  return sandbox.engine;
}

const pendingResource=()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return {promise,resolve};};
test('触屏开始、选关、加载及跨关均不自动请求全屏',async()=>{
  const e=engine({touch:true,previewStage5:true,coldResources:true});
  e.referenceMusic.prefetch=async()=>{};
  await e.startGame();
  for(const stage of [1,2,3,4,5,1])await e.startStage(stage);
  assert.equal(e.G.mode,'intro');assert.equal(e.fullscreenRequests(),0);
});
test('第五关战车是中途战斗，继续穿越雪林后击败空中堡垒才通关',async()=>{
  const e=engine({hostname:'games.tangletang.top',coldResources:true});assert.equal(e.element('btnSel5').hidden,false);
  const requested=[];e.referenceMusic.prefetch=async key=>requested.push(key);
  assert.equal(await e.startStage(5),true);assert.equal(e.G.mode,'intro');assert.equal(e.inspect().resources.total,25);assert.equal(e.inspect().audio.resolved.track,'stage5');assert.deepEqual(requested,['stage5']);
  e.play(5,false);e.G.en=[];e.G.podTrig=[];e.G.p.invT=9999;
  const ice=e.solids.find(s=>s.g&&s.ice);Object.assign(e.G.p,{x:ice.x+20,y:176,onGround:true,support:ice,vx:60});
  e.step();assert.ok(e.G.p.vx>20,'ice retains momentum after releasing movement');
  e.G.camX=3400-384;e.G.p.x=e.G.camX+110;e.step();assert.equal(e.G.tank.active,true);
  const [gun,cannon,core]=e.G.tank.parts;e.hitTank(gun,99);e.hitTank(cannon,99);assert.equal(e.G.tank.dead,false);
  e.hitTank(core,36);assert.equal(e.G.tank.phase2,true);const home=e.G.tank.home;
  for(let i=0;i<95;i++)e.step();assert.ok(e.G.tank.x<home,'phase two still drives the tank forward');
  e.render();e.hitTank(core,99);assert.equal(e.G.tank.dead,true);for(let i=0;i<205;i++)e.step();
  assert.equal(e.G.mode,'play');assert.equal(e.G.fortress.active,false);assert.equal(e.inspect().audio.resolved.track,'stage5');
  assert.ok(e.xMax(10)>4900,'the midpoint wreck no longer blocks the route');
  e.G.p.x=4770;e.updateCamera();e.step();assert.equal(e.G.fortress.active,true);assert.equal(e.bossParts().length,0,'entry animation cannot be skipped with damage');
  for(let i=0;i<125;i++)e.step();assert.equal(e.bossParts().length,3);assert.ok(e.G.fortress.y>50);
  e.hitBossPart(e.G.fortress.parts[0],99);assert.equal(e.G.fortress.dead,false);e.render();
  e.hitBossPart(e.G.fortress.parts[2],99);for(let i=0;i<190&&e.G.mode!=='clear';i++)e.step();
  assert.equal(e.G.mode,'clear');assert.equal(e.element('clearTitle').textContent,'前五关通关');assert.equal(e.element('btnNext').hidden,true);
  e.coop.playing=true;assert.notEqual(e.startStage(5),false,'public fifth stage also opens multiplayer');assert.equal(e.G.stage,5);assert.equal(e.G.mode,'intro');
});

test('第五关固定炮位有人操作、树后敌人投雷，离屏不攻击且冰冻停止装填',()=>{
  const e=engine();e.play(5,false);e.G.p.invT=9999;e.G.podTrig=[];e.G.spawnT=9999;
  const guns=e.G.en.filter(u=>u.t==='artillery'),rear=e.G.en.filter(u=>u.t==='grenadier');assert.equal(guns.length,7);assert.equal(rear.length,7);
  for(const gun of guns)assert.ok(e.solids.some(s=>gun.x>=s.x&&gun.x<=s.x+s.w&&gun.y===s.y));
  const far=guns.at(-1),offscreenTimer=far.phaseT,seen=new Set();
  for(let i=0;i<260;i++){e.step();for(const b of e.G.eb)if(b.snowOrdnance)seen.add(b.snowOrdnance);}
  assert.ok(seen.has('shell'));assert.ok(seen.has('grenade'));assert.equal(far.phaseT,offscreenTimer);
  e.G.eb=[];e.G.freezeT=2;const timers=JSON.stringify(e.G.en.filter(u=>['artillery','grenadier'].includes(u.t)).map(u=>[u.phase,u.phaseT,u.peek]));
  for(let i=0;i<45;i++)e.step();assert.equal(e.G.eb.length,0);assert.equal(JSON.stringify(e.G.en.filter(u=>['artillery','grenadier'].includes(u.t)).map(u=>[u.phase,u.phaseT,u.peek])),timers);
  const gun=e.G.en.find(u=>u.t==='artillery');e.damageEnemy(gun,8,gun.x,gun.y-15);assert.equal(gun.dead,true);
});

test('击毁中途战车不会清除后半段守军，也不会让角色永久无敌',()=>{
  const e=engine();e.play(5,false);e.G.camX=3016;e.G.p.x=3120;e.G.p.invT=0;
  const rear=e.G.en.filter(u=>u.x>3400);e.hitTank(e.G.tank.parts[2],999);
  assert.ok(rear.length>=6);assert.ok(rear.every(u=>!u.dead));e.killPlayer();assert.equal(e.G.p.dead,true);
});

test('最终空中堡垒可被正常向上射击命中，战机与云层不参与角色伤害',()=>{
  const e=engine();e.play(5,false);e.G.en=[];e.G.podTrig=[];e.G.spawnT=9999;e.G.tank.dead=true;e.G.tank.deadT=0;
  const F=e.G.fortress;Object.assign(F,{active:true,entryT:0,home:4750,x:4750,y:68,phase:'hover',phaseT:999});
  Object.assign(e.G.p,{x:4770,y:176,onGround:true,invT:999,weapon:'laser'});e.G.camX=4616;e.K.ArrowUp=true;e.K.KeyJ=true;
  for(let i=0;i<90;i++)e.step();assert.ok(F.parts[2].hp<90,'ordinary player bullets hit the exposed engine');assert.equal(e.G.p.dead,false);
});

test('第五关敌方手雷落地爆炸能伤害角色，护盾可抵挡，树林后身体不阻挡前景行走',()=>{
  const e=engine();e.play(5,false);e.G.en=[];e.G.podTrig=[];e.G.p.invT=9999;
  const bomb={x:100,y:130,vx:20,vy:50,g:250,r:2.6,snowOrdnance:'grenade',fuse:.7,age:0,bounces:0};e.G.eb=[bomb];
  for(let i=0;i<60&&bomb.snowOrdnance!=='blast';i++)e.updateBullets();
  assert.equal(bomb.snowOrdnance,'blast');assert.equal(bomb.bounces,1);assert.ok(e.G.fx.some(f=>f.k==='boom'));
  Object.assign(e.G.p,{x:bomb.x,y:176,invT:0,shieldT:2});e.collidePlayer();assert.equal(e.G.p.dead,false);assert.equal(bomb.dead,true);
  e.G.eb=[{...bomb,dead:false}];e.G.p.shieldT=0;e.collidePlayer();assert.equal(e.G.p.dead,true);
  e.play(5,false);e.G.p.invT=0;e.G.en=[{t:'grenadier',x:e.G.p.x,y:176,hp:2,face:-1,peek:1}];e.G.eb=[];e.collidePlayer();assert.equal(e.G.p.dead,false);
});

test('第五关使用热成像镜立即改变晴天画面，到期恢复正常且不新增资源加载',async()=>{
  const e=engine({previewStage5:true,coldResources:true});e.referenceMusic.prefetch=async()=>{};await e.startStage(5);e.play(5,false);
  e.G.en=[];e.G.podTrig=[];e.G.spawnT=9999;e.G.p.invT=999;e.G.inv=['v'];e.G.sel=0;
  const resources=e.resourceCache.size;e.useSpecial();assert.equal(e.G.p.thermT,15);e.render();
  assert.equal(e.inspect().art.thermal.active,true);assert.ok(e.inspect().art.thermal.converted>0);assert.equal(e.G.s5.bliz,0);
  assert.equal(e.stageFiveArt.thermalPainting,false);assert.equal(e.stageFiveArt.hdActors.frameEffect,undefined);
  e.element('game').getContext('2d').canvas=e.element('game');
  e.resizeWindow(3840,2160);e.render();assert.deepEqual([...e.inspect().art.resolution],[3840,2160]);
  assert.equal(e.stageFiveArt.thermalView.width,1536);assert.equal(e.stageFiveArt.thermalView.height,864);
  e.G.p.thermT=.01;e.step();e.render();assert.equal(e.inspect().art.thermal.active,false);assert.equal(e.resourceCache.size,resources);
});

test('自动进入第三关先等待本关音乐，暂停旧场景并保留武器、道具和生命',async()=>{
  const e=engine({coldResources:true}),song=pendingResource(),requests=[];
  e.referenceMusic.prefetch=key=>{requests.push(key);return song.promise;};
  e.play(2,false);e.G.p.weapon='laser';e.G.inv=['mushroom','h'];e.G.lives=17;e.G.score=12345;
  const player=e.G.p,loading=e.startStage(3,true);
  assert.equal(e.G.mode,'loading');assert.equal(e.G.stage,2);const time=e.G.time;e.step();assert.equal(e.G.time,time);
  await new Promise(setImmediate);assert.deepEqual(requests,['stage3']);assert.equal(e.G.p,player);
  song.resolve();assert.equal(await loading,true);assert.equal(e.G.stage,3);assert.equal(e.G.mode,'intro');
  assert.equal(e.G.p.weapon,'laser');assert.deepEqual([...e.G.inv],['mushroom','h']);assert.equal(e.G.lives,17);assert.equal(e.G.score,12345);
  assert.equal(e.stageResourcesReady(3),true);e.startStage(3);assert.equal(e.G.mode,'intro');assert.deepEqual(requests,['stage3']);
});

test('双人玩家加载目标关卡时保留最新快照，加载完才切换画面，忽略房主的加载中快照',async()=>{
  const host=engine(),guest=engine({coldResources:true}),song=pendingResource();
  guest.referenceMusic.prefetch=()=>song.promise;guest.play(1,true);guest.coop.role='guest';
  host.play(3,true);host.G.p2.x=101;
  const sync=()=>guest.coop.callbacks.state(JSON.parse(JSON.stringify(packWorld([host.G,host.solids,host.BRIDGES,host.SET]))));
  host.G.mode='loading';sync();assert.equal(guest.G.stage,1);assert.equal(guest.G.mode,'play');
  host.G.mode='play';sync();assert.equal(guest.G.stage,1);assert.equal(guest.G.mode,'loading');
  host.G.p2.x=147;host.G.score=9000;sync();song.resolve();
  for(let i=0;i<8&&guest.G.mode==='loading';i++)await new Promise(setImmediate);
  assert.equal(guest.G.stage,3);assert.equal(guest.G.mode,'play');assert.equal(guest.G.p2.x,147);assert.equal(guest.G.score,9000);
});

test('取消关卡加载或联机退出后，迟到的下载不会重新进入游戏',async()=>{
  const e=engine({coldResources:true}),song=pendingResource();e.referenceMusic.prefetch=()=>song.promise;
  const loading=e.startStage(4);await new Promise(setImmediate);e.cancelLoading();assert.equal(e.G.mode,'title');
  song.resolve();assert.equal(await loading,false);assert.equal(e.G.mode,'title');assert.equal(e.G.stage,1);
});

test('加入房间先查询真实关卡，未开始游戏前不下载选择器中的关卡',async()=>{
  const e=engine({coldResources:true}),requests=[];e.referenceMusic.prefetch=async key=>requests.push(key);
  e.coop.join=async code=>assert.equal(code,'ABC234');e.element('coopCode').value='ABC234';e.element('coopStage').value='1';
  await e.element('coopJoinForm').onsubmit({preventDefault(){}});
  assert.equal(e.inspect().resources.total,0);assert.equal(e.resourceCache.size,0);assert.deepEqual(requests,[]);
});

test('第四关四个房间需解除防护才能破门，前进时清空弹道，随后进入四装置中枢',()=>{
  const e=engine();e.play(4,false);e.G.p.invT=9999;
  for(let room=0;room<4;room++){
    const B=e.G.base;assert.equal(B.room,room);assert.ok(!B.def.boss);
    const core=B.targets.find(t=>t.k==='core');e.hitTarget(core,99);assert.equal(core.hp,12,'cannot bypass the defenses');
    for(const t of B.targets.filter(t=>t.k!=='core'))e.hitTarget(t,99);
    e.hitTarget(core,99);assert.equal(B.cleared,true);assert.equal(e.G.items.length,0);
    B.clearT=0;e.step();assert.ok(B.trans>0);
    e.G.pb=[{k:'b'}];e.G.eb=[{base:true}];e.G.gr=[{base:true}];e.step();
    assert.equal(e.G.pb.length+e.G.eb.length+e.G.gr.length,0);
    for(let i=0;i<85&&e.G.base.room===room;i++)e.step();assert.equal(e.G.base.room,room+1);
  }
  assert.equal(e.G.base.bossPhase,'devices');assert.equal(e.G.base.targets.length,4);assert.equal(e.G.base.def.boss,'twin');
});

test('第四关关闭护板挡住所有弹种和爆炸，冻结停住护板，EMP 不会打开机械装甲',()=>{
  const e=engine();e.play(4,false);e.loadRoom(4);e.G.p.invT=9999;
  const B=e.G.base,target=B.targets[1];
  for(let i=0;i<240&&!baseFour.stageFourFacilityClosed(target);i++)e.step();assert.equal(baseFour.stageFourFacilityClosed(target),true);
  e.G.freezeT=99;e.G.empT=99;const hp=target.hp,aperture=target.aperture;
  e.hitTarget(target,99);e.baseBlast(target.x+target.w/2,target.y+target.h/2);assert.equal(target.hp,hp);
  for(const k of ['b','sp','laser','fire','msl']){
    e.G.pb=[{k,t:.99,spd:1,x0:192,y0:166,x:192,y:166,xe:target.x+target.w/2,ye:target.y+target.h/2,dmg:99}];e.step();assert.equal(target.hp,hp,k);
  }
  assert.equal(target.aperture,aperture);e.G.freezeT=0;
  for(let i=0;i<240&&baseFour.stageFourFacilityClosed(target);i++)e.step();assert.equal(baseFour.stageFourFacilityClosed(target),false);
  e.G.freezeT=99;e.G.pb=[{k:'b',t:.99,spd:1,x0:192,y0:166,x:192,y:166,xe:target.x+target.w/2,ye:target.y+target.h/2,dmg:1}];e.step();assert.equal(target.hp,hp-1);
});

test('第四关两层侧门守军实际进入并开火，冻结及双人快照保留同一开合和波次状态',()=>{
  const e=engine();e.play(4,true);e.loadRoom(4);e.G.p.invT=e.G.p2.invT=9999;const B=e.G.base,tiers=new Set();
  for(let i=0;i<500;i++){e.step();for(const b of e.G.eb)if(b.galleryTier!==undefined)tiers.add(b.galleryTier);assert.ok(B.gallery.length<=4);}
  assert.equal(tiers.size,2);assert.ok(B.galleryId>=4);assert.ok(B.gallery.length>0);
  const before=JSON.stringify({gallery:B.gallery,timers:B.galleryTimers,clock:B.shutterTime,apertures:B.targets.map(t=>t.aperture)});e.G.freezeT=10;e.G.eb=[];ticks(e,60);
  assert.equal(JSON.stringify({gallery:B.gallery,timers:B.galleryTimers,clock:B.shutterTime,apertures:B.targets.map(t=>t.aperture)}),before);assert.equal(e.G.eb.length,0);
  const copy=unpackWorld(JSON.parse(JSON.stringify(packWorld(e.G))));assert.deepEqual(copy.base.gallery,B.gallery);assert.deepEqual(copy.base.targets.map(t=>t.aperture),B.targets.map(t=>t.aperture));
});

test('第四关真实子弹击中楼层内可见守军，重复弹丸不重复计分，清场停止后续出兵',()=>{
  const e=engine();e.play(4,false);e.loadRoom(4);e.G.p.invT=9999;ticks(e,210);const B=e.G.base,s=B.gallery.find(s=>s.tier===1&&s.side<0);
  assert.ok(s);const score=e.G.score;
  e.G.pb=Array.from({length:2},()=>({k:'b',t:.99,spd:1,x0:192,y0:166,x:192,y:166,xe:s.x,ye:s.y-12,dmg:1}));e.step();assert.equal(s.dead,true);assert.equal(e.G.score-score,100);
  e.loadRoom(0);ticks(e,150);assert.ok(B.gallery.length>0);
  for(const t of B.targets.filter(t=>t.k!=='core')){t.aperture=1;e.hitTarget(t,999);}const core=B.targets.find(t=>t.k==='core');core.aperture=1;e.hitTarget(core,999);
  assert.equal(B.cleared,true);assert.equal(B.gallery.length,0);ticks(e,60);assert.equal(B.gallery.length,0);
});

test('第四关高位装置挡住地面弹道；真实跳跃射击启动双生投影，上举追踪弹可完成战斗',()=>{
  const e=engine();e.play(4,false);e.loadRoom(4);e.G.p.invT=9999;
  const B=e.G.base,high=B.targets[0];for(const t of B.targets.slice(1))e.hitTarget(t,99);
  e.K.KeyJ=true;ticks(e,180);assert.equal(high.hp,7);assert.equal(B.bossPhase,'devices');
  for(let i=0;i<1200&&high.hp>0;i++){e.K.KeyK=i%55===0;e.step();}
  e.K.KeyK=false;assert.ok(high.hp<=0);for(let i=0;i<100&&B.bossPhase!=='twins';i++)e.step();
  assert.equal(B.bossPhase,'twins');assert.equal(B.targets.filter(t=>t.k==='twin').length,2);
  e.K.KeyW=true;e.G.p.weapon='homing';
  for(let i=0;i<2400&&!B.dead;i++){
    const target=B.targets.find(t=>t.k==='twin'&&t.hp>0);e.G.p.x=Math.max(28,Math.min(356,192+2*(target.x+target.w/2-192)));e.step();
  }
  assert.equal(B.dead,true);assert.equal(e.G.p.dead,false);assert.equal(e.G.pb.length+e.G.eb.length+e.G.gr.length,0);
  e.K.KeyJ=e.K.KeyW=false;ticks(e,100);assert.equal(B.exitReady,true);assert.equal(e.G.mode,'play','must board a lift to finish');
  e.K.KeyA=true;for(let i=0;i<500&&e.G.mode==='play';i++)e.step();
  assert.equal(e.G.stage,5);assert.equal(e.G.mode,'intro');assert.equal(e.G.p.weapon,'homing');
});

test('第四关投影冻结时不移动、不发弹；快照保留实体状态，两人须分别完成升降梯',()=>{
  const e=engine();e.play(4,true);e.loadRoom(4);for(const t of e.G.base.targets)e.hitTarget(t,99);
  ticks(e,90);const B=e.G.base,twins=B.targets.filter(t=>t.k==='twin');
  const ghost=twins.find(t=>!t.solid);assert.ok(ghost);e.hitTarget(ghost,5);assert.equal(ghost.hp,30,'scattered projections cannot be damaged');
  e.G.freezeT=10;e.G.eb=[];
  const before=JSON.stringify(twins);ticks(e,60);assert.equal(JSON.stringify(twins),before);assert.equal(e.G.eb.length,0);
  const copy=unpackWorld(JSON.parse(JSON.stringify(packWorld(e.G))));assert.equal(copy.base.bossPhase,'twins');assert.equal(copy.base.targets.at(-1).solid,twins.at(-1).solid);
  e.G.freezeT=0;for(const twin of twins){twin.solid=true;e.hitTarget(twin,99);}ticks(e,100);
  e.G.p.x=28;e.step();ticks(e,180);assert.equal(e.G.p.liftDone,true);assert.equal(e.G.mode,'play');
  e.G.p2.x=356;e.step();for(let i=0;i<200&&e.G.mode==='play';i++)e.step();assert.equal(e.G.stage,5);assert.equal(e.G.mode,'intro');
  const guest=engine();guest.play(4,true);guest.coop.role='guest';guest.coop.callbacks.state(JSON.parse(JSON.stringify(packWorld([e.G,e.solids,e.BRIDGES,e.SET]))));
  assert.equal(guest.G.stage,5);assert.equal(guest.G.mode,'intro');
});

test('第四关手柄上方向和射击组合使用举枪姿势并发射顶部弹道',()=>{
  let pads=[];const e=engine({getGamepads:()=>pads});e.play(4,false);e.loadRoom(4);e.G.p.invT=9999;
  for(const target of e.G.base.targets)e.hitTarget(target,99);ticks(e,90);
  pads=[{index:0,id:'Xbox Wireless Controller',connected:true,mapping:'standard',axes:[0,-.9],buttons:Array.from({length:17},(_,i)=>({pressed:i===2,value:i===2?1:0}))}];
  e.step();assert.equal(e.G.p.aimUp,true);assert.ok(e.G.pb.some(b=>b.upward&&b.ye<80));
});

test('公开入口开放前五关，旧秘籍与隐藏按钮不能启动后续关卡',()=>{
  const e=engine();e.play(1,false);e.G.p.weapon='laser';const player=e.G.p;
  for(const stage of [0,6,8,9,16,17,'2',1.5]){
    assert.equal(e.startStage(stage),false);assert.equal(e.G.stage,1);assert.equal(e.G.mode,'play');assert.equal(e.G.p,player);
  }
  assert.equal(e.startUWOpening(false),false);e.unlockUW('old cheat');
  assert.equal(e.G.stage,1);assert.equal(e.G.p.weapon,'laser');
  for(let stage=6;stage<=16;stage++){
    const button=e.element(stage<=8?'btnSel'+stage:'btnSelW'+(stage-8));
    assert.equal(button.hidden,true);assert.equal(button.disabled,true);
  }
  assert.equal(e.SET.stageMusic,undefined,'old soundtrack preferences are removed');
  assert.equal(e.element('btnSel3').hidden,false);assert.equal(e.element('btnSel3').disabled,false);assert.equal(e.element('btnSel5').hidden,false);assert.equal(e.element('btnSel5').disabled,false);
});

test('真实引擎通过手柄移动、射击、跳跃、扔雷、切换道具与暂停，断线释放移动',()=>{
  let snapshot=[];const e=engine({getGamepads:()=>snapshot});
  const input=(buttons=[],axes=[0,0])=>snapshot=[{index:0,id:'Xbox Wireless Controller',mapping:'standard',connected:true,
    buttons:Array.from({length:17},(_,i)=>({pressed:buttons.includes(i),value:buttons.includes(i)?1:0})),axes}];
  const tick=(buttons=[],axes=[0,0],count=1)=>{input(buttons,axes);for(let i=0;i<count;i++)e.step();};
  e.play(3,false);e.G.en=[];e.G.podTrig=[];e.G.s3.rockT=e.G.s3.runT=9999;e.G.p.invT=9999;tick();
  const x=e.G.p.x;tick([2],[.8,0],10);assert.ok(e.G.p.x>x);assert.ok(e.G.pb.length>0);
  tick();tick([0]);assert.ok(e.G.p.vy<0);assert.equal(e.G.p.onGround,false);
  tick();tick([1]);assert.ok(e.G.nadeCd>0);assert.ok(e.G.gr.length>0);assert.equal(e.G.mode,'play','B 是游戏中的手雷，不会误触暂停');
  e.G.inv=['h','t'];e.G.sel=0;tick();tick([4]);assert.equal(e.G.sel,1);
  tick();tick([3]);assert.ok(e.G.gr.some(g=>g.tnt));assert.deepEqual([...e.G.inv],['h']);
  tick();tick([2],[0,-.9]);assert.equal(e.G.p.ay,-1);
  tick();tick([9]);assert.equal(e.G.mode,'pause');tick();tick([1]);assert.equal(e.G.mode,'play');
  tick([2],[.8,0]);snapshot=[];e.step();assert.equal(e.G.p.vx,0);
  tick();tick([8]);assert.equal(e.G.mode,'pause');
});

const enterLifeCode=e=>{for(const code of ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA','KeyB','KeyA'])e.dispatchDocument('keydown',{code});};
test('默认有限生命会扣命；旧默认无限设置迁移，用户新选择的无限模式保留',()=>{
  for(const savedSettings of [null,{v:2,inf:'on'},{v:2,inf:'off'}]){
    const e=engine({savedSettings});e.play(1,false);assert.equal(e.infiniteLives(),false);assert.equal(e.G.lives,3);
    e.G.p.invT=0;e.killPlayer();assert.equal(e.G.lives,2);assert.equal(e.SET.v,3);
  }
  const chosen=engine({savedSettings:{v:3,inf:'on'}});chosen.play(1,false);assert.equal(chosen.infiniteLives(),true);
  const easy=engine({savedSettings:{v:3,inf:'off',diff:'easy'}});easy.play(1,false);assert.equal(easy.G.lives,5);
});

test('首关不下载旧跑步图集，单人及双人仍用共享肢体绘制跑步',async()=>{
  const e=engine({coldResources:true});e.referenceMusic.prefetch=async()=>{};await e.startStage(1);
  for(const key of ['runRed','runBlue','runEnemy'])assert.equal(e.stageOneArt.loaded.has(key),false);
  assert.equal(e.stageOneArt.loaded.has('runLimbs'),true);assert.equal(e.stageOneArt.ready,true);
  for(const online of [false,true]){
    e.play(1,online);e.K.KeyD=true;ticks(e,10);e.render();
    assert.ok(e.stageOneArt.hdActors.movingFrames.size>0);
  }
});

test('PC 标题秘籍让前五关以 30 条有限生命开局，扣命与切关继承正常且不覆盖无限生命偏好',()=>{
  const e=engine();e.SET.inf='on';enterLifeCode(e);assert.equal(e.inspect().lives.armed,true);
  assert.match(e.element('btnStart').textContent,/30 条命/);e.play(1,false);
  assert.equal(e.G.lives,30);assert.equal(e.G.thirtyLives,true);assert.equal(e.infiniteLives(),false);assert.equal(e.SET.inf,'on');
  assert.equal(e.gameplaySettings().inf,'off');e.syncSettingsUI();assert.equal(e.element('set-inf-on').disabled,true);assert.equal(e.element('set-inf-off').checked,true);
  e.G.p.invT=0;e.killPlayer();assert.equal(e.G.lives,29);e.reset(2,true);assert.equal(e.G.lives,29);e.reset(3,true);assert.equal(e.G.lives,29);
  e.reset(3,false);assert.equal(e.G.lives,30);e.toTitle();assert.equal(e.G.thirtyLives,false);assert.equal(e.infiniteLives(),true);assert.equal(e.SET.inf,'on');assert.equal(e.G.lives,3);
  e.syncSettingsUI();assert.equal(e.element('set-inf-on').disabled,false);assert.equal(e.element('set-inf-on').checked,true);
});
test('手机标题 Logo 八次轻点激活，鼠标、区域外点击与滑动不能激活',()=>{
  const e=engine(),tap=(pointerType='touch',x=592,upX=x)=>{
    e.dispatchDocument('pointerdown',{pointerType,pointerId:1,isPrimary:true,clientX:x,clientY:80});
    e.dispatchDocument('pointerup',{pointerType,pointerId:1,clientX:upX,clientY:80});
  };
  for(let i=0;i<8;i++)tap('mouse');assert.equal(e.inspect().lives.armed,false);
  for(let i=0;i<8;i++)tap('touch',0);assert.equal(e.inspect().lives.armed,false);
  for(let i=0;i<8;i++)tap('touch',592,640);assert.equal(e.inspect().lives.armed,false);
  for(let i=0;i<7;i++)tap();assert.equal(e.inspect().lives.armed,false);tap();assert.equal(e.inspect().lives.armed,true);
  for(let i=0;i<8;i++)tap();e.play(2,false);assert.equal(e.G.lives,30);assert.equal(e.infiniteLives(),false);
});
test('游玩中不能输入秘籍补命，生命用完仍会结束；回到标题后旧秘籍不会开放后续关卡',()=>{
  const e=engine();e.play(1,false);enterLifeCode(e);assert.equal(e.inspect().lives.armed,false);
  e.toTitle();enterLifeCode(e);e.play(1,false);e.G.lives=1;e.G.en=[];e.G.podTrig=[];e.G.spawnT=9999;e.G.p.invT=0;e.killPlayer();
  assert.equal(e.G.lives,0);for(let i=0;i<180&&e.G.mode==='play';i++)e.step();assert.equal(e.G.mode,'over');
  e.toTitle();assert.equal(e.inspect().lives.armed,false);assert.equal(e.element('btnStart').textContent,'单人闯关');
  for(let stage=6;stage<=16;stage++)assert.equal(e.startStage(stage),false);assert.equal(e.G.stage,1);
});
test('双人快照传递 30 命模式，客机 HUD 使用相同有限生命规则',()=>{
  const host=engine(),guest=engine();enterLifeCode(host);host.play(2,true);guest.play(2,true);guest.coop.role='guest';
  guest.coop.callbacks.state(JSON.parse(JSON.stringify(packWorld([host.G,host.solids,host.BRIDGES,host.SET]))));
  assert.equal(guest.G.lives,30);assert.equal(guest.G.thirtyLives,true);assert.equal(guest.infiniteLives(),false);assert.equal(guest.gameplaySettings().inf,'off');
});

test('第三关使用真实移动和二段跳可从起点攀登至山顶，镜头只向上且无坠落',()=>{
  for(const startTime of [0,4,11,21]){
  const e=engine();e.play(3,false);e.G.en=[];e.G.podTrig=[];e.G.s3.rockT=e.G.s3.runT=9999;e.G.p.invT=9999;
  e.G.time=startTime;
  let target=null,airTicks=0,previousCamera=0;
  const visited=new Set(),stones=new Set();
  for(let frame=0;frame<14000&&!e.G.mech.active;frame++){
    const p=e.G.p;
    if(p.onGround){
      visited.add(Math.round(p.y));if(p.support?.drift)stones.add(p.support.id);airTicks=0;
      const above=e.solids.filter(s=>s.y<p.y-5&&s.y>=p.y-104).sort((a,b)=>b.y-a.y||Math.abs((a.x+a.w/2)-p.x)-Math.abs((b.x+b.w/2)-p.x));
      target=above[0];
      if(!target)break;
    }
    if(!target)break;
    const tx=Math.max(target.x+12,Math.min(target.x+target.w-12,p.x));
    e.K.KeyA=p.x>tx+1.5;e.K.KeyD=p.x<tx-1.5;
    if(p.onGround){e.K.KeyK=Math.abs(tx-p.x)<82&&frame%2===0;}
    else{airTicks++;e.K.KeyK=airTicks===21;}
    e.step();
    assert.ok(e.G.camY<=previousCamera+.001);previousCamera=e.G.camY;
    assert.equal(e.G.deaths,0,JSON.stringify({frame,p:{x:p.x,y:p.y},target,visited:[...visited]}));
  }
  assert.equal(e.G.mech.active,true,JSON.stringify({player:e.G.p,camera:e.G.camY,visited:[...visited]}));
  assert.ok(visited.size>=20);assert.equal(e.G.stage,3);
  assert.deepEqual([...stones].sort(),['drift-0','drift-1','drift-2']);
  }
});

test('第三关三处浮石是上行必经落脚点，移除后任意二段跳时机均跨不过断层',()=>{
  const e=engine();
  for(let gate=0;gate<3;gate++){
    for(let secondJump=2;secondJump<=48;secondJump++){
      e.play(3,false);e.G.en=[];e.G.podTrig=[];e.G.s3.rockT=e.G.s3.runT=9999;
      const stone=e.solids.find(s=>s.id==='drift-'+gate);
      const fixed=e.solids.filter(s=>!s.drift);
      const lower=fixed.filter(s=>s.y>stone.baseY).sort((a,b)=>a.y-b.y)[0];
      const upper=fixed.filter(s=>s.y<stone.baseY).sort((a,b)=>b.y-a.y)[0];
      assert.equal(lower.y-upper.y,144);
      assert.ok(lower.y-stone.baseY<76&&stone.baseY-upper.y<76);
      e.solids.splice(e.solids.indexOf(stone),1);
      const goal=Math.max(upper.x+12,Math.min(upper.x+upper.w-12,lower.x+12));
      Object.assign(e.G.p,{x:Math.max(lower.x+12,Math.min(lower.x+lower.w-12,goal)),y:lower.y,
        vx:0,vy:0,onGround:true,support:lower,invT:9999});
      e.G.camY=lower.y-148;let highest=lower.y;
      for(let frame=0;frame<100&&!e.G.p.dead;frame++){
        const p=e.G.p;e.K.KeyA=p.x>goal+1.5;e.K.KeyD=p.x<goal-1.5;
        e.K.KeyK=frame===0||frame===secondJump;e.step();highest=Math.min(highest,p.y);
        if(frame>secondJump&&p.onGround)break;
      }
      assert.ok(highest>upper.y,JSON.stringify({gate,secondJump,highest,upper:upper.y}));
    }
  }
});

test('第三关喷火桥有熄灭与预警窗口，火柱按世界坐标伤害两名玩家',()=>{
  assert.equal(waterfall.flameJetBoxes(1.9).length,0);
  const bridge=waterfall.FLAME_BRIDGES[0],x=bridge.x+bridge.w*.23;
  assert.equal(waterfall.flameJetState(1.9).phase,'warning');assert.equal(waterfall.flameJetState(2.7).phase,'fire');
  for(const slot of [1,2]){
    const e=engine();e.play(3,true);e.G.en=[];e.G.time=2.7;e.G.freezeT=0;
    const p=slot===1?e.G.p:e.G.p2;Object.assign(p,{x,y:bridge.y,onGround:true,invT:0});
    e.updateStage3();assert.equal(p.dead,true);assert.equal(slot===1?e.G.p2.dead:e.G.p.dead,false);
  }
});

test('第三关浮石带动落脚角色，双人快照保留支撑引用，新开局恢复平台位置',()=>{
  const e=engine();e.play(3,true);const rock=e.solids.find(s=>s.drift);
  Object.assign(e.G.p2,{x:rock.x+rock.w/2,y:rock.y,onGround:true,support:rock});
  waterfall.advanceStageThreePlatforms(e.solids,[e.G.p,e.G.p2],2.3);
  assert.ok(Math.abs(e.G.p2.x-rock.x-rock.w/2)<.001);assert.equal(e.G.p2.y,rock.y);
  const [world,platforms]=unpackWorld(JSON.parse(JSON.stringify(packWorld([e.G,e.solids]))));
  assert.equal(world.p2.support,platforms.find(s=>s.id===rock.id));
  const moved=rock.x;e.play(3,false);const fresh=e.solids.find(s=>s.drift);
  assert.equal(fresh.x,fresh.baseX);assert.notEqual(fresh.x,moved);
});

test('第三关固定敌人开局预置，增援仅在接边岩台的屏幕外生成，悬空岩台不刷兵',()=>{
  const e=engine();e.play(3,false);
  for(const [kind,positions]of [['snp',waterfall.STAGE_THREE_SNIPERS],['tur',waterfall.STAGE_THREE_TURRETS]]){
    assert.deepEqual(Array.from(e.G.en.filter(q=>q.t===kind),q=>[q.x,q.y]),positions);
  }
  const ledges=e.solids.filter(s=>s.cliff&&!s.summit&&s.w>=100);
  for(const ledge of ledges){
    e.play(3,false);e.G.en=[];e.G.camY=ledge.y-80;e.G.s3.rockT=9999;e.G.s3.runT=0;e.G.p.invT=9999;
    e.solids.splice(0,e.solids.length,ledge);e.updateStage3();
    const runners=e.G.en.filter(q=>q.t==='run'),edge=ledge.x<=0||ledge.x+ledge.w>=384;
    assert.equal(runners.length,edge?1:0,JSON.stringify(ledge));
    if(!edge)continue;
    const enemy=runners[0];assert.ok(enemy.x<=-28||enemy.x>=412);assert.equal(enemy.y,ledge.y);
    assert.equal(Math.sign(enemy.vx),ledge.x<=0?1:-1);assert.equal(enemy.waterfallEntry.ledge,ledge.id);
  }
});

test('第三关左右增援连续走入并落在同一岩台，入场阶段不悬空下坠或提前射击',()=>{
  for(const side of ['left','right']){
    const e=engine();e.play(3,false);e.G.en=[];e.G.camY=0;e.G.s3.rockT=9999;e.G.s3.runT=0;
    const ledge=e.solids.find(s=>s.cliff&&s.y===84),other={...ledge,x:0,w:120,id:'left-entry'};
    e.solids.splice(0,e.solids.length,side==='left'?other:ledge);e.G.camY=84-80;e.updateStage3();
    const enemy=e.G.en.find(q=>q.t==='run');assert.ok(enemy);const direction=side==='left'?1:-1,initial=enemy.x,anim=enemy.anim;
    let entered=false;
    for(let frame=0;frame<60;frame++){
      const previous=enemy.x;e.updateEnemies();
      assert.ok(Math.abs(enemy.x-previous-direction*62/60)<1e-8,'连续移动，不能跳到屏幕内');
      assert.equal(enemy.y,84);assert.equal(enemy.dead,undefined);assert.equal(enemy.on,true);
      assert.equal(e.G.eb.length,0,'走入岩台前不能射击');
      if(!enemy.waterfallEntry){entered=true;break;}
    }
    assert.ok(entered);assert.ok(direction*(enemy.x-initial)>35);assert.ok(enemy.anim>anim);assert.equal(enemy.sup.y,84);
    for(let frame=0;frame<10;frame++){e.updateEnemies();assert.equal(enemy.y,84);assert.equal(enemy.on,true);}
  }
});

test('第三关入场步兵随闪光冻结，双人快照保留走入阶段，Boss 战停止增援',()=>{
  const e=engine();e.play(3,true);e.G.en=[];e.G.camY=0;e.G.s3.rockT=9999;e.G.s3.runT=0;e.updateStage3();
  const enemy=e.G.en.find(q=>q.t==='run');assert.ok(enemy);e.updateEnemies();
  const before=JSON.stringify(enemy);e.G.freezeT=1;e.updateEnemies();assert.equal(JSON.stringify(enemy),before);
  const [world]=unpackWorld(JSON.parse(JSON.stringify(packWorld([e.G,e.solids]))));
  for(const key of ['x','y','vx','vy','on','anim'])assert.equal(world.en[0][key],enemy[key]);
  assert.deepEqual(world.en[0].waterfallEntry,{...enemy.waterfallEntry});
  e.G.freezeT=0;e.G.mech.active=true;e.G.s3.runT=0;
  const count=e.G.en.length;e.updateStage3();assert.equal(e.G.en.length,count);
});

test('第三关落石接近角色身高，降低频率并限制同屏数量，双人快照保留尺寸与翻滚状态',()=>{
  const e=engine();e.play(3,true);e.G.en=[];e.G.s3.runT=999;
  for(let i=0;i<12;i++){
    e.G.en=[];e.G.s3.rockT=0;e.updateStage3();
    const rock=e.G.en.find(q=>q.t==='rock');assert.ok(rock);
    assert.ok(rock.r>=13&&rock.r<=16);assert.equal(rock.hp,3);assert.equal(rock.waterfallRock,true);
    assert.ok(rock.x-rock.r>0&&rock.x+rock.r<384);assert.ok(e.G.s3.rockT>=3.6&&e.G.s3.rockT<=5.2);
    assert.equal(rock.spinDir,rock.vx<0?-1:1);
  }
  const rock=e.G.en[0];e.G.en.push({...rock,x:rock.x+34});e.G.s3.rockT=0;e.updateStage3();
  assert.equal(e.G.en.filter(q=>q.t==='rock'&&!q.dead).length,2);
  const [world]=unpackWorld(JSON.parse(JSON.stringify(packWorld([e.G,e.solids]))));
  for(let i=0;i<2;i++)for(const key of ['r','rot','spinDir','vx','vy','waterfallRock'])assert.equal(world.en[i][key],e.G.en[i][key]);
  const timer=e.G.s3.rockT;e.G.freezeT=1;e.updateStage3();assert.equal(e.G.s3.rockT,timer);
});

test('第三关大落石在垂直下落时仍翻滚，朝运动方向旋转并随闪光冻结，反弹后腾出路线',()=>{
  const e=engine();e.play(3,false);e.G.podTrig=[];e.G.spawnT=999;
  const boulder=(vx,spinDir=1)=>({t:'rock',waterfallRock:true,x:208,y:-100,r:16,vx,vy:0,rot:.4,spinDir,hp:3,bounce:0,flash:0});
  for(const [vx,spinDir,direction]of [[-12,1,-1],[12,-1,1],[0,-1,-1],[0,1,1]]){
    const rock=boulder(vx,spinDir);e.G.en=[rock];e.updateEnemies();assert.equal(Math.sign(rock.rot-.4),direction);
    const before=JSON.stringify(rock);e.G.freezeT=1;e.updateEnemies();assert.equal(JSON.stringify(rock),before);e.G.freezeT=0;
  }
  const legacy={...boulder(0),waterfallRock:false,r:8};e.G.en=[legacy];e.updateEnemies();assert.equal(legacy.rot,.4);
  const rock={...boulder(0),x:202,y:131,vy:90};e.G.en=[rock];e.updateEnemies();
  assert.equal(rock.y,132);assert.equal(rock.bounce,1);assert.ok(rock.vy<0);assert.equal(rock.spinDir,Math.sign(rock.vx));
  Object.assign(rock,{x:202,y:131,vy:90,bounce:2});e.updateEnemies();assert.ok(rock.y>132);assert.equal(rock.bounce,2);
  Object.assign(rock,{x:1,y:-100,vx:-12});e.updateEnemies();assert.equal(rock.x,20);assert.equal(rock.vx,12);assert.equal(rock.spinDir,1);
  Object.assign(rock,{x:383,vx:12});e.updateEnemies();assert.equal(rock.x,364);assert.equal(rock.vx,-12);assert.equal(rock.spinDir,-1);
});

test('第三关大落石的外缘可被子弹命中，三发击碎，防落石头盔仍保护两名玩家',()=>{
  const e=engine();e.play(3,false);e.G.en=[];e.G.eb=[];
  const rock={t:'rock',waterfallRock:true,x:220,y:120,r:16,vx:0,vy:0,rot:0,spinDir:1,hp:3,bounce:0,flash:0};e.G.en=[rock];
  for(let hit=1;hit<=3;hit++){
    e.G.pb=[{k:'b',x:rock.x+rock.r-1,y:rock.y-rock.r,vx:-270,vy:0,dmg:1}];e.collide();
    assert.equal(rock.hp,3-hit);assert.equal(!!rock.dead,hit===3);
  }
  for(const slot of [1,2]){
    const team=engine();team.play(3,true);team.G.en=[];team.G.eb=[];team.G.pb=[];
    const actor=slot===1?team.G.p:team.G.p2;Object.assign(actor,{x:220,y:120,invT:0,helmT:5});
    const hazard={...rock,dead:false,hp:3};team.G.en=[hazard];team.collide();
    assert.equal(hazard.dead,true);assert.equal(actor.dead,false);assert.equal(actor.helmT,5);
  }
});

test('第三关普通士兵与炮台每轮只发一枚水平弹，保留较长射击间隔',()=>{
  const e=engine();e.play(3,false);e.G.en=[];e.G.podTrig=[];e.G.spawnT=9999;
  const sniper={t:'snp',x:280,y:84,hp:1,fireT:0,face:-1,ax:-1,ay:0,flash:0};
  const turret={t:'tur',x:320,y:104,hp:5,idx:6,rotT:0,fireT:0,flash:0};
  e.G.en=[sniper,turret];e.G.p.y=170;e.updateEnemies();
  assert.equal(e.G.eb.length,2);for(const b of e.G.eb)assert.equal(b.vy,0);
  assert.ok(sniper.fireT>=3.4);assert.ok(turret.fireT>=3.2);
});

test('第三关门卫先拆两侧火球器，张嘴才能受伤，击破后必须走入洞口才通关',()=>{
  const e=engine();e.play(3,false);e.G.en=[];e.G.podTrig=[];e.G.camY=waterfall.STAGE_THREE.top;
  Object.assign(e.G.p,{x:88,y:waterfall.STAGE_THREE.summit,onGround:true,invT:999});e.updateStage3();
  const boss=e.G.mech,[left,right,core]=boss.parts;assert.equal(boss.active,true);
  const fire=(part,damage=100)=>{e.G.pb=[{k:'b',x:part.x+part.w/2,y:part.y+part.h/2,vx:0,vy:-270,dmg:damage}];e.collide();};
  fire(core);assert.equal(core.hp,core.max);assert.ok(!boss.open);
  const homing=e.findTarget(192,waterfall.STAGE_THREE.top+135);assert.ok(homing.x<181||homing.x>203);
  fire(left);fire(right);assert.equal(waterfall.waterfallNodesAlive(boss),false);
  fire(core);assert.equal(core.hp,core.max);
  for(let i=0;i<45;i++)e.updateStage3();assert.equal(boss.open,true);
  fire(core);assert.equal(boss.dead,true);assert.equal(e.G.eb.length,0);
  for(let i=0;i<170;i++)e.updateStage3();assert.equal(boss.exitOpen,true);assert.equal(e.G.mode,'play');
  e.K.KeyD=true;for(let i=0;i<180&&e.G.mode==='play';i++)e.step();
  assert.equal(e.G.mode,'clear');assert.equal(e.G.p.summitEntered,true);assert.equal(e.G.stage,3);
  assert.equal(e.element('btnNext').hidden,false);
});

test('第三关山顶仍可上举枪用真实子弹命中弱点，双人通关等待两人进入',()=>{
  const e=engine();e.play(3,true);e.G.en=[];e.G.podTrig=[];e.G.camY=waterfall.STAGE_THREE.top;
  for(const p of [e.G.p,e.G.p2])Object.assign(p,{y:waterfall.STAGE_THREE.summit,onGround:true,invT:999});
  e.G.p2.x=300;e.updateStage3();const boss=e.G.mech;e.G.freezeT=2;
  e.G.p.x=boss.parts[0].x+boss.parts[0].w/2;
  e.K.KeyW=e.K.KeyJ=true;ticks(e,70);assert.ok(boss.parts[0].hp<14);assert.equal(e.G.p.ay,-1);
  e.K.KeyW=e.K.KeyJ=false;
  e.G.freezeT=0;
  boss.dead=true;boss.deadT=0;boss.exitOpen=true;boss.parts.forEach(p=>p.hp=0);e.G.eb=[];
  e.G.p.x=192;ticks(e,80);assert.equal(e.G.p.summitEntered,true);assert.equal(e.G.mode,'play');
  for(let i=0;i<150&&e.G.mode==='play';i++){e.coop.remote.push(encodeInput({left:true}));e.step();}
  assert.equal(e.G.mode,'clear');assert.equal(e.G.p2.summitEntered,true);
});

test('第三关链臂分节弯曲且两侧错相，弱点与爪心同位，炮弹从爪心发射',()=>{
  const e=engine();e.play(3,false);e.G.en=[];e.G.camY=waterfall.STAGE_THREE.top;
  Object.assign(e.G.p,{x:190,y:waterfall.STAGE_THREE.summit,onGround:true,invT:99});e.updateStage3();
  const boss=e.G.mech,initial=boss.parts.map(p=>[p.x,p.y]);boss.parts[0].fireT=0;boss.parts[1].fireT=999;e.G.eb=[];
  e.updateStage3();const shot=e.G.eb[0],node=boss.parts[0];
  assert.equal(shot.r,5,'放大的环形火球同步扩大有效半径');
  assert.equal(shot.cx,node.x+node.w/2);assert.equal(shot.cy,node.y+node.h/2);
  for(const age of [0,.5,1,2,3,4,6]){
    boss.age=age;waterfallArms.updateWaterfallArms(boss,waterfall.STAGE_THREE.top);
    const poses=[-1,1].map(side=>waterfallArms.waterfallArmPose(side,age,waterfall.STAGE_THREE.top));
    for(const [i,pose]of poses.entries()){
      const part=boss.parts[i];assert.ok(Math.abs(part.x+part.w/2-pose.tip.x)<1e-9);assert.ok(Math.abs(part.y+part.h/2-pose.tip.y)<1e-9);
      for(let n=1;n<pose.points.length;n++)assert.ok(Math.abs(Math.hypot(pose.points[n].x-pose.points[n-1].x,pose.points[n].y-pose.points[n-1].y)-waterfallArms.WATERFALL_ARMS.links[n-1])<1e-8);
    }
    assert.ok(Math.abs(poses[0].tip.y-poses[1].tip.y)>1,'arms have different swing phases');
  }
  assert.notDeepEqual(boss.parts.map(p=>[p.x,p.y]),initial);
  const age=boss.age;e.G.freezeT=1;e.updateStage3();assert.equal(boss.age,age);
  boss.parts[0].hp=0;const boxes=waterfallArms.waterfallArmBoxes(boss,waterfall.STAGE_THREE.top);
  assert.equal(boxes.length,waterfallArms.WATERFALL_ARMS.links.length);assert.ok(boxes.every(b=>b.x>192));
});

test('第三关单双人中央二段跳实际穿过本体弱点，不会因贴到 Boss 本体死亡',()=>{
  for(const online of [false,true])for(const slot of online?[1,2]:[1])for(const phase of ['arms','mouth']){
    const e=engine();e.play(3,online);e.G.en=[];e.G.podTrig=[];e.G.camY=waterfall.STAGE_THREE.top;
    const boss=e.G.mech;boss.active=true;boss.age=phase==='mouth'?.9:1.2;boss.fireT=999;
    for(const part of boss.parts.slice(0,2)){part.fireT=999;if(phase==='mouth')part.hp=0;}
    const p=slot===1?e.G.p:e.G.p2;
    Object.assign(p,{x:192,y:waterfall.STAGE_THREE.summit,vx:0,vy:0,onGround:true,
      support:e.solids.find(s=>s.summit),invT:0,shieldT:0});
    if(online){const other=slot===1?e.G.p2:e.G.p;Object.assign(other,{x:212,y:p.y,onGround:true});}
    let crossedCore=false;
    for(let frame=0;frame<100;frame++){
      const jump=frame===2||frame===23;
      if(slot===1)e.K.KeyK=jump;else e.coop.remote.push(encodeInput({jump}));
      e.step();
      assert.equal(p.dead,false,JSON.stringify({online,slot,phase,frame,y:p.y}));
      assert.equal(p.invT,0);assert.equal(p.shieldT,0);
      const box=e.pBox(p),core=boss.parts[2];
      if(box.x<core.x+core.w&&box.x+box.w>core.x&&box.y<core.y+core.h&&box.y+box.h>core.y)crossedCore=true;
      if(frame>23&&p.onGround)break;
    }
    assert.ok(crossedCore,'the real jump must overlap the core, not just stay below it');
    assert.equal(p.onGround,true);assert.equal(p.y,waterfall.STAGE_THREE.summit);assert.equal(e.G.deaths,0);
  }
});

test('第三关 Boss 火球仍会命中两名玩家，本体安全不会使玩家免疫弹丸',()=>{
  for(const slot of [1,2]){
    const e=engine();e.play(3,true);e.G.en=[];
    const p=slot===1?e.G.p:e.G.p2,other=slot===1?e.G.p2:e.G.p;
    Object.assign(p,{x:192,y:waterfall.STAGE_THREE.summit,invT:0,shieldT:0});other.x=250;
    e.G.eb=[{waterfallFire:true,x:p.x,y:p.y-14,r:4,vx:0,vy:0}];
    e.collide();assert.equal(p.dead,true);assert.equal(other.dead,false);assert.equal(e.G.deaths,1);
  }
});

test('第三关银灰链臂与爪心的接触范围跟随关节运动，两名角色都能被触碰命中',()=>{
  for(const slot of [1,2])for(const contact of ['link','claw']){
    const e=engine();e.play(3,true);e.G.en=[];e.G.mech.active=true;e.G.mech.age=1.3;
    const pose=waterfallArms.waterfallArmPose(-1,e.G.mech.age,waterfall.STAGE_THREE.top);
    const joint=contact==='claw'?pose.tip:pose.points[2];
    const p=slot===1?e.G.p:e.G.p2;Object.assign(p,{x:joint.x,y:joint.y+13,invT:0,onGround:false});
    e.updateStage3();assert.equal(p.dead,true);assert.equal(slot===1?e.G.p2.dead:e.G.p.dead,false);
  }
});

test('第三关结算在主客机均开放第四关入口并保留重玩',()=>{
  const host=engine(),guest=engine();host.play(3,true);guest.play(3,true);guest.coop.role='guest';
  host.stageClear();
  assert.equal(host.G.stage,3);assert.equal(host.G.mode,'clear');
  guest.coop.callbacks.state(JSON.parse(JSON.stringify(packWorld([host.G,host.solids,host.BRIDGES,host.SET]))));
  for(const e of [host,guest]){
    assert.equal(e.element('btnNext').hidden,false);assert.equal(e.element('btnNext').textContent,'进入第四关');assert.equal(e.element('clearTitle').textContent,'关卡完成');
    assert.equal(e.G.stage,3);
  }
});

test('真实引擎第一关固定摇滚，旧唱片设置无法覆盖；换关使用对应原声',()=>{
  const e=engine();assert.equal(e.SET.stageMusic,undefined);
  e.SET.stageMusic={1:'orchestral',2:'random'};e.play(1,false);assert.equal(e.inspect().audio.resolved.track,'stage1rock');
  e.G.mode='cine';e.G.cine={kind:'open'};assert.equal(e.inspect().audio.resolved.track,'stage1rock');
  e.play(2,false);assert.equal(e.inspect().audio.resolved.track,'stage2');
  e.loadRoom(3);e.Music.sync();assert.equal(e.inspect().audio.resolved.track,'stage2boss');
  e.G.mode='pause';e.Music.sync();assert.equal(e.inspect().audio.resolved.track,null);
  e.G.mode='play';e.Music.start(true);assert.equal(e.inspect().audio.resolved.track,'stage2boss');
});

test('客机保留本机音乐开关，同步房间后使用正确中枢原声，不创建随机曲目',()=>{
  const host=engine(),guest=engine();host.play(2,true);guest.play(2,true);guest.coop.role='guest';
  host.SET.music='off';guest.SET.music='on';
  const sync=()=>guest.coop.callbacks.state(JSON.parse(JSON.stringify(packWorld([host.G,host.solids,host.BRIDGES,host.SET]))));
  sync();assert.equal(guest.SET.music,'on');assert.equal(guest.inspect().audio.resolved.track,'stage2');
  host.loadRoom(3);sync();assert.equal(guest.inspect().audio.resolved.track,'stage2boss');
  host.G.mode='pause';sync();assert.equal(guest.inspect().audio.resolved.track,null);
  host.G.mode='play';sync();assert.equal(guest.inspect().audio.resolved.track,'stage2boss');assert.equal(guest.SET.stageMusic,undefined);
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

test('前五关全屏与高像素密度不生成 4K 旧背景，其他关卡按对应分辨率恢复背景', () => {
  const e = engine(); e.play(1, false); e.resizeWindow(1920, 1100); e.render();
  assert.deepEqual([...e.resolution().canvas], [1920, 1080]);
  e.resizeWindow(1920, 1100, 2); e.render();
  assert.deepEqual([...e.resolution().canvas], [3840, 2160]);
  assert.equal(e.resolution().backgrounds, 0, 'stage 1 does not allocate unused legacy backdrops');
  e.play(2, false); e.render();
  assert.deepEqual([...e.resolution().canvas], [3840, 2160]);
  assert.equal(e.resolution().backgrounds,0,'stage 2 has independent HD artwork');
  e.play(3,false);e.render();
  assert.deepEqual([...e.resolution().canvas], [3840, 2160]);
  assert.equal(e.resolution().backgrounds,0,'stage 3 reuses HD actors without building legacy backdrops');
  e.play(4,false);e.render();assert.deepEqual([...e.resolution().canvas],[3840,2160]);assert.equal(e.resolution().backgrounds,0);
  e.play(1, false); e.resizeWindow(768, 448); e.render();
  assert.deepEqual([...e.resolution().canvas], [768, 432]);
  e.play(3, false); e.render();
  assert.equal(e.resolution().backgrounds,0);
  e.play(5,false);e.render();assert.equal(e.resolution().backgrounds,0);
  e.play(6,false);e.render();assert.equal(e.resolution().backgrounds,2);
  assert.deepEqual([...e.resolution().sky],[768,432]);
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

test('第二、四关高清敌兵枪口与命中范围同步',()=>{
  for(const stage of [2,4]){
    const e=engine();e.play(stage,false);const B=e.G.base;
    B.spawned=B.def.sol;B.rolled=B.def.rol;B.rol=[];B.targets.forEach(t=>t.fireT=999);e.G.eb=[];
    B.sol=[{u:0,z:.5,st:'aim',t:0,anim:0}];e.G.p.invT=999;
    e.step();const shot=e.G.eb.find(b=>b.x0===192);assert.ok(shot);
    const height=BASE_SOLDIER.muzzleHeight*baseSoldierScale(.5);
    assert.ok(Math.abs(shot.y0-(204-64*.5-height))<.0001,'shot begins at the visible barrel');
    const soldier=B.sol[0];soldier.st='aim';soldier.t=999;
    e.G.pb=[{k:'b',owner:1,t:.49,spd:.6,x0:201.5,y0:166,xe:201.5,ye:129,dmg:1}];
    e.step();assert.equal(!!soldier.dead,true,'visible body matches its hit box');
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
    assert.equal(e.G.stage,3);assert.equal(e.G.mode,'intro');
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

test('普通走廊保持原瞄准方式，关底移动和跳跃举枪时枪口仍与姿势对齐',()=>{
  for(const room of [0,1,2]){
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

test('第二关上排装置可站立举枪命中，六种武器与双方输入保持一致，松开上键打下排',()=>{
  for(const mode of ['solo','host','guest'])for(const weapon of ['rifle','machine','spread','laser','fire','homing']){
    const e=quietBaseRoom(3,mode!=='solo'),B=e.G.base,p=mode==='guest'?e.G.p2:e.G.p;
    e.G.freezeT=999;
    const upper=B.targets.find(t=>t.y===91&&t.x===177),lower=B.targets.find(t=>t.y===119&&t.x===177);
    upper.hp=lower.hp=999;
    Object.assign(p,{x:192,y:204,onGround:true,vy:0,weapon,cool:0});e.G.pb=[];
    const input=up=>{if(mode==='guest')e.coop.remote.push(encodeInput({up,fire:true}));else{e.K.KeyW=up;e.K.KeyJ=true;}e.step();};
    input(true);assert.equal(p.aimUp,true);assert.equal(p.onGround,true);
    const shot=e.G.pb.find(b=>b.owner===p.pid),muzzle=baseUpMuzzle(p,mode==='host'?'red':'blue');
    assert.ok(shot.upward);assert.equal(shot.ye,100);assert.equal(shot.x0,muzzle.x);assert.equal(shot.y0,muzzle.y);
    for(let i=0;i<90;i++)input(true);
    assert.ok(upper.hp<999,mode+' '+weapon+' damages upper row while standing');assert.equal(lower.hp,999);
    const snapshot=unpackWorld(JSON.parse(JSON.stringify(packWorld(e.G))));assert.equal((mode==='guest'?snapshot.p2:snapshot.p).aimUp,true);
    p.cool=0;e.G.pb=[];input(false);assert.equal(p.aimUp,false);assert.ok(e.G.pb.filter(b=>b.owner===p.pid).every(b=>b.ye===(weapon==='homing'?128:129)));
    for(let i=0;i<90;i++)input(false);assert.ok(lower.hp<999,'normal fire returns to the lower row');
  }
});

test('第四关关底装置阶段举枪可直接命中高位装置，关闭护板仍阻挡弹丸',()=>{
  const e=engine();e.play(4,false);e.loadRoom(4);e.SET.autofire='on';e.G.freezeT=999;e.G.p.invT=999;
  const upper=e.G.base.targets.find(t=>t.id==='upper');upper.hp=999;upper.aperture=0;
  e.K.KeyW=e.K.KeyJ=true;ticks(e,90);assert.equal(e.G.p.aimUp,true);assert.equal(upper.hp,999);
  upper.aperture=1;ticks(e,90);assert.ok(upper.hp<999);assert.equal(e.G.p.y,204);
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

test('中枢摧毁后等待角色进入任意一侧升降梯，全尺寸升到顶部后进入第三关',()=>{
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
    assert.equal(e.G.stage,3);assert.equal(e.G.mode,'intro');assert.equal(e.G.p.weapon,'laser');
    assert.equal(e.G.score,score);assert.equal(e.G.lives,lives);assert.deepEqual(Array.from(e.G.inv),['u']);
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
  assert.equal(e.G.stage,3);assert.equal(e.G.mode,'intro');assert.ok(e.G.p2);assert.equal(e.G.p2.y,waterfall.STAGE_THREE.bottom);
});

test('第二、四关各房间在普通波次间生成红色补给兵，每个携带一种装备',()=>{
  for(const stage of [2,4])for(const room of [0,1,2]){
    const e=quietBaseRoom(room);
    if(stage===4){e.play(4,false);e.loadRoom(room);e.G.p.invT=999;}
    const B=e.G.base,carriers=[];B.spawned=0;B.targets.forEach(t=>t.fireT=999);B.rolled=999;
    for(let wave=1;wave<=B.def.sol;wave++){
      B.sol=[];B.spawnT=0;e.step();const soldier=B.sol[0];assert.ok(soldier);
      if(soldier.dropKind){carriers.push({wave,kind:soldier.dropKind});assert.equal(soldier.st,'walk');}
    }
    assert.deepEqual(carriers,[...B.def.supply].map((kind,i)=>({wave:2+i*3,kind})));
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

test('第二、四关开门与自动清场不生成装备，已击落的物品保留原地',()=>{
  for(const stage of [2,4]){
    const e=quietBaseRoom();if(stage===4){e.play(4,false);e.G.p.invT=999;}
    const B=e.G.base;B.spawned=B.def.sol;B.rolled=999;B.targets.forEach(t=>{if(t.k!=='core')t.hp=0;});
    B.sol=[{u:100,z:.1,st:'charge',anim:0,dropKind:'L'}];
    const item={base:true,x:280,y:204,vy:0,rest:true,kind:'S',fromSoldier:true};e.G.items=[item];
    e.G.pb=[{k:'b',t:.99,spd:1.8,x0:192,y0:166,xe:192,ye:129,dmg:12}];e.step();
    assert.equal(B.cleared,true);assert.equal(e.G.items.length,1);
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
  const fourth=engine();fourth.play(4,false);assert.ok(fourth.G.base.targets.some(t=>t.k==='switch'));
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

test('第二关上方弹道会越过站在下方的敌兵，第四关同样使用跳跃投影高度',()=>{
  for(const elevated of [false,true]){
    const e=quietBaseRoom(),soldier={u:0,z:.5,st:'aim',t:99,anim:0};e.G.base.sol=[soldier];
    e.G.pb=[{k:'b',owner:1,t:.49,spd:.6,x0:192,y0:elevated?125:166,xe:192,ye:elevated?89:129,dmg:1}];
    e.step();assert.equal(!!soldier.dead,!elevated);assert.equal(!!e.G.pb[0],elevated);
  }
  assert.ok(baseShotHeight({y:150},4)<90);assert.ok(baseShotHeight({y:150},2)<90);
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
