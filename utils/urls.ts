export const USE_REMOTE_DB: boolean = process.env.USE_REMOTE_DB === 'true' || false;
export const GROUPS_URL = USE_REMOTE_DB ? process.env.REMOTE_GROUPS_URL: process.env.GROUPS_URL;
export const FILES_SERVER_BASE = process.env.FILES_SERVER_BASE;
export const RBAC_URL = USE_REMOTE_DB ? process.env.REMOTE_RBAC_URL: process.env.RBAC_URL;
export const ANGULAR_URL = process.env.ANGULAR_URL;