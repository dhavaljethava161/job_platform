console.log('🚀 Users & Permissions extension loaded');

export default (plugin) => {
  // Custom me controller for GET /api/users/me
  plugin.controllers.user.me = async (ctx) => {
    console.log('🚀 Custom me controller called!');

    // Check if user is authenticated
    if (!ctx.state.user) {
      return ctx.unauthorized('No authenticated user found');
    }

    try {
      const strapi = ctx.state.strapi || global.strapi;
      const user = ctx.state.user;

      // Fetch the user's role
      const userRole = await strapi
        .query('plugin::users-permissions.role')
        .findOne({ where: { id: user.role.id } });

      // Manually sanitize user
      const sanitizedUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        provider: user.provider,
        confirmed: user.confirmed,
        blocked: user.blocked,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        profile: user.profile,
        role: userRole ? { name: userRole.name, type: userRole.type } : null,
      };

      ctx.body = sanitizedUser;
    } catch (error) {
      console.error('🚀 Me endpoint error:', error);
      ctx.badRequest(
        error.message || 'An error occurred while fetching user profile'
      );
    }
  };

  // Optional: Include login override if needed (for POST /api/auth/local)
  plugin.controllers.auth.login = async (ctx) => {
    console.log('🚀 Custom login controller called!');
    console.log('🚀 Request body:', ctx.request.body);

    const { identifier, password } = ctx.request.body;

    if (!identifier || !password) {
      return ctx.badRequest('Missing identifier or password');
    }

    try {
      const strapi = ctx.state.strapi || global.strapi;

      // Find user by username or email
      const user = await strapi
        .query('plugin::users-permissions.user')
        .findOne({
          where: {
            $or: [{ username: identifier }, { email: identifier }],
          },
        });

      if (!user) {
        return ctx.badRequest('Invalid identifier or password');
      }

      const validPassword = await strapi
        .plugin('users-permissions')
        .service('user')
        .validatePassword(password, user.password);

      if (!validPassword) {
        return ctx.badRequest('Invalid identifier or password');
      }

      const jwt = strapi.plugin('users-permissions').service('jwt').issue({
        id: user.id,
      });

      const userRole = await strapi
        .query('plugin::users-permissions.role')
        .findOne({ where: { id: user.role.id } });

      const sanitizedUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        provider: user.provider,
        confirmed: user.confirmed,
        blocked: user.blocked,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        profile: user.profile,
        role: userRole ? { name: userRole.name, type: userRole.type } : null,
      };

      ctx.body = {
        jwt,
        user: sanitizedUser,
      };
    } catch (error) {
      console.error('🚀 Login error:', error);
      ctx.badRequest(error.message || 'Invalid identifier or password');
    }
  };

  return plugin;
};
