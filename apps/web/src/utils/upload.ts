export async function uploadToPresignedUrl(presignedUrl: string, blob: Blob, contentType = 'application/octet-stream') {
  try {
    const res = await fetch(presignedUrl, {
      method: 'PUT',
      body: blob,
      headers: {
        'Content-Type': contentType,
      },
    });
    return res.ok;
  } catch (e) {
    console.warn('Upload failed', e);
    return false;
  }
}

export default uploadToPresignedUrl;

export async function createPresignedUrl(filename: string, contentType = 'application/octet-stream') {
  try {
    const res = await fetch('http://localhost:3000/presigned', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filename, contentType }),
    });

    if (!res.ok) {
      console.warn('Failed to get presigned url, status:', res.status);
      return null;
    }

    const data = await res.json();
    const url = data?.url ?? data?.presignedUrl ?? null;
    if (!url || typeof url !== 'string') {
      console.warn('Presigned url missing or invalid in response', data);
      return null;
    }
    return url;
  } catch (e) {
    console.warn('Error requesting presigned url', e);
    return null;
  }
}
