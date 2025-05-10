console.log('🚀 Loading custom auth controller for Users & Permissions');

module.exports = {
  async register(ctx) {
    const { username, email, password, profile, role } = ctx.request.body;

    if (!username || !email || !password) {
      return ctx.badRequest(
        'Missing required fields: username, email, and password are required'
      );
    }

    if (!role || !['candidate', 'employer'].includes(role.toLowerCase())) {
      return ctx.badRequest(
        'Invalid or missing role: must be "candidate" or "employer"'
      );
    }

    try {
      const strapi = ctx.state.strapi || global.strapi;
      if (!strapi) {
        throw new Error('Strapi instance not found');
      }

      const existingUserByUsername = await strapi
        .query('plugin::users-permissions.user')
        .findOne({ where: { username } });
      if (existingUserByUsername) {
        return ctx.badRequest('Username is already taken');
      }

      const existingUserByEmail = await strapi
        .query('plugin::users-permissions.user')
        .findOne({ where: { email } });
      if (existingUserByEmail) {
        return ctx.badRequest('Email is already registered');
      }

      const roleType =
        role.toLowerCase() === 'candidate' ? 'authenticated' : 'employer';
      const userRole = await strapi
        .query('plugin::users-permissions.role')
        .findOne({ where: { type: roleType } });

      if (!userRole) {
        return ctx.badRequest(`Role "${roleType}" not found`);
      }

      const user = await strapi
        .plugin('users-permissions')
        .service('user')
        .add({
          username,
          email,
          password,
          profile,
          provider: 'local',
          confirmed: false,
          blocked: false,
          role: userRole,
        });

      const jwt = strapi.plugin('users-permissions').service('jwt').issue({
        id: user.id,
      });

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
        role: { name: userRole.name, type: userRole.type },
      };

      ctx.body = {
        jwt,
        user: sanitizedUser,
      };
    } catch (error) {
      console.log('🚀 Registration error:', error);
      ctx.badRequest(error.message || 'An error occurred during registration');
    }
  },
};
