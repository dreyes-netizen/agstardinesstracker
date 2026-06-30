import 'server-only';
// Firebase Admin SDK (server). Verifies ID tokens / session cookies using a
// service-account credential from secret env vars.
//
// Initialization is LAZY: cert() throws if the env vars are missing, so we must
// not run it at import time — otherwise pages that merely import this module
// (e.g. the root layout via getSessionUser) would crash before env is set up,
// including the /login page. We only initialize on first actual use.
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

let cached: Auth | null = null;

export function getAdminAuth(): Auth {
  if (cached) return cached;
  const app: App = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // Env vars store the key with literal "\n" — restore real newlines.
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
  cached = getAuth(app);
  return cached;
}
