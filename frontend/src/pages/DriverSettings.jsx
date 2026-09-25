import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Settings,
  User,
  Phone,
  MapPin,
  Truck,
  Bell,
  Shield,
  Save,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  ArrowLeft,
  Thermometer,
  Wifi,
  Radio,
  LogOut,
  Sliders
} from 'lucide-react';
import { apiRequest, getUser, clearUser } from '../api';
import Sidebar from '../components/common/Sidebar';
import TopNavbar from '../components/common/TopNavbar';

export default function DriverSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();

  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [cityId, setCityId] = useState('');
  const [status, setStatus] = useState('available');

  // Preferences states (persisted in localStorage)
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('driver_notifications');
      return saved
        ? JSON.parse(saved)
        : {
            smsDispatch: true,
            pushAlerts: true,
            tempAlerts: true,
            soundAlerts: true
          };
    } catch {
      return {
        smsDispatch: true,
        pushAlerts: true,
        tempAlerts: true,
        soundAlerts: true
      };
    }
  });

  useEffect(() => {
    if (!user || user.role !== 'driver') {
      navigate('/login');
      return;
    }
    loadDriverProfile();
  }, []);

  async function loadDriverProfile() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest('/api/drivers/me');
      if (res && res.driver) {
        setDriver(res.driver);
        setName(res.driver.name || '');
        setContactPhone(res.driver.contact_phone || '');
        setCityId(res.driver.city_id || 'DELHI_NCR');
        setStatus(res.driver.status || 'available');
      }
    } catch (err) {
      console.error('Error fetching driver profile:', err);
      setError('Unable to load driver profile details.');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(newStatus) {
    if (savingStatus || status === newStatus) return;
    setSavingStatus(true);
    setMessage(null);
    setError(null);
    try {
      const res = await apiRequest('/api/drivers/me/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      setStatus(newStatus);
      if (driver) {
        setDriver({ ...driver, status: newStatus });
      }
      setMessage({
        type: 'success',
        text: `Availability updated to "${newStatus === 'available' ? 'On Duty (Available)' : 'Off Duty (Standby)'}".`
      });
    } catch (err) {
      console.error('Status update error:', err);
      setError(err.message || 'Failed to update availability status.');
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Driver full name is required.');
      return;
    }
    setSavingProfile(true);
    setMessage(null);
    setError(null);
    try {
      const res = await apiRequest('/api/drivers/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          contact_phone: contactPhone.trim(),
          city_id: cityId.trim()
        })
      });
      if (res && res.driver) {
        setDriver(res.driver);
      }
      setMessage({ type: 'success', text: 'Driver profile saved successfully.' });
    } catch (err) {
      console.error('Profile update error:', err);
      setError(err.message || 'Failed to update courier profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  function handleToggleNotification(key) {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    localStorage.setItem('driver_notifications', JSON.stringify(updated));
    setMessage({ type: 'success', text: 'Notification preferences updated.' });
  }

  function handleLogout() {
    clearUser();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-[#FAF7F1] text-[#22211E] overflow-hidden">
      {/* Sidebar with effective active tab = 'settings' */}
      <Sidebar
        role="driver"
        activeTab="settings"
        setActiveTab={() => {}}
        isOpen={mobileMenuOpen}
        setIsOpen={setMobileMenuOpen}
      />

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-y-auto">
        <TopNavbar
          role="driver"
          userProfile={driver}
          onMenuClick={() => setMobileMenuOpen(true)}
        />

        <main className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">
          {/* Breadcrumb & Navigation Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D7D2C7]">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-[#6F6C64]">
                <span
                  onClick={() => navigate('/driver')}
                  className="hover:text-[#22211E] cursor-pointer transition">
                  Driver Portal
                </span>
                <span>&gt;</span>
                <span className="text-[#22211E] font-semibold">Settings</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#22211E] flex items-center gap-2.5">
                <Settings size={24} className="text-[#5F684B]" />
                Settings & Preferences
              </h1>
              <p className="text-xs text-[#6F6C64]">
                Manage courier availability, contact preferences, vehicle telematics, and notification channels.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D7D2C7] bg-[#F8F5EE] hover:bg-[#EAE4D8] text-xs font-semibold text-[#22211E] transition cursor-pointer shadow-xs">
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
              <button
                onClick={loadDriverProfile}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D7D2C7] bg-[#F8F5EE] hover:bg-[#EAE4D8] text-xs font-semibold text-[#22211E] transition cursor-pointer shadow-xs disabled:opacity-50">
                <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Feedback Banners */}
          {message && (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#E8EED2] border border-[#DCE7B8] text-[#22211E] text-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={16} className="text-[#5F684B] shrink-0" />
                <span>{message.text}</span>
              </div>
              <button
                onClick={() => setMessage(null)}
                className="text-[#6F6C64] hover:text-[#22211E] text-xs font-bold">
                ×
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FDE8E8] border border-[#F8B4B4] text-[#9B1C1C] text-xs">
              <div className="flex items-center gap-2.5">
                <AlertCircle size={16} className="text-[#C81E1E] shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-[#9B1C1C] hover:text-[#771D1D] text-xs font-bold">
                ×
              </button>
            </div>
          )}

          {/* Availability & Duty Mode Card */}
          <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-5 md:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Radio size={19} className="text-[#5F684B]" />
                <div>
                  <h2 className="text-sm font-bold text-[#22211E]">Dispatch Duty & Availability</h2>
                  <p className="text-xs text-[#6F6C64]">
                    Set whether your vehicle is available to accept active food rescue dispatches.
                  </p>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase border ${
                  status === 'available'
                    ? 'bg-[#E8EED2] text-[#5F684B] border-[#DCE7B8]'
                    : 'bg-[#F2EAE5] text-[#D85C55] border-[#E8C2BD]'
                }`}>
                {status === 'available' ? 'On Duty (Active)' : 'Off Duty (Standby)'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleToggleStatus('available')}
                disabled={savingStatus}
                className={`flex items-start gap-3 p-4 rounded-xl border text-left transition cursor-pointer ${
                  status === 'available'
                    ? 'bg-[#DCE7B8] border-[#5F684B] text-[#22211E] shadow-xs'
                    : 'bg-white border-[#D7D2C7] text-[#6F6C64] hover:bg-[#FAF7F1]'
                }`}>
                <div
                  className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                    status === 'available'
                      ? 'border-[#5F684B] bg-[#5F684B]'
                      : 'border-[#6F6C64]'
                  }`}>
                  {status === 'available' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-[#22211E]">Available for Dispatches</div>
                  <div className="text-[11px] text-[#6F6C64] mt-0.5">
                    Central dispatch will route nearby surplus pickups to your vehicle in real time.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleToggleStatus('busy')}
                disabled={savingStatus}
                className={`flex items-start gap-3 p-4 rounded-xl border text-left transition cursor-pointer ${
                  status === 'busy'
                    ? 'bg-[#F2EAE5] border-[#D85C55] text-[#22211E] shadow-xs'
                    : 'bg-white border-[#D7D2C7] text-[#6F6C64] hover:bg-[#FAF7F1]'
                }`}>
                <div
                  className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${
                    status === 'busy'
                      ? 'border-[#D85C55] bg-[#D85C55]'
                      : 'border-[#6F6C64]'
                  }`}>
                  {status === 'busy' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-[#22211E]">Off Duty / Standby</div>
                  <div className="text-[11px] text-[#6F6C64] mt-0.5">
                    Temporarily pause dispatches during maintenance, breaks, or shift handover.
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Courier Profile Card */}
          <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-5 md:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[#E3DDD1]">
              <User size={19} className="text-[#5F684B]" />
              <div>
                <h2 className="text-sm font-bold text-[#22211E]">Courier Profile & Identity</h2>
                <p className="text-xs text-[#6F6C64]">
                  Update your contact details shown on donor manifests and shelter receiving slips.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#22211E] mb-1.5">
                    Courier Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    className="w-full bg-white border border-[#D7D2C7] rounded-xl px-3.5 py-2.5 text-xs text-[#22211E] focus:outline-hidden focus:border-[#5F684B]"
                    placeholder="e.g. Rahul Sharma"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#22211E] mb-1.5">
                    Direct Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    className="w-full bg-white border border-[#D7D2C7] rounded-xl px-3.5 py-2.5 text-xs text-[#22211E] focus:outline-hidden focus:border-[#5F684B]"
                    placeholder="e.g. +91 98765 43210"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#22211E] mb-1.5">
                    Operating City / Zone
                  </label>
                  <input
                    type="text"
                    value={cityId}
                    onChange={e => setCityId(e.target.value)}
                    className="w-full bg-white border border-[#D7D2C7] rounded-xl px-3.5 py-2.5 text-xs text-[#22211E] focus:outline-hidden focus:border-[#5F684B]"
                    placeholder="e.g. DELHI_NCR"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#22211E] mb-1.5">
                    Courier ID (System Assigned)
                  </label>
                  <input
                    type="text"
                    value={driver?.id || user?.profileId || ''}
                    disabled
                    className="w-full bg-[#EAE4D8]/60 border border-[#D7D2C7] rounded-xl px-3.5 py-2.5 text-xs text-[#6F6C64] font-mono select-all cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#5F684B] hover:bg-[#4D553C] text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50">
                  <Save size={14} />
                  <span>{savingProfile ? 'Saving Changes...' : 'Save Profile'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Vehicle & Cold-Chain Telematics Card */}
          <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-5 md:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3DDD1]">
              <div className="flex items-center gap-2.5">
                <Truck size={19} className="text-[#5F684B]" />
                <div>
                  <h2 className="text-sm font-bold text-[#22211E]">Vehicle & Cold-Chain Telematics</h2>
                  <p className="text-xs text-[#6F6C64]">
                    Hardware sensors monitoring safe food cargo transport temperatures.
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#E8EED2] text-[#5F684B] border border-[#DCE7B8]">
                <Wifi size={12} className="animate-pulse" />
                <span>Sensors Active</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white border border-[#D7D2C7] rounded-xl p-3.5 space-y-1">
                <div className="text-[11px] font-semibold text-[#6F6C64] uppercase tracking-wider">
                  Refrigeration Unit
                </div>
                <div className="text-xs font-bold text-[#22211E]">Dual-Zone Insulated Carrier</div>
                <div className="text-[10px] text-[#5F684B] font-medium">IoT Sensor Node FR-882</div>
              </div>

              <div className="bg-white border border-[#D7D2C7] rounded-xl p-3.5 space-y-1">
                <div className="text-[11px] font-semibold text-[#6F6C64] uppercase tracking-wider">
                  Chilled Cargo Spec
                </div>
                <div className="text-xs font-bold text-[#22211E]">≤ 4.0°C Safe Critical Limit</div>
                <div className="text-[10px] text-[#6F6C64]">Audit-ready datalogger</div>
              </div>

              <div className="bg-white border border-[#D7D2C7] rounded-xl p-3.5 space-y-1">
                <div className="text-[11px] font-semibold text-[#6F6C64] uppercase tracking-wider">
                  Prepared Warm Spec
                </div>
                <div className="text-xs font-bold text-[#22211E]">≥ 60.0°C Thermal Bain-Marie</div>
                <div className="text-[10px] text-[#6F6C64]">Continuous temp probe</div>
              </div>
            </div>
          </div>

          {/* Notification Preferences Card */}
          <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-5 md:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[#E3DDD1]">
              <Bell size={19} className="text-[#5F684B]" />
              <div>
                <h2 className="text-sm font-bold text-[#22211E]">Dispatch Notification Channels</h2>
                <p className="text-xs text-[#6F6C64]">
                  Configure how FoodRescue Operations notifies you of new missions and safety alerts.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                {
                  key: 'smsDispatch',
                  title: 'SMS Mission Dispatches',
                  desc: 'Receive immediate SMS with pickup address and donor contact upon new assignment.'
                },
                {
                  key: 'pushAlerts',
                  title: 'Real-time Browser Push Notifications',
                  desc: 'Audio-visual alert banner when a donation is matched or status changes.'
                },
                {
                  key: 'tempAlerts',
                  title: 'Critical Cold-Chain Temperature Alerts',
                  desc: 'Emergency ping if cargo compartment temperature crosses food safety thresholds.'
                },
                {
                  key: 'soundAlerts',
                  title: 'In-app Dispatch Chime',
                  desc: 'Play audible prompt when new donation assignment reaches courier portal.'
                }
              ].map(item => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-3 bg-white border border-[#D7D2C7] rounded-xl">
                  <div>
                    <div className="text-xs font-bold text-[#22211E]">{item.title}</div>
                    <div className="text-[11px] text-[#6F6C64]">{item.desc}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleNotification(item.key)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      notifications[item.key] ? 'bg-[#5F684B]' : 'bg-[#D7D2C7]'
                    }`}>
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        notifications[item.key] ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Account Security & Session Card */}
          <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-5 md:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-[#5F684B]" />
                <span className="text-xs font-bold text-[#22211E]">Authenticated Courier Session</span>
              </div>
              <p className="text-[11px] text-[#6F6C64]">
                Signed in as <span className="font-semibold text-[#22211E]">{user?.role}</span> ({user?.profileId?.slice(0, 8)}...). Access is protected by JWT bearer authentication.
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E8C2BD] bg-[#F2EAE5] hover:bg-[#EBDFD8] text-xs font-bold text-[#D85C55] transition cursor-pointer self-start sm:self-auto shadow-xs">
              <LogOut size={14} />
              <span>Sign Out of Portal</span>
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
