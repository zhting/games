// Stage-two soldiers share the commandos' 38-unit physical height. Depth still
// reduces their size, but does not halve a second, already smaller reference body.
export const BASE_SOLDIER=Object.freeze({height:38,halfWidth:10,muzzleHeight:26.6});
export const baseSoldierScale=z=>1-.3*Math.max(0,Math.min(1,z));
