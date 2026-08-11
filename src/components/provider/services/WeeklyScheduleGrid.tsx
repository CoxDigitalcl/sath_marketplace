import React, { useState, useCallback, useEffect } from 'react';
import { DailySchedule } from '../../../types';

interface WeeklyScheduleGridProps {
    schedule: DailySchedule[];
    onChange: (newSchedule: DailySchedule[]) => void;
}

const weekDays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// Generate all 30-min time slots for a day
const generateTimeSlots = (): string[] => {
    const slots: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
        slots.push(`${String(hour).padStart(2, '0')}:00`);
        slots.push(`${String(hour).padStart(2, '0')}:30`);
    }
    return slots;
};

const timeSlots = generateTimeSlots();

// Convert timeRanges to a Set of selected slot strings
const rangesToSlots = (timeRanges: { start: string; end: string }[]): Set<string> => {
    const selected = new Set<string>();
    for (const range of timeRanges) {
        const startIdx = timeSlots.indexOf(range.start);
        const endIdx = timeSlots.indexOf(range.end);
        if (startIdx !== -1 && endIdx !== -1) {
            for (let i = startIdx; i < endIdx; i++) {
                selected.add(timeSlots[i]);
            }
        }
    }
    return selected;
};

// Convert a Set of selected slots back to timeRanges
const slotsToRanges = (selectedSlots: Set<string>): { start: string; end: string }[] => {
    const ranges: { start: string; end: string }[] = [];
    const sortedSlots = timeSlots.filter(slot => selectedSlots.has(slot));

    if (sortedSlots.length === 0) return [];

    let rangeStart = sortedSlots[0];
    let lastSlot = sortedSlots[0];

    for (let i = 1; i < sortedSlots.length; i++) {
        const currentSlot = sortedSlots[i];
        const lastIdx = timeSlots.indexOf(lastSlot);
        const currentIdx = timeSlots.indexOf(currentSlot);

        // Check if slots are contiguous
        if (currentIdx === lastIdx + 1) {
            lastSlot = currentSlot;
        } else {
            // Gap found, close current range
            const endIdx = timeSlots.indexOf(lastSlot) + 1;
            ranges.push({ start: rangeStart, end: timeSlots[endIdx] || '24:00' });
            rangeStart = currentSlot;
            lastSlot = currentSlot;
        }
    }

    // Close final range
    const endIdx = timeSlots.indexOf(lastSlot) + 1;
    ranges.push({ start: rangeStart, end: timeSlots[endIdx] || '24:00' });

    return ranges;
};

// Helper: build the Map from schedule prop
const buildCellsFromSchedule = (schedule: DailySchedule[]): Map<string, Set<string>> => {
    const cellsMap = new Map<string, Set<string>>();
    for (const dayConfig of schedule) {
        if (dayConfig.active && dayConfig.timeRanges && dayConfig.timeRanges.length > 0) {
            cellsMap.set(dayConfig.day, rangesToSlots(dayConfig.timeRanges));
        } else {
            cellsMap.set(dayConfig.day, new Set());
        }
    }
    return cellsMap;
};

const WeeklyScheduleGrid: React.FC<WeeklyScheduleGridProps> = ({ schedule, onChange }) => {
    // Track selected cells per day
    const [selectedCells, setSelectedCells] = useState<Map<string, Set<string>>>(() => buildCellsFromSchedule(schedule));

    // Sync internal state when the schedule prop changes (e.g. when editing a service loads new data)
    useEffect(() => {
        const hasAnySlots = schedule.some(d => d.active && d.timeRanges && d.timeRanges.length > 0);
        if (hasAnySlots) {
            setSelectedCells(buildCellsFromSchedule(schedule));
        }
    }, [schedule]);

    const [isDragging, setIsDragging] = useState(false);
    const [dragMode, setDragMode] = useState<'select' | 'deselect'>('select');

    // Toggle a single cell
    const toggleCell = useCallback((day: string, time: string, forceMode?: 'select' | 'deselect') => {
        setSelectedCells(prev => {
            const newMap = new Map(prev);
            const dayCells = new Set(prev.get(day) || []);

            const mode = forceMode || (dayCells.has(time) ? 'deselect' : 'select');

            if (mode === 'select') {
                dayCells.add(time);
            } else {
                dayCells.delete(time);
            }

            newMap.set(day, dayCells);

            // Notify parent with new schedule
            const newSchedule = weekDays.map(d => {
                const cells = newMap.get(d) as Set<string> || new Set<string>();
                return {
                    day: d,
                    active: cells.size > 0,
                    timeRanges: slotsToRanges(cells)
                };
            });
            onChange(newSchedule);

            return newMap;
        });
    }, [onChange]);

    // Handle drag start
    const handleMouseDown = (day: string, time: string) => {
        const dayCells = selectedCells.get(day) || new Set();
        const mode = dayCells.has(time) ? 'deselect' : 'select';
        setDragMode(mode);
        setIsDragging(true);
        toggleCell(day, time, mode);
    };

    // Handle drag over cells
    const handleMouseEnter = (day: string, time: string) => {
        if (isDragging) {
            toggleCell(day, time, dragMode);
        }
    };

    // Handle drag end
    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Toggle entire day
    const toggleDay = (day: string) => {
        setSelectedCells(prev => {
            const newMap = new Map(prev);
            const dayCells = prev.get(day) || new Set();

            if (dayCells.size > 0) {
                // Clear all cells for this day
                newMap.set(day, new Set());
            } else {
                // Select default working hours (08:00 - 18:00)
                const defaultCells = new Set<string>();
                for (let h = 8; h < 18; h++) {
                    defaultCells.add(`${String(h).padStart(2, '0')}:00`);
                    defaultCells.add(`${String(h).padStart(2, '0')}:30`);
                }
                newMap.set(day, defaultCells);
            }

            // Notify parent
            const newSchedule = weekDays.map(d => {
                const cells = newMap.get(d) as Set<string> || new Set<string>();
                return {
                    day: d,
                    active: cells.size > 0,
                    timeRanges: slotsToRanges(cells)
                };
            });
            onChange(newSchedule);

            return newMap;
        });
    };

    // Clear all cells for a day
    const clearDay = (day: string) => {
        setSelectedCells(prev => {
            const newMap = new Map(prev);
            newMap.set(day, new Set());

            const newSchedule = weekDays.map(d => {
                const cells = newMap.get(d) as Set<string> || new Set<string>();
                return {
                    day: d,
                    active: cells.size > 0,
                    timeRanges: slotsToRanges(cells)
                };
            });
            onChange(newSchedule);

            return newMap;
        });
    };

    const isDayActive = (day: string) => {
        const cells = selectedCells.get(day);
        return cells && cells.size > 0;
    };

    const isCellSelected = (day: string, time: string) => {
        const cells = selectedCells.get(day);
        return cells?.has(time) || false;
    };

    return (
        <div
            className="border border-gray-200 rounded-lg overflow-hidden bg-white select-none"
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* Header Row */}
            <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-50">
                <div className="p-2 text-xs font-medium text-gray-500 border-r border-gray-200">
                    Hora
                </div>
                {weekDays.map(day => (
                    <div key={day} className="p-2 text-center border-r border-gray-200 last:border-r-0">
                        <div className="text-xs font-bold text-gray-700">{day.substring(0, 3)}</div>
                        <button
                            onClick={() => toggleDay(day)}
                            className={`mt-1 w-8 h-4 rounded-full transition-colors relative mx-auto flex items-center p-0.5 ${isDayActive(day) ? 'bg-blue-500' : 'bg-gray-300'
                                }`}
                        >
                            <span className={`w-3 h-3 bg-white rounded-full shadow transition-transform ${isDayActive(day) ? 'translate-x-[16px]' : 'translate-x-0'
                                }`} />
                        </button>
                        <button
                            onClick={() => clearDay(day)}
                            className="block w-full text-[10px] text-blue-600 hover:text-blue-800 mt-1 leading-tight"
                        >
                            Vaciar
                        </button>
                    </div>
                ))}
            </div>

            {/* Time Grid - Scrollable */}
            <div className="max-h-[400px] overflow-y-auto">
                {timeSlots.map((time, idx) => (
                    <div key={time} className={`grid grid-cols-8 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        {/* Time Label */}
                        <div className="px-2 py-1 text-[10px] text-gray-500 border-r border-gray-100 flex items-center">
                            {time}
                        </div>

                        {/* Day Cells */}
                        {weekDays.map(day => {
                            const selected = isCellSelected(day, time);
                            return (
                                <div
                                    key={`${day}-${time}`}
                                    className={`h-6 border-r border-b border-gray-100 last:border-r-0 cursor-pointer transition-colors ${selected
                                        ? 'bg-blue-500 hover:bg-blue-600'
                                        : 'hover:bg-blue-100'
                                        }`}
                                    onMouseDown={() => handleMouseDown(day, time)}
                                    onMouseEnter={() => handleMouseEnter(day, time)}
                                >
                                    {selected && (
                                        <div className="w-full h-full flex items-center justify-center text-[9px] text-white font-medium">
                                            {time}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="p-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
                <strong>Tip:</strong> Haz clic y arrastra para seleccionar múltiples bloques horarios. Los horarios azules estarán disponibles para reserva.
            </div>
        </div>
    );
};

export default WeeklyScheduleGrid;
