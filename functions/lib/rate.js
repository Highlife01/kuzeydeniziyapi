const buckets = new Map();

function allow(key, limit, windowMs) {
  const now = Date.now();
  const fresh = (buckets.get(key) || []).filter((stamp) => now - stamp < windowMs);
  if (fresh.length >= limit) {
    buckets.set(key, fresh);
    return false;
  }
  fresh.push(now);
  buckets.set(key, fresh);
  if (buckets.size > 5000) {
    for (const [name, stamps] of buckets) {
      if (!stamps.some((stamp) => now - stamp < windowMs)) buckets.delete(name);
    }
  }
  return true;
}

function clientIp(req) {
  if (req.ip) return req.ip;
  const forwarded = String(req.headers['x-forwarded-for'] || '');
  const parts = forwarded.split(',').map((part) => part.trim()).filter(Boolean);
  return parts[0] || 'unknown';
}

module.exports = { allow, clientIp };
