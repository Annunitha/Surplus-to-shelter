import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Inbox,
  SlidersHorizontal,
  Clock,
  MapPin,
  Truck,
  Save,
  RotateCw,
  Package,
  CookingPot,
  Leaf,
  Croissant,
  Milk,
  MoreHorizontal,
  Snowflake,
  Info,
  Check,
  CheckCircle2,
  X,
  AlertTriangle,
  ChevronRight,
  ArrowRight,
  UtensilsCrossed,
  LayoutGrid
} from 'lucide-react';
import { apiRequest, getUser, clearUser } from '../api';
import { getSocket } from '../socket';
import { supabase } from '../lib/supabaseClient';
import Sidebar from '../components/common/Sidebar';
import TopNavbar from '../components/common/TopNavbar';
import StatusBadge from '../components/common/StatusBadge';
import KpiCard from '../components/common/KpiCard';

export default function RecipientDashboard({ initialTab }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const [profile, setProfile] = useState(null);
  const [offers, setOffers] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [notification, setNotification] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Tab resolution: URL takes precedence, fallback to initialTab, then 'dashboard'
  const path = location.pathname;
  const currentTab =
    initialTab ||
    (path.startsWith('/recipient/offers')
      ? 'offers'
      : path.startsWith('/recipient/settings') || path.startsWith('/recipient/capacity')
      ? 'settings'
      : path.startsWith('/recipient/deliveries') || path.startsWith('/recipient/history')
      ? 'deliveries'
      : 'dashboard');

  const [activeTab, setActiveTab] = useState(currentTab);

  useEffect(() => {
    setActiveTab(currentTab);
  }, [currentTab]);

  // Controlled form state for Capacity & Preferences
  const [currentCapacity, setCurrentCapacity] = useState('61');
  const [maxCapacity, setMaxCapacity] = useState('85');
  const [selectedFoodTypes, setSelectedFoodTypes] = useState([
    'prepared_meals',
    'produce',
    'bakery',
    'dairy'
  ]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationError, setValidationError] = useState('');

  const foodCategories = [
    { value: 'prepared_meals', label: 'Prepared Meals', icon: CookingPot },
    { value: 'produce', label: 'Produce', icon: Leaf },
    { value: 'bakery', label: 'Bakery', icon: Croissant },
    { value: 'dairy', label: 'Dairy', icon: Milk },
    { value: 'dry_goods', label: 'Dry Goods', icon: Package },
    { value: 'other', label: 'Other', icon: MoreHorizontal }
  ];

  useEffect(() => {
    if (!user || user.role !== 'recipient') {
      navigate('/login');
      return;
    }
    loadData();

    const profileId = user.profileId;
    let channel = null;

    if (supabase) {
      channel = supabase
        .channel(`recipient-realtime-${profileId || 'global'}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'donations',
            ...(profileId ? { filter: `matched_recipient_id=eq.${profileId}` } : {})
          },
          payload => {
            console.log('Realtime Supabase donation update received:', payload);
            if (payload.eventType === 'INSERT') {
              setNotification({
                type: 'info',
                message: `🍲 New surplus food offer: ${payload.new.food_description || 'Surplus Batch'} (${payload.new.quantity || ''} ${payload.new.unit || ''})`
              });
            }
            fetchOffers();
            fetchDashboardStats();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'recipients',
            ...(profileId ? { filter: `id=eq.${profileId}` } : {})
          },
          payload => {
            console.log('Realtime Supabase recipient update received:', payload);
            if (payload.new) {
              setProfile(payload.new);
              setCurrentCapacity(String(payload.new.capacity_current ?? 0));
              setMaxCapacity(String(payload.new.capacity_max ?? 0));
              if (payload.new.accepted_food_types) {
                setSelectedFoodTypes(payload.new.accepted_food_types);
              }
            }
          }
        )
        .subscribe();
    }

    const socket = getSocket();
    function handleNewOffer(offer) {
      setNotification({
        type: 'info',
        message: `🍲 New surplus food offer: ${offer.food_description} (${offer.quantity} ${offer.unit})`
      });
      fetchOffers();
      fetchDashboardStats();
    }

    function handleStatusChanged({ donationId, status }) {
      if (status !== 'posted') {
        setOffers(prev => prev.filter(o => o.id !== donationId));
      }
      fetchProfile();
      fetchDashboardStats();
    }

    socket.on('offer:new', handleNewOffer);
    socket.on('donation:status_changed', handleStatusChanged);

    const interval = setInterval(() => {
      setOffers(prev =>
        prev.map(o => ({
          ...o,
          expires_in_seconds: Math.max(0, (o.expires_in_seconds || 0) - 1),
          offer_timeout_remaining_seconds: Math.max(0, (o.offer_timeout_remaining_seconds || 0) - 1)
        }))
      );
    }, 1000);

    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
      socket.off('offer:new', handleNewOffer);
      socket.off('donation:status_changed', handleStatusChanged);
      clearInterval(interval);
    };
  }, []);

  async function loadData() {
    setLoading(true);
    await Promise.all([fetchProfile(), fetchOffers(), fetchDashboardStats()]);
    setLoading(false);
  }

  async function fetchDashboardStats(currentProfileId = user?.profileId) {
    if (!currentProfileId) return;
    if (supabase) {
      try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const availableQuery = supabase
          .from('donations')
          .select('id', { count: 'exact' })
          .eq('matched_recipient_id', currentProfileId)
          .eq('status', 'posted')
          .gt('expiry_window_end', new Date().toISOString());

        const acceptedQuery = supabase
          .from('donations')
          .select('id', { count: 'exact' })
          .eq('matched_recipient_id', currentProfileId)
          .in('status', ['matched', 'picked_up', 'in_transit']);

        const incomingQuery = supabase
          .from('donations')
          .select('id', { count: 'exact' })
          .eq('matched_recipient_id', currentProfileId)
          .in('status', ['picked_up', 'in_transit']);

        const receivedTodayQuery = supabase
          .from('donations')
          .select('id', { count: 'exact' })
          .eq('matched_recipient_id', currentProfileId)
          .eq('status', 'delivered')
          .gte('posted_at', todayStart.toISOString());

        const recentQuery = supabase
          .from('donations')
          .select('id, food_description, food_type, quantity, unit, status, posted_at, donors:donor_id(org_name), drivers:matched_driver_id(full_name)')
          .eq('matched_recipient_id', currentProfileId)
          .order('posted_at', { ascending: false })
          .limit(10);

        const [
          { count: availableCount, error: err1 },
          { count: acceptedCount, error: err2 },
          { count: incomingCount, error: err3 },
          { count: receivedCount, error: err4 },
          { data: recentData, error: err5 }
        ] = await Promise.all([
          availableQuery,
          acceptedQuery,
          incomingQuery,
          receivedTodayQuery,
          recentQuery
        ]);

        if (!err1 && !err2 && !err3 && !err4 && recentData) {
          const formattedRecent = (recentData || []).map(d => ({
            id: d.id,
            food_description: d.food_description,
            food_type: d.food_type,
            quantity: d.quantity,
            unit: d.unit,
            status: d.status,
            posted_at: d.posted_at,
            donor_name: d.donors?.org_name || 'Verified Donor',
            driver_name: d.drivers?.full_name || 'Assigned Courier'
          }));

          setDashboardStats({
            stats: {
              available_offers: availableCount ?? 0,
              accepted_donations: acceptedCount ?? 0,
              incoming_deliveries: incomingCount ?? 0,
              received_today: receivedCount ?? 0
            },
            recent_donations: formattedRecent
          });
          return;
        }
      } catch (supabaseErr) {
        console.warn('Supabase direct stats query failed, falling back to API:', supabaseErr);
      }
    }

    try {
      const data = await apiRequest('/api/recipients/me/dashboard');
      if (data) {
        setDashboardStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    }
  }

  async function fetchProfile(currentProfileId = user?.profileId) {
    if (!currentProfileId) return;
    if (supabase) {
      try {
        const { data: recipient, error } = await supabase
          .from('recipients')
          .select('*')
          .eq('id', currentProfileId)
          .single();

        if (!error && recipient) {
          setProfile(recipient);
          setCurrentCapacity(String(recipient.capacity_current ?? 61));
          setMaxCapacity(String(recipient.capacity_max ?? 85));
          setSelectedFoodTypes(
            Array.isArray(recipient.accepted_food_types) && recipient.accepted_food_types.length > 0
              ? recipient.accepted_food_types
              : ['prepared_meals', 'produce', 'bakery', 'dairy']
          );
          return;
        }
      } catch (supabaseErr) {
        console.warn('Supabase profile query failed, using API fallback:', supabaseErr);
      }
    }

    try {
      const data = await apiRequest('/api/recipients/me');
      if (data && data.recipient) {
        const r = data.recipient;
        setProfile(r);
        setCurrentCapacity(String(r.capacity_current ?? 61));
        setMaxCapacity(String(r.capacity_max ?? 85));
        setSelectedFoodTypes(
          Array.isArray(r.accepted_food_types) && r.accepted_food_types.length > 0
            ? r.accepted_food_types
            : ['prepared_meals', 'produce', 'bakery', 'dairy']
        );
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  }

  async function fetchOffers(currentProfileId = user?.profileId) {
    if (!currentProfileId) return;
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('donations')
          .select('*, donors:donor_id(org_name, contact_phone)')
          .eq('matched_recipient_id', currentProfileId)
          .eq('status', 'posted')
          .gt('expiry_window_end', new Date().toISOString())
          .order('posted_at', { ascending: false });

        if (!error && data) {
          const now = new Date();
          const formattedOffers = data.map(o => {
            const expiryDate = new Date(o.expiry_window_end);
            const diffSecs = Math.max(0, Math.floor((expiryDate - now) / 1000));
            return {
              ...o,
              expires_in_seconds: diffSecs,
              offer_timeout_remaining_seconds: o.offer_timeout_remaining_seconds || diffSecs
            };
          });
          setOffers(formattedOffers);
          return;
        }
      } catch (supabaseErr) {
        console.warn('Supabase offers query failed, using API fallback:', supabaseErr);
      }
    }

    try {
      const data = await apiRequest('/api/recipients/me/offers');
      setOffers(data.offers || []);
    } catch (err) {
      console.error('Failed to fetch offers:', err);
    }
  }

  function handleCancelSettings() {
    setValidationError('');
    setSaveSuccess(false);
    if (profile) {
      setCurrentCapacity(String(profile.capacity_current ?? 61));
      setMaxCapacity(String(profile.capacity_max ?? 85));
      setSelectedFoodTypes(
        Array.isArray(profile.accepted_food_types) && profile.accepted_food_types.length > 0
          ? profile.accepted_food_types
          : ['prepared_meals', 'produce', 'bakery', 'dairy']
      );
    }
    setNotification({
      type: 'info',
      message: 'Unsaved modifications discarded. Restored last saved settings.'
    });
  }

  async function handleSaveSettings(e) {
    if (e) e.preventDefault();
    setValidationError('');
    setSaveSuccess(false);

    const cur = parseFloat(currentCapacity);
    const max = parseFloat(maxCapacity);

    if (isNaN(cur) || cur < 0) {
      setValidationError('Current capacity must be a non-negative number.');
      return;
    }
    if (isNaN(max) || max <= 0) {
      setValidationError('Max capacity must be a positive number.');
      return;
    }
    if (cur > max) {
      setValidationError('Current capacity cannot exceed maximum capacity.');
      return;
    }
    if (!selectedFoodTypes || selectedFoodTypes.length === 0) {
      setValidationError('Please select at least one accepted food category.');
      return;
    }

    setSavingSettings(true);
    try {
      // 1. Direct Supabase Update
      if (user?.profileId) {
        await supabase
          .from('recipients')
          .update({
            capacity_current: cur,
            capacity_max: max,
            accepted_food_types: selectedFoodTypes,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.profileId);
      }

      // 2. Sync with API endpoint
      const res = await apiRequest('/api/recipients/me', {
        method: 'PATCH',
        body: JSON.stringify({
          capacity_current: cur,
          capacity_max: max,
          accepted_food_types: selectedFoodTypes
        })
      });

      if (res && res.recipient) {
        setProfile(res.recipient);
        setCurrentCapacity(String(res.recipient.capacity_current));
        setMaxCapacity(String(res.recipient.capacity_max));
        setSelectedFoodTypes(res.recipient.accepted_food_types || []);
      }
      setSaveSuccess(true);
      setNotification({
        type: 'success',
        message: 'Capacity and food preferences successfully saved to database.'
      });
      setTimeout(() => setSaveSuccess(false), 4000);
      fetchDashboardStats();
    } catch (err) {
      console.error('Save settings error:', err);
      setValidationError(err.message || 'Unable to save changes. Please try again.');
    } finally {
      setSavingSettings(false);
    }
  }

  function toggleFoodCategory(type) {
    setSelectedFoodTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  }

  async function handleAccept(offerId) {
    setActionLoading(offerId);
    try {
      await apiRequest(`/api/recipients/me/offers/${offerId}/accept`, {
        method: 'POST'
      });
      setNotification({
        type: 'success',
        message: 'Offer accepted! Dispatcher is now routing the nearest volunteer courier for pickup.'
      });
      await Promise.all([fetchProfile(), fetchOffers(), fetchDashboardStats()]);
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(offerId) {
    setActionLoading(offerId);
    try {
      await apiRequest(`/api/recipients/me/offers/${offerId}/reject`, {
        method: 'POST'
      });
      setNotification({
        type: 'info',
        message: 'Offer declined. The system has automatically cascaded the batch to the next eligible shelter.'
      });
      setOffers(prev => prev.filter(o => o.id !== offerId));
      fetchDashboardStats();
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setActionLoading(null);
    }
  }

  function formatCountdown(secs) {
    if (secs == null || secs <= 0) return 'Expired';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  }

  // Dynamic calculations for utilization and available slots
  const curNum = parseFloat(currentCapacity) || 0;
  const maxNum = parseFloat(maxCapacity) || 0;
  const utilization = maxNum > 0 ? Math.round((curNum / maxNum) * 100) : 0;
  const availableSlots = Math.max(0, maxNum - curNum);
  const isFull = maxNum > 0 && curNum >= maxNum;

  // Format last updated timestamp from real profile data
  function formatLastUpdated(dateString) {
    if (!dateString) return 'today at 09:15 AM';
    try {
      const d = new Date(dateString);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (isToday) {
        return `today at ${timeStr}`;
      }
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
    } catch {
      return 'today at 09:15 AM';
    }
  }

  const lastUpdatedDisplay = formatLastUpdated(profile?.updated_at || profile?.created_at);

  return (
    <div className="min-h-screen bg-[#FAF7F1] text-[#22211E] flex flex-col md:flex-row">
      {/* LEFT SIDEBAR */}
      <Sidebar
        role="recipient"
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={mobileMenuOpen}
        setIsOpen={setMobileMenuOpen}
      />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP HEADER */}
        <TopNavbar
          role="recipient"
          userProfile={profile}
          onMenuClick={() => setMobileMenuOpen(true)}
          statusLabel="Shelter Online • Receiving Mode"
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {/* Notification Banner */}
          {notification && (
            <div className="max-w-[860px] mx-auto mb-4">
              <div
                className={`p-4 rounded-2xl flex items-center justify-between text-xs font-semibold border ${
                  notification.type === 'success'
                    ? 'bg-[#E8EED2] border-[#D7D2C7] text-[#4D553C]'
                    : notification.type === 'error'
                    ? 'bg-[#F2EAE5] border-[#E3D3CB] text-[#A05245]'
                    : 'bg-[#F3EFE7] border-[#D7D2C7] text-[#5F684B]'
                }`}>
                <span>{notification.message}</span>
                <button
                  onClick={() => setNotification(null)}
                  className="text-[#6F6C64] hover:text-[#22211E] text-sm ml-4 cursor-pointer">
                  ✕
                </button>
              </div>
            </div>
          )}

          {activeTab === 'settings' ? (
            /* CAPACITY & FOOD PREFERENCES PAGE (MATCHING SCREENSHOT) */
            <div className="space-y-3.5 pb-6">
              {/* BREADCRUMB */}
              <div className="max-w-[840px] mx-auto flex items-center gap-1.5 text-xs text-[#6F6C64] px-1 select-none">
                <span>Shelter Settings</span>
                <span className="text-[#99958B]">›</span>
                <span className="font-bold text-[#22211E]">Capacity & Food Preferences</span>
              </div>

              {/* MAIN CARD */}
              <div className="max-w-[840px] mx-auto bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-6 sm:p-8 md:p-9 shadow-xs">
                {/* CARD HEADER */}
                <div className="pb-5 border-b border-[#D7D2C7]">
                  <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#22211E]">
                    Update Capacity & Preferences
                  </h1>
                  <p className="text-xs sm:text-[13px] text-[#6F6C64] mt-1 leading-relaxed">
                    Manage your shelter live capacity limits and eligible food surplus categories for incoming offers.
                  </p>
                </div>

                {/* Validation Error Banner */}
                {validationError && (
                  <div className="mt-4 p-3 rounded-xl bg-[#F2EAE5] border border-[#E3D3CB] text-[#A05245] text-xs font-semibold flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={15} className="shrink-0" />
                      <span>{validationError}</span>
                    </div>
                    <button
                      onClick={() => setValidationError('')}
                      className="text-[#A05245] hover:text-[#22211E] ml-2 cursor-pointer font-bold">
                      ✕
                    </button>
                  </div>
                )}

                {/* Success Banner */}
                {saveSuccess && (
                  <div className="mt-4 p-3 rounded-xl bg-[#E8EED2] border border-[#D7D2C7] text-[#4D553C] text-xs font-semibold flex items-center gap-2">
                    <Check size={15} className="shrink-0 text-[#5F684B]" />
                    <span>Save successful. Capacity and preferences updated live.</span>
                  </div>
                )}

                {/* MAIN CONFIGURATION (TWO-COLUMN LAYOUT) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
                  {/* LEFT COLUMN — CAPACITY CONFIGURATION */}
                  <div className="space-y-4 md:border-r md:border-[#D7D2C7] md:pr-8">
                    {/* Section Heading */}
                    <div className="flex items-center gap-2 text-[#22211E]">
                      <SlidersHorizontal size={17} strokeWidth={2.2} className="text-[#22211E]" />
                      <h2 className="text-base font-bold tracking-tight">Capacity Configuration</h2>
                    </div>

                    {/* Current Capacity Input */}
                    <div>
                      <label className="block text-xs font-semibold text-[#22211E] mb-1.5">
                        Current capacity
                      </label>
                      <div className="relative flex items-center bg-white rounded-xl border border-[#D7D2C7] focus-within:border-[#5F684B] focus-within:ring-2 focus-within:ring-[#5F684B]/15 overflow-hidden transition shadow-2xs h-10.5">
                        <input
                          type="number"
                          min="0"
                          value={currentCapacity}
                          onChange={e => {
                            setCurrentCapacity(e.target.value);
                            setValidationError('');
                          }}
                          className="w-full px-3.5 bg-transparent text-sm font-semibold text-[#22211E] focus:outline-none"
                          placeholder="e.g. 61"
                        />
                        <span className="pr-3.5 text-xs font-normal text-[#99958B] select-none shrink-0 pointer-events-none">
                          meals / ppl
                        </span>
                      </div>
                      <p className="text-[11px] text-[#99958B] mt-1.5">
                        Active meals stored or current guest head count
                      </p>
                    </div>

                    {/* Max Capacity Input */}
                    <div>
                      <label className="block text-xs font-semibold text-[#22211E] mb-1.5">
                        Max capacity
                      </label>
                      <div className="relative flex items-center bg-white rounded-xl border border-[#D7D2C7] focus-within:border-[#5F684B] focus-within:ring-2 focus-within:ring-[#5F684B]/15 overflow-hidden transition shadow-2xs h-10.5">
                        <input
                          type="number"
                          min="1"
                          value={maxCapacity}
                          onChange={e => {
                            setMaxCapacity(e.target.value);
                            setValidationError('');
                          }}
                          className="w-full px-3.5 bg-transparent text-sm font-semibold text-[#22211E] focus:outline-none"
                          placeholder="e.g. 85"
                        />
                        <span className="pr-3.5 text-xs font-normal text-[#99958B] select-none shrink-0 pointer-events-none">
                          meals / ppl
                        </span>
                      </div>
                      <p className="text-[11px] text-[#99958B] mt-1.5">
                        Threshold before incoming offers are automatically paused
                      </p>
                    </div>

                    {/* UTILIZATION CARD */}
                    <div className="border border-[#D7D2C7] rounded-xl p-3.5 sm:p-4 bg-white/50 shadow-2xs mt-4">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-[#6F6C64] font-medium">Utilization Status</span>
                        <span className={`font-bold ${isFull ? 'text-[#A05245]' : 'text-[#22211E]'}`}>
                          {utilization}% utilized
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 rounded-full bg-[#E5DFD5] overflow-hidden my-2.5">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isFull ? 'bg-[#A05245]' : 'bg-[#5F684B]'
                          }`}
                          style={{ width: `${Math.min(100, utilization)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#6F6C64] font-medium">
                        <span>{curNum} used</span>
                        <span>{availableSlots} available slots</span>
                      </div>

                      {/* 100% Capacity Full Indicator */}
                      {isFull && (
                        <div className="mt-2.5 p-2 rounded-lg bg-[#F2EAE5] border border-[#E3D3CB] text-[#A05245] text-[11px] font-bold flex items-center gap-1.5">
                          <AlertTriangle size={13} className="shrink-0" />
                          <span>Receiving capacity reached (Incoming offers paused)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT COLUMN — ACCEPTED FOOD TYPES */}
                  <div className="space-y-4 md:pl-2">
                    {/* Section Heading & Subtitle */}
                    <div>
                      <div className="flex items-center gap-2 text-[#22211E]">
                        <UtensilsCrossed size={17} strokeWidth={2.2} className="text-[#22211E]" />
                        <h2 className="text-base font-bold tracking-tight">Accepted food types</h2>
                      </div>
                      <p className="text-xs text-[#6F6C64] mt-0.5">
                        Select all categories your kitchen and storage facilities can safely receive
                      </p>
                    </div>

                    {/* 2-Column Responsive Grid of Categories */}
                    <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                      {foodCategories.map(cat => {
                        const Icon = cat.icon;
                        const isSelected = selectedFoodTypes.includes(cat.value);

                        return (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => toggleFoodCategory(cat.value)}
                            className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#5F684B] text-white border-[#5F684B] shadow-2xs'
                                : 'bg-[#FAF7F1] text-[#22211E] border-[#D7D2C7] hover:bg-[#F3EFE7] hover:border-[#99958B]'
                            }`}>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon
                                size={16}
                                strokeWidth={2}
                                className={isSelected ? 'text-white' : 'text-[#6F6C64]'}
                              />
                              <span className="truncate">{cat.label}</span>
                            </div>
                            {isSelected && (
                              <Check size={15} strokeWidth={2.4} className="text-white shrink-0 ml-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* COLD CHAIN INFORMATION CARD */}
                    <div className="p-3.5 rounded-xl bg-[#E8EED2]/85 border border-[#D2DDB5] flex items-start gap-2.5 text-xs leading-relaxed text-[#4D553C] shadow-2xs mt-3.5">
                      <Snowflake size={17} className="text-[#5F684B] shrink-0 mt-0.5" />
                      <div className="text-[11px] leading-[1.5]">
                        <strong className="text-[#22211E] font-bold">Cold chain compliance:</strong>{' '}
                        Selecting dairy or prepared items automatically flags incoming couriers for insulated transport containers.
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD FOOTER */}
                <div className="pt-4 mt-2 border-t border-[#D7D2C7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Last updated timestamp */}
                  <div className="flex items-center gap-2 text-xs text-[#6F6C64]">
                    <Clock size={14} className="text-[#6F6C64] shrink-0" />
                    <span>Last updated {lastUpdatedDisplay}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleCancelSettings}
                      disabled={savingSettings}
                      className="px-4 py-2 rounded-xl border border-[#D7D2C7] bg-[#FAF7F1] text-[#22211E] hover:bg-[#F3EFE7] text-xs font-semibold transition cursor-pointer disabled:opacity-50">
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSettings}
                      disabled={savingSettings}
                      className="px-5 py-2 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                      <Save size={14} strokeWidth={2.2} />
                      <span>{savingSettings ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* BOTTOM INFORMATION BAR */}
              <div className="max-w-[840px] mx-auto rounded-xl sm:rounded-2xl border border-[#D7D2C7] bg-[#F8F5EE] p-3 sm:p-3.5 px-4 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap shadow-2xs">
                <div className="flex items-center gap-2.5 text-xs text-[#22211E]">
                  <Info size={17} className="text-[#6F6C64] shrink-0" />
                  <span>
                    Automatic dispatch pauses immediately once threshold hits 100% capacity to prevent food spoilage.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRulesModal(true)}
                  className="text-xs font-semibold text-[#22211E] hover:text-[#5F684B] flex items-center gap-1 cursor-pointer shrink-0 transition">
                  <span>Review dispatch rules</span>
                  <ArrowRight size={13} className="shrink-0" />
                </button>
              </div>
            </div>
          ) : currentTab === 'offers' ? (
            /* DEDICATED OFFERS VIEW */
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-[#6F6C64] mb-1">
                    <span onClick={() => navigate('/recipient')} className="hover:text-[#22211E] cursor-pointer">Shelter Portal</span>
                    <span className="text-[#99958B]">›</span>
                    <span className="font-bold text-[#22211E]">New Offers</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#22211E]">
                    Available Food Offers
                  </h1>
                  <p className="text-xs sm:text-sm text-[#6F6C64] mt-1">
                    Review and claim surplus food donations before their pickup windows close.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={loadData}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#D7D2C7] bg-[#FDFBF7] text-[#22211E] hover:bg-[#F3EFE7] text-xs font-semibold transition cursor-pointer">
                    <RotateCw size={14} />
                    <span>Refresh Offers</span>
                  </button>

                  <button
                    onClick={() => navigate('/recipient/settings')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer">
                    <SlidersHorizontal size={14} />
                    <span>Settings & Preferences</span>
                  </button>
                </div>
              </div>

              {/* 3 Overview Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Shelter Online / Info */}
                <div className="card-warm rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center justify-between text-xs text-[#6F6C64] mb-2 font-semibold">
                    <span className="uppercase tracking-wider">Facility Intake Status</span>
                    <span className="w-2 h-2 rounded-full bg-[#5F684B] animate-pulse" />
                  </div>
                  <h3 className="text-base font-bold text-[#22211E] truncate">
                    {profile?.org_name || 'Hope Community Shelter'}
                  </h3>
                  <p className="text-xs text-[#6F6C64] mt-1 flex items-center gap-1.5 truncate">
                    <MapPin size={12} className="text-[#5F684B] shrink-0" />
                    <span className="truncate">{profile?.address_text || 'Zone 4 East Central'}</span>
                  </p>
                </div>

                {/* Storage Capacity Gauge */}
                <div className="card-warm rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center justify-between text-xs text-[#6F6C64] mb-2 font-semibold">
                    <span className="uppercase tracking-wider">Storage Capacity</span>
                    <span className="text-[#5F684B] font-bold">{utilization}% utilized</span>
                  </div>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-2xl font-extrabold text-[#22211E]">
                      {curNum}
                    </span>
                    <span className="text-xs text-[#6F6C64]">of {maxNum} meals/ppl</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#EFECE6] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isFull ? 'bg-[#B85C50]' : 'bg-[#5F684B]'
                      }`}
                      style={{ width: `${Math.min(100, utilization)}%` }}
                    />
                  </div>
                </div>

                {/* Courier Readiness */}
                <div className="card-warm rounded-2xl p-5 shadow-xs">
                  <div className="flex items-center justify-between text-xs text-[#6F6C64] mb-2 font-semibold">
                    <span className="uppercase tracking-wider">Courier Readiness</span>
                    <Truck size={15} className="text-[#5F684B]" />
                  </div>
                  <p className="text-2xl font-extrabold text-[#22211E]">3 Available</p>
                  <p className="text-xs text-[#6F6C64] mt-1">
                    Avg pickup dispatch SLA: <strong className="text-[#22211E]">~8.4 mins</strong>
                  </p>
                </div>
              </div>

              {/* Offers Grid */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#22211E]">
                    Available Rescues Awaiting Acceptance ({offers.length})
                  </h2>
                  <span className="text-xs text-[#6F6C64]">
                    Sorted by proximity & expiry priority
                  </span>
                </div>

                {loading ? (
                  <div className="py-20 text-center text-xs text-[#6F6C64]">
                    Loading nearby food offers...
                  </div>
                ) : offers.length === 0 ? (
                  <div className="card-warm rounded-2xl p-12 text-center shadow-xs">
                    <div className="w-12 h-12 rounded-2xl bg-[#E8EED2] text-[#5F684B] flex items-center justify-center mx-auto mb-3">
                      <Inbox size={22} />
                    </div>
                    <p className="text-sm font-bold text-[#22211E]">No active offers right now</p>
                    <p className="text-xs text-[#6F6C64] mt-1 max-w-sm mx-auto">
                      When donors post surplus matching your capacity and accepted categories, they will appear here in real-time.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {offers.map(offer => {
                      const isActing = actionLoading === offer.id;
                      const timeoutSecs = offer.offer_timeout_remaining_seconds;

                      return (
                        <div
                          key={offer.id}
                          className="card-warm rounded-2xl p-5 flex flex-col justify-between space-y-4 border border-[#D7D2C7] shadow-xs">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-base font-bold text-[#22211E]">
                                {offer.food_description}
                              </h3>
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#E8EED2] text-[#4D553C] border border-[#D7D2C7] shrink-0">
                                {offer.food_type.replace('_', ' ')}
                              </span>
                            </div>

                            <p className="text-xs text-[#6F6C64] mt-1">
                              Quantity: <strong className="text-[#22211E]">{offer.quantity} {offer.unit}</strong>
                              {offer.weight_kg && ` (~${offer.weight_kg} kg)`}
                            </p>

                            <div className="grid grid-cols-2 gap-2 mt-4 text-xs bg-[#FAF7F1] p-3 rounded-xl border border-[#D7D2C7]">
                              <div>
                                <span className="text-[#99958B] text-[10px] uppercase font-bold block">
                                  Proximity
                                </span>
                                <span className="font-semibold text-[#22211E]">
                                  {offer.distance_km ? `${offer.distance_km} km away` : 'Nearby'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[#99958B] text-[10px] uppercase font-bold block">
                                  Offer Decision Timeout
                                </span>
                                <span className={`font-semibold ${timeoutSecs != null && timeoutSecs < 60 ? 'text-[#A05245] animate-pulse' : 'text-[#5F684B]'}`}>
                                  ⏱ {formatCountdown(timeoutSecs)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-[#D7D2C7]">
                            <button
                              onClick={() => handleReject(offer.id)}
                              disabled={isActing}
                              className="flex-1 py-2 rounded-xl border border-[#D7D2C7] bg-[#FDFBF7] text-[#A05245] hover:bg-[#F2EAE5] text-xs font-semibold transition cursor-pointer disabled:opacity-50">
                              Decline
                            </button>
                            <button
                              onClick={() => handleAccept(offer.id)}
                              disabled={isActing}
                              className="flex-2 py-2 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-semibold transition shadow-xs cursor-pointer disabled:opacity-50">
                              {isActing ? 'Processing...' : 'Accept Offer'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* MAIN SHELTER PORTAL DASHBOARD OVERVIEW */
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D7D2C7]">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-[#6F6C64] mb-1">
                    <span>FoodRescue</span>
                    <span className="text-[#99958B]">›</span>
                    <span className="font-bold text-[#22211E]">Shelter Portal</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#22211E]">
                    Shelter Overview
                  </h1>
                  <p className="text-xs sm:text-sm text-[#6F6C64] mt-0.5">
                    Live surplus food allocations, active transit deliveries, and facility intake capacity.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E8EED2] text-[#4D553C] border border-[#DCE7B8]">
                    <span className="w-2 h-2 rounded-full bg-[#5F684B] animate-pulse" />
                    <span>Shelter Online • Receiving Mode</span>
                  </span>
                  <button
                    onClick={loadData}
                    className="p-2 rounded-xl border border-[#D7D2C7] bg-[#F8F5EE] hover:bg-[#EAE4D8] text-[#22211E] transition cursor-pointer shadow-xs">
                    <RotateCw size={15} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* 4 KPI Summary Cards (Required by Section 6) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Available Offers Card */}
                <div
                  onClick={() => navigate('/recipient/offers')}
                  className="card-warm rounded-2xl p-5 shadow-xs border border-[#D7D2C7] cursor-pointer hover:border-[#5F684B] transition-all">
                  <div className="flex items-center justify-between text-xs text-[#6F6C64] mb-2 font-semibold">
                    <span className="uppercase tracking-wider">Available Offers</span>
                    <Inbox size={17} className="text-[#5F684B]" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-extrabold text-[#22211E]">
                      {dashboardStats?.stats?.available_offers ?? offers.length}
                    </span>
                    <span className="text-xs text-[#5F684B] font-semibold flex items-center gap-0.5">
                      View Offers <ArrowRight size={12} />
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6F6C64] mt-1">Pending allocation batches</p>
                </div>

                {/* Accepted Donations Card */}
                <div className="card-warm rounded-2xl p-5 shadow-xs border border-[#D7D2C7]">
                  <div className="flex items-center justify-between text-xs text-[#6F6C64] mb-2 font-semibold">
                    <span className="uppercase tracking-wider">Accepted Donations</span>
                    <Package size={17} className="text-[#5F684B]" />
                  </div>
                  <div className="text-3xl font-extrabold text-[#22211E]">
                    {dashboardStats?.stats?.accepted_donations ?? 0}
                  </div>
                  <p className="text-[11px] text-[#6F6C64] mt-1">Approved & in pipeline</p>
                </div>

                {/* Incoming Deliveries Card */}
                <div className="card-warm rounded-2xl p-5 shadow-xs border border-[#D7D2C7]">
                  <div className="flex items-center justify-between text-xs text-[#6F6C64] mb-2 font-semibold">
                    <span className="uppercase tracking-wider">Incoming Deliveries</span>
                    <Truck size={17} className="text-[#5F684B]" />
                  </div>
                  <div className="text-3xl font-extrabold text-[#22211E]">
                    {dashboardStats?.stats?.incoming_deliveries ?? 0}
                  </div>
                  <p className="text-[11px] text-[#6F6C64] mt-1">Couriers on the way</p>
                </div>

                {/* Received Today Card */}
                <div className="card-warm rounded-2xl p-5 shadow-xs border border-[#D7D2C7]">
                  <div className="flex items-center justify-between text-xs text-[#6F6C64] mb-2 font-semibold">
                    <span className="uppercase tracking-wider">Received Today</span>
                    <CheckCircle2 size={17} className="text-[#5F684B]" />
                  </div>
                  <div className="text-3xl font-extrabold text-[#22211E]">
                    {dashboardStats?.stats?.received_today ?? 0}
                  </div>
                  <p className="text-[11px] text-[#6F6C64] mt-1">Meals safely delivered</p>
                </div>
              </div>

              {/* Facility Capacity & Utilization Section */}
              <div className="card-warm rounded-2xl p-6 shadow-xs border border-[#D7D2C7] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E3DDD1]">
                  <div>
                    <h2 className="text-base font-bold text-[#22211E] flex items-center gap-2">
                      <SlidersHorizontal size={18} className="text-[#5F684B]" />
                      Shelter Intake Capacity & Utilization
                    </h2>
                    <p className="text-xs text-[#6F6C64] mt-0.5">
                      Real-time threshold determining your eligibility for incoming surplus food routes.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/recipient/settings')}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[#D7D2C7] bg-white hover:bg-[#F3EFE7] text-xs font-semibold text-[#22211E] transition cursor-pointer self-start sm:self-auto shadow-xs">
                    <span>Manage Capacity</span>
                    <ArrowRight size={13} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-[#6F6C64] uppercase tracking-wider block">
                      Current Intake Load
                    </span>
                    <div className="text-2xl font-extrabold text-[#22211E]">
                      {curNum} <span className="text-sm font-medium text-[#6F6C64]">/ {maxNum} meals</span>
                    </div>
                    <span className="text-xs font-medium text-[#5F684B] block">
                      {availableSlots} available slots remaining
                    </span>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[#22211E]">
                      <span>Capacity Utilization</span>
                      <span className={isFull ? 'text-[#B85C50]' : 'text-[#5F684B]'}>
                        {utilization}% utilized
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-[#EFECE6] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isFull ? 'bg-[#B85C50]' : 'bg-[#5F684B]'
                        }`}
                        style={{ width: `${Math.min(100, utilization)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-[#6F6C64]">
                      {isFull
                        ? 'Facility is currently at capacity. Inbound dispatches are paused to prevent food spoilage.'
                        : 'Matching engine actively assigns nearby surplus rescues directly to your facility.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Pending Offers Prompt */}
              {offers.length > 0 && (
                <div className="rounded-2xl border border-[#DCE7B8] bg-[#E8EED2] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#5F684B] flex items-center justify-center text-white shrink-0">
                      <Inbox size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#22211E]">
                        {offers.length} Surplus Food {offers.length === 1 ? 'Offer' : 'Offers'} Ready for Decision
                      </h4>
                      <p className="text-[11px] text-[#4D553C] mt-0.5">
                        Nearby donors have prepared batches waiting for shelter confirmation.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/recipient/offers')}
                    className="px-4 py-2 bg-[#5F684B] hover:bg-[#4D553C] text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer shrink-0">
                    Review Offers ({offers.length})
                  </button>
                </div>
              )}

              {/* Inbound & Recent Activity Log */}
              <div className="card-warm rounded-2xl p-6 shadow-xs border border-[#D7D2C7] space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E3DDD1]">
                  <div>
                    <h3 className="text-sm font-bold text-[#22211E]">Recent Intake & Delivery Activity</h3>
                    <p className="text-xs text-[#6F6C64]">
                      History of surplus food batches routed and delivered to your shelter.
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-[#6F6C64]">
                    Live Logistics Ledger
                  </span>
                </div>

                {dashboardStats?.recent_donations?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-[#D7D2C7] text-[#6F6C64] uppercase text-[10px] tracking-wider">
                          <th className="pb-2.5 font-bold">Food Description</th>
                          <th className="pb-2.5 font-bold">Donor Establishment</th>
                          <th className="pb-2.5 font-bold">Quantity</th>
                          <th className="pb-2.5 font-bold">Assigned Courier</th>
                          <th className="pb-2.5 font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E3DDD1]">
                        {dashboardStats.recent_donations.map(item => (
                          <tr key={item.id} className="text-[#22211E]">
                            <td className="py-3 font-semibold">{item.food_description}</td>
                            <td className="py-3 text-[#6F6C64]">{item.donor_name || 'Verified Donor'}</td>
                            <td className="py-3 font-medium">{item.quantity} {item.unit}</td>
                            <td className="py-3 text-[#6F6C64]">{item.driver_name || 'En-route Volunteer'}</td>
                            <td className="py-3">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                  item.status === 'delivered'
                                    ? 'bg-[#E8EED2] text-[#4D553C] border-[#DCE7B8]'
                                    : item.status === 'picked_up'
                                    ? 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]'
                                    : 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]'
                                }`}>
                                {item.status.replace('_', ' ')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-[#6F6C64]">
                    <Package size={24} className="mx-auto text-[#99958B] mb-2 opacity-50" />
                    No completed or active deliveries in the system yet. Once offers are accepted, real-time intake updates will display here.
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* DISPATCH RULES MODAL */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#D7D2C7]">
              <div className="flex items-center gap-2.5">
                <Info size={19} className="text-[#5F684B]" />
                <h3 className="text-lg font-bold text-[#22211E]">Shelter Dispatch & Intake Rules</h3>
              </div>
              <button
                onClick={() => setShowRulesModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6F6C64] hover:text-[#22211E] hover:bg-[#EAE4D8] transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-[#6F6C64] leading-relaxed">
              <div className="p-3.5 rounded-xl bg-white border border-[#D7D2C7]">
                <strong className="text-xs text-[#22211E] block mb-1">1. Automatic 100% Capacity Pause</strong>
                <p>
                  When your current load equals or exceeds your configured maximum capacity, the matching engine immediately excludes your facility from prospective dispatch rounds to prevent food spoilage or room overflow.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-[#D7D2C7]">
                <strong className="text-xs text-[#22211E] block mb-1">2. Cold-Chain Compliance Standard</strong>
                <p>
                  Accepting Dairy or Prepared Meals mandates insulated transport. Couriers assigned to these rescues are equipped with certified refrigeration containers to maintain HACCP safety standards.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-[#D7D2C7]">
                <strong className="text-xs text-[#22211E] block mb-1">3. Cascading Priority Timer</strong>
                <p>
                  Offers are allocated with a prioritized decision window. If an offer is declined or times out, the logistics engine cascades it to the next nearest eligible shelter.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowRulesModal(false)}
                className="px-5 py-2 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-bold transition cursor-pointer">
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
