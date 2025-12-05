import React from 'react';

const MODE_COLORS = {
  bus: {
    border: 'border-blue-500',
    bg: 'bg-blue-50',
    dot: 'bg-blue-500'
  },
  train: {
    border: 'border-green-500',
    bg: 'bg-green-50',
    dot: 'bg-green-500'
  },
  taxi: {
    border: 'border-yellow-500',
    bg: 'bg-yellow-50',
    dot: 'bg-yellow-500'
  },
  flight: {
    border: 'border-purple-500',
    bg: 'bg-purple-50',
    dot: 'bg-purple-500'
  }
};

const MODE_LABELS = {
  bus: 'BUS',
  train: 'TRAIN',
  taxi: 'TAXI',
  flight: 'FLIGHT'
};

const CROWD_COLORS = {
  free: 'text-green-600',
  moderate: 'text-orange-600',
  crowded: 'text-red-600'
};

const CROWD_LABELS = {
  free: 'Free',
  moderate: 'Moderate',
  crowded: 'Crowded'
};

export default function TransportationOptionsPopup({ 
  isOpen, 
  onClose, 
  options = [],
  origin,
  destination,
  onSelectMode
}) {
  if (!isOpen) return null;

  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
  };

  const formatCost = (amount) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const getModeColor = (mode) => {
    return MODE_COLORS[mode] || {
      border: 'border-gray-500',
      bg: 'bg-gray-50',
      dot: 'bg-gray-500'
    };
  };

  const getModeLabel = (mode) => {
    return MODE_LABELS[mode] || mode.toUpperCase();
  };

  const renderMultiSegmentBus = (option) => {
    return (
      <div className="space-y-3">
        {/* Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="font-semibold text-blue-800">Total Journey</span>
            <span className="text-lg font-bold text-blue-800">{formatCost(option.totalFare)}</span>
          </div>
          <div className="flex justify-between text-sm text-blue-700">
            <span>Total Time: {formatTime(option.totalTime)}</span>
            <span>{option.numberOfChanges} bus change{option.numberOfChanges !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Segments */}
        {option.segments.map((segment, idx) => (
          <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="font-medium text-gray-800">
                  Segment {idx + 1}: {segment.from} → {segment.to}
                </span>
              </div>
              <span className="font-semibold text-gray-800">{formatCost(segment.fare)}</span>
            </div>

            <div className="ml-4 space-y-1 text-sm text-gray-600">
              <div>Bus: {segment.bus} ({segment.operator})</div>
              <div>Time: {formatTime(segment.time)}</div>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${
                  segment.crowdLevel === 'free' ? 'bg-green-500' :
                  segment.crowdLevel === 'moderate' ? 'bg-orange-500' :
                  'bg-red-500'
                }`}></div>
                <span className={CROWD_COLORS[segment.crowdLevel]}>
                  Crowd: {CROWD_LABELS[segment.crowdLevel]}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-[10002] pt-4" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-t-lg">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">Transportation Options</h2>
              <p className="text-sm opacity-90 mt-1">
                {origin?.label || 'Source'} → {destination?.label || 'Destination'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Options List */}
        <div className="p-4 space-y-3">
          {options.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Loading transportation options...</p>
            </div>
          ) : (
            options.map((option, idx) => {
              const colors = getModeColor(option.mode);
              
              return (
                <div
                  key={idx}
                  onClick={() => {
                    console.log('Option selected:', option.mode);
                    if (onSelectMode) {
                      console.log('Calling onSelectMode with:', option.mode);
                      onSelectMode(option);
                    }
                    onClose();
                  }}
                  className={`border-2 ${colors.border} ${colors.bg} rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer active:scale-95`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Mode Header */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${colors.dot}`}></div>
                        <h3 className="font-bold text-lg text-gray-800">
                          Mode: {getModeLabel(option.mode)}
                        </h3>
                      </div>

                      {/* Cost */}
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xl font-semibold text-gray-800">
                          Cost: {formatCost(option.cost)}
                        </span>
                      </div>

                      {/* Time */}
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-lg text-gray-700">
                          Time: {formatTime(option.time)}
                        </span>
                      </div>

                      {/* Crowd Indicator (for public transport) */}
                      {(option.mode === 'bus' || option.mode === 'train') && option.crowdLevel && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className={`w-2 h-2 rounded-full ${
                            option.crowdLevel === 'free' ? 'bg-green-500' :
                            option.crowdLevel === 'moderate' ? 'bg-orange-500' :
                            'bg-red-500'
                          }`}></div>
                          <span className={`text-sm font-medium ${CROWD_COLORS[option.crowdLevel]}`}>
                            Crowd: {CROWD_LABELS[option.crowdLevel]}
                          </span>
                        </div>
                      )}

                      {/* Additional Info */}
                      {option.additionalInfo && (
                        <div className="mt-2 text-sm text-gray-600">
                          {option.additionalInfo}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 p-4 rounded-b-lg border-t">
          <button
            onClick={onClose}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

