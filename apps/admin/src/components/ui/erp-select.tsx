import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EMPTY_VALUE = "__empty__";

type SelectLikeEvent = {
  target: { value: string };
  currentTarget: { value: string };
};

type ERPSelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value" | "defaultValue"> & {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: SelectLikeEvent) => void;
};

type ERPSelectOptionProps = React.OptionHTMLAttributes<HTMLOptionElement> & {
  value?: string | number;
};

type ParsedOption = {
  key: React.Key;
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

function ERPSelect({ className, children, value, defaultValue, onChange, disabled, placeholder, ...props }: ERPSelectProps) {
  const options = React.useMemo(() => parseOptions(children), [children]);
  const selected = value ?? defaultValue ?? "";
  const selectedValue = toRadixValue(String(selected));
  const selectedOption = options.find((option) => option.value === String(selected));
  const fallbackLabel = placeholder ? String(placeholder) : "Pilih opsi";

  return (
    <Select
      value={selectedValue}
      disabled={disabled}
      onValueChange={(next) => {
        const normalized = fromRadixValue(next);
        onChange?.({ target: { value: normalized }, currentTarget: { value: normalized } });
      }}
    >
      <SelectTrigger className={cn("w-full bg-white", className)} aria-label={props["aria-label"]}>
        <SelectValue placeholder={fallbackLabel}>{selectedOption?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.key} value={toRadixValue(option.value)} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ERPSelectOption(_props: ERPSelectOptionProps) {
  return null;
}

function parseOptions(children: React.ReactNode): ParsedOption[] {
  const rows: ParsedOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<ERPSelectOptionProps>(child)) return;
    if (child.type === React.Fragment) {
      rows.push(...parseOptions(child.props.children));
      return;
    }
    const label = child.props.children;
    const textValue = childrenToText(label);
    rows.push({
      key: child.key ?? `${rows.length}-${textValue}`,
      value: String(child.props.value ?? textValue),
      label,
      disabled: child.props.disabled,
    });
  });
  return rows;
}

function childrenToText(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child) => (typeof child === "string" || typeof child === "number" ? String(child) : ""))
    .join("")
    .trim();
}

function toRadixValue(value: string) {
  return value === "" ? EMPTY_VALUE : value;
}

function fromRadixValue(value: string) {
  return value === EMPTY_VALUE ? "" : value;
}

export { ERPSelect, ERPSelectOption };
