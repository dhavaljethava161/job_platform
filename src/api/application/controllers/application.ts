// src/api/application/controllers/application.ts
import { Context } from 'koa';

export default {
  // POST /api/applications
  async create(ctx: Context) {
    console.log('🚀 Custom application create controller called!');
    console.log('🚀 Request body:', JSON.stringify(ctx.request.body, null, 2));

    // Check if user is authenticated
    if (!ctx.state.user) {
      return ctx.unauthorized('No authenticated user found');
    }

    // Check if user has Candidate role
    const userRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { id: ctx.state.user.role.id } });

    console.log('🚀 Fetched role:', JSON.stringify(userRole, null, 2));

    if (!userRole || userRole.type !== 'candidate') {
      return ctx.forbidden('Only Candidates can apply to jobs');
    }

    try {
      // Extract application data from request body
      const { data } = ctx.request.body as { data: any };

      if (!data || !data.job) {
        return ctx.badRequest('Missing job ID in request body');
      }

      // Validate job ID as integer
      const jobId = parseInt(data.job, 10);
      if (isNaN(jobId) || jobId <= 0) {
        return ctx.badRequest('Invalid job ID: must be a positive integer');
      }

      // Check if job exists and is published
      const job: any = await strapi.entityService.findOne(
        'api::job.job',
        jobId,
        {
          populate: { employer: true },
          filters: { publishedAt: { $ne: null } },
        }
      );

      console.log('🚀 Fetched job:', JSON.stringify(job, null, 2));

      if (!job) {
        return ctx.notFound('Job not found or not published');
      }

      // Check if candidate already applied
      const existingApplication = await strapi.entityService.findMany(
        'api::application.application',
        {
          filters: {
            job: { id: jobId },
            candidate: ctx.state.user.id,
          },
        }
      );

      if (existingApplication.length > 0) {
        return ctx.badRequest('You have already applied to this job');
      }

      // Create application
      const application = await strapi.entityService.create(
        'api::application.application',
        {
          data: {
            job: jobId,
            candidate: ctx.state.user.id,
            app_status: 'Submitted',
          },
        }
      );

      console.log(
        '🚀 Created application:',
        JSON.stringify(application, null, 2)
      );

      // Sanitize and transform the response
      const sanitizedApplication = {
        id: application.id,
        job: {
          id: job.id,
          title: job.title,
          employer: {
            id: job?.employer?.id,
            username: job?.employer?.username,
            email: job?.employer?.email,
            profile: job?.employer?.profile,
          },
        },
        candidate: {
          id: ctx.state.user.id,
          username: ctx.state.user.username,
          email: ctx.state.user.email,
          profile: ctx.state.user.profile,
        },
        app_status: application.app_status,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
      };

      console.log(
        '🚀 Sanitized application response:',
        JSON.stringify(sanitizedApplication, null, 2)
      );

      ctx.body = {
        data: sanitizedApplication,
        meta: {},
      };
    } catch (error) {
      console.error('🚀 Application create error:', error);
      ctx.badRequest(
        error.message || 'An error occurred while creating the application'
      );
    }
  },

  // GET /api/applications/me
  async findMe(ctx: Context) {
    console.log('🚀 Custom application findMe controller called!');

    // Check if user is authenticated
    if (!ctx.state.user) {
      return ctx.unauthorized('No authenticated user found');
    }

    // Check if user has Candidate role
    const userRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { id: ctx.state.user.role.id } });

    console.log('🚀 Fetched role:', JSON.stringify(userRole, null, 2));

    if (!userRole || userRole.type !== 'candidate') {
      return ctx.forbidden('Only Candidates can view their applications');
    }

    try {
      // Fetch applications for the authenticated candidate
      const applications = await strapi.entityService.findMany(
        'api::application.application',
        {
          filters: {
            candidate: ctx.state.user.id,
          },
          populate: { job: { populate: { employer: true } } },
        }
      );

      console.log(
        '🚀 Fetched applications:',
        JSON.stringify(applications, null, 2)
      );

      // Sanitize and transform the response
      const sanitizedApplications = applications.map((app: any) => ({
        id: app.id,
        job: app.job
          ? {
              id: app.job.id,
              title: app.job.title,
              employer: app.job.employer
                ? {
                    id: app.job.employer.id,
                    username: app.job.employer.username,
                    email: app.job.employer.email,
                    profile: app.job.employer.profile,
                  }
                : null,
            }
          : null,
        candidate: {
          id: ctx.state.user.id,
          username: ctx.state.user.username,
          email: ctx.state.user.email,
          profile: ctx.state.user.profile,
        },
        status: app.status,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      }));

      console.log(
        '🚀 Sanitized applications response:',
        JSON.stringify(sanitizedApplications, null, 2)
      );

      ctx.body = {
        data: sanitizedApplications,
        meta: {},
      };
    } catch (error) {
      console.error('🚀 Application findMe error:', error);
      ctx.badRequest(
        error.message || 'An error occurred while fetching applications'
      );
    }
  },

  // GET /api/applications/job/:id
  async findByJob(ctx: Context) {
    console.log('🚀 Custom application findByJob controller called!');
    console.log('🚀 Job ID:', ctx.params.id);

    // Validate ID as integer
    const jobId = parseInt(ctx.params.id, 10);
    if (isNaN(jobId) || jobId <= 0) {
      return ctx.badRequest('Invalid job ID: must be a positive integer');
    }

    // Check if user is authenticated
    if (!ctx.state.user) {
      return ctx.unauthorized('No authenticated user found');
    }

    // Check if user has Employer role
    const userRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { id: ctx.state.user.role.id } });

    console.log('🚀 Fetched role:', JSON.stringify(userRole, null, 2));

    if (!userRole || userRole.type !== 'employer') {
      return ctx.forbidden('Only Employers can view job applications');
    }

    try {
      // Fetch the job to verify ownership
      const job: any = await strapi.entityService.findOne(
        'api::job.job',
        jobId,
        {
          populate: { employer: true },
        }
      );

      console.log('🚀 Fetched job:', JSON.stringify(job, null, 2));

      if (!job) {
        return ctx.notFound(`Job with ID ${jobId} not found`);
      }

      if (job.employer?.id !== ctx.state.user.id) {
        return ctx.forbidden(
          'You can only view applications for jobs you created'
        );
      }

      // Fetch applications for the job
      const applications = await strapi.entityService.findMany(
        'api::application.application',
        {
          filters: {
            job: { id: jobId },
          },
          populate: { candidate: true },
        }
      );

      console.log(
        '🚀 Fetched applications:',
        JSON.stringify(applications, null, 2)
      );

      // Sanitize and transform the response
      const sanitizedApplications = applications.map((app: any) => ({
        id: app.id,
        job: {
          id: job.id,
          title: job.title,
        },
        candidate: app.candidate
          ? {
              id: app.candidate.id,
              username: app.candidate.username,
              email: app.candidate.email,
              profile: app.candidate.profile,
            }
          : null,
        status: app.status,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      }));

      console.log(
        '🚀 Sanitized applications response:',
        JSON.stringify(sanitizedApplications, null, 2)
      );

      ctx.body = {
        data: sanitizedApplications,
        meta: {},
      };
    } catch (error) {
      console.error('🚀 Application findByJob error:', error);
      ctx.badRequest(
        error.message || 'An error occurred while fetching applications'
      );
    }
  },
};
