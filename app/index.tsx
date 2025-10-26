import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Alert, StyleSheet, TouchableOpacity, Image, ActivityIndicator, StatusBar } from 'react-native';
import { useCameraPermissions, CameraView, CameraType } from 'expo-camera';
import { launchImageLibraryAsync, requestMediaLibraryPermissionsAsync, MediaTypeOptions } from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Video, ResizeMode } from 'expo-av';
import axios from 'axios';

type MediaType = 'photo' | 'video';

export default function CameraPermissionScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [libraryPermission, setLibraryPermission] = useState<boolean | null>(null);
  const [capturedMedia, setCapturedMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const [cameraMode, setCameraMode] = useState<'photo' | 'video'>('photo');
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [flash, setFlash] = useState<'on' | 'off' | 'auto'>('off');
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    requestMediaLibraryPermissionsAsync().then(result => {
      setLibraryPermission(result.granted);
    });
  }, []);

  const requestCameraPermission = async () => {
    try {
      const result = await requestPermission();
      
      if (result.granted) {
        setMediaType('photo');
      } else if (result.canAskAgain === false) {
        Alert.alert(
          'Thông báo',
          'Bạn đã từ chối quyền truy cập camera. Một số tính năng có thể không hoạt động.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error requesting camera permission:', error);
    }
  };

  const requestLibraryPermission = async () => {
    try {
      const result = await requestMediaLibraryPermissionsAsync();
      setLibraryPermission(result.granted);
      return result.granted;
    } catch (error) {
      console.error('Error requesting library permission:', error);
      return false;
    }
  };

  const handleCapturePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        if (photo && photo.uri) {
          setCapturedMedia(photo.uri);
        }
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Lỗi', 'Không thể chụp ảnh');
      }
    }
  };

  const handleStartRecording = async () => {
    if (cameraRef.current) {
      try {
        setIsRecording(true);
        const video = await cameraRef.current.recordAsync();
        if (video && video.uri) {
          setCapturedMedia(video.uri);
          setMediaType('video');
        }
      } catch (error) {
        console.error('Error recording video:', error);
        Alert.alert('Lỗi', 'Không thể quay video');
      } finally {
        setIsRecording(false);
      }
    }
  };

  const handleStopRecording = async () => {
    if (cameraRef.current) {
      cameraRef.current.stopRecording();
      setIsRecording(false);
    }
  };

  const handlePickFromLibrary = async () => {
    try {
      const hasPermission = libraryPermission || await requestLibraryPermission();
      
      if (!hasPermission) {
        Alert.alert('Thông báo', 'Cần quyền truy cập thư viện ảnh');
        return;
      }

      const result = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.All,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setCapturedMedia(asset.uri);
        setMediaType(asset.type === 'video' ? 'video' : 'photo');
      }
    } catch (error) {
      console.error('Error picking from library:', error);
      Alert.alert('Lỗi', 'Không thể chọn ảnh từ thư viện');
    }
  };

  const handleRetake = () => {
    setCapturedMedia(null);
    setMediaType('photo');
    setUploading(false);
  };

  const handleContinue = async () => {
    if (!capturedMedia) return;

    setUploading(true);
    
    try {
      let processedUri = capturedMedia;

      if (mediaType === 'photo') {
        const manipulated = await manipulateAsync(
          capturedMedia,
          [{ resize: { width: 1080 } }],
          { compress: 0.7, format: SaveFormat.JPEG }
        );
        processedUri = manipulated.uri;
      }

      const formData = new FormData();
      
      const filename = processedUri.split('/').pop() || 
        (mediaType === 'video' ? 'video.mp4' : 'photo.jpg');
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? 
        (mediaType === 'video' ? `video/${match[1]}` : `image/${match[1]}`) : 
        (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
      
      formData.append('file', {
        uri: processedUri,
        type: type,
        name: filename,
      } as any);
      
      formData.append('upload_preset', 'unsigned');

      const response = await axios.post(
        'https://api.cloudinary.com/v1_1/dimxrq8bs/image/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const secureUrl = response.data.secure_url;
      console.log('Secure URL:', secureUrl);
      
      Alert.alert(
        'Thành công',
        'Upload thành công!',
        [
          { 
            text: 'OK',
            onPress: () => {
              setCapturedMedia(null);
              setUploading(false);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error uploading:', error);
      
      Alert.alert(
        'Thất bại',
        'Upload thất bại! Vui lòng thử lại.',
        [{ text: 'OK' }]
      );
    } finally {
      setUploading(false);
    }
  };

  const getCurrentTimestamp = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
  };

  const toggleCameraType = () => {
    setCameraType(prev => prev === 'back' ? 'front' : 'back');
  };

  const toggleFlash = () => {
    setFlash(prev => 
      prev === 'off' ? 'auto' : 
      prev === 'auto' ? 'on' : 
      'off'
    );
  };

  if (!capturedMedia && !uploading) {
    if (!permission) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Yêu cầu quyền Camera</Text>
          <Text style={styles.statusText}>Đang tải...</Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Yêu cầu quyền Camera</Text>
          
          <TouchableOpacity style={styles.button} onPress={requestCameraPermission}>
            <Text style={styles.buttonText}>YÊU CẦU QUYỀN</Text>
          </TouchableOpacity>
          
          <Text style={styles.statusText}>
            Trạng thái: Chưa cấp quyền
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <StatusBar hidden />
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={cameraType}
          mode={cameraMode}
          flash={flash}
        />
        
 
        <View style={styles.topControls}>
          <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
            <Text style={styles.controlButtonText}>
              {flash === 'off' ? '⚡ Off' : flash === 'on' ? '⚡ On' : '⚡ Auto'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.controlButton, styles.modeButton]} 
            onPress={() => setCameraMode(prev => prev === 'photo' ? 'video' : 'photo')}
          >
            <Text style={styles.controlButtonText}>
              {cameraMode === 'photo' ? '📷 Camera' : '🎥 Video'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.controlButton} onPress={toggleCameraType}>
            <Text style={styles.controlButtonText}>🔄</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomControls}>
          <TouchableOpacity 
            style={[styles.bottomButton, styles.libraryButton]} 
            onPress={handlePickFromLibrary}
          >
            <Text style={styles.bottomButtonText}>📁 Thư viện</Text>
          </TouchableOpacity>
          
          {cameraMode === 'photo' ? (
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleCapturePhoto}
              activeOpacity={0.8}
            >
              <View style={styles.captureIcon} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.captureButton, isRecording && styles.recordingButton]}
              onPress={isRecording ? handleStopRecording : handleStartRecording}
              activeOpacity={0.8}
            >
              <View style={[styles.captureIcon, isRecording && styles.stopIcon]} />
            </TouchableOpacity>
          )}
          
          <View style={styles.placeholder} />
        </View>
      </View>
    );
  }

  if (uploading) {
    return (
      <View style={styles.uploadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.uploadingText}>Đang upload...</Text>
      </View>
    );
  }
  if (capturedMedia) {
    return (
      <View style={styles.previewContainer}>
        {mediaType === 'video' ? (
          <Video
            ref={videoRef}
            source={{ uri: capturedMedia }}
            style={styles.previewImage}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping
            useNativeControls={false}
          />
        ) : (
          <Image source={{ uri: capturedMedia }} style={styles.previewImage} />
        )}
        
        <View style={styles.timestampContainer}>
          <Text style={styles.timestamp}>{getCurrentTimestamp()}</Text>
        </View>

        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.retakeButton]}
            onPress={handleRetake}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>CHỤP LẠI</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.continueButton]}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>TIẾP TỤC</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#000',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 10,
    marginBottom: 30,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  statusText: {
    fontSize: 16,
    color: '#666',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  topControls: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  controlButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modeButton: {
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  libraryButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bottomButton: {
    flex: 1,
    maxWidth: 120,
  },
  bottomButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 80,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#E0E0E0',
  },
  recordingButton: {
    borderColor: '#FF3B30',
  },
  captureIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#000',
  },
  stopIcon: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  timestampContainer: {
    position: 'absolute',
    bottom: 100,
    left: 10,
  },
  timestamp: {
    color: '#FFA500',
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionButtonsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 8,
    marginHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retakeButton: {
    backgroundColor: '#FF3B30',
  },
  continueButton: {
    backgroundColor: '#007AFF',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  uploadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 20,
  },
});
