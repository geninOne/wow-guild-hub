import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}

const MARGIN = 8;

/** Platziert den Tooltip neben, sonst unter oder über dem Auslöser, immer im Fenster. */
function placeTooltip(trigger: DOMRect, width: number, height: number): { left: number; top: number } {
  const vw = document.documentElement.clientWidth || window.innerWidth;
  const vh = window.innerHeight;
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));

  const right = trigger.right + MARGIN;
  if (right + width <= vw - MARGIN) {
    return { left: right, top: clamp(trigger.top, MARGIN, vh - height - MARGIN) };
  }
  const left = trigger.left - MARGIN - width;
  if (left >= MARGIN) {
    return { left, top: clamp(trigger.top, MARGIN, vh - height - MARGIN) };
  }
  const x = clamp(trigger.left, MARGIN, vw - width - MARGIN);
  const below = trigger.bottom + MARGIN;
  const top = below + height <= vh - MARGIN ? below : trigger.top - MARGIN - height;
  return { left: x, top: clamp(top, MARGIN, vh - height - MARGIN) };
}

/**
 * Zeigt `content` bei Hover (Maus), Tastaturfokus und Tippen (Touch).
 * Die Kinder werden in ein fokussierbares Element gelegt.
 */
export function Tooltip({ content, children, className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<string | null>(null);
  const id = useId();

  const close = useCallback(() => {
    setOpen(false);
    setPosition(null);
  }, []);

  const update = useCallback(() => {
    const trigger = triggerRef.current;
    const tip = tipRef.current;
    if (!trigger || !tip) return;
    setPosition(placeTooltip(trigger.getBoundingClientRect(), tip.offsetWidth, tip.offsetHeight));
  }, []);

  useLayoutEffect(() => {
    if (open) update();
  }, [open, update]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !tipRef.current?.contains(target)) close();
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    document.addEventListener("pointerdown", onOutside);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      document.removeEventListener("pointerdown", onOutside);
    };
  }, [open, update, close]);

  const style: CSSProperties = position
    ? { left: position.left, top: position.top }
    : { left: 0, top: 0, visibility: "hidden" };

  return (
    <>
      <span
        ref={triggerRef}
        className={className ? `tooltip-trigger ${className}` : "tooltip-trigger"}
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onPointerDown={(e) => {
          pointerRef.current = e.pointerType;
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") setOpen(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") close();
        }}
        onFocus={() => {
          // Fokus durch Antippen übernimmt der Klick, sonst öffnet und schließt es gleich wieder.
          if (pointerRef.current === null) setOpen(true);
        }}
        onBlur={() => {
          pointerRef.current = null;
          close();
        }}
        onClick={() => {
          const pointer = pointerRef.current;
          pointerRef.current = null;
          if (pointer === "touch" || pointer === "pen") {
            if (open) close();
            else setOpen(true);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
      >
        {children}
      </span>
      {open &&
        createPortal(
          <div ref={tipRef} id={id} role="tooltip" className="tooltip" style={style}>
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
