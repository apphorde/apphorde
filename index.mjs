import { ref } from "@li3/web";

export function getApps() {
  const apps = [
    {
      name: "Crontab Generator",
      slug: "crontab-generator",
      icon: "/icon.svg",
      description: "Generate crontab expressions with a little help from AI",
    },
    {
      name: "Transcriber",
      slug: "transcriber",
      icon: "/icon.svg",
      description: "Convert voice to text.",
    },
    {
      name: "Imaginator",
      slug: "imaginator",
      icon: "/icon.svg",
      description:
        "Transform your words into stunning visuals with an AI-powered image generator.",
    },
    {
      name: "Tuya Control",
      slug: "tuya-control",
      icon: "/assets/icon.svg",
      description: "A room controller for Tuya-powered devices.",
    },
    {
      name: "Quizzer",
      slug: "quizzer",
      icon: "/assets/icon.svg",
      description: "A flashcards game with an API for deck creation.",
    },
    {
      name: "Pomodoro",
      slug: "pomodoro",
      icon: "/assets/icon.svg",
      description: "Focus on your tasks with this simple timer.",
    },
    {
      name: "Todo",
      slug: "todo",
      icon: "/assets/icon.svg",
      description: "Yet another todo list.",
    },
    {
      name: "Narrator",
      slug: "narrator",
      icon: "/narrator.svg",
      description: "Text to voice app.",
    },
  ];

  const getUrl = (app) => new URL(`https://${app.slug}.apphor.de`);
  const getIcon = (app) => new URL(app.icon, `https://${app.slug}.apphor.de`);

  return { apps, getUrl, getIcon };
}

export default function () {
  const applets = ref(
    JSON.parse(localStorage.getItem("workspace-applets") || "[]"),
  );

  const zoom = ref(1);
  const panX = ref(0);
  const panY = ref(0);
  const isDrawing = ref(false);
  const drawStartX = ref(0);
  const drawStartY = ref(0);
  const drawCurrentX = ref(0);
  const drawCurrentY = ref(0);
  const isPanning = ref(false);
  const panStartX = ref(0);
  const panStartY = ref(0);
  const draggingApplet = ref(null);
  const dragOffsetX = ref(0);
  const dragOffsetY = ref(0);
  const resizingApplet = ref(null);
  const resizeEdge = ref(null);
  const resizeStartX = ref(0);
  const resizeStartY = ref(0);
  const resizeStartWidth = ref(0);
  const resizeStartHeight = ref(0);
  const resizeAppletX = ref(0);
  const resizeAppletY = ref(0);
  const toolbarCollapsed = ref(false);
  const instructionsCollapsed = ref(true);

  // Computed next z-index
  const nextZIndex = computed(() => {
    const list = applets.value;
    if (list.length === 0) return 1;
    return Math.max(...list.map((a) => a.zIndex || 0)) + 1;
  });

  // Save applets to localStorage when they change
  watch(applets, (value) => {
    localStorage.setItem("workspace-applets", JSON.stringify(value));
  });

  // ============== Helper Functions ==============
  function screenToCanvas(screenX, screenY) {
    return {
      x: (screenX - panX.value) / zoom.value,
      y: (screenY - panY.value) / zoom.value,
    };
  }

  function getAppletById(id) {
    return applets.value.find((a) => a.id === id);
  }

  function updateApplet(id, updates) {
    applets.value = applets.value.map((a) =>
      a.id === id ? { ...a, ...updates } : a,
    );
  }

  function bringToFront(id) {
    updateApplet(id, { zIndex: nextZIndex.value });
  }

  // ============== Event Handlers ==============
  function handleMouseDown(e) {
    const canvas = document.getElementById("canvas");
    if (e.target !== canvas) return;

    if (e.button === 1 || e.ctrlKey || e.metaKey) {
      isPanning.value = true;
      panStartX.value = e.clientX - panX.value;
      panStartY.value = e.clientY - panY.value;
    } else if (e.button === 0) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      isDrawing.value = true;
      drawStartX.value = pos.x;
      drawStartY.value = pos.y;
      drawCurrentX.value = pos.x;
      drawCurrentY.value = pos.y;
    }
  }

  function handleMouseMove(e) {
    if (isPanning.value) {
      panX.value = e.clientX - panStartX.value;
      panY.value = e.clientY - panStartY.value;
      updateTransform();
      updateBackground();
    } else if (isDrawing.value) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      drawCurrentX.value = pos.x;
      drawCurrentY.value = pos.y;
      updateDrawPreview();
    } else if (draggingApplet.value) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      updateApplet(draggingApplet.value, {
        x: pos.x - dragOffsetX.value,
        y: pos.y - dragOffsetY.value,
      });
      renderApplets();
    } else if (resizingApplet.value && resizeEdge.value) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const deltaX = pos.x - resizeStartX.value;
      const deltaY = pos.y - resizeStartY.value;

      let newX = resizeAppletX.value;
      let newY = resizeAppletY.value;
      let newWidth = resizeStartWidth.value;
      let newHeight = resizeStartHeight.value;

      const edge = resizeEdge.value;

      if (edge.includes("e")) {
        newWidth = Math.max(100, resizeStartWidth.value + deltaX);
      }
      if (edge.includes("w")) {
        const widthChange = Math.min(deltaX, resizeStartWidth.value - 100);
        newX = resizeAppletX.value + widthChange;
        newWidth = resizeStartWidth.value - widthChange;
      }
      if (edge.includes("s")) {
        newHeight = Math.max(100, resizeStartHeight.value + deltaY);
      }
      if (edge.includes("n")) {
        const heightChange = Math.min(deltaY, resizeStartHeight.value - 100);
        newY = resizeAppletY.value + heightChange;
        newHeight = resizeStartHeight.value - heightChange;
      }

      updateApplet(resizingApplet.value, {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      });
      renderApplets();
    }
  }

  function handleMouseUp() {
    if (isDrawing.value) {
      const width = Math.abs(drawCurrentX.value - drawStartX.value);
      const height = Math.abs(drawCurrentY.value - drawStartY.value);

      if (width >= 100 && height >= 100) {
        const newApplet = {
          id: `applet-${Date.now()}`,
          x: Math.min(drawStartX.value, drawCurrentX.value),
          y: Math.min(drawStartY.value, drawCurrentY.value),
          width,
          height,
          appletId: null,
          loaded: false,
          zIndex: nextZIndex.value,
        };
        applets.value = [...applets.value, newApplet];
        renderApplets();
      }
    }

    isDrawing.value = false;
    isPanning.value = false;
    draggingApplet.value = null;
    resizingApplet.value = null;
    resizeEdge.value = null;
    hideDrawPreview();
  }

  function handleWheel(e) {
    e.preventDefault();
    e.stopPropagation();

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const prevZoom = zoom.value;
    const newZoom = Math.min(Math.max(prevZoom * delta, 0.1), 5);

    const canvas = document.getElementById("canvas");
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    panX.value = mouseX - ((mouseX - panX.value) / prevZoom) * newZoom;
    panY.value = mouseY - ((mouseY - panY.value) / prevZoom) * newZoom;
    zoom.value = newZoom;

    updateTransform();
    updateBackground();
    updateZoomDisplay();
  }

  function startDragApplet(appletId, e) {
    e.stopPropagation();
    const applet = getAppletById(appletId);
    if (!applet) return;

    const pos = screenToCanvas(e.clientX, e.clientY);
    draggingApplet.value = appletId;
    dragOffsetX.value = pos.x - applet.x;
    dragOffsetY.value = pos.y - applet.y;
    bringToFront(appletId);
    renderApplets();
  }

  function startResizeApplet(appletId, edge, e) {
    e.stopPropagation();
    const applet = getAppletById(appletId);
    if (!applet) return;

    const pos = screenToCanvas(e.clientX, e.clientY);
    resizingApplet.value = appletId;
    resizeEdge.value = edge;
    resizeStartX.value = pos.x;
    resizeStartY.value = pos.y;
    resizeStartWidth.value = applet.width;
    resizeStartHeight.value = applet.height;
    resizeAppletX.value = applet.x;
    resizeAppletY.value = applet.y;
    bringToFront(appletId);
    renderApplets();
  }

  function selectApplet(instanceId, selectedAppletId) {
    updateApplet(instanceId, { appletId: selectedAppletId, loaded: true });
    renderApplets();
  }

  function deleteApplet(instanceId) {
    applets.value = applets.value.filter((a) => a.id !== instanceId);
    renderApplets();
  }

  function resetView() {
    panX.value = 0;
    panY.value = 0;
    zoom.value = 1;
    updateTransform();
    updateBackground();
    updateZoomDisplay();
  }

  function showAllApplets() {
    const list = applets.value;
    if (list.length === 0) return;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    list.forEach((applet) => {
      minX = Math.min(minX, applet.x);
      minY = Math.min(minY, applet.y);
      maxX = Math.max(maxX, applet.x + applet.width);
      maxY = Math.max(maxY, applet.y + applet.height);
    });

    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const boundingWidth = maxX - minX;
    const boundingHeight = maxY - minY;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const zoomX = viewportWidth / boundingWidth;
    const zoomY = viewportHeight / boundingHeight;
    const newZoom = Math.min(Math.max(Math.min(zoomX, zoomY), 0.1), 5);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    zoom.value = newZoom;
    panX.value = viewportWidth / 2 - centerX * newZoom;
    panY.value = viewportHeight / 2 - centerY * newZoom;

    updateTransform();
    updateBackground();
    updateZoomDisplay();
  }

  function tileApplets() {
    const list = applets.value;
    if (list.length === 0) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gap = 10;
    const tileWidth = (viewportWidth - gap * 3) / 2;
    const tileHeight = (viewportHeight - gap * 3) / 2;

    zoom.value = 1;
    panX.value = 0;
    panY.value = 0;

    applets.value = list.map((applet, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      return {
        ...applet,
        x: gap + col * (tileWidth + gap),
        y: gap + row * (tileHeight + gap),
        width: tileWidth,
        height: tileHeight,
      };
    });

    updateTransform();
    updateBackground();
    updateZoomDisplay();
    renderApplets();
  }

  function clearAll() {
    if (window.confirm("Are you sure you want to clear all applets?")) {
      applets.value = [];
      renderApplets();
    }
  }

  function toggleToolbar() {
    toolbarCollapsed.value = !toolbarCollapsed.value;
    updateToolbar();
  }

  function toggleInstructions() {
    instructionsCollapsed.value = !instructionsCollapsed.value;
    updateInstructions();
  }

  // ============== DOM Update Functions ==============
  function updateTransform() {
    const container = document.getElementById("transform-container");
    if (container) {
      container.style.transform = `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`;
    }
  }

  function updateBackground() {
    const canvas = document.getElementById("canvas");
    if (canvas) {
      const size = 20 * zoom.value;
      canvas.style.backgroundSize = `${size}px ${size}px`;
      canvas.style.backgroundPosition = `${panX.value}px ${panY.value}px`;
    }
  }

  function updateZoomDisplay() {
    const el = document.getElementById("zoom-display");
    if (el) {
      el.textContent = `Zoom: ${Math.round(zoom.value * 100)}%`;
    }
  }

  function updateToolbar() {
    const toolbarContent = document.getElementById("toolbar-content");
    const toolbarToggle = document.getElementById("toolbar-toggle");
    if (toolbarContent && toolbarToggle) {
      toolbarContent.style.display = toolbarCollapsed.value ? "none" : "flex";
      toolbarToggle.textContent = toolbarCollapsed.value ? "\u25B6" : "\u25C0";
      toolbarToggle.title = toolbarCollapsed.value
        ? "Expand toolbar"
        : "Collapse toolbar";
    }
  }

  function updateInstructions() {
    const instructionsContent = document.getElementById("instructions-content");
    const instructionsToggle = document.getElementById("instructions-toggle");
    if (instructionsContent && instructionsToggle) {
      instructionsContent.style.display = instructionsCollapsed.value
        ? "none"
        : "block";
      instructionsToggle.querySelector("svg").style.transform =
        instructionsCollapsed.value ? "rotate(0deg)" : "rotate(180deg)";
      instructionsToggle.title = instructionsCollapsed.value
        ? "Show instructions"
        : "Hide instructions";
    }
  }

  function updateDrawPreview() {
    const preview = document.getElementById("draw-preview");
    if (!preview) return;

    const x = Math.min(drawStartX.value, drawCurrentX.value);
    const y = Math.min(drawStartY.value, drawCurrentY.value);
    const width = Math.abs(drawCurrentX.value - drawStartX.value);
    const height = Math.abs(drawCurrentY.value - drawStartY.value);

    preview.style.display = "block";
    preview.style.left = `${x}px`;
    preview.style.top = `${y}px`;
    preview.style.width = `${width}px`;
    preview.style.height = `${height}px`;
    preview.querySelector("span").textContent =
      `${Math.round(width)} x ${Math.round(height)}`;
  }

  function hideDrawPreview() {
    const preview = document.getElementById("draw-preview");
    if (preview) preview.style.display = "none";
  }
}

function renderApplets() {
  applets.value.forEach((applet) => {
    const selectedApplet = applets.value.find((a) => a.id === applet.appletId);
    const isActive =
      draggingApplet.value === applet.id || resizingApplet.value === applet.id;

    const div = document.createElement("div");
    div.className = `absolute rounded-lg border-2 border-zinc-600 bg-zinc-800 shadow-xl overflow-hidden flex flex-col ${isActive ? "ring-2 ring-blue-500" : ""}`;
    div.style.cssText = `left: ${applet.x}px; top: ${applet.y}px; width: ${applet.width}px; height: ${applet.height}px; z-index: ${applet.zIndex || 1};`;
    div.onmousedown = (e) => e.stopPropagation();

    // Resize handles
    const edges = [
      {
        cls: "absolute top-0 left-2 right-2 h-1 cursor-n-resize hover:bg-blue-500/50",
        edge: "n",
      },
      {
        cls: "absolute bottom-0 left-2 right-2 h-1 cursor-s-resize hover:bg-blue-500/50",
        edge: "s",
      },
      {
        cls: "absolute left-0 top-2 bottom-2 w-1 cursor-w-resize hover:bg-blue-500/50",
        edge: "w",
      },
      {
        cls: "absolute right-0 top-2 bottom-2 w-1 cursor-e-resize hover:bg-blue-500/50",
        edge: "e",
      },
      {
        cls: "absolute top-0 left-0 w-2 h-2 cursor-nw-resize hover:bg-blue-500/50",
        edge: "nw",
      },
      {
        cls: "absolute top-0 right-0 w-2 h-2 cursor-ne-resize hover:bg-blue-500/50",
        edge: "ne",
      },
      {
        cls: "absolute bottom-0 left-0 w-2 h-2 cursor-sw-resize hover:bg-blue-500/50",
        edge: "sw",
      },
      {
        cls: "absolute bottom-0 right-0 w-2 h-2 cursor-se-resize hover:bg-blue-500/50",
        edge: "se",
      },
    ];

    edges.forEach(({ cls, edge }) => {
      const handle = document.createElement("div");
      handle.className = cls;
      handle.onmousedown = (e) => startResizeApplet(applet.id, edge, e);
      div.appendChild(handle);
    });

    // Header
    const header = document.createElement("div");
    header.className =
      "flex items-center justify-between bg-zinc-700 px-3 py-2 shrink-0 cursor-move select-none";
    header.onmousedown = (e) => startDragApplet(applet.id, e);

    const title = document.createElement("span");
    title.className = "text-sm text-white truncate pointer-events-none";
    title.textContent = selectedApplet
      ? `${selectedApplet.icon} ${selectedApplet.name}`
      : "Select an Applet";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.className =
      "ml-2 text-zinc-400 hover:text-red-400 transition-colors text-lg leading-none";
    closeBtn.textContent = "\u00D7";
    closeBtn.title = "Delete applet";
    closeBtn.onclick = () => deleteApplet(applet.id);
    closeBtn.onmousedown = (e) => e.stopPropagation();
    header.appendChild(closeBtn);

    div.appendChild(header);

    // Content
    const content = document.createElement("div");
    content.className = "flex-1 overflow-hidden";

    if (!applet.appletId) {
      // Applet selector grid
      const selector = document.createElement("div");
      selector.className = "h-full overflow-auto p-3 bg-zinc-900/50";

      const grid = document.createElement("div");
      grid.className = "grid grid-cols-4 gap-2";

      applets.value.forEach((app) => {
        const btn = document.createElement("button");
        btn.className =
          "flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-zinc-700/50 transition-colors group";
        btn.onclick = () => selectApplet(applet.id, app.id);

        const icon = document.createElement("span");
        icon.className = "text-2xl group-hover:scale-110 transition-transform";
        icon.textContent = app.icon;
        btn.appendChild(icon);

        const name = document.createElement("span");
        name.className =
          "text-xs text-zinc-300 text-center leading-tight truncate w-full";
        name.textContent = app.name;
        btn.appendChild(name);

        grid.appendChild(btn);
      });

      selector.appendChild(grid);
      content.appendChild(selector);
    } else if (selectedApplet) {
      // Iframe
      const iframe = document.createElement("iframe");
      iframe.src = selectedApplet.url;
      iframe.className = "w-full h-full border-0";
      iframe.title = selectedApplet.name;
      iframe.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-forms allow-popups",
      );
      content.appendChild(iframe);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className =
        "flex items-center justify-center h-full text-zinc-500";
      placeholder.textContent = "Loading...";
      content.appendChild(placeholder);
    }

    div.appendChild(content);
    container.appendChild(div);
  });

  // Update button states
  const showAllBtn = document.getElementById("show-all-btn");
  const tileBtn = document.getElementById("tile-btn");
  if (showAllBtn) showAllBtn.disabled = applets.value.length === 0;
  if (tileBtn) tileBtn.disabled = applets.value.length === 0;
}

// ============== Initialize App ==============
function initApp() {
  document.body.innerHTML = `

  `;

  // Bind events
  const canvas = document.getElementById("canvas");
  canvas.addEventListener("mousedown", handleMouseDown);
  canvas.addEventListener("mousemove", handleMouseMove);
  canvas.addEventListener("mouseup", handleMouseUp);
  canvas.addEventListener("mouseleave", handleMouseUp);
  canvas.addEventListener("wheel", handleWheel, { passive: false });

  // Toolbar buttons
  document.getElementById("toolbar-toggle").onclick = toggleToolbar;
  document.getElementById("instructions-toggle").onclick = toggleInstructions;
  document.getElementById("reset-btn").onclick = resetView;
  document.getElementById("show-all-btn").onclick = showAllApplets;
  document.getElementById("tile-btn").onclick = tileApplets;
  document.getElementById("clear-btn").onclick = clearAll;

  // Initial render
  renderApplets();
  updateZoomDisplay();
  updateToolbar();
  updateInstructions();
}
