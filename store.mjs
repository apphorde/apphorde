import { ref } from '@li3/web';

let stores = new Map();

function defineStore(name, fn) {
  return function () {
    if (stores.has(name)) {
      return stores.get(name);
    }

    const store = fn();
    const view = {};
    const error = new Error('Store values are read-only');

    for (const [name, value] of Object.entries(store)) {
      if (typeof value === 'function') {
        view[name] = value;
      } else {
        Object.defineProperties(view, name, {
          get() {
            return store[name].value;
          },
          set() {
            throw error;
          }
        });
      }
    }

    stores.set(name, view);
    return view;
  }
}

export default defineStore('store', function useStore() {
  const zoom = ref(1);
  const panX = ref(0);
  const panY = ref(0);

  function resetView() {
    panX.value = 0;
    panY.value = 0;
    zoom.value = 1;
  }

  return {
    zoom,
    panX,
    panY,

    resetView,
  };
});

export function storeToRefs(store) {
  const refs = {};
  
  for (const [name, value] of Object.entries(store)) {
    if (typeof value !== 'function') {
      Object.defineProperty(refs, name, {
        get() {
          return computed(() => store[name]);
        }
      });
    }
  }

  return refs;
}