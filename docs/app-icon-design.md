# TimeManage application icon

The icon combines a timer ring, a completed-task checkmark, and a mint progress segment on a deep teal tile. The simple silhouette stays readable at 32 pixels and follows the application's teal accent color.

## Source assets

- `src-tauri/icons/icon-source.png`: desktop master with transparent margins and rounded tile corners.
- `src-tauri/icons/icon-source-ios.png`: opaque, full-bleed iOS master. iOS applies the corner mask itself.
- `src-tauri/icons/`: generated desktop PNG, macOS ICNS, Windows ICO and Windows Store PNG files.
- `src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset/`: generated iPhone, iPad and App Store icons. Keep the existing `Contents.json` size mappings.

The production Tauri configuration consumes the desktop files directly. The Xcode asset catalog consumes the iOS files. Development icons under `src-tauri/icons-dev/` retain their separate identity.

## Regeneration

Generate into a temporary directory, then copy only the intended platform outputs:

```sh
npm run tauri -- icon src-tauri/icons/icon-source.png --output /tmp/timemanage-icon-desktop
npm run tauri -- icon src-tauri/icons/icon-source-ios.png --output /tmp/timemanage-icon-ios --ios-color '#0b6b65'
```

Copy the desktop generator's top-level PNG, ICNS and ICO outputs over the corresponding files in `src-tauri/icons/`. Copy the iOS generator's `ios/*.png` into the existing Xcode `AppIcon.appiconset`. Do not copy desktop padding into the iOS catalog. Do not replace either master with a generated smaller image.

Check the desktop PNGs at 32 and 128 pixels, validate ICNS/ICO dimensions, and validate every iOS image against `Contents.json`. Every iOS image must be opaque. Rebuild the application to include the new resources; replacing source files alone does not update an installed application.

## Generation prompts

Both master assets were made with the built-in image generation tool.

Desktop prompt:

> Use case: logo-brand. Asset type: production macOS Dock application icon for TimeManage, a time management and team task app. Create ONE final square icon, no presentation sheet. Modern restrained premium native desktop app aesthetic. A beautifully balanced rounded-square deep teal tile, subtly lighter jade-teal at upper left and deep forest teal at lower right, soft satin material, almost flat with very slight edge depth. Center one very bold white circular timer ring with a small gap at upper right; inside it a clean angular white clock hand that rises towards 2 o'clock and reads as a checkmark for completed tasks. The ring and hand form one memorable simple symbol, easily readable at 32px. Small mint green rounded segment at the ring's upper-right gap suggests progress; no miniature people, no extra badges. Icon tile fills about 88 percent of 1024x1024 canvas, centered with equal transparent margins, smoothly rounded macOS-like corners. Actual transparency outside tile, minimal tight shadow only, no background scene. Strong silhouette, precise geometry, optical balance, crisp edges, tasteful understated highlight, no glossy plastic, no glass effects, no sparkles, no ornate old-fashioned clock, no tiny ticks, no text, no letters, no watermark. Single icon, front-on orthographic view.

iOS edit prompt (desktop master as the edit target):

> Use case: precise-object-edit. Edit target: supplied newly designed TimeManage icon. Make the iOS App Store version of this exact same icon. Preserve the central white timer ring, mint progress segment and white checkmark/clock hand, their proportions, optical alignment and subtle depth EXACTLY. Change only the outer tile silhouette and background: extend the deep teal satin gradient tile to fill the entire square canvas edge to edge with square corners. No outer transparency, no rounded tile boundary, no external shadow, no border, no inset margin; iOS itself applies the corner mask. Keep central symbol at current scale and center. Opaque full bleed square icon artwork. No text, no watermark, no presentation mockup.
