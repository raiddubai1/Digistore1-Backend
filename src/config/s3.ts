import AWS from 'aws-sdk';

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-west-1',
  signatureVersion: 'v4',
});

export const S3_BUCKET = process.env.AWS_S3_BUCKET || 'digistore1-downloads';

// Generate a signed URL for uploading
export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const params = {
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
    Expires: expiresIn,
  };
  return s3.getSignedUrlPromise('putObject', params);
}

// Generate a signed URL for downloading
export async function getSignedDownloadUrl(
  key: string,
  fileName: string,
  expiresIn: number = 3600
): Promise<string> {
  const params = {
    Bucket: S3_BUCKET,
    Key: key,
    Expires: expiresIn,
    ResponseContentDisposition: `attachment; filename="${fileName}"`,
  };
  return s3.getSignedUrlPromise('getObject', params);
}

// Upload a file buffer to S3
export async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<{ url: string; key: string }> {
  const params = {
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  };

  await s3.upload(params).promise();
  
  // Return the S3 URL (not signed - we'll sign when needed for download)
  return {
    url: `https://${S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-west-1'}.amazonaws.com/${key}`,
    key: key,
  };
}

// Upload from URL (for migration)
export async function uploadFromUrlToS3(
  sourceUrl: string,
  key: string
): Promise<{ url: string; key: string }> {
  const axios = require('axios');
  
  // Download the file from source URL
  const response = await axios.get(sourceUrl, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(response.data);
  
  // Determine content type
  const contentType = response.headers['content-type'] || 'application/octet-stream';
  
  return uploadToS3(buffer, key, contentType);
}

// Delete a file from S3
export async function deleteFromS3(key: string): Promise<void> {
  const params = {
    Bucket: S3_BUCKET,
    Key: key,
  };
  await s3.deleteObject(params).promise();
}

// Check if a file exists in S3
export async function fileExistsInS3(key: string): Promise<boolean> {
  try {
    await s3.headObject({ Bucket: S3_BUCKET, Key: key }).promise();
    return true;
  } catch (error) {
    return false;
  }
}

// Extract S3 key from S3 URL
export function getS3KeyFromUrl(url: string): string | null {
  if (!url || !url.includes('s3.') || !url.includes('amazonaws.com')) {
    return null;
  }
  
  try {
    const urlObj = new URL(url);
    // URL format: https://bucket.s3.region.amazonaws.com/key
    return urlObj.pathname.substring(1); // Remove leading /
  } catch {
    return null;
  }
}

export default s3;

