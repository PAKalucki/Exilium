# GitHub Actions and Docker Hub

[image.yml](../.github/workflows/image.yml) checks pull requests and publishes after successful checks on configured branch/tag pushes or manual dispatch. Actions are pinned to release SHAs. Pull requests never publish or receive registry credentials.

Configure repository settings:

- Actions secret `DOCKERHUB_TOKEN`: a scoped token allowed to push the selected image.
- Actions variable `DOCKERHUB_USERNAME`: the publishing account.
- Actions variable `DOCKERHUB_IMAGE`: full image name, e.g. `your-namespace/exilium`.

Discord credentials, guild/admin IDs, real origins and infrastructure details are private runtime configuration, never build arguments or source constants.

CI validates formatting/types, lints source, runs unit/integration and Chromium workflows, audits production dependencies, builds a disposable image, scans it with Trivy, and runs production smoke checks before publication. Images support Linux AMD64/ARM64. Build stages use the host platform, and a guard requires architecture-independent production dependencies; review that assumption before adding native modules.

Image builds do not import or export GitHub Actions BuildKit caches. A cache upload could stall after the image was already built and prevent scanning or publication. Each build can still reuse its own local layers; separate jobs build from source and retain all validation gates.

The workflow publishes semantic version, full commit SHA, branch and default-branch latest tags. Deploy the immutable manifest reference from the workflow summary. Package version, image version label, footer and health API match. A `vX.Y.Z` Git tag must match `package.json`; update package, lockfile and [changelog](../CHANGELOG.md) together.

Source checks, image publication and a healthy deployment are separate outcomes. Keep operational inventories, domains, network policies, acceptance results and private commands outside this repository. Secrets, supplied references, local data and test artifacts are excluded from Git and image build context.

Trivy records all image severities in a SARIF artifact retained for 14 days. Publication is gated on fixable High/Critical vulnerabilities and secret findings; unfixed findings remain visible in the complete report. Repository secret scanning is a separate blocking check. No vulnerability suppressions are configured. The runtime image omits bundled npm/corepack/yarn and applies available fixes to its package-manager OS packages.

ESLint checks TypeScript, Svelte, scripts and tests with zero warnings allowed. Root-only routing and mutable nested item-form state have documented, narrow Svelte rule exceptions. The dev toolchain temporarily pins minimatch 11.0.1 to address GHSA-g3hv-75wg-m249; re-evaluate the override when upstream tools adopt the fixed major.

Dependabot opens weekly update PRs for npm, GitHub Actions and Docker. Compatible npm changes and action updates are grouped. Changes are reviewed and pass the same gates; there is no automatic merge or deployment of dependency PRs.

The publishing job enables ARM64 emulation for runtime OS package updates. Compilation and app dependency installation still run on the build host. The public-source check rejects literal private IPv4 addresses, private DNS suffixes and personal workspace paths; use reserved documentation addresses and keep operational records elsewhere.
