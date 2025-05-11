import { factories } from '@strapi/strapi';
import { Context } from 'koa';

console.log('🚀 Loading job controller');

export default factories.createCoreController('api::job.job', ({ strapi }) => ({
  async create(ctx: Context) {
    // Check if user is authenticated
    if (!ctx.state.user) {
      return ctx.unauthorized('No authenticated user found');
    }

    // Check if user has Employer role
    const userRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { id: ctx.state.user.role.id } });

    if (!userRole || userRole.type !== 'employer') {
      return ctx.forbidden('Only Employers can create jobs');
    }

    // Extract job data from request body
    const { data } = ctx.request.body as { data: any };

    if (!data || !data.title || !data.description) {
      return ctx.badRequest(
        'Missing required fields: title and description are required'
      );
    }

    // Validate job_type if provided
    if (
      data.job_type &&
      !['Full-time', 'Part-time', 'Contract', 'Internship'].includes(
        data.job_type
      )
    ) {
      return ctx.badRequest(
        'Invalid job_type: must be one of Full-time, Part-time, Contract, Internship'
      );
    }

    try {
      // Add employer to the job data
      data.employer = ctx.state.user.id;

      // Create the job
      const job = await strapi.service('api::job.job').create({
        data: {
          ...data,
          ...(data?.published_at ? { published_at: new Date() } : {}),
        },
      });

      // Fetch the created job with populated employer
      let populatedJob = null;
      try {
        // Add slight delay to ensure database commit
        await new Promise((resolve) => setTimeout(resolve, 100));

        populatedJob = await strapi.entityService.findOne(
          'api::job.job',
          job.id,
          {
            populate: { employer: true },
          }
        );
      } catch (findError) {
        console.log('🚀 FindOne error:', findError);
      }

      // Sanitize and transform the response
      const sanitizedJob = {
        id: populatedJob?.id,
        title: populatedJob?.title,
        description: populatedJob?.description,
        location: populatedJob?.location,
        salary_range: populatedJob?.salary_range,
        job_type: populatedJob?.job_type,
        employer: {
          id: populatedJob?.employer?.id,
          username: populatedJob?.employer?.username,
          email: populatedJob?.employer?.email,
          profile: populatedJob?.employer?.profile,
        },
        createdAt: populatedJob?.createdAt,
        updatedAt: populatedJob?.updatedAt,
        publishedAt: populatedJob?.publishedAt,
      };

      return (ctx.body = {
        data: sanitizedJob,
        meta: {},
      });
    } catch (error) {
      console.log('🚀 Job creation error:', error);
      ctx.badRequest(
        error.message || 'An error occurred while creating the job'
      );
    }
  },
  async findOne(ctx: Context) {
    console.log('🚀 Custom job findOne controller called!');
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

    // Check user role (Employer or Candidate)
    const userRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { id: ctx.state.user.role.id } });

    console.log('🚀 Fetched role:', JSON.stringify(userRole, null, 2));

    if (!userRole || !['employer', 'authenticated'].includes(userRole.type)) {
      return ctx.forbidden('Only Employers and Candidates can view jobs');
    }

    try {
      // Prepare query based on role
      const query = {
        populate: { employer: true },
        filters:
          userRole.type === 'authenticated'
            ? { publishedAt: { $ne: null } }
            : {},
      };

      // Fetch the job by id (integer)
      const job = (await strapi.entityService.findOne('api::job.job', jobId, {
        populate: { employer: true },
        ...(userRole.type === 'authenticated'
          ? { filters: { publishedAt: { $ne: null } } }
          : {}),
      })) as any;

      console.log('🚀 Fetched job:', JSON.stringify(job, null, 2));

      if (!job) {
        return ctx.notFound(
          `Job with ID ${jobId} not found${userRole.type === 'candidate' ? ' or not published' : ''}`
        );
      }

      // Sanitize and transform the response
      const sanitizedJob = {
        id: job.id,
        title: job.title,
        description: job.description,
        location: job.location,
        salary_range: job.salary_range,
        job_type: job.job_type,
        employer: job.employer
          ? {
              id: job.employer.id,
              username: job.employer.username,
              email: job.employer.email,
              profile: job.employer.profile,
            }
          : null,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        publishedAt: job.publishedAt,
      };

      console.log(
        '🚀 Sanitized job response:',
        JSON.stringify(sanitizedJob, null, 2)
      );

      ctx.body = {
        data: sanitizedJob,
        meta: {},
      };
    } catch (error) {
      console.error('🚀 Job findOne error:', error);
      ctx.badRequest(
        error.message || 'An error occurred while fetching the job'
      );
    }
  },
  async update(ctx: Context) {
    console.log('🚀 Custom job update controller called!');
    console.log('🚀 Job ID:', ctx.params.id);
    console.log('🚀 Request body:', JSON.stringify(ctx.request.body, null, 2));

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
      return ctx.forbidden('Only Employers can update jobs');
    }

    try {
      // Fetch the existing job to verify ownership
      const job = (await strapi.entityService.findOne('api::job.job', jobId, {
        populate: { employer: true },
      })) as any;

      console.log('🚀 Existing job:', JSON.stringify(job, null, 2));

      if (!job) {
        return ctx.notFound('Job not found');
      }

      if (job.employer?.id !== ctx.state.user.id) {
        return ctx.forbidden('You can only update jobs you created');
      }

      // Extract job data from request body
      const { data } = ctx.request.body as { data: any };

      if (!data) {
        return ctx.badRequest('Missing data in request body');
      }

      // Define allowed fields to prevent invalid keys
      const allowedFields = [
        'title',
        'description',
        'location',
        'salary_range',
        'job_type',
      ];
      const filteredData = Object.keys(data)
        .filter((key) => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = data[key];
          return obj;
        }, {} as any);

      console.log(
        '🚀 Filtered update data:',
        JSON.stringify(filteredData, null, 2)
      );

      // Validate required fields if provided
      if (filteredData.title && !filteredData.title.trim()) {
        return ctx.badRequest('Title cannot be empty');
      }
      if (filteredData.description && !filteredData.description.trim()) {
        return ctx.badRequest('Description cannot be empty');
      }
      if (
        filteredData.job_type &&
        !['Full-time', 'Part-time', 'Contract', 'Internship'].includes(
          filteredData.job_type
        )
      ) {
        return ctx.badRequest(
          'Invalid job_type: must be one of Full-time, Part-time, Contract, Internship'
        );
      }

      // Update the job using built-in API
      //   const updatedJob = await strapi.entityService.update('api::job.job', jobId, {
      //     data: {
      //       ...filteredData,
      //       updatedAt: new Date(),
      //     },
      //   });

      const updatedJob = await strapi.entityService.update(
        'api::job.job',
        jobId,
        {
          data: {
            ...filteredData,
            updatedAt: new Date(),
          },
        }
      );

      console.log('🚀 Updated job:', JSON.stringify(updatedJob, null, 2));

      if (!updatedJob) {
        return ctx.notFound('Job not found or could not be updated');
      }

      // Use ctx.state.user for employer data
      const employerData = {
        id: ctx.state.user.id,
        username: ctx.state.user.username,
        email: ctx.state.user.email,
        profile: ctx.state.user.profile,
      };

      // Sanitize and transform the response
      const sanitizedJob = {
        id: updatedJob.id,
        title: updatedJob.title,
        description: updatedJob.description,
        location: updatedJob.location,
        salary_range: updatedJob.salary_range,
        job_type: updatedJob.job_type,
        employer: employerData,
        createdAt: updatedJob.createdAt,
        updatedAt: updatedJob.updatedAt,
        publishedAt: updatedJob.publishedAt,
      };

      console.log(
        '🚀 Sanitized job response:',
        JSON.stringify(sanitizedJob, null, 2)
      );

      ctx.body = {
        data: sanitizedJob,
        meta: {},
      };
    } catch (error) {
      console.error('🚀 Job update error:', error);
      ctx.badRequest(
        error.message || 'An error occurred while updating the job'
      );
    }
  },
}));
