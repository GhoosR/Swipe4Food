import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

interface VideoPlayerProps {
  source: string;
  style?: any;
  shouldPlay?: boolean;
  isLooping?: boolean;
  onPlaybackStatusUpdate?: (status: any) => void;
  useNativeControls?: boolean;
  resizeMode?: 'contain' | 'cover' | 'stretch';
}

export interface VideoPlayerMethods {
  play: () => Promise<void>;
  pause: () => void;
}

const VideoPlayer = React.forwardRef<VideoPlayerMethods, VideoPlayerProps>((props, ref) => {
  const { source, style, shouldPlay = false, isLooping = false, onPlaybackStatusUpdate, useNativeControls = false, resizeMode = 'cover' } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const webViewRef = useRef<WebView>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useImperativeHandle(ref, () => ({
    play: async () => {
      if (Platform.OS === 'web' && videoRef.current) {
        try {
          await videoRef.current.play();
          setIsPlaying(true);
        } catch (error) {
          console.log('Video play failed:', error);
          throw error;
        }
      } else if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({ action: 'play' }));
      }
    },
    pause: () => {
      if (Platform.OS === 'web' && videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({ action: 'pause' }));
      }
    }
  }));

  // Web video event handlers
  useEffect(() => {
    if (Platform.OS === 'web' && videoRef.current) {
      const video = videoRef.current;
      
      const handlePlay = () => {
        setIsPlaying(true);
        onPlaybackStatusUpdate?.({
          isLoaded: true,
          isPlaying: true,
          position: video.currentTime * 1000,
          duration: video.duration * 1000,
        });
      };

      const handlePause = () => {
        setIsPlaying(false);
        onPlaybackStatusUpdate?.({
          isLoaded: true,
          isPlaying: false,
          position: video.currentTime * 1000,
          duration: video.duration * 1000,
        });
      };

      const handleLoadedMetadata = () => {
        onPlaybackStatusUpdate?.({
          isLoaded: true,
          isPlaying: !video.paused,
          position: video.currentTime * 1000,
          duration: video.duration * 1000,
        });
      };

      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);

      return () => {
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [onPlaybackStatusUpdate, source]);

  // Handle shouldPlay prop changes
  useEffect(() => {
    if (Platform.OS === 'web' && videoRef.current) {
      const video = videoRef.current;
      if (shouldPlay && !isPlaying) {
        setTimeout(() => {
          video.play().catch((error: any) => {
            console.log('Autoplay prevented:', error);
          });
        }, 100);
      } else if (!shouldPlay && isPlaying) {
        video.pause();
      }
    }
  }, [shouldPlay, isPlaying]);

  // Handle source changes
  useEffect(() => {
    if (Platform.OS === 'web' && videoRef.current) {
      const video = videoRef.current;
      video.load();
      setIsPlaying(false);
      
      if (shouldPlay) {
        setTimeout(() => {
          video.play().catch((error: any) => {
            console.log('Video load and play failed:', error);
          });
        }, 200);
      }
    }
  }, [source]);

  if (Platform.OS === 'web') {
    return (
      <video
        ref={videoRef}
        src={source}
        style={{
          width: '100%',
          height: '100%',
          objectFit: resizeMode,
          ...style,
        }}
        loop={isLooping}
        controls={useNativeControls}
        muted={!useNativeControls}
        playsInline
        crossOrigin="anonymous"
        preload="metadata"
      />
    );
  }

  const videoHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          margin: 0; 
          padding: 0; 
          background: black; 
          overflow: hidden;
          width: 100vw;
          height: 100vh;
        }
        video { 
          width: 100vw; 
          height: 100vh; 
          object-fit: ${resizeMode};
          background: black;
        }
      </style>
    </head>
    <body>
      <video 
        id="video"
        src="${source}"
        ${isLooping ? 'loop' : ''}
        ${useNativeControls ? 'controls' : ''}
        playsinline
        webkit-playsinline
        crossorigin="anonymous"
        preload="metadata"
      ></video>
      <script>
        const video = document.getElementById('video');
        
        window.addEventListener('message', function(event) {
          try {
            const data = JSON.parse(event.data);
            if (data.action === 'play') {
              video.play().then(() => {
                sendUpdate();
              }).catch(e => {
                console.log('Play failed:', e);
                sendUpdate();
              });
            } else if (data.action === 'pause') {
              video.pause();
              sendUpdate();
            }
          } catch (e) {
            console.log('Message parse error:', e);
          }
        });
        
        function sendUpdate() {
          try {
            window.ReactNativeWebView?.postMessage(JSON.stringify({
              type: 'playbackUpdate',
              isLoaded: video.readyState >= 2,
              isPlaying: !video.paused && !video.ended,
              position: video.currentTime * 1000,
              duration: video.duration * 1000 || 0
            }));
          } catch (e) {
            console.log('Send update error:', e);
          }
        }
        
        video.addEventListener('loadedmetadata', sendUpdate);
        video.addEventListener('play', sendUpdate);
        video.addEventListener('pause', sendUpdate);
        video.addEventListener('ended', sendUpdate);
        
        ${shouldPlay ? `
          setTimeout(() => {
            video.play().then(sendUpdate).catch(e => {
              console.log('Autoplay failed:', e);
              sendUpdate();
            });
          }, 100);
        ` : ''}
        
        setTimeout(sendUpdate, 200);
      </script>
    </body>
    </html>
  `;

  return (
    <WebView
      ref={webViewRef}
      style={style}
      source={{ html: videoHtml }}
      allowsInlineMediaPlayback={true}
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      startInLoadingState={false}
      scalesPageToFit={false}
      scrollEnabled={false}
      bounces={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      onMessage={(event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data.type === 'playbackUpdate') {
            onPlaybackStatusUpdate?.(data);
          }
        } catch (error) {
          console.error('Error parsing WebView message:', error);
        }
      }}
    />
  );
}
)

VideoPlayer.displayName = 'VideoPlayer';
export default VideoPlayer;