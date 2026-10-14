import { Card } from "../primitives/Card";
import { PlaceholderMessage } from "./PlaceholderMessage";

/**
 * What a device page shows while no headphones are connected (Status shows
 * the connection state): one quiet card under the page title, across the
 * page. No section label: the only label it could carry repeats the title
 * ("Sound" under "Sound"), so the `<h1>` names it alone.
 */
export function NotConnectedSection() {
  return (
    <Card>
      <PlaceholderMessage>Connect headphones to change these settings.</PlaceholderMessage>
    </Card>
  );
}
