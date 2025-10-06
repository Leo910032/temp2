export class EnhancedExchangeService {
  constructor() {
    this.cachedScanToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Check location permission status
   */
  async checkLocationPermission() {
    try {
      if (!navigator.permissions) {
        return { state: 'unavailable', supported: false };
      }

      const permission = await navigator.permissions.query({ name: 'geolocation' });
      return {
        state: permission.state, // 'granted', 'denied', or 'prompt'
        supported: true
      };
    } catch (error) {
      console.warn('Location permission check not supported:', error);
      return { state: 'unavailable', supported: false };
    }
  }

  /**
   * Get current location
   */
  async getCurrentLocation(options = {}) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date(position.timestamp).toISOString()
          });
        },
        (error) => {
          let errorMessage = 'Failed to get location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
          }
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: options.enableHighAccuracy || true,
          timeout: options.timeout || 10000,
          maximumAge: options.maximumAge || 300000
        }
      );
    });
  }

  /**
   * Cache a pre-generated scan token
   */
  usePreGeneratedScanToken(token, expiresAt) {
    try {
      this.cachedScanToken = token;
      this.tokenExpiry = expiresAt;
      console.log('✅ Scan token cached:', { expiresAt });
      return true;
    } catch (error) {
      console.error('❌ Error caching scan token:', error);
      return false;
    }
  }

  /**
   * Get cached scan token
   */
  getCachedScanToken() {
    if (!this.cachedScanToken) {
      return null;
    }

    // Check if token has expired
    if (this.tokenExpiry && new Date(this.tokenExpiry) < new Date()) {
      console.warn('⚠️ Cached scan token has expired');
      this.cachedScanToken = null;
      this.tokenExpiry = null;
      return null;
    }

    return this.cachedScanToken;
  }

  /**
   * Get scanning capabilities
   */
  getScanningCapabilities() {
    return {
      camera: {
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      },
      supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
      maxFileSize: 10 * 1024 * 1024 // 10MB
    };
  }

  /**
   * Scan business card
   */
  async scanBusinessCard(imageData, options = {}) {
    try {
      console.log('📸 Scanning business card...');

      const scanToken = this.getCachedScanToken();
      if (!scanToken) {
        throw new Error('No valid scan token available');
      }

      // Convert image data to base64 if needed
      console.log('📥 Raw imageData received:', {
        type: typeof imageData,
        isBlob: imageData instanceof Blob,
        isFile: imageData instanceof File,
        isArray: Array.isArray(imageData),
        constructor: imageData?.constructor?.name
      });

      let base64Image = imageData;
      if (imageData instanceof Blob || imageData instanceof File) {
        console.log('🔄 Converting File/Blob to base64...');
        base64Image = await this.fileToBase64(imageData);
      } else if (typeof imageData === 'string') {
        console.log('✅ Already a string, using as-is');
        base64Image = imageData;
      } else {
        console.error('❌ Unexpected image data type:', typeof imageData, imageData);
        throw new Error(`Invalid image data type: ${typeof imageData}`);
      }

      // Build images object based on which side is being scanned
      const side = options.side || 'front';
      const images = {
        [side]: base64Image
      };

      console.log('📤 Sending scan request:', {
        hasScanToken: !!scanToken,
        side,
        imageSize: base64Image?.length || 0,
        language: options.language || 'en'
      });

      const response = await fetch('/api/user/contacts/scan/public', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scanToken,
          images,
          language: options.language || 'en'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Scan API error:', error);
        throw new Error(error.error || error.message || 'Business card scan failed');
      }

      const result = await response.json();
      console.log('✅ Business card scanned successfully:', {
        fieldsCount: result.parsedFields?.length || 0,
        hasPersonalizedMessage: !!result.personalizedMessage
      });

      return result;

    } catch (error) {
      console.error('❌ Error scanning business card:', error);
      throw error;
    }
  }

  /**
   * Submit exchange contact
   */
  async submitExchangeContact(exchangeData) {
    try {
      console.log('📤 Submitting exchange contact...');
      console.log('📥 Raw exchangeData received:', {
        targetUserId: exchangeData.targetUserId,
        targetUsername: exchangeData.targetUsername,
        hasContact: !!exchangeData.contact,
        hasMetadata: !!exchangeData.metadata
      });

      // Map field names from ExchangeModal format to API format
      const submissionData = {
        userId: exchangeData.targetUserId,
        username: exchangeData.targetUsername,
        contact: exchangeData.contact,
        metadata: exchangeData.metadata
      };

      console.log('📋 Mapped submission data:', {
        userId: submissionData.userId,
        username: submissionData.username,
        hasContact: !!submissionData.contact,
        contactFields: submissionData.contact ? Object.keys(submissionData.contact) : []
      });

      const response = await fetch('/api/user/contacts/exchange/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData)
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Server error:', error);
        throw new Error(error.error || error.message || 'Contact submission failed');
      }

      const result = await response.json();
      console.log('✅ Contact submitted successfully:', result);

      return result;

    } catch (error) {
      console.error('❌ Error submitting contact:', error);
      throw error;
    }
  }

  /**
   * Helper: Convert file to base64
   */
  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Verify profile by user ID
   */
  async verifyProfileByUserId(userId) {
    try {
      console.log('🔍 EnhancedExchangeService: Verifying profile by userId:', userId);

      // Call the server-side exchange service verification
      const response = await fetch('/api/user/contacts/verify-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: userId,
          type: 'userId'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Profile verification failed');
      }

      const result = await response.json();

      console.log('✅ EnhancedExchangeService: Profile verification result:', result);

      return {
        available: result.available,
        exists: result.exists,
        profile: result.profile
      };

    } catch (error) {
      console.error('❌ EnhancedExchangeService: Error verifying profile:', error);
      return {
        available: false,
        exists: false,
        error: error.message
      };
    }
  }

  /**
   * Verify profile by username
   */
  async verifyProfileByUsername(username) {
    try {
      console.log('🔍 EnhancedExchangeService: Verifying profile by username:', username);

      const response = await fetch('/api/user/contacts/verify-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: username,
          type: 'username'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Profile verification failed');
      }

      const result = await response.json();

      console.log('✅ EnhancedExchangeService: Profile verification result:', result);

      return {
        available: result.available,
        exists: result.exists,
        profile: result.profile
      };

    } catch (error) {
      console.error('❌ EnhancedExchangeService: Error verifying profile:', error);
      return {
        available: false,
        exists: false,
        error: error.message
      };
    }
  }
}