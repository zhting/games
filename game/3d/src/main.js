import * as THREE from 'three';

/* ═══════════════ 常量 ═══════════════ */
const COLS = 10, ROWS = 20, DEPTH = 0.94;      // 世界单位：1 = 一格
// 高饱和糖果色（配合 Neutral 色调映射保持鲜艳）
const COLORS = [0xff4d6d, 0xff9024, 0xffd21f, 0x56d637, 0x29b6f6, 0xb85cff, 0xff70a6];

// 七种方块（基准格），旋转由代码生成
const BASE = {
  I:{n:4, c:[[0,1],[1,1],[2,1],[3,1]]},
  O:{n:2, c:[[0,0],[1,0],[0,1],[1,1]]},
  T:{n:3, c:[[0,1],[1,1],[2,1],[1,0]]},
  S:{n:3, c:[[1,0],[2,0],[0,1],[1,1]]},
  Z:{n:3, c:[[0,0],[1,0],[1,1],[2,1]]},
  J:{n:3, c:[[0,0],[0,1],[1,1],[2,1]]},
  L:{n:3, c:[[2,0],[0,1],[1,1],[2,1]]},
};
const TYPES = Object.keys(BASE);
const SHAPES = {};                              // SHAPES[t][rot] = cells
for (const t of TYPES){
  const n = BASE[t].n;
  let cur = BASE[t].c;
  SHAPES[t] = [cur];
  for (let r=1;r<4;r++){
    cur = cur.map(([x,y]) => [n-1-y, x]);       // 顺时针旋转
    SHAPES[t].push(cur);
  }
}

/* ═══════════════ 渲染器 / 场景 ═══════════════ */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;   // ACES 会压暗高饱和色，Neutral 保住糖果色
renderer.toneMappingExposure = 1.14;

const scene = new THREE.Scene();
// 摄影棚奶白背景：顶部微冷白到底部暖米色的无缝渐变（中性无色偏）
{
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0,0,0,256);
  g.addColorStop(0,'#fdfcfa'); g.addColorStop(.55,'#f6f0e6'); g.addColorStop(1,'#ece2d2');
  x.fillStyle = g; x.fillRect(0,0,2,256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  scene.background = t;
}
scene.fog = new THREE.Fog(0xf2ebdf, 48, 120);   // 地平线雾霭

// 自制摄影棚环境贴图：中性灰棚 + 白色柔光箱面板 ——
// 反光是稳定的长条柔光（糖果广告照的高光形态），且零色偏，果冻呈色只由自身决定
function studioEnvScene(){
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(30,30,30),
    new THREE.MeshBasicMaterial({color:new THREE.Color(.42,.42,.44), side:THREE.BackSide})));
  const panel = (w,h,x,y,z,ry,rx,r,g,b)=>{
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w,h),
      new THREE.MeshBasicMaterial({color:new THREE.Color(r,g,b)}));
    p.position.set(x,y,z); p.rotation.set(rx,ry,0);
    s.add(p);
  };
  panel(12,6,  0,11,0,  0,          Math.PI/2, 6,6,6);      // 顶部主柔光箱
  panel(4,10, -12,3,2,  Math.PI/2,  0,         5,5,5);      // 左侧长条灯
  panel(3,7,  12,2,-2, -Math.PI/2,  0,         3.5,3.5,3.5);// 右侧补光
  panel(10,3,  0,4,-13, 0,          0,         2.3,2.1,1.9);// 背面微暖条（轮辉）
  return s;
}
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(studioEnvScene(), .05).texture;

const camera = new THREE.PerspectiveCamera(40, innerWidth/innerHeight, 0.1, 200);
const camTarget = new THREE.Vector3(0, 9.2, 0);

// 灯光：明亮柔和的"厨房窗边"光 —— 暖阳投软影 + 粉白半球补光 + 冷调背光穿透果冻
const sun = new THREE.DirectionalLight(0xffffff, 2.7);
sun.position.set(9, 26, 15);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -9; sun.shadow.camera.right = 9;
sun.shadow.camera.top = 24;  sun.shadow.camera.bottom = -2;
sun.shadow.camera.far = 60;
sun.shadow.bias = -0.0006;
sun.shadow.radius = 5;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xffffff, 0xded2c0, .75));
const rim = new THREE.DirectionalLight(0xffffff, 1.0);   // 背光：从后上方打，穿透果冻
rim.position.set(-6, 18, -14);
scene.add(rim);

/* 卡通贴图工厂 */
function canvasTex(draw, w=256, h=256, rx=1, ry=1){
  const c = document.createElement('canvas'); c.width=w; c.height=h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 4;
  return t;
}
// 象牙白亚克力展示台：低粗糙度带出柔和倒影，果冻像摆在甜品摄影台上
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(70, 48),
  new THREE.MeshStandardMaterial({color:0xf6f0e5, roughness:.22, metalness:0, envMapIntensity:.7})
);
floor.rotation.x = -Math.PI/2; floor.position.y = -0.01;
floor.receiveShadow = true;
scene.add(floor);


// 开放式棋盘：不做背板 —— 果冻身后是均匀奶白背景与光晕（透射呈色只由果冻自身决定）
{
  // 淡淡的参考网格线
  const pts = [];
  for (let x=0;x<=COLS;x++) pts.push(x-COLS/2,0,0, x-COLS/2,ROWS,0);
  for (let y=0;y<=ROWS;y++) pts.push(-COLS/2,y,0, COLS/2,y,0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts,3));
  const grid = new THREE.LineSegments(g, new THREE.LineBasicMaterial({color:0x9a8c78, transparent:true, opacity:.13}));
  grid.position.z = -DEPTH/2 - 0.04;
  scene.add(grid);
  // 顶部虚线警戒线（参考图的白色虚线）
  const dg = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-COLS/2-1.4, ROWS, .2), new THREE.Vector3(COLS/2+1.4, ROWS, .2)]);
  const dl = new THREE.Line(dg, new THREE.LineDashedMaterial({
    color:0xc9a37c, dashSize:.4, gapSize:.28, transparent:true, opacity:.9}));
  dl.computeLineDistances();
  scene.add(dl);
}


// ═══ 装饰层：全部用不参与光照的材质（Basic/Sprite），呈色稳定性零破坏 ═══

// ① 糖纸背景板：四色粉彩对角渐变 + 白波点 + 糖针碎图案 ——
//    就在果冻正后方，透射会把图案折射扭曲地"透"出来（透明感的最佳展示物）
{
  const c = document.createElement('canvas'); c.width = 512; c.height = 768;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 512, 768);
  g.addColorStop(0,'#ffe7ee'); g.addColorStop(.34,'#fff3df');
  g.addColorStop(.67,'#e5f6ea'); g.addColorStop(1,'#e7eefc');
  x.fillStyle = g; x.fillRect(0,0,512,768);
  // 白色大波点（错位排列）
  x.fillStyle = 'rgba(255,255,255,.5)';
  for (let gy=0; gy<10; gy++) for (let gx=0; gx<7; gx++){
    x.beginPath();
    x.arc(gx*76+38+(gy%2)*38, gy*76+38, 15, 0, Math.PI*2);
    x.fill();
  }
  // 糖针碎：随机角度的粉彩小短棒
  const sp = ['#ffb3c8','#ffd98e','#a9e8c0','#b8cdf9','#e6c3f2'];
  for (let i=0;i<210;i++){
    x.save();
    x.translate(Math.random()*512, Math.random()*768);
    x.rotate(Math.random()*Math.PI);
    x.strokeStyle = sp[i%5]; x.lineWidth = 5; x.lineCap = 'round';
    x.globalAlpha = .85;
    x.beginPath(); x.moveTo(-9,0); x.lineTo(9,0); x.stroke();
    x.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(COLS+15, ROWS+10),
    new THREE.MeshBasicMaterial({map:t}));
  wall.position.set(0, ROWS/2+1.5, -6.5);
  scene.add(wall);
}

// ② 地面粉彩光环：棋盘四周一圈柔和的渐变色晕
{
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128,128,46, 128,128,127);
  g.addColorStop(0,'rgba(255,255,255,0)');
  g.addColorStop(.45,'rgba(255,214,229,.5)');
  g.addColorStop(.75,'rgba(255,236,209,.34)');
  g.addColorStop(1,'rgba(230,238,252,0)');
  x.fillStyle = g; x.fillRect(0,0,256,256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(52,52),
    new THREE.MeshBasicMaterial({map:t, transparent:true, depthWrite:false}));
  ring.rotation.x = -Math.PI/2; ring.position.y = .01;
  scene.add(ring);
}

// ③ 浮动虚化光斑：远景的糖果色 bokeh（始终面向相机的柔圆 Sprite）
{
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32,32,2, 32,32,31);
  g.addColorStop(0,'rgba(255,255,255,.9)'); g.addColorStop(.55,'rgba(255,255,255,.35)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle = g; x.beginPath(); x.arc(32,32,31,0,Math.PI*2); x.fill();
  const dot = new THREE.CanvasTexture(c);
  const bc = [0xffc2d4, 0xffe0a3, 0xbfe9cd, 0xc4d4fb, 0xecc9f5];
  for (let i=0;i<14;i++){
    const m = new THREE.SpriteMaterial({map:dot, color:bc[i%5], transparent:true,
      opacity:.28+Math.random()*.22, depthWrite:false});
    const sp2 = new THREE.Sprite(m);
    const sc = 1.2 + Math.random()*2.4;
    sp2.scale.set(sc, sc, 1);
    sp2.position.set((13.5+Math.random()*9)*(Math.random()<.5?-1:1), 2.5+Math.random()*18, -4-Math.random()*8);
    scene.add(sp2);
  }
}

// ④ 台面糖针碎：散落在展示台上的立体小糖粒
{
  const N = 130;
  const inst = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.055,.16,3,8),
    new THREE.MeshStandardMaterial({color:0xffffff, roughness:.35, envMapIntensity:.8}), N);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
  const V = new THREE.Vector3(), S = new THREE.Vector3(1,1,1);
  const cc = [new THREE.Color(0xff9cb8), new THREE.Color(0xffd27a), new THREE.Color(0x8fe0ae),
              new THREE.Color(0xa5bff7), new THREE.Color(0xdcaef0)];
  let placed = 0;
  while (placed < N){
    const r = 3.2 + Math.pow(Math.random(), .8)*15, a = Math.random()*Math.PI*2;
    const px = Math.cos(a)*r, pz = Math.sin(a)*r;
    if (Math.abs(px) < 7.2 && pz > -2.8 && pz < 2.8) continue;   // 避开棋盘底座
    V.set(px, .05, pz);
    Q.setFromEuler(E.set(Math.PI/2, 0, Math.random()*Math.PI));
    M.compose(V, Q, S);
    inst.setMatrixAt(placed, M);
    inst.setColorAt(placed, cc[(Math.random()*5)|0]);
    placed++;
  }
  inst.castShadow = false;
  scene.add(inst);
}

// 奶油色立柱与底座（参考图的木板槽）
const woodMat = new THREE.MeshStandardMaterial({color:0xf4eee3, roughness:.38, metalness:0, envMapIntensity:.5});
const woodDark = new THREE.MeshStandardMaterial({color:0xe9dfcd, roughness:.42, metalness:0, envMapIntensity:.5});
for (const sx of [-1,1]){
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(.9, ROWS+2.5, 2.0), woodMat);
  pillar.position.set(sx*(COLS/2+0.55), (ROWS+2.5)/2 - .5, 0);
  pillar.castShadow = true; pillar.receiveShadow = true;
  scene.add(pillar);
}
{
  const base = new THREE.Mesh(new THREE.BoxGeometry(COLS+2.6, .6, 3.0), woodDark);
  base.position.set(0, -0.31, 0);
  base.receiveShadow = true; base.castShadow = true;
  scene.add(base);
}

// 凹凸法线贴图：参考图标的果冻表面不是光板，而是手工般的鼓包起伏 ——
// 法线扰动让高光在表面"乱窜"、折射跟着扭曲，这是"欲滴感"的关键
function noiseNormalTex(){
  const S = 128, h = new Float32Array(S*S);
  const rnd = []; for (let i=0;i<64*64;i++) rnd.push(Math.random());
  const val = (x,y,f)=>{                       // 平滑值噪声
    const gx = x*f, gy = y*f;
    const x0 = Math.floor(gx)%64, y0 = Math.floor(gy)%64;
    const fx = gx-Math.floor(gx), fy = gy-Math.floor(gy);
    const sx = fx*fx*(3-2*fx), sy = fy*fy*(3-2*fy);
    const r = (a,b)=>rnd[((a%64)+64)%64 + (((b%64)+64)%64)*64];
    return r(x0,y0)*(1-sx)*(1-sy) + r(x0+1,y0)*sx*(1-sy) + r(x0,y0+1)*(1-sx)*sy + r(x0+1,y0+1)*sx*sy;
  };
  for (let y=0;y<S;y++) for (let x=0;x<S;x++)
    h[y*S+x] = val(x/S,y/S,5)*.7 + val(x/S,y/S,11)*.3;
  const c = document.createElement('canvas'); c.width=c.height=S;
  const img = c.getContext('2d').createImageData(S,S);
  for (let y=0;y<S;y++) for (let x=0;x<S;x++){
    const i = y*S+x;
    const dx = h[y*S+((x+1)%S)] - h[y*S+((x-1+S)%S)];
    const dy = h[((y+1)%S)*S+x] - h[((y-1+S)%S)*S+x];
    const n = new THREE.Vector3(-dx*2.2, -dy*2.2, 1).normalize();
    img.data[i*4]   = (n.x*.5+.5)*255;
    img.data[i*4+1] = (n.y*.5+.5)*255;
    img.data[i*4+2] = (n.z*.5+.5)*255;
    img.data[i*4+3] = 255;
  }
  c.getContext('2d').putImageData(img,0,0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;    // 法线贴图保持线性色彩空间
  t.repeat.set(.8,.8);
  return t;
}
const bumpTex = noiseNormalTex();

// 图标同款浓艳配色：宝石蓝 / 正红 / 亮紫 / 明黄 / 翠绿 / 橙 / 桃粉
const jellyMats = COLORS.map(c => {
  const col = new THREE.Color(c);
  const deep = col.clone().offsetHSL(0, .2, .05);    // 吸收色=提饱和微亮的本色 → 厚处浓郁欲滴
  return new THREE.MeshPhysicalMaterial({
    color: col.clone().offsetHSL(0, .08, 0),
    transmission: .95,
    thickness: 1.7,
    roughness: .06,
    metalness: 0,
    ior: 1.45,
    dispersion: .16,
    attenuationColor: deep,
    attenuationDistance: 1.9,
    clearcoat: 1,
    clearcoatRoughness: .05,
    envMapIntensity: 1.15,
    specularIntensity: 1.4,
    normalMap: bumpTex,
    normalScale: new THREE.Vector2(.4, .4),
    clearcoatNormalMap: bumpTex,
    clearcoatNormalScale: new THREE.Vector2(.3, .3),
  });
});
const ghostMats = COLORS.map(c => new THREE.MeshBasicMaterial({
  color:c, transparent:true, opacity:.16, depthWrite:false }));
const bubbleGeo = new THREE.SphereGeometry(.06, 8, 8);
const bubbleMat = new THREE.MeshBasicMaterial({color:0xffffff});  // 不透明：才能进入透射缓冲、透过果冻折射可见

/* ═══════════════ 轮廓 → 挤出几何 ═══════════════ */
function outlines(cells){
  const set = new Set(cells.map(([x,y]) => x+','+y));
  const edges = new Map();
  const add = (k,v) => { const a=edges.get(k); a?a.push(v):edges.set(k,[v]); };
  for (const [x,y] of cells){
    if (!set.has(x+','+(y-1))) add(x+','+y, [x+1,y]);
    if (!set.has((x+1)+','+y)) add((x+1)+','+y, [x+1,y+1]);
    if (!set.has(x+','+(y+1))) add((x+1)+','+(y+1), [x,y+1]);
    if (!set.has((x-1)+','+y)) add(x+','+(y+1), [x,y]);
  }
  const loops = [];
  while (edges.size){
    const loop = []; let key = edges.keys().next().value;
    while (edges.has(key)){
      const [sx,sy] = key.split(',').map(Number);
      loop.push([sx,sy]);
      const list = edges.get(key);
      const end = list.pop();
      if (!list.length) edges.delete(key);
      key = end[0]+','+end[1];
    }
    if (loop.length >= 4) loops.push(loop);
  }
  return loops;
}

/* 生成以"底部中心"为原点的果冻几何（悬臂晃动的剪切支点） */
function jellyGeometry(cells){
  let minX=1e9,maxX=-1e9,maxY=-1e9;
  for (const [x,y] of cells){
    if(x<minX)minX=x; if(x+1>maxX)maxX=x+1; if(y+1>maxY)maxY=y+1;
  }
  const cx = (minX+maxX)/2;
  const seed = Math.random()*1000;           // 每块果冻的抖动都不同
  const shapes = outlines(cells).map(loop => {
    // 细分：每条格边拆成 4 段，才有顶点可供抖动
    const fine = [];
    for (let i=0;i<loop.length;i++){
      const a = loop[i], b = loop[(i+1)%loop.length];
      for (let k=0;k<4;k++) fine.push([a[0]+(b[0]-a[0])*k/4, a[1]+(b[1]-a[1])*k/4]);
    }
    // 平滑抖动：手工果冻的歪歪扭扭轮廓（确定性噪声 + 一次邻点平均去毛刺）
    const jit = fine.map(([px,py],i) => {
      const n1 = Math.sin(px*12.9898 + py*78.233 + seed)*43758.5453;
      const n2 = Math.sin(px*39.346 + py*11.135 + seed*1.7)*24634.6345;
      return [(n1-Math.floor(n1)-.5)*.11, (n2-Math.floor(n2)-.5)*.11];
    });
    const s = new THREE.Shape();
    fine.forEach(([px,py],i) => {
      const jp = jit[(i-1+jit.length)%jit.length], jc = jit[i], jn = jit[(i+1)%jit.length];
      const ox = (jp[0]+jc[0]*2+jn[0])/4, oy = (jp[1]+jc[1]*2+jn[1])/4;
      const X = px-cx+ox, Y = maxY-py+oy;    // 网格 y 向下 → 世界 y 向上，底缘为 0
      i ? s.lineTo(X,Y) : s.moveTo(X,Y);
    });
    s.closePath();
    return s;
  });
  const geo = new THREE.ExtrudeGeometry(shapes, {
    steps:1, depth: DEPTH-0.3, curveSegments:4,
    bevelEnabled:true, bevelThickness:.15, bevelSize:.13, bevelOffset:-.13, bevelSegments:4,
  });
  geo.translate(0, 0, -(DEPTH-0.3)/2 - .15); // 厚度居中
  geo.computeVertexNormals();
  geo.userData = { cx, bottom: maxY };       // 网格坐标锚点（供世界定位）
  return geo;
}
const geoCache = new Map();                  // 活动块几何按 (type,rot) 缓存
function activeGeo(t, r){
  const k = t+r;
  if (!geoCache.has(k)) geoCache.set(k, jellyGeometry(SHAPES[t][r]));
  return geoCache.get(k);
}

/* ═══════════════ 模态软体：真实果冻的"底不动、顶乱晃" ═══════════════
   不做全量 FEM，而是模拟果冻的三个主形变模态（x/z 向剪切 + 垂直压缩），
   每个模态是一根欠阻尼弹簧；顶点位移随高度线性放大（悬臂一阶模态），
   经由剪切矩阵在 GPU 变换里零成本实现。频率按尺寸缩放：大块低频慢晃。 */
class Wobble {
  constructor(size){
    this.lx = {p:0,v:0}; this.lz = {p:0,v:0}; this.sq = {p:0,v:0};
    this.size = Math.max(1, size);
    this.k = 520 / this.size;                // 单格 ω≈23(3.6Hz)、I块 ω≈11(1.8Hz)：真果冻的"duang"频段
    this.c = 2.6;                            // 欠阻尼：清晰可见 4~6 次回弹、约 1.5s 渐止
    this.cap = Math.min(.45, .9/this.size);  // 剪切上限（顶点位移 ≈ cap*高度）
    this.awake = true;
  }
  kick(dlx, dlz, dsq){
    this.lx.v += dlx; this.lz.v += dlz; this.sq.v += dsq;
    this.awake = true;
  }
  step(dt){
    if (!this.awake) return;
    let energy = 0;
    for (const m of [this.lx, this.lz, this.sq]){
      m.v += (-this.k*m.p - this.c*m.v) * dt;
      m.p += m.v * dt;
      energy += Math.abs(m.p) + Math.abs(m.v);
    }
    this.lx.p = THREE.MathUtils.clamp(this.lx.p, -this.cap, this.cap);
    this.lz.p = THREE.MathUtils.clamp(this.lz.p, -this.cap, this.cap);
    this.sq.p = THREE.MathUtils.clamp(this.sq.p, -.32, .5);
    if (energy < 0.008){
      this.lx.p=this.lx.v=this.lz.p=this.lz.v=this.sq.p=this.sq.v=0;
      this.awake = false;
    }
  }
  /* 组合矩阵：底部锚定的剪切 + 保体积压缩 */
  apply(group, X, Y, Z){
    const sy = 1 - this.sq.p;
    const sxz = 1/Math.sqrt(Math.max(.4, sy));
    group.matrix.set(
      sxz, this.lx.p*sy, 0, X,
      0,   sy,           0, Y,
      0,   this.lz.p*sy, sxz, Z,
      0,   0,            0, 1
    );
  }
}

/* ═══════════════ 果冻体（一个网格上的软体块） ═══════════════ */
class JellyBody {
  constructor(cells, ci){
    this.ci = ci;
    this.group = new THREE.Group();
    this.group.matrixAutoUpdate = false;
    scene.add(this.group);
    this.setCells(cells);
  }
  setCells(cells){
    this.cells = cells;
    let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
    for (const [x,y] of cells){
      if(x<minX)minX=x; if(x+1>maxX)maxX=x+1;
      if(y<minY)minY=y; if(y+1>maxY)maxY=y+1;
    }
    const size = Math.max(maxX-minX, maxY-minY);
    this.wob = this.wob || new Wobble(size);
    this.wob.size = Math.max(1,size); this.wob.k = 520/this.wob.size;
    this.wob.cap = Math.min(.45, .9/this.wob.size);
    // 世界锚点：底部中心
    this.ax = (minX+maxX)/2 - COLS/2;
    this.ay = ROWS - maxY;
    // 重建网格体
    this.clearMeshes();
    this.geo = jellyGeometry(cells);
    this.mesh = new THREE.Mesh(this.geo, jellyMats[this.ci]);
    this.mesh.castShadow = true;
    this.group.add(this.mesh);
    // 内部气泡：透过折射看到的白色小点
    for (const [x,y] of cells){
      if (Math.random() < .8){
        const b = new THREE.Mesh(bubbleGeo, bubbleMat);
        b.position.set(
          x + .2 + Math.random()*.6 - (minX+maxX)/2,
          (maxY - y) - (.2 + Math.random()*.6),
          (Math.random()-.5)*.4
        );
        this.group.add(b);
      }
    }
    this.updateMatrix();
  }
  clearMeshes(){
    while (this.group.children.length){
      const c = this.group.children.pop();
      this.group.remove(c);
    }
    if (this.geo) this.geo.dispose();
  }
  updateMatrix(){
    this.wob.apply(this.group, this.ax, this.ay, 0);
  }
  step(dt){
    if (!this.wob.awake) return;
    this.wob.step(dt);
    this.updateMatrix();
  }
  dispose(){
    this.clearMeshes();
    scene.remove(this.group);
  }
}

/* ═══════════════ 游戏状态 ═══════════════ */
let grid, bodies, active, ghost, bag = [], nextType;
let score, lines, level, dropT, over, paused, started = false;
const $ = id => document.getElementById(id);

function bagNext(){
  if (!bag.length) bag = TYPES.slice().sort(()=>Math.random()-.5);
  return bag.pop();
}
function cellsOf(a, dx=0, dy=0, rot=a.rot){
  return SHAPES[a.t][rot].map(([x,y]) => [x+a.x+dx, y+a.y+dy]);
}
function collides(a, dx, dy, rot){
  return cellsOf(a,dx,dy,rot).some(([x,y]) =>
    x<0 || x>=COLS || y>=ROWS || (y>=0 && grid[y][x]));
}
function spawn(){
  const t = nextType || bagNext();
  nextType = bagNext();
  drawNext();
  const ci = (Math.random()*COLORS.length)|0;
  active = { t, rot:0, x:(COLS>>1)-2, y:-1, ci,
             body:new JellyBody([], ci), grounded:0 };
  syncActive(true);
  active.body.wob.kick(0, 0, -.22);          // 出生拉长（滴落感）
  if (collides(active,0,0,active.rot)) gameOver();
}
function syncActive(rebuild){
  const g = activeGeo(active.t, active.rot);
  if (rebuild || active.body._g !== g){
    active.body.clearMeshes();
    active.body.geo = null;                  // 缓存几何不 dispose
    active.body.mesh = new THREE.Mesh(g, jellyMats[active.ci]);
    active.body.mesh.castShadow = true;
    active.body.group.add(active.body.mesh);
    active.body._g = g;
  }
  const u = active.body._g.userData;
  active.body.ax = active.x + u.cx - COLS/2;
  active.body.ay = ROWS - (active.y + u.bottom);
  active.body.updateMatrix();
  syncGhost();
}
function syncGhost(){
  if (!ghost){
    ghost = new THREE.Mesh(activeGeo(active.t,active.rot), ghostMats[active.ci]);
    scene.add(ghost);
  }
  ghost.geometry = activeGeo(active.t, active.rot);
  ghost.material = ghostMats[active.ci];
  let gy = 0;
  while (!collides(active,0,gy+1,active.rot)) gy++;
  const u = ghost.geometry.userData;
  ghost.position.set(active.x + u.cx - COLS/2, ROWS - (active.y+gy+u.bottom), 0);
  ghost.visible = gy > 0 && !over;
}

/* —— 操作 —— */
function move(dir){
  if (over||paused) return;
  if (!collides(active,dir,0,active.rot)){
    active.x += dir;
    active.body.wob.kick(dir*2.6/Math.sqrt(active.body.wob.size), 0, .04);
    syncActive();
  } else {
    active.body.wob.kick(dir*1.6, 0, .12);   // 撞墙：狠狠反弹颤一下
  }
}
function rotate(dir=1){
  if (over||paused) return;
  const nr = (active.rot+dir+4)%4;
  for (const [kx,ky] of [[0,0],[dir,0],[-dir,0],[0,-1],[2*dir,0]]){
    if (!collides(active,kx,ky,nr)){
      active.x+=kx; active.y+=ky; active.rot=nr;
      active.body.wob.kick(.7*dir, 1.2*dir, .12);  // 旋转搅动
      syncActive(true);
      return;
    }
  }
}
function softStep(){
  if (collides(active,0,1,active.rot)){ lock(); return; }
  active.y++;
  active.body.wob.kick(0,0,-.07);
  syncActive();
}
function hardDrop(){
  if (over||paused) return;
  let n=0;
  while (!collides(active,0,1,active.rot)){ active.y++; n++; }
  score += n*2; updateHUD();
  shake = Math.min(.5, .12 + n*.02);
  lock(1.6);
}
function lock(power=1){
  const cells = cellsOf(active);
  if (cells.some(([,y]) => y<0)){ gameOver(); return; }
  const body = new JellyBody(cells, active.ci);
  body.wob.kick((Math.random()-.5)*.6*power, (Math.random()-.5)*.5*power, .5*power);
  bodies.push(body);
  for (const [x,y] of cells) grid[y][x] = body;
  // 落地震动传导给邻近果冻（距离衰减）
  for (const b of bodies){
    if (b === body) continue;
    const d = Math.hypot(b.ax-body.ax, b.ay-body.ay);
    if (d < 7) b.wob.kick((Math.random()-.5)*.9/(1+d), (Math.random()-.5)*.4/(1+d), .4/(1+d*d)*power);
  }
  active.body.dispose(); active = null;
  clearLines();
  if (!over) spawn();
}

/* —— 消行（含果冻分裂重建） —— */
function clearLines(){
  const full = [];
  for (let y=0;y<ROWS;y++) if (grid[y].every(c=>c)) full.push(y);
  if (!full.length) return;
  // 消行粒子
  for (const y of full) for (let x=0;x<COLS;x++)
    spawnBits(x-COLS/2+.5, ROWS-y-.5, grid[y][x].ci);
  const fullSet = new Set(full);
  const survivors = [];
  for (const b of bodies){
    const keep = b.cells.filter(([,y]) => !fullSet.has(y));
    if (!keep.length){ b.dispose(); continue; }
    // 连通分量拆分（消行可能把一块果冻切成两半）
    const comps = components(keep);
    for (const comp of comps){
      const drop = full.filter(r => r > comp[0][1]).length;
      const moved = comp.map(([x,y]) => [x, y+drop]);
      let nb;
      if (comps.length===1 && b.cells.length===keep.length && !drop){ nb=b; }
      else if (comps.length===1 && comp.length===keep.length){
        b.setCells(moved); nb=b;
      } else {
        nb = new JellyBody(moved, b.ci);
      }
      nb.wob.kick((Math.random()-.5)*1.0, (Math.random()-.5)*.5, .45 + drop*.1);
      survivors.push(nb);
      if (nb!==b && comp===comps[comps.length-1]) b.dispose();
    }
  }
  bodies = survivors;
  grid = Array.from({length:ROWS},()=>Array(COLS).fill(null));
  for (const b of bodies) for (const [x,y] of b.cells) grid[y][x] = b;
  lines += full.length;
  score += [0,100,300,500,800][full.length] * (level);
  level = 1 + (lines/10|0);
  shake = Math.min(.6, .2 + full.length*.1);
  updateHUD();
}
function components(cells){
  const set = new Set(cells.map(c=>c.join(',')));
  const seen = new Set(), out = [];
  for (const c of cells){
    const k = c.join(',');
    if (seen.has(k)) continue;
    const comp = [], q=[c]; seen.add(k);
    while (q.length){
      const [x,y] = q.pop(); comp.push([x,y]);
      for (const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){
        const nk = nx+','+ny;
        if (set.has(nk) && !seen.has(nk)){ seen.add(nk); q.push([nx,ny]); }
      }
    }
    out.push(comp);
  }
  return out;
}

/* —— 消行粒子（果冻碎屑） —— */
const bits = [];
const bitGeo = new THREE.SphereGeometry(.11, 8, 8);
function spawnBits(x, y, ci){
  for (let i=0;i<2;i++){
    const m = new THREE.Mesh(bitGeo, new THREE.MeshBasicMaterial({
      color:COLORS[ci], transparent:true, opacity:.9}));
    m.position.set(x + (Math.random()-.5)*.5, y, (Math.random()-.5)*.6);
    m.userData = {vx:(Math.random()-.5)*5, vy:2+Math.random()*4, vz:(Math.random()-.5)*3, life:.7};
    scene.add(m); bits.push(m);
  }
}
function stepBits(dt){
  for (let i=bits.length-1;i>=0;i--){
    const m = bits[i], u = m.userData;
    u.life -= dt;
    if (u.life<=0){ scene.remove(m); m.material.dispose(); bits.splice(i,1); continue; }
    u.vy -= 22*dt;
    m.position.x += u.vx*dt; m.position.y += u.vy*dt; m.position.z += u.vz*dt;
    if (m.position.y < .1){ m.position.y=.1; u.vy*=-.4; }
    m.material.opacity = u.life*1.3;
    const s = Math.max(.05, u.life*1.4); m.scale.setScalar(s);
  }
}

/* ═══════════════ HUD ═══════════════ */
function updateHUD(){
  $('hScore').textContent = score;
  $('hLines').textContent = lines;
  $('hLevel').textContent = level;
}
function drawNext(){
  const c = $('next'), ctx = c.getContext('2d');
  ctx.clearRect(0,0,168,168);
  if (!nextType) return;
  const cells = SHAPES[nextType][0];
  let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
  for (const [x,y] of cells){
    if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y;
  }
  const s=34, ox=(168-(maxX-minX+1)*s)/2, oy=(168-(maxY-minY+1)*s)/2;
  ctx.fillStyle = '#ffd7e6';
  for (const [x,y] of cells){
    ctx.beginPath();
    ctx.roundRect(ox+(x-minX)*s+3, oy+(y-minY)*s+3, s-6, s-6, 9);
    ctx.fill();
  }
}

/* ═══════════════ 相机（拖动环绕 + 微晃） ═══════════════ */
let theta = .16, phi = 1.22, thetaT = .16, phiT = 1.22, shake = 0;
const RADIUS = 30.5;
let dragging = false, px0=0, py0=0;
canvas.addEventListener('pointerdown', e => { dragging=true; px0=e.clientX; py0=e.clientY; });
addEventListener('pointermove', e => {
  if (!dragging) return;
  thetaT = THREE.MathUtils.clamp(thetaT + (e.clientX-px0)*.004, -.55, .65);
  phiT   = THREE.MathUtils.clamp(phiT   - (e.clientY-py0)*.003, 1.02, 1.42);
  px0=e.clientX; py0=e.clientY;
});
addEventListener('pointerup', () => dragging=false);
function updateCamera(t, dt){
  theta += (thetaT + Math.sin(t*.3)*.015 - theta) * Math.min(1, dt*6);
  phi   += (phiT - phi) * Math.min(1, dt*6);
  const sp = Math.sin(phi), sx = shake*(Math.random()-.5), sy = shake*(Math.random()-.5);
  camera.position.set(
    camTarget.x + RADIUS*sp*Math.sin(theta) + sx,
    camTarget.y + RADIUS*Math.cos(phi) + sy,
    camTarget.z + RADIUS*sp*Math.cos(theta)
  );
  camera.lookAt(camTarget);
  shake *= Math.exp(-8*dt);
}

/* ═══════════════ 输入 ═══════════════ */
let softHold = false;
addEventListener('keydown', e => {
  if (['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Space'].includes(e.code)) e.preventDefault();
  if (!started || over) return;
  switch (e.code){
    case 'ArrowLeft': move(-1); break;
    case 'ArrowRight': move(1); break;
    case 'ArrowDown': softHold = true; break;
    case 'ArrowUp': case 'KeyX': rotate(1); break;
    case 'KeyZ': rotate(-1); break;
    case 'Space': hardDrop(); break;
    case 'KeyP': togglePause(); break;
    case 'KeyR': restart(); break;
  }
});
addEventListener('keyup', e => { if (e.code==='ArrowDown') softHold=false; });
if (matchMedia('(pointer:coarse)').matches) document.body.classList.add('touch');
document.querySelectorAll('.pbtn').forEach(b => {
  b.addEventListener('pointerdown', e => {
    e.stopPropagation();
    if (!started||over||paused) return;
    const a = b.dataset.act;
    if (a==='left') move(-1);
    else if (a==='right') move(1);
    else if (a==='rot') rotate(1);
    else if (a==='soft') softStep(), score++, updateHUD();
    else if (a==='hard') hardDrop();
  });
});

/* ═══════════════ 流程 ═══════════════ */
function restart(){
  for (const b of bodies||[]) b.dispose();
  if (active) active.body.dispose();
  grid = Array.from({length:ROWS},()=>Array(COLS).fill(null));
  bodies = []; bag = []; nextType = null;
  score = 0; lines = 0; level = 1; dropT = 0; over = false; paused = false;
  updateHUD();
  $('ovOver').classList.add('hidden');
  $('ovPause').classList.add('hidden');
  spawn();
}
function togglePause(){
  if (over||!started) return;
  paused = !paused;
  $('ovPause').classList.toggle('hidden', !paused);
}
function gameOver(){
  over = true;
  if (ghost) ghost.visible = false;
  $('finalScore').textContent = `得分 ${score} · ${lines} 行`;
  let best = 0;
  try { best = parseInt(localStorage.getItem('jelly3dBest'))||0; } catch(e){}
  const isNew = score > best;
  if (isNew){ best = score; try{ localStorage.setItem('jelly3dBest', best); }catch(e){} }
  $('bestLine').textContent = isNew ? '🏆 新纪录！' : `最高纪录：${best}`;
  $('ovOver').classList.remove('hidden');
}
$('btnStart').onclick = () => { started=true; $('ovStart').classList.add('hidden'); restart(); };
$('btnRetry').onclick = restart;
$('btnResume').onclick = togglePause;
$('btnPause').onclick = togglePause;
document.addEventListener('visibilitychange', () => {
  if (document.hidden && started && !over && !paused) togglePause();
});

/* ═══════════════ 主循环 ═══════════════ */
const clock = new THREE.Clock();
function frame(){
  requestAnimationFrame(frame);
  const dt = Math.min(.05, clock.getDelta());
  const t = clock.elapsedTime;
  if (started && !paused && !over && active){
    const interval = softHold ? .045 : Math.max(.08, .8*Math.pow(.88, level-1));
    dropT += dt;
    while (dropT >= interval && active){
      dropT -= interval;
      if (softHold){ score++; updateHUD(); }
      softStep();
    }
  }
  if (!paused){
    for (const b of bodies) b.step(dt);
    if (active) active.body.step(dt);
    stepBits(dt);
  }
  updateCamera(t, dt);
  renderer.render(scene, camera);
}
addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
frame();
