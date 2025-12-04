import React from 'react';

const MODE_COLORS = {
  bus: {
    bg: 'bg-blue-500',
    text: 'text-blue-700',
    border: 'border-blue-500'
  },
  train: {
    bg: 'bg-green-500',
    text: 'text-green-700',
    border: 'border-green-500'
  },
  taxi: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-700',
    border: 'border-yellow-500'
  },
  flight: {
    bg: 'bg-purple-500',
    text: 'text-purple-700',
    border: 'border-purple-500'
  }
};

const MODE_LABELS = {
  bus: 'BUS',
  train: 'TRAIN',
  taxi: 'TAXI',
  flight: 'FLIGHT'
};

const CROWD_LABELS = {
  free: 'Free',
  moderate: 'Moderate',
  crowded: 'Crowded'
};

export default function SelectedModePanel({ selectedOption, onClose }) {
  if (!selectedOption) return null;

  const colors = MODE_COLORS[selectedOption.mode] || MODE_COLORS.bus;
  const modeLabel = MODE_LABELS[selectedOption.mode] || selectedOption.mode.toUpperCase();

  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
  };

  const formatCost = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  return (
    <div className={`absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-2xl border-2 ${colors.border} max-w-sm w-80`}>
      {/* Header */}
      <div className={`${colors.bg} text-white p-4 rounded-t-lg`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-white"></div>
            <h3 className="font-bold text-lg">{modeLabel}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Cost */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-gray-600">Cost</span>
          </div>
          <span className={`text-xl font-bold ${colors.text}`}>
            {formatCost(selectedOption.cost)}
          </span>
        </div>

        {/* Time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-gray-600">Time</span>
          </div>
          <span className="text-lg font-semibold text-gray-800">
            {formatTime(selectedOption.time)}
          </span>
        </div>

        {/* Crowd Indicator (for public transport) */}
        {(selectedOption.mode === 'bus' || selectedOption.mode === 'train') && selectedOption.crowdLevel && (
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-gray-600">Crowd Level</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                selectedOption.crowdLevel === 'free' ? 'bg-green-500' :
                selectedOption.crowdLevel === 'moderate' ? 'bg-orange-500' :
                'bg-red-500'
              }`}></div>
              <span className={`text-sm font-medium ${
                selectedOption.crowdLevel === 'free' ? 'text-green-600' :
                selectedOption.crowdLevel === 'moderate' ? 'text-orange-600' :
                'text-red-600'
              }`}>
                {CROWD_LABELS[selectedOption.crowdLevel]}
              </span>
            </div>
          </div>
        )}

        {/* Additional Info */}
        {selectedOption.additionalInfo && (
          <div className="pt-2 border-t">
            <p className="text-sm text-gray-600">{selectedOption.additionalInfo}</p>
          </div>
        )}
      </div>
    </div>
  );
}

