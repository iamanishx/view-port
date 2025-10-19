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

export async function createPresignedUrl(fileName: string, group_id:string, user_id: string, fileType = 'application/octet-stream') {
  try {
    const res = await fetch('http://localhost:3000/presigned', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName, fileType, group_id, user_id }),
    });

    if (!res.ok) {
      console.warn('Failed to get presigned url, status:', res.status);
      return null;
    }

    const data = await res.json();
    // Support multiple shapes from backend: { url }, { presignedUrl }, { uploadUrl }
    const uploadUrl = data?.url ?? data?.presignedUrl ?? data?.uploadUrl ?? null;
    const publicUrl = data?.publicUrl ?? data?.objectUrl ?? data?.public_url ?? null;
    if (!uploadUrl || typeof uploadUrl !== 'string') {
      console.warn('Presigned url missing or invalid in response', data);
      return null;
    }
    return { uploadUrl, publicUrl };
  } catch (e) {
    console.warn('Error requesting presigned url', e);
    return null;
  }
}

export async function getPublicUrl(user_id: string, group_id: string) {
  try {
    const res = await fetch(`http://localhost:3000/${user_id}/${group_id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      console.warn('Failed to get public url, status:', res.status);
      return null;
    }

    const data = await res.json();
    return data?.publicUrl ?? null;
  } catch (e) {
    console.warn('Error requesting public url', e);
    return null;
  }
}
