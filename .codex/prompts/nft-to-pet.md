Import AVTR pet NFTs from a public Solana wallet into local Codex pet folders.

Use only the public wallet address provided by the user. Never ask for, store, or use a private key, seed phrase, wallet adapter, or signing flow.

If the user included a wallet address after the slash command, use that wallet. If no wallet address is present, ask for the public wallet address.

Run the importer from this repo when the current workspace is `nft-to-pet`:

```powershell
node .\scripts\import-avtr-pets.mjs --wallet <PUBLIC_WALLET> --rpc https://lynna-5pnsd0-fast-mainnet.helius-rpc.com
```

Run the installed plugin path from other workspaces:

```powershell
node "$env:USERPROFILE\plugins\nft-to-pet\scripts\import-avtr-pets.mjs" --wallet <PUBLIC_WALLET> --rpc https://lynna-5pnsd0-fast-mainnet.helius-rpc.com
```

For a preview-only run, add `--dry-run`.

After running, summarize how many assets were seen, how many AVTR pet NFTs matched, how many were imported, and the output folders. If no AVTR pets were found, say that clearly.
