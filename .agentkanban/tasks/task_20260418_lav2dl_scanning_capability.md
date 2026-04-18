---
title: US-0.3 Scanning capability
lane: done
created: 2026-04-18T09:05:22.684Z
updated: 2026-04-18T10:42:16.656Z
description: Access camera, extract barcode numbers and any text which is then used as a search against items
sortOrder: -1
slug: scanning_capability
---

## Conversation

### user

Access camera, extract barcode numbers and any text which is then used as a search against items

### agent

**Plan: Camera-Based Barcode Scanning**

**Current state:** All scanning pages (AddStock, RemoveStock, QuickCount, TransferStock, ProductsPage) use a manual text input for barcode/item ID. The backend already has `GET /items/lookup/{barcode}` and item resolution on all movement endpoints. No camera or scanning library is installed.

**Approach:** Add a reusable `<BarcodeScanner>` component that accesses the device camera, decodes barcodes in real-time, and feeds the decoded value into the existing barcode input fields. This keeps all existing resolution logic untouched — the scanner just automates what users currently type.

**Library choice:** `html5-qrcode` — well-maintained, supports 1D barcodes (EAN-13, UPC-A, Code128, Code39, etc.) and 2D codes (QR, DataMatrix), uses the browser MediaDevices API, works on mobile and desktop.

**Architecture:**

1. **`<BarcodeScanner>`** component in `warehouse-frontend/src/components/BarcodeScanner.tsx`
   - Props: `onScan(value: string)`, `onClose()`
   - Opens device camera (prefers rear-facing on mobile)
   - Decodes barcode continuously
   - Calls `onScan` with decoded string, then auto-closes
   - Close button to dismiss without scanning

2. **Integration pattern** — each page gets a "Scan" button next to the barcode input. Clicking it opens `<BarcodeScanner>` as an overlay/modal. On successful scan, the decoded value is written into the barcode input and `resolveItem()` is triggered automatically. Zero changes to existing resolution logic or backend.

3. **Pages to integrate:**
   - AddStock — scan button next to barcode input
   - RemoveStock — scan button next to barcode input
   - QuickCount — scan button next to barcode input
   - TransferStock — scan button next to barcode input
   - ProductsPage — scan button next to barcode search (for adding barcodes)

**Regarding "any text" (OCR):** Camera-based text recognition (OCR) would require `tesseract.js` (~2MB WASM), is significantly slower, and has lower accuracy on product labels. The barcode scanner itself extracts the barcode's encoded number/text — this covers the primary use case. If full OCR is needed later, it can be added as a separate mode on the same scanner component.

**Scope decision:** Implement barcode scanning only. The decoded barcode string is used as the search term against items — exactly matching the existing `resolveItem()` flow.

### user

Not all bottles have barcodes — some only have a label. Need text capture (OCR) too, not just barcode scanning.

### agent

Fair point — the description literally says "extract barcode numbers **and any text**". Updated plan to include both modes.

**Revised Plan: Camera Scanning — Barcode + OCR**

Two scan modes behind a single "Scan" button:

| Mode           | Library        | How it works                                        | Result                                                                             |
| -------------- | -------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Barcode**    | `html5-qrcode` | Real-time camera decode of 1D/2D barcodes           | Decoded string → existing `resolveItem()` flow (barcode lookup → item ID fallback) |
| **Text (OCR)** | `tesseract.js` | Capture photo → OCR extract text → user picks/edits | Extracted text → search items by name                                              |

**UX flow:**

1. User taps **📷 Scan** button next to barcode input
2. Camera overlay opens — defaults to **barcode mode** (real-time decode)
3. If barcode detected → auto-fills input, triggers resolve, closes overlay
4. If no barcode found (label-only bottle), user taps **"Read Text"** toggle
5. Switches to OCR mode — user taps **capture** to take a photo
6. `tesseract.js` processes the image, extracts text
7. Extracted text shown in an editable field (OCR is imperfect — user can trim/fix)
8. User confirms → text goes into the barcode/search input field

**Backend impact:** The existing `resolveItem()` first tries barcode lookup, then item-ID lookup. For OCR text (a product name), neither will match. We need a **text search** endpoint:

- `GET /api/items/search?q=<text>` — fuzzy/ILIKE search against `item.name` and `item.description`
- Returns matching items so the user can pick the right one
- If exactly one match, auto-select it

**Architecture:**

1. **`<BarcodeScanner>`** component — barcode-only real-time scanning (same as before)
2. **`<TextScanner>`** component — capture photo, run tesseract OCR, return extracted text
3. **`<ScanOverlay>`** wrapper component — modal with tab toggle between Barcode and Text modes, close button
4. **Backend** — `GET /api/items/search?q=<text>` endpoint with ILIKE search
5. **Integration** — each page's scan button opens `<ScanOverlay>`. Barcode result → `resolveItem()`. Text result → search endpoint → show matches → user picks item.

**Library sizes:**

- `html5-qrcode`: ~200KB
- `tesseract.js`: ~170KB JS + ~2MB WASM worker (loaded on demand only when OCR mode is activated, not on page load)

**Questions before implementing:**

1. Is the search endpoint (`GET /api/items/search?q=`) acceptable, or should OCR text just populate the existing input and rely on manual resolution?
2. Should we lazy-load tesseract only when the user switches to text mode (saves bandwidth for barcode-only users)?

### user

Make the component configurable — proceed with todo and implement.

### agent

Implementation complete. All items checked off.

**What was built:**

1. **`ScanOverlay.tsx`** — Configurable scanning component with two modes:
   - **Barcode mode** (default): real-time camera decode via `html5-qrcode`, prefers rear camera, auto-closes on detection.
   - **OCR mode** (enabled via `enableOcr` prop): captures photo, lazy-loads `tesseract.js` on demand, extracts text into an editable field for user confirmation.
   - Props: `onBarcodeScan(value)`, `onTextCapture?(value)`, `onClose()`, `enableOcr?`.

2. **Backend**: `GET /api/items/search?q=<text>` — ILIKE search on `item.name` and `item.description`, returns up to 20 matches. Added to items router.

3. **Frontend**: `useItemSearch(query)` hook added to `useItems.ts`. API wrapper `client.items.searchItems(q)` added.

4. **Page integrations** — "📷 Scan" button added next to barcode input on:
   - AddStock (barcode + OCR)
   - RemoveStock (barcode + OCR)
   - QuickCount (barcode + OCR)
   - TransferStock (barcode + OCR)
   - ProductsPage — barcode-only on create-item and add-barcode forms (OCR not needed for registering barcode values)

5. **Auto-resolve**: On all movement pages, a successful barcode scan automatically triggers item resolution (barcode lookup → item ID fallback), same as pressing Enter in the text input.

**Dependencies installed**: `html5-qrcode`, `tesseract.js`. API client regenerated.

**Type check**: Frontend clean. Backend has pre-existing type errors on getItem/addBarcode routes (unrelated to this change).

### user
