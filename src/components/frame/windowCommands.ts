/**
 * The slice of a Tauri window the title bar needs, expressed as an interface so
 * the handlers can be built against a fake in tests and against
 * `getCurrentWindow()` in the app.
 */
export interface WindowLike {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
}

export interface WindowCommands {
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
}

const noop = () => {};

export const noopWindowCommands: WindowCommands = {
  minimize: noop,
  toggleMaximize: noop,
  close: noop,
};

/**
 * Wrap window calls as fire-and-forget click handlers. A failure (for example a
 * missing capability) is reported once rather than surfacing as an unhandled
 * rejection from a button.
 */
export function bindWindowCommands(
  win: WindowLike,
  report: (error: unknown) => void = (error) => console.error(error),
): WindowCommands {
  const run = (action: () => Promise<void>) => () => {
    action().catch(report);
  };
  return {
    minimize: run(() => win.minimize()),
    toggleMaximize: run(() => win.toggleMaximize()),
    close: run(() => win.close()),
  };
}
