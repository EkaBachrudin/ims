import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { CaretDown, Check, X } from "@phosphor-icons/react";
import "./Combobox.css";

export interface ComboboxOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  emptyText?: string;
  className?: string;
  "aria-label"?: string;
}

interface PanelRect {
  left: number;
  top: number;
  width: number;
  openUp: boolean;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Pilih...",
  searchable = false,
  searchPlaceholder = "Cari...",
  clearable = true,
  disabled = false,
  required = false,
  id,
  name,
  emptyText = "Tidak ada hasil",
  className = "",
  "aria-label": ariaLabel,
}: ComboboxProps) {
  const reactId = useId();
  const triggerId = id ?? `combobox-${reactId}`;
  const listboxId = `${triggerId}-listbox`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [rect, setRect] = useState<PanelRect | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const wasOpen = useRef(false);
  const typeBuffer = useRef("");
  const typeBufferAt = useRef(0);

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!searchable || !q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, searchable, query]);

  const firstEnabled = useCallback((list: ComboboxOption[]) => {
    const i = list.findIndex((o) => !o.disabled);
    return i === -1 ? 0 : i;
  }, []);

  const lastEnabled = useCallback((list: ComboboxOption[]) => {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (!list[i].disabled) return i;
    }
    return Math.max(0, list.length - 1);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panelHeight = panelRef.current?.offsetHeight ?? 288;
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < panelHeight + 8 && r.top > spaceBelow;
    setRect({ left: r.left, top: openUp ? r.top : r.bottom + 4, width: r.width, openUp });
  }, []);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setQuery("");
      const idx = options.findIndex((o) => o.value === value && !o.disabled);
      setActiveIndex(idx >= 0 ? idx : firstEnabled(options));
    }
    wasOpen.current = open;
  }, [open, options, value, firstEnabled]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex((i) => (filtered[i] && !filtered[i].disabled ? i : firstEnabled(filtered)));
  }, [filtered, open, firstEnabled]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const frame = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    if (searchable) {
      const t = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    triggerRef.current?.focus();
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function move(dir: 1 | -1) {
    if (filtered.length === 0) return;
    let i = activeIndex;
    for (let step = 0; step < filtered.length; step += 1) {
      i = (i + dir + filtered.length) % filtered.length;
      if (!filtered[i].disabled) {
        setActiveIndex(i);
        return;
      }
    }
  }

  function selectActive() {
    const opt = filtered[activeIndex];
    if (opt && !opt.disabled) {
      onChange(opt.value);
      close();
    }
  }

  function handleKeyDown(e: ReactKeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(firstEnabled(filtered));
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(lastEnabled(filtered));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      selectActive();
      return;
    }
    if (!searchable && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now();
      typeBuffer.current = now - typeBufferAt.current > 800 ? e.key.toLowerCase() : typeBuffer.current + e.key.toLowerCase();
      typeBufferAt.current = now;
      const idx = filtered.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(typeBuffer.current));
      if (idx >= 0) setActiveIndex(idx);
    }
  }

  function handleTriggerKeyDown(e: ReactKeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    handleKeyDown(e);
  }

  function handleSearchChange(next: string) {
    setQuery(next);
    const q = next.trim().toLowerCase();
    const list = !q ? options : options.filter((o) => o.label.toLowerCase().includes(q));
    setActiveIndex(firstEnabled(list));
  }

  const showClear = clearable && value !== "" && !disabled;

  return (
    <div className={["combobox", className].filter(Boolean).join(" ")}>
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        aria-activedescendant={
          open && !searchable && filtered[activeIndex] ? `${listboxId}-opt-${activeIndex}` : undefined
        }
        disabled={disabled}
        className={["combobox__trigger", showClear && "combobox__trigger--clearable"].filter(Boolean).join(" ")}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={["combobox__value", !selected && "combobox__value--placeholder"].filter(Boolean).join(" ")}>
          {selected ? selected.label : placeholder}
        </span>
      </button>

      <CaretDown size={14} className="combobox__caret" aria-hidden="true" />

      {showClear && (
        <button
          type="button"
          className="combobox__clear"
          aria-label="Bersihkan pilihan"
          onClick={() => {
            onChange("");
            triggerRef.current?.focus();
          }}
        >
          <X size={13} weight="bold" />
        </button>
      )}

      {name && <input type="hidden" name={name} value={value} />}

      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            className={["combobox__panel", rect.openUp && "combobox__panel--up"].filter(Boolean).join(" ")}
            style={{ position: "fixed", left: rect.left, top: rect.top, width: rect.width }}
            onKeyDown={handleKeyDown}
          >
            {searchable && (
              <div className="combobox__search-wrap">
                <input
                  ref={searchRef}
                  className="combobox__search"
                  value={query}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  aria-controls={listboxId}
                  aria-activedescendant={
                    filtered[activeIndex] ? `${listboxId}-opt-${activeIndex}` : undefined
                  }
                  autoComplete="off"
                />
              </div>
            )}

            <ul ref={listRef} id={listboxId} role="listbox" className="combobox__list" aria-labelledby={triggerId}>
              {filtered.length === 0 && <li className="combobox__empty">{emptyText}</li>}
              {filtered.map((opt, i) => (
                <li
                  key={opt.value}
                  id={`${listboxId}-opt-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={opt.value === value}
                  aria-disabled={opt.disabled || undefined}
                  className={[
                    "combobox__option",
                    i === activeIndex && "is-active",
                    opt.value === value && "is-selected",
                    opt.disabled && "is-disabled",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseEnter={() => !opt.disabled && setActiveIndex(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (opt.disabled) return;
                    onChange(opt.value);
                    close();
                  }}
                >
                  <span className="combobox__option-label">{opt.label}</span>
                  {opt.value === value && <Check size={14} weight="bold" className="combobox__check" />}
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}
