document.querySelectorAll("[data-banana]").forEach((node) => node.append(bananaFeedArt.banana()));
document.querySelector("#monkey-portrait").append(bananaFeedArt.monkey());
document.querySelector("#launch").addEventListener("click", () => {
  const error = document.querySelector("#preview-error");
  try {
    bananaFeed.toggle();
    error.hidden = true;
  } catch (cause) {
    console.error(cause);
    error.textContent = "The banana party couldn't start. Please try a browser with Canvas 2D support.";
    error.hidden = false;
  }
});
document.querySelector("#save-note").addEventListener("click", () => {
  const input = document.querySelector("#note");
  document.querySelector("#note-status").textContent = input.value.trim()
    ? "Done! The website still works. Your note stays in this tab only."
    : "Try typing a note first. The bananas won't get in your way.";
});
