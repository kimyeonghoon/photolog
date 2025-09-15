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

export const PageHeader: React.FC<PageHeaderProps> = ({ buttons }) => {
  const pageInfo = { title: '📸 포토로그', subtitle: '나의 여행 기록' };

  return (
    <header className="page-header">
      <h1>{pageInfo.title}</h1>
      <p>{pageInfo.subtitle}</p>
      <div className="header-buttons">
        {buttons.map((button, index) => (
          <button
            key={index}
            onClick={button.onClick}
            className={`btn btn-${button.variant || 'primary'} ${button.active ? 'active' : ''}`}
            style={button.style}
          >
            {button.icon} {button.text}
          </button>
        ))}
      </div>
    </header>
  );
};