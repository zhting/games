import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const FPS = 30;
const FONT = '"Microsoft YaHei UI", "PingFang SC", sans-serif';
const colors = {
  classic: '#ff5e98',
  melt: '#ffb64d',
  fluid: '#5de2cf',
  iso: '#9f80ff',
  true3d: '#54c8ff',
};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};

const GlowBackground = ({color = '#ff5e98'}) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 35) * 55;
  return (
    <AbsoluteFill style={{background: '#09051d', overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: -180, background: `radial-gradient(circle at ${28 + drift / 20}% 30%, ${color}80 0, transparent 34%), radial-gradient(circle at 76% 68%, #5b43ff66 0, transparent 38%), linear-gradient(135deg,#09031a,#190c38 52%,#071631)`, filter: 'blur(20px)'}} />
      <div style={{position: 'absolute', inset: 0, opacity: 0.18, backgroundImage: 'linear-gradient(rgba(255,255,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.07) 1px,transparent 1px)', backgroundSize: '72px 72px', transform: `translate(${drift}px,${-drift / 2}px) rotate(-7deg) scale(1.2)`}} />
    </AbsoluteFill>
  );
};

const VideoSurface = ({src, color, startFrom = 42, zoom = 1, full = false}) => {
  const frame = useCurrentFrame();
  const entrance = spring({frame, fps: FPS, config: {damping: 18, stiffness: 150}});
  const push = interpolate(frame, [0, 160], [1.03, 1.11], clamp) * zoom;
  return (
    <div style={{position: 'absolute', left: full ? 0 : 420, right: full ? 0 : 70, top: full ? 0 : 82, bottom: full ? 0 : 86, borderRadius: full ? 0 : 42, overflow: 'hidden', border: full ? 'none' : `3px solid ${color}88`, boxShadow: full ? 'none' : `0 32px 100px #000b, 0 0 70px ${color}55`, transform: `translateX(${(1 - entrance) * 160}px) scale(${0.94 + entrance * 0.06})`}}>
      <OffthreadVideo muted src={staticFile(`capture/${src}`)} startFrom={startFrom} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${push})`}} />
      <div style={{position: 'absolute', inset: 0, background: full ? 'linear-gradient(90deg,rgba(5,3,20,.88),rgba(5,3,20,.08) 45%,rgba(5,3,20,.2))' : 'linear-gradient(90deg,rgba(10,4,30,.32),transparent 30%,rgba(4,2,20,.2))'}} />
    </div>
  );
};

const FeatureScene = ({file, color, index, title, en, description, badge, startFrom}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame, fps, config: {damping: 13, stiffness: 180}});
  const exit = interpolate(frame, [104, 122], [1, 0], {...clamp, easing: Easing.in(Easing.cubic)});
  const line = interpolate(frame, [6, 44], [0, 1], clamp);
  return (
    <AbsoluteFill style={{fontFamily: FONT, color: 'white', opacity: exit}}>
      <GlowBackground color={color} />
      <VideoSurface src={file} color={color} startFrom={startFrom} />
      <div style={{position: 'absolute', left: 86, top: 120, width: 440}}>
        <div style={{display: 'inline-flex', alignItems: 'center', gap: 14, padding: '10px 20px', borderRadius: 999, background: `${color}22`, border: `2px solid ${color}88`, color, fontWeight: 900, fontSize: 26, letterSpacing: 2, transform: `scale(${pop})`}}>
          <span style={{fontSize: 18, opacity: .75}}>0{index}</span>{badge}
        </div>
        <h2 style={{margin: '30px 0 2px', fontSize: 82, lineHeight: 1, letterSpacing: -4, textShadow: `0 8px 45px ${color}80`, transform: `translateY(${(1 - pop) * 60}px)`}}>{title}</h2>
        <div style={{fontSize: 23, letterSpacing: 8, color: '#c8c0e6', fontWeight: 700}}>{en}</div>
        <div style={{width: 290 * line, height: 5, borderRadius: 5, background: `linear-gradient(90deg,${color},transparent)`, margin: '28px 0'}} />
        <p style={{fontSize: 31, lineHeight: 1.55, fontWeight: 700, color: '#eee9ff', margin: 0, maxWidth: 390}}>{description}</p>
      </div>
      <div style={{position: 'absolute', right: 92, top: 105, padding: '9px 16px', borderRadius: 12, background: '#09051daa', border: '1px solid #ffffff33', fontSize: 18, fontWeight: 800, letterSpacing: 2}}>REAL GAMEPLAY · 实机画面</div>
    </AbsoluteFill>
  );
};

const Hook = () => {
  const frame = useCurrentFrame();
  const scale = spring({frame, fps: FPS, config: {damping: 12, stiffness: 170}});
  const question = interpolate(frame, [42, 63], [1, 0], clamp);
  return (
    <AbsoluteFill style={{fontFamily: FONT, color: 'white', overflow: 'hidden'}}>
      <GlowBackground color="#ff4f93" />
      <VideoSurface src="melt.webm" color={colors.melt} startFrom={75} full zoom={1.13} />
      <div style={{position: 'absolute', inset: 0, background: 'linear-gradient(110deg,rgba(8,2,25,.95),rgba(31,5,56,.58) 52%,rgba(7,19,44,.5))'}} />
      <div style={{position: 'absolute', left: 105, top: 150, opacity: question, transform: `scale(${scale})`, transformOrigin: 'left center'}}>
        <div style={{fontSize: 31, fontWeight: 900, letterSpacing: 9, color: '#8beaff'}}>JELLY TETRIS</div>
        <div style={{fontSize: 100, lineHeight: 1.16, fontWeight: 1000, letterSpacing: -6, marginTop: 24}}>俄罗斯方块<br/><span style={{color: '#ff77a9', textShadow: '0 0 50px #ff4f93'}}>还能这么软？</span></div>
      </div>
      <div style={{position: 'absolute', left: 108, bottom: 122, display: 'flex', gap: 16}}>
        {['弹', '融', '流', '立', '3D'].map((x, i) => <div key={x} style={{width: 78, height: 78, borderRadius: 22, display: 'grid', placeItems: 'center', background: `linear-gradient(145deg,${['#ff6ca5','#ffb84e','#62e3ce','#a38aff','#55c8ff'][i]},#ffffff22)`, fontSize: 31, fontWeight: 1000, transform: `translateY(${Math.sin((frame-i*4)/6)*8}px) rotate(${Math.sin(frame/9+i)*4}deg)`, boxShadow: '0 14px 35px #0008'}}>{x}</div>)}
      </div>
    </AbsoluteFill>
  );
};

const True3dScene = () => {
  const frame = useCurrentFrame();
  const reveal = spring({frame, fps: FPS, config: {damping: 16, stiffness: 130}});
  const exit = interpolate(frame, [170, 188], [1, 0], clamp);
  return (
    <AbsoluteFill style={{fontFamily: FONT, color: 'white', opacity: exit}}>
      <VideoSurface src="true3d.webm" color={colors.true3d} startFrom={150} full zoom={1.02} />
      <div style={{position: 'absolute', left: 92, top: 108, width: 600, transform: `translateX(${(1-reveal)*-90}px)`, opacity: reveal}}>
        <div style={{fontSize: 25, color: '#79e7ff', letterSpacing: 6, fontWeight: 900}}>TRUE 3D · 真三维</div>
        <div style={{fontSize: 92, lineHeight: 1.02, fontWeight: 1000, marginTop: 20, letterSpacing: -5}}>折射 · 反光<br/><span style={{color: '#8deaff'}}>软体晃动</span></div>
        <div style={{fontSize: 30, lineHeight: 1.6, marginTop: 35, color: '#f2f4ff', fontWeight: 700}}>拖动镜头，环绕欣赏<br/>每一块“会呼吸”的果冻</div>
      </div>
      <div style={{position: 'absolute', right: 88, bottom: 65, display: 'flex', gap: 14}}>
        {['物理级材质', '实时光影', '自由视角'].map((x, i) => <div key={x} style={{padding: '13px 20px', borderRadius: 999, background: '#07162acc', border: '1px solid #80eaff88', fontSize: 21, fontWeight: 800, transform: `translateY(${Math.sin(frame/9+i)*6}px)`}}>{x}</div>)}
      </div>
    </AbsoluteFill>
  );
};

const Montage = () => {
  const frame = useCurrentFrame();
  const files = ['classic.webm','melt.webm','fluid.webm','iso.webm'];
  const labels = ['经典','融化','流体','立体'];
  return (
    <AbsoluteFill style={{fontFamily: FONT, background: '#09051d', color: 'white', padding: 52}}>
      <GlowBackground color="#ff65a7" />
      <div style={{position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, width: '100%', height: '100%'}}>
        {files.map((file, i) => {
          const enter = spring({frame: frame-i*3, fps: FPS, config: {damping: 14, stiffness: 180}});
          return <div key={file} style={{position: 'relative', overflow: 'hidden', borderRadius: 30, border: `2px solid ${Object.values(colors)[i]}88`, transform: `scale(${0.88+enter*.12}) rotate(${(1-enter)*(i%2?3:-3)}deg)`, boxShadow: '0 18px 50px #000a'}}>
            <OffthreadVideo muted src={staticFile(`capture/${file}`)} startFrom={100+i*9} style={{width:'100%',height:'100%',objectFit:'cover',transform:'scale(1.12)'}} />
            <div style={{position:'absolute',left:20,bottom:18,padding:'8px 17px',borderRadius:999,background:'#08031dcc',fontSize:23,fontWeight:900}}>{labels[i]}</div>
          </div>;
        })}
      </div>
      <div style={{position: 'absolute', inset: 0, zIndex: 4, display: 'grid', placeItems: 'center', pointerEvents: 'none'}}>
        <div style={{fontSize: 67, fontWeight: 1000, padding: '20px 42px', borderRadius: 28, background: '#100624dd', border: '2px solid #fff5', boxShadow: '0 25px 80px #000,0 0 55px #ff65a766', transform: `scale(${1+Math.sin(frame/6)*.025})`}}>四种玩法 · 随时切换</div>
      </div>
    </AbsoluteFill>
  );
};

const Outro = () => {
  const frame = useCurrentFrame();
  const enter = spring({frame, fps: FPS, config: {damping: 12, stiffness: 150}});
  const pulse = 1 + Math.sin(frame / 5) * 0.035;
  return (
    <AbsoluteFill style={{fontFamily: FONT, color: 'white', textAlign: 'center'}}>
      <GlowBackground color="#ff4f93" />
      <div style={{position:'absolute',inset:0,background:'radial-gradient(circle at 50% 45%,transparent,#080319aa 68%)'}} />
      <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',transform:`scale(${.82+enter*.18})`,opacity:enter}}>
        <div style={{fontSize:26,fontWeight:900,letterSpacing:12,color:'#79e7ff'}}>JELLY TETRIS</div>
        <div style={{fontSize:112,fontWeight:1000,letterSpacing:-7,marginTop:18,textShadow:'0 12px 65px #ff4f9388'}}>果冻俄罗斯方块</div>
        <div style={{fontSize:34,fontWeight:800,color:'#ded7f3',marginTop:12}}>五种玩法 · 每一次落点都不一样</div>
        <div style={{marginTop:54,padding:'20px 70px',fontSize:38,fontWeight:1000,borderRadius:999,background:'linear-gradient(180deg,#ffb4cf,#ff4f87)',boxShadow:'0 20px 65px #ff3d8088, inset 0 2px #fff8',transform:`scale(${pulse})`}}>现在开玩  →</div>
      </div>
    </AbsoluteFill>
  );
};

const Voice = ({from, file, duration = 120}) => (
  <Sequence from={from} durationInFrames={duration}>
    <Audio src={staticFile(`audio/voice/${file}.mp3`)} volume={1.4} />
  </Sequence>
);

export const JellyTetrisAd = () => (
  <AbsoluteFill style={{backgroundColor:'#09051d'}}>
    <Audio src={staticFile('audio/bgm.wav')} volume={0.20} />
    <Sequence from={0} durationInFrames={72}><Hook /></Sequence>
    <Sequence from={72} durationInFrames={123}><FeatureScene file="classic.webm" color={colors.classic} index={1} title="经典" en="CLASSIC" badge="弹性回弹" description="熟悉的消行节奏，加上真实的落地震颤。" startFrom={44} /></Sequence>
    <Sequence from={195} durationInFrames={117}><FeatureScene file="melt.webm" color={colors.melt} index={2} title="融化" en="MELTING" badge="坍塌流淌" description="果冻瘫软、下坠，同色连成一片。" startFrom={47} /></Sequence>
    <Sequence from={312} durationInFrames={117}><FeatureScene file="fluid.webm" color={colors.fluid} index={3} title="流体" en="FLUID" badge="颗粒物理" description="湿沙般流动碰撞，连片贯通才会清空。" startFrom={47} /></Sequence>
    <Sequence from={429} durationInFrames={117}><FeatureScene file="iso.webm" color={colors.iso} index={4} title="立体" en="JELLY DEPTH" badge="软糖质感" description="厚度、圆顶高光和镜面反射全部拉满。" startFrom={47} /></Sequence>
    <Sequence from={546} durationInFrames={195}><True3dScene /></Sequence>
    <Sequence from={741} durationInFrames={84}><Montage /></Sequence>
    <Sequence from={825} durationInFrames={75}><Outro /></Sequence>

    <Voice from={4} file="01-hook" duration={68} />
    <Voice from={81} file="02-classic" duration={90} />
    <Voice from={204} file="03-melt" duration={100} />
    <Voice from={321} file="04-fluid" duration={100} />
    <Voice from={438} file="05-iso" duration={105} />
    <Voice from={558} file="06-3d" duration={165} />
    <Voice from={725} file="07-cta" duration={172} />
  </AbsoluteFill>
);
