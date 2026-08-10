import React, {
  useMemo,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import dayjs from "dayjs";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Plus,
  Printer,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ScheduleItem, ScheduleItemPayload } from "@/lib/schedule-api";
import { useLanguage } from "@/context/LanguageContext";
import { ERPSelect, ERPSelectOption } from "@/components/ui/erp-select";

export type ScheduleView = "month" | "week" | "day" | "list";

const HOUR_HEIGHT = 60;
const START_HOUR = 0;
const END_HOUR = 24;
const TOTAL_HOURS = END_HOUR - START_HOUR;

function itemTime(item: ScheduleItem, t?: (key: string) => string) {
  if (item.all_day) return t ? t("schedule.all_day") : "Seharian";
  return `${dayjs(item.start_time).format("HH:mm")} – ${dayjs(
    item.end_time
  ).format("HH:mm")}`;
}

function moveItemToDateTime(
  item: ScheduleItem,
  targetDate: dayjs.Dayjs,
  targetHour: number,
  targetMinute: number
): ScheduleItemPayload {
  const start = dayjs(item.start_time);
  const end = dayjs(item.end_time);
  const duration = Math.max(end.diff(start, "minute"), 15);
  const nextStart = targetDate
    .hour(targetHour)
    .minute(targetMinute)
    .second(0)
    .millisecond(0);
  const nextEnd = nextStart.add(duration, "minute");
  return {
    title: item.title,
    description: item.description || "",
    start_time: nextStart.toISOString(),
    end_time: nextEnd.toISOString(),
    all_day: item.all_day,
    color: item.color,
    resource_type: item.resource_type || "",
    resource_id: item.resource_id || null,
  };
}

function resizeItem(
  item: ScheduleItem,
  newEndHour: number,
  newEndMinute: number
): ScheduleItemPayload {
  const start = dayjs(item.start_time);
  const newEnd = start
    .hour(newEndHour)
    .minute(newEndMinute)
    .second(0)
    .millisecond(0);
  const minEnd = start.add(15, "minute");
  const finalEnd = newEnd.isBefore(minEnd) ? minEnd : newEnd;
  return {
    title: item.title,
    description: item.description || "",
    start_time: start.toISOString(),
    end_time: finalEnd.toISOString(),
    all_day: item.all_day,
    color: item.color,
    resource_type: item.resource_type || "",
    resource_id: item.resource_id || null,
  };
}

function snapToGrid(minutes: number, step = 15) {
  return Math.round(minutes / step) * step;
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(
        result[3],
        16
      )}`
    : "37, 99, 235";
}

// ─── Print Preview Modal ──────────────────────────────────────────────────────
type PrintOrientation = "portrait" | "landscape";
type PrintView = "week" | "day" | "month";
type PrintFontSize = "small" | "normal" | "large";
type PrintColorStyle = "color" | "outline" | "bw";

function PrintPreviewModal({
  items,
  currentDate,
  defaultView,
  onClose,
}: {
  items: ScheduleItem[];
  currentDate: Date;
  defaultView: ScheduleView;
  onClose: () => void;
}) {
  const base = dayjs(currentDate);
  const [orientation, setOrientation] = useState<PrintOrientation>("portrait");
  const [printView, setPrintView] = useState<PrintView>(
    defaultView === "list" ? "week" : (defaultView as PrintView)
  );
  const [fontSize, setFontSize] = useState<PrintFontSize>("normal");
  const [colorStyle, setColorStyle] = useState<PrintColorStyle>("outline");
  const [showWeekends, setShowWeekends] = useState(true);
  const [showDeclined, setShowDeclined] = useState(false);

  const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const HOURS_LABELS = Array.from({ length: 23 }, (_, i) => {
    const h = i + 1;
    return h < 12 ? `${h} am` : h === 12 ? "12 pm" : `${h - 12} pm`;
  });

  // Compute date range label
  const rangeLabel = useMemo(() => {
    if (printView === "day") return base.format("D MMM YYYY");
    if (printView === "week") {
      const s = base.startOf("week");
      const e = base.endOf("week");
      return `${s.format("D MMM")} – ${e.format("D MMM YYYY")}`;
    }
    return base.format("MMMM YYYY");
  }, [base, printView]);

  // Column dates for week/day preview
  const columnDates = useMemo(() => {
    if (printView === "day") return [base];
    const start = base.startOf("week");
    const all = Array.from({ length: 7 }, (_, i) => start.add(i, "day"));
    return showWeekends ? all : all.slice(1, 6);
  }, [base, printView, showWeekends]);

  // Items filtered for current range
  const rangeItems = useMemo(() => {
    return items.filter((item) => {
      const d = dayjs(item.start_time);
      if (printView === "day") return d.isSame(base, "day");
      if (printView === "week") {
        const s = base.startOf("week");
        const e = base.endOf("week");
        return (
          (d.isAfter(s) || d.isSame(s, "day")) &&
          (d.isBefore(e) || d.isSame(e, "day"))
        );
      }
      return d.isSame(base, "month");
    });
  }, [items, base, printView]);

  const fontSizePx = fontSize === "small" ? 7 : fontSize === "large" ? 10 : 8.5;

  // Build printable HTML and open print window
  const handlePrint = useCallback(() => {
    const colCount = columnDates.length;
    const timeColW = 44;
    const colW = `calc((100% - ${timeColW}px) / ${colCount})`;

    const eventsHtml = columnDates
      .map((date, di) => {
        const dayItems = rangeItems.filter(
          (item) => !item.all_day && dayjs(item.start_time).isSame(date, "day")
        );
        const evHtml = dayItems
          .map((item) => {
            const startH =
              dayjs(item.start_time).hour() +
              dayjs(item.start_time).minute() / 60;
            const endH =
              dayjs(item.end_time).hour() + dayjs(item.end_time).minute() / 60;
            const topPct = ((startH - 0) / 24) * 100;
            const heightPct = Math.max(((endH - startH) / 24) * 100, 1.5);
            const color =
              colorStyle === "bw" ? "#555" : item.color || "#4285f4";
            const bg = colorStyle === "color" ? color : `${color}22`;
            const textColor = colorStyle === "color" ? "#fff" : color;
            return `<div style="position:absolute;top:${topPct.toFixed(
              2
            )}%;height:${heightPct.toFixed(
              2
            )}%;left:2px;right:2px;background:${bg};border-left:2px solid ${color};border-radius:2px;padding:1px 3px;overflow:hidden;">
            <div style="font-size:${
              fontSizePx - 1
            }px;font-weight:bold;color:${textColor};white-space:nowrap;overflow:hidden;">${
              item.title
            }</div>
            <div style="font-size:${
              fontSizePx - 2
            }px;color:${textColor};opacity:0.8;">${dayjs(
              item.start_time
            ).format("HH:mm")}–${dayjs(item.end_time).format("HH:mm")}</div>
          </div>`;
          })
          .join("");
        return `<div style="position:relative;border-left:0.5px solid #e0e0e0;height:100%;grid-column:${
          di + 2
        };">
        ${HOURS_LABELS.map(
          () =>
            `<div style="height:${
              100 / 23
            }%;border-bottom:0.5px solid #f0f0f0;"></div>`
        ).join("")}
        ${evHtml}
      </div>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Kalender – ${rangeLabel}</title>
<style>
  @page { size: A4 ${orientation}; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; font-family: Arial, sans-serif; background: #fff; font-size: ${fontSizePx}px; }
  .page { width: 100%; height: 100vh; display: flex; flex-direction: column; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; padding: 0 0 6px 0; border-bottom: 1.5px solid #4285f4; margin-bottom: 6px; }
  .header-title { font-size: ${
    fontSizePx + 4
  }px; font-weight: bold; color: #4285f4; }
  .header-range { font-size: ${
    fontSizePx - 1
  }px; color: #666; text-align: right; line-height: 1.5; }
  .day-headers { display: grid; grid-template-columns: ${timeColW}px repeat(${colCount}, 1fr); border-bottom: 0.5px solid #ccc; margin-bottom: 0; }
  .day-hdr { font-size: ${fontSizePx}px; font-weight: bold; text-align: center; padding: 3px 0; color: #555; }
  .day-hdr.today { color: #4285f4; }
  .grid-wrap { flex: 1; overflow: hidden; display: grid; grid-template-columns: ${timeColW}px repeat(${colCount}, 1fr); }
  .time-col { display: flex; flex-direction: column; border-right: 0.5px solid #ddd; }
  .time-label { flex: 1; font-size: ${
    fontSizePx - 2
  }px; color: #aaa; text-align: right; padding-right: 4px; display: flex; align-items: flex-start; padding-top: 2px; }
  .day-col { position: relative; border-left: 0.5px solid #e8e8e8; height: 100%; display: flex; flex-direction: column; }
  .hour-row { flex: 1; border-bottom: 0.5px solid #f0f0f0; }
  .hour-row.half { border-bottom: 0.5px dashed #f5f5f5; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-title">Kalender</div>
    <div class="header-range">${rangeLabel}<br><span style="font-size:${
      fontSizePx - 2
    }px;color:#999">Western Indonesia Time – Jakarta</span></div>
  </div>
  <div class="day-headers">
    <div></div>
    ${columnDates
      .map((d) => {
        const isToday = d.isSame(dayjs(), "day");
        return `<div class="day-hdr${isToday ? " today" : ""}">${
          DAY_HEADERS[d.day()]
        } ${d.format("M/D")}</div>`;
      })
      .join("")}
  </div>
  <div class="grid-wrap">
    <div class="time-col">
      ${HOURS_LABELS.map((h) => `<div class="time-label">${h}</div>`).join("")}
    </div>
    ${columnDates
      .map((date) => {
        const dayItems = rangeItems.filter(
          (item) => !item.all_day && dayjs(item.start_time).isSame(date, "day")
        );
        const evHtml = dayItems
          .map((item) => {
            const startH =
              dayjs(item.start_time).hour() +
              dayjs(item.start_time).minute() / 60;
            const endH =
              dayjs(item.end_time).hour() + dayjs(item.end_time).minute() / 60;
            const topPct = (startH / 24) * 100;
            const heightPct = Math.max(((endH - startH) / 24) * 100, 2);
            const color =
              colorStyle === "bw" ? "#555" : item.color || "#4285f4";
            const bg = colorStyle === "color" ? color : `${color}22`;
            const textColor = colorStyle === "color" ? "#fff" : color;
            return `<div style="position:absolute;top:${topPct.toFixed(
              2
            )}%;height:${heightPct.toFixed(
              2
            )}%;left:2px;right:2px;background:${bg};border-left:2px solid ${color};border-radius:2px;padding:1px 3px;overflow:hidden;">
          <div style="font-size:${
            fontSizePx - 1
          }px;font-weight:bold;color:${textColor};white-space:nowrap;overflow:hidden;">${
              item.title
            }</div>
          <div style="font-size:${
            fontSizePx - 2
          }px;color:${textColor};opacity:0.8;">${dayjs(item.start_time).format(
              "HH:mm"
            )}–${dayjs(item.end_time).format("HH:mm")}</div>
        </div>`;
          })
          .join("");
        return `<div class="day-col">
        ${HOURS_LABELS.map(() => `<div class="hour-row"></div>`).join("")}
        ${evHtml}
      </div>`;
      })
      .join("")}
  </div>
</div>
<script>window.print(); window.onafterprint = () => window.close();<\/script>
</body>
</html>`;

    const w = window.open("", "_blank", "width=960,height=720");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }, [
    columnDates,
    rangeItems,
    orientation,
    rangeLabel,
    colorStyle,
    fontSizePx,
  ]);

  // Mini paper preview
  const isLandscape = orientation === "landscape";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex overflow-hidden rounded-xl shadow-2xl"
        style={{
          background: "#2a2a2a",
          color: "#e8e8e8",
          minHeight: 480,
          width: 620,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Sidebar ── */}
        <div
          className="flex flex-col gap-4 p-6"
          style={{
            width: 230,
            borderRight: "0.5px solid rgba(255,255,255,0.1)",
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">
              Print preview
            </h2>
            <button
              onClick={onClose}
              className="rounded p-1 text-slate-400 hover:text-white hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <Field label="View">
            <Select
              value={printView}
              onChange={(v) => setPrintView(v as PrintView)}
            >
              <ERPSelectOption value="week">Week</ERPSelectOption>
              <ERPSelectOption value="day">Day</ERPSelectOption>
              <ERPSelectOption value="month">Month</ERPSelectOption>
            </Select>
          </Field>

          <Field label="Font size">
            <Select
              value={fontSize}
              onChange={(v) => setFontSize(v as PrintFontSize)}
            >
              <ERPSelectOption value="small">Small</ERPSelectOption>
              <ERPSelectOption value="normal">Normal</ERPSelectOption>
              <ERPSelectOption value="large">Large</ERPSelectOption>
            </Select>
          </Field>

          <Field label="Orientation">
            <Select
              value={orientation}
              onChange={(v) => setOrientation(v as PrintOrientation)}
            >
              <ERPSelectOption value="portrait">Portrait</ERPSelectOption>
              <ERPSelectOption value="landscape">Landscape</ERPSelectOption>
            </Select>
          </Field>

          <Field label="Color & style">
            <Select
              value={colorStyle}
              onChange={(v) => setColorStyle(v as PrintColorStyle)}
            >
              <ERPSelectOption value="outline">Outline</ERPSelectOption>
              <ERPSelectOption value="color">Color</ERPSelectOption>
              <ERPSelectOption value="bw">Black & white</ERPSelectOption>
            </Select>
          </Field>

          <label
            className="flex cursor-pointer items-center gap-2 text-sm"
            style={{ color: "#ccc" }}
          >
            <input
              type="checkbox"
              checked={showWeekends}
              onChange={(e) => setShowWeekends(e.target.checked)}
              className="accent-blue-500"
            />
            Show weekends
          </label>
          <div className="mt-auto flex justify-end gap-2 pt-4">
            <button
              onClick={onClose}
              className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors hover:bg-white/10"
              style={{ color: "#7ab3f7" }}
            >
              Cancel
            </button>
            <button
              onClick={handlePrint}
              className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors hover:bg-blue-500/20"
              style={{ color: "#7ab3f7" }}
            >
              Print
            </button>
          </div>
        </div>

        {/* ── Preview pane ── */}
        <div
          className="flex flex-1 items-center justify-center"
          style={{ background: "#555", padding: 24 }}
        >
          <MiniPaperPreview
            isLandscape={isLandscape}
            columnDates={columnDates}
            rangeItems={rangeItems}
            rangeLabel={rangeLabel}
            printView={printView}
            colorStyle={colorStyle}
            base={base}
          />
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium" style={{ color: "#aaa" }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <ERPSelect
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: "#3a3a3a",
        border: "0.5px solid rgba(255,255,255,0.15)",
        borderRadius: 6,
        color: "#e8e8e8",
        fontSize: 13,
        padding: "7px 28px 7px 10px",
        width: "100%",
        cursor: "pointer",
        appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23aaa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 8px center",
      }}
    >
      {children}
    </ERPSelect>
  );
}

function MiniPaperPreview({
  isLandscape,
  columnDates,
  rangeItems,
  rangeLabel,
  printView,
  colorStyle,
  base,
}: {
  isLandscape: boolean;
  columnDates: dayjs.Dayjs[];
  rangeItems: ScheduleItem[];
  rangeLabel: string;
  printView: PrintView;
  colorStyle: PrintColorStyle;
  base: dayjs.Dayjs;
}) {
  const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const HOURS_SHORT = [
    "1a",
    "2a",
    "3a",
    "4a",
    "5a",
    "6a",
    "7a",
    "8a",
    "9a",
    "10a",
    "11a",
    "12p",
    "1p",
    "2p",
    "3p",
    "4p",
    "5p",
    "6p",
    "7p",
    "8p",
    "9p",
    "10p",
    "11p",
  ];
  const paperStyle: React.CSSProperties = isLandscape
    ? { width: 300, height: 212, maxWidth: "100%" }
    : { width: 210, height: 297, maxWidth: "100%" };

  return (
    <div
      style={{
        ...paperStyle,
        background: "#fff",
        borderRadius: 2,
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "4px 6px 3px",
          borderBottom: "1px solid #4285f4",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 6, fontWeight: "bold", color: "#4285f4" }}>
          Kalender
        </span>
        <span style={{ fontSize: 4, color: "#666", textAlign: "right" }}>
          {rangeLabel}
        </span>
      </div>

      {/* Day headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `16px repeat(${columnDates.length}, 1fr)`,
          borderBottom: "0.5px solid #ddd",
          flexShrink: 0,
        }}
      >
        <div />
        {columnDates.map((d) => (
          <div
            key={d.toISOString()}
            style={{
              fontSize: 4,
              textAlign: "center",
              padding: "2px 0",
              color: d.isSame(dayjs(), "day") ? "#4285f4" : "#888",
              fontWeight: "bold",
            }}
          >
            {DAY_HEADERS[d.day()]} {d.format("M/D")}
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: `16px repeat(${columnDates.length}, 1fr)`,
          overflow: "hidden",
        }}
      >
        {/* Time labels */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {HOURS_SHORT.map((h) => (
            <div
              key={h}
              style={{
                flex: 1,
                fontSize: 3,
                color: "#bbb",
                textAlign: "right",
                paddingRight: 2,
                display: "flex",
                alignItems: "flex-start",
                paddingTop: 1,
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {columnDates.map((date) => {
          const dayItems = rangeItems.filter(
            (item) =>
              !item.all_day && dayjs(item.start_time).isSame(date, "day")
          );
          return (
            <div
              key={date.toISOString()}
              style={{
                borderLeft: "0.5px solid #eee",
                position: "relative",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {HOURS_SHORT.map((h) => (
                <div
                  key={h}
                  style={{ flex: 1, borderBottom: "0.5px solid #f5f5f5" }}
                />
              ))}
              {dayItems.map((item) => {
                const startH =
                  dayjs(item.start_time).hour() +
                  dayjs(item.start_time).minute() / 60;
                const endH =
                  dayjs(item.end_time).hour() +
                  dayjs(item.end_time).minute() / 60;
                const topPct = (startH / 24) * 100;
                const heightPct = Math.max(((endH - startH) / 24) * 100, 3);
                const color =
                  colorStyle === "bw" ? "#555" : item.color || "#4285f4";
                const bg = colorStyle === "color" ? color : `${color}22`;
                const textColor = colorStyle === "color" ? "#fff" : color;
                return (
                  <div
                    key={item.id}
                    style={{
                      position: "absolute",
                      top: `${topPct}%`,
                      height: `${heightPct}%`,
                      left: 1,
                      right: 1,
                      background: bg,
                      borderLeft: `1.5px solid ${color}`,
                      borderRadius: 1,
                      padding: "1px 2px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 3,
                        fontWeight: "bold",
                        color: textColor,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                      }}
                    >
                      {item.title}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Time Grid Event Block ────────────────────────────────────────────────────
function TimeGridEvent({
  item,
  dayStart,
  columnIndex,
  totalColumns,
  editable,
  isDragging,
  isResizing,
  onClick,
  onDragStart,
  onResizeStart,
}: {
  item: ScheduleItem;
  dayStart: dayjs.Dayjs;
  columnIndex: number;
  totalColumns: number;
  editable?: boolean;
  isDragging?: boolean;
  isResizing?: boolean;
  onClick: () => void;
  onDragStart: (e: React.MouseEvent, item: ScheduleItem) => void;
  onResizeStart: (e: React.MouseEvent, item: ScheduleItem) => void;
}) {
  const { t } = useLanguage();
  const start = dayjs(item.start_time);
  const end = dayjs(item.end_time);
  const startMinutes = (start.hour() - START_HOUR) * 60 + start.minute();
  const durationMinutes = Math.max(end.diff(start, "minute"), 15);

  const top = (startMinutes / 60) * HOUR_HEIGHT;
  const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 22);

  const colWidth = 100 / totalColumns;
  const left = columnIndex * colWidth;
  const width = colWidth - 0.5;

  const isShort = height < 40;
  const rgb = hexToRgb(item.color || "#2563eb");

  return (
    <div
      className={cn(
        "absolute rounded-lg border-l-2 cursor-pointer select-none overflow-hidden transition-shadow",
        isDragging || isResizing
          ? "opacity-70 shadow-xl z-50 ring-2 ring-white"
          : "z-10 hover:z-20 hover:shadow-md"
      )}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `${left}%`,
        width: `${width}%`,
        backgroundColor: `rgba(${rgb}, 0.15)`,
        borderLeftColor: item.color || "#2563eb",
      }}
      onMouseDown={(e) => {
        if (!editable) {
          onClick();
          return;
        }
        if ((e.target as HTMLElement).dataset.resize) return;
        if (e.button === 0) onDragStart(e, item);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div className="px-1.5 py-0.5 h-full flex flex-col">
        <p
          className={cn(
            "font-semibold leading-tight truncate",
            isShort ? "text-[10px]" : "text-xs"
          )}
          style={{ color: item.color || "#2563eb" }}
        >
          {item.title}
        </p>
        {!isShort && (
          <p
            className="text-[10px] leading-tight truncate"
            style={{ color: `rgba(${rgb}, 0.7)` }}
          >
            {itemTime(item, t)}
          </p>
        )}
      </div>
      {editable && (
        <div
          data-resize="true"
          className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize rounded-b-lg hover:bg-black/10"
          onMouseDown={(e) => {
            e.stopPropagation();
            onResizeStart(e, item);
          }}
        />
      )}
    </div>
  );
}

// ─── Time Grid Column ─────────────────────────────────────────────────────────
function TimeGridColumn({
  date,
  items,
  editable,
  draggingItem,
  resizingItem,
  ghostMinutes,
  onItemClick,
  onDragStart,
  onResizeStart,
  onColumnClick,
}: {
  date: dayjs.Dayjs;
  items: ScheduleItem[];
  editable?: boolean;
  draggingItem: ScheduleItem | null;
  resizingItem: ScheduleItem | null;
  ghostMinutes: { start: number; end: number } | null;
  onItemClick: (item: ScheduleItem) => void;
  onDragStart: (e: React.MouseEvent, item: ScheduleItem) => void;
  onResizeStart: (e: React.MouseEvent, item: ScheduleItem) => void;
  onColumnClick: (date: dayjs.Dayjs, hour: number, minute: number) => void;
}) {
  const positioned = useMemo(() => {
    const sorted = [...items].sort(
      (a, b) => dayjs(a.start_time).valueOf() - dayjs(b.start_time).valueOf()
    );
    const columns: ScheduleItem[][] = [];
    for (const item of sorted) {
      const start = dayjs(item.start_time).valueOf();
      let placed = false;
      for (const col of columns) {
        const last = col[col.length - 1];
        if (dayjs(last.end_time).valueOf() <= start) {
          col.push(item);
          placed = true;
          break;
        }
      }
      if (!placed) columns.push([item]);
    }
    const map = new Map<string, { col: number; total: number }>();
    columns.forEach((col, ci) =>
      col.forEach((item) =>
        map.set(item.id, { col: ci, total: columns.length })
      )
    );
    return map;
  }, [items]);

  const handleColumnMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editable) return;
    if ((e.target as HTMLElement).closest("[data-event]")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalMinutes = snapToGrid((y / HOUR_HEIGHT) * 60 + START_HOUR * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    onColumnClick(date, h, m);
  };

  return (
    <div
      className="relative flex-1 border-r border-slate-100 last:border-r-0"
      style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}
      onMouseDown={handleColumnMouseDown}
    >
      {Array.from({ length: TOTAL_HOURS }, (_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-t border-slate-100"
          style={{ top: `${i * HOUR_HEIGHT}px` }}
        />
      ))}
      {Array.from({ length: TOTAL_HOURS }, (_, i) => (
        <div
          key={`half-${i}`}
          className="absolute left-0 right-0 border-t border-dashed border-slate-50"
          style={{ top: `${i * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }}
        />
      ))}
      {items.map((item) => {
        const pos = positioned.get(item.id) || { col: 0, total: 1 };
        return (
          <div key={item.id} data-event="true">
            <TimeGridEvent
              item={item}
              dayStart={date}
              columnIndex={pos.col}
              totalColumns={pos.total}
              editable={editable}
              isDragging={draggingItem?.id === item.id}
              isResizing={resizingItem?.id === item.id}
              onClick={() => onItemClick(item)}
              onDragStart={onDragStart}
              onResizeStart={onResizeStart}
            />
          </div>
        );
      })}
      {ghostMinutes && (draggingItem || resizingItem) && (
        <div
          className="absolute left-0 right-0 rounded-lg border-2 border-dashed border-blue-400 bg-blue-100/50 z-40 pointer-events-none"
          style={{
            top: `${(ghostMinutes.start / 60) * HOUR_HEIGHT}px`,
            height: `${Math.max(
              ((ghostMinutes.end - ghostMinutes.start) / 60) * HOUR_HEIGHT,
              22
            )}px`,
          }}
        />
      )}
      {date.isSame(dayjs(), "day") && <CurrentTimeLine />}
    </div>
  );
}

function CurrentTimeLine() {
  const [now, setNow] = useState(dayjs());
  useEffect(() => {
    const t = setInterval(() => setNow(dayjs()), 60000);
    return () => clearInterval(t);
  }, []);
  const minutes = (now.hour() - START_HOUR) * 60 + now.minute();
  const top = (minutes / 60) * HOUR_HEIGHT;
  return (
    <div
      className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
      style={{ top: `${top}px` }}
    >
      <div className="h-2.5 w-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0" />
      <div className="flex-1 h-px bg-red-500" />
    </div>
  );
}

// ─── Main Calendar ─────────────────────────────────────────────────────────────
export default function ScheduleCalendar({
  items,
  view,
  currentDate,
  editable,
  loading,
  onViewChange,
  onDateChange,
  onItemClick,
  onItemMove,
  onCreateItem,
}: {
  items: ScheduleItem[];
  view: ScheduleView;
  currentDate: Date;
  editable?: boolean;
  loading?: boolean;
  onViewChange: (view: ScheduleView) => void;
  onDateChange: (date: Date) => void;
  onItemClick: (item: ScheduleItem) => void;
  onItemMove?: (
    item: ScheduleItem,
    payload: ScheduleItemPayload
  ) => Promise<void> | void;
  onCreateItem?: (date?: Date) => void;
}) {
  const { t } = useLanguage();
  const base = dayjs(currentDate);

  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const [draggingItem, setDraggingItem] = useState<ScheduleItem | null>(null);
  const [resizingItem, setResizingItem] = useState<ScheduleItem | null>(null);
  const [ghostMinutes, setGhostMinutes] = useState<{
    start: number;
    end: number;
    date: dayjs.Dayjs;
  } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) => dayjs(a.start_time).valueOf() - dayjs(b.start_time).valueOf()
      ),
    [items]
  );

  const getGridInfo = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left - 56;
    const relY = e.clientY - rect.top;
    return { relX, relY, width: rect.width - 56, height: rect.height };
  }, []);

  const weekDays = useMemo(() => {
    const start = base.startOf("week");
    return Array.from({ length: 7 }, (_, i) => start.add(i, "day"));
  }, [base]);

  const columnDates = view === "day" ? [base] : weekDays;

  const getColumnDate = useCallback(
    (relX: number, totalWidth: number) => {
      const cols = columnDates.length;
      const colIndex = Math.min(
        cols - 1,
        Math.max(0, Math.floor((relX / totalWidth) * cols))
      );
      return { date: columnDates[colIndex], colIndex };
    },
    [columnDates]
  );

  const handleDragStart = useCallback(
    (e: React.MouseEvent, item: ScheduleItem) => {
      e.preventDefault();
      e.stopPropagation();
      const info = getGridInfo(e);
      if (!info) return;
      const eventTopMin =
        (dayjs(item.start_time).hour() - START_HOUR) * 60 +
        dayjs(item.start_time).minute();
      const clickedMin = (info.relY / HOUR_HEIGHT) * 60 + START_HOUR * 60;
      setDragOffset(Math.max(0, clickedMin - eventTopMin));
      setDraggingItem(item);
      const startMin =
        (dayjs(item.start_time).hour() - START_HOUR) * 60 +
        dayjs(item.start_time).minute();
      const endMin =
        (dayjs(item.end_time).hour() - START_HOUR) * 60 +
        dayjs(item.end_time).minute();
      setGhostMinutes({ start: startMin, end: endMin, date: base });
    },
    [getGridInfo, base]
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, item: ScheduleItem) => {
      e.preventDefault();
      e.stopPropagation();
      setResizingItem(item);
      const startMin =
        (dayjs(item.start_time).hour() - START_HOUR) * 60 +
        dayjs(item.start_time).minute();
      const endMin =
        (dayjs(item.end_time).hour() - START_HOUR) * 60 +
        dayjs(item.end_time).minute();
      setGhostMinutes({ start: startMin, end: endMin, date: base });
    },
    [base]
  );

  useEffect(() => {
    if (!draggingItem && !resizingItem) return;
    const handleMouseMove = (e: MouseEvent) => {
      const info = getGridInfo(e);
      if (!info) return;
      if (draggingItem) {
        const rawMin =
          (info.relY / HOUR_HEIGHT) * 60 + START_HOUR * 60 - dragOffset;
        const startMin = snapToGrid(
          Math.max(0, Math.min(TOTAL_HOURS * 60 - 15, rawMin))
        );
        const duration = dayjs(draggingItem.end_time).diff(
          dayjs(draggingItem.start_time),
          "minute"
        );
        const endMin = startMin + duration;
        const { date } = getColumnDate(info.relX, info.width);
        setGhostMinutes({
          start: startMin,
          end: Math.min(endMin, TOTAL_HOURS * 60),
          date,
        });
      }
      if (resizingItem) {
        const startMin =
          (dayjs(resizingItem.start_time).hour() - START_HOUR) * 60 +
          dayjs(resizingItem.start_time).minute();
        const rawEnd = (info.relY / HOUR_HEIGHT) * 60 + START_HOUR * 60;
        const endMin = snapToGrid(
          Math.max(startMin + 15, Math.min(TOTAL_HOURS * 60, rawEnd))
        );
        setGhostMinutes({ start: startMin, end: endMin, date: base });
      }
    };
    const handleMouseUp = async (e: MouseEvent) => {
      const info = getGridInfo(e);
      if (draggingItem && onItemMove && ghostMinutes) {
        const totalStartMin = ghostMinutes.start + START_HOUR * 60;
        const h = Math.floor(totalStartMin / 60);
        const m = totalStartMin % 60;
        await onItemMove(
          draggingItem,
          moveItemToDateTime(draggingItem, ghostMinutes.date, h, m)
        );
      }
      if (resizingItem && onItemMove && ghostMinutes && info) {
        const totalEndMin = ghostMinutes.end + START_HOUR * 60;
        const h = Math.floor(totalEndMin / 60);
        const m = totalEndMin % 60;
        await onItemMove(resizingItem, resizeItem(resizingItem, h, m));
      }
      setDraggingItem(null);
      setResizingItem(null);
      setGhostMinutes(null);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    draggingItem,
    resizingItem,
    dragOffset,
    ghostMinutes,
    getGridInfo,
    getColumnDate,
    onItemMove,
    base,
  ]);

  const shift = (dir: number) => {
    const unit = view === "month" ? "month" : view === "week" ? "week" : "day";
    onDateChange(base.add(dir, unit).toDate());
  };

  const periodLabel = useMemo(() => {
    if (view === "month") return base.format("MMMM YYYY");
    if (view === "week")
      return `${base.startOf("week").format("D MMM")} – ${base
        .endOf("week")
        .format("D MMM YYYY")}`;
    if (view === "day") return base.format("dddd, D MMMM YYYY");
    return "Jadwal";
  }, [base, view]);

  const [monthDragOverDate, setMonthDragOverDate] = useState<string | null>(
    null
  );

  const monthDays = useMemo(() => {
    const start = base.startOf("month").startOf("week");
    return Array.from({ length: 42 }, (_, i) => start.add(i, "day"));
  }, [base]);

  const monthDayCell = (date: dayjs.Dayjs) => {
    const key = date.format("YYYY-MM-DD");
    const dayItems = sortedItems.filter((item) =>
      dayjs(item.start_time).isSame(date, "day")
    );
    const muted = !date.isSame(base, "month");
    const isToday = date.isSame(dayjs(), "day");
    const isDragOver = monthDragOverDate === key;
    return (
      <div
        key={key}
        onDragOver={(e) => {
          if (!editable) return;
          e.preventDefault();
          setMonthDragOverDate(key);
        }}
        onDragLeave={() => setMonthDragOverDate(null)}
        onDrop={async (e) => {
          setMonthDragOverDate(null);
          const itemId = e.dataTransfer.getData("text/plain");
          const item = items.find((r) => r.id === itemId);
          if (!item || !onItemMove) return;
          await onItemMove(
            item,
            moveItemToDateTime(
              item,
              date,
              dayjs(item.start_time).hour(),
              dayjs(item.start_time).minute()
            )
          );
        }}
        className={cn(
          "min-h-24 border-r border-t border-slate-100 p-1.5 transition-colors",
          muted ? "bg-slate-50/60" : "bg-white",
          isDragOver && "bg-blue-50",
          "group"
        )}
      >
        <div className="mb-1 flex items-center justify-between">
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
              isToday
                ? "bg-blue-600 text-white"
                : muted
                ? "text-slate-400"
                : "text-slate-700"
            )}
          >
            {date.date()}
          </span>
          {editable && (
            <button
              type="button"
              onClick={() => onCreateItem?.(date.toDate())}
              className="invisible rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 group-hover:visible"
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="space-y-0.5">
          {dayItems.slice(0, 3).map((item) => (
            <div
              key={item.id}
              draggable={editable}
              onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)}
              onClick={(e) => {
                e.stopPropagation();
                onItemClick(item);
              }}
              className="flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-white truncate hover:brightness-95"
              style={{ backgroundColor: item.color || "#2563eb" }}
            >
              {!item.all_day && (
                <span className="shrink-0 text-[10px] text-white/80">
                  {dayjs(item.start_time).format("HH:mm")}
                </span>
              )}
              <span className="truncate">{item.title}</span>
            </div>
          ))}
          {dayItems.length > 3 && (
            <button
              type="button"
              onClick={() => {
                onDateChange(date.toDate());
                onViewChange("day");
              }}
              className="w-full rounded px-1.5 py-0.5 text-left text-[10px] font-semibold text-slate-500 hover:bg-slate-100"
            >
              +{dayItems.length - 3} lainnya
            </button>
          )}
        </div>
      </div>
    );
  };

  const timeGridScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (timeGridScrollRef.current)
      timeGridScrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
  }, [view]);

  const renderTimeGrid = () => {
    const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => i + START_HOUR);
    return (
      <div className="flex flex-col overflow-hidden">
        <div className="flex border-b border-slate-200 bg-white">
          <div className="w-14 shrink-0 border-r border-slate-200 py-1 text-right pr-2 text-[10px] text-slate-400 font-medium">
            seharian
          </div>
          <div className="flex flex-1">
            {columnDates.map((date) => {
              const allDayItems = sortedItems.filter(
                (item) =>
                  item.all_day && dayjs(item.start_time).isSame(date, "day")
              );
              return (
                <div
                  key={date.toISOString()}
                  className="flex-1 min-h-6 border-r border-slate-100 last:border-r-0 p-0.5 space-y-0.5"
                >
                  {allDayItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => onItemClick(item)}
                      className="cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium text-white truncate"
                      style={{ backgroundColor: item.color || "#2563eb" }}
                    >
                      {item.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        <div
          ref={timeGridScrollRef}
          className="overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 220px)" }}
        >
          <div
            ref={gridRef}
            className="flex"
            style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}
          >
            <div className="w-14 shrink-0 border-r border-slate-200 relative">
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute right-2 text-[10px] font-medium text-slate-400 -translate-y-2"
                  style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px` }}
                >
                  {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                </div>
              ))}
            </div>
            <div className="flex flex-1">
              {columnDates.map((date) => {
                const dayItems = sortedItems.filter(
                  (item) =>
                    !item.all_day && dayjs(item.start_time).isSame(date, "day")
                );
                const isGhostColumn = ghostMinutes?.date.isSame(date, "day");
                return (
                  <TimeGridColumn
                    key={date.toISOString()}
                    date={date}
                    items={dayItems}
                    editable={editable}
                    draggingItem={draggingItem}
                    resizingItem={resizingItem}
                    ghostMinutes={isGhostColumn ? ghostMinutes : null}
                    onItemClick={onItemClick}
                    onDragStart={handleDragStart}
                    onResizeStart={handleResizeStart}
                    onColumnClick={(d, h, m) => {
                      if (onCreateItem)
                        onCreateItem(d.hour(h).minute(m).toDate());
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const DAY_HEADERS_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  return (
    <>
      {/* ── Print Preview Modal ── */}
      {showPrintPreview && (
        <PrintPreviewModal
          items={items}
          currentDate={currentDate}
          defaultView={view}
          onClose={() => setShowPrintPreview(false)}
        />
      )}

      <div
        className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        style={{
          userSelect: draggingItem || resizingItem ? "none" : undefined,
        }}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-2 border-b border-slate-100 bg-white px-4 py-2">
          <CalendarDays className="h-6 w-6 text-blue-600 shrink-0" />
          <span className="text-lg font-semibold text-slate-800 mr-2 hidden sm:block">
            Kalender
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateChange(new Date())}
            className="h-8 px-3 text-sm font-medium"
          >
            Hari ini
          </Button>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => shift(-1)}
              className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => shift(1)}
              className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <h2 className="text-base font-semibold text-slate-700 min-w-0 truncate flex-1">
            {periodLabel}
          </h2>

          {loading && (
            <span className="text-xs text-slate-400 shrink-0">Memuat...</span>
          )}

          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 shrink-0">
            {(
              [
                { key: "day", label: "Hari" },
                { key: "week", label: "Minggu" },
                { key: "month", label: "Bulan" },
                { key: "list", label: "Agenda" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => onViewChange(key)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                  view === key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 🖨️ Updated print button — opens modal instead of window.print() */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPrintPreview(true)}
            className="h-8 shrink-0"
          >
            <Printer className="mr-1 h-3.5 w-3.5" />
            Cetak
          </Button>

          {editable && (
            <Button
              size="sm"
              onClick={() => onCreateItem?.(currentDate)}
              className="h-8 shrink-0 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Buat
            </Button>
          )}
        </div>

        {/* ── Month ── */}
        {view === "month" && (
          <div>
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
              {DAY_HEADERS_ID.map((d) => (
                <div
                  key={d}
                  className="py-2 text-center text-xs font-semibold text-slate-500"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthDays.map((d) => monthDayCell(d))}
            </div>
          </div>
        )}

        {/* ── Week ── */}
        {view === "week" && (
          <div className="flex flex-col">
            <div className="flex border-b border-slate-100 bg-white">
              <div className="w-14 shrink-0 border-r border-slate-200" />
              {weekDays.map((date) => {
                const isToday = date.isSame(dayjs(), "day");
                return (
                  <div
                    key={date.toISOString()}
                    className="flex-1 border-r border-slate-100 last:border-r-0 py-2 text-center"
                  >
                    <span className="block text-[10px] font-semibold uppercase text-slate-400">
                      {DAY_HEADERS_ID[date.day()]}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onDateChange(date.toDate());
                        onViewChange("day");
                      }}
                      className={cn(
                        "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors hover:bg-slate-100",
                        isToday
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "text-slate-700"
                      )}
                    >
                      {date.date()}
                    </button>
                  </div>
                );
              })}
            </div>
            {renderTimeGrid()}
          </div>
        )}

        {/* ── Day ── */}
        {view === "day" && (
          <div className="flex flex-col">
            <div className="flex border-b border-slate-100 bg-white">
              <div className="w-14 shrink-0 border-r border-slate-200" />
              <div className="flex-1 py-2 text-center">
                <span className="block text-[10px] font-semibold uppercase text-slate-400">
                  {DAY_HEADERS_ID[base.day()]}
                </span>
                <span
                  className={cn(
                    "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                    base.isSame(dayjs(), "day")
                      ? "bg-blue-600 text-white"
                      : "text-slate-700"
                  )}
                >
                  {base.date()}
                </span>
              </div>
            </div>
            {renderTimeGrid()}
          </div>
        )}

        {/* ── List / Agenda ── */}
        {view === "list" && (
          <div className="min-h-[420px] divide-y divide-slate-100">
            {sortedItems.length === 0 ? (
              <div className="flex h-72 flex-col items-center justify-center text-center text-slate-500">
                <ListChecks className="mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm font-medium">Belum ada jadwal.</p>
                {editable && (
                  <Button
                    size="sm"
                    onClick={() => onCreateItem?.()}
                    className="mt-3"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Buat jadwal
                  </Button>
                )}
              </div>
            ) : (
              (() => {
                const grouped = new Map<string, ScheduleItem[]>();
                for (const item of sortedItems) {
                  const key = dayjs(item.start_time).format("YYYY-MM-DD");
                  if (!grouped.has(key)) grouped.set(key, []);
                  grouped.get(key)!.push(item);
                }
                return Array.from(grouped.entries()).map(
                  ([dateKey, dateItems]) => {
                    const d = dayjs(dateKey);
                    const isToday = d.isSame(dayjs(), "day");
                    return (
                      <div key={dateKey}>
                        <div
                          className={cn(
                            "sticky top-0 z-10 flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-2"
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-full text-center",
                              isToday
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-700"
                            )}
                          >
                            <span className="text-xs font-bold leading-none">
                              {d.date()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {d.format("dddd")}
                            </p>
                            <p className="text-xs text-slate-400">
                              {d.format("D MMMM YYYY")}
                            </p>
                          </div>
                        </div>
                        {dateItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => onItemClick(item)}
                            className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                          >
                            <div
                              className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                              style={{
                                backgroundColor: item.color || "#2563eb",
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-slate-900 text-sm">
                                {item.title}
                              </p>
                              <p className="text-xs text-slate-500">
                                {itemTime(item, t)}
                              </p>
                              {item.description && (
                                <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    );
                  }
                );
              })()
            )}
          </div>
        )}
      </div>
    </>
  );
}
