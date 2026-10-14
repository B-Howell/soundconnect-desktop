---
title: "SoundConnect Desktop - Product Image Sources"
date: 2026-10-12
tags:
  - research
  - renderer
  - assets
project: "SoundConnect Desktop"
area: "research"
---

# SoundConnect Desktop - Product Image Sources

The product pictures in [public/devices](<../../public/devices/>) are Sony's
own product photos, one per supported model, used by
[DeviceImage.tsx](<../../src/components/device-art/DeviceImage.tsx>) through the
lookup in [models.ts](<../../src/lib/devices/models.ts>). How the app shows them
is in the renderer doc's
[Product images](<../renderer/SoundConnect Desktop - Renderer.md#product-images>)
section. This page records where each file came from so it can be checked or
fetched again.

**Terms.** Sony product image, © Sony. Used only to identify the user's own
device in this app; SoundConnect Desktop is not affiliated with or endorsed by
Sony. The pictures are not redrawn, traced, generated, recoloured or
retouched (the maintainer, 2026-10-12: "Every single image YOU make I HATE. I DO NOT
WANT YOUR IMAGES.").

## How they were obtained (2026-10-12)

- Sony's regional product pages (sony.co.uk, sony.ca) name each model's
  primary shot. Two kinds of URL serve them:
  - named Scene7 assets, `https://sony.scene7.com/is/image/sonyglobalsolutions/<asset>`,
    which plain `curl` can fetch; `?fmt=png-alpha&wid=1200` returns a
    1200 x 1200 RGBA PNG with a transparent background;
  - hashed images, `https://www.sony.co.uk/image/<hash>` (the same hash works
    on `www.sony.ca/image/`), used by the support pages and Sony's own
    store. These sit behind Akamai bot protection: `curl` and PowerShell
    `Invoke-WebRequest` get 403, so they were fetched by the Claude browser
    pane with `fmt=png-alpha&wid=1200` and posted unchanged (byte sizes
    compared) to a local receiver.
- `electronics.sony.com` is refused by the browser pane and by fetch tools;
  Sony Help Guide top images (`helpguide.sony.net/mdr/<model>/v1/en/contents/image/Top_image_<MODEL>.png`)
  exist for the XM3, XM4, XM5 and WF-1000XM4 but are 672 x 424 RGB on white,
  so they were not used.
- Each download went to `downloads/product-images/<MODEL>/` (git-ignored),
  was checked with PIL (format PNG, 1200 x 1200, mode RGBA, corners
  alpha 0) and viewed to confirm the model and the black colour. Then
  [the shipped files](<../../public/devices/>) were made: crop to the alpha
  bounding box plus a 2 % margin, saved as `<MODEL>.png` (no model needed
  downscaling: every crop is under 1200 px), and a 256 px `<MODEL>-thumb.png`
  (premultiplied-alpha Lanczos).

## Per model

All 13 are transparent PNGs in black. Size is the shipped full file /
thumbnail.

| Model | Source page | Image URL fetched | Size |
| --- | --- | --- | --- |
| WH-1000XM3 | https://www.sony.co.uk/electronics/support/wireless-headphones-bluetooth-headphones/wh-1000xm3 | https://www.sony.co.uk/image/eb0062b3db03748efc7f5ca3fd82ccc5?fmt=png-alpha&wid=1200 | 788 x 1136 / 178 x 256 |
| WH-1000XM4 | https://www.sony.co.uk/headphones/products/wh-1000xm4c (where the UK WH-1000XM4 page redirects) | https://sony.scene7.com/is/image/sonyglobalsolutions/primary_image_black?fmt=png-alpha&wid=1200 | 776 x 1134 / 175 x 256 |
| WH-1000XM5 | https://www.sony.co.uk/electronics/support/wireless-headphones-bluetooth-headphones/wh-1000xm5 | https://www.sony.co.uk/image/6145c1d32e6ac8e63a46c912dc33c5bb?fmt=png-alpha&wid=1200 | 747 x 1124 / 170 x 256 |
| WH-1000XM6 | https://www.sony.co.uk/headphones/products/wh-1000xm6 | https://sony.scene7.com/is/image/sonyglobalsolutions/WH1000XM6_Primary_image_Black?fmt=png-alpha&wid=1200 | 765 x 1138 / 172 x 256 |
| WH-CH720N | https://www.sony.co.uk/headphones/products/wh-ch720n | https://sony.scene7.com/is/image/sonyglobalsolutions/wh-ch720_Primary_image?fmt=png-alpha&wid=1200 | 847 x 1134 / 191 x 256 |
| WF-1000XM4 | https://www.sony.co.uk/electronics/support/wireless-headphones-bluetooth-headphones/wf-1000xm4 | https://sony.scene7.com/is/image/sonyglobalsolutions/Product%20primary%20image-1?fmt=png-alpha&wid=1200 | 1197 x 510 / 256 x 109 |
| WF-1000XM5 | https://www.sony.co.uk/headphones/products/wf-1000xm5 | https://sony.scene7.com/is/image/sonyglobalsolutions/Primary_image_black?fmt=png-alpha&wid=1200 | 1134 x 432 / 256 x 98 |
| WF-1000XM6 | https://www.sony.co.uk/headphones/products/wf-1000xm6 | https://sony.scene7.com/is/image/sonyglobalsolutions/WF-1000XM6_black-1?fmt=png-alpha&wid=1200 | 941 x 415 / 256 x 113 |
| WF-C510 | https://www.sony.co.uk/headphones/products/wf-c510 | https://sony.scene7.com/is/image/sonyglobalsolutions/C510_Primary_image_black?fmt=png-alpha&wid=1200 | 1134 x 416 / 256 x 94 |
| WF-C700N | https://www.sony.co.uk/headphones/products/wf-c700n | https://sony.scene7.com/is/image/sonyglobalsolutions/WF-C700N_Primary_1200x1200?fmt=png-alpha&wid=1200 | 1134 x 495 / 256 x 112 |
| WF-L910 (LinkBuds Open) | https://www.sony.co.uk/headphones/products/linkbuds-open | https://sony.scene7.com/is/image/sonyglobalsolutions/Primary_image_1200_black-4?fmt=png-alpha&wid=1200 | 1124 x 639 / 256 x 146 |
| WF-LC900 (LinkBuds Clip) | https://www.sony.co.uk/headphones/products/linkbuds-clip | https://sony.scene7.com/is/image/sonyglobalsolutions/WF-LC900_Black_Primary_image?fmt=png-alpha&wid=1200 | 914 x 882 / 256 x 247 |
| WF-LS900N (LinkBuds S) | https://www.sony.ca/en/audio/headphones/all-headphones/p/wfls900n-b | https://www.sony.ca/image/74e8e0020c7f77d574f7dfb3192735da?fmt=png-alpha&wid=1200 | 1105 x 477 / 256 x 111 |

Notes:

- Scene7 asset names are not always model-specific (`primary_image_black`
  is the WH-1000XM4, `Primary_image_black` a different asset showing the
  WF-1000XM5). Each download was viewed, and all 13 files have different
  MD5 hashes.
- The WH-1000XM4 photo is the one Sony UK shows for the WH-1000XM4C (the
  current UK listing of the same headphones); it is the black WH-1000XM4.
- The LinkBuds S support page's image (`6e4959a4…`) is a 1200 x 400 banner
  with a 333 px product, so the sony.ca store's hero shot was used instead.
- Fallbacks: an unknown `WH-` model shows WH-1000XM5, an unknown `WF-` or
  LinkBuds model WF-1000XM5, and an unknown device WH-1000XM5.

## Adding a model

Find the model's primary shot on a Sony product or support page, fetch it
as `png-alpha` at 1200 px, check it with PIL and by eye, crop and thumbnail
it the same way, add a row here, and add the model to `DEVICE_MODELS` in
[models.ts](<../../src/lib/devices/models.ts>);
[models.test.ts](<../../tests/device-art/models.test.ts>) fails until both files
exist and nothing extra is shipped.
