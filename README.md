# DEL Hockey Stats Frontend

Public frontend for DEL hockey statistics. This repository contains a static AngularJS frontend for presenting player, team, and career data.

## Project status

- Architecture: static single-page app with AngularJS 1.7
- Styling: Bootstrap 4, Angular Material, and project-specific CSS files
- Data sources: JSON/CSV files from `data/` as well as external assets
- Special note: This repository is a **public subset** of `del_stats_frontend_ext`

## Repository structure

- `/index.html` – application entry point
- `/js` – AngularJS app, routing, and controllers
- `/css` – stylesheets
- `/cfg` – configuration and column definitions
- `/custom_directives` – AngularJS templates for reusable tables and UI blocks
- `/*.html` – route templates

## Local usage

Since this is a static frontend, a simple local web server is sufficient:

```bash
cd del_stats_frontend
python3 -m http.server 8000
```

You can then open the application at `http://localhost:8000/index.html`.

## Tooling and CI

A small Node-based tooling layer is available for initial reproducible repository checks.

```bash
pnpm install --frozen-lockfile
pnpm check
```

At the moment, the CI intentionally checks only the core repository and workflow files with Prettier. This keeps the setup small, understandable, and easy to port to `del_stats_frontend_ext`.

The GitHub Action is located at `.github/workflows/ci.yml` and runs on pushes and pull requests.

## Data notes

- The repository does not contain all runtime-relevant data in Git tracking.
- Several pages expect files under `data/`.
- Changes to data exports or internal data sources must remain aligned with the private repository `del_stats_frontend_ext`.

## Maintenance principles

To keep changes traceable between the public and private repositories:

1. Keep changes small and clearly focused.
2. Preserve the existing file structure and paths whenever possible.
3. Only perform refactorings when they provide clear value and are easy to port.
4. In change descriptions, always specify which files and behavior are affected.

## Current improvement opportunities

- Continue improving the README, contributor documentation, and repository hygiene
- Further centralize configuration such as season values and data sources
- Add more automated checks and CI coverage
- Gradually split large controllers into smaller units

## Contributing

See `CONTRIBUTING.md`.
