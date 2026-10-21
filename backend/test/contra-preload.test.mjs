import test from 'node:test';
import assert from 'node:assert/strict';
import { ResourcePreloader, gameResourceJobs } from '../../games/contra2026/js/resource-preloader.mjs';
import { StageOneArt } from '../../games/contra2026/js/stage-one-art.mjs';
import { ReferenceMusic } from '../../games/contra2026/js/reference-music.mjs';

const deferred = () => { let resolve, reject; const promise = new Promise((yes,no) => {resolve=yes;reject=no;}); return {promise,resolve,reject}; };

test('已经开始的图片与字体独立更新进度，不被队列中的慢资源挡住',async()=>{
  const slow=deferred(),image=deferred();
  const loader=new ResourcePreloader([{id:'slow',load:()=>slow.promise},{id:'image',eager:true,load:()=>image.promise},{id:'fonts',eager:true,load:async()=>{}}],{concurrency:1});
  const loading=loader.load();image.resolve();await new Promise(setImmediate);
  assert.equal(loader.inspect().loaded,2);assert.equal(loader.ready,false);
  slow.resolve();await loading;assert.equal(loader.ready,true);
});

test('所有资源完成前不就绪，并发上限有效，同一资源只加载一次，后续开局复用',async()=>{
  const gates=Array.from({length:5},deferred), calls=[];
  const loader=new ResourcePreloader(gates.map((gate,id)=>({id,load:()=>{calls.push(id);return gate.promise;}})),{concurrency:2});
  const states=[],first=loader.load(state=>states.push(state.loaded)),second=loader.load();
  await Promise.resolve(); assert.deepEqual(calls,[0,1]);assert.equal(loader.ready,false);
  gates[0].resolve();await new Promise(setImmediate);assert.deepEqual(calls,[0,1,2]);
  gates[1].resolve();gates[2].resolve();await new Promise(setImmediate);assert.deepEqual(calls,[0,1,2,3,4]);
  gates[3].resolve();await new Promise(setImmediate);assert.equal(loader.ready,false);
  gates[4].resolve();await Promise.all([first,second]);assert.equal(loader.ready,true);
  assert.ok(states.every((value,index)=>index===0||value>=states[index-1]));
  await loader.load();assert.equal(calls.length,5);assert.equal(loader.inspect().loaded,5);
});

test('网络失败或超时不允许开始，重试只补失败资源',async()=>{
  let failedCalls=0,successfulCalls=0;
  const loader=new ResourcePreloader([{id:'good',load:async()=>{successfulCalls++;}},
    {id:'retry',load:async({retry})=>{failedCalls++;if(!retry)throw Error('offline');}},
    {id:'timeout',load:({retry})=>retry?Promise.resolve():new Promise(()=>{})}],{timeout:15});
  await assert.rejects(loader.load(),/部分资源/);assert.equal(loader.ready,false);
  assert.deepEqual(new Set(loader.inspect().failed),new Set(['retry','timeout']));
  await loader.load();assert.equal(loader.ready,true);assert.equal(successfulCalls,1);assert.equal(failedCalls,2);
});

test('图片解码完成才就绪，失败后重试，不覆盖另一张已经加载的图片',async()=>{
  const images=[],decoded=deferred();
  const art=new StageOneArt({createCanvas:()=>({getContext:()=>({})}),imageFactory:()=>{const image={};images.push(image);return image;},assets:{actor:'actor.webp',tree:'tree.webp'}});
  images[0].decode=()=>decoded.promise;
  images[0].onload();images[1].onerror();assert.equal(art.ready,false);
  const actor=art.loadImage('actor');decoded.resolve();await actor;
  assert.equal(art.loaded.has('actor'),true);assert.equal(art.ready,false);
  const tree=art.loadImage('tree',{retry:true});assert.equal(images.length,3);
  images[2].onload();await tree;assert.equal(art.ready,true);assert.deepEqual(art.failed,[]);
  await art.loadImage('actor',{retry:true});assert.equal(images.length,3);
});

test('两关共用图片只计一次，并等待双方渲染器和所有音轨、唱片图',async()=>{
  const imageA=deferred(),imageB=deferred(),music=deferred();
  const jobs=gameResourceJobs({arts:[{assets:{one:'shared.webp'},loadImage:()=>imageA.promise},{assets:{two:'shared.webp'},loadImage:()=>imageB.promise}],
    imageFactory:()=>({set src(value){if(value)queueMicrotask(()=>this.onload());}}),cover:'cover.webp',records:['cover.webp','disc.svg','disc.svg'],
    tracks:{song:{}},music:{prefetch:()=>music.promise}});
  assert.equal(jobs.length,5);
  const loader=new ResourcePreloader(jobs),loading=loader.load();imageA.resolve();music.resolve();
  await new Promise(setImmediate);assert.equal(loader.ready,false);
  imageB.resolve();await loading;assert.equal(loader.ready,true);
});

test('音乐预下载保持静音，不提前解码全部唱片；实际播放复用下载并保留编码缓存',async()=>{
  let fetches=0,decodes=0;const raw=new ArrayBuffer(4);
  const context={decodeAudioData:async data=>{decodes++;assert.notEqual(data,raw);return{duration:10};}};
  const music=new ReferenceMusic({getContext:()=>context,getOutput:()=>null,fetchAudio:async()=>{fetches++;return{ok:true,arrayBuffer:async()=>raw};}});
  await Promise.all([music.prefetch('stage1rock'),music.prefetch('stage1rock')]);
  assert.equal(fetches,1);assert.equal(decodes,0);assert.equal(music.inspect().playing,false);
  await music.load('stage1rock',context);await music.load('stage1rock',context);
  assert.equal(fetches,1);assert.equal(decodes,1);assert.equal((await music.prefetch('stage1rock')).byteLength,4);
});
