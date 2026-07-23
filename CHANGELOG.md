# Changelog

## [0.1.4](https://github.com/jlai403/excalihub/compare/v0.1.3...v0.1.4) (2026-07-23)


### Bug Fixes

* pass --repo to gh workflow run in release-please ([f1ab355](https://github.com/jlai403/excalihub/commit/f1ab3550d6014db8ed1761ddb202f48785bc9ded))

## [0.1.3](https://github.com/jlai403/excalihub/compare/v0.1.2...v0.1.3) (2026-07-23)


### Bug Fixes

* auto-trigger Docker publish via workflow_dispatch after release ([d19ff65](https://github.com/jlai403/excalihub/commit/d19ff65086e0284a243740fb04e68c4efc8473bf))

## [0.1.2](https://github.com/jlai403/excalihub/compare/v0.1.1...v0.1.2) (2026-07-23)


### Bug Fixes

* add workflow_dispatch to docker-publish, revert Quick Start to clone-based ([7767e60](https://github.com/jlai403/excalihub/commit/7767e60a8888acc52bda62222aa24f58e8346ae1))

## [0.1.1](https://github.com/jlai403/excalihub/compare/v0.1.0...v0.1.1) (2026-07-23)


### Features

* add ~ path alias for src/ ([f50bd59](https://github.com/jlai403/excalihub/commit/f50bd5997acc0cf4a063204189ef8b432175d79b))
* add archive/delete UI, fix e2e tests ([6a186f1](https://github.com/jlai403/excalihub/commit/6a186f1dfac001dac7f04733abd7ffba3617a290))
* add consola logger with colors and formatting ([093ba5c](https://github.com/jlai403/excalihub/commit/093ba5c135224fb5f4ef1cda4070cd8e6a3cb054))
* add dev:excalidraw script, compose dev scripts ([dcf1a53](https://github.com/jlai403/excalihub/commit/dcf1a53c60da0ce9a0d3e1e3b5bf62d384a9b05f))
* add HUB_SUBDOMAIN env var, consolidate hub serving in proxy middleware ([43b1841](https://github.com/jlai403/excalihub/commit/43b184188fa44b686b532ba4805a6fe7526aa2f7))
* add release-please workflow and Docker publish pipeline ([9f7f3fe](https://github.com/jlai403/excalihub/commit/9f7f3feaa89a935ebd3a9989eb191a734f42b51a))
* add release-please workflow and Docker publish pipeline ([80ae956](https://github.com/jlai403/excalihub/commit/80ae95655677292d6cea36c060a876704e60c11f))
* add service layer between routes and repos ([42eb8fb](https://github.com/jlai403/excalihub/commit/42eb8fb9f44d3fe478e9592774d9567ac1d8fabc))
* add vitest test suite with integration and unit tests ([04e2447](https://github.com/jlai403/excalihub/commit/04e24479556c5dbbf869bb4b0664fbe55785fb57))
* add vitest test suite with integration and unit tests ([f24b3e0](https://github.com/jlai403/excalihub/commit/f24b3e01346c770bd3aa5d4073fd72660e2ed9ef))
* archive/unarchive spaces, hard delete, shadcn/ui dark theme ([b87b5e7](https://github.com/jlai403/excalihub/commit/b87b5e7c8423b36e8c6f00eec2eb650fa359f075))
* archive/unarchive spaces, hard delete, shadcn/ui dark theme ([54f22f1](https://github.com/jlai403/excalihub/commit/54f22f16906cb9af97b0b197fcfffd07ef0ffaff))
* centralize env config with Zod Mini ([2cd6938](https://github.com/jlai403/excalihub/commit/2cd6938a368ca279188c28cbf0a7cdb769a22067))
* create space as modal, reactive list update (no page refresh) ([18a8186](https://github.com/jlai403/excalihub/commit/18a8186dcd8a1d05091f37e173b522e8789ba4e2))
* inject ExcaliHub button into Excalidraw toolbar ([7eecd7e](https://github.com/jlai403/excalihub/commit/7eecd7e17ff03c8a46bcb353046611cba326edb0))


### Bug Fixes

* add beforeAll cleanup to E2E tests for cross-project isolation ([2e61634](https://github.com/jlai403/excalihub/commit/2e61634527a0cb1f2ecffcf14bbc4c243209283d))
* backup retention, protocol mismatch, and UI improvements ([064fbfc](https://github.com/jlai403/excalihub/commit/064fbfcaf4a89d62d07a0f7aa9b2e0a33fee2539))
* backup retention, protocol mismatch, and UI improvements ([c5002d0](https://github.com/jlai403/excalihub/commit/c5002d08dda8cc65688e9c522c948749ea4bce5c))
* BASE_DOMAIN is root domain, not full hub domain ([1ad05ca](https://github.com/jlai403/excalihub/commit/1ad05caddccc0ae992f6a2e3350d0a263f5506ea))
* center sidebar icons and keep them stationary ([6afe849](https://github.com/jlai403/excalihub/commit/6afe849e84267ba60dc61ffcd61dc02bf6500614))
* collapse sidebar labels with max-w-0 to prevent text bleed ([74a846b](https://github.com/jlai403/excalihub/commit/74a846b6a2788b24da7a0d578012482424012c28))
* copy root tsconfig.json in Dockerfile for build ([0c0911f](https://github.com/jlai403/excalihub/commit/0c0911f4d3ae679620856ff11a49389cf2b08863))
* correct Astro proxy target to port 80 ([2a82ae4](https://github.com/jlai403/excalihub/commit/2a82ae40d66f0294688d31f19b23b94dcf60c84c))
* correct components.json schema for shadcn-svelte ([9137546](https://github.com/jlai403/excalihub/commit/913754672f119ef671f884b7de1b53ee204aa062))
* default BASE_DOMAIN=localhost for local dev ([c925e10](https://github.com/jlai403/excalihub/commit/c925e1002dfa87968e95091ddd302791aebfe395))
* E2E tests, hub link resolution, theme hydration, excalihub subdomain ([48c2b2e](https://github.com/jlai403/excalihub/commit/48c2b2e3cc291d097196483337143b05825200f2))
* injection middleware now works ([0913732](https://github.com/jlai403/excalihub/commit/0913732a1838d19b2fe4247d3d6d6e59da0315f8))
* keep sidebar icons stationary on hover/pin ([60a1deb](https://github.com/jlai403/excalihub/commit/60a1deb21d2057fa8bace2a9ab0fbc708df46f28))
* left-align nav text on sidebar hover ([84ff1f4](https://github.com/jlai403/excalihub/commit/84ff1f4ef653415d1805a56cd1b34ca7ee2229df))
* make backup system functional ([2fed11c](https://github.com/jlai403/excalihub/commit/2fed11c88ce747cdfc8144b5b8a644cdc2a293af))
* move proxy config to vite.server.proxy (Astro 7 compat) ([efb22e5](https://github.com/jlai403/excalihub/commit/efb22e5c3102dbb134d894cfc7ab249c1fa0419e))
* pin sidebar in e2e tests to fix hidden label selectors ([f247ac4](https://github.com/jlai403/excalihub/commit/f247ac449c97a534db317f7ab55fb2bf92007a28))
* remove TypeScript syntax from plain JS inject script ([bb2079e](https://github.com/jlai403/excalihub/commit/bb2079e7ef54d2c6157ef022cc7f42fc82b78538))
* separate dev and production server setup ([9a543b2](https://github.com/jlai403/excalihub/commit/9a543b2d8dc2a9374f0ddb81802836883d590b11))
* sidebar collapsed state — reactive label visibility, centered icons ([3c4969d](https://github.com/jlai403/excalihub/commit/3c4969d4b02dd5f98d7288c6a12b998fe32e6e11))
* use NODE_ENV instead of existsSync for serveStatic ([621c119](https://github.com/jlai403/excalihub/commit/621c119ff595fe2b88180beb5436d5fc5d599db6))
* use port 8081 for E2E tests (port 81 needs root on Linux) ([50155bf](https://github.com/jlai403/excalihub/commit/50155bf3a8d7ae3a95a44045af56966fe87154c5))


### Performance Improvements

* inject hubHost via Layout data attribute, eliminate /api/config fetches ([6ced36d](https://github.com/jlai403/excalihub/commit/6ced36d360919fa0c0a022f0859e5dfb6d5a1781))
