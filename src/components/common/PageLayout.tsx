import React from 'react';

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  centered?: boolean;
  onBackClick?: () => void;
  children?: React.ReactNode;
  className?: string;
}

interface PageContentProps {
  children: React.ReactNode;
  className?: string;
}

export const PageLayout: React.FC<PageLayoutProps> = ({ children, className = '' }) => {
  return (
    <div className={`page-layout ${className}`}>
      {children}
    </div>
  );
};

export const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  subtitle, 
  centered = false, 
  onBackClick,
  children,
  className = '' 
}) => {
  return (
    <header className={`page-header ${centered ? 'centered' : ''} ${className}`}>
      {onBackClick && (
        <button onClick={onBackClick} className="btn-back">
          ← 돌아가기
        </button>
      )}
      <div className={centered ? 'text-center' : ''}>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        {children}
      </div>
    </header>
  );
};

export const PageContent: React.FC<PageContentProps> = ({ children, className = '' }) => {
  return (
    <main className={`page-content ${className}`}>
      {children}
    </main>
  );
};