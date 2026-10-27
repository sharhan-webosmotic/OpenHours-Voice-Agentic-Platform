---
description: Mobile development rules — enforces React Native/Flutter best practices, platform-specific handling, and performance
paths:
  - "**/mobile/**"
  - "**/app/**/*.tsx"
  - "**/app/**/*.dart"
  - "**/*.native.*"
---

# Mobile Development Rules

## Platform Awareness

1. **Handle platform differences explicitly** — use Platform.OS checks or platform-specific files (.ios.tsx, .android.tsx)
2. **Test on both iOS and Android** — never assume behavior is identical
3. **Respect platform conventions** — back button on Android, swipe-to-go-back on iOS
4. **Handle safe areas** — use SafeAreaView or equivalent for notches and status bars

## Navigation

5. **Use the standard navigation library** — React Navigation for RN, GoRouter for Flutter
6. **Deep linking** must be configured from the start — not bolted on later
7. **Handle back navigation correctly** — hardware back button on Android, gesture on iOS

## Performance

8. **Use FlatList/SectionList** for long lists — never ScrollView with map()
9. **Optimize re-renders** — use React.memo, useCallback, useMemo where measured to be needed
10. **Lazy load screens** — don't import all screens at app startup
11. **Optimize images** — use proper sizes, caching, and progressive loading
12. **Avoid bridge bottlenecks** — minimize JS-to-native communication in hot paths

## Offline & Network

13. **Handle offline state gracefully** — show cached data, queue mutations
14. **Show loading states** for every async operation
15. **Handle slow networks** — timeouts, retry logic, progress indicators
16. **Cache API responses** where appropriate — reduce unnecessary network calls

## Security (Mobile-Specific)

17. **Never store sensitive data in AsyncStorage/SharedPreferences** — use Keychain/Keystore
18. **Certificate pinning** for production apps
19. **Obfuscate release builds** — enable ProGuard (Android), bitcode (iOS)

## Component Reuse

20. **Same registry rules as frontend** — check component-registry.md before creating
21. **Platform-specific variants** — use the same component API, different implementations if needed
22. **Share business logic** — hooks, services, and utils should be platform-agnostic

## Mobile Testing & E2E

23. **Native E2E framework per stack** — Detox for React Native, the `integration_test` package for Flutter. The web Playwright suite does NOT cover native; a native target needs its own lane.
24. **Same fixtures contract as web** — native E2E reads the seeded users from `AI_DOCS/quality/test-fixtures.md`, uses the same `TEST_MODE` OTP or mock mailbox for MFA/OTP/email, and the same `reset-endpoint` for isolation (see `e2e-testing/SKILL.md`).
25. **Seed device state explicitly** — offline-first apps cache to local SQLite / Keychain / SharedPreferences; seed or reset that state in test setup, do not assume a clean device.
26. **CI runs on emulator or device farm** — local emulator for fast feedback, a device farm (BrowserStack / Sauce Labs) for the matrix; declare the lane in `infra-plan.md`. `milestone-validation` Phase 1b runs the native lane when `platform_targets` includes iOS/Android.

<!-- Version: 1.1.0 — 2026-06-23 — added Mobile Testing & E2E rules 23-26: Detox/Flutter integration lanes, shared test-fixtures contract, device-state seeding, emulator/device-farm CI; native E2E runs at milestone close via milestone-validation Phase 1b -->

## Stack Lookups (offline design dataset)

27. **Query stack guidance before building screens.** Run `bash .claude/scripts/design-lookup.sh "<topic>" --stack <stack>` with `flutter`, `react-native`, `swiftui` or `jetpack-compose` (for example `"navigation list performance" --stack flutter`). The rows are options and pitfalls to weigh, not orders. `design-system/tokens.json` and the project's registry still win on any conflict.

## Mobile Pre-Delivery Checklist

Ported from the upstream ui-ux-pro-max `pro-rules.md` (MIT, vendored at `vendor/ui-ux-pro-max/`). Run before delivering native or mobile app UI. `component-inspector` runs it on mobile projects.

**Process**
- [ ] Searches were relevant to the interface (for example `"keyboard focus modal" --domain ux` via `design-lookup.sh`)
- [ ] Tested at 375px width (small phone) and in landscape
- [ ] Verified with reduced motion on and with Dynamic Type or the largest system text size
- [ ] Dark mode contrast checked independently, never assumed from light mode
- [ ] All touch targets meet the minimum and no content is hidden behind safe areas

**Visual quality**
- [ ] No emojis used as icons, vector icons only (SVG or platform vector icons)
- [ ] All icons come from one family, with a consistent stroke width, sized from tokens, and one filled-or-outline style per hierarchy level
- [ ] Official brand assets used with correct proportions and clear space
- [ ] Pressed states do not shift layout bounds or cause jitter
- [ ] Semantic theme tokens used throughout, no per-screen hardcoded colors

**Interaction**
- [ ] Every tappable element gives clear pressed feedback (ripple, opacity or elevation) within roughly 80-150ms
- [ ] Touch targets are at least 44x44pt on iOS and 48x48dp on Android, with the hit area expanded when the icon is smaller
- [ ] Animation timing uses shared tokens suited to platform and context, not one duration copied everywhere
- [ ] Disabled states look disabled and are non-interactive (native disabled semantics)
- [ ] Screen reader focus order matches visual order and labels are descriptive
- [ ] Gesture regions avoid nested or conflicting interactions (tap, drag, back-swipe)
- [ ] Native interactive primitives (`Button`, `Pressable`, platform equivalents) used with proper roles

**Light and dark mode**
- [ ] Normal text contrast is at least 4.5:1 in both themes (3:1 only for large text and non-text UI)
- [ ] Dividers, borders and interaction states are distinguishable in both themes
- [ ] Modal and drawer scrims are measured against the real background and keep foreground content legible
- [ ] Both themes were tested, not inferred from one

**Layout**
- [ ] Safe areas respected for headers, tab bars and bottom CTA bars, and system bars and the home indicator do not collide with tappable content
- [ ] Scroll content is not hidden behind fixed or sticky bars
- [ ] Verified on small phone, large phone and tablet, portrait and landscape
- [ ] Horizontal insets adapt by device size and orientation
- [ ] A 4/8dp spacing rhythm holds at component, section and page level
- [ ] Long-form text keeps a readable measure on large devices

**Accessibility**
- [ ] Decorative icons beside visible text are hidden from the accessibility tree, meaningful icons have a text alternative
- [ ] Icon controls have an accessible name and announce selected, pressed or expanded state where applicable
- [ ] Form fields have labels, hints and clear error messages, and failed forms keep inline errors
- [ ] Color is not the only indicator
- [ ] Reduced motion and dynamic text size work without layout breakage
- [ ] Sticky UI and overlays do not obscure keyboard focus
- [ ] Drag and swipe-only interactions have button or keyboard alternatives
- [ ] Authentication allows password managers and paste
- [ ] Auto-rotating content has pause or stop controls

Offline and empty states are covered by rules 13-16 above and by the project's state-coverage checks. The upstream checklist does not add rows for them.

<!-- Version: 1.2.0 | 2026-10-22 | added Stack Lookups (rule 27) and the Mobile Pre-Delivery Checklist ported from upstream pro-rules.md, v4.31.0 -->
