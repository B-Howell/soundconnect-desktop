import { createContext, useContext } from "react";
import { useStore } from "zustand";
import { engineStore, type EngineState, type EngineStore } from "./engineStore";

/**
 * Which engine store the hooks read. The app uses the default (`engineStore`);
 * tests wrap a tree in `EngineStoreProvider` with a store over a mock or spy api.
 */
const EngineStoreContext = createContext<EngineStore>(engineStore);

export const EngineStoreProvider = EngineStoreContext.Provider;

/** The store itself, for actions (`getState().send(...)`) without subscribing. */
export function useEngineStoreApi(): EngineStore {
  return useContext(EngineStoreContext);
}

/** Subscribes to one slice. Select stored values or primitives, never a new object per call. */
export function useEngine<T>(selector: (state: EngineState) => T): T {
  return useStore(useEngineStoreApi(), selector);
}
