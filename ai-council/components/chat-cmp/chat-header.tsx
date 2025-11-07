"use client"

import React from 'react'

const ChatHeader: React.FC = () => {
  return (
    <div className="w-full hidden md:block relative">
      <div
        className="pointer-events-none fixed top-0 right-0 z-30 h-20 w-40 max-sm:hidden overflow-hidden transition-[top] duration-100 ease-snappy grid place-items-center"
        style={{ clipPath: 'inset(0px 12px 0px 0px)' }}
      >
        <div className="group pointer-events-none absolute top-3.5 z-10 -mb-8 h-32 w-full origin-top ease-snappy transition-all">
          <svg
            className="absolute h-9 origin-top-left skew-x-[30deg] overflow-visible transform-gpu duration-300 -right-16 translate-x-1"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 128 32"
          >
            <line
              stroke="hsl(var(--background))"
              strokeWidth="2px"
              shapeRendering="optimizeQuality"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeMiterlimit="10"
              x1="1"
              y1="0"
              x2="128"
              y2="0"
            />
            <path
              stroke="hsl(var(--chat-border))"
              className="translate-y-[0.5px]"
              fill="hsl(var(--background))"
              shapeRendering="optimizeQuality"
              strokeWidth="1px"
              strokeLinecap="round"
              strokeMiterlimit="10"
              vectorEffect="non-scaling-stroke"
              d="M0,0c5.9,0,10.7,4.8,10.7,10.7v10.7c0,5.9,4.8,10.7,10.7,10.7H128V0"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}

export default ChatHeader


