import { Icon } from "../icons/Icon";
import { TextButton } from "../primitives/TextButton";
import "./ConnectFailureNote.css";

export interface ConnectFailureNoteProps {
  /** What happened and what to do (`failureText`). */
  text: string;
  onRetry: () => void;
}

/**
 * A failed connect, under the device list: a warning glyph, the advice for
 * the engine's reason, and Try again. An alert, so it is read once when it
 * appears.
 */
export function ConnectFailureNote({ text, onRetry }: ConnectFailureNoteProps) {
  return (
    <div className="connect-failure" role="alert">
      <Icon name="info" className="connect-failure__icon" />
      <p className="connect-failure__text">{text}</p>
      <TextButton emphasized onPress={onRetry}>
        Try again
      </TextButton>
    </div>
  );
}
