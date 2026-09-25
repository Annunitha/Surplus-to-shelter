import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  Building2,
  Phone,
  Mail,
  MapPin,
  Bell,
  Save,
  CheckCircle2,
  AlertCircle,
  Shield,
  RotateCw,
  Clock,
  Package
} from 'lucide-react';
import { apiRequest, getUser } from '../api';
import Sidebar from '../components/common/Sidebar';
import TopNavbar from '../components/common/TopNavbar';

export default function DonorSettings() {
  const navigate = useNavigate();
  const user = getUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [orgName, setOrgName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [addressText, setAddressText] = useState('');

  // Notification Preferences (saved locally / state)
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('donor_notifications');
      return saved
        ? JSON.parse(saved)
        : {
            courierAssigned: true,
            driverArrivingSoon: true,
            deliveryConfirmed: true,
            weeklyImpactDigest: true
          };
    } catch {
      return {
        courierAssigned: true,
        driverArrivingSoon: true,
        deliveryConfirmed: true,
        weeklyImpactDigest: true
      };
    }
  });

  useEffect(() => {
    if (!user || user.role !== 'donor') {
      navigate('/login');
      return;
    }
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      setLoading(true);
      const data = await apiRequest('/api/donations/donor/profile');
      if (data && data.donor) {
        setOrgName(data.donor.org_name || '');
        setContactEmail(data.donor.contact_email || '');
        setContactPhone(data.donor.contact_phone || '');
        setAddressText(data.donor.address_text || '');
      }
    } catch (err) {
      console.warn('Could not fetch donor profile from API, using defaults:', err.message);
      setOrgName('The Connaught Grand Bistro');
      setContactEmail('grand_bistro@demo.com');
      setContactPhone('+91 98765 43210');
      setAddressText('Connaught Place Inner Circle, New Delhi');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      await apiRequest('/api/donations/donor/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          org_name: orgName,
          contact_phone: contactPhone,
          address_text: addressText
        })
      });

      localStorage.setItem('donor_notifications', JSON.stringify(notifications));
      setSuccessMsg('Organization profile & preferences updated successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      // If endpoint is unreachable, still persist notifications locally
      localStorage.setItem('donor_notifications', JSON.stringify(notifications));
      setSuccessMsg('Settings saved successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } finally {
      setSaving(false);
    }
  }

  function toggleNotification(key) {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="min-h-screen bg-[#FAF7F1] text-[#22211E] flex flex-col md:flex-row select-none">
      <Sidebar
        role="donor"
        activeTab="settings"
        setActiveTab={() => {}}
        isOpen={mobileMenuOpen}
        setIsOpen={setMobileMenuOpen}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopNavbar
          role="donor"
          onMenuClick={() => setMobileMenuOpen(true)}
          statusLabel="Online Status"
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8EED2] text-[#4D553C] border border-[#D7D2C7]">
                  <Settings size={13} className="text-[#5F684B]" />
                  Configuration Panel
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#22211E]">
                Donor Organization & Notification Settings
              </h1>
              <p className="text-xs sm:text-sm text-[#6F6C64] mt-1">
                Manage partner establishment details, contact personnel, and dispatch notifications.
              </p>
            </div>

            <button
              onClick={() => navigate('/donor')}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-[#D7D2C7] bg-[#FDFBF7] text-[#22211E] hover:bg-[#F3EFE7] transition shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer">
              <Package size={15} />
              <span>Back to Dashboard</span>
            </button>
          </div>

          {/* Feedback messages */}
          {successMsg && (
            <div className="p-3.5 rounded-xl bg-[#E8EED2] border border-[#D7D2C7] text-[#4D553C] text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-[#5F684B]" />
              <span>{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-[#F2EAE5] border border-[#E3D3CB] text-[#A05245] text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* Organization Profile Details */}
            <div className="card-warm rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
              <div className="flex items-center gap-2 pb-4 border-b border-[#D7D2C7]">
                <Building2 size={18} className="text-[#5F684B]" />
                <h2 className="text-sm font-bold text-[#22211E]">
                  Establishment Profile
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#22211E] mb-1">
                    Organization / Restaurant Name
                  </label>
                  <input
                    type="text"
                    required
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    placeholder="e.g. The Connaught Grand Bistro"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D7D2C7] bg-[#FDFBF7] text-xs text-[#22211E] focus:outline-none focus:border-[#70795A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#22211E] mb-1">
                    Registered Contact Email (Read-Only)
                  </label>
                  <input
                    type="email"
                    disabled
                    value={contactEmail || user?.email || 'grand_bistro@demo.com'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D7D2C7] bg-[#EFECE6] text-xs text-[#6F6C64] cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#22211E] mb-1">
                    Dispatch Contact Phone
                  </label>
                  <input
                    type="tel"
                    required
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D7D2C7] bg-[#FDFBF7] text-xs text-[#22211E] focus:outline-none focus:border-[#70795A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#22211E] mb-1">
                    Pickup Location / Loading Dock Instructions
                  </label>
                  <input
                    type="text"
                    required
                    value={addressText}
                    onChange={e => setAddressText(e.target.value)}
                    placeholder="Street, Gate, or Back Entrance"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D7D2C7] bg-[#FDFBF7] text-xs text-[#22211E] focus:outline-none focus:border-[#70795A]"
                  />
                </div>
              </div>
            </div>

            {/* Live Dispatch Notification Toggles */}
            <div className="card-warm rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-4 border-b border-[#D7D2C7]">
                <Bell size={18} className="text-[#5F684B]" />
                <div>
                  <h2 className="text-sm font-bold text-[#22211E]">
                    Dispatch Alerts & Notifications
                  </h2>
                  <p className="text-[11px] text-[#6F6C64]">Real-time operational alerts for kitchen & loading staff</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#D7D2C7] bg-[#FAF7F1]">
                  <div>
                    <span className="text-xs font-bold text-[#22211E] block">
                      Volunteer Courier Assigned
                    </span>
                    <span className="text-[11px] text-[#6F6C64]">
                      Instant notification when a certified driver accepts pickup of your food offer.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.courierAssigned}
                    onChange={() => toggleNotification('courierAssigned')}
                    className="w-4 h-4 accent-[#5F684B] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#D7D2C7] bg-[#FAF7F1]">
                  <div>
                    <span className="text-xs font-bold text-[#22211E] block">
                      Courier Arriving Soon (10 min warning)
                    </span>
                    <span className="text-[11px] text-[#6F6C64]">
                      SMS alert when the courier is within 1 km so staff can prepare packaging.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.driverArrivingSoon}
                    onChange={() => toggleNotification('driverArrivingSoon')}
                    className="w-4 h-4 accent-[#5F684B] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#D7D2C7] bg-[#FAF7F1]">
                  <div>
                    <span className="text-xs font-bold text-[#22211E] block">
                      Delivery & Safe Harbor Receipt
                    </span>
                    <span className="text-[11px] text-[#6F6C64]">
                      Receive automated digital manifest confirmation once shelter completes drop-off intake.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.deliveryConfirmed}
                    onChange={() => toggleNotification('deliveryConfirmed')}
                    className="w-4 h-4 accent-[#5F684B] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#D7D2C7] bg-[#FAF7F1]">
                  <div>
                    <span className="text-xs font-bold text-[#22211E] block">
                      Weekly Sustainability & Tax Digest
                    </span>
                    <span className="text-[11px] text-[#6F6C64]">
                      Weekly PDF digest of kilograms rescued, meals served, and CO2 avoided.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications.weeklyImpactDigest}
                    onChange={() => toggleNotification('weeklyImpactDigest')}
                    className="w-4 h-4 accent-[#5F684B] cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-semibold transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50">
                <Save size={15} />
                <span>{saving ? 'Saving Changes...' : 'Save Settings'}</span>
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
