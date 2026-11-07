# Snyk scanning for this npm workspace

The repository uses npm, with one root `package-lock.json` for `apps/web`, `packages/core` and `packages/db`.

The import error **Missing required yarn.lock** on nested manifests comes from Snyk's SCM workspace handling. Snyk's current documentation says its SCM importer does not explicitly support npm workspaces, while CLI `--all-projects` uses the root lockfile for workspace scanning. Adding an unrelated Yarn lockfile would give the scanner a second dependency graph that the build does not use.

The committed `.github/workflows/snyk.yml` uses pinned Snyk CLI `1.1308.4` to:

1. Install the npm dependency graph from the root lockfile without lifecycle scripts.
2. Run `snyk monitor --all-projects` for organization `kokatenakul11`, linked to `Naks-bro/seiketsu-platform` and the branch.
3. Run `snyk test --all-projects` with a high-severity failure threshold. Monitoring still records lower-severity findings.

Add a Snyk credential authorized for that organization as the GitHub repository secret **SNYK_TOKEN**. Then run **Actions → Snyk npm workspaces → Run workflow**. It also runs weekly and when dependency manifests change on master. The workflow emits an explicit setup warning and skips scanning while the secret is absent. It never prints the token.

The failed nested SCM imports will not be repaired automatically by a code push; successful CLI monitoring creates/updates the workspace projects. Keep the root npm SCM project if useful and use the CLI-monitored workspace results for complete coverage. No Snyk web account settings were changed by this work.

For an authenticated local scan with a separately installed matching CLI:

```text
snyk test --all-projects --detection-depth=4 --org=kokatenakul11
snyk monitor --all-projects --detection-depth=4 --org=kokatenakul11 --remote-repo-url=https://github.com/Naks-bro/seiketsu-platform
```

Sources: [Snyk JavaScript workspace support](https://docs.snyk.io/supported-languages/supported-languages-list/javascript#support-for-monorepos-and-workspaces), [Snyk CLI test](https://docs.snyk.io/developer-tools/snyk-cli/commands/test).

The local npm advisory check on 7 November 2026 reported 12 moderate findings, all in development-tool dependency chains (`drizzle-kit`'s old esbuild loader and ESLint's minimatch chain), and no high/critical findings. Do not use `npm audit fix --force`: its suggested fixes include downgrading Next's ESLint config and Drizzle tooling across major versions. Review targeted upstream tooling updates separately; no vulnerabilities were suppressed or marked ignored.
