import test from 'node:test';
import assert from 'node:assert/strict';
import { riverFishJumps } from '../../games/contra2026/js/river-fish.mjs';

const banks=Object.freeze([Object.freeze({x:0,y:112,w:3334,h:104,g:1})]);

test('河鱼偶尔出现，每个视野同时最多一条，首个跃起前保持安静',()=>{
  assert.deepEqual(riverFishJumps(5.9,0,banks),[]);
  for(const camera of [0,127,255,512,1100,1734,2950]){
    let visible=0;
    for(let tick=0;tick<1800;tick++){
      const events=riverFishJumps(tick/10,camera,banks);
      assert.ok(events.length<=1);visible+=events.length;
    }
    assert.ok(visible>0&&visible<1800*.2,'ambient leaps remain occasional');
  }
});

test('河鱼留在同一世界轨迹，滚动、暂停及相同快照时间不会重排',()=>{
  const first=riverFishJumps(6.45,0,banks);
  assert.equal(first.length,1);
  assert.deepEqual(riverFishJumps(6.45,35,banks),first);
  assert.deepEqual(riverFishJumps(6.45,0,banks),first);
  const later=riverFishJumps(6.6,0,banks)[0];
  assert.equal(later.start,first[0].start);assert.equal(later.end,first[0].end);
  assert.notEqual(later.x,first[0].x);
});

test('放大的河鱼跃过前景岸脚，轨迹完整回到水面，落水后只留水花',()=>{
  const first=riverFishJumps(6,0,banks)[0];
  assert.ok(first);
  assert.equal(first.width,22);
  assert.ok(first.duration>=1.2&&first.duration<1.4);
  const peak=riverFishJumps(6+first.duration/2,0,banks)[0];
  assert.ok(peak.y<peak.shoreline-18,'the fish is clearly visible above the river bank foot');
  assert.ok(peak.surface-peak.y>=30,'a full, visible leap rather than a low skim');
  assert.ok(Math.abs(peak.angle)<1e-12);
  for(let step=0;step<=100;step++){
    const time=6+first.duration*step/100,event=riverFishJumps(time,0,banks)[0];
    assert.ok(event);
    assert.ok(event.y<=event.surface&&event.y>=event.surface-event.height);
    assert.ok(event.x>=Math.min(event.start,event.end)&&event.x<=Math.max(event.start,event.end));
  }
  const open=riverFishJumps(6.4,0,[])[0];
  assert.ok(open.height>=34);
  const landed=riverFishJumps(6+first.duration+.1,0,banks)[0];
  assert.equal(landed.airborne,false);assert.equal(landed.x,landed.end);assert.equal(landed.y,landed.surface);
  assert.deepEqual(riverFishJumps(6+first.duration+.51,0,banks),[]);
});
