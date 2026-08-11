import React, { useMemo } from 'react';
import { MapPin, X } from 'lucide-react';
import { CHILE_REGIONS, getCommunesForRegion } from '../../../shared/chileLocations.js';

interface LocationCoverageSelectorProps {
    regionCode: string;
    communes: string[];
    onRegionChange(regionCode: string): void;
    onCommunesChange(communes: string[]): void;
    mode?: 'single' | 'multiple';
    label?: string;
    helperText?: string;
    required?: boolean;
}

type ChileRegion = {
    code: string;
    name: string;
};

const LocationCoverageSelector: React.FC<LocationCoverageSelectorProps> = ({
    regionCode,
    communes,
    onRegionChange,
    onCommunesChange,
    mode = 'multiple',
    label = 'Cobertura',
    helperText,
    required = false,
}) => {
    const componentId = React.useId();
    const regionSelectId = `${componentId}-region`;
    const helperTextId = `${componentId}-helper`;
    const selectedCommunesId = `${componentId}-selected`;
    const communeGroupId = `${componentId}-communes`;

    const regions = CHILE_REGIONS as ChileRegion[];

    const availableCommunes = useMemo(
        () => (regionCode ? (getCommunesForRegion(regionCode) as string[]) : []),
        [regionCode],
    );

    const selectedCommunes = useMemo(
        () => Array.from(new Set(communes.map((commune) => commune.trim()).filter(Boolean))),
        [communes],
    );

    const selectedCommuneSet = useMemo(() => new Set(selectedCommunes), [selectedCommunes]);

    const handleRegionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        onRegionChange(event.target.value);
        onCommunesChange([]);
    };

    const handleCommuneToggle = (commune: string) => {
        const isSelected = selectedCommuneSet.has(commune);

        if (mode === 'single') {
            onCommunesChange(isSelected ? [] : [commune]);
            return;
        }

        onCommunesChange(
            isSelected
                ? selectedCommunes.filter((selectedCommune) => selectedCommune !== commune)
                : [...selectedCommunes, commune],
        );
    };

    const handleCommuneRemove = (commune: string) => {
        onCommunesChange(selectedCommunes.filter((selectedCommune) => selectedCommune !== commune));
    };

    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <label htmlFor={regionSelectId} className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && (
                        <span className="ml-1 text-red-500" aria-hidden="true">
                            *
                        </span>
                    )}
                    {required && <span className="sr-only">obligatorio</span>}
                </label>

                {helperText && (
                    <p id={helperTextId} className="text-sm text-gray-500">
                        {helperText}
                    </p>
                )}

                <select
                    id={regionSelectId}
                    value={regionCode}
                    onChange={handleRegionChange}
                    required={required}
                    aria-describedby={helperText ? helperTextId : undefined}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                >
                    <option value="">Selecciona una region</option>
                    {regions.map((region) => (
                        <option key={region.code} value={region.code}>
                            {region.name}
                        </option>
                    ))}
                </select>
            </div>

            {selectedCommunes.length > 0 && (
                <div id={selectedCommunesId} className="flex flex-wrap gap-2" aria-label="Comunas seleccionadas">
                    {selectedCommunes.map((commune) => (
                        <span
                            key={commune}
                            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-brand-primary/20 bg-brand-primary/10 px-2.5 py-1 text-xs font-medium text-gray-700"
                        >
                            <MapPin size={13} className="shrink-0 text-brand-primary" aria-hidden="true" />
                            <span className="truncate">{commune}</span>
                            <button
                                type="button"
                                onClick={() => handleCommuneRemove(commune)}
                                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-white hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                                aria-label={`Quitar ${commune}`}
                            >
                                <X size={12} aria-hidden="true" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            <fieldset
                id={communeGroupId}
                disabled={!regionCode}
                aria-describedby={selectedCommunes.length > 0 ? selectedCommunesId : undefined}
                aria-required={required}
                className="space-y-2"
            >
                <legend className="text-sm font-medium text-gray-700">
                    {mode === 'single' ? 'Comuna' : 'Comunas'}
                </legend>

                {!regionCode ? (
                    <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-500">
                        Primero selecciona una region para ver comunas.
                    </p>
                ) : availableCommunes.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-500">
                        No hay comunas disponibles para esta region.
                    </p>
                ) : (
                    <div className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 sm:grid-cols-2">
                        {availableCommunes.map((commune) => {
                            const isSelected = selectedCommuneSet.has(commune);
                            const inputType = mode === 'single' ? 'radio' : 'checkbox';

                            return (
                                <label
                                    key={commune}
                                    className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                                        isSelected ? 'bg-brand-primary/10 text-gray-900' : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    <input
                                        type={inputType}
                                        name={mode === 'single' ? communeGroupId : undefined}
                                        checked={isSelected}
                                        onClick={() => {
                                            if (mode === 'single' && isSelected) {
                                                onCommunesChange([]);
                                            }
                                        }}
                                        onChange={() => handleCommuneToggle(commune)}
                                        className={`h-4 w-4 border-gray-300 text-brand-primary focus:ring-brand-primary ${
                                            mode === 'single' ? 'rounded-full' : 'rounded'
                                        }`}
                                    />
                                    <span className="min-w-0 truncate">{commune}</span>
                                </label>
                            );
                        })}
                    </div>
                )}
            </fieldset>
        </div>
    );
};

export default LocationCoverageSelector;
