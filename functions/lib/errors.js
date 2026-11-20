function publicError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.public = true;
  return err;
}

function toClient(err) {
  if (err && err.public && err.status) return { status: err.status, error: err.message };
  if (err && err.type === 'entity.too.large') return { status: 413, error: 'İleti çok büyük.' };
  if (err && (err.code === 'LIMIT_FILE_SIZE' || err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE')) {
    return { status: 400, error: 'Ek yüklenemedi.' };
  }
  return { status: 500, error: 'Bağlantı hatası' };
}

module.exports = { publicError, toClient };
