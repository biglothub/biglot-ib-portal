# PWA Mobile Audit Notes

วันที่อัปเดต: 3 พฤษภาคม 2026

## Automated checks completed locally

- `npm run check`
- focused Vitest suites for mobile/PWA logic
- Playwright mobile smoke specs for login/offline/manifest
- production build

## Remaining manual/device checks

ต้องรันบนเครื่องจริงก่อน release:

- iPhone Safari tab + Home Screen standalone, viewport 320/375/390/430
- Android Chrome tab + installed PWA
- Lighthouse PWA + Accessibility report JSON
- Desktop screenshot regression ที่ 1280px เทียบ baseline
- VoiceOver iOS reading order for install sheet, More drawer, Sync Center, Quick Trade sheet

## Known constraints

- iOS install cannot be triggered programmatically; the app shows guided Share Sheet steps.
- Offline queued writes are allowlisted to journal/review/note-style endpoints only; destructive/admin actions remain online-only.
- Device screenshots are not committed because this environment has no physical iPhone/Android browser session.
