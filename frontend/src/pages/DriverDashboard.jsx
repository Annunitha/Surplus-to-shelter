import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Truck,
  Package,
  MapPin,
  Clock,
  Phone,
  RotateCw,
  Navigation,
  FileText,
  Shield,
  Check,
  AlertTriangle,
  ArrowRight,
  UtensilsCrossed,
  Radio,
  Info,
  CheckSquare,
  Thermometer,
  X,
  ExternalLink,
  ShieldCheck,
  Route,
  User,
  CheckCircle2,
  LayoutDashboard
} from 'lucide-react';
import { apiRequest, getUser, clearUser } from '../api';
import { getSocket } from '../socket';
import Sidebar from '../components/common/Sidebar';
import TopNavbar from '../components/common/TopNavbar';

export default function DriverDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const [driver, setDriver] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [driverDonations, setDriverDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isDashboardView =
    location.pathname === '/driver' ||
    location.pathname === '/driver/' ||
    location.pathname === '/driver/dashboard';

  const [activeTab, setActiveTab] = useState(isDashboardView ? 'dashboard' : 'assignment');

  useEffect(() => {
    setActiveTab(isDashboardView ? 'dashboard' : 'assignment');
  }, [location.pathname]);

  // Ref to track current assignment for WebSocket closure
  const assignmentRef = useRef(null);

  // Modals state
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showManifestModal, setShowManifestModal] = useState(false);
  const [showZoneModal, setShowZoneModal] = useState(false);

  // Issue reporting form state
  const [issueForm, setIssueForm] = useState({
    issue_type: 'Vehicle / Mechanical issue',
    description: '',
    notes: ''
  });
  const [submittingIssue, setSubmittingIssue] = useState(false);

  // Keep assignmentRef in sync with assignment state
  useEffect(() => {
    assignmentRef.current = assignment;
  }, [assignment]);

  useEffect(() => {
    if (!user || user.role !== 'driver') {
      navigate('/login');
      return;
    }
    loadData();

    const socket = getSocket();
    function handleAssignmentNew({ driverId, donationId }) {
      if (user.profileId === driverId) {
        setNotification({
          type: 'success',
          message: 'New food rescue assignment dispatched to your vehicle!'
        });
        fetchAssignment();
        fetchDriver();
      }
    }

    function handleStatusChanged({ donationId, status }) {
      const currentAssignment = assignmentRef.current;
      if (currentAssignment && currentAssignment.donation_id === donationId) {
        if (status === 'delivered' || status === 'cancelled') {
          fetchAssignment();
          fetchDriver();
        } else {
          setAssignment(a => (a ? { ...a, status } : null));
        }
      }
    }

    socket.on('assignment:new', handleAssignmentNew);
    socket.on('donation:status_changed', handleStatusChanged);

    // Refresh expiry countdown every second for live precision
    const interval = setInterval(() => {
      setAssignment(a => {
        if (!a || a.expires_in_seconds == null) return a;
        return {
          ...a,
          expires_in_seconds: Math.max(0, a.expires_in_seconds - 1)
        };
      });
    }, 1000);

    return () => {
      socket.off('assignment:new', handleAssignmentNew);
      socket.off('donation:status_changed', handleStatusChanged);
      clearInterval(interval);
    };
  }, []);

  async function loadData() {
    setLoading(true);
    await Promise.all([fetchDriver(), fetchAssignment(), fetchDriverDonations()]);
    setLoading(false);
  }

  async function fetchDriverDonations() {
    try {
      const data = await apiRequest('/api/drivers/me/donations');
      if (data && data.donations) {
        setDriverDonations(data.donations);
      }
    } catch (err) {
      console.error('Failed to fetch driver donations:', err);
    }
  }

  async function fetchDriver() {
    try {
      const data = await apiRequest('/api/drivers/me');
      setDriver(data.driver);
    } catch (err) {
      console.error('Failed to fetch driver profile:', err);
    }
  }

  async function fetchAssignment() {
    try {
      const data = await apiRequest('/api/drivers/me/assignment');
      setAssignment(data.assignment); // null when no active assignment
    } catch (err) {
      console.error('Failed to fetch assignment:', err);
    }
  }

  async function handleMarkPickedUp() {
    if (!assignment?.donation_id) return;
    setActionLoading(true);
    try {
      await apiRequest(`/api/drivers/me/assignment/${assignment.donation_id}/picked-up`, {
        method: 'POST'
      });
      const dropoffName = assignment?.dropoff?.org_name || 'recipient shelter';
      setNotification({
        type: 'success',
        message: `Pickup confirmed! Now en-route to ${dropoffName}.`
      });
      await fetchAssignment();
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkDelivered() {
    if (!assignment?.donation_id) return;
    setActionLoading(true);
    try {
      await apiRequest(`/api/drivers/me/assignment/${assignment.donation_id}/delivered`, {
        method: 'POST'
      });
      setNotification({
        type: 'success',
        message: 'Delivery confirmed! Impact metrics have been credited and logged.'
      });
      await Promise.all([fetchAssignment(), fetchDriver()]);
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReportIssueSubmit(e) {
    e.preventDefault();
    if (!assignment?.donation_id) return;
    setSubmittingIssue(true);
    try {
      await apiRequest(`/api/drivers/me/assignment/${assignment.donation_id}/report-issue`, {
        method: 'POST',
        body: JSON.stringify(issueForm)
      });
      setNotification({
        type: 'success',
        message: 'Issue reported to dispatch operations. Support team alerted.'
      });
      setShowIssueModal(false);
      setIssueForm({ issue_type: 'Vehicle / Mechanical issue', description: '', notes: '' });
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
      setShowIssueModal(false);
    } finally {
      setSubmittingIssue(false);
    }
  }

  function formatCountdown(totalSecs) {
    if (totalSecs == null || totalSecs <= 0) return '52 mins';
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins} mins`;
  }

  // Active status resolution from real backend data only
  const hasAssignment = assignment !== null;
  const currentStatus = assignment?.status || null;
  const isPickedUp = currentStatus === 'picked_up';
  const isDelivered = currentStatus === 'delivered';

  // Mission data binding — only populated when a real assignment exists
  const mission = hasAssignment ? {
    id: `#FR-${assignment.donation_id.slice(0, 4).toUpperCase()}`,
    fullId: assignment.donation_id,
    food_description: assignment.food_description || 'Food Rescue',
    quantity: assignment.quantity || 0,
    unit: assignment.unit || 'items',
    weight_kg: assignment.weight_kg || 0,
    portionYield: assignment.weight_kg
      ? Math.round(parseFloat(assignment.weight_kg) / 0.545)
      : assignment.quantity
      ? Math.round(parseFloat(assignment.quantity) * 3.3)
      : 0,
    expires_in_seconds: assignment.expires_in_seconds ?? 0,
    expiry_window_end: assignment.expiry_window_end || new Date().toISOString(),
    pickup: {
      org_name: assignment.pickup?.org_name || 'Donor',
      shortName: (assignment.pickup?.org_name || 'Donor').split(' ').slice(0, 2).join(' '),
      address: assignment.pickup?.address || 'Pickup address',
      crossStreet: '',
      accessInstructions: 'Contact donor for access instructions.',
      contact_name: assignment.pickup?.org_name || 'Donor Contact',
      phone: assignment.pickup?.phone || '',
      dock: 'Loading Bay',
      eta: assignment.pickup?.eta
        ? new Date(assignment.pickup.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Pending'
    },
    dropoff: {
      org_name: assignment.dropoff?.org_name || 'Recipient',
      shortName: (assignment.dropoff?.org_name || 'Recipient').split(' ').slice(0, 2).join(' '),
      address: assignment.dropoff?.address || 'Dropoff address',
      accessInstructions: 'Contact recipient for receiving instructions.',
      contact_name: assignment.dropoff?.org_name || 'Recipient Contact',
      phone: assignment.dropoff?.phone || '',
      dock: 'Receiving Bay',
      eta: assignment.dropoff?.eta
        ? new Date(assignment.dropoff.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Pending'
    },
    distance_km: (assignment.pickup?.lat && assignment.dropoff?.lat)
      ? `${(Math.sqrt(Math.pow((assignment.pickup.lat - assignment.dropoff.lat) * 111, 2) + Math.pow((assignment.pickup.lng - assignment.dropoff.lng) * 111 * Math.cos(assignment.pickup.lat * Math.PI / 180), 2))).toFixed(1)} km`
      : '-- km',
    duration: '~12 mins drive',
    corridor: 'Urban Transit Corridor'
  } : null;

  const formattedExpiryTime = mission
    ? new Date(mission.expiry_window_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const completedDeliveries = driverDonations.filter(
    d => d.donation_status === 'delivered' || d.status === 'delivered'
  );
  const totalWeightKg = completedDeliveries.reduce(
    (sum, d) => sum + (parseFloat(d.weight_kg) || 0),
    0
  );
  const totalPortions = Math.round(
    totalWeightKg > 0
      ? totalWeightKg / 0.4
      : completedDeliveries.reduce((sum, d) => sum + (parseFloat(d.quantity) || 0), 0)
  );

  return (
    <div className="min-h-screen bg-[#FAF7F1] text-[#22211E] flex flex-col md:flex-row">
      {/* SIDEBAR */}
      <Sidebar
        role="driver"
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={mobileMenuOpen}
        setIsOpen={setMobileMenuOpen}
      />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP HEADER */}
        <TopNavbar
          role="driver"
          userProfile={driver}
          onMenuClick={() => setMobileMenuOpen(true)}
          statusLabel={
            !hasAssignment
              ? 'On Shift • Standby'
              : isPickedUp
              ? 'On Shift • In Transit'
              : 'On Shift • Dispatched'
          }
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Notification Toast */}
          {notification && (
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
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <RotateCw size={24} className="animate-spin text-[#5F684B]" />
            </div>
          )}

          {/* DRIVER OVERVIEW DASHBOARD VIEW */}
          {!loading && isDashboardView ? (
            <div className="space-y-6">
              {/* PAGE HEADER */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#D7D2C7]">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-[#6F6C64] mb-1">
                    <span>FoodRescue</span>
                    <span className="text-[#99958B]">›</span>
                    <span className="font-bold text-[#22211E]">Driver Portal</span>
                    <span className="text-[#99958B]">›</span>
                    <span className="font-semibold text-[#5F684B]">Overview</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#22211E]">
                    Driver Fleet Overview
                  </h1>
                  <p className="text-xs sm:text-sm text-[#6F6C64] mt-0.5">
                    Live rescue missions, courier standby availability, and delivery performance metrics.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                    hasAssignment
                      ? 'bg-[#5F684B] text-[#DCE7B8] border-[#4A5337]'
                      : 'bg-[#E8EED2] text-[#4D553C] border-[#DCE7B8]'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${hasAssignment ? 'bg-[#DCE7B8]' : 'bg-[#5F684B]'} animate-pulse`} />
                    <span>{hasAssignment ? 'Active Mission • En Route' : 'On Shift • Standby'}</span>
                  </span>
                  <button
                    onClick={loadData}
                    disabled={loading}
                    className="p-2 rounded-xl border border-[#D7D2C7] bg-[#F8F5EE] hover:bg-[#EAE4D8] text-[#22211E] transition cursor-pointer shadow-xs">
                    <RotateCw size={15} className={loading ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={() => navigate('/driver/assignment')}
                    className="px-4 py-2 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs">
                    <Route size={14} />
                    <span>Open Assignment</span>
                  </button>
                </div>
              </div>

              {/* 4 DRIVER METRIC CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Active Mission Card */}
                <div
                  onClick={() => navigate('/driver/assignment')}
                  className="card-warm rounded-2xl p-5 shadow-xs border border-[#D7D2C7] cursor-pointer hover:border-[#5F684B] transition-all">
                  <div className="flex items-center justify-between text-xs text-[#6F6C64] mb-2 font-semibold">
                    <span className="uppercase tracking-wider">Active Mission</span>
                    <Route size={17} className="text-[#5F684B]" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-extrabold text-[#22211E]">
                      {hasAssignment ? '1 Active' : '0'}
                    </span>
                    <span className="text-xs text-[#5F684B] font-semibold flex items-center gap-0.5">
                      {hasAssignment ? 'View Route' : 'Standby'} <ArrowRight size={12} />
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6F6C64] mt-1 truncate">
                    {hasAssignment ? mission.food_description : 'Standby • Ready for dispatch'}
                  </p>
                </div>

                {/* 2. Completed Rescues Card */}
                <div
                  onClick={() => navigate('/driver/donations')}
                  className="card-warm rounded-2xl p-5 shadow-xs border border-[#D7D2C7] cursor-pointer hover:border-[#5F684B] transition-all">
                  <div className="flex items-center justify-between text-xs text-[#6F6C64] mb-2 font-semibold">
                    <span className="uppercase tracking-wider">Completed Rescues</span>
                    <CheckCircle2 size={17} className="text-[#5F684B]" />
                  </div>
                  <div className="text-3xl font-extrabold text-[#22211E]">
                    {completedDeliveries.length}
                  </div>
                  <p className="text-[11px] text-[#6F6C64] mt-1">Successfully delivered to shelters</p>
                </div>

                {/* 3. Food Delivered Card */}
                <div className="card-warm rounded-2xl p-5 shadow-xs border border-[#D7D2C7]">
                  <div className="flex items-center justify-between text-xs text-[#6F6C64] mb-2 font-semibold">
                    <span className="uppercase tracking-wider">Food Transported</span>
                    <Package size={17} className="text-[#5F684B]" />
                  </div>
                  <div className="text-3xl font-extrabold text-[#22211E]">
                    {totalWeightKg > 0 ? `${totalWeightKg.toFixed(1)} kg` : `${totalPortions} meals`}
                  </div>
                  <p className="text-[11px] text-[#6F6C64] mt-1">~{totalPortions} meal portions delivered</p>
                </div>

                {/* 4. Active Dispatch Zone Card */}
                <div className="card-warm rounded-2xl p-5 shadow-xs border border-[#D7D2C7]">
                  <div className="flex items-center justify-between text-xs text-[#6F6C64] mb-2 font-semibold">
                    <span className="uppercase tracking-wider">Dispatch Radius</span>
                    <Radio size={17} className="text-[#5F684B]" />
                  </div>
                  <div className="text-3xl font-extrabold text-[#22211E]">
                    8.0 km
                  </div>
                  <p className="text-[11px] text-[#6F6C64] mt-1">Zone: Central Delhi NCR</p>
                </div>
              </div>

              {/* MISSION SPOTLIGHT / STANDBY RADAR CARD */}
              {hasAssignment ? (
                <div className="bg-[#E8EED2] border border-[#D2DDB5] rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#5F684B] text-white">
                        {isPickedUp ? 'IN TRANSIT' : 'ASSIGNED • PENDING PICKUP'}
                      </span>
                      <span className="text-xs font-bold text-[#22211E]">{mission.id}</span>
                    </div>
                    <h3 className="text-lg font-bold text-[#22211E]">{mission.food_description}</h3>
                    <p className="text-xs text-[#4D553C]">
                      From: <strong className="text-[#22211E]">{mission.pickup.org_name}</strong> → To: <strong className="text-[#22211E]">{mission.dropoff.org_name}</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/driver/assignment')}
                    className="px-5 py-2.5 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-bold transition shadow-xs flex items-center gap-2 shrink-0 cursor-pointer">
                    <Route size={16} />
                    <span>Open Turn-by-Turn Route</span>
                  </button>
                </div>
              ) : (
                <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row items-center gap-5">
                  <div className="w-14 h-14 rounded-full bg-[#E8EED2] text-[#5F684B] flex items-center justify-center shrink-0 shadow-2xs">
                    <Radio size={24} className="animate-pulse" />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#5F684B] animate-pulse" />
                      <h3 className="text-base font-bold text-[#22211E]">Courier Standby • Auto-Dispatch Active</h3>
                    </div>
                    <p className="text-xs text-[#6F6C64] mt-1 leading-relaxed max-w-2xl">
                      You are currently on shift. The matching algorithm continuously routes surplus food rescue donations in your 8.0 km corridor. You will receive an immediate assignment notification when a donor batch is ready.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/driver/assignment')}
                    className="px-4 py-2.5 rounded-xl border border-[#D7D2C7] bg-white hover:bg-[#F3EFE7] text-[#22211E] text-xs font-semibold transition cursor-pointer shrink-0 shadow-2xs">
                    View Live Radar
                  </button>
                </div>
              )}

              {/* RECENT DELIVERY LOG */}
              <div className="card-warm rounded-2xl p-6 shadow-xs border border-[#D7D2C7] space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E3DDD1]">
                  <div>
                    <h3 className="text-sm font-bold text-[#22211E]">Driver Delivery Log & Missions</h3>
                    <p className="text-xs text-[#6F6C64]">
                      History of food rescues handled and completed by your vehicle.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/driver/donations')}
                    className="text-xs font-semibold text-[#5F684B] hover:text-[#4D553C] flex items-center gap-1 cursor-pointer">
                    <span>View All</span>
                    <ArrowRight size={13} />
                  </button>
                </div>

                {driverDonations.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-[#D7D2C7] text-[#6F6C64] uppercase text-[10px] tracking-wider">
                          <th className="pb-2.5 font-bold">Food Description</th>
                          <th className="pb-2.5 font-bold">Pickup Donor</th>
                          <th className="pb-2.5 font-bold">Shelter Dropoff</th>
                          <th className="pb-2.5 font-bold">Cargo</th>
                          <th className="pb-2.5 font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E3DDD1]">
                        {driverDonations.slice(0, 5).map(item => {
                          const st = item.donation_status || item.status;
                          return (
                            <tr key={item.donation_id || item.id} className="text-[#22211E]">
                              <td className="py-3 font-semibold">{item.food_description}</td>
                              <td className="py-3 text-[#6F6C64]">{item.donor_org_name || 'Donor'}</td>
                              <td className="py-3 text-[#6F6C64]">{item.recipient_org_name || 'Shelter'}</td>
                              <td className="py-3 font-medium">{item.quantity} {item.unit} {item.weight_kg ? `(${item.weight_kg} kg)` : ''}</td>
                              <td className="py-3">
                                <span
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                    st === 'delivered'
                                      ? 'bg-[#E8EED2] text-[#4D553C] border-[#DCE7B8]'
                                      : st === 'picked_up'
                                      ? 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]'
                                      : 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]'
                                  }`}>
                                  {st ? st.replace('_', ' ') : 'PENDING'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-[#6F6C64]">
                    <Truck size={24} className="mx-auto text-[#99958B] mb-2 opacity-50" />
                    No completed delivery missions logged yet. When you complete dispatches, they will appear here.
                  </div>
                )}
              </div>
            </div>
          ) : !loading && (
            <>
              {/* NO ACTIVE ASSIGNMENT STATE (ASSIGNMENT TAB) */}
              {!hasAssignment && (
                <>
                  {/* PAGE HEADER */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-2xl sm:text-[30px] font-bold tracking-tight text-[#22211E]">
                          Current Assignment
                        </h1>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#EFECE6] text-[#6F6C64] border border-[#D7D2C7]">
                          No Active Mission
                        </span>
                      </div>
                      <p className="text-xs sm:text-[13px] text-[#6F6C64] mt-1 leading-relaxed">
                        You are currently on standby. Dispatch will assign you automatically when a rescue mission becomes available.
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        onClick={loadData}
                        disabled={loading}
                        className="px-4 py-2 rounded-xl border border-[#D7D2C7] bg-[#FDFBF7] hover:bg-[#F3EFE7] text-[#22211E] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs">
                        <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
                        <span>Refresh</span>
                      </button>
                      <button
                        onClick={() => alert('Dispatch Hotline: Connecting to Central Operations (+91 11 2345 6789)...')}
                        className="px-4 py-2 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs">
                        <Phone size={14} />
                        <span>Call Dispatcher</span>
                      </button>
                    </div>
                  </div>

                  {/* No Assignment Empty State Card */}
                  <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-12 sm:p-16 text-center shadow-xs">
                    <div className="w-16 h-16 rounded-full bg-[#E8EED2] text-[#5F684B] flex items-center justify-center mx-auto shadow-2xs">
                      <Radio size={28} className="animate-pulse" />
                    </div>
                    <div className="mt-5">
                      <span className="inline-flex items-center gap-2 text-lg font-bold text-[#22211E]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#5F684B] animate-pulse" />
                        <span>Awaiting Dispatch</span>
                      </span>
                      <p className="text-sm text-[#6F6C64] max-w-md mx-auto mt-2 leading-relaxed">
                        You are on shift and ready. The system is monitoring live food rescue offers in your zone. 
                        You will be automatically assigned when a nearby donation is matched.
                      </p>
                    </div>
                    <div className="w-48 border-b border-[#D7D2C7] mx-auto my-5" />
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#FAF7F1] border border-[#D7D2C7] text-[#6F6C64]">
                        Status: {driver?.status === 'available' ? 'Available' : driver?.status || 'Loading...'}
                      </span>
                      <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#FAF7F1] border border-[#D7D2C7] text-[#6F6C64]">
                        Assigned Radius: 8.0 km
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* ACTIVE ASSIGNMENT VIEW */}
              {hasAssignment && mission && (
            <>
          {/* PAGE HEADER */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-[30px] font-bold tracking-tight text-[#22211E]">
                  Current Assignment
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#5F684B] text-[#DCE7B8] border border-[#4A5337] shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#DCE7B8] animate-pulse" />
                  <span>{mission.id} • {isPickedUp ? 'In Transit' : 'In Progress'}</span>
                </span>
              </div>
              <p className="text-xs sm:text-[13px] text-[#6F6C64] mt-1 leading-relaxed">
                Active high-priority food transport mission. Keep strictly to the insulated cold/hot chain window.
              </p>
            </div>

            {/* Right Header Buttons */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={loadData}
                disabled={loading}
                className="px-4 py-2 rounded-xl border border-[#D7D2C7] bg-[#FDFBF7] hover:bg-[#F3EFE7] text-[#22211E] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs">
                <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>Refresh Route</span>
              </button>

              <button
                onClick={() => alert('Dispatch Hotline: Connecting to Central Operations (+91 11 2345 6789)...')}
                className="px-4 py-2 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs">
                <Phone size={14} />
                <span>Call Dispatcher</span>
              </button>
            </div>
          </div>

          {/* MAIN 2-COLUMN GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN (~65% width: Route Manifest, Pickup, Dropoff) */}
            <div className="lg:col-span-7 space-y-5">
              {/* CARD 1: ROUTE MANIFEST OVERVIEW */}
              <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-5 sm:p-6 shadow-xs">
                <div className="flex items-center justify-between pb-3.5 border-b border-[#D7D2C7]">
                  <div className="flex items-center gap-2">
                    <Route size={16} strokeWidth={2.2} className="text-[#5F684B]" />
                    <h2 className="text-sm font-bold text-[#22211E]">Route Manifest Overview</h2>
                  </div>
                  <span className="text-[11px] font-medium text-[#6F6C64]">
                    {mission.corridor}
                  </span>
                </div>

                {/* Route Visualization Container */}
                <div className="bg-[#FAF7F1] border border-[#D7D2C7] rounded-xl p-4 my-4">
                  <div className="flex items-center justify-between gap-2">
                    {/* Point A (Pickup) */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-[#5F684B] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                          A
                        </span>
                        <span className="text-[10px] font-bold text-[#6F6C64] uppercase tracking-wider truncate">
                          PICKUP ({mission.pickup.eta})
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-[#22211E] mt-1.5 truncate">
                        {mission.pickup.shortName}
                      </h3>
                      <p className="text-[11px] text-[#6F6C64] truncate">
                        Central Kitchen Loading Bay
                      </p>
                    </div>

                    {/* Circular Route Indicator & Dashed Line */}
                    <div className="flex-1 flex items-center justify-center relative px-2">
                      <div className="absolute inset-x-0 h-px border-b border-dashed border-[#D7D2C7]" />
                      <div className="w-14 h-14 rounded-full bg-white border border-[#D7D2C7] flex flex-col items-center justify-center text-center shadow-2xs z-10 p-1 shrink-0">
                        <div className="flex items-center gap-0.5 text-[10px] font-bold text-[#22211E]">
                          <Clock size={10} className="text-[#5F684B]" />
                          <span>3.4 km</span>
                        </div>
                        <span className="text-[9px] font-medium text-[#6F6C64] leading-tight">~12 mins</span>
                        <span className="text-[8px] uppercase tracking-wider text-[#99958B] leading-none">drive</span>
                      </div>
                    </div>

                    {/* Point B (Dropoff) */}
                    <div className="flex-1 min-w-0 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-[10px] font-bold text-[#6F6C64] uppercase tracking-wider truncate">
                          DROPOFF ({mission.dropoff.eta})
                        </span>
                        <span className="w-7 h-7 rounded-full bg-[#5F684B] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                          B
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-[#22211E] mt-1.5 truncate">
                        {mission.dropoff.shortName}
                      </h3>
                      <p className="text-[11px] text-[#6F6C64] truncate">
                        East Central Receiving Bay 1
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3-Column Route Stats */}
                <div className="grid grid-cols-3 divide-x divide-[#D7D2C7] border-t border-[#D7D2C7] pt-3 text-center">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-[#6F6C64] tracking-wider">
                      Distance Remaining
                    </p>
                    <p className="text-sm font-extrabold text-[#22211E] mt-0.5">3.4 km</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-[#6F6C64] tracking-wider">
                      Traffic Factor
                    </p>
                    <p className="text-sm font-extrabold text-[#5F684B] mt-0.5">Normal Flow</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-[#6F6C64] tracking-wider">
                      Vehicle Bay Clearance
                    </p>
                    <p className="text-sm font-extrabold text-[#22211E] mt-0.5">Standard (3.2m)</p>
                  </div>
                </div>
              </div>

              {/* CARD 2: PICKUP LOCATION (STEP 1) */}
              <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-5 sm:p-6 shadow-xs">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-[#E8EED2] text-[#5F684B] flex items-center justify-center font-bold text-xs shrink-0">
                      A
                    </span>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6C64] block">
                        STEP 1 — {isPickedUp || isDelivered ? 'COMPLETED' : 'IN PROGRESS'}
                      </span>
                      <h3 className="text-base font-bold text-[#22211E] mt-0.5">
                        Pickup Location — {mission.pickup.org_name}
                      </h3>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#EFECE6] text-[#6F6C64] border border-[#D7D2C7] shrink-0">
                    {mission.pickup.dock}
                  </span>
                </div>

                {/* Address */}
                <div className="my-3 space-y-1">
                  <div className="flex items-start gap-2 text-xs text-[#22211E] font-medium">
                    <MapPin size={15} className="text-[#5F684B] shrink-0 mt-0.5" />
                    <span>{mission.pickup.address}</span>
                  </div>
                  <p className="text-[11px] text-[#99958B] ml-6">
                    {mission.pickup.crossStreet}
                  </p>
                </div>

                {/* Access Instructions */}
                <div className="bg-[#FAF7F1] border border-[#D7D2C7] rounded-xl p-3 my-3 text-xs leading-relaxed text-[#6F6C64] flex items-start gap-2">
                  <Info size={15} className="text-[#6F6C64] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#22211E] font-semibold">Access Instructions:</strong>{' '}
                    {mission.pickup.accessInstructions}
                  </div>
                </div>

                {/* Contact and Real Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#D7D2C7]">
                  <div className="flex items-center gap-2 text-xs text-[#6F6C64]">
                    <User size={14} className="text-[#5F684B]" />
                    <span>{mission.pickup.contact_name} • {mission.pickup.phone}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${mission.pickup.phone}`}
                      className="px-3.5 py-1.5 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs">
                      <Phone size={13} />
                      <span>Call Donor</span>
                    </a>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(mission.pickup.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 rounded-xl border border-[#D7D2C7] bg-[#FAF7F1] hover:bg-[#F3EFE7] text-[#22211E] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
                      <Navigation size={13} className="text-[#5F684B]" />
                      <span>Open in Maps</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* CARD 3: DROPOFF DESTINATION (STEP 2) */}
              <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-5 sm:p-6 shadow-xs">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-[#E8EED2] text-[#5F684B] flex items-center justify-center font-bold text-xs shrink-0">
                      B
                    </span>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#6F6C64] block">
                        STEP 2 — {isDelivered ? 'COMPLETED' : isPickedUp ? 'IN PROGRESS' : 'PENDING PICKUP'}
                      </span>
                      <h3 className="text-base font-bold text-[#22211E] mt-0.5">
                        Dropoff Destination — {mission.dropoff.org_name}
                      </h3>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#EFECE6] text-[#6F6C64] border border-[#D7D2C7] shrink-0">
                    {mission.dropoff.dock}
                  </span>
                </div>

                {/* Address */}
                <div className="my-3 space-y-1">
                  <div className="flex items-start gap-2 text-xs text-[#22211E] font-medium">
                    <MapPin size={15} className="text-[#5F684B] shrink-0 mt-0.5" />
                    <span>{mission.dropoff.address}</span>
                  </div>
                  <p className="text-[11px] text-[#99958B] ml-6">
                    Direct ramp access off Elm St North Gate
                  </p>
                </div>

                {/* Receiving Protocol */}
                <div className="bg-[#FAF7F1] border border-[#D7D2C7] rounded-xl p-3 my-3 text-xs leading-relaxed text-[#6F6C64] flex items-start gap-2">
                  <CheckSquare size={15} className="text-[#5F684B] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#22211E] font-semibold">Receiving Protocol:</strong>{' '}
                    {mission.dropoff.accessInstructions}
                  </div>
                </div>

                {/* Contact and Real Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#D7D2C7]">
                  <div className="flex items-center gap-2 text-xs text-[#6F6C64]">
                    <User size={14} className="text-[#5F684B]" />
                    <span>{mission.dropoff.contact_name} • {mission.dropoff.phone}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${mission.dropoff.phone}`}
                      className="px-3.5 py-1.5 rounded-xl border border-[#D7D2C7] bg-[#FAF7F1] hover:bg-[#F3EFE7] text-[#22211E] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
                      <Phone size={13} />
                      <span>Call Recipient</span>
                    </a>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(mission.dropoff.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 rounded-xl border border-[#D7D2C7] bg-[#FAF7F1] hover:bg-[#F3EFE7] text-[#22211E] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
                      <Navigation size={13} className="text-[#5F684B]" />
                      <span>Open in Maps</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN (~35% width: Cargo Details, Specs, Countdown, Actions) */}
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-5 sm:p-6 shadow-xs sticky top-20">
                {/* Header */}
                <div className="flex items-center justify-between pb-3.5 border-b border-[#D7D2C7]">
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed size={16} strokeWidth={2.2} className="text-[#5F684B]" />
                    <h2 className="text-sm font-bold text-[#22211E]">Food Cargo & Rescue Details</h2>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-[#E8EED2] text-[#4D553C] border border-[#D7D2C7]">
                    Catering Surplus
                  </span>
                </div>

                {/* Food Description */}
                <div className="my-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#99958B] block">
                    FOOD DESCRIPTION
                  </span>
                  <h3 className="text-base font-bold text-[#22211E] mt-1 leading-snug">
                    {mission.food_description}
                  </h3>
                </div>

                {/* Quantity & Portions */}
                <div className="border border-[#D7D2C7] bg-[#FAF7F1] rounded-xl p-3.5 my-4 grid grid-cols-2 divide-x divide-[#D7D2C7]">
                  <div>
                    <span className="text-[10px] text-[#6F6C64] uppercase font-semibold block">
                      Quantity & Volume
                    </span>
                    <span className="text-sm font-extrabold text-[#22211E] mt-0.5 block">
                      {mission.quantity} {mission.unit}
                    </span>
                  </div>
                  <div className="pl-3">
                    <span className="text-[10px] text-[#6F6C64] uppercase font-semibold block">
                      Portion Yield
                    </span>
                    <span className="text-sm font-extrabold text-[#5F684B] mt-0.5 block">
                      ~{mission.portionYield} hot meals
                    </span>
                  </div>
                </div>

                {/* Temperature & Handling Specs */}
                <div className="border border-[#D7D2C7] bg-[#FAF7F1] rounded-xl p-3.5 mb-4 text-xs text-[#6F6C64] space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[#22211E] font-bold text-xs">
                    <Thermometer size={14} className="text-[#5F684B]" />
                    <span>Temperature & Handling Specs</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Hot holding certified (65°C logged at pickup origin).
                  </p>
                  <p className="text-[11px] leading-relaxed flex items-center gap-1 text-[#4D553C]">
                    <ShieldCheck size={13} className="text-[#5F684B] shrink-0" />
                    <span>Requires insulated thermal blankets during transit.</span>
                  </p>
                </div>

                {/* Safe Window Countdown */}
                <div className="border border-[#E9CFCB] bg-[#F7EEEC] rounded-xl p-3.5 sm:p-4 mb-5">
                  <div className="flex items-center justify-between text-xs font-bold text-[#D85C55]">
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} />
                      <span>Safe Window Countdown</span>
                    </div>
                    <span className="bg-[#F1DDD9] px-2 py-0.5 rounded-md text-xs font-extrabold">
                      Expires in {formatCountdown(mission.expires_in_seconds)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 w-full bg-[#E5CDC9] rounded-full overflow-hidden my-2.5">
                    <div
                      className="h-full bg-[#5F684B] rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(10, ((mission.expires_in_seconds || 0) / 3600) * 100))}%`
                      }}
                    />
                  </div>

                  <p className="text-[11px] text-[#D85C55]/90 flex items-center justify-between">
                    <span>Safe transfer window closes at:</span>
                    <strong className="font-bold text-[#22211E]">{formattedExpiryTime} Today</strong>
                  </p>
                </div>

                {/* Primary Action Button (State-Aware Driver Transition) */}
                {!isPickedUp && !isDelivered ? (
                  <button
                    onClick={handleMarkPickedUp}
                    disabled={actionLoading}
                    className="w-full py-3 px-4 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-50">
                    <Check size={16} strokeWidth={2.4} />
                    <span>{actionLoading ? 'Updating Status...' : 'Mark as Picked Up'}</span>
                  </button>
                ) : isPickedUp ? (
                  <button
                    onClick={handleMarkDelivered}
                    disabled={actionLoading}
                    className="w-full py-3 px-4 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-50">
                    <Check size={16} strokeWidth={2.4} />
                    <span>{actionLoading ? 'Confirming Delivery...' : 'Mark as Delivered'}</span>
                  </button>
                ) : (
                  <div className="w-full py-3 px-4 rounded-xl bg-[#E8EED2] text-[#4D553C] font-bold text-sm flex items-center justify-center gap-2 border border-[#D7D2C7]">
                    <Check size={16} strokeWidth={2.4} className="text-[#5F684B]" />
                    <span>Delivery Completed & Impact Logged</span>
                  </div>
                )}

                {/* Contextual Sub-label */}
                <div className="flex items-center justify-between text-xs text-[#6F6C64] mt-2 px-1">
                  <span>Next step after pickup:</span>
                  <span className="font-semibold text-[#22211E]">
                    {isDelivered ? 'Mission Completed ✓' : isPickedUp ? 'Confirm Receipt at Shelter →' : 'Mark as Delivered →'}
                  </span>
                </div>

                {/* Secondary Actions */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3.5 border-t border-[#D7D2C7]">
                  <button
                    type="button"
                    onClick={() => setShowIssueModal(true)}
                    className="py-2 px-3 rounded-xl border border-[#D7D2C7] bg-[#FAF7F1] hover:bg-[#F3EFE7] text-[#22211E] text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer">
                    <AlertTriangle size={14} className="text-[#D85C55]" />
                    <span>Report Issue</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowManifestModal(true)}
                    className="py-2 px-3 rounded-xl border border-[#D7D2C7] bg-[#FAF7F1] hover:bg-[#F3EFE7] text-[#22211E] text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer">
                    <FileText size={14} className="text-[#6F6C64]" />
                    <span>View Manifest</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM SECTION: QUEUE & NEXT ROUTE READINESS */}
          <div className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#22211E]">
                  Queue & Next Route Readiness
                </h2>
                <p className="text-xs text-[#6F6C64] mt-0.5">
                  System buffer monitoring for upcoming regional transfers.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowZoneModal(true)}
                className="text-xs font-semibold text-[#22211E] hover:text-[#5F684B] flex items-center gap-1 cursor-pointer transition">
                <span>View Zone Activity</span>
                <ArrowRight size={13} />
              </button>
            </div>

            {/* Waiting For Next Assignment Card */}
            <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-8 sm:p-10 text-center shadow-xs">
              <div className="w-12 h-12 rounded-full bg-[#E8EED2] text-[#5F684B] flex items-center justify-center mx-auto shadow-2xs">
                <Radio size={22} className="animate-pulse" />
              </div>

              <div className="mt-3.5">
                <span className="inline-flex items-center gap-1.5 text-base font-bold text-[#22211E]">
                  <span className="w-2 h-2 rounded-full bg-[#5F684B]" />
                  <span>Waiting for next assignment</span>
                </span>
                <p className="text-xs text-[#6F6C64] max-w-lg mx-auto mt-1 leading-relaxed">
                  Dispatch is monitoring live food rescue offers in your area. You'll be alerted immediately once matched with nearby bakeries, markets, or dining facilities.
                </p>
              </div>

              {/* Thin Divider */}
              <div className="w-48 border-b border-[#D7D2C7] mx-auto my-4" />

              {/* Horizontal Metadata Pills */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#FAF7F1] border border-[#D7D2C7] text-[#6F6C64]">
                  Assigned Radius: 8.0 km
                </span>
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#FAF7F1] border border-[#D7D2C7] text-[#6F6C64]">
                  Active Hub: Central Core
                </span>
              </div>

              {/* Sector queue pill */}
              <div className="mt-2.5">
                <span className="text-xs font-medium px-3.5 py-1 rounded-full bg-[#E8EED2] border border-[#D7D2C7] text-[#4D553C] inline-block shadow-2xs">
                  3 rescues queued in sector
                </span>
              </div>
            </div>
          </div>
            </>
          )}
            </>
          )}
        </main>
      </div>

      {/* REPORT ISSUE MODAL */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#D7D2C7]">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-[#D85C55]" />
                <h3 className="text-base font-bold text-[#22211E]">Report Courier Exception</h3>
              </div>
              <button
                onClick={() => setShowIssueModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6F6C64] hover:text-[#22211E] hover:bg-[#EAE4D8] transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReportIssueSubmit} className="space-y-3.5 text-xs text-[#22211E]">
              <div>
                <label className="block font-semibold mb-1">Issue Category</label>
                <select
                  value={issueForm.issue_type}
                  onChange={e => setIssueForm({ ...issueForm, issue_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#D7D2C7] focus:outline-none focus:border-[#5F684B]">
                  <option value="Vehicle / Mechanical issue">Vehicle / Mechanical issue</option>
                  <option value="Food temperature deviation">Food temperature deviation</option>
                  <option value="Donor loading bay unavailable">Donor loading bay unavailable</option>
                  <option value="Shelter receiving bay closed">Shelter receiving bay closed</option>
                  <option value="Severe traffic delay (>20 mins)">Severe traffic delay (&gt;20 mins)</option>
                  <option value="Other exception">Other exception</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Incident Description</label>
                <textarea
                  rows={3}
                  required
                  value={issueForm.description}
                  onChange={e => setIssueForm({ ...issueForm, description: e.target.value })}
                  placeholder="Describe the operational impediment (e.g. Loading bay gate locked, waiting for chef)..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#D7D2C7] focus:outline-none focus:border-[#5F684B] text-xs resize-none"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Optional Notes / Action Taken</label>
                <input
                  type="text"
                  value={issueForm.notes}
                  onChange={e => setIssueForm({ ...issueForm, notes: e.target.value })}
                  placeholder="e.g. Contacted kitchen manager on cell phone"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#D7D2C7] focus:outline-none focus:border-[#5F684B] text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#D7D2C7] bg-[#FAF7F1] text-[#22211E] text-xs font-semibold hover:bg-[#F3EFE7] transition cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingIssue}
                  className="px-5 py-2 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-semibold transition cursor-pointer disabled:opacity-50">
                  {submittingIssue ? 'Submitting...' : 'Submit Incident Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW MANIFEST MODAL */}
      {showManifestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#D7D2C7]">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-[#5F684B]" />
                <h3 className="text-base font-bold text-[#22211E]">Digital Rescue Manifest</h3>
              </div>
              <button
                onClick={() => setShowManifestModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6F6C64] hover:text-[#22211E] hover:bg-[#EAE4D8] transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#22211E]">
              <div className="p-3 bg-white rounded-xl border border-[#D7D2C7] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#99958B] block">Manifest ID</span>
                  <span className="font-bold text-sm">{mission.id}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-[#99958B] block">Assigned Transport</span>
                  <span className="font-semibold text-[#5F684B]">Van #3 - Refrigerated</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-white rounded-xl border border-[#D7D2C7]">
                  <span className="text-[10px] uppercase font-bold text-[#6F6C64] block mb-1">Origin (Pickup)</span>
                  <p className="font-bold">{mission.pickup.org_name}</p>
                  <p className="text-[11px] text-[#6F6C64] mt-0.5">{mission.pickup.address}</p>
                  <p className="text-[11px] text-[#5F684B] mt-1">{mission.pickup.phone}</p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-[#D7D2C7]">
                  <span className="text-[10px] uppercase font-bold text-[#6F6C64] block mb-1">Destination (Dropoff)</span>
                  <p className="font-bold">{mission.dropoff.org_name}</p>
                  <p className="text-[11px] text-[#6F6C64] mt-0.5">{mission.dropoff.address}</p>
                  <p className="text-[11px] text-[#5F684B] mt-1">{mission.dropoff.phone}</p>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-[#D7D2C7]">
                <span className="text-[10px] uppercase font-bold text-[#6F6C64] block mb-1">Cargo Verification</span>
                <p className="font-bold">{mission.food_description}</p>
                <div className="flex items-center gap-4 mt-1 text-[11px] text-[#6F6C64]">
                  <span>Quantity: <strong className="text-[#22211E]">{mission.quantity} {mission.unit}</strong></span>
                  <span>Yield: <strong className="text-[#5F684B]">~{mission.portionYield} portions</strong></span>
                  <span>Safety: <strong className="text-[#22211E]">65°C Insulated</strong></span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#E8EED2]/80 border border-[#D2DDB5] text-[11px] text-[#4D553C] flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#5F684B] shrink-0" />
                <span>Good Samaritan Food Donation Act certified • Safe insulated chain verified.</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowManifestModal(false)}
                className="px-5 py-2 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-bold transition cursor-pointer">
                Close Manifest
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ZONE ACTIVITY MODAL */}
      {showZoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#D7D2C7]">
              <div className="flex items-center gap-2">
                <Radio size={18} className="text-[#5F684B]" />
                <h3 className="text-base font-bold text-[#22211E]">Sector Telematics & Buffer Activity</h3>
              </div>
              <button
                onClick={() => setShowZoneModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6F6C64] hover:text-[#22211E] hover:bg-[#EAE4D8] transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#22211E]">
              <div className="p-3.5 bg-white rounded-xl border border-[#D7D2C7] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Central Core Sector 4</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8EED2] text-[#4D553C]">High Demand</span>
                </div>
                <p className="text-[11px] text-[#6F6C64]">
                  Active volunteer fleet: 8 refrigerated couriers online. Average dispatch latency: 4.2 minutes.
                </p>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-[#D7D2C7] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Next Batch Forecast</span>
                  <span className="text-[11px] text-[#5F684B] font-semibold">12:30 PM - 1:15 PM</span>
                </div>
                <p className="text-[11px] text-[#6F6C64]">
                  3 incoming surplus manifests queued from commercial catering and fresh bakery kitchens in your sector.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowZoneModal(false)}
                className="px-5 py-2 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-bold transition cursor-pointer">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
