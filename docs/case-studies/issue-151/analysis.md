# Issue 151 Case Study

## Data Collected

- Issue snapshot: `data/issue-151.json`
- Issue comments snapshot: `data/issue-151-comments.json`
- PR snapshot: `data/pr-152.json`
- PR conversation comments: `data/pr-152-conversation-comments.json`
- PR inline comments: `data/pr-152-inline-comments.json`
- PR reviews: `data/pr-152-reviews.json`
- Initial PR diff: `data/pr-152-initial.diff`
- UI evidence: `images/regular-posts-calendar.png`

## Problem Summary

Issue 151 asks for a new Pipeline mode release type named `Regular posts`.
It should behave like the album release flow for bulk file selection and ordering,
but each ordered file becomes a separate scheduled post. The user configures a
cycle length and one or more day/time slots inside that cycle. The stage widget
must show a calendar covering the active cycle-derived period, with publication
days highlighted. When the ordered material ends before a cycle ends, the active
calendar highlighting must stop on the last actual publication day.

## External Research

- YouTube Data API video resources already support `status.publishAt` for
  scheduled publication, and the field is valid only for private videos that have
  not already been published:
  https://developers.google.com/youtube/v3/docs/videos
- The existing UI uses local date/time inputs. MDN documents that
  `datetime-local` represents a local date and minute without carrying a time
  zone, so the app should keep the local editing model and convert to ISO only
  when preparing the upload request:
  https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/datetime-local
- FullCalendar can expand recurring events and also integrates with RRule for
  more advanced recurrence:
  https://fullcalendar.io/docs/recurring-events
- rrule.js is a JavaScript library for iCalendar-style recurrence rules:
  https://github.com/jkbrzt/rrule

## Solution Options

1. Add FullCalendar and rrule.js. This would provide a broad recurrence model
   and a mature calendar view, but it adds dependencies and UI weight to an
   example page that currently uses plain JavaScript and local helpers.
2. Add rrule.js only and keep the existing UI. This helps with recurrence
   expansion, but the requested model is cycle-day positions, not normal weekly
   or monthly calendar recurrence, so it would still need custom mapping.
3. Extend the existing pipeline stage model and render a small custom calendar.
   This matches the current architecture, avoids dependencies, and directly
   represents "day N of an M-day cycle" slots.

The implemented approach uses option 3.

## Implemented Behavior

- Added `regular-posts` to the release type selector.
- Added cycle length and post slot controls for day/time positions inside the
  cycle.
- Reused the album-style ordered track list for the selected regular post files.
- Expanded the publication schedule by assigning ordered materials to sorted
  cycle slots, repeating slots across cycles until material runs out.
- Added a calendar preview that marks the active covered days and individual
  publication days, stopping active highlighting at the last scheduled post.
- Preserved the existing YouTube upload path by assigning each generated task its
  own `publishAt` value.

## Verification

- Focused Cypress regression: `data/cypress-pipeline.log`
- JavaScript syntax check: `data/node-check.log`
- Typecheck: `data/npm-typecheck.log`
- Lint: `data/npm-lint.log`
- Unit tests: `data/npm-test.log`
- Build: `data/npm-build.log`
