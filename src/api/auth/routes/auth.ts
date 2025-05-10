// src/api/auth/routes/auth.ts
export default {
  routes: [
    {
      method: 'POST',
      path: '/auth/local/register',
      handler: 'auth.register',
      config: { auth: false },
    },
  ],
};
