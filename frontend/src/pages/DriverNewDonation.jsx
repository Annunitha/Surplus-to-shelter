import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  Truck,
  Building2,
  MapPin,
  Utensils,
  Thermometer,
  FileText,
  Phone,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RotateCw,
  ShieldCheck,
  Package
} from 'lucide-react';
import { apiRequest, getUser } from '../api';
import Sidebar from '../components/common/Sidebar';
import TopNavbar from '../components/common/TopNavbar';

export default function DriverNewDonation() {
  const navigate = useNavigate();
  const user = getUser();

  const [driver, setDriver] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [form, setForm] = useState({
    donor_name: '',
    pickup_address: '',
    food_type: 'prepared_meals',
    estimated_weight_kg: '',
    temperature_condition: 'chilled',
    notes: ''
  });

  useEffect(() => {
    if (!user || user.role !== 'driver') {
      navigate('/login');
      return;
    }
    apiRequest('/api/drivers/me')
      .then(res => res?.driver && setDriver(res.driver))
      .catch(console.error);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessData(null);

    if (!form.donor_name.trim() || !form.pickup_address.trim()) {
      setErrorMsg('Please specify donor establishment and pickup address.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest('/api/drivers/me/intake', {
        method: 'POST',
        body: JSON.stringify({
          donor_name: form.donor_name,
          pickup_address: form.pickup_address,
          food_type: form.food_type,
          quantity: parseFloat(form.estimated_weight_kg) || 20,
          estimated_weight_kg: parseFloat(form.estimated_weight_kg) || 20,
          temperature_condition: form.temperature_condition,
          notes: form.notes
        })
      });

      setSuccessData(res);
      // Give visual feedback and navigate to My Donations
      setTimeout(() => {
        navigate('/driver/donations');
      }, 700);
    } catch (err) {
      console.error('Submit intake error:', err);
      setErrorMsg(err.message || 'Unable to submit donation intake. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F1] text-[#22211E] flex flex-col md:flex-row">
      {/* SIDEBAR */}
      <Sidebar
        role="driver"
        activeTab="new_donation"
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
          statusLabel="Courier Field Intake"
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6">
          {/* PAGE HEADER */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={() => navigate('/driver/donations')}
                  className="p-1.5 rounded-lg border border-[#D7D2C7] bg-[#F8F5EE] hover:bg-[#EAE4D8] text-[#22211E] transition cursor-pointer">
                  <ArrowLeft size={16} />
                </button>
                <h1 className="text-2xl sm:text-[30px] font-bold tracking-tight text-[#22211E]">
                  New Donation Intake
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E8EED2] text-[#4D553C] border border-[#D7D2C7]">
                  Field Dispatch Request
                </span>
              </div>
              <p className="text-xs sm:text-[13px] text-[#6F6C64] mt-1 leading-relaxed">
                Log an on-site surplus food intake or request dispatch authorization for ad-hoc rescues.
              </p>
            </div>

            <button
              onClick={() => alert('Dispatch Hotline: Connecting to Central Operations (+91 11 2345 6789)...')}
              className="px-4 py-2 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs shrink-0">
              <Phone size={14} />
              <span>Call Dispatch</span>
            </button>
          </div>

          {/* INFORMATIONAL CALLOUT / POLICY NOTE */}
          <div className="bg-[#F3EFE7] border border-[#D7D2C7] rounded-2xl p-5 flex items-start gap-4 shadow-2xs">
            <div className="w-10 h-10 rounded-xl bg-[#E8EED2] text-[#5F684B] flex items-center justify-center shrink-0">
              <ShieldCheck size={20} strokeWidth={2.4} />
            </div>
            <div className="text-xs space-y-1">
              <h3 className="font-bold text-[#22211E] text-sm">Standard Food Intake Protocol</h3>
              <p className="text-[#6F6C64] leading-relaxed">
                Standard surplus food donations are published and verified by registered food donor organizations (restaurants, catering halls, supermarkets). 
                If you encounter unannounced surplus while on your route, submit this intake form or contact Central Dispatch to register the lot and generate an authorized chain-of-custody transfer manifest.
              </p>
            </div>
          </div>

          {/* SUCCESS MESSAGE */}
          {successData && (
            <div className="bg-[#E8EED2] border border-[#D7D2C7] rounded-2xl p-5 text-xs text-[#4D553C] space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 size={18} />
                <span>Field Intake Logged Successfully!</span>
              </div>
              <p>
                Reference ID: <strong className="font-mono text-[#22211E]">{successData.referenceId}</strong>. Dispatch operations has been alerted and will review the manifest.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => navigate('/driver/donations')}
                  className="px-3.5 py-1.5 rounded-xl bg-[#5F684B] text-white font-semibold cursor-pointer">
                  Go to My Donations
                </button>
                <button
                  onClick={() => setSuccessData(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-[#D7D2C7] bg-[#FAF7F1] text-[#22211E] font-semibold cursor-pointer">
                  Submit Another Intake
                </button>
              </div>
            </div>
          )}

          {/* ERROR MESSAGE */}
          {errorMsg && (
            <div className="bg-[#FBEBEA] border border-[#F0D5D3] rounded-2xl p-4 text-xs text-[#B93830] flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* INTAKE FORM */}
          <form onSubmit={handleSubmit} className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-6 sm:p-8 shadow-xs space-y-5">
            <h2 className="text-base font-bold text-[#22211E] border-b border-[#D7D2C7] pb-3">
              Surplus Intake Details
            </h2>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Donor Name */}
              <div>
                <label className="block text-xs font-semibold text-[#22211E] mb-1.5">
                  Donor Organization / Establishment *
                </label>
                <div className="relative">
                  <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6F6C64]" />
                  <input
                    type="text"
                    required
                    value={form.donor_name}
                    onChange={e => setForm({ ...form, donor_name: e.target.value })}
                    placeholder="e.g. Grand Vista Catering, Plaza Hotel"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-[#FAF7F1] border border-[#D7D2C7] rounded-xl text-xs sm:text-sm text-[#22211E] placeholder-[#8A857A] focus:outline-hidden focus:border-[#5F684B]"
                  />
                </div>
              </div>

              {/* Pickup Address */}
              <div>
                <label className="block text-xs font-semibold text-[#22211E] mb-1.5">
                  Pickup Location / Address *
                </label>
                <div className="relative">
                  <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6F6C64]" />
                  <input
                    type="text"
                    required
                    value={form.pickup_address}
                    onChange={e => setForm({ ...form, pickup_address: e.target.value })}
                    placeholder="e.g. Connaught Place, Block C, Gate 2"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-[#FAF7F1] border border-[#D7D2C7] rounded-xl text-xs sm:text-sm text-[#22211E] placeholder-[#8A857A] focus:outline-hidden focus:border-[#5F684B]"
                  />
                </div>
              </div>

              {/* Food Category */}
              <div>
                <label className="block text-xs font-semibold text-[#22211E] mb-1.5">
                  Food Category *
                </label>
                <select
                  value={form.food_type}
                  onChange={e => setForm({ ...form, food_type: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#FAF7F1] border border-[#D7D2C7] rounded-xl text-xs sm:text-sm text-[#22211E] focus:outline-hidden focus:border-[#5F684B] cursor-pointer">
                  <option value="prepared_meals">Prepared Meals / Trays</option>
                  <option value="produce">Fresh Produce / Vegetables / Fruits</option>
                  <option value="bakery">Bakery & Bread</option>
                  <option value="dairy">Dairy & Refrigerated Items</option>
                  <option value="dry_goods">Dry Goods & Pantry Staple</option>
                  <option value="other">Other Perishable Food</option>
                </select>
              </div>

              {/* Estimated Weight */}
              <div>
                <label className="block text-xs font-semibold text-[#22211E] mb-1.5">
                  Estimated Weight (kg) / Quantity
                </label>
                <div className="relative">
                  <Package size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6F6C64]" />
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={form.estimated_weight_kg}
                    onChange={e => setForm({ ...form, estimated_weight_kg: e.target.value })}
                    placeholder="e.g. 20"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-[#FAF7F1] border border-[#D7D2C7] rounded-xl text-xs sm:text-sm text-[#22211E] placeholder-[#8A857A] focus:outline-hidden focus:border-[#5F684B]"
                  />
                </div>
              </div>

              {/* Temperature Condition */}
              <div>
                <label className="block text-xs font-semibold text-[#22211E] mb-1.5">
                  Current Temperature State
                </label>
                <select
                  value={form.temperature_condition}
                  onChange={e => setForm({ ...form, temperature_condition: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#FAF7F1] border border-[#D7D2C7] rounded-xl text-xs sm:text-sm text-[#22211E] focus:outline-hidden focus:border-[#5F684B] cursor-pointer">
                  <option value="hot">Hot Holding (≥ 60°C)</option>
                  <option value="chilled">Chilled / Refrigerated (≤ 4°C)</option>
                  <option value="ambient">Ambient Room Temperature</option>
                </select>
              </div>

              {/* Courier Identity */}
              <div>
                <label className="block text-xs font-semibold text-[#22211E] mb-1.5">
                  Submitting Courier
                </label>
                <input
                  type="text"
                  disabled
                  value={driver?.name ? `${driver.name} (Verified)` : user?.name || 'Active Courier'}
                  className="w-full px-3.5 py-2.5 bg-[#EAE4D8]/50 border border-[#D7D2C7] rounded-xl text-xs sm:text-sm text-[#6F6C64]"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-[#22211E] mb-1.5">
                Special Handling / On-Site Dispatch Notes
              </label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Mention packaging type, dock contact person, urgency, or recipient preference..."
                className="w-full px-3.5 py-2.5 bg-[#FAF7F1] border border-[#D7D2C7] rounded-xl text-xs sm:text-sm text-[#22211E] placeholder-[#8A857A] focus:outline-hidden focus:border-[#5F684B]"
              />
            </div>

            {/* Submit button */}
            <div className="flex items-center justify-between pt-3 border-t border-[#D7D2C7]">
              <button
                type="button"
                onClick={() => navigate('/driver/donations')}
                className="px-4 py-2.5 rounded-xl border border-[#D7D2C7] bg-[#FAF7F1] hover:bg-[#EAE4D8] text-[#22211E] font-semibold text-xs transition cursor-pointer">
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-xs disabled:opacity-50">
                {submitting ? (
                  <>
                    <RotateCw size={14} className="animate-spin" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <PlusCircle size={15} />
                    <span>Submit Intake Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
