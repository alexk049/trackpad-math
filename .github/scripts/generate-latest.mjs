
import fs from 'node:fs';

const token = process.env.GITHUB_TOKEN;
const tag = process.argv[2];
if (!process.env.GITHUB_REPOSITORY) {
    console.error("GITHUB_REPOSITORY env var not set");
    process.exit(1);
}
const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

console.log(`Processing release ${tag} for ${owner}/${repo}`);

async function api(path, options = {}) {
    const url = `https://api.github.com/repos/${owner}/${repo}${path}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            ...options.headers,
        },
    });
    if (!response.ok && response.status !== 404) { // Allow 404 for asset check
        // For DELETE, 204 is ok but fetch won't throw. For others check ok.
        throw new Error(`API Error ${response.status} ${path}: ${await response.text()}`);
    }
    if (response.status === 204) return null;
    return response.json();
}

async function run() {
    // 1. Get Release
    const release = await api(`/releases/tags/${tag}`);
    console.log(`Found release ${release.id}`);

    // 2. Find assets
    const assets = release.assets;
    console.log(`Found ${assets.length} assets`);

    const platforms = {};

    for (const asset of assets) {
        if (asset.name.endsWith('.sig')) {
            const baseName = asset.name.slice(0, -4); // remove .sig
            const binaryAsset = assets.find(a => a.name === baseName);

            if (binaryAsset) {
                // Fetch signature content
                const sigResponse = await fetch(asset.browser_download_url);
                const signature = await sigResponse.text();

                // Determine platform
                let platformKey = null;
                if (asset.name.includes('setup.exe') || asset.name.endsWith('.msi.zip.sig') || asset.name.endsWith('.nsis.zip.sig')) {
                    platformKey = 'windows-x86_64';
                } else if (asset.name.endsWith('.AppImage.tar.gz.sig')) {
                    platformKey = 'linux-x86_64';
                } else if (asset.name.includes('aarch64') && asset.name.includes('darwin')) {
                    platformKey = 'darwin-aarch64';
                } else if (asset.name.includes('x64') && asset.name.includes('darwin')) {
                    platformKey = 'darwin-x86_64';
                }

                if (platformKey) {
                    platforms[platformKey] = {
                        signature: signature.trim(),
                        url: binaryAsset.browser_download_url
                    };
                    console.log(`Added platform ${platformKey}`);
                }
            }
        }
    }

    const payload = {
        version: tag,
        notes: release.body,
        pub_date: release.published_at,
        platforms
    };

    console.log('Generated JSON:', JSON.stringify(payload, null, 2));

    // 3. Upload latest.json
    // First check if it exists and delete it
    const existingJson = assets.find(a => a.name === 'latest.json');
    if (existingJson) {
        console.log('Deleting existing latest.json');
        await api(`/releases/assets/${existingJson.id}`, { method: 'DELETE' });
    }

    console.log('Uploading latest.json');
    const uploadUrl = release.upload_url.replace('{?name,label}', '?name=latest.json');

    const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': JSON.stringify(payload).length
        },
        body: JSON.stringify(payload)
    });

    if (!uploadRes.ok) {
        throw new Error(`Upload Failed: ${await uploadRes.text()}`);
    }
    console.log('Upload complete');
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
