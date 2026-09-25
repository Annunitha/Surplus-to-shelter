import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Package,
  Truck,
  Route,
  CheckCircle2,
  Clock,
  MapPin,
  AlertCircle,
  Thermometer,
  Eye,
  Search,
  Filter,
  ArrowUpRight,
  RotateCw,
  Building2,
  Calendar,
  X,
  ShieldCheck,
  FileText,
  Utensils,
  Milk,
  Carrot,
  Croissant,
  Phone,
  Check
} from 'lucide-react';
import { apiRequest, getUser } from '../api';
import Sidebar from '../components/common/Sidebar';
import TopNavbar from '../components/common/TopNavbar';

export default function DriverDonations() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: paramDonationId } = useParams();
  const user = getUser();

  const [driver, setDriver] = useState(null);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [foodTypeFilter, setFoodTypeFilter] = useState('all');

  useEffect(() => {
    if (!user || user.role !== 'driver') {
      navigate('/login');
      return;
    }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [driverRes, donationsRes] = await Promise.all([
        apiRequest('/api/drivers/me').catch(() => ({ driver: null })),
        apiRequest('/api/drivers/me/donations').catch(() => ({ donations: [] }))
      ]);

      if (driverRes?.driver) {
        setDriver(driverRes.driver);
      }
      const list = donationsRes?.donations || [];
      setDonations(list);

      // If a specific donation ID is in URL, auto-select it
      if (paramDonationId) {
        const found = list.find(d => d.id === paramDonationId || d.donation_id === paramDonationId);
        if (found) {
          setSelectedDonation(found);
          setShowDetailModal(true);
        } else {
          // Fetch single donation directly
          fetchSingleDonation(paramDonationId);
        }
      }
    } catch (err) {
      console.error('Failed to load driver donations:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSingleDonation(donationId) {
    try {
      const res = await apiRequest(`/api/drivers/me/donations/${donationId}`);
      if (res?.donation) {
        setSelectedDonation(res.donation);
        setShowDetailModal(true);
      }
    } catch (err) {
      console.error('Failed to fetch donation detail:', err);
    }
  }

  function handleOpenDetails(donation) {
    setSelectedDonation(donation);
    setShowDetailModal(true);
    // Optionally update URL smoothly
    window.history.replaceState(null, '', `/driver/donations/${donation.id}`);
  }

  function handleCloseDetails() {
    setShowDetailModal(false);
    setSelectedDonation(null);
    window.history.replaceState(null, '', '/driver/donations');
  }

  // Filtered donations
  const filteredDonations = donations.filter(d => {
    const matchesSearch =
      searchQuery === '' ||
      d.food_description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.donor?.org_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.recipient?.org_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.assignment_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.id?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'intake_requested' && (d.status === 'intake_requested' || d.status === 'pending')) ||
      (statusFilter === 'assigned' && (d.status === 'matched' || d.status === 'assigned')) ||
      (statusFilter === 'picked_up' && d.status === 'picked_up') ||
      (statusFilter === 'in_transit' && (d.status === 'picked_up' || d.status === 'in_transit')) ||
      (statusFilter === 'delivered' && d.status === 'delivered') ||
      (statusFilter === 'cancelled' && d.status === 'cancelled');

    const matchesFoodType =
      foodTypeFilter === 'all' || d.food_type === foodTypeFilter;

    return matchesSearch && matchesStatus && matchesFoodType;
  });

  // Calculate KPIs
  const totalDeliveries = donations.length;
  const completedDeliveries = donations.filter(d => d.status === 'delivered').length;
  const inTransitDeliveries = donations.filter(d => d.status === 'picked_up' || d.status === 'matched' || d.status === 'intake_requested').length;
  const totalMealsDelivered = donations
    .filter(d => d.status === 'delivered')
    .reduce((sum, d) => {
      const kg = parseFloat(d.weight_kg) || parseFloat(d.quantity) || 0;
      return sum + Math.round(kg / 0.545);
    }, 0);

  function getFoodTypeIcon(type) {
    switch (type) {
      case 'prepared_meals':
        return <Utensils size={14} className="text-[#5F684B]" />;
      case 'produce':
        return <Carrot size={14} className="text-[#5F684B]" />;
      case 'bakery':
        return <Croissant size={14} className="text-[#5F684B]" />;
      case 'dairy':
        return <Milk size={14} className="text-[#5F684B]" />;
      default:
        return <Package size={14} className="text-[#5F684B]" />;
    }
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E8EED2] text-[#4D553C] border border-[#D7D2C7]">
            <Check size={12} strokeWidth={2.4} />
            <span>Delivered</span>
          </span>
        );
      case 'picked_up':
      case 'in_transit':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#DCE7B8] text-[#3D4726] border border-[#CAD7A0] shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5F684B] animate-pulse" />
            <span>In Transit</span>
          </span>
        );
      case 'intake_requested':
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F5EEDB] text-[#7A5B1E] border border-[#E8DBB8] shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B88728] animate-pulse" />
            <span>Intake Requested</span>
          </span>
        );
      case 'matched':
      case 'assigned':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E8EEF5] text-[#2C4D75] border border-[#CAD6E2]">
            <Clock size={12} strokeWidth={2.4} />
            <span>Assigned</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#EFECE6] text-[#6F6C64] border border-[#D7D2C7]">
            <X size={12} strokeWidth={2.4} />
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F3EFE7] text-[#6F6C64] border border-[#D7D2C7]">
            <span>{status || 'Active'}</span>
          </span>
        );
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Recent';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="min-h-screen bg-[#FAF7F1] text-[#22211E] flex flex-col md:flex-row">
      {/* SIDEBAR */}
      <Sidebar
        role="driver"
        activeTab="donations"
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
          statusLabel="Courier Deliveries Archive"
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* PAGE TITLE & SUBTITLE */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-[30px] font-bold tracking-tight text-[#22211E]">
                  My Donations
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E8EED2] text-[#4D553C] border border-[#D7D2C7]">
                  {donations.length} Assigned {donations.length === 1 ? 'Rescue' : 'Rescues'}
                </span>
              </div>
              <p className="text-xs sm:text-[13px] text-[#6F6C64] mt-1 leading-relaxed">
                Track food rescue donations associated with your deliveries.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={loadData}
                disabled={loading}
                className="px-4 py-2 rounded-xl border border-[#D7D2C7] bg-[#FDFBF7] hover:bg-[#F3EFE7] text-[#22211E] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs">
                <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>Refresh Feed</span>
              </button>
              <button
                onClick={() => navigate('/driver')}
                className="px-4 py-2 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs">
                <Route size={14} />
                <span>Current Mission</span>
              </button>
            </div>
          </div>

          {/* KPI CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Deliveries */}
            <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#6F6C64] mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Deliveries</span>
                <div className="w-8 h-8 rounded-lg bg-[#EAE4D8] flex items-center justify-center text-[#5F684B]">
                  <Truck size={16} />
                </div>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold tracking-tight text-[#22211E]">
                  {totalDeliveries}
                </p>
                <p className="text-[11px] text-[#6F6C64] mt-1">All assigned rescue operations</p>
              </div>
            </div>

            {/* Completed */}
            <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#6F6C64] mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider">Completed</span>
                <div className="w-8 h-8 rounded-lg bg-[#E8EED2] flex items-center justify-center text-[#4D553C]">
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold tracking-tight text-[#4D553C]">
                  {completedDeliveries}
                </p>
                <p className="text-[11px] text-[#6F6C64] mt-1">Successfully transferred to shelters</p>
              </div>
            </div>

            {/* In Transit */}
            <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#6F6C64] mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider">In Transit</span>
                <div className="w-8 h-8 rounded-lg bg-[#DCE7B8] flex items-center justify-center text-[#3D4726]">
                  <Route size={16} />
                </div>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold tracking-tight text-[#22211E]">
                  {inTransitDeliveries}
                </p>
                <p className="text-[11px] text-[#6F6C64] mt-1">Active or awaiting pickup</p>
              </div>
            </div>

            {/* Meals Delivered */}
            <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#6F6C64] mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider">Meals Delivered</span>
                <div className="w-8 h-8 rounded-lg bg-[#EAE4D8] flex items-center justify-center text-[#5F684B]">
                  <Utensils size={16} />
                </div>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold tracking-tight text-[#22211E]">
                  {totalMealsDelivered}
                </p>
                <p className="text-[11px] text-[#6F6C64] mt-1">Portions provided to community</p>
              </div>
            </div>
          </div>

          {/* SEARCH & FILTERS BAR */}
          <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6F6C64]"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search food item, donor, shelter, or route ID..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#FAF7F1] border border-[#D7D2C7] rounded-xl text-xs sm:text-sm text-[#22211E] placeholder-[#8A857A] focus:outline-hidden focus:border-[#5F684B] transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6F6C64] hover:text-[#22211E] cursor-pointer">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Filter size={14} className="text-[#6F6C64]" />
                <span className="text-xs font-semibold text-[#6F6C64]">Filter:</span>
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-[#FAF7F1] border border-[#D7D2C7] rounded-xl text-xs font-medium text-[#22211E] focus:outline-hidden focus:border-[#5F684B] cursor-pointer">
                <option value="all">All Statuses</option>
                <option value="intake_requested">Intake Requested</option>
                <option value="assigned">Assigned</option>
                <option value="picked_up">Picked Up</option>
                <option value="in_transit">In Transit</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>

              {/* Food Category Filter */}
              <select
                value={foodTypeFilter}
                onChange={e => setFoodTypeFilter(e.target.value)}
                className="px-3 py-2 bg-[#FAF7F1] border border-[#D7D2C7] rounded-xl text-xs font-medium text-[#22211E] focus:outline-hidden focus:border-[#5F684B] cursor-pointer">
                <option value="all">All Food Types</option>
                <option value="prepared_meals">Prepared Meals</option>
                <option value="produce">Produce</option>
                <option value="bakery">Bakery</option>
                <option value="dairy">Dairy</option>
                <option value="dry_goods">Dry Goods</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* DONATIONS LIST / TABLE */}
          <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl overflow-hidden shadow-xs">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-[#5F684B]">
                <RotateCw size={24} className="animate-spin" />
              </div>
            ) : filteredDonations.length === 0 ? (
              <div className="py-16 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-[#EAE4D8] text-[#6F6C64] flex items-center justify-center mx-auto mb-3">
                  <Package size={22} />
                </div>
                <h3 className="text-base font-bold text-[#22211E]">No Donations Found</h3>
                <p className="text-xs text-[#6F6C64] max-w-sm mx-auto mt-1">
                  {searchQuery || statusFilter !== 'all' || foodTypeFilter !== 'all'
                    ? 'No deliveries matched your current search filters. Try clearing them to see all records.'
                    : 'You do not have any delivery assignments yet. When dispatch routes a rescue to you, it will appear here.'}
                </p>
                {(searchQuery || statusFilter !== 'all' || foodTypeFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                      setFoodTypeFilter('all');
                    }}
                    className="mt-4 px-4 py-2 rounded-xl bg-[#5F684B] text-white text-xs font-semibold cursor-pointer">
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#D7D2C7] bg-[#F3EFE7]/80 text-[11px] font-bold text-[#6F6C64] uppercase tracking-wider">
                      <th className="py-3.5 px-4">Donation</th>
                      <th className="py-3.5 px-4">Food Type</th>
                      <th className="py-3.5 px-4">Quantity</th>
                      <th className="py-3.5 px-4">Donor</th>
                      <th className="py-3.5 px-4">Recipient</th>
                      <th className="py-3.5 px-4">Assignment</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3DDD1] text-xs">
                    {filteredDonations.map(d => {
                      const portionEst = d.weight_kg
                        ? Math.round(parseFloat(d.weight_kg) / 0.545)
                        : d.quantity
                        ? Math.round(parseFloat(d.quantity) * 3.3)
                        : 0;

                      return (
                        <tr
                          key={d.id}
                          className="hover:bg-[#F3EFE7]/60 transition-colors">
                          {/* Donation */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-[#22211E] max-w-[200px] truncate" title={d.food_description}>
                              {d.food_description || 'Surplus Food'}
                            </div>
                            <div className="text-[11px] text-[#6F6C64] mt-0.5">
                              {d.weight_kg ? `${d.weight_kg} kg` : `${d.quantity} ${d.unit}`} • ~{portionEst} portions
                            </div>
                          </td>

                          {/* Food Type */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF7F1] border border-[#D7D2C7] text-xs font-medium text-[#22211E]">
                              {getFoodTypeIcon(d.food_type)}
                              <span className="capitalize">{d.food_type?.replace('_', ' ') || 'General'}</span>
                            </span>
                          </td>

                          {/* Quantity */}
                          <td className="py-3.5 px-4 whitespace-nowrap font-medium text-[#22211E]">
                            {d.quantity} {d.unit || 'units'}
                          </td>

                          {/* Donor */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-[#22211E] max-w-[140px] truncate" title={d.donor?.org_name}>
                              {d.donor?.org_name || 'Donor'}
                            </div>
                            <div className="text-[11px] text-[#6F6C64] max-w-[140px] truncate" title={d.donor?.address}>
                              {d.donor?.address?.split(',')[0] || 'Pickup point'}
                            </div>
                          </td>

                          {/* Recipient */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-[#22211E] max-w-[140px] truncate" title={d.recipient?.org_name}>
                              {d.recipient?.org_name || 'Shelter'}
                            </div>
                            <div className="text-[11px] text-[#6F6C64] max-w-[140px] truncate" title={d.recipient?.address}>
                              {d.recipient?.address?.split(',')[0] || 'Dropoff location'}
                            </div>
                          </td>

                          {/* Assignment */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-[#FAF7F1] border border-[#D7D2C7] text-[#5F684B]">
                              {d.assignment_code || `#FR-${d.id.slice(0, 4).toUpperCase()}`}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {getStatusBadge(d.status)}
                          </td>

                          {/* Date */}
                          <td className="py-3.5 px-4 whitespace-nowrap text-[#6F6C64]">
                            {formatDate(d.delivery?.actual_delivery_time || d.posted_at)}
                          </td>

                          {/* Action */}
                          <td className="py-3.5 px-4 whitespace-nowrap text-right">
                            <button
                              onClick={() => handleOpenDetails(d)}
                              className="px-3 py-1.5 rounded-xl border border-[#D7D2C7] bg-[#FAF7F1] hover:bg-[#EAE4D8] text-[#22211E] font-semibold text-xs inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs">
                              <Eye size={13} className="text-[#5F684B]" />
                              <span>View Details</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* DONATION DETAILS MODAL */}
      {showDetailModal && selectedDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-[#FAF7F1] border border-[#D7D2C7] rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#D7D2C7]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-[#DCE7B8] text-[#3D4726] border border-[#CAD7A0]">
                    {selectedDonation.assignment_code || `#FR-${selectedDonation.id.slice(0, 4).toUpperCase()}`}
                  </span>
                  {getStatusBadge(selectedDonation.status)}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#22211E] mt-1.5">
                  {selectedDonation.food_description}
                </h2>
                <p className="text-xs text-[#6F6C64] mt-0.5">
                  Rescued surplus logistics record • ID: {selectedDonation.id}
                </p>
              </div>
              <button
                onClick={handleCloseDetails}
                className="p-2 rounded-xl text-[#6F6C64] hover:bg-[#EAE4D8] hover:text-[#22211E] transition cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="py-6 space-y-6">
              {/* Mission Key Attributes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-[#6F6C64] uppercase">Category</p>
                  <p className="text-sm font-bold text-[#22211E] capitalize mt-0.5">
                    {selectedDonation.food_type?.replace('_', ' ')}
                  </p>
                </div>
                <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-[#6F6C64] uppercase">Quantity</p>
                  <p className="text-sm font-bold text-[#22211E] mt-0.5">
                    {selectedDonation.quantity} {selectedDonation.unit}
                  </p>
                </div>
                <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-[#6F6C64] uppercase">Total Weight</p>
                  <p className="text-sm font-bold text-[#22211E] mt-0.5">
                    {selectedDonation.weight_kg ? `${selectedDonation.weight_kg} kg` : 'N/A'}
                  </p>
                </div>
                <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-[#6F6C64] uppercase">Yield</p>
                  <p className="text-sm font-bold text-[#4D553C] mt-0.5">
                    ~{selectedDonation.weight_kg ? Math.round(parseFloat(selectedDonation.weight_kg) / 0.545) : Math.round(parseFloat(selectedDonation.quantity) * 3.3)} meals
                  </p>
                </div>
              </div>

              {/* Temperature & Handling Requirements */}
              <div className="bg-[#F3EFE7] border border-[#D7D2C7] rounded-2xl p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-[#5F684B] uppercase tracking-wider mb-2">
                  <Thermometer size={16} />
                  <span>Temperature & Safe Handling Compliance</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#6F6C64]">Target Temperature Window:</span>
                    <p className="font-bold text-[#22211E] mt-0.5">
                      {selectedDonation.temperature_range || 'Ambient (15°C - 25°C)'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#6F6C64]">Handling Protocol:</span>
                    <p className="font-semibold text-[#22211E] mt-0.5">
                      {selectedDonation.handling_requirements || 'Standard perishable transport. Keep upright.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Special Handling / On-Site Dispatch Notes */}
              {selectedDonation.notes && (
                <div className="bg-[#FAF7F1] border border-[#D7D2C7] rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#5F684B] uppercase tracking-wider mb-1.5">
                    <FileText size={15} />
                    <span>Special Handling / Dispatch Notes</span>
                  </div>
                  <p className="text-xs text-[#22211E] whitespace-pre-wrap leading-relaxed font-medium bg-[#F8F5EE] p-3 rounded-xl border border-[#E3DDD1]">
                    {selectedDonation.notes}
                  </p>
                </div>
              )}

              {/* Route: Pickup & Dropoff */}
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Pickup Location */}
                <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-4.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#5F684B] uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin size={14} />
                      <span>Pickup Origin</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FAF7F1] border border-[#D7D2C7] text-[#6F6C64]">
                      Donor Dock
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-sm text-[#22211E]">
                      {selectedDonation.donor?.org_name || 'Donor Establishment'}
                    </p>
                    <p className="text-xs text-[#6F6C64] mt-0.5">
                      {selectedDonation.donor?.address || selectedDonation.pickup_address}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-[#E3DDD1] text-[11px] text-[#6F6C64] space-y-1">
                    {selectedDonation.donor?.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone size={12} />
                        <span>{selectedDonation.donor.phone}</span>
                      </p>
                    )}
                    <p>
                      <strong>Pickup Time:</strong>{' '}
                      {selectedDonation.delivery?.actual_pickup_time
                        ? formatDate(selectedDonation.delivery.actual_pickup_time)
                        : selectedDonation.delivery?.pickup_eta
                        ? `ETA ${formatDate(selectedDonation.delivery.pickup_eta)}`
                        : 'Scheduled'}
                    </p>
                  </div>
                </div>

                {/* Drop-off Location */}
                <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-4.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#4D553C] uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 size={14} />
                      <span>Drop-off Destination</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FAF7F1] border border-[#D7D2C7] text-[#6F6C64]">
                      Shelter Bay
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-sm text-[#22211E]">
                      {selectedDonation.recipient?.org_name || 'Recipient Shelter'}
                    </p>
                    <p className="text-xs text-[#6F6C64] mt-0.5">
                      {selectedDonation.recipient?.address || 'Designated relief kitchen'}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-[#E3DDD1] text-[11px] text-[#6F6C64] space-y-1">
                    {selectedDonation.recipient?.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone size={12} />
                        <span>{selectedDonation.recipient.phone}</span>
                      </p>
                    )}
                    <p>
                      <strong>Delivery Time:</strong>{' '}
                      {selectedDonation.delivery?.actual_delivery_time
                        ? formatDate(selectedDonation.delivery.actual_delivery_time)
                        : selectedDonation.delivery?.dropoff_eta
                        ? `ETA ${formatDate(selectedDonation.delivery.dropoff_eta)}`
                        : 'En-route'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Courier Information */}
              <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#5F684B] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    <Truck size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#6F6C64]">Assigned Courier</p>
                    <p className="text-sm font-bold text-[#22211E]">
                      {selectedDonation.driver?.name || driver?.name || user?.name || 'Verified Courier'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs font-semibold text-[#6F6C64]">Chain of Custody Status</p>
                  <p className="text-xs font-bold text-[#4D553C] flex items-center gap-1">
                    <ShieldCheck size={14} />
                    <span>Verified Logistics Portal Transfer</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-[#D7D2C7] flex items-center justify-between">
              <span className="text-xs text-[#6F6C64]">
                Donation record logged in PostgreSQL database
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCloseDetails}
                  className="px-4 py-2 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white font-semibold text-xs transition cursor-pointer">
                  Close Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
