import { useState } from 'react';
import { MapPin, Calendar, Clock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiRequest } from '../api';

export default function DonationForm({ onSuccess, onCancel }) {
  // Helper to split datetime into date and time
  function getDefaultExpiryDate() {
    const d = new Date(Date.now() + 4 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  }

  

  const [date, setDate] = useState(getDefaultExpiryDate());
 

  const [form, setForm] = useState({
    food_description: '',
    food_type: 'prepared_meals',
    quantity: '',
    unit: 'kg',
    pickup_address: 'Connaught Place Inner Circle, New Delhi'
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);

  const foodTypes = [
    { value: 'prepared_meals', label: 'Prepared Meals' },
    { value: 'preplanned_meals', label: 'Pre-planned Meals' },
    { value: 'produce', label: 'Fresh Produce' },
    { value: 'bakery', label: 'Bakery & Pastries' },
    { value: 'dairy', label: 'Dairy & Refrigerated' },
    { value: 'dry_goods', label: 'Dry Goods & Pantry' },
    { value: 'other', label: 'Other Items' }
  ];

  const units = [
    { value: 'kg', label: 'Kilograms (kg)' },
    { value: 'lbs', label: 'Pounds (lbs)' },
    { value: 'servings', label: 'Servings / Trays' },
    { value: 'units', label: 'Units' },
    { value: 'packets', label: 'packets' },
  ];

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(null);
    setLoading(true);

    try {
      const combinedDateTime = new Date(`${date}`);
      if (isNaN(combinedDateTime.getTime()) || combinedDateTime.getTime() <= Date.now()) {
        throw new Error('Expiry window must be set to a future date.');
      }

      const data = await apiRequest('/api/donations', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          quantity: parseFloat(form.quantity),
          expiry_window_end: combinedDateTime.toISOString()
        })
      });

      setSuccess('Surplus donation posted successfully! It is now being dispatched to nearby partner shelters.');
      setForm({
        food_description: '',
        food_type: 'prepared_meals',
        quantity: '',
        unit: 'kg',
        pickup_address: form.pickup_address
      });

      if (onSuccess) {
        setTimeout(() => onSuccess(data.donation), 900);
      }
    } catch (err) {
      setError(err.message || 'Failed to post donation');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card-warm rounded-2xl p-6 sm:p-8 shadow-xs max-w-2xl mx-auto">
      {/* Title & Subtitle matching Image 3 */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-[#22211E]">
          Post a Surplus Donation
        </h2>
        <p className="text-xs sm:text-sm text-[#6F6C64] mt-1.5 leading-relaxed">
          Enter the details of excess prepared food or ingredients available for pickup by local shelters and volunteers.
        </p>
      </div>

      {error && (
        <div className="mb-5 p-3.5 rounded-xl bg-[#F2EAE5] border border-[#E3D3CB] text-[#A05245] text-xs flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-5 p-3.5 rounded-xl bg-[#E8EED2] border border-[#D7D2C7] text-[#4D553C] text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0 text-[#5F684B]" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Food Description */}
        <div>
          <label className="block text-xs font-semibold text-[#22211E] mb-1.5">
            Food description
          </label>
          <input
            type="text"
            name="food_description"
            required
            value={form.food_description}
            onChange={handleChange}
            placeholder="e.g., 20 trays of baked ziti, fresh salad boxes"
            className="w-full px-3.5 py-2.5 rounded-xl input-warm text-sm"
          />
        </div>

        {/* Food Type + Quantity & Unit Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#22211E] mb-1.5">
              Food type
            </label>
            <select
              name="food_type"
              value={form.food_type}
              onChange={handleChange}
              className="w-full px-3.5 py-2.5 rounded-xl input-warm text-sm cursor-pointer">
              {foodTypes.map(t => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#22211E] mb-1.5">
              Quantity & unit
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                name="quantity"
                required
                min="0.1"
                step="0.1"
                value={form.quantity}
                onChange={handleChange}
                placeholder="10"
                className="w-28 px-3.5 py-2.5 rounded-xl input-warm text-sm"
              />
              <select
                name="unit"
                value={form.unit}
                onChange={handleChange}
                className="flex-1 px-3 py-2.5 rounded-xl input-warm text-sm cursor-pointer">
                {units.map(u => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Pickup Address */}
        <div>
          <label className="block text-xs font-semibold text-[#22211E] mb-1.5">
            Pickup address
          </label>
          <div className="relative">
            <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#99958B]" />
            <input
              type="text"
              name="pickup_address"
              required
              value={form.pickup_address}
              onChange={handleChange}
              placeholder="e.g., 452 Market St, Kitchen Loading Dock B"
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl input-warm text-sm"
            />
          </div>
        </div>

        {/* Expiry Window End (Date and Time pickers side by side matching Image 3) */}
        <div>
          <label className="block text-xs font-semibold text-[#22211E] mb-1.5">
            Food Expiry Date
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#99958B]" />
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl input-warm text-sm"
              />
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl border border-[#D7D2C7] bg-[#FDFBF7] text-[#6F6C64] hover:bg-[#F3EFE7] text-sm font-semibold transition cursor-pointer">
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-sm font-semibold transition-all duration-200 shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50">
            <span>{loading ? 'Posting...' : 'Post Donation'}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </div>
  );
}
