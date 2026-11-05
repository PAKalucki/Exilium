export const load = ({ locals }: { locals: App.Locals }) => ({
  user: locals.user ? { id: locals.user.id, name: locals.user.name, role: locals.user.role } : null,
});
