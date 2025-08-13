import React, { useState, useRef } from "react";
import { cn } from "../../lib/utils";

export function HoverBorderGradient({
  children,
  containerClassName,
  className,
  as: Tag = "button",
  duration = 2,
  clockwise = true,
  ...props
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Tag
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "relative flex rounded-full border border-white/20 content-center bg-transparent transition duration-500 items-center justify-center overflow-hidden p-[2px] w-fit",
        containerClassName
      )}
      {...props}
    >
      <div
        className={cn(
          "relative text-white z-10 bg-black px-6 py-3 rounded-[inherit]",
          className
        )}
      >
        {children}
      </div>
      
      {/* Rotating gradient border */}
      <div 
        className="absolute inset-0 rounded-[inherit] opacity-75"
        style={{
          background: `conic-gradient(from 0deg, transparent, #3b82f6, #8b5cf6, #ec4899, transparent)`,
          animation: hovered ? 'none' : `spin ${duration}s linear infinite`,
        }}
      />
      
      {/* Hover effect */}
      {hovered && (
        <div 
          className="absolute inset-0 rounded-[inherit] opacity-90"
          style={{
            background: `conic-gradient(from 0deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6)`,
            animation: `spin 1s linear infinite`,
          }}
        />
      )}
      
      {/* Inner mask */}
      <div className="absolute inset-[2px] bg-transparent rounded-[inherit]" />
      
      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </Tag>
  );
}
