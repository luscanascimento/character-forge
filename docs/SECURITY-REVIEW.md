# Security and dependency review

Checkpoint: 2026-10-20 (America/Sao_Paulo)

## Data and trust boundaries

- Character documents remain in browser IndexedDB unless the user explicitly exports a JSON file.
- The web client treats local files, IndexedDB records, route parameters, and API responses as untrusted and validates versioned documents with Zod.
- The API stores no character data. It validates request bounds and resolves rule facts through its own typed provider adapter.
- The external SRD provider is untrusted and time-bounded; malformed responses fail closed before entering domain rules.
- There are no authentication cookies, user accounts, server database credentials, or analytics identifiers.

## Controls reviewed

- Production API responses omit the Kestrel server header and include content-type, framing, referrer, permissions, and restrictive API CSP headers.
- Production HTTPS redirection and HSTS are enabled outside Development.
- Catalog traffic has an IP-partitioned fixed-window limit, while request and import schemas impose bounded sizes and counts.
- Production containers use unprivileged runtime users, minimal multi-stage outputs, explicit healthchecks, and no source tree in the runtime image.
- The web reverse proxy adds browser security headers and permits only same-origin application resources; inline styles remain allowed because Motion applies presentation styles at runtime.
- CI pins third-party Actions to reviewed commit SHAs and runs npm and NuGet vulnerability checks.
- Dependabot reviews npm, NuGet, GitHub Actions, and both container bases weekly.

## Dependency checkpoint

`npm audit` and `dotnet list CharacterForge.slnx package --vulnerable --include-transitive` report no known vulnerabilities after updating Vite from 8.3.1 to 8.3.4. The update addresses development-server command-injection advisories and does not change the production application contract.

## Residual risks

- Availability and content freshness depend on the public SRD provider; memory caching does not survive API restarts.
- Browser extensions, a compromised device profile, or scripts injected by a compromised deployment origin could read local characters.
- Exported files leave the IndexedDB boundary and rely on the user-selected storage/share destination.
- IP rate limiting is process-local and is not a distributed denial-of-service control.
- Container image and repository secret scanning should be enabled in the deployment platform in addition to repository-level dependency review.
