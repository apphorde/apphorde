import { ref, computed, watch, templateRef } from "@li3/web";

export default function () {
  // Reactive state
  const canvas = templateRef("canvas");
  const applets = ref(
    JSON.parse(localStorage.getItem("workspace-applets") || "[]"),
  );
  const selectedApplet = computed(() =>
    APPLETS.find((a) => a.id === applet.appletId),
  );

  const zoom = ref(1);
  const zoomText = computed(() => `Zoom: ${Math.round(zoom.value * 100)}%`);
  const zoomSize = computed(() => zoom.value * 20);
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
  const drawPreviewCoords = computed(() => {
    const x = Math.min(drawStartX.value, drawCurrentX.value);
    const y = Math.min(drawStartY.value, drawCurrentY.value);
    const width = Math.abs(drawCurrentX.value - drawStartX.value);
    const height = Math.abs(drawCurrentY.value - drawStartY.value);

    return { x, y, width, height };
  });
  const draggingApplet = ref("");
  const dragOffsetX = ref(0);
  const dragOffsetY = ref(0);
  const resizingApplet = ref(null);
  const resizeEdge = ref("");
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
    const applet = getAppletById(id);

    if (applet) {
      Object.assign(applet, updates);
    }
  }

  function bringToFront(id) {
    updateApplet(id, { zIndex: nextZIndex.value });
  }

  // ============== Event Handlers ==============
  function handleMouseDown(e) {
    if (e.target !== canvas.value) return;

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
    } else if (isDrawing.value) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      drawCurrentX.value = pos.x;
      drawCurrentY.value = pos.y;
    } else if (draggingApplet.value) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      updateApplet(draggingApplet.value, {
        x: pos.x - dragOffsetX.value,
        y: pos.y - dragOffsetY.value,
      });
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
      }
    }

    isDrawing.value = false;
    isPanning.value = false;
    draggingApplet.value = null;
    resizingApplet.value = null;
    resizeEdge.value = null;
  }

  function handleWheel(e) {
    e.preventDefault();
    e.stopPropagation();

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const prevZoom = zoom.value;
    const newZoom = Math.min(Math.max(prevZoom * delta, 0.1), 5);

    const canvas = document.getElementById("canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    panX.value = mouseX - ((mouseX - panX.value) / prevZoom) * newZoom;
    panY.value = mouseY - ((mouseY - panY.value) / prevZoom) * newZoom;
    zoom.value = newZoom;
  }

  function onDragStart(applet, event) {
    const e = event.detail;
    const pos = screenToCanvas(e.clientX, e.clientY);
    draggingApplet.value = applet.id;
    dragOffsetX.value = pos.x - applet.x;
    dragOffsetY.value = pos.y - applet.y;
    bringToFront(applet.id);
  }

  function onResizeStart(applet, event) {
    const e = event.detail;
    const pos = screenToCanvas(e.clientX, e.clientY);
    resizingApplet.value = applet.id;
    resizeEdge.value = e.edge;
    resizeStartX.value = pos.x;
    resizeStartY.value = pos.y;
    resizeStartWidth.value = applet.width;
    resizeStartHeight.value = applet.height;
    resizeAppletX.value = applet.x;
    resizeAppletY.value = applet.y;
    bringToFront(applet.id);
  }

  function selectApplet(instanceId, selectedAppletId) {
    updateApplet(instanceId, { appletId: selectedAppletId, loaded: true });
  }

  function deleteApplet(instanceId) {
    applets.value = applets.value.filter((a) => a.id !== instanceId);
  }

  function resetView() {
    panX.value = 0;
    panY.value = 0;
    zoom.value = 1;
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
  }

  function clearAll() {
    if (window.confirm("Are you sure you want to clear all applets?")) {
      applets.value = [];
    }
  }

  function toggleToolbar() {
    toolbarCollapsed.value = !toolbarCollapsed.value;
  }

  function toggleInstructions() {
    instructionsCollapsed.value = !instructionsCollapsed.value;
  }

  return {
    toggleToolbar,
    toggleInstructions,
    resetView,
    showAllApplets,
    tileApplets,
    clearAll,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    onDragStart,
    onResizeStart,
    APPLETS,
    applets,
    toolbarCollapsed,
    instructionsCollapsed,
    zoomSize,
    zoomText,
    drawPreviewCoords,
    selectedApplet,
  };
}
