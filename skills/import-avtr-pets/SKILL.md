---
name: import-avtr-pets
description: Import AVTR pet NFT sprites from a public Solana wallet into Codex pet folders. Use when the user asks to import, sync, autoload, or list AVTR pets/NFT pets from a wallet address. This skill only uses public wallet addresses and never requests private keys.
---

# Import AVTR Pets

Use the bundled script to scan a public wallet for AVTR pet NFTs and create local Codex pet folders.

## Safety

- Only use public wallet addresses.
- Never ask for, store, or use a private key, seed phrase, or signing wallet.
- The importer is read-only on-chain. It only writes local pet files.

## Default AVTR Collection

- Core collection address: `EA1FFKNwLPEfnGRKGeFBBWjD8gvjT4u5nfFhhdyXM57o`
- Symbol fallback: `AVTR`
- Default output root: `%USERPROFILE%\.codex\pets`

## Commands

From any workspace, run:

```powershell
node "$env:USERPROFILE\plugins\avtr-pet-importer\scripts\import-avtr-pets.mjs" --wallet <PUBLIC_WALLET>
```

Useful options:

```powershell
node "$env:USERPROFILE\plugins\avtr-pet-importer\scripts\import-avtr-pets.mjs" --wallet <PUBLIC_WALLET> --dry-run
node "$env:USERPROFILE\plugins\avtr-pet-importer\scripts\import-avtr-pets.mjs" --wallet <PUBLIC_WALLET> --output "$env:USERPROFILE\.codex\pets"
node "$env:USERPROFILE\plugins\avtr-pet-importer\scripts\import-avtr-pets.mjs" --wallet <PUBLIC_WALLET> --rpc <HELIUS_DAS_RPC_URL>
node "$env:USERPROFILE\plugins\avtr-pet-importer\scripts\import-avtr-pets.mjs" --wallet <PUBLIC_WALLET> --overwrite
```

## Behavior

The script:

1. Loads `.env.local` from the current workspace if present, then environment variables.
2. Uses Helius DAS `getAssetsByOwner` to list wallet NFTs.
3. Filters assets to the AVTR Core collection, with `AVTR` symbol as a fallback.
4. Downloads the NFT spritesheet and background when present in metadata files.
5. Creates a folder like `%USERPROFILE%\.codex\pets\avtr-jestique-161`.
6. Writes `pet.json` pointing at `spritesheet.webp`.

If an NFT does not expose a spritesheet in metadata, the importer saves a warning and skips it by default. Use the existing `hatch-pet` skill later if you want to turn a static NFT image into a generated Codex spritesheet.
