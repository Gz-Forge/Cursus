import React, { useState, useEffect } from 'react';
import { View, Image } from 'react-native';

interface Props {
  uri: string;
  width: number;
  height: number;
}

export default function TiledBackground({ uri, width, height }: Props) {
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!uri) return;
    Image.getSize(uri, (w, h) => setImgSize({ w, h }), () => setImgSize(null));
  }, [uri]);

  if (!imgSize || imgSize.w <= 0 || imgSize.h <= 0 || width <= 0 || height <= 0) return null;

  const cols = Math.ceil(width / imgSize.w);
  const rows = Math.ceil(height / imgSize.h);
  const tiles: React.ReactElement[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push(
        <Image
          key={`${r}-${c}`}
          source={{ uri }}
          style={{
            position: 'absolute',
            top: r * imgSize.h,
            left: c * imgSize.w,
            width: imgSize.w,
            height: imgSize.h,
          }}
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
