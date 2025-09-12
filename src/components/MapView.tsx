import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './MapView.css';

interface PhotoData {
  file: File;
  description: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  thumbnail?: {
    dataUrl: string;
    width: number;
    height: number;
    size: number;
  };
  uploadedAt: Date;
}

interface MapViewProps {
  className?: string;
  photos?: PhotoData[];
}

export const MapView: React.FC<MapViewProps> = ({ className, photos = [] }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // 기본 지도 초기화 - 서울 중심
    const map = L.map(mapRef.current).setView([37.5665, 126.9780], 13);

    // OpenStreetMap 타일 레이어 추가
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    mapInstanceRef.current = map;

    // 컴포넌트 언마운트 시 지도 정리
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 사진 마커 업데이트
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // 기존 마커 제거
    markersRef.current.forEach(marker => {
      map.removeLayer(marker);
    });
    markersRef.current = [];

    // 위치 정보가 있는 사진들에 마커 추가
    const photosWithLocation = photos.filter(photo => photo.location);
    
    if (photosWithLocation.length === 0) return;

    photosWithLocation.forEach((photo, index) => {
      if (!photo.location) return;

      // 커스텀 아이콘 생성 (미니 썸네일 포함)
      const photoIcon = L.divIcon({
        className: 'photo-marker',
        html: `
          <div class="photo-marker-content" data-photo-index="${index}">
            <div class="photo-marker-thumbnail">
              ${photo.thumbnail 
                ? `<img src="${photo.thumbnail.dataUrl}" alt="${photo.description}" />` 
                : `<div class="photo-marker-fallback">📸</div>`
              }
            </div>
            <div class="photo-marker-border"></div>
            <span class="photo-marker-count">${index + 1}</span>
          </div>
        `,
        iconSize: [50, 60],
        iconAnchor: [25, 60]
      });

      const marker = L.marker([photo.location.latitude, photo.location.longitude], {
        icon: photoIcon
      }).addTo(map);

      // 마커 이벤트 추가 (호버 및 선택)
      marker.on('mouseover', function() {
        const markerElement = marker.getElement();
        if (markerElement) {
          markerElement.classList.add('marker-hover');
          // 툴팁 표시
          const tooltipContent = photo.description || '제목 없음';
          marker.bindTooltip(tooltipContent, {
            permanent: false,
            direction: 'top',
            offset: [0, -10],
            className: 'photo-marker-tooltip'
          }).openTooltip();
        }
      });

      marker.on('mouseout', function() {
        const markerElement = marker.getElement();
        if (markerElement) {
          markerElement.classList.remove('marker-hover');
          marker.closeTooltip();
        }
      });

      marker.on('click', function() {
        // 다른 마커들의 선택 상태 제거
        markersRef.current.forEach(m => {
          const element = m.getElement();
          if (element) element.classList.remove('marker-selected');
        });
        
        // 현재 마커 선택 상태 추가
        const markerElement = marker.getElement();
        if (markerElement) {
          markerElement.classList.add('marker-selected');
        }
      });

      // 팝업 추가
      const popupContent = `
        <div class="photo-popup">
          <div class="photo-popup-image">
            ${photo.thumbnail 
              ? `<img src="${photo.thumbnail.dataUrl}" alt="${photo.description}" />` 
              : `<div class="photo-placeholder">📸</div>`
            }
          </div>
          <div class="photo-popup-info">
            <h4>${photo.description || '제목 없음'}</h4>
            <p>📅 ${photo.uploadedAt.toLocaleDateString('ko-KR')}</p>
            <p>📍 ${photo.location.latitude.toFixed(4)}, ${photo.location.longitude.toFixed(4)}</p>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'photo-marker-popup'
      });

      markersRef.current.push(marker);
    });

    // 지도를 모든 마커가 보이도록 조정
    if (photosWithLocation.length > 0) {
      const group = new L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }, [photos]);

  return (
    <div className={`map-container ${className || ''}`}>
      <div ref={mapRef} className="map" />
    </div>
  );
};