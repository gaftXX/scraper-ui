'use client';

import React from 'react';

interface ProjectIndicatorProps {
  projectCount: number;
  isNewOffice: boolean;
  opacity?: number;
  maxProjects?: number;
}

const ProjectIndicator: React.FC<ProjectIndicatorProps> = ({
  projectCount,
  isNewOffice,
  opacity = 0.2,
  maxProjects = 30
}) => {
  const filledPieces = Math.min(projectCount, maxProjects);
  const baseColor = isNewOffice ? '#000000' : '#ffffff';
  const projectColor = '#ff8c00'; // Orange color for projects

  return (
    <div 
      style={{ 
        width: '100px', 
        height: '12px', 
        display: 'inline-block',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Base box with opacity */}
      <div
        style={{
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          backgroundColor: baseColor,
          opacity: opacity
        }}
      />
      {/* Project pieces (orange) with full opacity */}
      {Array.from({ length: filledPieces }, (_, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: `${(index / maxProjects) * 100}%`,
            top: '0',
            width: `${100 / maxProjects}%`,
            height: '100%',
            backgroundColor: projectColor,
            opacity: 1
          }}
        />
      ))}
    </div>
  );
};

export default ProjectIndicator;
