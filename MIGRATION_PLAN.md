# Unity RTS Migration Plan v1

## Execution Status

- Local base repo now uses:
  - `origin` = `https://github.com/chenfengyun163/tank_9.git`
  - `upstream` = `https://github.com/muhammadameer-dev/unity-rts-builder-prototype.git`
  - `reference-sandbox` = `https://github.com/alexfcoding/RTS-Sandbox.git`
- Local integration branch `dev` has been created from the imported base.
- Pushes to `origin` were attempted for `dev`, `feature/single-resource-freeze`, and `v0.1.0-import`.
- GitHub rejected those refs because the imported history references missing Git LFS objects from the public base repo.
- The default delivery route is now to rebuild a clean private history instead of continuing to chase missing upstream LFS history.

## Repository Roles

- `origin`: your private GitHub repository, the only write target.
- `upstream`: `muhammadameer-dev/unity-rts-builder-prototype`, read-only source reference.
- `reference-sandbox`: optional read-only remote or separate local clone for `alexfcoding/RTS-Sandbox`.

## Recommended Migration Flow

1. Keep the current clone as the working reference with `upstream` and `reference-sandbox`.
2. Continue local feature development without letting inherited LFS history block progress.
3. When ready for the first stable remote handoff, rebuild a clean private history from the current working tree.
4. Push the rebuilt clean history to `origin`.
5. Resume normal `main` / `dev` / `feature/*` workflow on top of that clean private history.

## Command Template

```bash
git remote rename origin upstream
git remote add origin git@github.com:YOUR_ORG/YOUR_PRIVATE_REPO.git
git checkout -b main
git push -u origin main
git push origin --tags
```

## LFS History Resolution Options

### Option A: Repair Or Rehydrate Upstream LFS History

- Approach:
  - Recover the missing LFS objects from the public base repo or another authoritative copy.
  - Re-run LFS fetch/push until every historical object referenced by the inherited commit graph exists locally and remotely.
  - Push the original history to `origin`.
- Benefits:
  - Preserves the public base repo history as-is.
  - Simplifies commit ancestry comparison against `upstream`.
- Risks:
  - The missing objects may not be recoverable.
  - The effort is high relative to prototype delivery value.
  - Remote push can stay blocked indefinitely.
- Cost:
  - High.
- Best fit:
  - Only if preserving the full public base history is a hard requirement.

### Option B: Rebuild A Clean Private History

- Approach:
  - Use the current working tree as the new canonical baseline.
  - Create a fresh history in the private repo without inheriting the broken upstream LFS graph.
  - Keep `upstream` and `reference-sandbox` as read-only references.
- Benefits:
  - Fastest path to a pushable private repo.
  - Unblocks branches, tags, PR flow, and rollback cadence.
  - Matches the delivery goal better than historical preservation.
- Risks:
  - The private repo will not preserve the public base commit lineage.
  - The clean-history cutover needs one deliberate migration step.
- Cost:
  - Medium to low.
- Best fit:
  - Current project goal: ship a working RTS prototype with sustainable AI-assisted iteration.

## Recommended Conclusion

- Default route: **Option B - rebuild a clean private history**.
- Reason:
  - It removes the only blocker that currently affects remote delivery while preserving local development momentum.
  - `upstream` still provides the original public base for reference diffing without forcing broken history into `origin`.

## Clean-History Execution Rule

- Continue local implementation on feature branches.
- Do not keep retrying pushes that depend on the inherited broken LFS history.
- Schedule the clean-history rebuild at the first stable handoff point, ideally after the next few atomic tasks land locally.
- After the clean-history cutover, recreate `main`, `dev`, and active feature branches on the new remote history.

## Branch Strategy

- `main`: always runnable, protected, release-grade.
- `dev`: daily integration branch.
- `feature/*`: one atomic task per branch.
- `fix/*`: focused repair branches.
- `refactor/*`: non-feature structural cleanup branches.

## Commit Granularity

- One commit should express one intent.
- One branch should solve one atomic task.
- Avoid mixing feature logic, refactor cleanup, and bulk formatting.

## PR Flow

1. Branch from `dev`.
2. Implement one atomic task.
3. Open PR into `dev` with scope, risk, rollback, and manual Unity steps.
4. Merge to `main` only through release or stabilization PRs.

## Tag Milestones

- `v0.1.0-import`
- `v0.1.0-arch-freeze`
- `v0.1.0-core-loop`
- `v0.1.0-demo`

## Main Branch Protections

- No direct push.
- No force push.
- PR required.
- At least one reviewer.
- Branch must be up to date before merge.
- Keep tag history immutable after release.

## Rollback Strategy

- Revert a bad commit with `git revert`.
- Revert a bad merge PR with `git revert -m 1`.
- Roll back releases by returning to the previous tag and hotfixing from there.

## Current Blockers

- Private repository URL has been provided and wired locally.
- Authentication mode is still not confirmed for push operations.
- `RTS-Sandbox` has been attached locally as `reference-sandbox`.
- The inherited base-repo history is not cleanly pushable to GitHub due to missing LFS objects for historical FBX files.
