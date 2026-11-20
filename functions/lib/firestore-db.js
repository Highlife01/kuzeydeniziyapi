// Safir Mail keeps its data in its own named Firestore database so it never
// shares collections with the other apps of the same Firebase project.
const DEFAULT_DATABASE = '(default)';
const SAFIR_DATABASE = 'cukurovabartu-db';

function databaseId(env = process.env) {
  return String(env.FIRESTORE_DATABASE_ID || SAFIR_DATABASE).trim() || SAFIR_DATABASE;
}

function firestoreOf(admin, env = process.env) {
  const id = databaseId(env);
  if (id === DEFAULT_DATABASE) return admin.firestore();
  const { getFirestore } = require('firebase-admin/firestore');
  return getFirestore(admin.app(), id);
}

// Returns `admin` with admin.firestore() bound to the configured database.
// Static members such as admin.firestore.FieldValue keep working unchanged.
function withDatabase(admin) {
  if (!admin || typeof admin.firestore !== 'function') return admin;
  const firestore = new Proxy(admin.firestore, {
    apply: () => firestoreOf(admin),
  });
  return new Proxy(admin, {
    get: (target, prop, receiver) => (prop === 'firestore' ? firestore : Reflect.get(target, prop, receiver)),
  });
}

module.exports = { firestoreOf, withDatabase, databaseId, DEFAULT_DATABASE, SAFIR_DATABASE };
