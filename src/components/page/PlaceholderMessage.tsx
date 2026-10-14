import "./PlaceholderMessage.css";

export interface PlaceholderMessageProps {
  children: string;
}

/** One centred secondary line for an otherwise empty page or section. */
export function PlaceholderMessage({ children }: PlaceholderMessageProps) {
  return <p className="placeholder-message">{children}</p>;
}
