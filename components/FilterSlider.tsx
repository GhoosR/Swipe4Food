import React, { useRef, useEffect, useState } from 'react';
import { View, Animated, StyleSheet, Dimensions, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedAnimated, { 
  useSharedValue, 
  useAnimatedStyle, 
  runOnJS,
  interpolate,
  clamp
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

interface FilterSliderProps {
  value: number;
  onValueChange: (value: number) => void;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  trackColor?: string;
  thumbColor?: string;
}

const SLIDER_WIDTH = Dimensions.get('window').width - 80;
const THUMB_SIZE = 28;

export default function FilterSlider({
  value,
  onValueChange,
  minimumValue,
  maximumValue,
  step = 1,
  trackColor = '#E5E7EB',
  thumbColor = '#f29056',
}: FilterSliderProps) {
  const translateX = useSharedValue(0);
  const [sliderWidth, setSliderWidth] = useState(SLIDER_WIDTH);

  // Calculate thumb position based on value
  useEffect(() => {
    const ratio = (value - minimumValue) / (maximumValue - minimumValue);
    translateX.value = ratio * (sliderWidth - THUMB_SIZE);
  }, [value, minimumValue, maximumValue, sliderWidth]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      const newX = clamp(
        translateX.value + event.translationX,
        0,
        sliderWidth - THUMB_SIZE
      );
      translateX.value = newX;
      
      // Calculate new value
      const ratio = newX / (sliderWidth - THUMB_SIZE);
      const newValue = Math.round(
        (minimumValue + ratio * (maximumValue - minimumValue)) / step
      ) * step;
      
      // Update value on JS thread
      runOnJS(onValueChange)(newValue);
    });

  const thumbStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  const activeTrackStyle = useAnimatedStyle(() => {
    return {
      width: translateX.value + THUMB_SIZE / 2,
    };
  });

  // Fallback for web platform
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webSliderContainer}>
        <input
          type="range"
          min={minimumValue}
          max={maximumValue}
          step={step}
          value={value}
          onChange={(e) => onValueChange(parseInt(e.target.value))}
          style={{
            width: '100%',
            height: 6,
            borderRadius: 3,
            background: `linear-gradient(to right, ${thumbColor} 0%, ${thumbColor} ${((value - minimumValue) / (maximumValue - minimumValue)) * 100}%, ${trackColor} ${((value - minimumValue) / (maximumValue - minimumValue)) * 100}%, ${trackColor} 100%)`,
            outline: 'none',
            appearance: 'none',
            cursor: 'pointer',
          }}
        />
        <style>{`
          input[type="range"]::-webkit-slider-thumb {
            appearance: none;
            width: ${THUMB_SIZE}px;
            height: ${THUMB_SIZE}px;
            border-radius: 50%;
            background: ${thumbColor};
            cursor: pointer;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          }
          input[type="range"]::-moz-range-thumb {
            width: ${THUMB_SIZE}px;
            height: ${THUMB_SIZE}px;
            border-radius: 50%;
            background: ${thumbColor};
            cursor: pointer;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          }
        `}</style>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <View 
        style={styles.sliderContainer}
        onLayout={(event) => {
          const { width } = event.nativeEvent.layout;
          setSliderWidth(width);
        }}
      >
        {/* Track */}
        <View style={[styles.track, { backgroundColor: trackColor }]} />
        
        {/* Active Track */}
        <ReanimatedAnimated.View style={[styles.activeTrack, { backgroundColor: thumbColor }, activeTrackStyle]} />
        
        {/* Thumb */}
        <GestureDetector gesture={panGesture}>
          <ReanimatedAnimated.View style={[styles.thumb, { backgroundColor: thumbColor }, thumbStyle]} />
        </GestureDetector>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  sliderContainer: {
    height: THUMB_SIZE,
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
  },
  track: {
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    left: THUMB_SIZE / 2,
    right: THUMB_SIZE / 2,
  },
  activeTrack: {
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    left: THUMB_SIZE / 2,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    position: 'absolute',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  webSliderContainer: {
    width: '100%',
    height: THUMB_SIZE,
    justifyContent: 'center',
  },
 });