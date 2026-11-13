# Privacy

Moss Photo Studio sends **three** things to other computers, and only when they are needed:

1. **To Meta Muse**, when you press a button that makes or changes an image, or writes listing copy: your Muse key, the product photo and any person reference, the composed description or the listing facts and shop profile, the requested shape, format, and count for an image, and a random installation id in the API's `user` field. Meta also sees your IP address, as any service does.
2. **To the license store (Lemon Squeezy)**, when you activate, validate, or deactivate a license: the license key, an instance id, and a short computer label.
3. **To your browser**, if you click a link such as “Where to Get a Key”, “Buy a License”, or a Meta documentation link. The app opens the system browser. The app itself does not load the page.
4. **Nothing else.** There is no telemetry endpoint, analytics SDK, remote logging, crash uploader, or auto-updater.

The app turns off Chromium's background networking, component updates, domain reliability, sync, and pings. The renderer has no network permission in its Content Security Policy except the two API hosts and its own local media scheme. It never calls those API hosts directly. All requests are made by the main process.

## What is sent with an image request

- The product photo reference (an uploaded photo, a saved Product, or a ready library image), normalised to WebP with the long edge at most 2,048 pixels.
- An optional person reference, normalised the same way. Product and person references can be sent together.
- The composed prompt. It contains the words you typed and the guard text that tells the model to keep the product unchanged.
- The model, shape, output format, and image count.
- Your Muse key in an authorization header.
- A random per-installation `user` id.
- A generated `x-request-id` for support and log correlation.

## What is sent when writing listing copy

- The product photo, as the same normalised WebP reference used for images.
- The product name, category, audience, and notes you saved, the shot directions of the set, and the shop profile fields (business name, what you sell, audience, voice, standard answers, marketplaces) when **Use my Business profile** is on.
- The platform and its title, description, feature, and tag caps.
- A random installation id and a request id, like an image request.

It does **not** send any other library image, project list, usage history, person names, your logo, or license key. The three saved colors you mark as used are included as hex values in the composed prompt when you make a set or change a photo, unless brand colors are switched off in Settings. A local adjustment never sends anything. Browsing the library never sends anything.

## What is sent with a license request

- The license key.
- The store instance id, which is created by the store the first time a computer activates.
- A label such as `linux-4f21a8c0`. It is derived from the OS and a random per-installation suffix. It is not a hostname, MAC address, disk serial, or account name.

The license validation request happens no more than once per 24 hours automatically, with a check when the window regains focus. A manual **Check Now** is immediate. The last validation time is stored locally. A failed validation never deletes a license or hides the library: a store error or an unreadable response does not shorten the 14 day offline window, and only an explicit rejection by the store, or the end of that window, makes the license read-only. A license file that cannot be decrypted is not treated as licensed; the seller is asked to paste the key again.

## What is stored locally

The application data folder contains:

- `library.sqlite` and its WAL and backup files: projects, images, plans, jobs, usage, people, brand, settings, and license metadata.
- `library/`: all original and working images, saved Products, and exports made inside the library.
- `secrets.bin`: the Muse key, encrypted with the system keyring, or with the documented AES-256-GCM fallback if no keyring is available.
- `license.json`: the license key and instance id, encrypted.
- `logs/`: local logs. They contain request ids, status codes, counts, durations, and error codes. They do not contain keys, prompts, or full responses. Log rotation keeps the last two files.
- A backup folder you choose in **Settings, Storage**: a consistent database snapshot, a copy of `library/`, a manifest, and a README. It excludes `secrets.bin` and `license.json`; the database keeps an encrypted license row, so a restore may ask you to re-activate. Backups are never uploaded.
- A diagnostics folder you choose to create in **Settings, Storage**: app version, build, schema, library counts, and a copy of `logs/`. It contains no keys, prompts, images, or full file contents. It is opened in the system file manager and is only shared if you share it.

Encrypted files are readable only by your operating-system user. The fallback key is mode `0600`. An administrator or someone with your unlocked user account can access the data, as with any desktop app.

## Deleting data

- **Delete a project** removes its folder and database rows. Usage rows remain, because the ledger is an accounting record, and they keep the project name that was recorded at the time of the action. Use **Delete all usage history** in Privacy if you need the ledger removed.
- **Delete a Product** removes only its saved copy under `library/products/`. Projects and images already made from it stay.
- **Delete an image** removes the working files and thumbnail for that version. The original product photo stays until the project is deleted.
- **Delete all usage history** removes the ledger rows. It does not delete images or projects.
- **Delete logs** removes the local log files.
- **Backups and diagnostics** live in folders you chose. Delete them with the system file manager when you no longer need them.
- **Remove the Muse key** deletes `secrets.bin` and the cached validation time and last four characters.
- **Deactivate** tells the license store to release this computer, then clears local license data. If the store cannot be reached, the app does not pretend deactivation succeeded.

## Children and accounts

The app has no account, social feed, chat, advertising, or analytics. It never sells data. Do not use it to make images of other people without permission. Person references bundled with the app are synthetic illustrations, and user-added references are stored only on this computer.

## Contact

Support: support@mosstoolbox.com

This document describes the build in this repository. A distributor that adds a hosted service, crash reporting, or an update channel must update this file before shipping.
