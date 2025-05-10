// src/extensions/users-permissions/controllers/auth.ts
import { Context } from 'koa';

// Define a minimal user interface for the response
interface User {
  id: number;
  username: string;
  email: string;
  provider: string;
  confirmed: boolean;
  blocked: boolean;
  createdAt: string;
  updatedAt: string;
  profile?: Record<string, any>;
}

export default {
  async register(ctx: Context) {
    
    console.log("🚀 ~ register ~ ctx.request.body:", ctx.request.body)
    const { username, email, password, profile } = ctx.request.body as {
      username: string;
      email: string;
      password: string;
      profile?: Record<string, any>;
    };

    // Validate required fields
    if (!username || !email || !password) {
      return ctx.badRequest('Missing required fields: username, email, and password are required');
    }

    try {
      // Access Strapi instance from global namespace
      const strapi = global.strapi;

      // Register user with custom fields
      const user = await strapi
        .plugin('users-permissions')
        .service('user')
        .add({
          username,
          email,
          password,
          profile, // Include profile field
          provider: 'local',
          confirmed: false,
          blocked: false,
          role: await strapi
            .query('plugin::users-permissions.role')
            .findOne({ where: { type: 'authenticated' } }),
        });

      // Generate JWT
      const jwt = strapi.plugin('users-permissions').service('jwt').issue({
        id: user.id,
      });

      // Sanitize user (remove sensitive fields like password)
      const sanitizedUser = await strapi
        .plugin('users-permissions')
        .service('user')
        .sanitizeUser(user);

      // Return user and JWT
      ctx.body = {
        jwt,
        user: sanitizedUser,
      };
    } catch (error) {
      ctx.badRequest(error.message || 'An error occurred during registration');
    }
  },
};