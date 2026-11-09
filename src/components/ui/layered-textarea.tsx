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
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
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

    React.useLayoutEffect(() => {
      const textarea = textareaRef.current;
      if (!textarea || !String(currentValue ?? "")) return;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 64)}px`;
    }, [currentValue]);

    return (
      <div className="relative">
        {!hasValue && placeholder ? (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute z-0 translate-x-px translate-y-px",
              placeholderClassName,
            )}
          >
            {placeholder}
          </span>
        ) : null}
        <Textarea
          {...props}
          ref={(node) => {
            textareaRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
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
