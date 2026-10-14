import { lazy, Suspense } from "react";
import { MotionConfig } from "framer-motion";
import { AppFrame } from "./components/frame/AppFrame";
import { AppRoot } from "./components/shell/AppRoot";
import { useApplyTheme } from "./hooks/useApplyTheme";
import { useGalleryRoute } from "./hooks/useGalleryRoute";
import { useEngineBootstrap } from "./state/useEngineBootstrap";
import { useSettingsSync } from "./state/useSettingsSync";
import { spring } from "./styles/motion";

// Dev-only and loaded on demand: in a production build `import.meta.env.DEV`
// is the constant false, so the import is dead code and no chunk is emitted.
const GalleryPage = import.meta.env.DEV ? lazy(() => import("./pages/GalleryPage")) : null;

export default function App() {
  const showGallery = useGalleryRoute();
  useApplyTheme();
  useEngineBootstrap();
  useSettingsSync();
  return (
    <MotionConfig reducedMotion="user" transition={spring}>
      {showGallery && GalleryPage ? (
        <AppFrame wordmark="SoundConnect" pageKey="gallery" title="Gallery">
          <Suspense fallback={null}>
            <GalleryPage />
          </Suspense>
        </AppFrame>
      ) : (
        <AppRoot />
      )}
    </MotionConfig>
  );
}
