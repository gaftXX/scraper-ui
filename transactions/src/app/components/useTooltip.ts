import { useState, useEffect, RefObject } from 'react';

interface TooltipPosition {
  top: number;
  left: number;
}

interface UseTooltipProps {
  targetRef: RefObject<HTMLElement | null>;
}

export const useTooltip = ({ targetRef }: UseTooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ top: 0, left: 0 });

  useEffect(() => {
    const target = targetRef.current;
    
    if (!target) return;

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate position with some padding from cursor
      const tooltipOffset = 10; // Closer to cursor
      const newLeft = e.clientX + tooltipOffset;
      const newTop = e.clientY - 25; // Higher above cursor
      
      // Ensure tooltip doesn't go off screen
      const maxLeft = window.innerWidth - 200; // Assume tooltip width ~200px
      const maxTop = window.innerHeight - 50; // Assume tooltip height ~50px
      
      setPosition({
        top: Math.min(Math.max(newTop, 0), maxTop),
        left: Math.min(Math.max(newLeft, 0), maxLeft),
      });
    };

    target.addEventListener('mouseenter', handleMouseEnter);
    target.addEventListener('mouseleave', handleMouseLeave);
    target.addEventListener('mousemove', handleMouseMove);

    return () => {
      target.removeEventListener('mouseenter', handleMouseEnter);
      target.removeEventListener('mouseleave', handleMouseLeave);
      target.removeEventListener('mousemove', handleMouseMove);
    };
  }, [targetRef]);

  return { isVisible, position };
}; 