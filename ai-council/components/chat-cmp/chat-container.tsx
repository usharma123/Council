"use client"

import React from 'react'

type ChatContainerProps = {
  children: React.ReactNode
}

// Presentational wrapper matching the t3 style
const ChatContainer: React.FC<ChatContainerProps> = ({ children }) => {
  return (
    <div
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
      className="mx-auto flex w-full max-w-3xl flex-col space-y-12 px-4 pb-[calc(100vh-25rem)] pt-10"
    >
      {children}
    </div>
  )
}

export default ChatContainer


