import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;

/**
 * Upload a base64-encoded image to Cloudinary.
 * @param base64Data  The base64 string (with or without the data:image/... prefix)
 * @param folder      The folder inside Cloudinary (e.g. "alfajer/products")
 * @param publicId    Optional public ID for the asset
 * @returns           The secure URL of the uploaded image, or null on error
 */
export async function uploadImage(
  base64Data: string,
  folder: string = "alfajer/products",
  publicId?: string
): Promise<string | null> {
  try {
    const result = await cloudinary.uploader.upload(base64Data, {
      folder,
      public_id: publicId,
      overwrite: true,
      resource_type: "auto",
      transformation: [
        { quality: "auto", fetch_format: "auto" }, // Auto-optimize
      ],
    });
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return null;
  }
}

/**
 * Delete an image from Cloudinary by its public ID.
 */
export async function deleteImage(publicId: string): Promise<boolean> {
  try {
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    return false;
  }
}
