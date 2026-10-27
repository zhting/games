// Public release boundary, shared by the browser and multiplayer service.
// Later-stage prototypes remain in source while their entry points stay closed.
export const OPEN_STAGES=Object.freeze([1,2,3,4]);
export const LAST_OPEN_STAGE=OPEN_STAGES.at(-1);
export const STAGE_RELEASE_MESSAGE='当前版本仅开放第一关、第二关、第三关和第四关';
export const isStageOpen=stage=>Number.isInteger(stage)&&OPEN_STAGES.includes(stage);
export const nextOpenStage=stage=>isStageOpen(stage+1)?stage+1:null;
