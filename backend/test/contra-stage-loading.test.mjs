import test from 'node:test';
import assert from 'node:assert/strict';
import { StageOneArt } from '../../games/contra2026/js/stage-one-art.mjs';
import { StageTwoArt } from '../../games/contra2026/js/stage-two-art.mjs';
import { StageThreeArt } from '../../games/contra2026/js/stage-three-art.mjs';
import { StageFourArt } from '../../games/contra2026/js/stage-four-art.mjs';
import { StageFiveArt } from '../../games/contra2026/js/stage-five-art.mjs';
import { stageResourceJobs } from '../../games/contra2026/js/stage-resources.mjs';
import { ResourcePreloader, musicResourceJobs } from '../../games/contra2026/js/resource-preloader.mjs';
import { fixedStageMusicKeys } from '../../games/contra2026/js/fixed-soundtrack.mjs';

function resources() {
  const images=[], music=[], cache=new Set();
  const options={createCanvas:()=>({getContext:()=>({})}),autoLoad:false,imageFactory:()=>({
    naturalWidth:0,
    set src(url){if(url){images.push(url);queueMicrotask(()=>{this.naturalWidth=64;this.onload();});}},
    decode:()=>Promise.resolve()
  })};
  const one=new StageOneArt(options), arts=[one,...[StageTwoArt,StageThreeArt,StageFourArt,StageFiveArt].map(Art=>new Art({...options,baseArt:one}))];
  const jobs=stage=>[...stageResourceJobs(stage,{arts,imageFactory:options.imageFactory,cover:'/cover.webp'}),
    ...musicResourceJobs({prefetch:async key=>music.push(key)},fixedStageMusicKeys(stage))];
  return {arts,images,music,cache,jobs,load:stage=>new ResourcePreloader(jobs(stage),{cache}).load()};
}

test('冷启动每关只请求本关画面和配乐；第一关不请求任何后续场景',async()=>{
  for(const stage of [1,2,3,4,5]){
    const r=resources();assert.equal(r.images.length+r.music.length,0,'building the plan must not request assets');
    const state=await r.load(stage);assert.equal(state.ready,true);assert.deepEqual(r.music,fixedStageMusicKeys(stage));
    const paths=r.images.map(url=>new URL(url,'https://game.test').pathname);
    for(const other of [1,2,3,4,5].filter(n=>n!==stage)){
      if(other===1||stage===4&&other===2)continue; // Shared atlases keep their original URLs.
      assert.ok(paths.every(path=>!path.includes('/stage'+other+'/')||stage===2&&path.endsWith('/stage4/breached-passage.webp')),paths.join('\n'));
    }
    if(stage!==1)for(const name of ['night-jungle-strip','night-snow-mountains','fortress-hd','fortress-damage'])
      assert.ok(paths.every(path=>!path.includes(name)),name+' does not belong to this stage');
    if(stage===4)for(const name of ['corridor-hd','corridor-power','corridor-armory','corridor-command','control-wall-hd'])
      assert.ok(paths.every(path=>!path.includes(name)),name+' is unused in stage four');
    assert.equal(state.total,{1:21,2:20,3:24,4:18,5:25}[stage]);
    assert.ok(paths.every(path=>!path.includes('/commando-run-')),'the limb rig replaces full-body run downloads');
  }
});

test('顺序过关复用人物和机关图集，跨关缓存不会遗漏新渲染器；重玩零下载',async()=>{
  const r=resources();await r.load(1);const first=r.images.length;
  await r.load(2);assert.ok(r.images.length>first);const second=r.images.length;
  assert.equal(r.arts[1].images.environment,r.arts[0].images.environment);
  assert.equal(r.arts[3].images.rearBlue,r.arts[1].images.rearBlue,'future renderer adopts a shared image without a new request');
  await r.load(3);assert.equal(r.images.length-second,9,'only the nine waterfall images are new');
  const third=r.images.length;await r.load(4);assert.equal(r.images.length-third,3,'the passage and defense devices already loaded with stage two are reused');
  const fourth=r.images.length;await r.load(5);assert.equal(r.images.length-fourth,11,'equipment, saucer and explosions reuse the shared cache; only eleven snowfield images are new');
  assert.equal(new Set(r.images).size,r.images.length,'no duplicate network URL');
  const count=[r.images.length,r.music.length];
  for(const stage of [1,2,3,4,5])await r.load(stage);
  assert.deepEqual([r.images.length,r.music.length],count);
  assert.ok(r.arts.every(art=>art.ready));
});

test('失败和切换加载器后仍保留已完成资源，未完成的资源可以重试',async()=>{
  const cache=new Set();let portrait=0,song=0;
  const jobs=[{id:'image:portrait',eager:true,load:async()=>portrait++},
    {id:'music:stage3',load:async({retry})=>{song++;if(!retry)throw Error('offline');}}];
  const loader=new ResourcePreloader(jobs,{cache});
  await assert.rejects(loader.load());assert.deepEqual([...cache],['image:portrait']);
  await loader.load();assert.equal(portrait,1);assert.equal(song,2);
  await new ResourcePreloader([{id:'fonts',load:async()=>{}}],{cache}).load();
  await new ResourcePreloader(jobs,{cache}).load();assert.equal(portrait,1);assert.equal(song,2);
});
