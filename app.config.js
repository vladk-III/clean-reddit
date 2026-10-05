// Extends app.json. EXPO_BASE_URL lets the web build live under a sub-path,
// e.g. "/clean-reddit" for GitHub Pages.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
