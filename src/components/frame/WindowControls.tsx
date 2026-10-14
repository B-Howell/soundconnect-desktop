import { Icon, type IconName } from "../icons/Icon";
import { useWindowControls } from "../../hooks/useWindowControls";
import "./WindowControls.css";

interface WindowControlButtonProps {
  label: string;
  icon: IconName;
  onClick: () => void;
  variant?: "close";
}

function WindowControlButton({ label, icon, onClick, variant }: WindowControlButtonProps) {
  const className =
    variant === "close" ? "window-control window-control--close" : "window-control";
  return (
    <button type="button" className={className} aria-label={label} title={label} onClick={onClick}>
      <Icon name={icon} size={18} strokeWidth={1.25} />
    </button>
  );
}

/** Windows 11 caption buttons for the frameless window: 46 x 40 hit targets. */
export function WindowControls() {
  const { minimize, toggleMaximize, close, isMaximized } = useWindowControls();
  return (
    <div className="window-controls" role="group" aria-label="Window">
      <WindowControlButton label="Minimize" icon="minimize" onClick={minimize} />
      <WindowControlButton
        label={isMaximized ? "Restore down" : "Maximize"}
        icon={isMaximized ? "restore" : "maximize"}
        onClick={toggleMaximize}
      />
      <WindowControlButton label="Close" icon="close" onClick={close} variant="close" />
    </div>
  );
}
