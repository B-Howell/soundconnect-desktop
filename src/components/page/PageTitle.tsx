import "./PageTitle.css";

export interface PageTitleCrumb {
  label: string;
  /** Opens that page. */
  onSelect: () => void;
}

export interface PageTitleProps {
  children: string;
  id?: string;
  /** The page's ancestors, outermost first: shown before the title as links, Windows 11 Settings style ("Sound › Equalizer"). */
  trail?: readonly PageTitleCrumb[];
}

/**
 * The page heading at the top of the content column, Windows 11 Settings
 * style (28 px display semibold). For a sub-page the ancestors come first in
 * the same type, secondary ink, each a link back ("Back to Sound" as its
 * tooltip), then a chevron, then the page's own `<h1>`; the `<h1>` alone
 * names the page region. The links sit in a "Breadcrumb" navigation landmark.
 */
export function PageTitle({ children, id, trail = [] }: PageTitleProps) {
  if (trail.length === 0) {
    return (
      <h1 className="page-title" id={id}>
        {children}
      </h1>
    );
  }
  return (
    <div className="page-title page-title--trail">
      <nav className="page-title__trail" aria-label="Breadcrumb">
        <ol>
          {trail.map((crumb) => (
            <li key={crumb.label}>
              <button type="button" className="page-title__crumb" title={`Back to ${crumb.label}`} onClick={crumb.onSelect}>
                {crumb.label}
              </button>
              <span className="page-title__separator" aria-hidden="true">
                ›
              </span>
            </li>
          ))}
        </ol>
      </nav>
      <h1 className="page-title__current" id={id}>
        {children}
      </h1>
    </div>
  );
}
