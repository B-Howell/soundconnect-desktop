import "./AboutHeader.css";

export interface AboutHeaderProps {
  name: string;
  version: string;
}

/** The app icon, name and version, centred above the About list as on iOS. */
export function AboutHeader({ name, version }: AboutHeaderProps) {
  return (
    <div className="about-header">
      {/* Decorative (the name is the text). Served from public/ in dev and copied into the bundle. */}
      <img className="about-header__icon" src="/icon.png" alt="" />
      <h3 className="about-header__name">{name}</h3>
      <p className="about-header__version">Version {version}</p>
    </div>
  );
}
