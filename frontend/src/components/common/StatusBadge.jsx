import React from 'react';

export default function StatusBadge({ status, size = 'sm', className = '' }) {
  const normalized = (status || '').toLowerCase().replace(/ /g, '_');

  const configs = {
    posted: {
      label: 'Posted',
      bg: 'bg-[#E8EED2]',
      text: 'text-[#4D553C]',
      border: 'border-[#D7D2C7]',
      dot: 'bg-[#70795A]'
    },
    matched: {
      label: 'Matched',
      bg: 'bg-[#DCE7B8]',
      text: 'text-[#3D442E]',
      border: 'border-[#C8D69E]',
      dot: 'bg-[#5F684B]'
    },
    picked_up: {
      label: 'Picked Up',
      bg: 'bg-[#E2ECD5]',
      text: 'text-[#3D4B2D]',
      border: 'border-[#CADABA]',
      dot: 'bg-[#556B2F]'
    },
    in_transit: {
      label: 'In Transit',
      bg: 'bg-[#E2ECD5]',
      text: 'text-[#3D4B2D]',
      border: 'border-[#CADABA]',
      dot: 'bg-[#556B2F]'
    },
    delivered: {
      label: 'Delivered',
      bg: 'bg-[#5F684B]',
      text: 'text-white',
      border: 'border-[#5F684B]',
      dot: 'bg-[#DCE7B8]'
    },
    expired: {
      label: 'Expired',
      bg: 'bg-[#F2EAE5]',
      text: 'text-[#A05245]',
      border: 'border-[#E3D3CB]',
      dot: 'bg-[#B85C50]'
    },
    cancelled: {
      label: 'Cancelled',
      bg: 'bg-[#EFECE6]',
      text: 'text-[#6F6C64]',
      border: 'border-[#D7D2C7]',
      dot: 'bg-[#99958B]'
    },
    available: {
      label: 'On Shift • Available',
      bg: 'bg-[#E8EED2]',
      text: 'text-[#4D553C]',
      border: 'border-[#D7D2C7]',
      dot: 'bg-[#70795A]'
    },
    busy: {
      label: 'On Shift • In Transit',
      bg: 'bg-[#F4E6D4]',
      text: 'text-[#8A5A2B]',
      border: 'border-[#E6CFB3]',
      dot: 'bg-[#C98A3C]'
    },
    en_route: {
      label: 'En Route',
      bg: 'bg-[#E2ECD5]',
      text: 'text-[#3D4B2D]',
      border: 'border-[#CADABA]',
      dot: 'bg-[#556B2F]'
    },
    offline: {
      label: 'Offline',
      bg: 'bg-[#EFECE6]',
      text: 'text-[#99958B]',
      border: 'border-[#D7D2C7]',
      dot: 'bg-[#99958B]'
    }
  };

  const config = configs[normalized] || {
    label: status || 'Unknown',
    bg: 'bg-[#F3EFE7]',
    text: 'text-[#6F6C64]',
    border: 'border-[#D7D2C7]',
    dot: 'bg-[#99958B]'
  };

  const sizeClasses = size === 'xs'
    ? 'text-[11px] px-2 py-0.5'
    : size === 'md'
    ? 'text-xs px-3 py-1 font-semibold'
    : 'text-xs px-2.5 py-0.5 font-medium';

  const isDelivered = normalized === 'delivered';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}>
      {isDelivered ? (
        <span className="font-bold text-[11px] leading-none">✓</span>
      ) : (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      )}
      <span>{config.label}</span>
    </span>
  );
}
