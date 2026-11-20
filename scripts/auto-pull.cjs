const { execSync } = require("child_process");

function run() {
  try {
    const remotes = execSync("git remote", { encoding: "utf8" }).trim().split(/\s+/);
    if (!remotes.includes("origin")) {
      console.log("[auto-pull] 'origin' remote tanımlı değil. Çekme atlanıyor.");
      return;
    }
    console.log("[auto-pull] origin deposu taranıyor...");
    execSync("git fetch origin", { stdio: "inherit" });
    const remoteBranches = execSync("git branch -r", { encoding: "utf8" });
    if (!remoteBranches.includes("origin/main")) {
      console.log("[auto-pull] Uzak repoda henüz 'origin/main' dalı bulunmuyor (yeni repo).");
      return;
    }
    const status = execSync("git status --porcelain", { encoding: "utf8" }).trim();
    if (status) {
      console.log("[auto-pull] Çalışma alanında commit edilmemiş değişiklikler var, pull atlandı.");
      return;
    }
    execSync("git pull --rebase origin main", { stdio: "inherit" });
    console.log("[auto-pull] Başarıyla güncellendi.");
  } catch (err) {
    console.warn("[auto-pull] Uyarı: Güncelleme sırasında bir sorun oluştu:", err.message);
  }
}

run();
