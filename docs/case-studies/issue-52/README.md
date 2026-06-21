# Case Study: Issue #52 - Sticky Preview Window

## Summary

**Issue:** #52 - "Сделать превью stiky." (Make preview sticky)
**Status:** Misinterpreted and incorrectly implemented
**Root Cause:** Language/terminology confusion between "preview window" (CSS element) and "presentation window" (Electron window)

---

## Original Request

**Title:** Сделать превью stiky.
**Body:** Окно превью должно быть стики - всегда оставаться наверху экрана приложения.

**Translation:**
- Title: "Make preview sticky."
- Body: "The preview window should be sticky - always remain at the top of the application screen."

**Key Phrase Analysis:**
- "наверху экрана приложения" = "at the top of the application screen"
- This indicates CSS `position: sticky` behavior, NOT Electron's `setAlwaysOnTop`

---

## Timeline of Events

### 2026-01-07T20:44:24Z - Issue Created
- @Jhon-Crow creates issue #52 requesting sticky preview

### 2026-01-07 - First Implementation Attempt
- AI interpreted "превью" (preview) as "презентация" (presentation)
- Implemented `setAlwaysOnTop(true)` for Electron's presentation window
- Commit: `a9bbd3e feat: Enhance sticky behavior for presentation window`

### 2026-01-08T04:34:08Z - First Feedback
- @Jhon-Crow comments: "я имел ввиду не это! превью окно во всех режимах должно быть стики по умолчанию."
- Translation: "I didn't mean this! The preview window should be sticky by default in all modes."
- AI still misinterprets - thinks it means presentation window should be sticky in all Window Mode settings

### 2026-01-08T04:45:55Z - Second Implementation Attempt
- AI commits: `c3322e5 feat: Make presentation window always sticky in all modes`
- Made presentation window ALWAYS use `setAlwaysOnTop(true)`, regardless of Window Mode dropdown
- Still wrong - modifying the wrong window entirely

### 2026-01-08T10:37:22Z - Second Feedback (Clarification)
- @Jhon-Crow clarifies: "Нет, это не то. Мне не нужно чтоб окно презентации было стики. Мне нужно чтоб окно превью (предпросмотра) было стики."
- Translation: "No, that's not it. I don't need the presentation window to be sticky. I need the preview (предпросмотра) window to be sticky."
- Explicitly distinguishes between "окно презентации" (presentation window) and "окно превью" (preview window)

---

## Root Cause Analysis

### Problem 1: Terminology Confusion

The application has two visual elements that could be called "preview":

1. **Canvas Preview (Correct Target)**
   - Location: Main application window
   - Element: `<canvas id="visualizer">` inside `.canvas-container`
   - Purpose: Real-time preview of visualization settings
   - File: `examples/index.html:1054`

2. **Presentation Window (Incorrect Target)**
   - Location: Separate Electron BrowserWindow
   - Purpose: Overlay window for streaming/presenting
   - File: `electron/main.js` - `createPresentationWindow()`

### Problem 2: Language Barrier

The codebase uses English terminology:
- Code uses "presentation" (e.g., `presentationWindow`, `createPresentationWindow()`)
- UI uses "Presentation Mode" tab

The issue author uses Russian:
- "превью" / "предпросмотр" = "preview" (the canvas element in main window)
- "презентация" = "presentation" (the separate overlay window)

### Problem 3: Context Misinterpretation

The phrase "стики" (sticky) in Russian web development context typically refers to CSS `position: sticky`, not Electron's always-on-top behavior.

The phrase "наверху экрана приложения" (at the top of the application screen) clearly indicates:
- The element should stick to the TOP of the viewport while scrolling
- NOT that a separate window should be above other windows

---

## Correct Solution

### What Should Be Done

Make the canvas preview (`#visualizer` in `.canvas-container`) sticky so it remains visible while users scroll through the many visualization settings below.

### CSS Implementation

```css
.canvas-container {
  position: sticky;
  top: 0;
  z-index: 100;
  /* Existing styles preserved */
}
```

### Why This Makes Sense

1. The main window has many visualization settings below the canvas
2. Users need to see the canvas while adjusting settings to see real-time feedback
3. Making it sticky ensures visibility while scrolling through options

---

## Lessons Learned

1. **Verify terminology early** - When request uses non-English terms, confirm exact meaning
2. **Identify all UI elements** - Map user terms to actual code elements before implementing
3. **Consider context** - "sticky" in CSS context differs from "always on top" in window management
4. **Ask clarifying questions** - When uncertain, ask before implementing

---

## Files in This Case Study

- `logs/issue-52.json` - Original issue data
- `logs/pr-63.json` - Pull request data
- `logs/pr-63-comments.json` - All PR conversation comments
- `logs/pr-63-diff.txt` - Current PR diff
- `logs/git-log.txt` - Git commit history
- `logs/solution-draft-log-1.txt` - First AI session log
- `logs/solution-draft-log-2.txt` - Second AI session log
