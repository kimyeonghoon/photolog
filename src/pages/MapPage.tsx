import React from 'react';
import { MapView } from '../components/MapView';
import { PageHeader } from '../components/PageHeader';
import './MapPage.css';

interface StoredPhotoData {
  file: File;
  thumbnail?: {
    dataUrl: string;
    width: number;
    height: number;
    size: number;
  };
  description: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  exifData?: {
    latitude?: number;
    longitude?: number;
    timestamp?: string;
    camera?: string;
    lens?: string;
    [key: string]: string | number | boolean | undefined;
  } | null;
  uploadedAt: Date;
}

interface MapPageProps {
  photos: StoredPhotoData[];
  onBackClick: () => void;
  onUploadClick: () => void;
}

export const MapPage: React.FC<MapPageProps> = ({ 
  photos,
  onBackClick, 
  onUploadClick 
}) => {
  const headerButtons = [
    {
      icon: '🏠',
      text: '홈으로',
      onClick: onBackClick,
      variant: 'secondary' as const
    },
    {
      icon: '📤',
      text: '사진 업로드',
      onClick: onUploadClick,
      variant: 'primary' as const
    },
    {
      icon: '📍',
      text: '지도 보기',
      onClick: () => {},
      variant: 'success' as const,
      active: true
    }
  ];

  return (
    <div className="map-page">
      <PageHeader 
        currentPage="map"
        buttons={headerButtons}
      />
      <main className="map-page-main">
        <MapView photos={photos} />
      </main>
    </div>
  );
};