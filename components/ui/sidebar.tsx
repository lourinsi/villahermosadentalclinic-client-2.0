"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const SidebarContext = React.createContext<{
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
}>({
  collapsed: false,
  setCollapsed: () => {},
  toggleSidebar: () => {}
})

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false)
  
  const toggleSidebar = () => {
    setCollapsed(!collapsed)
  }
  
  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  )
}

export const useSidebar = () => {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider")
  }
  return context
}

export const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { collapsed } = useSidebar()
  
  return (
    <div
      ref={ref}
      className={cn(
        "flex h-full flex-col bg-white border-r border-gray-200 transition-all duration-300",
        collapsed ? "w-20" : "w-64",
        className
      )}
      {...props}
    />
  )
})
Sidebar.displayName = "Sidebar"

export const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("px-6 py-4 border-b border-gray-200", className)}
    {...props}
  />
))
SidebarHeader.displayName = "SidebarHeader"

export const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex-1 overflow-auto p-4", className)}
    {...props}
  />
))
SidebarContent.displayName = "SidebarContent"

export const SidebarMenu = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("space-y-1", className)}
    {...props}
  />
))
SidebarMenu.displayName = "SidebarMenu"

export const SidebarMenuItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("", className)}
    {...props}
  />
))
SidebarMenuItem.displayName = "SidebarMenuItem"

export const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    isActive?: boolean
  }
>(({ className, isActive, children, ...props }, ref) => {
  const { collapsed } = useSidebar()
  
  return (
    <button
      ref={ref}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-normal transition-colors hover:bg-gray-100",
        isActive && "bg-blue-50 text-blue-700 border-r-2 border-blue-700",
        collapsed && "justify-center px-2",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
})
SidebarMenuButton.displayName = "SidebarMenuButton"


