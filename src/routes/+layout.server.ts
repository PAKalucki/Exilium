export const load = ({ locals }: { locals: App.Locals }) => ({
  user: locals.user ? { name: locals.user.name } : null,
});
