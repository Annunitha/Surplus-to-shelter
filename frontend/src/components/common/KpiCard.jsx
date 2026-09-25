import React from 'react';

export default function KpiCard({ label, value, subtext, icon: Icon, badge, highlight = false, className = '' }) {
  return (
    <div
      className={`card-warm rounded-2xl p-5 md:p-6 transition-all duration-200 hover:shadow-md ${
        highlight ? 'bg-[#5F684B] text-white border-[#5F684B]' : 'bg-[#F8F5EE] border-[#D7D2C7]'
      } ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className={`text-xs font-semibold uppercase tracking-wider ${
          highlight ? 'text-[#DCE7B8]' : 'text-[#6F6C64]'
        }`}>
          {label}
        </span>
        {Icon && (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            highlight ? 'bg-white/15 text-white' : 'bg-[#E8EED2] text-[#5F684B]'
          }`}>
            <Icon size={18} strokeWidth={2.2} />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`text-3xl md:text-4xl font-extrabold tracking-tight ${
          highlight ? 'text-white' : 'text-[#22211E]'
        }`}>
          {value}
        </span>
        {badge && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#E8EED2] text-[#4D553C]">
            {badge}
          </span>
        )}
      </div>

      {subtext && (
        <p className={`text-xs mt-2.5 leading-relaxed ${
          highlight ? 'text-white/80' : 'text-[#6F6C64]'
        }`}>
          {subtext}
        </p>
      )}
    </div>
  );
}
