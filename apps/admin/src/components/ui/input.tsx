import * as React from "react"

import { cn } from "@/lib/utils"
import { Calendar as CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

function Input({ className, type, value, onChange, placeholder, disabled, min, max, name, required, ...props }: React.ComponentProps<"input">) {
  const [open, setOpen] = React.useState(false)
  if (type === "date") {
    const stringValue = typeof value === "string" ? value : ""
    const selected = stringValue ? new Date(`${stringValue}T00:00:00`) : undefined
    return (
      <>
        {name && <input type="hidden" name={name} value={stringValue} required={required} readOnly />}
        <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" disabled={disabled} className={cn("h-9 w-full justify-between rounded-md px-3 text-left font-normal", !stringValue && "text-muted-foreground", className)}>
            <span>{stringValue || placeholder || "Pilih tanggal"}</span>
            <CalendarIcon className="size-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            disabled={(date) => Boolean((min && date < new Date(`${min}T00:00:00`)) || (max && date > new Date(`${max}T23:59:59`)))}
            onSelect={(date) => {
              const next = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : ""
              onChange?.({ target: { value: next } } as React.ChangeEvent<HTMLInputElement>)
              setOpen(false)
            }}
            initialFocus
          />
        </PopoverContent>
        </Popover>
      </>
    )
  }
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      {...props}
    />
  )
}

export { Input }
