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
    const hasMain = remoteBranches.includes("origin/main");
    const hasMaster = remoteBranches.includes("origin/master");
    const targetBranch = hasMain ? "main" : (hasMaster ? "master" : null);

    if (!targetBranch) {
      console.log("[auto-pull] Uzak repoda henüz 'origin/main' veya 'origin/master' dalı bulunmuyor.");
      return;
    }
    const status = execSync("git status --porcelain", { encoding: "utf8" }).trim();
    if (status) {
      console.log("[auto-pull] Çalışma alanında commit edilmemiş değişiklikler var, pull atlandı.");
      return;
    }
    execSync(`git pull --rebase origin ${targetBranch}`, { stdio: "inherit" });
    console.log(`[auto-pull] ${targetBranch} dalından başarıyla güncellendi.`);
  } catch (err) {
    console.warn("[auto-pull] Uyarı: Güncelleme sırasında bir sorun oluştu:", err.message);
  }
}

run();
