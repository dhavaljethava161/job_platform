import type { Core } from '@strapi/strapi';
export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {
    // Register phase (if needed)
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    try {
      // Find the default authenticated role (for Candidates)
      const authenticatedRole = await strapi.db
        .query('plugin::users-permissions.role')
        .findOne({
          where: { type: 'authenticated' },
        });

      if (!authenticatedRole) {
        throw new Error('Authenticated role not found');
      }

      // Check and create Employer role
      let employerRole = await strapi.db
        .query('plugin::users-permissions.role')
        .findOne({
          where: { type: 'employer' },
        });

      if (!employerRole) {
        employerRole = await strapi.db
          .query('plugin::users-permissions.role')
          .create({
            data: {
              name: 'Employer',
              type: 'employer',
              description:
                'Role for employers who can post jobs and view applicants',
            },
          });
        console.log('Created Employer role');
      }

      // Define permissions for Authenticated role (Candidates)
      const authenticatedPermissions = [
        // Authentication
        { action: 'plugin::users-permissions.auth.register', enabled: true },
        { action: 'plugin::users-permissions.auth.connect', enabled: true },
        { action: 'plugin::users-permissions.user.me', enabled: true },
        // Jobs
        { action: 'api::job.job.find', enabled: true },
        { action: 'api::job.job.findOne', enabled: true },
        // Applications
        { action: 'api::application.application.create', enabled: true },
        { action: 'api::application.application.me', enabled: true },
      ];

      // Define permissions for Employer role
      const employerPermissions = [
        // Authentication
        { action: 'plugin::users-permissions.auth.register', enabled: true },
        { action: 'plugin::users-permissions.auth.connect', enabled: true },
        { action: 'plugin::users-permissions.user.me', enabled: true },
        // Jobs
        { action: 'api::job.job.create', enabled: true },
        { action: 'api::job.job.find', enabled: true },
        { action: 'api::job.job.findOne', enabled: true },
        { action: 'api::job.job.update', enabled: true },
        { action: 'api::job.job.delete', enabled: true },
        // Applications
        { action: 'api::application.application.find', enabled: true },
        { action: 'api::application.application.findOne', enabled: true },
        { action: 'api::application.application.job', enabled: true },
      ];

      // Assign permissions to Authenticated role
      for (const perm of authenticatedPermissions) {
        const existingPerm = await strapi.db
          .query('plugin::users-permissions.permission')
          .findOne({
            where: {
              action: perm.action,
              role: authenticatedRole.id,
            },
          });

        if (!existingPerm) {
          await strapi.db.query('plugin::users-permissions.permission').create({
            data: {
              ...perm,
              role: authenticatedRole.id,
            },
          });
        }
      }

      // Assign permissions to Employer role
      for (const perm of employerPermissions) {
        const existingPerm = await strapi.db
          .query('plugin::users-permissions.permission')
          .findOne({
            where: {
              action: perm.action,
              role: employerRole.id,
            },
          });

        if (!existingPerm) {
          await strapi.db.query('plugin::users-permissions.permission').create({
            data: {
              ...perm,
              role: employerRole.id,
            },
          });
        }
      }

      console.log('Roles and permissions set up successfully');
    } catch (error) {
      console.error('Error setting up roles and permissions:', error);
    }
  },
};
