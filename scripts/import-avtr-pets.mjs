#!/usr/bin/env node
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

const DEFAULT_COLLECTION = 'EA1FFKNwLPEfnGRKGeFBBWjD8gvjT4u5nfFhhdyXM57o';
const DEFAULT_SYMBOL = 'AVTR';
const DEFAULT_OUTPUT = path.join(os.homedir(), '.codex', 'pets');

function parseArgs(argv) {
  const args = {
    collection: DEFAULT_COLLECTION,
    symbol: DEFAULT_SYMBOL,
    output: DEFAULT_OUTPUT,
    pageLimit: 1000,
    maxPages: 20,
    dryRun: false,
    overwrite: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--overwrite') {
      args.overwrite = true;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      args[key] = value;
      i += 1;
    } else if (!args.wallet) {
      args.wallet = arg;
    }
  }

  return args;
}

async function loadDotEnv(filePath) {
  const text = await fs.readFile(filePath, 'utf8').catch(() => '');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

function getRpcUrl(args) {
  const heliusFromKey = process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : '';
  const rpc =
    args.rpc ||
    process.env.HELIUS_RPC_URL ||
    process.env.SOLANA_RPC_PROXY_TARGET ||
    process.env.SOLANA_RPC_URL ||
    heliusFromKey;

  if (!rpc || rpc === '/rpc') {
    throw new Error(
      'No Helius DAS RPC URL found. Pass --rpc <url>, set HELIUS_RPC_URL, or run from a workspace with SOLANA_RPC_PROXY_TARGET in .env.local.',
    );
  }
  return rpc;
}

async function rpcRequest(rpcUrl, method, params) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: `avtr-${method}`, method, params }),
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `${method} RPC request failed`);
  }
  return data.result;
}

async function getAssetsByOwner(rpcUrl, ownerAddress, options) {
  const all = [];
  const pageLimit = Math.max(1, Math.min(1000, Number(options.pageLimit) || 1000));
  const maxPages = Math.max(1, Math.min(100, Number(options.maxPages) || 20));

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await rpcRequest(rpcUrl, 'getAssetsByOwner', {
      ownerAddress,
      page,
      limit: pageLimit,
      displayOptions: {
        showCollectionMetadata: true,
        showFungible: false,
        showNativeBalance: false,
      },
    });
    const items = Array.isArray(result?.items) ? result.items : [];
    all.push(...items);
    if (items.length < pageLimit) break;
  }

  return all;
}

function getMetadata(asset) {
  return asset?.content?.metadata || {};
}

function getFiles(asset) {
  return Array.isArray(asset?.content?.files) ? asset.content.files : [];
}

function isAvtrAsset(asset, options) {
  const collection = String(options.collection || '').trim();
  const symbol = String(options.symbol || '').trim();
  const grouping = Array.isArray(asset?.grouping) ? asset.grouping : [];
  const inCollection =
    collection &&
    grouping.some((group) => group?.group_key === 'collection' && String(group?.group_value) === collection);
  if (inCollection) return true;
  return symbol && String(getMetadata(asset).symbol || '').toUpperCase() === symbol.toUpperCase();
}

function getTrait(asset, traitName) {
  const attributes = Array.isArray(getMetadata(asset).attributes) ? getMetadata(asset).attributes : [];
  const trait = attributes.find((item) => String(item?.trait_type || '').toLowerCase() === traitName.toLowerCase());
  return trait?.value ? String(trait.value) : '';
}

function sanitizeSlug(value, fallback = 'pet') {
  const slug = String(value || fallback)
    .toLowerCase()
    .replace(/#\s*/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug || fallback;
}

function extFromUrl(uri, fallback = '.bin') {
  try {
    const ext = path.extname(new URL(uri).pathname);
    if (ext && ext.length <= 8) return ext;
  } catch {}
  return fallback;
}

function mimeFallbackExt(mime, fallback) {
  if (/webp/i.test(mime || '')) return '.webp';
  if (/png/i.test(mime || '')) return '.png';
  if (/gif/i.test(mime || '')) return '.gif';
  if (/jpe?g/i.test(mime || '')) return '.jpg';
  return fallback;
}

function selectAssetFiles(asset) {
  const files = getFiles(asset);
  const byUri = (pattern) => files.find((file) => pattern.test(String(file?.uri || file?.cdn_uri || '')));
  const spritesheet = byUri(/spritesheets?\/|spritesheets?|spritesheet/i);
  const background = byUri(/background/i);
  const preview =
    files.find((file) => String(file?.uri || '').includes('/main/')) ||
    (asset?.content?.links?.image ? { uri: asset.content.links.image, mime: 'image/*' } : null);
  return { spritesheet, background, preview };
}

async function downloadFile(file, destination) {
  const uri = file?.uri || file?.cdn_uri;
  if (!uri) throw new Error(`Missing file URI for ${destination}`);
  const response = await fetch(uri);
  if (!response.ok || !response.body) throw new Error(`Failed to download ${uri}: ${response.status}`);
  await pipeline(response.body, createWriteStream(destination));
}

async function importAsset(asset, args) {
  const metadata = getMetadata(asset);
  const nftNumber = getTrait(asset, 'NFT Number');
  const rarity = getTrait(asset, 'Rarity') || 'Unknown';
  const rawName = metadata.name || asset.content?.metadata?.name || asset.id;
  const displayName = String(rawName).trim();
  const baseName = displayName.replace(/\s+#\d+$/, '');
  const folderName = sanitizeSlug(`avtr-${baseName}-${nftNumber || String(asset.id).slice(0, 6)}`);
  const folder = path.join(args.output, folderName);
  const { spritesheet, background, preview } = selectAssetFiles(asset);

  if (!spritesheet) {
    return {
      assetId: asset.id,
      name: displayName,
      imported: false,
      skipped: 'no spritesheet file found in NFT metadata',
    };
  }

  const spriteExt = extFromUrl(spritesheet.uri || spritesheet.cdn_uri, mimeFallbackExt(spritesheet.mime, '.webp'));
  const bgExt = background ? extFromUrl(background.uri || background.cdn_uri, mimeFallbackExt(background.mime, '.png')) : '';
  const previewExt = preview ? extFromUrl(preview.uri || preview.cdn_uri, mimeFallbackExt(preview.mime, '.gif')) : '';
  const spritesheetPath = `spritesheet${spriteExt}`;
  const backgroundPath = background ? `background${bgExt}` : null;
  const previewPath = preview ? `preview${previewExt}` : null;

  if (args.dryRun) {
    return {
      assetId: asset.id,
      name: displayName,
      folder,
      imported: false,
      dryRun: true,
      spritesheet: spritesheet.uri || spritesheet.cdn_uri,
      background: background?.uri || background?.cdn_uri || null,
    };
  }

  const exists = await fs
    .stat(folder)
    .then(() => true)
    .catch(() => false);
  if (exists && !args.overwrite) {
    return { assetId: asset.id, name: displayName, folder, imported: false, skipped: 'folder already exists' };
  }

  await fs.mkdir(folder, { recursive: true });
  await downloadFile(spritesheet, path.join(folder, spritesheetPath));
  if (backgroundPath) await downloadFile(background, path.join(folder, backgroundPath));
  if (previewPath) await downloadFile(preview, path.join(folder, previewPath));

  const petJson = {
    id: folderName,
    displayName,
    description: metadata.description || `Imported AVTR pet NFT ${displayName}.`,
    spritesheetPath,
    rarity,
    collection: args.collection,
    assetId: asset.id,
    ownerWallet: args.wallet,
    metadataUri: asset.content?.json_uri || null,
  };
  if (backgroundPath) petJson.backgroundPath = backgroundPath;
  if (previewPath) petJson.previewPath = previewPath;

  await fs.writeFile(path.join(folder, 'pet.json'), `${JSON.stringify(petJson, null, 2)}\n`, 'utf8');

  return { assetId: asset.id, name: displayName, folder, imported: true };
}

async function main() {
  await loadDotEnv(path.join(process.cwd(), '.env.local'));
  const args = parseArgs(process.argv.slice(2));
  if (!args.wallet) throw new Error('Usage: import-avtr-pets --wallet <PUBLIC_WALLET>');
  args.output = path.resolve(String(args.output || DEFAULT_OUTPUT));

  const rpcUrl = getRpcUrl(args);
  const assets = await getAssetsByOwner(rpcUrl, args.wallet, args);
  const avtrAssets = assets.filter((asset) => isAvtrAsset(asset, args));
  const results = [];

  for (const asset of avtrAssets) {
    results.push(await importAsset(asset, args));
  }

  const imported = results.filter((result) => result.imported).length;
  const skipped = results.filter((result) => !result.imported).length;
  console.log(
    JSON.stringify(
      {
        ok: true,
        wallet: args.wallet,
        output: args.output,
        assetsSeen: assets.length,
        avtrAssets: avtrAssets.length,
        imported,
        skipped,
        results,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error?.message || error) }, null, 2));
  process.exit(1);
});
