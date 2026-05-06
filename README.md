# NFT to Pet

Local Codex plugin for importing AVTR pet NFT sprites from a public Solana wallet.

It never needs a private key, seed phrase, wallet adapter, or signature.

## Install Locally For Codex

This repo is already shaped as a Codex plugin:

```text
.codex-plugin/plugin.json
skills/import-avtr-pets/SKILL.md
scripts/import-avtr-pets.mjs
```

To use it as a home-local plugin, copy or symlink this repo folder into your local plugin folder and add it to your local marketplace:

```powershell
Copy-Item -Recurse -Force "$PWD" "$env:USERPROFILE\plugins\nft-to-pet"
```

Then ensure `%USERPROFILE%\.agents\plugins\marketplace.json` contains:

```json
{
  "name": "nft-to-pet",
  "source": {
    "source": "local",
    "path": "./plugins/nft-to-pet"
  },
  "policy": {
    "installation": "AVAILABLE",
    "authentication": "ON_INSTALL"
  },
  "category": "Productivity"
}
```

## Import Pets

```powershell
node .\scripts\import-avtr-pets.mjs --wallet <PUBLIC_WALLET>
```

By default this writes Codex pet folders into:

```text
C:\Users\leon\.codex\pets
```

Each imported NFT becomes a folder like:

```text
avtr-jestique-161/
  pet.json
  spritesheet.webp
  background.png
  preview.gif
```

## Preview Without Writing

```powershell
node .\scripts\import-avtr-pets.mjs --wallet <PUBLIC_WALLET> --dry-run
```

## Options

- `--wallet <address>`: public Solana wallet to scan.
- `--output <folder>`: output root. Defaults to `%USERPROFILE%\.codex\pets`.
- `--collection <address>`: collection address. Defaults to the AVTR Core collection.
- `--symbol <symbol>`: fallback symbol filter. Defaults to `AVTR`.
- `--rpc <url>`: Helius DAS RPC URL.
- `--overwrite`: overwrite existing imported pet folders.
- `--dry-run`: list matching pets without writing files.
