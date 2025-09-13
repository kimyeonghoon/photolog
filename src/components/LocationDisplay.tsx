import React, { useState, useEffect } from 'react';
import { getCachedLocation } from '../utils/geocoding';

interface LocationDisplayProps {
  latitude: number;
  longitude: number;
  className?: string;
  showIcon?: boolean;
}

export const LocationDisplay: React.FC<LocationDisplayProps> = ({ 
  latitude, 
  longitude, 
  className = '', 
  showIcon = true 
}) => {
  const [locationName, setLocationName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        setLoading(true);
        const name = await getCachedLocation(latitude, longitude);
        setLocationName(name);
      } catch (error) {
        console.warn('위치명 조회 실패:', error);
        setLocationName(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      } finally {
        setLoading(false);
      }
    };

    fetchLocation();
  }, [latitude, longitude]);

  if (loading) {
    return (
      <span className={className}>
        {showIcon && '📍 '}위치 확인 중...
      </span>
    );
  }

  return (
    <span className={className} title={`위도: ${latitude}, 경도: ${longitude}`}>
      {showIcon && '📍 '}{locationName}
    </span>
  );
};