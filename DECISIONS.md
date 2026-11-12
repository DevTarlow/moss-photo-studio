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
58. **New installs start in light mode.** The seed writes `theme = light` instead of following the system. Existing installs keep whatever they chose. Theme, density, and reduce motion live in Settings.
59. **The three tools are named Set, Image Editor, and Image Generator; the rail action reads New Set because it starts a new set.** The person preview's Create an Image action creates an image project with that person's portrait as its source and opens the Image Generator. The source image carries the person id, so the prompt uses a person-preservation guard instead of the product guard.

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

67. **Onboarding saves the first photo as a Product and makes a set only on request.** It has five setup steps: connect Meta, add the first product, make the studio your own with a logo and colors, make an optional first set, and ready. The photo is saved as a reusable Product immediately; a set project is created only when the seller chooses Make. The set step offers 1, 3, or all counts and one toggle per recipe shot, with all six selected by default; directions, format, people, and off-recipe shots stay in the set editor. The draft plan is saved as a barrier before the run. “Save product only” marks onboarding done and opens Ready, not Products. The category belongs to the set step and is persisted.

68. **Onboarding includes an optional Make it your own step.** It sits after the first product and before the optional first set, so the branding is saved before the first set is made and the set can use the colors and badge. Logo, badge, and colors use the same fields and preview as Settings, where they remain. Continue saves the step and goes to Make a set; Skip for now does the same without saving. Onboarding no longer sends the seller to Settings, so the walkthrough stays in place unless they choose Finish later.

## Set preview

69. **The set image lightbox uses a blurred scrim and click-away close.** The preview no longer paints a solid canvas behind the image; the scrim is semi-transparent and blurred, clicks on the scrim outside the image close it, and the image plus action buttons keep their pointer events. The X and Esc still close it.

## Design system

70. **Astryx is the component foundation, pinned and themed as Moss.** The app uses Astryx 0.7.11 for generic UI, with a custom Moss theme that keeps the warm paper, forest-green selection, burnt-rust primary action, Inter, and Plus Jakarta Sans. The custom dark canvas, crop overlay, filmstrip, brand badge preview, and file-drop logic stay custom. Astryx is beta, so versions are pinned and upgrades are deliberate.

71. **The app has one create vocabulary and one navigation.** Set, Image Editor, and Image Generator are available from the TopNav New menu and from the Tools section under Studio in the rail; both launch the same flows. The Library keeps contextual start cards only when empty. Settings sections live in the same SideNav while the Settings route is open; the second settings aside is gone.

72. **Library selection has an explicit Select mode as well as the hover shortcut.** Select pins the checkboxes visible and makes the bulk bar persistent; Select all, Clear, Delete, and Escape are supported. Hover checkboxes remain a shortcut for experienced users. The documented 20-per-page pagination and delete copy are unchanged.

73. **Products and People have search, sort, and count parity with Library.** The Settings storage section is called Storage so it cannot be confused with the Library page. Usage keeps its budget control inside the summary card instead of a second form at the bottom.

74. **The Set tool is a two-mode workspace.** Plan shows the plan preview board and the editable plan. Review is read-only until Edit Plan or Make More. The duplicate right summary panel is gone; the center owns the canvas. Running hides the phase switch and keeps the plan read-only.

75. **The Photo canvas uses one fitted stage.** The preview sizes the image to the measured stage instead of clipping at `maxWidth: none`. Rotation and flips follow the exporter's order (rotate, then flop/flip), so the crop overlay lives in the rotated display box and matches the applied result. The compare divider is draggable and the range slider remains for keyboard use.

76. **Create results keep their actions.** A result opens the lightbox and always shows Edit, Download, Save as Product, Save as Person, and a More menu for Use as a Set's Photo and Delete. The lightbox repeats Download, Open in Editor, Save as Product, Save as Person and Delete. Failed runs get their own retry card. Budget "Make Fewer Images" reduces the set run to one shot or the Create count by one, and disappears when only one image is possible.

77. **Workspace inspectors are optional below 1440.** Photo and Create hide the right inspector at 1024-1439 and expose it as a sheet; Set has no right inspector. Panel widths clamp with the window, and sheets close when the viewport grows back.

78. **Workspace panels are user-sized.** Set, Photo, and Create left panels and the Photo/Create inspector use a draggable separator with arrow/Home/End keyboard support and double-click reset. Widths persist in localStorage. At narrow widths the fixed 300px panel is used and the handle is hidden so the canvas cannot be squeezed into overflow.

79. **Crop is keyboard-operable.** The crop box is a focusable group; arrow keys move it, Alt+arrow resizes it, and Shift takes bigger steps. The visible hint and the described-by text state the controls. Pointer dragging remains, and the rule-of-thirds grid stays.

80. **System reduced motion is resolved.** The `system` preference reads `prefers-reduced-motion` and listens for changes; `reduce` and `full` still override. The document gets `data-motion="reduce"` or `"full"`, never `"system"`.

## Project drafts

81. **A new Image Generator project is a hidden draft until it has an image.** The Tools rail, the New menu, the Ctrl/Cmd+3 shortcut, and the command palette create the project with `draft = 1` and it is hidden from every project list and count, so opening the generator and leaving again does not add an empty Images card. The first image stored for the project clears the flag, including a reference file added from the generator. A failed run that stores nothing stays hidden. Untouched drafts (no images and no jobs) are deleted at startup.

## Image Generator examples

82. **The eight example cards load scene descriptions, and their product switch is scoped to example runs.** Each card has two texts: the scene as photographed (its mug, candle, person or room) and the same scene written for a referenced product. The person card and the Create a Person button share one starting prompt. With a product reference selected, "Use my product photo" starts on and the run sends the reference; turning it off loads the photographed text and leaves the reference out of that run while keeping it selected for normal prompts. Editing the description returns to the normal reference rules. The switch is repeated in the product card while the example grid is hidden so it stays reachable. The 30 "Start from an idea" starters keep their specific-product copy.

## Brand color swaps

83. **Saving six colors does not mean using six.** Only the first three saved colors reach a prompt; the other three stay saved so a shop can keep a full palette. Once more than three are saved, every swatch gets a Use/Used toggle, and pressing it moves that color into or out of the used three instead of adding a fourth to the prompt. The saved list order is the contract: the queue, the photo change, and the prompt clause all read the first three through one helper. With three or fewer colors the pill stays a static label, because every saved color is already used.

## Onboarding ready step

84. **The ready step previews the first set and finishes where the work lives.** When the first set actually runs, the ready step loads the project's ready images and shows them as a thumbnail grid; choosing a thumbnail opens the shared Lightbox with arrow-key paging, so the seller can check the result before leaving setup. Finish Setup is the step's only exit. It lands in the Library when a set exists, because that is where the set lives, and in Products when the seller chose Save product only, because there is no set and the saved product is the thing to open.

## Usage names

85. **Usage names a project from its live title, not the snapshot on each run.** Usage rows keep the name recorded at run time for history, but the ledger, CSV, and By project resolve the current project name through a join, so renaming a set updates every row that points at it. By project groups by project id alone, so a rename cannot split one project into two rows. A deleted project reads Deleted project instead of its last stored name, which could be stale or id-like; a run with no project reads Project.

## Category recipes and the prompt lab

86. **A recipe carries its own directions and gift clause.** One shared default per shot type was too generic: a shirt's gift shot does not belong upright in a box, and a candle's flat lay needs a different composition from a mug's. A recipe now overrides only the shots where the category needs it; every other shot keeps the shared default in `shots.ts`. Two categories needed different gift wording (clothing folded or rolled, homeware kraft-wrapped without a box); the rest keep the shared box clause. The first three shots are the first-run contract because the 3-image preset enables exactly them. Bags moved on-person to second and vintage moved lifestyle into the first three; jewelry and skincare kept their rosters because their lifestyle shot already shows the piece worn or in use, and bags kept its size reference. Saved plans keep their stored directions; an empty direction falls back to the category default.

87. **Every new set asks what the seller sells, and the recipe is fixed after the first image.** Creating a set from a saved Product or a library image used to create a hidden `other` plan, so only upload-created sets ever showed the category chooser. Set creation now leaves the project without a plan; the existing "What do you sell?" card runs for every source. The Set plan panel also shows the category as a select; changing it confirms, rebuilds the six shots and directions, keeps the preferred person, and saves. After the first image attempt the select is disabled with a "start a new set" hint, because a new recipe would orphan the existing shot images from review and export. There is no global default category: the choice belongs to the set.

88. **The real-Muse prompt lab is outside the app and outside the tests.** `scripts/lab/` loads the shipping prompt modules and Muse client through Vite SSR, so a calibration run uses the same recipes, guards, request shape and source normalisation as the app without duplicating strings. The lab reads `MOSS_LAB_MUSE_KEY` from a gitignored `.env`; the app still keeps its key in the keyring and never reads that file. Paid runs require `--yes`, print only the key's last four characters, refuse to pass the cumulative ledger cap, and record actual returned-image cost in `lab/spend.json`. Outputs land in the gitignored `lab/` folder. `npm test` and CI never touch a real host. Stand-in product sources are generated when no owner photo exists and are labelled synthetic in the manifest; the calibration evidence and rosters live in `docs/category-recipes.md`.

## Bundled people

89. **The bundled people are candid, cheerful, and cover the age range twice.** The original twelve were neutral full-body studio poses, which made the People page and the on-person references feel flat. The pack now has 24 synthetic reference people, each with one cheerful full-body 640x960 photo and a 512x512 portrait cropped from the top of it. Every decade from the 20s through the 70s has four people, with varied genders, ethnicities, outfits and everyday settings (studio, street, garden, kitchen, market, workshop, bookstore, park, porch). Ids and names for the original twelve are stable so existing references keep working, and Maya remains the default person. The generation prompts live in `scripts/lab/people-pack.mjs` and the images were produced through the lab against the real API.


## Creating people in the generator

90. **People are created in the Image Generator, not a separate editor.** The People page offers Add a Person for an upload and Create a Person for a new synthetic reference. Create a Person makes a hidden image draft and opens it with `?createPerson=1`; the generator seeds the person prompt, shows a short "Make a new person" banner and removes the query so a reload cannot overwrite edits. Every generated result can be saved as a Person from its card or the lightbox. That action copies the image through `people:createFromImage` into the normal person pipeline (1536 reference plus 480 thumbnail), so no DB schema or second person model was needed. The reference is independent of the generated image: deleting the image later leaves the person intact.

## Person looks

91. **An included person has four alternate studio looks, and the chosen look travels with the project.** The People preview keeps the candid reference as the main photo and adds four evenly spaced thumbnails: studio front, studio angle, full length and seated. The look is not a global person default; it is selected for the next action. A set stores `personLook` on its on-model shot in the saved plan, and an image project stores `personLook` on the project row, so both keep the choice after a restart. The job queue resolves the reference through `PeopleRepository.refFor`, which is also the single place that rejects an unknown look. The four images per person are generated from the bundled reference through the lab, reviewed for identity and framing, and committed as 640x960 WebP files; user-added people keep their single portrait. A look is a reference choice, not a new person: deleting the generated project does not remove the bundled asset.

## Included starter products

92. **Included products are a static, unbranded starter catalog, not saved products.** The Products page shows saved products under Yours first, then 20 clean product photos (dropper and pump bottles, jars, candles, ceramics, bags, clothing, jewelry, homeware and prints) under Included. Bundled IDs resolve through `ProductService` to `resources/products/<id>.webp`, so Use in a Set, Edit This Photo and New Image from Reference work without writing a product row or copying a file until the project is created. `products:list` stays user-only so onboarding's saved-product counts and the source picker keep their meaning. Included cards have no Rename/Delete; Create a Product opens the Image Generator with a blank dropper prompt and a "Make a new product" banner, and Save as Product adds a normal user product. The 20 assets were generated through the lab, reviewed for no readable labels or logos, and committed as 1024-square images with 480-square thumbs.

## Encrypted key storage

93. **safeStorage uses the asynchronous API and upgrades rotated ciphertext.** Electron 45 deprecates `isEncryptionAvailable`, `encryptString`, and `decryptString`, and removes them in Electron 46, so the studio's `TextCipher` is promise-based. `isAsyncEncryptionAvailable()` is checked lazily and only a true result is cached, so a call made before app ready cannot disable the keyring for the session. `decryptStringAsync` reports `shouldReEncrypt` when data was written under another provider, for example a key saved by an older build; `secrets.bin`, the license row, and `license.json` are rewritten with `encryptStringAsync` on read. Existing ciphertext stays readable because Electron keeps the legacy v10/v11 keys. The AES-256-GCM local fallback is unchanged: it still encrypts when asynchronous encryption is unavailable and when the selected Linux backend is `basic_text`, so a key is never left to Chromium's hardcoded fallback password. `backend()` still reports `basic_text` so the basic-protection warning stays truthful.

## Optional onboarding product step

94. **The onboarding product step is optional.** A seller can press Skip for now or Continue without adding a photo. The step is labelled optional and carries the same skip action as the other optional steps, and the set step then shows an Add a product first banner with Skip for now instead of a disabled run button. Ready reports No product yet, keeps a Back button for revisiting the optional steps, and Finish Setup lands in the Library, whose empty state points at Products. When a product exists but no set does, Finish Setup still opens Products, and when a set was made it still opens the Library. Add product remains the first save path for sellers who have a photo ready. This lets a seller finish license and key setup before finding a product photo, and matches the already-optional set step.

## License resilience

95. **Transient store failures do not expire a license, and an unreadable key is not a license.** The Lemon Squeezy provider now treats a network failure, timeout, 408, 429, an edge 401/403, and every 5xx as `license_offline`; only an explicit 400/404/409/422 rejection from the store reaches the controller as invalid. Within the 14 day window the controller stays in grace, and only after the window or an explicit rejection does it become read-only. `state()` also fails closed when the stored ciphertext cannot be decrypted: the seller sees an unlicensed state with a message and can paste the key again, instead of a "licensed" state that can never validate. Activation, validation, and deactivation are serialized so a late response cannot overwrite a newer action, and the license is re-checked on window focus and every six hours at the same 24 hour cadence as launch. The machine label is now `platform-` plus a random per-install eight-character suffix stored in `.machine-label`; the hostname and hardware identifiers are never sent, matching the privacy page.


## Backup and recovery

96. **A backup is a folder with a consistent database snapshot and the library, and a restore is a copy into a new library, not an overwrite.** **Settings, Storage** creates `Moss Photo Studio Backup <timestamp>/` with `library.sqlite` made by `VACUUM INTO` (so committed WAL frames are included), a copy of `library/`, a manifest with the database hash and counts, and a README. The backup excludes `secrets.bin` and `license.json`; the database's encrypted license row may need re-activation after a restore, and the Muse key is always re-entered. Restore validates the manifest, the database hash, `quick_check`, and the schema version before staging; it copies the library into a new empty folder and writes `pending-restore.json`. On the next launch the app updates the restored database's `libraryPath`, moves the current database aside, swaps in the restored one, and keeps the previous database as `.pre-restore-<timestamp>`. A failed swap puts the current database back and leaves the library untouched. Backups and restores are refused while images are being made, so a snapshot cannot catch a half-written run. Diagnostics are a separate local folder with app information, counts, and redacted logs, and never include keys, prompts, or images.

## Timeouts and backups

97. **The request timeout aborts the local fetch and records unknown billing, and set exports use the stored result.** The Muse client's 300 second timer aborts the fetch; the app still records zero counted cents plus the uncertain-billing flag, because the server may have made an image. `docs/api-notes` and the privacy screen say so. The set exporter now reads the stored result file (the one that carries the badge) instead of the pre-badge working copy, matching single-image export; an integration test distinguishes the two files by colour.

## Product-first workspace

98. **Products are the home and the hub, and work can be linked to them.** The rail leads with Products; the old Library is now **All work**. A project carries an optional `product_id`; a product page shows its source photo, counts, linked sets/edits/images, details (category, audience, notes), and actions to make a set, change a photo, make a new image, link existing work, archive, restore, or delete. Included starter products stay resources without a product row, so starting from one creates unfiled work until the seller saves it as a Product. Product deletion leaves linked work in place as unfiled work (the foreign key is `ON DELETE SET NULL`); archive hides a product from the active list and has a Restore action. The migration adds the link, product details, seller-profile columns, image origin, and the listings table in one transaction. Existing projects are not rewritten; their work appears under Unfiled work with a one-click Make a Product action. Onboarding's Finish Setup opens the saved product's hub, or Products when nothing was saved. This keeps the seller's mental model (the thing they make) ahead of the app's project types, without deleting or mutating any existing work.

99. **A shot's main version is explicit, and export follows it.** A plan shot can carry `selectedImageId`. In Set review, any ready version can be pinned as the main image; the lightbox shows Use as Main, the card shows Pinned, and the set exporter writes the pinned version as the unsuffixed file while other ready versions get the existing version suffix. A ready shot also has a New · $0.01 action that makes one more version without remaking the set. The renderer saves the pin before it acknowledges it, so a following export cannot use a stale plan. The export default is JPEG because Etsy does not accept WebP and many shops want JPEG; the image request format stays the project's stored format (still WebP by default) because that is transport, not delivery.
