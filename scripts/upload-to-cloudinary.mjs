/**
 * Upload all existing product images from /public/images/products/ to Cloudinary
 * and generate SQL to update the database with Cloudinary URLs.
 *
 * Usage: node scripts/upload-to-cloudinary.mjs
 */

import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'dzm80h8bw',
  api_key: '159355733423633',
  api_secret: '6z0JNg4q-rcWOkSA43OOEMZDXxs',
});

const IMAGES_DIR = path.join(process.cwd(), 'public', 'images', 'products');

// Product slug to product ID mapping
const productMap = {
  "kashmiri-almonds": "85993f86-3527-49f4-8521-d926f9fceec6",
  "kashmiri-dried-morel-mushrooms": "1bd1e287-d9b9-4e5b-b69c-f0ed3064cda5",
  "kashmiri-garlic": "2b1148fc-1d84-49dc-b5c2-7aa2d426db6c",
  "kashmiri-kahwa-saffron-combo": "311fb25c-3a1b-44ab-9fa0-a7f6e5af3f07",
  "kashmiri-kahwa-tea": "b203f543-4ce0-4a6e-a5f9-f20a88689b60",
  "kashmiri-kismish": "0bd02bd3-44fb-4f4d-a7a5-ac0bb0eca252",
  "kashmiri-saffron": "43a9909d-1c1c-414b-8f6a-cefeaecb9166",
  "kashmiri-saffron-kahwa-combo": "a03175d8-4243-4421-98e1-03308ca7b2f5",
  "kashmiri-red-chilli-powder": "33836c43-e3e6-4ebc-be7f-f5d0208ea024",
  "kashmiri-saffron-honey-kahwa-combo": "d1136686-1f0c-4af0-834e-b64648a94194",
  "kashmiri-walnuts": "5c1c4737-fde5-4cf6-b4a0-d7751ecfd1de",
  "original-kashmiri-mamra-almonds": "44e5bfb3-c596-4679-9f81-9f3ba3ae1dd2",
  "pure-himalayan-shilajit": "3fa19b34-4a02-40eb-84ba-1229e4307d02",
  "pure-kashmiri-honey": "f1561b63-8a8c-4980-b42c-0b027b243c19",
  "pure-kashmiri-apricot": "3cf99a9e-273a-47a3-8f55-0e7804a53f3c",
};

async function uploadFile(filePath, folder, publicId) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(filePath, {
      folder,
      public_id: publicId,
      overwrite: true,
      resource_type: "auto",
    }, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

async function main() {
  const updateMap = {}; // productId -> [cloudinaryUrl, ...]

  // Read all product folders
  const slugs = fs.readdirSync(IMAGES_DIR).filter(f => {
    const fullPath = path.join(IMAGES_DIR, f);
    return fs.statSync(fullPath).isDirectory() && productMap[f];
  });

  console.log(`Found ${slugs.length} product folders to upload.\n`);

  for (const slug of slugs) {
    const productId = productMap[slug];
    const productDir = path.join(IMAGES_DIR, slug);
    const files = fs.readdirSync(productDir)
      .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
      .sort();

    if (files.length === 0) continue;

    updateMap[productId] = [];

    for (const file of files) {
      const filePath = path.join(productDir, file);
      const publicId = `${slug}-${path.parse(file).name}`;

      console.log(`Uploading: ${slug}/${file}...`);
      try {
        const result = await uploadFile(filePath, 'alfajer/products', publicId);
        console.log(`  ✓ ${result.secure_url}`);
        updateMap[productId].push(result.secure_url);
      } catch (err) {
        console.error(`  ✗ Failed: ${err.message}`);
      }
    }
  }

  // Generate SQL
  console.log('\n\n=== SQL to update product images to Cloudinary URLs ===\n');
  const sqlStatements = [];
  for (const [productId, urls] of Object.entries(updateMap)) {
    if (urls.length === 0) continue;
    const imagesArray = `ARRAY[${urls.map(u => `'${u}'`).join(',')}]::text[]`;
    const sql = `UPDATE products SET images = ${imagesArray} WHERE id = '${productId}';`;
    sqlStatements.push(sql);
    console.log(sql);
  }

  // Write SQL to a file for easy copy-paste
  const sqlFile = path.join(process.cwd(), 'scripts', 'update-images-cloudinary.sql');
  fs.writeFileSync(sqlFile, sqlStatements.join('\n') + '\n');
  console.log(`\n✅ Done! SQL saved to ${sqlFile}`);
  console.log(`Total images uploaded: ${Object.values(updateMap).flat().length}`);
}

main().catch(console.error);
