const title = "Bananify: toggle the banana party";
const pending = new Map();

async function toggle(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["artwork.js", "party.js", "toggle.js"],
    });
    await chrome.action.setBadgeText({ tabId, text: "" });
    await chrome.action.setTitle({ tabId, title });
  } catch (error) {
    console.warn("Bananify could not run on this page:", error);
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#863b20" });
    await chrome.action.setBadgeText({ tabId, text: "!" });
    await chrome.action.setTitle({
      tabId,
      title: "Can't bananify this page. Open a regular website and try again. Browser settings, extension stores, and some built-in viewers are protected.",
    });
  }
}

chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;
  const previous = pending.get(tab.id) ?? Promise.resolve();
  const next = previous.then(() => toggle(tab.id)).catch((error) => {
    console.warn("Bananify could not update its toolbar button:", error);
  });
  pending.set(tab.id, next);
  next.finally(() => {
    if (pending.get(tab.id) === next) pending.delete(tab.id);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;
  Promise.all([
    chrome.action.setBadgeText({ tabId, text: "" }),
    chrome.action.setTitle({ tabId, title }),
  ]).catch((error) => console.warn("Bananify could not reset its toolbar button:", error));
});
