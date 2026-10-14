import { CodecBadge } from "../shell/CodecBadge";
import "./TrackInfo.css";

export interface TrackInfoProps {
  title?: string;
  artist?: string;
  album?: string;
  /** Active codec, shown as a badge beside the text when known. */
  codec?: string;
}

/**
 * Title over "artist · album", one line each with an ellipsis. With no
 * title the block reads "Nothing playing" (devices send empty texts when idle).
 */
export function TrackInfo({ title, artist, album, codec }: TrackInfoProps) {
  const name = title?.trim();
  const detail = [artist, album]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="track-info">
      <div className="track-info__text">
        {name ? (
          <>
            <p className="track-info__title" title={name}>
              {name}
            </p>
            {detail ? (
              <p className="track-info__detail" title={detail}>
                {detail}
              </p>
            ) : null}
          </>
        ) : (
          <p className="track-info__empty">Nothing playing</p>
        )}
      </div>
      {codec ? <CodecBadge codec={codec} /> : null}
    </div>
  );
}
