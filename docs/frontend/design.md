# Frontend Design

Use this document as a visual reference when implementing the frontend. The values and treatments below are starting points that can be adjusted where readability or the content calls for it. The [screen specifications](screens.md) define screen composition, responsive layout, and behavior. See the [frontend architecture](architecture.md) and [conventions](conventions.md) for implementation guidance.

## Visual Direction

Mercadummy uses matte, violet-tinted dark surfaces and warm pink accents. Distinct display typography, clear prices, and a consistent treatment for product photos carry the store's identity. A restrained violet glow or pink-to-violet gradient can add emphasis to brand elements. Solid fills keep primary actions easy to identify.

## Color and Typography

| Token                           | Value                             | Use                                                        |
| ------------------------------- | --------------------------------- | ---------------------------------------------------------- |
| `background`                    | `#100E17`                         | Page canvas                                                |
| `surface`                       | `#191623`                         | Header, cards, form panels, and order summaries            |
| `surface-raised`                | `#242031`                         | Inputs, popovers, and the default product image background |
| `border`                        | `#3B344B`                         | Card edges and decorative dividers                         |
| `control-border`                | `#81728F`                         | Input and outlined-control boundaries                      |
| `text`                          | `#F6F2FA`                         | Headings, body text, and prices                            |
| `text-muted`                    | `#BEB4CB`                         | Secondary labels and product metadata                      |
| `accent`                        | `#F291C3`                         | Primary actions, links, and selected control indicators    |
| `accent-hover`                  | `#FFACD5`                         | Primary action hover                                       |
| `on-accent`                     | `#211122`                         | Text and icons on accent fills                             |
| `selected`                      | `#35203E`                         | Background for selected filters or categories              |
| `focus`                         | `#CFABFF`                         | Keyboard focus outline                                     |
| `image-surface-light`           | `#F2EFF4`                         | Optional light background for product images               |
| `success` / `warning` / `error` | `#83E1B8` / `#FFD18A` / `#FF9EA7` | Positive, caution, and error messages on dark surfaces     |

Use Manrope with a system sans-serif fallback. Use `14–16px` for body text and controls, `12–14px` for secondary labels, and `28–36px` for page titles. Use medium weights for labels, semibold for product names, and bold for headings, prices, and order totals. Align prices and totals with tabular numerals where they appear in rows or columns.

## Spacing, Borders, and Shadows

- Start with a `4px` spacing base, `8px` gaps within controls, `12–16px` padding in cards, and `24–32px` between sections. Use `16px` page gutters on narrow screens and `24–32px` on wider screens as a reference. Keep the catalog compact while allowing long names to wrap and controls to remain easy to use on small screens.
- Start with `1px` borders, `8px` corners for controls, and `12px` corners for cards and panels. Pill shapes suit short status badges. Use surface contrast and borders to separate cards, with a soft shadow for floating surfaces such as popovers (`0 8px 24px rgb(0 0 0 / 28%)`).

## Component Style

- **Navigation.** Use a distinct selected treatment and consistent icon and label alignment.
- **Product cards.** Give the photo, name, and price more visual weight than secondary metadata.
- **Product images.** Use a dark background on the image container by default. A light variant can be introduced where extra contrast is needed. Render the original API images with `object-fit: contain`, preserving their full content and transparency.
- **Buttons and inputs.** Use filled pink for primary actions and outlined or text treatments for secondary actions. Give fields clear labels and boundaries, and provide comfortable touch areas for controls.
- **Order panels.** Use subtle separators and consistent numeric alignment. Give totals emphasis through type weight and contrast.

## States and Feedback

| State                        | Treatment                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Hover, pressed, and selected | Vary the fill or border. Give selected controls a persistent indicator, such as a checkmark.  |
| Keyboard focus               | Use a visible focus outline. A `2px` outline with `2px` offset is the starting point.         |
| Loading and processing       | Use subdued placeholders or indicators sized to minimize layout shifts.                       |
| Empty                        | Use concise text and clear visual emphasis for any action specified by the screen.            |
| Error and success            | Pair the semantic color with a clear text message.                                            |
| Stock and disabled           | Pair stock colors with readable labels. Give disabled controls a distinct, legible treatment. |

Pair status colors with text. Keep text readable on every surface, including badges and disabled controls. Keep motion subtle and respect the reduced-motion preference.
