import * as React from "react";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type LayeredTextareaProps = React.ComponentProps<"textarea"> & {
  placeholderClassName?: string;
};

const LayeredTextarea = React.forwardRef<HTMLTextAreaElement, LayeredTextareaProps>(
  (
    {
      className,
      placeholder,
      placeholderClassName,
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref,
  ) => {
    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
    const currentValue = isControlled ? value : internalValue;
    const hasValue = String(currentValue ?? "").length > 0;

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!isControlled) {
        setInternalValue(event.target.value);
      }
      onChange?.(event);
    };

    return (
      <div className="relative">
        {!hasValue && placeholder ? (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute z-0",
              placeholderClassName,
            )}
          >
            {placeholder}
          </span>
        ) : null}
        <Textarea
          {...props}
          ref={ref}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          placeholder=""
          className={cn("relative z-10", className)}
        />
      </div>
    );
  },
);

LayeredTextarea.displayName = "LayeredTextarea";

export { LayeredTextarea };
