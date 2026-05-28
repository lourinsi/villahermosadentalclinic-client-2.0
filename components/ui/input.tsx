import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, ...props }, ref) => {
    return (
      <div className="relative">
        {icon && <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">{icon}</div>}
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50",
            icon ? "pl-10" : "",
            className
          )}
          ref={ref}
          {...props}
        />
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
