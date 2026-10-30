export type RoomMode = 'adventure' | 'coop-exploration';
export type GameMode = RoomMode | 'exploration';
export const isFreeExploration = (mode: GameMode | undefined) => mode === 'exploration' || mode === 'coop-exploration';
export const roomMode = (value: {mode?: RoomMode}) => value.mode ?? 'adventure';
export const credentialKey = (mode: RoomMode) => mode === 'adventure' ? 'starlight-adventure' : 'starlight-coop-exploration-v1';
