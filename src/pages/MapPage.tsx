import React from 'react';
import { MapView } from '../components/MapView';
import { PageHeader } from '../components/PageHeader';
import type { UnifiedPhotoData } from '../types';
import './MapPage.css';

interface MapPageProps {
  photos: UnifiedPhotoData[];
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
      text: '홈',
      onClick: onBackClick,
      variant: 'secondary' as const
    },
    {
      icon: '📤',
      text: '업로드',
      onClick: onUploadClick,
      variant: 'primary' as const
    },
    {
      icon: '📍',
      text: '지도',
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