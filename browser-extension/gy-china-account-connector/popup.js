async function countTabs(patterns) {
  let total = 0;
  for (const pattern of patterns) {
    total += (await chrome.tabs.query({ url: pattern })).length;
  }
  return total;
}

async function refresh() {
  const manifest = chrome.runtime.getManifest();
  document.getElementById("version").textContent = `확장 버전 ${manifest.version}`;
  const [gy, douyin, xhs] = await Promise.all([
    countTabs(["https://gy-nexus-zfpq.vercel.app/*", "https://app.gywealthlab.com/*", "http://localhost:3000/*"]),
    countTabs(["https://*.douyin.com/*"]),
    countTabs(["https://*.xiaohongshu.com/*"]),
  ]);
  document.getElementById("gyTabs").textContent = `${gy}개`;
  document.getElementById("douyinTabs").textContent = `${douyin}개`;
  document.getElementById("xhsTabs").textContent = `${xhs}개`;
}

document.getElementById("openGy").addEventListener("click", () => chrome.tabs.create({ url: "https://gy-nexus-zfpq.vercel.app/admin/revenue-shorts" }));
document.getElementById("openDouyin").addEventListener("click", () => chrome.tabs.create({ url: "https://www.douyin.com/" }));
document.getElementById("openXhs").addEventListener("click", () => chrome.tabs.create({ url: "https://www.xiaohongshu.com/" }));
void refresh();
