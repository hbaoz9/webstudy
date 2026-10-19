function loadImage(
  imageUrl: string,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();

    image.onload = () => resolve(image);

    image.onerror = () =>
      reject(
        new Error('Không thể đọc ảnh.'),
      );

    image.src = imageUrl;
  });
}

export async function compressCoverImage(
  file: File,
  limits: { maxWidth: number; maxHeight: number; maxDataLength?: number } = { maxWidth: 1280, maxHeight: 720 },
) {
  const objectUrl =
    URL.createObjectURL(file);

  try {
    const image =
      await loadImage(objectUrl);

    const { maxWidth, maxHeight } = limits;

    const scale = Math.min(
      1,
      maxWidth / image.naturalWidth,
      maxHeight / image.naturalHeight,
    );

    const width = Math.round(
      image.naturalWidth * scale,
    );

    const height = Math.round(
      image.naturalHeight * scale,
    );

    const canvas =
      document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    const context =
      canvas.getContext('2d');

    if (!context) {
      throw new Error(
        'Trình duyệt không hỗ trợ xử lý ảnh.',
      );
    }

    context.drawImage(
      image,
      0,
      0,
      width,
      height,
    );

    const qualityLevels = [
      0.8,
      0.68,
      0.56,
      0.46,
    ];

    let compressedImage = '';

    for (const quality of qualityLevels) {
      compressedImage =
        canvas.toDataURL(
          'image/webp',
          quality,
        );

      if (
        compressedImage.length <=
        (limits.maxDataLength ?? 600_000)
      ) {
        break;
      }
    }

    return compressedImage;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
