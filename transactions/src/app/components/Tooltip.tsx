import React, { FC, ReactNode, useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTooltip } from "./useTooltip";

type TooltipProps = {
  targetRef: React.RefObject<HTMLElement | null>;
  children: ReactNode;
};

const Tooltip: FC<TooltipProps> = ({ targetRef, children }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { isVisible, position } = useTooltip({ targetRef });
  const [textColor, setTextColor] = useState("#fff");

  useEffect(() => {
    if (isVisible && targetRef.current) {
      const updateTextColor = () => {
        const element = document.elementFromPoint(position.left, position.top);
        if (element) {
          const bgColor = window.getComputedStyle(element).backgroundColor;
          // Check if background is white or close to white
          if (bgColor === 'rgb(255, 255, 255)' || bgColor === '#ffffff' || bgColor === 'white') {
            setTextColor("#393837");
          } else {
            setTextColor("#fff");
          }
        }
      };

      updateTextColor();
      // Update on mouse move to handle dynamic backgrounds
      const handleMouseMove = () => {
        requestAnimationFrame(updateTextColor);
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
      };
    }
  }, [isVisible, position, targetRef]);

  if (!isVisible) return null;

  const tooltipElement = (
    <div
      ref={tooltipRef}
      className="tooltip-container"
      style={{
        position: "fixed",
        top: `${position.top}px`,
        left: `${position.left}px`,
        pointerEvents: "none",
        backgroundColor: "transparent",
        color: textColor,
        padding: "4px 8px",
        borderRadius: "4px",
        fontSize: "12px",
        whiteSpace: "nowrap",
        zIndex: 999999,
        transform: "translateZ(0)",
      }}
    >
      {children}
    </div>
  );

  // Render as portal to document.body to avoid stacking context issues
  return typeof document !== 'undefined' 
    ? createPortal(tooltipElement, document.body)
    : tooltipElement;
};

export default Tooltip; 