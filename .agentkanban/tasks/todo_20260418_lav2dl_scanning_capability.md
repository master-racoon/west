---
title: US-0.3 Scanning capability
lane: doing
created: 2026-04-18T09:05:22.684Z
updated: 2026-04-18T09:05:22.684Z
description: Access camera, extract barcode numbers and any text which is then used as a search against items
---

# Iteration 1

- [x] Install `html5-qrcode` and `tesseract.js` dependencies in warehouse-frontend
- [x] Create `ScanOverlay.tsx` component (configurable: barcode-only or barcode+OCR modes)
- [x] Add `GET /api/items/search?q=` backend endpoint (ILIKE search on name/description)
- [x] Add `useItemSearch` hook in frontend
- [x] Integrate scan button into AddStock page — auto-resolve on barcode scan, item picker on OCR
- [x] Integrate scan button into RemoveStock page
- [x] Integrate scan button into QuickCount page
- [x] Integrate scan button into TransferStock page
- [x] Integrate scan button into ProductsPage
