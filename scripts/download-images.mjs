/**
 * Download all product images from Supabase Storage to /public/images/products/
 * Then update the database to use local paths instead of Supabase URLs.
 *
 * Usage: node scripts/download-images.mjs
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import dns from 'dns';

// DNS override for Jio NAT64
const originalLookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (hostname.includes('supabase.co')) {
    if (options && options.all) {
      return callback(null, [{ address: '104.18.38.10', family: 4 }]);
    }
    return callback(null, '104.18.38.10', 4);
  }
  return originalLookup(hostname, options, callback);
};

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images', 'products');

// All products with their image URLs from the database
const products = [
  { id: "85993f86-3527-49f4-8521-d926f9fceec6", slug: "kashmiri-almonds", images: ["https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/85993f86-3527-49f4-8521-d926f9fceec6-1768884270454.webp"] },
  { id: "1bd1e287-d9b9-4e5b-b69c-f0ed3064cda5", slug: "kashmiri-dried-morel-mushrooms", images: ["https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/1bd1e287-d9b9-4e5b-b69c-f0ed3064cda5-1768884354321.webp","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/1bd1e287-d9b9-4e5b-b69c-f0ed3064cda5-1769250233973.jpeg","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/1bd1e287-d9b9-4e5b-b69c-f0ed3064cda5-1769250726819.jpg"] },
  { id: "2b1148fc-1d84-49dc-b5c2-7aa2d426db6c", slug: "kashmiri-garlic", images: ["https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/2b1148fc-1d84-49dc-b5c2-7aa2d426db6c-1768884154059.webp"] },
  { id: "311fb25c-3a1b-44ab-9fa0-a7f6e5af3f07", slug: "kashmiri-kahwa-saffron-combo", images: ["https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/311fb25c-3a1b-44ab-9fa0-a7f6e5af3f07-1770040424969.png"] },
  { id: "b203f543-4ce0-4a6e-a5f9-f20a88689b60", slug: "kashmiri-kahwa-tea", images: ["https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/b203f543-4ce0-4a6e-a5f9-f20a88689b60-1768966849796.JPG","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/b203f543-4ce0-4a6e-a5f9-f20a88689b60-1768966850997.jpg","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/b203f543-4ce0-4a6e-a5f9-f20a88689b60-1768966852455.jpg","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/b203f543-4ce0-4a6e-a5f9-f20a88689b60-1768966853674.jpg","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/b203f543-4ce0-4a6e-a5f9-f20a88689b60-1768966854852.jpg","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/b203f543-4ce0-4a6e-a5f9-f20a88689b60-1768966856381.JPG","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/b203f543-4ce0-4a6e-a5f9-f20a88689b60-1768966857855.jpg"] },
  { id: "0bd02bd3-44fb-4f4d-a7a5-ac0bb0eca252", slug: "kashmiri-kismish", images: ["https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/0bd02bd3-44fb-4f4d-a7a5-ac0bb0eca252-1768884757337.webp"] },
  { id: "43a9909d-1c1c-414b-8f6a-cefeaecb9166", slug: "kashmiri-saffron", images: ["https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/43a9909d-1c1c-414b-8f6a-cefeaecb9166-1769251030031.png","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/43a9909d-1c1c-414b-8f6a-cefeaecb9166-1769251032638.png","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/43a9909d-1c1c-414b-8f6a-cefeaecb9166-1769251033665.png"] },
  { id: "a03175d8-4243-4421-98e1-03308ca7b2f5", slug: "kashmiri-saffron-kahwa-combo", images: ["https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/a03175d8-4243-4421-98e1-03308ca7b2f5-1770184785413.jpeg"] },
  { id: "33836c43-e3e6-4ebc-be7f-f5d0208ea024", slug: "kashmiri-red-chilli-powder", images: ["https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/33836c43-e3e6-4ebc-be7f-f5d0208ea024-1769010701808.jpeg","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/33836c43-e3e6-4ebc-be7f-f5d0208ea024-1769010704511.jpeg","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/33836c43-e3e6-4ebc-be7f-f5d0208ea024-1769010705798.jpeg","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/33836c43-e3e6-4ebc-be7f-f5d0208ea024-1769010708056.jpeg","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/33836c43-e3e6-4ebc-be7f-f5d0208ea024-1769010708898.jpeg","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/33836c43-e3e6-4ebc-be7f-f5d0208ea024-1769010805808.jpeg"] },
  { id: "d1136686-1f0c-4af0-834e-b64648a94194", slug: "kashmiri-saffron-honey-kahwa-combo", images: ["https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/d1136686-1f0c-4af0-834e-b64648a94194-1770184657360.jpeg"] },
  { id: "5c1c4737-fde5-4cf6-b4a0-d7751ecfd1de", slug: "kashmiri-walnuts", images: ["https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/5c1c4737-fde5-4cf6-b4a0-d7751ecfd1de-1768884649864.webp"] },
  { id: "44e5bfb3-c596-4679-9f81-9f3ba3ae1dd2", slug: "original-kashmiri-mamra-almonds", images: ["https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/44e5bfb3-c596-4679-9f81-9f3ba3ae1dd2-1769098949094.webp"] },
  { id: "3fa19b34-4a02-40eb-84ba-1229e4307d02", slug: "pure-himalayan-shilajit", images: ["https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/3fa19b34-4a02-40eb-84ba-1229e4307d02-1768966539943.webp","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/3fa19b34-4a02-40eb-84ba-1229e4307d02-1768966541285.webp","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/3fa19b34-4a02-40eb-84ba-1229e4307d02-1768966542349.webp","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/3fa19b34-4a02-40eb-84ba-1229e4307d02-1768966543420.webp","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/3fa19b34-4a02-40eb-84ba-1229e4307d02-1768966544427.webp","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/3fa19b34-4a02-40eb-84ba-1229e4307d02-1768966545257.webp","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/3fa19b34-4a02-40eb-84ba-1229e4307d02-1768966612312.webp"] },
  { id: "f1561b63-8a8c-4980-b42c-0b027b243c19", slug: "pure-kashmiri-honey", images: ["https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/f1561b63-8a8c-4980-b42c-0b027b243c19-1768967444760.jpg","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/f1561b63-8a8c-4980-b42c-0b027b243c19-1768967449438.jpg","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/f1561b63-8a8c-4980-b42c-0b027b243c19-1768967451122.jpg","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/f1561b63-8a8c-4980-b42c-0b027b243c19-1768967452494.jpg","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/f1561b63-8a8c-4980-b42c-0b027b243c19-1768967453969.jpg","https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/f1561b63-8a8c-4980-b42c-0b027b243c19-1768967455663.jpg"] },
  { id: "3cf99a9e-273a-47a3-8f55-0e7804a53f3c", slug: "pure-kashmiri-apricot", images: ["https://ijchxbtovluwlrdbwrqb.supabase.co/storage/v1/object/public/product-images/products/3cf99a9e-273a-47a3-8f55-0e7804a53f3c-1768884952410.webp"] },
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { timeout: 30000 }, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const updateMap = []; // { id, newImages }

  for (const product of products) {
    const productDir = path.join(OUTPUT_DIR, product.slug);
    fs.mkdirSync(productDir, { recursive: true });

    const newImages = [];

    for (let i = 0; i < product.images.length; i++) {
      const url = product.images[i];
      const ext = path.extname(new URL(url).pathname) || '.jpg';
      const filename = `${i + 1}${ext}`;
      const localPath = path.join(productDir, filename);
      const publicPath = `/images/products/${product.slug}/${filename}`;

      console.log(`Downloading: ${product.slug}/${filename}...`);
      try {
        await downloadFile(url, localPath);
        console.log(`  ✓ Saved to ${publicPath}`);
        newImages.push(publicPath);
      } catch (err) {
        console.error(`  ✗ Failed: ${err.message}`);
        // Keep original URL as fallback
        newImages.push(url);
      }
    }

    updateMap.push({ id: product.id, slug: product.slug, newImages });
  }

  // Generate SQL UPDATE statements
  console.log('\n\n=== SQL to update product images ===\n');
  for (const { id, slug, newImages } of updateMap) {
    const imagesArray = `ARRAY[${newImages.map(i => `'${i}'`).join(',')}]::text[]`;
    console.log(`UPDATE products SET images = ${imagesArray} WHERE id = '${id}';`);
  }

  console.log('\n✅ Done! Run the SQL above in Supabase to update image paths.');
  console.log('Then commit the downloaded images and push to deploy.');
}

main().catch(console.error);
