import {Composition, registerRoot} from 'remotion';
import {JellyTetrisAd} from './JellyTetrisAd';

const Root = () => (
  <Composition
    id="JellyTetrisAd"
    component={JellyTetrisAd}
    durationInFrames={897}
    fps={30}
    width={1920}
    height={1080}
  />
);

registerRoot(Root);
