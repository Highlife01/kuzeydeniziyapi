function configuredMailSecrets() {
  // Encrypts mailbox passwords stored in Firestore cukurovabartu-db (see secret-box.js).
  return ['MAIL_CREDENTIAL_KEY'];
}

module.exports = { configuredMailSecrets };
