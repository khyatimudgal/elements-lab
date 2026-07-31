# Elements Lab

A live playground for [Unlayer Elements](https://github.com/unlayer/elements) that renders one
component tree as **email, web and PDF simultaneously**, and runs a preflight audit over the
email output while you type.

> Write the content once. See all three destinations at once. Find out it fails WCAG contrast
> before you ship it, not after.

## Why this exists

Elements' core promise is that a single component tree can render to email-safe tables, a
responsive page, and a print-ready document. That promise is hard to _feel_ from a README. You
have to build all three and diff them yourself.

Elements Lab makes it a single click. And because templates are now code, they can be linted like
code, which is the second half of the tool: an audit panel that checks the rendered email against
the rules that actually break campaigns.

## What the audit checks

Every check runs client-side on the rendered HTML. No API key, no backend, no network calls.

| Check | Why it matters |
| --- | --- |
| **Gmail clipping budget** | Gmail truncates messages over 102KB and hides everything after the cut, including your unsubscribe link. Shown as a live meter. |
| **WCAG AA contrast** | Resolves each text element's effective foreground and background through its ancestors, then checks the ratio against the AA threshold (4.5:1, or 3:1 for large text). Reads inline styles only; see the limitation below. |
| **Image alt text** | Most clients block images by default, so alt text is often the only thing a reader sees. A missing `alt` attribute is an error; an empty `alt=""` is a warning, because that is correct markup for a decorative image but is also what Elements emits when you omit the prop. |
| **Merge tag syntax** | Errors on unclosed (`{{ expires_at`) and empty (`{{ }}`) tags, and warns on a space inside a field name. Liquid filters, array access and hyphenated fields all pass, because an audit that cries wolf gets ignored. |
| **Link health** | Flags placeholder `#` hrefs and insecure `http://` links, case-insensitively. |

Load the **"Broken on purpose"** preset to see all of them fire at once.

### What it is not

This is static analysis of the generated HTML, not real-inbox rendering. It will not tell you how
Outlook 2016 handles a specific CSS property. Tools like Litmus and Email on Acid screenshot real
clients and are the right tool for that. Elements Lab catches the class of bug you can find without
sending a single email, in the two seconds after you type it.

Two limitations worth knowing:

- **The contrast check reads inline styles and `bgcolor`, not `<style>` blocks.** Elements sets
  colours inline, so this covers the colours you write, but a rule that lives only in a stylesheet
  is invisible to it, and the check will not know it missed one.
- **DOM-based checks skip Outlook conditional comments.** `<img>` and `<a>` inside
  `<!--[if mso]>` blocks are not parsed as elements, so they are not audited.

## Features

- **Three render targets from one tree.** `<Email>`, `<Page>` and `<Document>` wrappers applied to
  the same default export
- **Live compilation.** JSX and TypeScript transpiled in-browser with Sucrase, debounced at 250ms
- **Four output views.** Rendered preview, raw HTML, the `renderToPlainText` fallback, and the
  Unlayer design JSON
- **Viewport and dark-canvas toggles.** 680px desktop, 320px mobile, and a dark background to
  expose transparent-PNG and white-logo problems
- **Shareable URLs.** Editor state is compressed into the URL hash, so a link reproduces the exact
  template
- **Design JSON round-trip.** `renderToJson()` output is valid Unlayer schema (v24), ready to load
  into the visual editor

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
```

## Verification

```bash
npm run verify
```

This drives the real `compile.ts` and `render.ts` modules, not a copy of their logic, so it fails
if the app would fail. It compiles all four presets, renders each through all three wrappers,
asserts the design JSON is structurally valid, checks the plain-text fallback, asserts the audit
reports clean templates as clean while catching every planted defect in the broken one, and covers
the compile-error path. It also unit-tests the colour parser and contrast maths against known
values: black on white must come out at exactly 21:1, the WCAG reference figure. Regression
tests cover the merge-tag scanner, the link checks and hidden-element handling. 58 checks total.

```bash
npm run build    # tsc -b && vite build
```

## How templates are written

Your default export returns the **content**: rows and columns. Elements Lab supplies the three
wrappers, which is what makes the same tree renderable three ways.

```jsx
import { Row, Column, Heading, Button } from '@unlayer/react-elements';

export const config = { backgroundColor: '#eef2f7', contentWidth: '600px' };

export default function Content() {
  return (
    <Row>
      <Column>
        <Heading color="#0f172a" fontSize="28px">Welcome aboard</Heading>
        <Button href="https://example.com" backgroundColor="#1d4ed8" color="#ffffff">
          Open your workspace
        </Button>
      </Column>
    </Row>
  );
}
```

Two things worth knowing, both learned the hard way while building this:

- Elements components take **flat style props** (`color`, `fontSize`, `backgroundColor`), not a
  `style` object.
- Merge tags must be **string values** (`const firstName = '{{ first_name }}'`), because JSX parses
  a bare `{{ first_name }}` as an object literal.

## Security note

Template code is transpiled with Sucrase and evaluated in the page via `new Function`, which is how
in-browser playgrounds work. Because a share link carries executable code, that matters:

- **Code from a `#c=` link never runs on its own.** A shared template loads into the editor for you
  to read, and the output pane shows a gate instead of a preview until you press *Run this
  template*. Code you typed yourself runs immediately; code that arrived in a URL does not.
- **The preview `<iframe>` is fully sandboxed** (`sandbox=""`), so the rendered output gets an
  opaque origin and cannot run scripts or reach the parent page.
- **The remaining exposure is the run itself.** Once you press Run, the template executes on the
  page's own origin. Moving evaluation into a cross-origin worker would close that, and is the right
  step before hosting this for untrusted traffic. The gate removes the drive-by; it does not make
  running a stranger's code safe.

## Stack

React 19, TypeScript, Vite, Sucrase for in-browser JSX, CodeMirror 6, lz-string for URL state.
No backend.

## Licence

MIT
