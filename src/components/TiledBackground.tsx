import React, { useState, useEffect } from 'react';
import { View, Image, PixelRatio, Platform } from 'react-native';

interface Props {
  uri: string;
  width: number;
  height: number;
}

export default function TiledBackground({ uri, width, height }: Props) {
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!uri) return;
    Image.getSize(
      uri,
      (w, h) => {
        // Image.getSize returns physical pixels on native; convert to dp
        const ratio = Platform.OS === 'web' ? 1 : PixelRatio.get();
        setImgSize({ w: w / ratio, h: h / ratio });
      },
      () => setImgSize(null),
    );
  }, [uri]);

  if (!imgSize || imgSize.w <= 0 || imgSize.h <= 0 || width <= 0 || height <= 0) return null;

  // Only scale DOWN when the image is larger than the container (fixes zoom+clipping).
  // Never scale UP: small pattern images tile at natural size to avoid pixelation.
  const scale = imgSize.w > width ? width / imgSize.w : 1;
  const tileW = imgSize.w * scale;
  const tileH = imgSize.h * scale;
  const cols = Math.ceil(width / tileW);
  const rows = Math.ceil(height / tileH);
  const tiles: React.ReactElement[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push(
        <Image
          key={`${r}-${c}`}
          source={{ uri }}
          style={{
            position: 'absolute',
            top: r * tileH,
            left: c * tileW,
            width: tileW,
            height: tileH,
          }}
          resizeMode="stretch"
        />,
      );
    }
  }

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, width, height, overflow: 'hidden' }}>
      {tiles}
    </View>
  );
}
