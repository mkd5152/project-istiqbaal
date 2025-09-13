// src/libs/authRedirect.js 
export function getAuthRedirectURL(path = '') {
  // PUBLIC_URL is "/project-istiqbaal" in production and empty on localhost
  const base = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
  const origin = window.location.origin; // http://localhost:3000 or https://mkd5152.github.io
  // Ensure single slash between base and path
  const suffix = path ? `/${path.replace(/^\/+/, '')}` : '';
  return `${origin}${base}${suffix}`;
}