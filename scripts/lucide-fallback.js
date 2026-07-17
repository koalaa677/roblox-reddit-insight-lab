(function () {
  if (window.lucide?.createIcons) return;

  const ns = "http://www.w3.org/2000/svg";
  const paths = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
    "chevron-down": '<path d="M6 9l6 6 6-6"/>',
    "external-link": '<path d="M14 5h5v5"/><path d="M10 14L19 5"/><path d="M19 14v5H5V5h5"/>',
    "refresh-cw": '<path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18 11a6 6 0 0 0-10-4l-4 4"/><path d="M6 13a6 6 0 0 0 10 4l4-4"/>',
    printer: '<path d="M7 17H5V9h14v8h-2"/><path d="M7 9V4h10v5"/><path d="M7 14h10v6H7z"/>',
    archive: '<path d="M4 7h16"/><path d="M6 7v13h12V7"/><path d="M9 11h6"/><path d="M5 4h14v3H5z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 10v6"/><path d="M12 7h.01"/>',
  };

  function fallbackPath(name) {
    if (paths[name]) return paths[name];
    if (name.includes("chart") || name.includes("activity")) return '<path d="M4 17l5-5 4 3 7-8"/>';
    if (name.includes("file")) return '<path d="M7 3h7l3 3v15H7z"/><path d="M14 3v4h4"/>';
    if (name.includes("message")) return '<path d="M5 5h14v10H8l-3 3z"/>';
    if (name.includes("gamepad")) return '<path d="M7 10h10l2 6-3 2-2-3h-4l-2 3-3-2z"/><path d="M8 13h3M9.5 11.5v3"/><path d="M15 13h.01"/>';
    if (name.includes("layout") || name.includes("layers")) return '<path d="M4 5h7v6H4z"/><path d="M13 5h7v6h-7z"/><path d="M4 13h16v6H4z"/>';
    if (name.includes("target") || name.includes("radar")) return '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>';
    return '<circle cx="12" cy="12" r="8"/><path d="M8 12h8"/>';
  }

  function createIcons() {
    document.querySelectorAll("i[data-lucide]").forEach((node) => {
      const name = node.getAttribute("data-lucide") || "";
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("data-lucide", name);
      if (node.className) svg.setAttribute("class", node.className);
      svg.innerHTML = fallbackPath(name);
      node.replaceWith(svg);
    });
  }

  window.lucide = { createIcons };
})();
