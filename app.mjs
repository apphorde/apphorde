import { ref, computed, watch, loadCss } from "@li3/web";
import useStore, { storeToRefs } from "@app/store.mjs";

export default function () {
  const store = useStore();
  const { panX, panY, zoom } = storeToRefs(store);

  loadCss(
    "https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css",
  );

  const applets = ref(
    JSON.parse(localStorage.getItem("workspace-applets") || "[]"),
  );

  const draggingApplet = ref("");
  const resizingApplet = ref("");
  const dragOffsetX = ref(0);
  const dragOffsetY = ref(0);
  const resizeEdge = ref("");
  const resizeStartX = ref(0);
  const resizeStartY = ref(0);
  const resizeStartWidth = ref(0);
  const resizeStartHeight = ref(0);
  const resizeAppletX = ref(0);
  const resizeAppletY = ref(0);

  const nextZIndex = computed(() => {
    const list = applets.value;
    if (list.length === 0) return 1;
    return Math.max(...list.map((a) => a.zIndex || 0)) + 1;
  });

  watch(applets, (value) => {
    localStorage.setItem("workspace-applets", JSON.stringify(value));
  });

  function onDraw($event) {
    const { x, y, width, height } = $event.detail;
    const newApplet = {
      id: `applet-${Date.now()}`,
      x,
      y,
      width,
      height,
      appletId: "",
      loaded: false,
      zIndex: nextZIndex.value,
    };
    applets.value = [...applets.value, newApplet];
  }

  function updateApplet(id, updates) {
    const applet = applets.value.find((a) => a.id === id);

    if (applet) {
      Object.assign(applet, updates);
      applets.value = applets.value.slice();
    }
  }

  function bringToFront(id) {
    updateApplet(id, { zIndex: nextZIndex.value });
  }

  function onDragStart(applet, e) {
    const pos = store.screenToCanvas(e.clientX, e.clientY);
    draggingApplet.value = applet.id;
    dragOffsetX.value = pos.x - applet.x;
    dragOffsetY.value = pos.y - applet.y;
    bringToFront(applet.id);
  }

  function onDragStop() {
    draggingApplet.value = "";
  }

  function onMove(e) {
    const { x, y } = e.detail;

    if (draggingApplet.value) {
      const pos = store.screenToCanvas(x, y);
      updateApplet(draggingApplet.value, {
        x: pos.x - dragOffsetX.value,
        y: pos.y - dragOffsetY.value,
      });
    }

    if (resizingApplet.value && resizeEdge.value) {
      const pos = store.screenToCanvas(x, y);
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

  function onResizeStart(applet, e) {
    const pos = store.screenToCanvas(e.clientX, e.clientY);
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

  function onResizeStop() {
    resizingApplet.value = "";
    resizeEdge.value = "";
  }

  function onSelect(applet, app) {
    updateApplet(applet.id, { appletId: app.id, loaded: true, app });
  }

  function onDelete(applet) {
    applets.value = applets.value.filter((a) => a.id !== applet.id);
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

  function onResetView() {
    store.resetView();
  }

  return {
    showAllApplets,
    tileApplets,
    clearAll,
    onDragStart,
    onDragStop,
    onResizeStart,
    onResizeStop,
    onDelete,
    onSelect,
    onResetView,
    onMove,
    onDraw,
    applets,
    draggingApplet,
    resizingApplet,
  };
}
