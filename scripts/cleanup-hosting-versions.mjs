/**
 * Keeps only the latest 5 finalized Firebase Hosting versions for the active site
 * using Firebase CLI authentication token via the Firebase Hosting REST API.
 */
async function cleanupHostingVersions() {
  const siteId = process.env.FIREBASE_HOSTING_SITE || "kuzeydenizi";
  const keepCount = 5;

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
      console.log(`[cleanup-hosting] Toplam ${versions.length} sürüm var (limit: ${keepCount}), silinecek sürüm yok.`);
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
    console.log(`[cleanup-hosting] Son ${keepCount} sürüm korundu, ${deleted} eski sürüm temizlendi.`);
  } catch (err) {
    console.warn("[cleanup-hosting] Uyarı:", err?.message || err);
  }
}

cleanupHostingVersions();
