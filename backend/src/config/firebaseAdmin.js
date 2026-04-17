const admin = require('firebase-admin');
const { env } = require('./env');
const { logger } = require('./logger');

let firebaseAdminApp = null;

const getFirebaseAdminOptions = () => {
  const options = {};
  const bucketName = String(env.FIREBASE_STORAGE_BUCKET || '').trim();
  if (bucketName) {
    options.storageBucket = bucketName;
  }

  const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '')
    .trim()
    .replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    options.credential = admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    });
  }

  return options;
};

const getFirebaseAdminApp = () => {
  if (firebaseAdminApp) {
    return firebaseAdminApp;
  }

  if (admin.apps.length > 0) {
    firebaseAdminApp = admin.app();
    return firebaseAdminApp;
  }

  const options = getFirebaseAdminOptions();
  firebaseAdminApp = admin.initializeApp(options);
  logger.info('[FirebaseAdmin] initialized', {
    hasStorageBucket: Boolean(options.storageBucket),
    credentialMode: options.credential ? 'service_account_env' : 'application_default',
  });
  return firebaseAdminApp;
};

module.exports = {
  getFirebaseAdminApp,
};
