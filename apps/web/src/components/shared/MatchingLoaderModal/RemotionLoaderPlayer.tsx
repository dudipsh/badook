import { Player } from '@remotion/player';
import { MatchingAnimation } from './MatchingAnimation';

const RemotionLoaderPlayer = () => (
  <div dir="ltr" style={{ width: '100%', height: '100%' }}>
    <Player
      component={MatchingAnimation}
      durationInFrames={200}
      compositionWidth={800}
      compositionHeight={450}
      fps={60}
      autoPlay
      loop
      style={{ width: '100%', height: '100%' }}
    />
  </div>
);

export default RemotionLoaderPlayer;
