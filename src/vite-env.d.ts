/// <reference types="vite/client" />

/** package.json `version`, injected by the `define` in vite.config.ts. */
declare const __APP_VERSION__: string;
/** Full upstream engine commit (submodule gitlink in HEAD) or "unknown", injected by vite.config.ts. */
declare const __ENGINE_COMMIT__: string;

interface ImportMetaEnv {
  /** "1" selects the recorded-snapshot mock engine (set by tools/dev-web.ps1). */
  readonly VITE_MOCK_ENGINE?: string;
  /** "0" starts the mock engine with no remembered headphones (first run, the setup wizard). */
  readonly VITE_MOCK_REMEMBERED?: string;
}
