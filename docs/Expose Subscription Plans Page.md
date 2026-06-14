# Expose Subscription Plans Page

This plan outlines the steps to expose the existing `PricingComponent` as a public Subscription Plans page accessible from the navbar, without requiring login, and ensuring it meets theming, localization, and responsiveness requirements.

## Background Context

We already have a `PricingComponent` implemented under `src/app/features/pricing`. It fetches plans from the `PricingService` and handles localization. Currently, the component checks if the user is logged in *only* when they click the "Join Now" button, redirecting them to `/login` if necessary. This perfectly satisfies the requirement: **no need for login or registration to access the page**.

However, the component is missing a route in `app.routes.ts`, a link in the navigation bar, and the CSS uses hardcoded light-theme colors (e.g., `#F8F9FA`, `white`, `#0B0E14`).

## User Review Required

> [!WARNING]
> The current application does not seem to have a global dark/light theme toggle mechanism using CSS variables in `styles.css`.
> My proposed approach for the dark/light theme is to use `@media (prefers-color-scheme: dark)` in the pricing component's CSS to adapt based on the user's system preferences. Please let me know if there is a specific global dark mode class (e.g., `.dark-mode` or `data-theme="dark"`) that I should use instead.

## Open Questions

> [!IMPORTANT]
> - Do you want the link in the navbar to say "Plans" or "Pricing"? (I will use "Plans" by default, translated to "الخطط" in Arabic).
> - Should we hide the "Plans" link for users who are already subscribed, or keep it visible for everyone? (I'll keep it visible for everyone by default).

## Proposed Changes

---

### Routing & Navigation Configuration

To expose the page and link it to the navbar.

#### [MODIFY] [app.routes.ts](file:///d:/Learn/ITI/Final%20Project/Arena-Frontend/ArenaFrontend/src/app/app.routes.ts)
- Add a new public route:
  `{ path: 'pricing', component: PricingComponent }`

#### [MODIFY] [header.html](file:///d:/Learn/ITI/Final%20Project/Arena-Frontend/ArenaFrontend/src/app/shared/header/header.html)
- Add a new `<li>` in the main `<nav>` link list pointing to `/pricing` with the translation key `header.pricing`.

---

### Localization

To ensure proper Arabic/English support for the new navbar link.

#### [MODIFY] [en.json](file:///d:/Learn/ITI/Final%20Project/Arena-Frontend/ArenaFrontend/public/i18n/en.json)
- Add `"pricing": "Plans"` under the `"header"` section.

#### [MODIFY] [ar.json](file:///d:/Learn/ITI/Final%20Project/Arena-Frontend/ArenaFrontend/public/i18n/ar.json)
- Add `"pricing": "الخطط"` under the `"header"` section.

---

### Theme and Responsiveness

The component is mostly responsive via flexbox/wrap in `.pricing-grid`. We will enhance the CSS to natively support dark mode.

#### [MODIFY] [pricing.component.css](file:///d:/Learn/ITI/Final%20Project/Arena-Frontend/ArenaFrontend/src/app/features/pricing/pricing.component.css)
- Add `@media (prefers-color-scheme: dark)` overrides to switch the background from `#F8F9FA` to a dark shade (e.g., `#0f1219`).
- Change card backgrounds from `white` to a dark gray.
- Adjust text colors (`#0B0E14` to white, `#666` to a lighter gray).
- Ensure borders and hover states are visible in dark mode.

## Verification Plan

### Manual Verification
1. Run `npm start` and visit the home page.
2. Verify the "Plans" link is present in the header.
3. Click on "Plans" without being logged in -> Verify the plans grid loads correctly.
4. Switch language to `AR` -> Verify layout direction flips and texts are translated.
5. Change system appearance to Dark Mode -> Verify the page adapts elegantly without contrast issues.
6. Click "Join" on a plan without logging in -> Verify it redirects to `/login`.
