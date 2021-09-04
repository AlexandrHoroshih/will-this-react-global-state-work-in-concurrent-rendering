/* eslint-disable quotes */
/* eslint-disable prefer-destructuring */
/* eslint-disable import/prefer-default-export */
/* eslint-disable no-else-return */
/* eslint-disable no-confusing-arrow */
import { clearNode, step, createNode, is } from "effector";
import React from "react";
import { useSyncExternalStore } from "./use-ext-store";

// just copy-pasted original effector-react code
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;
const throwError = (message) => {
  throw Error(message);
};

function createWatch(store, fn, scope) {
  const seq = [step.run({ fn: (value) => fn(value) })];
  if (scope) {
    const node = createNode({ node: seq });
    const id = store.graphite.id;
    const scopeLinks = scope.additionalLinks;
    const links = scopeLinks[id] || [];
    scopeLinks[id] = links;
    links.push(node);
    return () => {
      const idx = links.indexOf(node);
      if (idx !== -1) links.splice(idx, 1);
      clearNode(node);
    };
  } else {
    const node = createNode({
      node: seq,
      parent: [store],
      family: { owners: store },
    });
    return () => {
      clearNode(node);
    };
  }
}

const stateReader = (store, scope) =>
  scope ? scope.getState(store) : store.getState();
const useNotifier = () => React.useReducer((n) => n + 1, 0)[1];

function useStoreBase(store, scope) {
  if (!is.store(store)) throwError("expect useStore argument to be a store");

  const currentValue = stateReader(store, scope);
  const inc = useNotifier();
  const currentStore = React.useRef({
    store,
    value: currentValue,
    pending: false,
  });
  useIsomorphicLayoutEffect(() => {
    const stop = createWatch(
      store,
      (upd) => {
        const ref = currentStore.current;
        if (!ref.pending) {
          ref.value = upd;
          ref.pending = true;
          inc();
          ref.pending = false;
        }
      },
      scope
    );
    const newValue = stateReader(store, scope);
    const ref = currentStore.current;
    if (ref.store === store && ref.value !== newValue) {
      ref.value = newValue;
      ref.pending = true;
      inc();
      ref.pending = false;
    }
    ref.store = store;
    return stop;
  }, [store, scope]);
  return currentValue;
}

// alt code with useExternalStore
function useExtBase(store) {
  const getSnapshot = React.useCallback(() => stateReader(store), [store]);
  const subscribe = React.useCallback((cb) => createWatch(store, cb), [store]);
  const state = useSyncExternalStore(subscribe, getSnapshot);

  return state;
}

// no-ssr version
export function useStore(store) {
  return useExtBase(store);
}
