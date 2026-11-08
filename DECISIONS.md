# Decisions

Each entry records a choice that was not fixed by the brief, or a place where the brief left two requirements in tension. The simple option that keeps the application working and passes an acceptance check was preferred.

## Builds and test controls

1. **Test overrides are gated at build time, not only at runtime.** `__MOSS_TEST_BUILD__` is embedded by `electron.vite.config.ts`. A normal packaged release ignores `MOSS_MUSE_BASE_URL`, `MOSS_LICENSE_API_BASE`, `MOSS_E2E`, `MOSS_DEV_UNLOCK`, `MOSS_USER_DATA_DIR`, and every other override even if someone launches it with those variables. `npm run build:test` is the separate test build. This is slightly stronger than a runtime guard and means the release cannot be pointed at another host.
2. **The test build is still an unpackaged build for day-to-day Playwright runs.** The E2E suite runs `electron-vite` output directly and uses the override variables. That keeps the test loop fast while the packaged smoke check proves the release ignores the same variables.
3. **`MOSS_RELEASE=1` is the release gate trigger.** Every package script runs `node scripts/release-gate.mjs` first. With `MOSS_RELEASE=1` the build refuses while `LICENSE_STORE_URL` still points at `example.com`. Normal development builds skip the gate. The placeholder URL is not invented over. The Buy a License button stays hidden while the URL is a placeholder.
4. **The app has no auto-updater.** Updates are manual. This avoids an unsigned background update channel.
5. **The deb is assembled with `dpkg-deb` in `scripts/make-deb.mjs`.** electron-builder's bundled fpm calls `lchown` on staged files. This build filesystem maps new files to `nobody:nogroup` and returns EINVAL for that operation. electron-builder's deb target remains configured for a normal filesystem, but `npm run build:linux` uses the deterministic dpkg-deb path so both artifacts can be produced here. The resulting package has the normal `/opt` layout, desktop file, icons, setuid sandbox helper, and maintainer scripts.

## Data, secrets, and paths

6. **A local encryption fallback exists for machines without a system keyring.** Electron `safeStorage` reports `basic_text` and encryption unavailable on the headless Linux build host. Blocking setup there would make the app unusable on some minimal desktops. The fallback AES-256-GCM key is mode `0600`, the encrypted key file is separate, and Settings shows the approved keyring warning. The `backend` field reports `basic_text` so the warning is truthful.
7. **The renderer sees display paths but never sends them back.** Settings and About must show the library path, and “Copy path” must do the copy in the main process. These paths are display data. There is no renderer-supplied export folder anymore. Exports return only a count and a folder name, and “Open Folder” asks the main process to open the folder remembered for that project. The unused export-folder picker channel was removed. File import, export, open, and clipboard work all cross named IPC methods.
8. **The license key is encrypted in both `license.json` and the SQLite row.** A lost or partially backed up database can still recover the license file. The renderer receives only the last four characters. The Muse key is only in `secrets.bin`.
9. **The machine label is a random per-installation suffix, not a hardware serial.** It is enough to tell two activated computers apart and does not collect a hostname, MAC address, or disk serial. Machine identity uses the OS machine id only for the fallback fingerprint and never leaves the computer except as the store's `instance_name`.
10. **One window only.** A second launch focuses the existing window. This is the simplest correct desktop behavior for a single-library app.

## Plans, jobs, and images

11. **The user's words are never truncated.** The interface blocks text above 2,000 characters. The main process may still reject a composed request over 2,000 because a guard was appended. Guard text is never shortened or dropped to make room. If the palette clause does not fit, it is dropped. The reference guard has priority. Set directions are limited to 400 characters, so the normal plan path cannot hit the upper limit.
12. **Set review uses the latest attempt for each shot.** A newer failed retry means the shot is shown as failed even when an older ready image exists. Older ready images remain available for export. This matches the per-shot status the seller actually saw and prevents a failed retry from being hidden behind an old image.
13. **A remake adds versions.** “Make More” only fills missing shots. It only becomes a remake when every enabled shot already has a latest ready image. The confirmation names the extra images and the price.
14. **Set export includes every ready version when asked.** The newest version of each shot gets the unsuffixed filename, older versions get `-v2`, `-v3`, and so on. The numbering starts at the newest. `set.txt` still records the unsuffixed path.
15. **Format is selectable per project and per export.** The plan panel, photo version panel, Create panel, and set export dialog all save a format. Single-image export still remembers its own choices globally. This is slightly more control than the minimum, but it removes a hidden default.
16. **Local Adjust “Reset all” returns to the version's stored transform, not the original import.** The stored transform is what that version represents. A new local adjustment can be applied to any version without destroying its history.
17. **Crop “Free” is an explicit preset.** It starts from the existing crop or a four percent inset. Rotation and crop are applied in the main process before encoding. The preview is an approximation because CSS cannot exactly reproduce sharp's resampling, but the stored version is rendered by sharp.
18. **The badge is applied locally after each image is saved.** A missing or unreadable logo skips the badge and keeps the image. Badge opacity is clamped to 60 through 100 percent. The badge is never upscaled past the logo's native width.
19. **More images than requested are discarded.** The provider may return extra images. The client keeps only the requested number, stores them, and bills for every returned image in the response. This is visible in the job's actual cost and the usage row.
20. **A timeout is not aborted and can still be billed.** The client marks billing uncertain. The usage row stores a zero counted cost plus the error code, the ledger shows **Unknown**, the CSV leaves the cost blank, and monthly totals exclude it. The interface tells the seller that a request that timed out may still appear on the Meta bill. Aborting the local request would not undo a server-side charge.
21. **Only 429 is retried, twice after the first attempt.** `Retry-After` is honoured. A 401, 402, 403, policy refusal, or 5xx is final. A manual “Try Again” is the only retry for those cases.
22. **The queue default concurrency is two, configurable from one to four.** Queued items are cancelled cleanly. A request already in flight is allowed to finish and is billed once.
23. **The project format and shape are request settings, not a promise about every version.** A set's plan shape is shared, but imported source images and previous versions can have other aspect ratios. The interface shows the selected version's dimensions.

## Interface choices

24. **The app opens directly to the activation screen when no valid license is present.** The library is still reachable through Browse My Library when projects exist. This preserves the promise that a lapsed license never hides files.
25. **Grace is shown as a banner.** During the 14 day grace window, images can still be made. After grace, generation controls disappear and local adjustment and export remain available through the read-only library.
26. **“Add Your Key” in onboarding step four returns to the key step, not Settings.** The seller is still inside onboarding and has not completed a license or onboarding flow that would make the Settings route a natural detour. The key step does the same work as Settings.
27. **“Raise the Limit” opens Usage, not Settings, Usage.** The warning already links to the budget field. This is the shortest path to the control that resolves the warning. The discrepancy from the brief's wording is intentional.
28. **A dismissed keyring warning lasts for the session.** It is not another permanently hidden warning. The underlying basic-protection status remains visible in the API key section when expanded.
29. **Got It on the first-run confirmation is remembered.** It dismisses the information without creating a paid run. A seller who dismisses it will still see the price on the primary button before any paid action.
30. **“Finish later” on onboarding marks onboarding incomplete.** It records `onboardingDismissed`, returns to the Library, and the next launch opens the Library instead of forcing setup. The “Finish setting up” card offers Resume Setup until `onboardingDone` is explicitly set. It does not pretend a set was made. The card no longer marks onboarding complete as a side effect of a saved key.
31. **The setup prompt is a resume banner, not a completion side effect.** It appears while `onboardingDone` is false and offers Resume Setup. It never sets `onboardingDone` on its own. Logo, badge, and colors remain optional and live in Settings. The old business-name, what-you-sell, and marketplace fields stay removed because nothing consumes them; only colors and the logo badge affect output.
32. **Search and filters show a count of matching projects.** The library total is still the full project count. The month chip is a navigation control to Usage.
33. **Library pagination is 20 projects per page with Previous/Next controls.** The API request is capped at the same page size, so a large library never renders more than 20 cards at once. Search, filters, and sort changes return to page 1; deleting the last project on a page falls back to the new last page.
34. **Sample product images in empty states are clearly labeled examples.** They are static reference files, not fake user projects. The starter tiles show a sample render and the label “Example.”
35. **A photo import below 800 pixels on its long edge is allowed with a warning.** The warning uses the approved copy. The product requirement was to warn, not block.
36. **The comparison view is a CSS clip.** It shows the parent version on the left and the selected version on the right. It is deliberately not a pixel-difference view, because the seller is comparing appearance, not measuring it.
37. **The top bar back button returns to the library.** The rail also has a Back to Library button. The previous route is not used because the library is the stable home for a project.
38. **The rail collapses by viewport tier.** It is expanded only at desktop widths. The brief's 1024 pixel minimum and its narrow layout are both kept. The right panel becomes a sheet below 840 CSS pixels so the canvas never drops below its practical minimum.
39. **The small-window and zoom snapshots are capture-only.** Playwright's `toHaveScreenshot` can restore the Electron viewport before it takes the image, so the 1024 by 700 and 150% zoom captures are written fresh on every run. The 1440 by 900 light and dark screenshots use the 0.01 pixel-diff baseline.

## Packaging and platform

40. **The app is packaged without rebuilding native modules.** `npmRebuild` is false. `better-sqlite3` and `sharp` use N-API prebuilds, which are loaded from the unpacked `app.asar` directories. This keeps builds reproducible and avoids requiring a compiler on the owner's machine.
41. **The deb targets `libgtk-3-0` because Ubuntu 22.04 is a release target.** Newer Ubuntu releases resolve it through the t64 transition. The AppImage needs the distribution's FUSE package. Both notes are in the README.
42. **Windows and macOS are configured but not signed or built here.** The title bar overlay has a standard-frame fallback if a Windows shell rejects it. The DMG and NSIS artifacts still need their native build hosts and signing identities.
43. **Licenses are listed rather than copied in full.** The packaged app carries Electron's license files and every dependency's own package license. Font OFL files are in `resources/licenses`. `LICENSES.md` records the provenance of the reference people and tile samples.

## Testing

44. **The E2E suite is one serial journey.** It avoids hundreds of fresh activations and proves state transitions that a set of isolated tests would miss. It does not run in parallel.
45. **Axe is injected through the Chrome DevTools Protocol.** The production CSP refuses inline scripts, so `page.addScriptTag` cannot work. The source is evaluated through CDP and then removed with the page.
46. **The screenshot baseline lives in `tests/screenshots` and has no platform suffix.** This makes the deliverable screenshots the baseline. On a different font stack or display scale the owner can regenerate with `MOSS_UPDATE_SCREENS=1`. The 1024 and zoom images are regenerated by design.
47. **Fake servers are real HTTP servers on loopback.** The Muse and license tests exercise the real client code and the real error mapping, not a mocked fetch.
48. **The initial import cap is 40 MB and 5,000 pixels on the long edge.** The brief allowed a documented cap. The limits are constants and shown in the error copy. A 40 MB file is read into memory once. It is not chunked.

## Known departures

49. **Not every screen has a screenshot in every requested matrix cell.** The capture set covers all main screens at 1440 by 900 in light mode, dark mode for activation, onboarding, library, set review, photo, create, people, usage, and settings, and 1024 by 700 light for every main screen. Set plan and Set running are light only. The 150% zoom layout assertion covers every main screen, but only the library and set have 150% screenshots.
50. **The library journey creates 510 projects, but only 20 render at once.** The E2E test checks the page indicator, the 20-card bounds, the Previous/Next controls, list view, and search. A 2,000 image scroll frame-time profile and a project with 2,000 versions were not measured on this host. The acceptance owner should run those measurements on release hardware.
51. **Menu items are enabled from a small renderer context contract.** The renderer sends `editor`, `adjust`, undo and redo availability, selection, export, and zoom state to the main process. Export, Undo, Redo, Copy Image, zoom, and Toggle Panel are disabled when they cannot work. Paste stays enabled because it can create a Photo project from anywhere. The renderer still owns the keyboard shortcuts, so a global shortcut may emit a no-op command even when its menu item is disabled.
52. **The visual matrix and axe sweep cover representative states, not every dialog and every dark variant.** Dialogs are Radix components with focus trapping and labeled titles. A dialog-specific screenshot pass was not added.
53. **The real Meta key, real Meta invoice, real Lemon Squeezy license, two-machine activation, and Windows and macOS builds are unverified.** The code paths use the documented request shapes and fake HTTP hosts. This is the largest remaining verification gap.
54. **Native window chrome and generated-image colors are the only raw color literals outside `tokens.css`.** BrowserWindow background, Windows title-bar overlay, the fake Muse placeholder, and the vignette SVG cannot consume a CSS variable. Every renderer style color uses a token. The native colors mirror the canvas and surface tokens.
55. **The app guards a window close while images are in progress, then flushes a pending plan.** Closing the window with running items asks Quit or Stay before the close proceeds. After the user agrees, the main process asks the renderer to save a dirty plan and waits up to 450 ms. This is a small asynchronous close path, tested indirectly by every Playwright launch and close.
56. **The color eyedropper was removed entirely.** The custom logo sampler is gone, and Chromium's EyeDropper feature is disabled at startup so the native color chooser has no eyedropper button. The color well and hex field are the only color inputs; the picker no longer reads logo pixels or the screen.
57. **Studio directions are prefilled into the plan, not shown as placeholders.** Each shot starts with the studio's direction in an always-visible textarea so the seller can edit it in line. Plans saved with an empty direction are filled with the current default when loaded. The prompt fallback for an empty direction stays in place, and changing a shot's type resets its direction to the new default.
58. **New installs start in light mode.** The seed writes `theme = light` instead of following the system. Existing installs keep whatever they chose. Theme, density, and reduce motion live in Settings. Onboarding no longer includes a Make it yours step; it focuses on the Meta key, the first product, and the optional first set.
59. **The three tools are named Set Creator, Image Editor, and Image Generator.** The person preview's Create an Image action creates an image project with that person's portrait as its source and opens the Image Generator. The source image carries the person id, so the prompt uses a person-preservation guard instead of the product guard.

## Brand colors

60. **Saved brand colors have their own on/off switch.** The switch lives with the colors in Logo & Colors and defaults to on, so existing installs keep their behavior. Turning it off never deletes the palette; it only stops the first three colors from being added to a set or photo-change prompt. The queue enforces the switch, so a stale renderer cannot send a palette while it is off.

## Library selection

61. **Projects are selected with a hover checkbox and deleted in bulk.** The checkbox appears on hover or keyboard focus, and every checkbox stays visible while at least one project is selected. While a selection exists, clicking anywhere on another card or row toggles it instead of opening the project; card links are intercepted in the capture phase so they cannot navigate first. The bulk delete uses the same danger confirmation as the single-project delete and leaves failed projects selected for a retry. Selection is pruned to the loaded list after every refresh, so a filter or deletion cannot leave a hidden project selected.

## Products and reusable sources

62. **A Product is a saved copy, not a reference to a project image.** Saving normalizes the source into `library/products/<id>.webp` and a thumbnail. Deleting the source project does not break the Product, and deleting the Product does not delete projects or images made from it. A Product is one photo; it is not a multi-product set.
63. **The source picker offers saved Products and every ready library image.** A Product is curation, not a gate: the seller can reuse a generated image, editor version, or set shot without saving it first. Images already in the target project are reused instead of copied; images from another project are copied in.
64. **The Image Generator has independent product and person references.** The product slot accepts a saved Product or any library image; the person slot accepts People. One of each may be sent. The product image is read directly from its library file or product file, so a reference does not clutter the project with hidden uploads.
65. **A referenced run makes one image.** The edit endpoint returns one image, so the count control is fixed at one while a product or person reference is selected. The queue rejects a larger count instead of charging for images that cannot come back.


## Collection pages

66. **Collection pages show 20 items at a time.** Library projects, saved Products, user-added People, both Usage lists, and the source picker use Previous/Next pagination with a range indicator. The library's old Show More and virtual-list path were removed because 20 rows never need viewport windowing.

## Onboarding first set

67. **Onboarding saves the first photo as a Product and makes a set only on request.** It has four setup steps: connect Meta, add the first product, make an optional first set, and ready. The photo is saved as a reusable Product immediately; a set project is created only when the seller chooses Make. The set step offers 1, 3, or all counts and one toggle per recipe shot, with all six selected by default; directions, format, people, and off-recipe shots stay in the set editor. The draft plan is saved as a barrier before the run. “Save product only” marks onboarding done and opens Products. The category belongs to the set step and is persisted.

68. **Onboarding no longer has a Make it yours step.** Logo, badge, and colors live in Settings, where the seller can compare the preview, corner, size, and opacity side by side. Onboarding keeps the focus on the Meta key, the first product, and the optional first set.

## Set preview

69. **The set image lightbox uses a blurred scrim and click-away close.** The preview no longer paints a solid canvas behind the image; the scrim is semi-transparent and blurred, clicks on the scrim outside the image close it, and the image plus action buttons keep their pointer events. The X and Esc still close it.

## Design system

70. **Astryx is the component foundation, pinned and themed as Moss.** The app uses Astryx 0.7.11 for generic UI, with a custom Moss theme that keeps the warm paper, forest-green selection, burnt-rust primary action, Inter, and Plus Jakarta Sans. The dev-only `/mockups` gallery renders the three onboarding directions before the production flow changes. The custom dark canvas, crop overlay, filmstrip, brand badge preview, and file-drop logic stay custom. Astryx is beta, so versions are pinned and upgrades are deliberate.

71. **The app has one create entry point and one navigation.** The rail Tools block is gone. The TopNav New menu launches Set Creator, Image Editor, and Image Generator from anywhere; the Library keeps contextual start cards only when empty. Settings sections live in the same SideNav while the Settings route is open; the second settings aside is gone.

72. **Library selection has an explicit Select mode as well as the hover shortcut.** Select pins the checkboxes visible and makes the bulk bar persistent; Select all, Clear, Delete, and Escape are supported. Hover checkboxes remain a shortcut for experienced users. The documented 20-per-page pagination and delete copy are unchanged.

73. **Products and People have search, sort, and count parity with Library.** The Settings storage section is called Storage so it cannot be confused with the Library page. Usage keeps its budget control inside the summary card instead of a second form at the bottom.
