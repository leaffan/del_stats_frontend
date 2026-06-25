# Remaining Plan

This file captures the remaining repository improvement plan after the documentation and tooling baseline work already completed on this branch.

## 1. Repository hygiene and contributor flow

- Add issue and pull request templates that fit the public/private repository split.
- ✅ Document deployment and release expectations together with the required runtime data files.
- ✅ Review repository hygiene items that can be improved without making the public/private sync harder.

## 2. Configuration consolidation

- ✅ Identify repeated season values, data source paths, and table configuration across controllers and templates.
- ✅ Move shared configuration into a smaller number of clearly named files while keeping existing paths stable where possible.
- ✅ Keep every change easy to trace and port to `del_stats_frontend_ext`.

## 3. Validation and CI coverage

- ✅ Extend automated checks beyond the current core-file formatting validation.
- ✅ Start with low-risk checks for additional documentation and configuration files before adding broader validation.
- ✅ Keep local and CI commands lightweight, reproducible, and easy to understand.
- ✅ Set up pre-commit hook for automatic code formatting before git commits.

## 4. Controller maintainability

- Prioritize the largest AngularJS controllers for small, isolated cleanup steps.
- Extract clearly reusable helper logic without changing route, template, or data-loading behavior.
- Add focused validation around each refactoring step to keep behavior stable.

## 5. Data and runtime expectations

- ✅ Document the required untracked `data/` inputs for local and hosted usage.
- ✅ Clarify which public-repo changes must also be mirrored in the private superset repository.
- ✅ Capture the main manual verification scenarios for the key pages.
