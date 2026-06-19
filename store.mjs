let store;

export default function useStore() {
  if (store) return store;

  const zoom = ref(1);
  const panX = ref(0);
  const panY = ref(0);

  return (store = {
    zoom,
    panX,
    panY,
  });
}
