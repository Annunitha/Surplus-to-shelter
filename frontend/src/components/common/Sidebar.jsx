import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  Truck,
  Inbox,
  Sliders,
  Settings,
  HelpCircle,
  LogOut,
  BarChart3,
  LayoutGrid,
  Route,
  X
} from 'lucide-react';
import { clearUser, getUser } from '../../api';

export default function Sidebar({
  role,
  activeTab = 'donations',
  setActiveTab = () => {},
  isOpen = false,
  setIsOpen = () => {}
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();

  // Robust role resolution: prop > pathname inspection > user.role > fallback 'donor'
  const effectiveRole =
    role ||
    (location.pathname.startsWith('/driver')
      ? 'driver'
      : location.pathname.startsWith('/recipient')
      ? 'recipient'
      : location.pathname.startsWith('/donor')
      ? 'donor'
      : user?.role || 'donor');

  function handleLogout() {
    clearUser();
    localStorage.clear();
    navigate('/login');
  }

  // Navigation configurations based on role
  let navItems = [];
  let portalTitle = 'Logistics Portal';

  if (effectiveRole === 'donor') {
    portalTitle = 'Logistics Portal';
    navItems = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, action: () => { setActiveTab('dashboard'); navigate('/donor'); } },
      { id: 'donations', label: 'My Donations', icon: Package, action: () => { setActiveTab('donations'); navigate('/donor/donations'); } },
      { id: 'new_donation', label: 'New Donation', icon: PlusCircle, action: () => { setActiveTab('new_donation'); navigate('/donor/donations/new'); } },
      { id: 'impact', label: 'Public Impact', icon: BarChart3, action: () => navigate('/impact') },
    ];
  } else if (effectiveRole === 'driver') {
    portalTitle = 'Driver Portal';
    navItems = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid, action: () => { setActiveTab('dashboard'); navigate('/driver'); } },
      { id: 'assignment', label: 'Assignment', icon: Route, hasDot: true, action: () => { setActiveTab('assignment'); navigate('/driver/assignment'); } },
      { id: 'donations', label: 'My Donations', icon: Package, action: () => { setActiveTab('donations'); navigate('/driver/donations'); } },
      { id: 'new_donation', label: 'New Donation', icon: PlusCircle, action: () => { setActiveTab('new_donation'); navigate('/driver/donations/new'); } },
    ];
  } else if (effectiveRole === 'recipient') {
    portalTitle = 'Shelter Portal';
    navItems = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid, action: () => { setActiveTab('dashboard'); navigate('/recipient'); } },
      { id: 'offers', label: 'Offers', icon: Inbox, action: () => { setActiveTab('offers'); navigate('/recipient/offers'); } },
    ];
  }

  // Derive effective active tab considering both router location and activeTab prop
  let effectiveActiveTab = activeTab;
  if (effectiveRole === 'donor') {
    const p = location.pathname;
    if (p === '/donor/help' || p.startsWith('/donor/help/')) {
      effectiveActiveTab = 'help';
    } else if (p === '/donor/settings' || p.startsWith('/donor/settings/')) {
      effectiveActiveTab = 'settings';
    } else if (p === '/donor/donations/new') {
      effectiveActiveTab = 'new_donation';
    } else if (p === '/donor/donations') {
      effectiveActiveTab = 'donations';
    } else if (p === '/donor' || p === '/donor/' || p.startsWith('/donor/dashboard')) {
      effectiveActiveTab = activeTab === 'new_donation' ? 'new_donation' : 'dashboard';
    }
  } else if (effectiveRole === 'driver') {
    const p = location.pathname;
    if (p === '/driver/help' || p.startsWith('/driver/help/')) {
      effectiveActiveTab = 'help';
    } else if (p === '/driver/settings' || p.startsWith('/driver/settings/')) {
      effectiveActiveTab = 'settings';
    } else if (p === '/driver/donations/new') {
      effectiveActiveTab = 'new_donation';
    } else if (p === '/driver/donations' || p.startsWith('/driver/donations/')) {
      effectiveActiveTab = 'donations';
    } else if (p === '/driver/assignment' || p.startsWith('/driver/assignment/')) {
      effectiveActiveTab = 'assignment';
    } else if (p === '/driver' || p === '/driver/' || p.startsWith('/driver/dashboard')) {
      effectiveActiveTab = activeTab || 'dashboard';
    }
  } else if (effectiveRole === 'recipient') {
    const p = location.pathname;
    if (p === '/recipient/help' || p.startsWith('/recipient/help/')) {
      effectiveActiveTab = 'help';
    } else if (p.startsWith('/recipient/settings') || p.startsWith('/recipient/capacity')) {
      effectiveActiveTab = 'settings';
    } else if (p.startsWith('/recipient/offers')) {
      effectiveActiveTab = 'offers';
    } else if (p === '/recipient' || p === '/recipient/' || p.startsWith('/recipient/dashboard')) {
      effectiveActiveTab = 'dashboard';
    }
  }

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#F3EFE7] border-r border-[#D7D2C7] p-5 w-60 select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between pb-6 mb-2 border-b border-[#E3DDD1]">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-9 h-9 rounded-xl bg-[#5F684B] flex items-center justify-center text-white shadow-xs shrink-0">
            {effectiveRole === 'driver' ? <Truck size={19} strokeWidth={2.4} /> : <Package size={19} strokeWidth={2.4} />}
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-[#22211E]">FoodRescue</h1>
            <p className="text-[11px] font-medium text-[#6F6C64] uppercase tracking-wider">{portalTitle}</p>
          </div>
        </div>
        {isOpen && (
          <button
            onClick={() => setIsOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-[#6F6C64] hover:bg-[#EAE4D8]">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <div className="flex-1 space-y-1.5 py-4">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = effectiveActiveTab === item.id;
          const isRecipientSolidActive = isActive && effectiveRole === 'recipient';

          return (
            <button
              key={item.id}
              onClick={() => {
                item.action();
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? isRecipientSolidActive
                    ? 'bg-[#5F684B] text-white font-bold shadow-xs'
                    : 'bg-[#DCE7B8] text-[#22211E] font-semibold shadow-xs'
                  : 'text-[#6F6C64] hover:bg-[#EAE4D8] hover:text-[#22211E]'
              }`}>
              <div className="flex items-center gap-3">
                <Icon
                  size={19}
                  strokeWidth={isActive ? 2.4 : 2}
                  className={isRecipientSolidActive ? 'text-white' : isActive ? 'text-[#5F684B]' : 'text-[#6F6C64]'}
                />
                <span>{item.label}</span>
              </div>
              {(item.hasDot || (effectiveRole === 'driver' && isActive)) && (
                <span className="w-2 h-2 rounded-full bg-[#5F684B]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Secondary / Footer Navigation */}
      <div className="pt-4 border-t border-[#E3DDD1] space-y-1">
        <button
          onClick={() => {
            setActiveTab('help');
            if (effectiveRole === 'driver') {
              navigate('/driver/help');
            } else if (effectiveRole === 'recipient') {
              navigate('/recipient/help');
            } else {
              navigate('/donor/help');
            }
            setIsOpen(false);
          }}
          className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
            effectiveActiveTab === 'help'
              ? 'bg-[#DCE7B8] text-[#22211E] font-semibold shadow-xs'
              : 'text-[#6F6C64] hover:bg-[#EAE4D8] hover:text-[#22211E]'
          }`}>
          <div className="flex items-center gap-3">
            <HelpCircle
              size={17}
              strokeWidth={effectiveActiveTab === 'help' ? 2.4 : 2}
              className={effectiveActiveTab === 'help' ? 'text-[#5F684B]' : 'text-[#6F6C64]'}
            />
            <span>Help & Support</span>
          </div>
          {effectiveActiveTab === 'help' && (
            <span className="w-2 h-2 rounded-full bg-[#5F684B]" />
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab('settings');
            if (effectiveRole === 'driver') {
              navigate('/driver/settings');
            } else if (effectiveRole === 'recipient') {
              navigate('/recipient/settings');
            } else {
              navigate('/donor/settings');
            }
            setIsOpen(false);
          }}
          className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
            effectiveActiveTab === 'settings'
              ? 'bg-[#DCE7B8] text-[#22211E] font-semibold shadow-xs'
              : 'text-[#6F6C64] hover:bg-[#EAE4D8] hover:text-[#22211E]'
          }`}>
          <div className="flex items-center gap-3">
            <Settings
              size={17}
              strokeWidth={effectiveActiveTab === 'settings' ? 2.4 : 2}
              className={effectiveActiveTab === 'settings' ? 'text-[#5F684B]' : 'text-[#6F6C64]'}
            />
            <span>Settings</span>
          </div>
          {effectiveActiveTab === 'settings' && (
            <span className="w-2 h-2 rounded-full bg-[#5F684B]" />
          )}
        </button>
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer mt-0.5 ${
            effectiveRole === 'recipient'
              ? 'text-[#6F6C64] hover:bg-[#EAE4D8] hover:text-[#22211E]'
              : 'text-[#D85C55] hover:bg-[#F2EAE5]'
          }`}>
          <LogOut size={17} strokeWidth={2} className={effectiveRole === 'driver' ? 'text-[#D85C55]' : ''} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:block shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
