let store;

export function useStore() {
  if (store) return store;

  const zoom = ref(1);
  const panX = ref(0);
  const panY = ref(0);

  function resetView() {
    panX.value = 0;
    panY.value = 0;
    zoom.value = 1;
  }

  return (store = {
    zoom,
    panX,
    panY,

    resetView,
  });
}
