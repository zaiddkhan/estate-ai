import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { v4 as uuidv4 } from 'uuid';

// AWS S3 configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

/**
 * Upload an image to AWS S3
 * @param {Buffer} buffer - Image buffer
 * @param {string} key - S3 object key (path)
 * @returns {Promise<string>} S3 URL of the uploaded image
 */
export const uploadImageToS3 = async (buffer, key) => {
  try {
    if (!BUCKET_NAME) {
      throw new Error('S3_BUCKET_NAME environment variable is not set');
    }

    // Ensure the key is unique to avoid overwrites
    const uniqueKey = key.includes('/')
      ? `${key.substring(0, key.lastIndexOf('/'))}/img-${uuidv4()}${key.substring(key.lastIndexOf('/'))}`
      : `img-${uuidv4()}-${key}`;

    // Set up the upload parameters
    const params = {
      Bucket: BUCKET_NAME,
      Key: uniqueKey,
      Body: buffer,
      ContentType: 'image/jpeg'
    };

    // Use multipart upload for reliability
    const upload = new Upload({
      client: s3Client,
      params
    });

    // Implement progress tracking (optional)
    upload.on('httpUploadProgress', (progress) => {
      console.log(`Upload progress for ${uniqueKey}: ${progress.loaded}/${progress.total} bytes`);
    });

    // Execute the upload
    const result = await upload.done();

    // Generate the S3 URL
    const s3Url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${uniqueKey}`;
    console.log(`Successfully uploaded image to ${s3Url}`);

    return s3Url;
  } catch (error) {
    console.error('Error uploading image to S3:', error);
    throw error;
  }
};

/**
 * Upload multiple images to AWS S3
 * @param {Array<{buffer: Buffer, key: string}>} images - Array of image objects with buffer and key
 * @returns {Promise<Array<string>>} Array of S3 URLs
 */
export const uploadMultipleImagesToS3 = async (images) => {
  try {
    // Process images in batches to avoid overwhelming S3
    const BATCH_SIZE = 5;
    const s3Urls = [];

    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      const batch = images.slice(i, i + BATCH_SIZE);

      // Upload each image in the batch concurrently
      const uploadPromises = batch.map(image => uploadImageToS3(image.buffer, image.key));

      // Wait for all uploads in this batch to complete
      const batchResults = await Promise.all(uploadPromises);
      s3Urls.push(...batchResults);

      // Add a small delay between batches
      if (i + BATCH_SIZE < images.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return s3Urls;
  } catch (error) {
    console.error('Error uploading multiple images to S3:', error);
    throw error;
  }
};

/**
 * Check if an object exists in S3
 * @param {string} key - S3 object key
 * @returns {Promise<boolean>} Whether the object exists
 */
export const checkS3ObjectExists = async (key) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key
    };

    // Use HeadObject to check if the object exists
    const command = new HeadObjectCommand(params);
    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
};

/**
 * Generate a pre-signed URL for direct uploads
 * @param {string} key - S3 object key
 * @param {number} expirationSeconds - URL expiration time in seconds
 * @returns {Promise<string>} Pre-signed URL
 */
export const generatePresignedUrl = async (key, expirationSeconds = 3600) => {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: expirationSeconds });
    return signedUrl;
  } catch (error) {
    console.error('Error generating pre-signed URL:', error);
    throw error;
  }
};
