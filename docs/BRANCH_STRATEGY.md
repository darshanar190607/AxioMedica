# Branch Strategy — AxioMedica

## Overview

We follow a lightweight **trunk-based** model with short-lived feature branches.

```
main  ←──────────────────────────────── protected, production-ready
 └── dev  ←────────────────────────── integration branch, CI must pass
       ├── feat/pose-angle-v2
       ├── feat/backend-session-api
       ├── fix/rep-counter-edge-case
       └── chore/update-dependencies
```

---

## Branch Rules

| Branch       | Purpose                          | Direct push? | PR required? | CI required? |
|--------------|----------------------------------|:------------:|:------------:|:------------:|
| `main`       | Stable, deployable code          | ✗ Never      | ✓ Yes        | ✓ Yes        |
| `dev`        | Integration — merge feat branches| ✗ Never      | ✓ Yes        | ✓ Yes        |
| `feat/*`     | New features                     | ✓ Authors    | —            | —            |
| `fix/*`      | Bug fixes                        | ✓ Authors    | —            | —            |
| `chore/*`    | Tooling / deps / docs            | ✓ Authors    | —            | —            |

> **Protected branches:** `main` and `dev` require at least **1 approving review** and
> all CI checks to pass before merge. Configure this in:
> *Settings → Branches → Branch protection rules.*

---

## Naming Conventions

```
feat/<short-description>        # e.g. feat/ankle-pump-config
fix/<issue-or-description>      # e.g. fix/jwt-expiry-refresh
chore/<task>                    # e.g. chore/bump-expo-57
docs/<what>                     # e.g. docs/adr-002-offline-sync
```

- Use **kebab-case**, all lowercase.
- Keep names under 50 characters.
- Prefix with a ticket number when available: `feat/AX-42-pose-angle-v2`

---

## Typical Workflow

```bash
# 1. Start from dev
git checkout dev && git pull origin dev

# 2. Create your branch
git checkout -b feat/my-feature

# 3. Work, commit often with clear messages
git commit -m "feat(pose): add heel-raise angle threshold"

# 4. Push and open PR → dev
git push -u origin feat/my-feature
# Open PR on GitHub: base = dev

# 5. After review + CI green → merge to dev (squash preferred)

# 6. Release: open PR dev → main, get sign-off from both owners
```

---

## Commit Message Format (Conventional Commits)

```
<type>(<scope>): <short summary>

Types: feat | fix | docs | chore | refactor | test | ci
Scopes: pose | backend | ml | mobile | contracts | ci
```

Examples:
- `feat(backend): add session sync endpoint`
- `fix(pose): handle missing keypoint in repCounter`
- `docs(contracts): bump pose_config schema to v1.1`
- `ci: add jest coverage threshold`

---

## Contract Changes

Whenever a file in `docs/contracts/` is modified:
1. Bump the `version` field in the schema JSON.
2. Update both `validate.js` **and** `validate.py`.
3. Check the "Contract changed?" box in the PR template.
4. Tag the PR with the `contract` label — both CODEOWNERS will auto-requested.
