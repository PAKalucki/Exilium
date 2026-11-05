export const PORTRAIT_UPLOAD_LIMIT = 5 * 1024 * 1024;
export const portraitUrl = (characterId: string, portraitId: string) =>
  `/api/characters/${characterId}/portrait?v=${encodeURIComponent(portraitId)}`;
