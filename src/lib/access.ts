export const roles = ['player', 'gm', 'admin'] as const;
export type Role = (typeof roles)[number];
export const roleLabels: Record<Role, string> = {
  player: 'Gracz',
  gm: 'MG',
  admin: 'Administrator',
};
export const managesGame = (user: { role: Role }) => user.role === 'admin' || user.role === 'gm';
export const canEditCharacter = (user: { id: string; role: Role }, ownerId: string) =>
  user.id === ownerId || managesGame(user);
export const canViewPrivateCharacter = (
  user: { id: string; role: Role },
  ownerId: string,
  revealPrivate = false,
) => user.id === ownerId || user.role === 'gm' || (user.role === 'admin' && revealPrivate);
export const apiScopes = ['read', 'compendium:write'] as const;
export type ApiScope = (typeof apiScopes)[number];
