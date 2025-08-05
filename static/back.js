document.addEventListener("DOMContentLoaded", function () {
  const darkToggle = document.getElementById("dark-toggle");

  if (localStorage.getItem("darkMode") === "enabled") {
    document.body.classList.add("dark");
    if (darkToggle) darkToggle.textContent = "☀️";
  }

  if (darkToggle) {
    darkToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark");
      const isDark = document.body.classList.contains("dark");

      localStorage.setItem("darkMode", isDark ? "enabled" : "disabled");
      darkToggle.textContent = isDark ? "☀️" : "🌙";
    });
  }
});
