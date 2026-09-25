import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Package,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Store,
  Home,
  Truck,
  ArrowRight,
  TrendingUp,
  MapPin,
  Phone,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { apiRequest, setUser, clearUser } from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [userSelectedRole, setUserSelectedRole] = useState(false);

  useEffect(() => {
    clearUser();
  }, []);

  const [form, setForm] = useState({
    email: '',
    password: '',
    role: 'donor',
    org_name: '',
    name: '',
    address_text: '',
    lat: '',
    lng: '',
    contact_phone: '',
    accepted_food_types: ['prepared_meals', 'bakery', 'produce'],
    capacity_max: '100'
  });

  const foodTypes = [
    { value: 'prepared_meals', label: 'Prepared Meals' },
    { value: 'produce', label: 'Produce' },
    { value: 'bakery', label: 'Bakery' },
    { value: 'dairy', label: 'Dairy' },
    { value: 'dry_goods', label: 'Dry Goods' },
    { value: 'other', label: 'Other' }
  ];

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  function toggleFoodType(type) {
    setForm(f => ({
      ...f,
      accepted_food_types: f.accepted_food_types.includes(type)
        ? f.accepted_food_types.filter(t => t !== type)
        : [...f.accepted_food_types, type]
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister
        ? {
            email: form.email.trim(),
            password: form.password,
            role: form.role,
            ...(form.role === 'donor' && {
              org_name: form.org_name.trim(),
              address_text: form.address_text.trim(),
              lat: parseFloat(form.lat),
              lng: parseFloat(form.lng)
            }),
            ...(form.role === 'recipient' && {
              org_name: form.org_name.trim(),
              address_text: form.address_text.trim(),
              lat: parseFloat(form.lat),
              lng: parseFloat(form.lng),
              accepted_food_types: form.accepted_food_types,
              capacity_max: parseInt(form.capacity_max, 10)
            }),
            ...(form.role === 'driver' && {
              name: (form.name || form.org_name).trim(),
              contact_phone: form.contact_phone.trim(),
              lat: parseFloat(form.lat),
              lng: parseFloat(form.lng)
            })
          }
        : {
            email: form.email.trim(),
            password: form.password,
            ...(userSelectedRole ? { role: form.role } : {})
          };

      const data = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
      });

      setUser(data);

      // Route strictly based on verified backend role (NO role should fall back to donor!)
      if (data.role === 'donor') {
        navigate('/donor');
      } else if (data.role === 'recipient') {
        navigate('/recipient');
      } else if (data.role === 'driver') {
        navigate('/driver');
      } else {
        navigate('/login');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F1] text-[#22211E] flex flex-col relative overflow-hidden select-none">
      {/* Decorative background dashed concentric rings (from reference Image 1) */}
      <div className="absolute top-1/2 left-[-120px] -translate-y-1/2 w-[480px] h-[480px] rounded-full border border-dashed border-[#D7D2C7]/60 pointer-events-none hidden lg:block" />
      <div className="absolute top-1/2 left-[-60px] -translate-y-1/2 w-[360px] h-[360px] rounded-full border border-dashed border-[#D7D2C7]/40 pointer-events-none hidden lg:block" />
      <div className="absolute bottom-[-80px] right-[-60px] w-[500px] h-[500px] rounded-full border border-dashed border-[#D7D2C7]/50 pointer-events-none hidden lg:block" />
      <div className="absolute bottom-[20px] right-[40px] w-[340px] h-[340px] rounded-full border border-dashed border-[#D7D2C7]/40 pointer-events-none hidden lg:block" />

      {/* Top Navbar */}
      <header className="w-full px-6 lg:px-12 py-5 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#5F684B] flex items-center justify-center text-white shadow-xs">
            <Package size={18} strokeWidth={2.4} />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-[#22211E]">FoodRescue</span>
            <span className="block text-[10px] font-semibold text-[#6F6C64] uppercase tracking-wider">
              Redistribution Network
            </span>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <Link
            to="/impact"
            className="flex items-center gap-1.5 text-xs font-semibold text-[#5F684B] hover:text-[#4D553C] transition">
            <TrendingUp size={15} />
            <span>Impact Dashboard</span>
          </Link>
          <div className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-[#6F6C64] pl-4 border-l border-[#D7D2C7]">
            <span className="w-2 h-2 rounded-full bg-[#5F684B]" />
            <span>Network Active</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 z-10">
        <div className="w-full max-w-[460px]">
          {/* Main Card */}
          <div className="card-warm rounded-2xl p-7 sm:p-9 shadow-xs">
            {/* Header Icon + Titles */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#E8EED2] text-[#5F684B] mb-3 shadow-2xs">
                <Package size={22} strokeWidth={2.4} />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-[#22211E]">FoodRescue</h2>
              <p className="text-xs text-[#6F6C64] mt-1">
                Logistics Portal — {isRegister ? 'Create your partner account' : 'Sign in to your account'}
              </p>
            </div>

            {/* Segmented Tab: Sign In | New Registration */}
            <div className="bg-[#EFECE6] p-1 rounded-2xl flex gap-1 mb-6 border border-[#E3DDD1]">
              <button
                type="button"
                onClick={() => { setIsRegister(false); setError(''); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  !isRegister
                    ? 'bg-white text-[#22211E] shadow-xs'
                    : 'text-[#6F6C64] hover:text-[#22211E]'
                }`}>
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsRegister(true); setError(''); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  isRegister
                    ? 'bg-white text-[#22211E] shadow-xs'
                    : 'text-[#6F6C64] hover:text-[#22211E]'
                }`}>
                New Registration
              </button>
            </div>

            {/* Role Selector (always visible to guide user and set registration profile) */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold text-[#6F6C64] uppercase tracking-wider">
                  Redistribution Role
                </label>
                <span className="text-[11px] text-[#99958B]">
                  {form.role === 'donor' ? 'Surplus Supplier' : form.role === 'recipient' ? 'Shelter & Kitchen' : 'Volunteer Courier'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => { setUserSelectedRole(true); setForm(f => ({ ...f, role: 'donor' })); }}
                  className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    form.role === 'donor'
                      ? 'bg-[#5F684B] text-white border-[#5F684B] shadow-xs'
                      : 'bg-[#FDFBF7] text-[#6F6C64] border-[#D7D2C7] hover:bg-[#F3EFE7]'
                  }`}>
                  <Store size={18} className="mb-1" />
                  <span>Donor</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setUserSelectedRole(true); setForm(f => ({ ...f, role: 'recipient' })); }}
                  className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    form.role === 'recipient'
                      ? 'bg-[#5F684B] text-white border-[#5F684B] shadow-xs'
                      : 'bg-[#FDFBF7] text-[#6F6C64] border-[#D7D2C7] hover:bg-[#F3EFE7]'
                  }`}>
                  <Home size={18} className="mb-1" />
                  <span>Recipient</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setUserSelectedRole(true); setForm(f => ({ ...f, role: 'driver' })); }}
                  className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                    form.role === 'driver'
                      ? 'bg-[#5F684B] text-white border-[#5F684B] shadow-xs'
                      : 'bg-[#FDFBF7] text-[#6F6C64] border-[#D7D2C7] hover:bg-[#F3EFE7]'
                  }`}>
                  <Truck size={18} className="mb-1" />
                  <span>Driver</span>
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-5 p-3 rounded-xl bg-[#F2EAE5] border border-[#E3D3CB] text-[#A05245] text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Dynamic Registration Fields */}
              {isRegister && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[#22211E] mb-1">
                      {form.role === 'donor' ? 'Organization / Restaurant Name' : form.role === 'recipient' ? 'Shelter / Foundation Name' : 'Full Name'}
                    </label>
                    <input
                      type="text"
                      name={form.role === 'driver' ? 'name' : 'org_name'}
                      required
                      value={form.role === 'driver' ? form.name : form.org_name}
                      onChange={handleChange}
                      placeholder={form.role === 'donor' ? 'e.g. The Connaught Grand Bistro' : form.role === 'recipient' ? 'e.g. Karol Bagh Relief Shelter' : 'e.g. Amit Kumar'}
                      className="w-full px-3.5 py-2.5 rounded-xl input-warm text-sm"
                    />
                  </div>

                  {form.role === 'driver' ? (
                    <div>
                      <label className="block text-xs font-semibold text-[#22211E] mb-1">Contact Phone</label>
                      <div className="relative">
                        <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#99958B]" />
                        <input
                          type="tel"
                          name="contact_phone"
                          required
                          value={form.contact_phone}
                          onChange={handleChange}
                          placeholder="+91 98765 43210"
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl input-warm text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-[#22211E] mb-1">Physical Address</label>
                        <div className="relative">
                          <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#99958B]" />
                          <input
                            type="text"
                            name="address_text"
                            required
                            value={form.address_text}
                            onChange={handleChange}
                            placeholder="Street, City, Sector"
                            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl input-warm text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-[#22211E] mb-1">Latitude</label>
                          <input
                            type="number"
                            name="lat"
                            required
                            step="any"
                            min="-90"
                            max="90"
                            value={form.lat}
                            onChange={handleChange}
                            placeholder="28.6315"
                            className="w-full px-3.5 py-2.5 rounded-xl input-warm text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#22211E] mb-1">Longitude</label>
                          <input
                            type="number"
                            name="lng"
                            required
                            step="any"
                            min="-180"
                            max="180"
                            value={form.lng}
                            onChange={handleChange}
                            placeholder="77.2167"
                            className="w-full px-3.5 py-2.5 rounded-xl input-warm text-sm"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {form.role === 'recipient' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-[#22211E] mb-1">Max Cold Storage Capacity (kg)</label>
                        <input
                          type="number"
                          name="capacity_max"
                          required
                          value={form.capacity_max}
                          onChange={handleChange}
                          placeholder="100"
                          className="w-full px-3.5 py-2.5 rounded-xl input-warm text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#22211E] mb-1.5">Accepted Food Categories</label>
                        <div className="flex flex-wrap gap-1.5">
                          {foodTypes.map(ft => {
                            const isSelected = form.accepted_food_types.includes(ft.value);
                            return (
                              <button
                                key={ft.value}
                                type="button"
                                onClick={() => toggleFoodType(ft.value)}
                                className={`text-[11px] px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                                  isSelected
                                    ? 'bg-[#5F684B] text-white border-[#5F684B]'
                                    : 'bg-[#FDFBF7] text-[#6F6C64] border-[#D7D2C7] hover:bg-[#F3EFE7]'
                                }`}>
                                {ft.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-[#22211E] mb-1">Email address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#99958B]" />
                  <input
                    type="email"
                    name="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    placeholder="e.g., alex@mercado-deli.com"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl input-warm text-sm"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[#22211E]">Password</label>
                  {!isRegister && (
                    <button
                      type="button"
                      onClick={() => alert('For hackathon demonstration, password reset is instant via support.')}
                      className="text-[11px] text-[#6F6C64] hover:text-[#22211E] transition">
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#99958B]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    required
                    value={form.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl input-warm text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#99958B] hover:text-[#22211E] transition">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white font-semibold text-sm transition-all duration-200 shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer mt-4">
                <span>{loading ? 'Authenticating...' : isRegister ? 'Create Partner Account' : 'Log In'}</span>
                <ArrowRight size={16} />
              </button>
            </form>

            {/* Bottom helper */}
            <div className="mt-6 pt-5 border-t border-[#E3DDD1] text-center text-xs text-[#6F6C64]">
              {isRegister ? (
                <p>
                  Already registered?{' '}
                  <button
                    onClick={() => { setIsRegister(false); setError(''); }}
                    className="font-bold text-[#5F684B] hover:underline cursor-pointer">
                    Sign in to your account
                  </button>
                </p>
              ) : (
                <p>
                  New to FoodRescue?{' '}
                  <button
                    onClick={() => { setIsRegister(true); setError(''); }}
                    className="font-bold text-[#5F684B] hover:underline cursor-pointer">
                    Create an account
                  </button>
                </p>
              )}
            </div>
          </div>

          {/* Verification subtext */}
          <div className="flex items-center justify-center gap-4 mt-6 text-[11px] text-[#99958B]">
            <span className="flex items-center gap-1">
              <CheckCircle2 size={13} className="text-[#5F684B]" /> Active Partner Verified
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 size={13} className="text-[#5F684B]" /> Good Samaritan Compliant
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
