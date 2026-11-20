const { loadEnv } = require('./lib/load-env');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { configuredMailSecrets } = require('./lib/mail-secrets');

loadEnv();
process.env.FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'cukurovabartu-db';

if (!admin.apps.length) {
  admin.initializeApp();
}

const { createApp } = require('./lib/create-app');
const app = createApp();

exports.cukurovabartuMailApi = onRequest({
  region: 'europe-west1',
  memory: '1GiB',
  cpu: 1,
  timeoutSeconds: 120,
  minInstances: 0,
  maxInstances: 4,
  concurrency: 20,
  invoker: 'public',
  cors: false,
  secrets: [...configuredMailSecrets()],
}, app);

exports.cukurovabartuMailScheduledDispatch = onSchedule({
  schedule: '*/5 * * * *',
  timeZone: 'Europe/Istanbul',
  region: 'europe-west1',
  memory: '256MiB',
  cpu: 1,
  timeoutSeconds: 120,
  minInstances: 0,
  maxInstances: 1,
  retryConfig: { retryCount: 1, maxRetrySeconds: 60 },
  secrets: [...configuredMailSecrets()],
}, async () => {
  const { dispatchDueScheduledEmails } = require('./lib/scheduled-mail');
  const result = await dispatchDueScheduledEmails();
  if (result.processed > 0) {
    logger.info('cukurovabartu_scheduled_mail_dispatch', result);
  }
});

if (require.main === module && !process.env.FUNCTION_TARGET && !process.env.K_SERVICE) {
  const port = Number(process.env.PORT || 8787);
  app.listen(port, '127.0.0.1', () => {
    console.log(`Cukurova Bartu Mail API http://127.0.0.1:${port}`);
  });
}
