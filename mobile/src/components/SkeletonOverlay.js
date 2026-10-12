/**
 * mobile/src/components/SkeletonOverlay.js
 * High-performance 2D skeleton overlay for BlazePose lower-limb landmarks.
 * Renders keypoint nodes and connecting bones using standard styled Views.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';

const BONE_CONNECTIONS = [
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['left_ankle', 'left_heel'],
  ['left_ankle', 'left_foot_index'],
  ['left_heel', 'left_foot_index'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
  ['right_ankle', 'right_heel'],
  ['right_ankle', 'right_foot_index'],
  ['right_heel', 'right_foot_index'],
  ['left_hip', 'right_hip'],
];

function Bone({ from, to, color = '#4CAF50' }) {
  if (!from || !to) return null;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const angleRad = Math.atan2(dy, dx);
  const angleDeg = (angleRad * 180) / Math.PI;

  return (
    <View
      style={{
        position: 'absolute',
        left: from.x,
        top: from.y - 1.5,
        width: length,
        height: 3,
        backgroundColor: color,
        opacity: 0.75,
        transformOrigin: 'left center',
        transform: [{ rotate: `${angleDeg}deg` }],
        borderRadius: 2,
      }}
    />
  );
}

export default function SkeletonOverlay({
  landmarks,
  width,
  height,
  color = '#4CAF50',
  isMirrored = false,
}) {
  if (!landmarks || !width || !height) return null;

  // Transform normalized [0, 1] coordinates to screen pixels
  const screenPts = {};
  for (const [name, pt] of Object.entries(landmarks)) {
    if (pt && typeof pt.x === 'number' && typeof pt.y === 'number') {
      const pxX = (isMirrored ? 1.0 - pt.x : pt.x) * width;
      const pxY = pt.y * height;
      screenPts[name] = { x: pxX, y: pxY, visibility: pt.visibility ?? 1.0 };
    }
  }

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Bones */}
      {BONE_CONNECTIONS.map(([j1, j2], i) => {
        const pt1 = screenPts[j1];
        const pt2 = screenPts[j2];
        if (pt1 && pt2 && (pt1.visibility > 0.4 || pt2.visibility > 0.4)) {
          return <Bone key={`bone-${i}`} from={pt1} to={pt2} color={color} />;
        }
        return null;
      })}

      {/* Joint Nodes */}
      {Object.entries(screenPts).map(([name, pt]) => {
        if (!pt || pt.visibility < 0.4) return null;
        const isAnkle = name.includes('ankle') || name.includes('heel');
        const size = isAnkle ? 14 : 10;
        return (
          <View
            key={`node-${name}`}
            style={[
              styles.node,
              {
                left: pt.x - size / 2,
                top: pt.y - size / 2,
                width: size,
                height: size,
                borderRadius: size / 2,
                borderColor: '#FFFFFF',
                backgroundColor: isAnkle ? '#F5C842' : color,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  node: {
    position: 'absolute',
    borderWidth: 2,
    opacity: 0.95,
  },
});
