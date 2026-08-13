import * as React from "react"

import { cn } from "@/lib/utils"

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The card is a target — it navigates, drills down, or opens something.
   * Nine screens had each written their own version of this hover, so the lift,
   * the border tint and the shadow are decided here instead.
   */
  interactive?: boolean
  /** Currently chosen out of a set. Reads as chosen without hiding the content. */
  selected?: boolean
  /** Present but not available. Also blocks pointer events. */
  disabled?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = false, selected = false, disabled = false, ...props }, ref) => (
    <div
      ref={ref}
      // Announced only when the state actually means something to a screen
      // reader; a decorative card should stay silent.
      aria-current={selected ? "true" : undefined}
      aria-disabled={disabled ? true : undefined}
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        interactive &&
          !disabled && [
            "cursor-pointer transition-all",
            "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
            "active-elevate-2",
            // Keyboard users get the same affordance as pointer users.
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          ],
        // Border and a tinted ground, not a fill: the card's own content must
        // stay as readable selected as it is unselected.
        selected && "border-primary ring-1 ring-primary/30 bg-primary-muted/40",
        disabled && "pointer-events-none opacity-60",
        className
      )}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1 p-4", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    // Start-aligned, like every other heading in the app. Centred titles were
    // the odd one out and broke the vertical reading line down a card column.
    className={cn("text-start font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-4 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
