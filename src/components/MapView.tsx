import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCachedLocation } from '../utils/geocoding';
import type { UnifiedPhotoData } from '../types';
import './MapView.css';

interface MapViewProps {
  className?: string;
  photos?: UnifiedPhotoData[];
}

export const MapView: React.FC<MapViewProps> = ({ className, photos = [] }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routeLinesRef = useRef<L.Polyline[]>([]);
  const [showRoutes, setShowRoutes] = useState<boolean>(true);

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

  // 사진의 실제 촬영 시간 또는 fallback 시간 반환
  const getPhotoDateTime = (photo: UnifiedPhotoData): Date => {
    // 1. EXIF 촬영 시간 우선
    if (photo.exifData?.timestamp) {
      try {
        return new Date(photo.exifData.timestamp);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_) {
        console.warn('EXIF timestamp 파싱 실패:', photo.exifData.timestamp);
      }
    }
    
    // 2. 파일 수정 시간 차선
    if (photo.file?.lastModified) {
      return new Date(photo.file.lastModified);
    }
    
    // 3. 업로드 시간 최후
    return photo.uploadedAt || new Date();
  };

  // 날짜별 사진 그룹핑 함수 (촬영 시간 기준)
  const groupPhotosByDate = useCallback((photos: UnifiedPhotoData[]) => {
    const groups: { [date: string]: UnifiedPhotoData[] } = {};
    
    photos.forEach(photo => {
      if (!photo.location) return; // 위치 정보가 없으면 제외
      
      const photoDateTime = getPhotoDateTime(photo);
      const date = photoDateTime.toDateString(); // 같은 촬영 날짜로 그룹핑
      
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(photo);
    });

    // 각 그룹을 촬영 시간순으로 정렬
    Object.keys(groups).forEach(date => {
      groups[date].sort((a, b) => 
        getPhotoDateTime(a).getTime() - getPhotoDateTime(b).getTime()
      );
    });

    return groups;
  }, []);

  // 사진 마커 및 경로 업데이트
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // 기존 마커 및 경로 제거
    markersRef.current.forEach(marker => {
      map.removeLayer(marker);
    });
    markersRef.current = [];

    routeLinesRef.current.forEach(line => {
      map.removeLayer(line);
    });
    routeLinesRef.current = [];

    // 위치 정보가 있는 사진들에 마커 추가
    const photosWithLocation = photos.filter(photo => photo.location);
    
    // 날짜별 그룹핑
    const photoGroups = groupPhotosByDate(photosWithLocation);
    
    if (photosWithLocation.length === 0) return;

    // 촬영 시간순으로 정렬된 전체 사진 목록 생성 (마커 번호용)
    const sortedPhotos = photosWithLocation.sort((a, b) => 
      getPhotoDateTime(a).getTime() - getPhotoDateTime(b).getTime()
    );

    // 마커 추가
    sortedPhotos.forEach((photo, index) => {
      if (!photo.location) return;

      // 커스텀 아이콘 생성 (미니 썸네일 포함)
      const photoIcon = L.divIcon({
        className: 'photo-marker',
        html: `
          <div class="photo-marker-content" data-photo-index="${index}">
            <div class="photo-marker-thumbnail">
              ${photo.thumbnail_urls?.small || photo.thumbnail?.dataUrl
                ? `<img src="${photo.thumbnail_urls?.small || photo.thumbnail?.dataUrl}" alt="${photo.description}" />`
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
          // 툴팁 표시 - description이 비어있으면 설명 없음으로 표시
          const tooltipContent = (photo.description && photo.description.trim()) 
            ? photo.description 
            : '설명 없음';
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
      const captureDateTime = getPhotoDateTime(photo);
      const isExifTime = photo.exifData?.timestamp ? true : false;
      const timeLabel = isExifTime ? '촬영' : '업로드';
      
      const displayDescription = (photo.description && photo.description.trim()) 
        ? photo.description 
        : '설명 없음';
      
      // 위치명을 조회해서 팝업에 포함
      const setupPopupWithLocation = async () => {
        if (!photo.location) return;
        
        let locationName = '';
        try {
          locationName = await getCachedLocation(photo.location.latitude, photo.location.longitude);
        } catch (error) {
          locationName = `${photo.location.latitude.toFixed(4)}, ${photo.location.longitude.toFixed(4)}`;
        }
        
        const popupContent = `
          <div class="photo-popup">
            <div class="photo-popup-image">
              ${photo.thumbnail_urls?.medium || photo.thumbnail?.dataUrl
                ? `<img src="${photo.thumbnail_urls?.medium || photo.thumbnail?.dataUrl}" alt="${displayDescription}" />`
                : `<div class="photo-placeholder">📸</div>`
              }
            </div>
            <div class="photo-popup-info">
              <h4>${displayDescription}</h4>
              <p>📅 ${timeLabel}: ${captureDateTime.toLocaleDateString('ko-KR')} ${captureDateTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</p>
              <p>📍 ${locationName}</p>
              ${!isExifTime ? '<p class="time-note">⚠️ EXIF 촬영 시간 없음</p>' : ''}
            </div>
          </div>
        `;

        marker.bindPopup(popupContent, {
          maxWidth: 300,
          className: 'photo-marker-popup'
        });
      };

      // 비동기로 위치명 조회 후 팝업 설정
      setupPopupWithLocation();

      markersRef.current.push(marker);
    });

    // 경로선 추가 (showRoutes가 true일 때)
    if (showRoutes) {
      Object.values(photoGroups).forEach(groupPhotos => {
        if (groupPhotos.length < 2) return; // 2개 미만이면 연결선 불필요

        const coordinates: [number, number][] = groupPhotos.map(photo => [
          photo.location!.latitude,
          photo.location!.longitude
        ]);

        const routeLine = L.polyline(coordinates, {
          color: '#3b82f6',
          weight: 3,
          opacity: 0.7,
          dashArray: '10, 10',
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(map);

        // 경로선에 툴팁 추가 (촬영 날짜 기준)
        const groupDate = getPhotoDateTime(groupPhotos[0]).toLocaleDateString('ko-KR');
        routeLine.bindTooltip(`📅 ${groupDate} 여행 경로 (${groupPhotos.length}장)`, {
          permanent: false,
          direction: 'center',
          className: 'route-tooltip'
        });

        routeLinesRef.current.push(routeLine);
      });
    }

    // 지도를 모든 마커가 보이도록 조정
    if (photosWithLocation.length > 0) {
      const group = new L.FeatureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }, [photos, showRoutes, groupPhotosByDate]);

  return (
    <div className={`map-container ${className || ''}`}>
      <div ref={mapRef} className="map" />
      
      {/* 경로 표시 토글 버튼 */}
      <div className="map-controls">
        <button 
          className={`route-toggle-btn ${showRoutes ? 'active' : ''}`}
          onClick={() => setShowRoutes(!showRoutes)}
          title={showRoutes ? '여행 경로 숨기기' : '여행 경로 보기'}
        >
          <span className="route-icon">🛣️</span>
          <span className="route-text">
            {showRoutes ? '경로 숨기기' : '경로 보기'}
          </span>
        </button>
      </div>
    </div>
  );
};