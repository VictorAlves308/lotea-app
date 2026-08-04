// Placeholder, committed only so Vercel's function detection finds a file
// here at checkout time (before any build command runs). Overwritten every
// deploy by `node scripts/bundle-vercel.mjs` — see vercel.json's buildCommand.
// If this exact file is ever served, the build step didn't run.
module.exports = (req, res) => {
  res.statusCode = 503;
  res.end('API not built — scripts/bundle-vercel.mjs did not run.');
};
