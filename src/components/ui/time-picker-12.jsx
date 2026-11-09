import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

export default function TimePicker12({ value = "", onChange, disabled = false, className = "" }) {
  // Helper to parse 24h string "HH:MM" into { hour12, minute, period }
  const parseTime = (timeStr) => {
    if (!timeStr || typeof timeStr !== "string" || !timeStr.includes(":")) {
      return { hour12: "", minute: "", period: "AM" };
    }
    const [hStr, mStr] = timeStr.split(":");
    let h24 = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h24) || isNaN(m)) {
      return { hour12: "", minute: "", period: "AM" };
    }
    const period = h24 >= 12 ? "PM" : "AM";
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;

    return {
      hour12: String(h12).padStart(2, "0"),
      minute: String(m).padStart(2, "0"),
      period,
    };
  };

  const { hour12, minute, period } = parseTime(value);

  const updateTime = (newH12, newMin, newPeriod) => {
    if (!newH12 || !newMin) return;
    const activePeriod = newPeriod || "AM";
    let hNum = parseInt(newH12, 10);
    if (activePeriod === "PM" && hNum < 12) {
      hNum += 12;
    } else if (activePeriod === "AM" && hNum === 12) {
      hNum = 0;
    }
    const h24Str = String(hNum).padStart(2, "0");
    const minStr = String(newMin).padStart(2, "0");
    onChange(`${h24Str}:${minStr}`);
  };

  const hoursList = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const minutesList = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* Hour Dropdown */}
      <div className="w-20">
        <Select
          disabled={disabled}
          value={hour12 || undefined}
          onValueChange={(val) => updateTime(val, minute || "00", period || "AM")}
        >
          <SelectTrigger className="bg-white border border-gray-300 shadow-sm text-sm h-9 px-2 text-center">
            <SelectValue placeholder="HH" />
          </SelectTrigger>
          <SelectContent className="bg-white border border-gray-300 shadow-lg max-h-48 overflow-y-auto min-w-[5rem]">
            {hoursList.map((h) => (
              <SelectItem key={h} value={h} className="text-center font-medium">
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <span className="font-bold text-gray-500 text-sm">:</span>

      {/* Minute Dropdown */}
      <div className="w-20">
        <Select
          disabled={disabled}
          value={minute || undefined}
          onValueChange={(val) => updateTime(hour12 || "09", val, period || "AM")}
        >
          <SelectTrigger className="bg-white border border-gray-300 shadow-sm text-sm h-9 px-2 text-center">
            <SelectValue placeholder="MM" />
          </SelectTrigger>
          <SelectContent className="bg-white border border-gray-300 shadow-lg max-h-48 overflow-y-auto min-w-[5rem]">
            {minutesList.map((m) => (
              <SelectItem key={m} value={m} className="text-center font-medium">
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* AM/PM Dropdown */}
      <div className="w-20">
        <Select
          disabled={disabled}
          value={period || "AM"}
          onValueChange={(val) => updateTime(hour12 || "09", minute || "00", val)}
        >
          <SelectTrigger className="bg-white border border-gray-300 shadow-sm text-sm h-9 px-2 font-semibold text-blue-800 text-center">
            <SelectValue placeholder="AM" />
          </SelectTrigger>
          <SelectContent className="bg-white border border-gray-300 shadow-lg min-w-[5rem]">
            <SelectItem value="AM" className="font-semibold text-blue-800 text-center">
              AM
            </SelectItem>
            <SelectItem value="PM" className="font-semibold text-blue-800 text-center">
              PM
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
