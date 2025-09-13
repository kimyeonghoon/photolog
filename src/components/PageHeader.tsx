import React from 'react';
import './PageHeader.css';

interface HeaderButton {
  icon: string;
  text: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'success';
  active?: boolean;
  style?: React.CSSProperties;
}

interface PageHeaderProps {
  currentPage: string;
  buttons: HeaderButton[];
}

export const PageHeader: React.FC<PageHeaderProps> = ({ currentPage, buttons }) => {
  const getPageInfo = (page: string) => {
    switch (page) {
      case 'home':
        return { title: '📸 포토로그', subtitle: '나의 여행 기록' };
      case 'upload':
        return { title: '📸 포토로그', subtitle: '📤 사진 업로드' };
      case 'map':
        return { title: '📸 포토로그', subtitle: '🗺️ 지도 보기' };
      case 'test':
        return { title: '📸 포토로그', subtitle: '🧪 테스트 모드' };
      default:
        return { title: '📸 포토로그', subtitle: '나의 여행 기록' };
    }
  };

  const pageInfo = getPageInfo(currentPage);

  return (
    <header className="page-header">
      <h1>{pageInfo.title}</h1>
      <p>{pageInfo.subtitle}</p>
      <div className="header-buttons flex flex-wrap gap-3 justify-center">
        {buttons.map((button, index) => (
          <button
            key={index}
            onClick={button.onClick}
            className={`btn btn-${button.variant || 'primary'} btn-lg ${button.active ? 'active' : ''}`}
            style={button.style}
          >
            {button.icon} {button.text}
          </button>
        ))}
      </div>
    </header>
  );
};