import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  Plus,
  Filter,
  Download,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  Leaf,
  ArrowRight,
  Sparkles,
  BarChart3,
  TrendingUp,
  Activity,
  Layers,
  LayoutDashboard
} from 'lucide-react';
import { apiRequest, getUser, clearUser } from '../api';
import { getSocket } from '../socket';
import Sidebar from '../components/common/Sidebar';
import TopNavbar from '../components/common/TopNavbar';
import StatusBadge from '../components/common/StatusBadge';
import KpiCard from '../components/common/KpiCard';
import DonationForm from '../components/DonationForm';

export default function DonorDashboard({ initialTab }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [filterType, setFilterType] = useState('all');

  const path = location.pathname;
  const currentTab =
    initialTab ||
    (path === '/donor/donations/new'
      ? 'new_donation'
      : path === '/donor/donations'
      ? 'donations'
      : 'dashboard');

  const [activeTab, setActiveTab] = useState(currentTab);

  useEffect(() => {
    if (path === '/donor/donations/new') {
      setActiveTab('new_donation');
    } else if (path === '/donor/donations') {
      setActiveTab('donations');
    } else if (path === '/donor' || path === '/donor/' || path.startsWith('/donor/dashboard')) {
      setActiveTab('dashboard');
    }
  }, [path]);

  useEffect(() => {
    if (!user || user.role !== 'donor') {
      navigate('/login');
      return;
    }
    fetchDonations();

    const socket = getSocket();
    function handleStatusChanged({ donationId, status }) {
      setDonations(prev =>
        prev.map(d => (d.id === donationId ? { ...d, status } : d))
      );
    }

    socket.on('donation:status_changed', handleStatusChanged);
    return () => {
      socket.off('donation:status_changed', handleStatusChanged);
    };
  }, []);

  async function fetchDonations() {
    try {
      const data = await apiRequest('/api/donations/mine');
      setDonations(data.donations || []);
    } catch (err) {
      console.error('Failed to fetch donations:', err);
    } finally {
      setLoading(false);
    }
  }

  // Analytics & Metric Calculations
  const totalCount = donations.length;
  const activePickups = donations.filter(d => ['matched', 'picked_up'].includes(d.status)).length;
  const deliveredCount = donations.filter(d => d.status === 'delivered').length;
  const expiredCount = donations.filter(d => d.status === 'expired').length;
  const postedCount = donations.filter(d => d.status === 'posted').length;

  const totalKg = donations.reduce((sum, d) => sum + (parseFloat(d.weight_kg) || 0), 0);
  const deliveredKg = donations.filter(d => d.status === 'delivered').reduce((sum, d) => sum + (parseFloat(d.weight_kg) || 0), 0);
  const mealsRescued = Math.round(totalKg * 2.5);
  const co2eAvoided = (totalKg * 2.5).toFixed(1);

  const activeDonations = donations.filter(d => ['posted', 'matched', 'picked_up'].includes(d.status));
  const recentDonations = donations.slice(0, 4);

  // Filtered donations for My Donations ledger
  const filteredDonations = filterType === 'all'
    ? donations
    : donations.filter(d => d.status === filterType);

  function timeAgo(date) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  function expiryCountdown(date) {
    const diff = new Date(date).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `Expires in ${hrs}h ${mins}m`;
  }

  function exportCSV() {
    if (donations.length === 0) return alert('No donations to export.');
    const headers = ['ID', 'Description', 'Type', 'Quantity', 'Unit', 'Status', 'Posted At', 'Expiry'];
    const rows = donations.map(d => [
      d.id,
      `"${d.food_description.replace(/"/g, '""')}"`,
      d.food_type,
      d.quantity,
      d.unit,
      d.status,
      d.posted_at,
      d.expiry_window_end
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `foodrescue_donations_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="min-h-screen bg-[#FAF7F1] text-[#22211E] flex flex-col md:flex-row">
      {/* Reusable Sidebar */}
      <Sidebar
        role="donor"
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={mobileMenuOpen}
        setIsOpen={setMobileMenuOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopNavbar
          role="donor"
          onMenuClick={() => setMobileMenuOpen(true)}
          statusLabel="Online Status"
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {activeTab === 'new_donation' ? (
            /* ============================================================ */
            /* VIEW 1: Post New Donation View                               */
            /* ============================================================ */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setActiveTab('donations'); navigate('/donor/donations'); }}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#6F6C64] hover:text-[#22211E] transition cursor-pointer">
                  <ChevronLeft size={16} />
                  <span>Back to My Donations</span>
                </button>
              </div>

              <DonationForm
                onSuccess={() => {
                  fetchDonations();
                  setActiveTab('donations');
                  navigate('/donor/donations');
                }}
                onCancel={() => {
                  setActiveTab('donations');
                  navigate('/donor/donations');
                }}
              />
            </div>
          ) : activeTab === 'dashboard' ? (
            /* ============================================================ */
            /* VIEW 2: Dedicated Donor Operations Dashboard                 */
            /* ============================================================ */
            <div className="space-y-6">
              {/* Dashboard Header with Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8EED2] text-[#4D553C] border border-[#D7D2C7]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5F684B] animate-pulse" />
                      Live Logistics Hub
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#22211E]">
                    Logistics Operations Dashboard
                  </h1>
                  <p className="text-xs sm:text-sm text-[#6F6C64] mt-1">
                    Real-time surplus food dispatch analytics, active courier tracking & redistribution pipeline.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => { setActiveTab('donations'); navigate('/donor/donations'); }}
                    className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-[#D7D2C7] bg-[#FDFBF7] text-[#22211E] hover:bg-[#F3EFE7] transition shadow-xs flex items-center gap-1.5 cursor-pointer">
                    <Package size={15} />
                    <span>View All Manifests</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('new_donation'); navigate('/donor/donations/new'); }}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white transition shadow-xs flex items-center gap-1.5 cursor-pointer">
                    <Plus size={16} strokeWidth={2.4} />
                    <span>New Donation</span>
                  </button>
                </div>
              </div>

              {/* 4 Operations KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                <KpiCard
                  label="Total Food Rescued"
                  value={`${totalKg.toFixed(0)} kg`}
                  change={`${totalCount} surplus batches posted`}
                  icon={Package}
                />
                <KpiCard
                  label="Active Dispatches"
                  value={activePickups}
                  change={activePickups > 0 ? `${activePickups} in transit / matched` : '0 couriers in transit'}
                  icon={Truck}
                />
                <KpiCard
                  label="Delivered Surplus"
                  value={deliveredCount}
                  change={`${deliveredCount} batches fulfilled`}
                  icon={CheckCircle2}
                />
                <KpiCard
                  label="Estimated Meals"
                  value={mealsRescued}
                  change={`${co2eAvoided} kg CO2e avoided`}
                  icon={Sparkles}
                />
              </div>

              {/* 2-Column Operational Pipeline Hub */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Column 1: Live Dispatch & Courier Status (7 cols) */}
                <div className="lg:col-span-7 card-warm rounded-2xl p-6 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#D7D2C7]">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#E8EED2] text-[#5F684B] flex items-center justify-center">
                          <Activity size={18} />
                        </div>
                        <div>
                          <h2 className="text-sm font-bold text-[#22211E]">Live Logistics & Courier Pipeline</h2>
                          <p className="text-[11px] text-[#6F6C64]">Active dispatches currently matching or in transit</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FAF7F1] border border-[#D7D2C7] text-[#22211E]">
                        {activeDonations.length} Active
                      </span>
                    </div>

                    {activeDonations.length === 0 ? (
                      <div className="py-10 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-[#E8EED2]/60 text-[#5F684B] flex items-center justify-center mx-auto mb-3">
                          <CheckCircle2 size={24} />
                        </div>
                        <p className="text-sm font-bold text-[#22211E]">All Current Batches Fulfilled</p>
                        <p className="text-xs text-[#6F6C64] mt-1 max-w-sm mx-auto">
                          There are no pending dispatches or couriers in transit right now. Post your next surplus batch to mobilize volunteer couriers.
                        </p>
                        <button
                          onClick={() => { setActiveTab('new_donation'); navigate('/donor/donations/new'); }}
                          className="mt-4 px-4 py-2 rounded-xl bg-[#5F684B] text-white text-xs font-semibold hover:bg-[#4D553C] transition cursor-pointer">
                          + Post Surplus Donation
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activeDonations.map(d => (
                          <div
                            key={d.id}
                            className="p-3.5 rounded-xl border border-[#D7D2C7] bg-[#FAF7F1] hover:bg-[#F3EFE7]/50 transition flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-[#22211E] truncate">
                                  {d.food_description}
                                </span>
                                <StatusBadge status={d.status} />
                              </div>
                              <p className="text-[11px] text-[#6F6C64] mt-1 flex items-center gap-1.5 truncate">
                                <MapPin size={11} className="text-[#99958B] shrink-0" />
                                <span className="truncate">{d.pickup_address}</span>
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-bold text-xs text-[#5F684B]">
                                {d.quantity} {d.unit}
                              </span>
                              <p className="text-[10px] text-[#99958B]">
                                {expiryCountdown(d.expiry_window_end)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-[#D7D2C7] flex items-center justify-between text-xs text-[#6F6C64]">
                    <span>Real-time courier dispatch enabled</span>
                    <button
                      onClick={() => { setActiveTab('donations'); navigate('/donor/donations'); }}
                      className="font-bold text-[#5F684B] hover:underline flex items-center gap-1 cursor-pointer">
                      <span>View Full Manifests</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>

                {/* Column 2: Environmental & Social Impact Card (5 cols) */}
                <div className="lg:col-span-5 card-warm rounded-2xl p-6 shadow-xs flex flex-col justify-between bg-gradient-to-br from-[#FDFBF7] to-[#F3EFE7]">
                  <div>
                    <div className="flex items-center gap-2 pb-4 mb-4 border-b border-[#D7D2C7]">
                      <div className="w-8 h-8 rounded-xl bg-[#E8EED2] text-[#5F684B] flex items-center justify-center">
                        <Leaf size={18} />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-[#22211E]">Environmental Impact</h2>
                        <p className="text-[11px] text-[#6F6C64]">Safe harbor surplus redistribution metrics</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="p-3.5 rounded-xl bg-white/80 border border-[#D7D2C7] flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-bold text-[#6F6C64] uppercase tracking-wider block">
                            CO2e Emissions Avoided
                          </span>
                          <span className="text-xl font-extrabold text-[#22211E] tracking-tight">
                            {co2eAvoided} kg
                          </span>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-[#E8EED2] text-[#5F684B] flex items-center justify-center font-bold text-xs">
                          🌱
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-white/80 border border-[#D7D2C7] flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-bold text-[#6F6C64] uppercase tracking-wider block">
                            Nutritious Meals Served
                          </span>
                          <span className="text-xl font-extrabold text-[#22211E] tracking-tight">
                            {mealsRescued} meals
                          </span>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-[#E8EED2] text-[#5F684B] flex items-center justify-center font-bold text-xs">
                          🍲
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-white/80 border border-[#D7D2C7] flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-bold text-[#6F6C64] uppercase tracking-wider block">
                            Landfill Diversion Rate
                          </span>
                          <span className="text-xl font-extrabold text-[#5F684B] tracking-tight">
                            100%
                          </span>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-[#E8EED2] text-[#5F684B] flex items-center justify-center font-bold text-xs">
                          ♻️
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-[#D7D2C7]">
                    <button
                      onClick={() => navigate('/impact')}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs">
                      <BarChart3 size={15} />
                      <span>Explore Public Impact Portal</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent Activity Ledger Preview */}
              <div className="card-warm rounded-2xl overflow-hidden shadow-xs">
                <div className="px-6 py-4 border-b border-[#D7D2C7] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-[#22211E]">Recent Manifests Activity</h2>
                    <span className="text-[11px] text-[#6F6C64] px-2 py-0.5 rounded-full bg-[#EFECE6] border border-[#D7D2C7]">
                      Latest batches
                    </span>
                  </div>

                  <button
                    onClick={() => { setActiveTab('donations'); navigate('/donor/donations'); }}
                    className="text-xs font-bold text-[#5F684B] hover:underline flex items-center gap-1 cursor-pointer">
                    <span>View All Manifests Ledger</span>
                    <ArrowRight size={13} />
                  </button>
                </div>

                {loading ? (
                  <div className="py-12 text-center text-xs text-[#6F6C64]">
                    Loading recent manifests...
                  </div>
                ) : recentDonations.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#6F6C64]">
                    No donations posted yet. Click "+ New Donation" to start.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#D7D2C7] bg-[#F3EFE7]/60 text-[11px] font-semibold text-[#6F6C64] uppercase tracking-wider">
                          <th className="py-3 px-6">Description</th>
                          <th className="py-3 px-4">Category</th>
                          <th className="py-3 px-4">Quantity</th>
                          <th className="py-3 px-4">Driver Rating</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-6 text-right">Timing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D7D2C7]/60">
                        {recentDonations.map(d => (
                          <tr key={d.id} className="hover:bg-[#F3EFE7]/40 transition-colors">
                            <td className="py-3.5 px-6">
                              <p className="font-bold text-[#22211E] text-xs">{d.food_description}</p>
                              <p className="text-[11px] text-[#6F6C64] mt-0.5 truncate">{d.pickup_address}</p>
                            </td>
                            <td className="py-3.5 px-4 capitalize text-[#4D553C]">
                              {d.food_type.replace('_', ' ')}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-[#22211E]">
                              {d.quantity} {d.unit}
                            </td>
                            <td className="py-3.5 px-4 text-[#6F684B] font-semibold">
                              {d.driver_name ? `${d.driver_name} ${d.driver_rating != null ? `(${Number(d.driver_rating).toFixed(1)}★)` : '(New)'}` : 'Not assigned'}
                            </td>
                            <td className="py-3.5 px-4">
                              <StatusBadge status={d.status} />
                            </td>
                            <td className="py-3.5 px-6 text-right text-[11px] text-[#6F6C64]">
                              Posted {timeAgo(d.posted_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* VIEW 3: My Donations Full Manifests Ledger                   */
            /* ============================================================ */
            <div className="space-y-6">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#22211E]">
                    My Donations
                  </h1>
                  <p className="text-xs sm:text-sm text-[#6F6C64] mt-1">
                    Track and manage all your surplus food manifests, batch history, and pickup statuses.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="relative">
                    <select
                      value={filterType}
                      onChange={e => setFilterType(e.target.value)}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-[#D7D2C7] bg-[#F8F5EE] text-[#22211E] hover:bg-[#F3EFE7] transition cursor-pointer appearance-none pr-8">
                      <option value="all">Filter: All Statuses</option>
                      <option value="posted">Posted</option>
                      <option value="matched">Matched</option>
                      <option value="picked_up">Picked Up</option>
                      <option value="delivered">Delivered</option>
                      <option value="expired">Expired</option>
                    </select>
                    <Filter size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6F6C64] pointer-events-none" />
                  </div>

                  <button
                    onClick={exportCSV}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#D7D2C7] bg-[#FDFBF7] text-[#6F6C64] hover:text-[#22211E] hover:bg-[#F3EFE7] text-xs font-semibold transition cursor-pointer shadow-xs">
                    <Download size={13} />
                    <span>Export CSV</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('new_donation'); navigate('/donor/donations/new'); }}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer">
                    <Plus size={16} strokeWidth={2.4} />
                    <span>New Donation</span>
                  </button>
                </div>
              </div>

              {/* 4 Summary KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                <KpiCard
                  label="Total Donations"
                  value={totalCount}
                  icon={Package}
                />
                <KpiCard
                  label="Active Pickups"
                  value={activePickups}
                  icon={Truck}
                />
                <KpiCard
                  label="Delivered Surplus"
                  value={deliveredCount}
                  icon={CheckCircle2}
                />
                <KpiCard
                  label="Expired Batches"
                  value={expiredCount}
                  icon={Clock}
                />
              </div>

              {/* Full Manifests Table Card */}
              <div className="card-warm rounded-2xl overflow-hidden shadow-xs">
                {/* Table Header Controls */}
                <div className="px-6 py-4 border-b border-[#D7D2C7] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-sm font-bold text-[#22211E]">All Manifests</h2>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#EFECE6] text-[#6F6C64] border border-[#D7D2C7]">
                      {filteredDonations.length} records
                    </span>
                  </div>
                </div>

                {/* Table / List View */}
                {loading ? (
                  <div className="py-16 text-center text-xs text-[#6F6C64]">
                    Loading surplus manifests...
                  </div>
                ) : filteredDonations.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#E8EED2] text-[#5F684B] flex items-center justify-center mx-auto mb-3">
                      <Package size={22} />
                    </div>
                    <p className="text-sm font-bold text-[#22211E]">No surplus donations found</p>
                    <p className="text-xs text-[#6F6C64] mt-1 max-w-sm mx-auto">
                      Click "+ New Donation" above to post fresh excess food or produce for regional shelter redistribution.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[#D7D2C7] bg-[#F3EFE7]/60 text-[11px] font-semibold text-[#6F6C64] uppercase tracking-wider">
                            <th className="py-3 px-6">Description</th>
                            <th className="py-3 px-4">Type</th>
                            <th className="py-3 px-4">Quantity</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Posted At & Logistics</th>
                            <th className="py-3 px-6 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#D7D2C7]/60">
                          {filteredDonations.map(d => (
                            <tr key={d.id} className="hover:bg-[#F3EFE7]/40 transition-colors">
                              {/* Description with meta */}
                              <td className="py-4 px-6 align-top max-w-[240px]">
                                <p className="font-bold text-[#22211E] text-xs leading-snug line-clamp-2">
                                  {d.food_description}
                                </p>
                                <div className="flex items-center gap-1.5 text-[11px] text-[#6F6C64] mt-1">
                                  <MapPin size={11} className="shrink-0 text-[#99958B]" />
                                  <span className="truncate">{d.pickup_address}</span>
                                </div>
                              </td>

                              {/* Food Type */}
                              <td className="py-4 px-4 align-top">
                                <span className="capitalize text-[#4D553C] font-medium bg-[#E8EED2]/70 px-2 py-0.5 rounded-md border border-[#D7D2C7]">
                                  {d.food_type.replace('_', ' ')}
                                </span>
                              </td>

                              {/* Quantity */}
                              <td className="py-4 px-4 align-top">
                                <span className="font-bold text-[#22211E] text-xs">
                                  {d.quantity} {d.unit}
                                </span>
                                {d.weight_kg && (
                                  <span className="block text-[11px] text-[#6F6C64] mt-0.5">
                                    ~{parseFloat(d.weight_kg).toFixed(1)} kg
                                  </span>
                                )}
                              </td>

                              {/* Status Badge */}
                              <td className="py-4 px-4 align-top">
                                <StatusBadge status={d.status} />
                              </td>

                              {/* Logistics & Timers */}
                              <td className="py-4 px-4 align-top text-xs">
                                {d.status === 'delivered' ? (
                                  <p className="text-[#5F684B] font-semibold flex items-center gap-1">
                                    <CheckCircle2 size={13} />
                                    <span>Delivered safely</span>
                                  </p>
                                ) : (
                                  <>
                                    <p className="font-medium text-[#22211E]">
                                      Posted {timeAgo(d.posted_at)}
                                    </p>
                                    <p className="text-[11px] text-[#6F6C64] mt-0.5 flex items-center gap-1">
                                      <Clock size={11} className="text-[#99958B]" />
                                      <span>{expiryCountdown(d.expiry_window_end)}</span>
                                    </p>
                                  </>
                                )}
                              </td>

                              {/* Action Buttons */}
                              <td className="py-4 px-6 align-top text-right">
                                <button
                                  onClick={() => alert(`Manifest Details:\nID: ${d.id}\nItem: ${d.food_description}\nQuantity: ${d.quantity} ${d.unit}\nStatus: ${d.status}\nPickup: ${d.pickup_address}`)}
                                  className="px-3 py-1.5 rounded-lg border border-[#D7D2C7] bg-[#FDFBF7] text-[#22211E] hover:bg-[#F3EFE7] font-semibold text-[11px] transition cursor-pointer">
                                  {d.status === 'matched' ? 'Track Route' : d.status === 'picked_up' ? 'View Manifest' : d.status === 'delivered' ? 'Receipt' : 'View Details'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Bar (Image 2) */}
                    <div className="px-6 py-4 border-t border-[#D7D2C7] flex items-center justify-between text-xs text-[#6F6C64]">
                      <span>
                        Showing {filteredDonations.length} of {totalCount} donations
                      </span>
                      <div className="flex items-center gap-1">
                        <button className="px-2.5 py-1 rounded-lg border border-[#D7D2C7] bg-[#FDFBF7] text-[#6F6C64] hover:bg-[#F3EFE7] disabled:opacity-50">
                          Previous
                        </button>
                        <span className="w-6 h-6 rounded-lg bg-[#5F684B] text-white flex items-center justify-center font-bold text-xs">
                          1
                        </span>
                        <button className="px-2.5 py-1 rounded-lg border border-[#D7D2C7] bg-[#FDFBF7] text-[#6F6C64] hover:bg-[#F3EFE7] disabled:opacity-50">
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Bottom Notice Card (Image 2) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#E8EED2]/50 border border-[#D7D2C7] flex items-start gap-3 text-xs leading-relaxed text-[#4D553C]">
                <ShieldCheck size={18} className="shrink-0 text-[#5F684B] mt-0.5" />
                <div>
                  <strong className="font-bold text-[#22211E]">
                    Standard Donor Safe Harbor & Safe Packaging Reminder
                  </strong>
                  <p className="mt-0.5 text-[#5F684B]">
                    Surplus perishables must maintain certified thermal tolerances prior to carrier courier arrival. For matched orders, please keep items refrigerated until the verified driver presents the corresponding digital manifest confirmation code.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
