# Issue 207 case study: reusable pipeline render history

## Report

Issue 207 asks the pipeline to reuse existing visualized tracks and the completed full-album video when a release stage is changed to **Upload to YouTube**. The rendered outputs must survive between pipeline runs, which requires render history rather than a run-local cache.

The original implementation kept completed track renders only in `renderedPipelineVideos`, an in-memory `Map`. It cleared that map at the beginning of every run and never stored the full-album result. Consequently:

- upload-only track tasks uploaded the selected source files (including audio) instead of completed visualizations;
- the full-album task could only join track videos created earlier in the same run;
- reloads lost every completed render.

## Implemented solution

The existing pipeline IndexedDB database now has a versioned `render-history` object store. Each successful output is stored as a structured-cloneable record containing its stage ID, track index (or `full-album`), `Blob`, format, and creation timestamp.

Upload-only execution resolves this history before falling back to the selected input file:

1. per-track uploads look up `stageId:trackIndex`;
2. the full-album upload looks up `stageId:full-album`;
3. direct upload of user-selected video files remains the fallback when no render exists.

Stage replacement preserves selected files for unchanged stage IDs, so changing only the action does not disconnect the stage from its inputs or history.

## Alternatives considered

- `localStorage` cannot store video `Blob` values and has a small synchronous quota.
- Object URLs are process-local references and become invalid after reload.
- File System Access API handles would require additional permissions and have narrower browser support.
- OPFS can be useful for very large media libraries, but adds file naming, lifecycle, and metadata management that IndexedDB already provides for this application.

IndexedDB is the smallest compatible choice because the application already uses it to persist selected pipeline files and browsers clone `Blob` values directly.

## External references

- MDN IndexedDB API: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- MDN structured clone algorithm, including `Blob` support: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
- MDN storage quotas and eviction criteria: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- MDN Origin Private File System: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system

## Regression coverage and verification

`cypress/e2e/pipeline-album-rendering.cy.js` now runs a two-track album visualization, persists both tracks and the full album, switches the same stage to upload-only, reloads the page, and verifies that three uploads receive the rendered video contents without any new rendering or joining.

Local verification:

- focused Cypress album suite: 3 passing;
- Jest: 10 suites and 354 tests passing;
- TypeScript typecheck: passing;
- ESLint: passing;
- Rollup build: passing with the repository's existing warnings.

## Preserved issue data

- `issue.json`: issue metadata captured from GitHub on 2026-08-13.
- `issue-comments.json`: complete issue comment list (empty at capture time).
