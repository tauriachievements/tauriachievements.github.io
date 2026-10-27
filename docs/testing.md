# Testing: test first

New logic and every bug fix start with a test. Write the test, run it and watch it fail, then
write the code that makes it pass. A test written after the code only shows that the code does
what it does; a test that failed first shows that it checks the behaviour, and that it would
catch the behaviour breaking again.

## What starts with a test

- **Pure logic:** a function in a feature's `<feature>.ts` or in `shared/`, `game/`, `core/` or
  `players/`; a build script in `spa/scripts/`; an exporter's service class; `Tauri.Core`.
- **Every bug fix:** first a test that reproduces the bug, at the lowest level that can show it:
  the pure function's spec when the logic is wrong, the component's spec when the component
  mishandles a right value, a [phone layout entry](#a-layout-bug) when the layout breaks.
- **A scoring or ranking rule change**, once the owner has agreed to it: change the test that
  pins the rule first ([scoring.md](scoring.md) names it for each rule).

Styles, motion, copy and markup without logic don't start with a unit test. They're checked
with the [visual check](frontend.md#visual-check), the
[phone layout check](frontend.md#phone-layout-check) and a real browser. A refactor that
shouldn't change behaviour starts with the existing tests green and ends with the same tests
green.

## The loop

1. **Red.** Write one test for the next small piece of behaviour, or the test that reproduces
   the bug. Run just that file ([below](#running-one-test-file)) and watch it fail.
2. **Check why it fails.** It must fail on an assertion, with the wrong value you expected. A
   build error, a missing import or a typo isn't a red test. For a function or method that
   doesn't exist yet, add it first with its final signature and a body that returns an empty
   value, so the test compiles and the assertion is what fails. A bug's test fails with the
   bug's symptom.
3. **Green.** Write the least code that makes the test pass, and run the file again.
4. **Refactor** with the tests green: names, small functions, the shared building blocks. Run
   the file after each change.
5. Repeat until the behaviour is complete. Then run the whole suite of each half you changed,
   `npm test` in `spa/` or `dotnet test AchievementLadder.sln` in `api/`, because a change can
   break a test somewhere else.

The PR's test plan names the tests written first and says each was seen failing before the code
that passes it.

## Running one test file

| Code | Test file | Run just it |
| --- | --- | --- |
| spa logic and components | `<name>.spec.ts` beside the code | from `spa/`: `npx ng test --watch=false --include <path>` |
| spa build scripts | `spa/scripts/<name>.test.js` | from `spa/`: `node --test scripts/<name>.test.js` |
| exporters, `Tauri.Core` | `api/tests/AchievementLadder.Tests/<Name>Tests.cs` | from `api/`: `dotnet test AchievementLadder.sln --filter "FullyQualifiedName~<Name>Tests"` |
| phone layout | an entry in `spa/e2e/visual-pages.ts` | from `spa/`: `npm run build`, then `npm run test:layout -- -g <entry name>` |

`--include` takes the spec, the file it tests (`src/app/features/pvp/arena-games.ts` runs
`arena-games.spec.ts`) or a folder. Add `--filter <regex>` to run only the suites and tests
whose names match.

## A layout bug

A page that scrolls sideways, clips or ends under a bottom bar only in some state (a menu open, a
filter set) reproduces as an entry in `spa/e2e/visual-pages.ts`, with the `path` and `clicks`
that reach that state. `npm run test:layout` fails on the entry before the fix and passes after
it. The entry stays, so the check guards the state from then on.

## Gotchas

- Specs import `describe`, `it` and `expect` from `'vitest'`. Without the import the test build
  fails with `TS2304: Cannot find name 'expect'`.
- A spec that doesn't compile fails the test build (`TS2305: Module … has no exported member`),
  so no test in that run executes. That's why step 2 stubs the function first.
- A cold full `ng test` run can time out a few DOM specs at 5 s. Rerun them before treating it as
  a regression.
- Tests never call the live Tauri API. Exporter tests feed recorded or hand-written responses
  through a fake `ITauriApiClient`.
- More spec traps (TestBed routing, counting numbers) are in
  [frontend.md](frontend.md#template-and-test-gotchas).
