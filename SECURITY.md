# Security policy

## Supported version

Character Forge is pre-release software. Security fixes are applied to the latest commit on `main`; older commits and forks are not supported releases.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use the repository's private [security advisory form](https://github.com/luscanascimento/character-forge/security/advisories/new) with reproduction steps, affected routes or files, and the expected impact.

You should receive an initial acknowledgement within seven days. Confirmed issues will be assessed, fixed on `main`, and disclosed after a safe update is available. Please avoid accessing data that is not your own or disrupting the public SRD provider while testing.

## Security boundary

Characters are stored in the browser's IndexedDB and are not uploaded to a Character Forge account or database. The API performs stateless catalog normalization and character validation. Exported JSON files contain the complete character and should be handled as user data.
