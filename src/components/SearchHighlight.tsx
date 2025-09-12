import React from 'react';

interface SearchHighlightProps {
  text: string;
  searchQuery: string;
  className?: string;
}

export const SearchHighlight: React.FC<SearchHighlightProps> = ({ 
  text, 
  searchQuery, 
  className = '' 
}) => {
  if (!searchQuery.trim()) {
    return <span className={className}>{text}</span>;
  }

  // 대소문자 구분 없이 검색
  const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, index) => 
        regex.test(part) ? (
          <mark 
            key={index}
            style={{
              backgroundColor: '#fef08a',
              color: '#a16207',
              padding: '2px 4px',
              borderRadius: '3px',
              fontWeight: 'bold'
            }}
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
};