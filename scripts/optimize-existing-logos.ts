/**
 * Optimize existing tool logos in Supabase storage
 *
 * Usage: npx tsx scripts/optimize-existing-logos.ts
 *
 * This script will:
 * 1. List all images in tool-logos bucket
 * 2. Download and optimize each image (100x100 WebP)
 * 3. Upload optimized version
 * 4. Update database references
 * 5. Delete old files
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

// Load environment variables from .env.local
config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const BUCKET_NAME = "tool-logos";
const OUTPUT_SIZE = 100;
const OUTPUT_QUALITY = 80;

// Skip these extensions (can't be optimized with Sharp)
const SKIP_EXTENSIONS = [".svg", ".webp"];

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log("🔍 Listing files in bucket...");

  // List all files in the bucket
  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET_NAME)
    .list("", { limit: 1000 });

  if (listError) {
    console.error("Failed to list files:", listError);
    process.exit(1);
  }

  // Also check user/ folder
  const { data: userFiles } = await supabase.storage
    .from(BUCKET_NAME)
    .list("user", { limit: 1000 });

  const allFiles = [
    ...(files || []).map((f) => f.name),
    ...(userFiles || []).map((f) => `user/${f.name}`),
  ];

  console.log(`📁 Found ${allFiles.length} files`);

  let optimized = 0;
  let skipped = 0;
  let failed = 0;
  let totalSavedBytes = 0;

  for (const fileName of allFiles) {
    // Skip directories and already optimized files
    if (!fileName || fileName.endsWith("/")) {
      continue;
    }

    const ext = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();

    if (SKIP_EXTENSIONS.includes(ext)) {
      console.log(`⏭️  Skipping ${fileName} (${ext})`);
      skipped++;
      continue;
    }

    try {
      console.log(`\n📥 Processing: ${fileName}`);

      // Download the file
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(BUCKET_NAME)
        .download(fileName);

      if (downloadError || !fileData) {
        console.error(`  ❌ Download failed:`, downloadError);
        failed++;
        continue;
      }

      const originalSize = fileData.size;
      const arrayBuffer = await fileData.arrayBuffer();
      const inputBuffer = Buffer.from(arrayBuffer);

      // Optimize with Sharp
      const optimizedBuffer = await sharp(inputBuffer)
        .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
          fit: "cover",
          position: "center",
        })
        .webp({ quality: OUTPUT_QUALITY })
        .toBuffer();

      const newSize = optimizedBuffer.length;
      const savedBytes = originalSize - newSize;
      const savedPercent = ((savedBytes / originalSize) * 100).toFixed(1);

      // Generate new filename with .webp extension
      const baseName = fileName.substring(0, fileName.lastIndexOf("."));
      const newFileName = `${baseName}.webp`;

      // Upload optimized file
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(newFileName, optimizedBuffer, {
          contentType: "image/webp",
          upsert: true,
        });

      if (uploadError) {
        console.error(`  ❌ Upload failed:`, uploadError);
        failed++;
        continue;
      }

      // Get new public URL
      const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(newFileName);
      const newUrl = urlData.publicUrl;

      // Get old public URL to find and update database records
      const { data: oldUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
      const oldUrl = oldUrlData.publicUrl;

      // Update database references
      const { data: updateResult, error: updateError } = await supabase
        .from("tools")
        .update({ logo_url: newUrl })
        .eq("logo_url", oldUrl)
        .select("id, name");

      if (updateError) {
        console.error(`  ⚠️  DB update failed:`, updateError);
      } else if (updateResult && updateResult.length > 0) {
        console.log(
          `  📝 Updated ${updateResult.length} tool(s): ${updateResult.map((t) => t.name).join(", ")}`
        );
      }

      // Delete old file (only if different from new)
      if (fileName !== newFileName) {
        const { error: deleteError } = await supabase.storage.from(BUCKET_NAME).remove([fileName]);
        if (deleteError) {
          console.error(`  ⚠️  Delete old file failed:`, deleteError);
        }
      }

      console.log(
        `  ✅ ${(originalSize / 1024).toFixed(1)}KB → ${(newSize / 1024).toFixed(1)}KB (-${savedPercent}%)`
      );

      optimized++;
      totalSavedBytes += savedBytes;
    } catch (err) {
      console.error(`  ❌ Error processing ${fileName}:`, err);
      failed++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary:");
  console.log(`  ✅ Optimized: ${optimized}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  💾 Total saved: ${(totalSavedBytes / 1024 / 1024).toFixed(2)}MB`);
}

main().catch(console.error);
