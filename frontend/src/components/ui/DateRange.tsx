import { Input } from "./Input";
import { dateInputOffset, monthStartInput, todayInput } from "@/lib/format";
import "./DateRange.css";

export interface DateRangeValue {
  from: string;
  to: string;
}

const presets: { label: string; range: () => DateRangeValue }[] = [
  { label: "Hari ini", range: () => ({ from: todayInput(), to: todayInput() }) },
  { label: "7 hari", range: () => ({ from: dateInputOffset(-6), to: todayInput() }) },
  { label: "30 hari", range: () => ({ from: dateInputOffset(-29), to: todayInput() }) },
  { label: "Bulan ini", range: () => ({ from: monthStartInput(), to: todayInput() }) },
];

export function DateRange({
  value,
  onChange,
}: {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
}) {
  return (
    <div className="date-range">
      <div className="date-range__presets">
        {presets.map((preset) => {
          const range = preset.range();
          const active = range.from === value.from && range.to === value.to;
          return (
            <button
              key={preset.label}
              type="button"
              className={["date-range__preset", active && "is-active"].filter(Boolean).join(" ")}
              onClick={() => onChange(range)}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className="date-range__inputs">
        <Input
          type="date"
          aria-label="Dari tanggal"
          className="date-range__date"
          value={value.from}
          max={value.to || undefined}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
        />
        <span className="date-range__sep" aria-hidden="true">
          –
        </span>
        <Input
          type="date"
          aria-label="Sampai tanggal"
          className="date-range__date"
          value={value.to}
          min={value.from || undefined}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
        />
      </div>
    </div>
  );
}
