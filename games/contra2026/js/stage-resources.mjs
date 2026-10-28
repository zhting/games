import { gameResourceJobs } from './resource-preloader.mjs?v=lives-load-1';
import { COMBAT_ASSETS } from './combat-art.mjs?v=combat-polish-1';

const ACTORS = ['actorRed','actorBlue','actorEnemy','actorDeath','runLimbs'];
const LEGACY_RUNS=new Set(['runRed','runBlue','runEnemy']);

/** URLs describe usage, rather than the directory where a shared atlas lives. */
export function stageAssetUrls(stage, arts) {
  const [one, two, three, four, five] = arts;
  const urls = new Set();
  const add = (art, keys = Object.keys(art.assets)) => {
    for (const key of keys) {
      if (!art.assets[key]) throw Error('缺少关卡资源：' + key);
      urls.add(art.assets[key]);
    }
  };
  // All three roles animate with the shared limb rig. Full-body run sheets are legacy fallbacks.
  if (stage === 1) add(one,Object.keys(one.assets).filter(key=>!LEGACY_RUNS.has(key)));
  else if (stage === 2 || stage === 4) {
    add(stage === 2 ? two : four);
    add(one, ['actorRed','actorBlue']); // Life icons use the shared portraits.
  } else if (stage === 3) {
    add(three);
    add(one, [...ACTORS,'rock','environment','facilities',...Object.keys(COMBAT_ASSETS)]);
  } else if (stage === 5 && five) {
    add(five);
    add(one, [...ACTORS,'environment','facilities',...Object.keys(COMBAT_ASSETS)]);
  } else throw Error('关卡尚未开放');
  add(one,['explosionAtlas']);
  return urls;
}

export function stageResourceJobs(stage, options) {
  // Register all consumers so a loaded shared image is adopted by later
  // renderers too. Only URLs required by this stage are actually requested.
  return gameResourceJobs({...options, urls: stageAssetUrls(stage, options.arts)});
}
