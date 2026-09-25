import React from 'react';
import { Search, Bell, HelpCircle, Menu, ChevronRight } from 'lucide-react';
import { getUser } from '../../api';

export default function TopNavbar({
  userProfile = null,
  role = 'donor',
  breadcrumbs = null,
  onMenuClick = () => {},
  statusLabel = 'Online Status',
  statusBadgeVariant = 'online'
}) {
  const user = getUser();
  const displayName = userProfile?.org_name || userProfile?.name || (role === 'donor' ? 'Partner Donor' : role === 'driver' ? 'Courier' : 'Shelter Partner');
  const roleLabel = role === 'donor' ? 'Verified Donor' : role === 'driver' ? 'Active Driver' : 'Verified Shelter';

  // Initials for avatar
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  return (
    <header className="sticky top-0 z-30 bg-[#FAF7F1]/90 backdrop-blur-md border-b border-[#D7D2C7] px-4 md:px-8 py-3.5">
      <div className="flex items-center justify-between gap-4">
        {/* Left Side: Mobile Hamburger & Driver Operations Header / Search / Recipient Status Pill */}
        <div className="flex items-center gap-3 flex-1 max-w-3xl min-w-0">
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-xl border border-[#D7D2C7] bg-[#F8F5EE] text-[#22211E] hover:bg-[#F3EFE7] transition cursor-pointer shrink-0">
            <Menu size={18} />
          </button>

          {role === 'driver' ? (
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="hidden sm:block shrink-0">
                <span className="block text-xs font-bold text-[#22211E] leading-tight">FoodRescue</span>
                <span className="block text-[10px] font-medium text-[#6F6C64] leading-tight">Operations</span>
              </div>

              <div className="hidden sm:block h-6 w-px bg-[#D7D2C7] shrink-0" />

              <div className="hidden lg:flex items-center gap-1.5 text-xs text-[#6F6C64] shrink-0">
                <span>Driver Portal</span>
                <ChevronRight size={12} className="text-[#99958B]" />
                <span>Live Dispatch</span>
                <ChevronRight size={12} className="text-[#99958B]" />
                <span className="font-semibold text-[#22211E]">Route #104</span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E8EED2] text-[#4D553C] border border-[#D7D2C7] shrink-0">
                <span className="w-2 h-2 rounded-full bg-[#5F684B]" />
                <span>{statusLabel}</span>
              </div>

              <div className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium bg-[#F3EFE7] text-[#6F6C64] border border-[#D7D2C7] shrink-0">
                <span>❄️ Van #3 - Refrigerated</span>
              </div>
            </div>
          ) : role === 'recipient' ? (
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-[#E8EED2] text-[#4D553C] border border-[#D7D2C7]">
              <span className="w-2 h-2 rounded-full bg-[#5F684B]" />
              <span>Shelter Online • Receiving Mode</span>
            </div>
          ) : breadcrumbs ? (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#6F6C64]">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  <span className={idx === breadcrumbs.length - 1 ? 'font-semibold text-[#22211E]' : ''}>
                    {crumb}
                  </span>
                  {idx < breadcrumbs.length - 1 && <ChevronRight size={13} className="text-[#99958B]" />}
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className="relative w-full max-w-md hidden sm:block">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#99958B]"
              />
              <input
                type="text"
                placeholder="Search manifests, ID, items..."
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-[#FDFBF7] border border-[#D7D2C7] text-[#22211E] placeholder-[#99958B] focus:outline-none focus:border-[#70795A] focus:ring-2 focus:ring-[#70795A]/15 transition"
              />
            </div>
          )}
        </div>

        {/* Right Side: Status Badge, Notifications, User Profile */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
          {role === 'donor' && (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E8EED2] text-[#4D553C] border border-[#D7D2C7]">
              <span className="w-2 h-2 rounded-full bg-[#5F684B] animate-pulse" />
              <span>{statusLabel}</span>
            </div>
          )}

          {/* Notifications */}
          <button
            onClick={() => alert('No unread system alerts. All food rescue dispatches are synchronizing normally.')}
            className={
              role === 'recipient' || role === 'driver'
                ? 'text-[#22211E] hover:text-[#5F684B] transition cursor-pointer p-1'
                : 'w-9 h-9 rounded-xl border border-[#D7D2C7] bg-[#FDFBF7] flex items-center justify-center text-[#6F6C64] hover:text-[#22211E] hover:bg-[#F3EFE7] transition cursor-pointer relative'
            }>
            <Bell size={18} strokeWidth={2} />
          </button>

          {role === 'donor' && (
            <button
              onClick={() => alert('FoodRescue Quick Guide: Follow cold-chain guidelines and verify recipient transfer tokens.')}
              className="w-9 h-9 rounded-xl border border-[#D7D2C7] bg-[#F8F5EE] hidden sm:flex items-center justify-center text-[#6F6C64] hover:text-[#22211E] hover:bg-[#F3EFE7] transition cursor-pointer">
              <HelpCircle size={16} strokeWidth={2} />
            </button>
          )}

          {/* Divider */}
          <div className="h-6 w-px bg-[#D7D2C7]" />

          {/* User Profile Capsule */}
          {role === 'recipient' ? (
            /* Shelter Bordered Capsule (Matching Screenshot) */
            <div className="border border-[#D7D2C7] bg-[#FDFBF7] rounded-xl px-3 py-1.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#5F684B] text-white flex items-center justify-center text-xs font-bold shrink-0">
                {initials || 'HC'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-[#22211E] leading-tight truncate max-w-[170px]">
                    {displayName}
                  </p>
                  <span className="w-3.5 h-3.5 rounded-full border border-[#5F684B] flex items-center justify-center text-[9px] text-[#5F684B] font-bold shrink-0">
                    ✓
                  </span>
                </div>
                <p className="text-[10px] text-[#6F6C64] font-medium leading-tight mt-0.5">
                  {userProfile?.address_text ? `${userProfile.address_text.slice(0, 18)} • ` : 'Zone 4 East Central • '}Capacity {userProfile?.capacity_max || 85}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#5F684B] text-white flex items-center justify-center text-xs font-bold shrink-0">
                {initials || 'AM'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-[#22211E] leading-tight truncate max-w-[140px]">
                  {displayName}
                </p>
                <p className="text-[10px] text-[#6F6C64] font-medium leading-tight">
                  {roleLabel}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
