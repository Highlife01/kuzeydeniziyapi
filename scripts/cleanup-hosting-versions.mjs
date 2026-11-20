/**
 * Keeps only the latest 5 finalized Firebase Hosting versions for the active sites
 * using Firebase CLI authentication token via the Firebase Hosting REST API.
 */
async function cleanupSiteVersions(siteId, accessToken, keepCount = 5) {
  const listUrl = `https://firebasehosting.googleapis.com/v1beta1/sites/${siteId}/versions?pageSize=50`;
  const res = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return;

  const data = await res.json();
  const versions = (data.versions || [])
    .filter((v) => v.status === "FINALIZED")
    .sort((a, b) => new Date(b.createTime || 0).getTime() - new Date(a.createTime || 0).getTime());

  if (versions.length <= keepCount) {
    console.log(`[cleanup-hosting:${siteId}] Toplam ${versions.length} sürüm var (limit: ${keepCount}), silinecek sürüm yok.`);
    return;
  }

  const toDelete = versions.slice(keepCount);
  let deleted = 0;
  for (const v of toDelete) {
    if (!v.name) continue;
    const delRes = await fetch(`https://firebasehosting.googleapis.com/v1beta1/${v.name}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (delRes.ok) deleted++;
  }
  console.log(`[cleanup-hosting:${siteId}] Son ${keepCount} sürüm korundu, ${deleted} eski sürüm temizlendi.`);
}

async function cleanupHostingVersions() {
  const sites = process.env.FIREBASE_HOSTING_SITE
    ? [process.env.FIREBASE_HOSTING_SITE]
    : ["kuzeyyildiziyapi"];

  try {
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs");

    const configPath = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
    if (!fs.existsSync(configPath)) {
      console.log("[cleanup-hosting] firebase-tools.json bulunamadı, atlanıyor.");
      return;
    }

    const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const accessToken = cfg?.tokens?.access_token;
    if (!accessToken) {
      console.log("[cleanup-hosting] Access token bulunamadı, atlanıyor.");
      return;
    }

    for (const siteId of sites) {
      await cleanupSiteVersions(siteId, accessToken, 5);
    }
  } catch (err) {
    console.warn("[cleanup-hosting] Uyarı:", err?.message || err);
  }
}

cleanupHostingVersions();
