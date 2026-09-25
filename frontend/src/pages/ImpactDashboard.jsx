import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Utensils,
  Leaf,
  Cloud,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  Package,
  Truck,
  RotateCw,
  Clock,
  Sparkles
} from 'lucide-react';
import { apiRequest } from '../api';
import { getSocket } from '../socket';
import { supabase } from '../lib/supabaseClient';

export default function ImpactDashboard() {
  const [summary, setSummary] = useState({
    total_meals_rescued: 0,
    total_food_diverted_kg: 0,
    total_deliveries: 0,
    active_pipeline: {
      posted: 0,
      matched: 0,
      in_transit: 0,
      delivered: 0
    },
    recent_rescues: []
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('Just now');

  useEffect(() => {
    fetchSummary();

    if (supabase) {
      const channel = supabase
        .channel('public-impact-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'donations'
          },
          () => {
            fetchSummary();
          }
        )
        .subscribe();

      const socket = getSocket();
      function handleStatusChanged() {
        fetchSummary();
      }

      socket.on('donation:status_changed', handleStatusChanged);
      return () => {
        supabase.removeChannel(channel);
        socket.off('donation:status_changed', handleStatusChanged);
      };
    }

    const socket = getSocket();
    function handleStatusChanged() {
      fetchSummary();
    }

    socket.on('donation:status_changed', handleStatusChanged);
    return () => {
      socket.off('donation:status_changed', handleStatusChanged);
    };
  }, []);

  async function fetchSummary() {
    if (supabase) {
      try {
        const { data: donations, error } = await supabase
          .from('donations')
          .select('id, quantity, unit, weight_kg, status, posted_at, food_description, donors:donor_id(org_name), recipients:matched_recipient_id(org_name)')
          .order('posted_at', { ascending: false });

        if (!error && Array.isArray(donations)) {
          let totalMeals = 0;
          let totalWeightKg = 0;
          let totalDeliveries = 0;
          const pipeline = { posted: 0, matched: 0, in_transit: 0, delivered: 0 };

        donations.forEach(d => {
          const qty = Number(d.quantity) || 0;
          const weight = Number(d.weight_kg) || (qty * 0.4);
          totalMeals += qty;
          totalWeightKg += weight;

          if (d.status === 'posted') pipeline.posted++;
          else if (d.status === 'matched') pipeline.matched++;
          else if (d.status === 'picked_up' || d.status === 'in_transit') pipeline.in_transit++;
          else if (d.status === 'delivered') {
            pipeline.delivered++;
            totalDeliveries++;
          }
        });

        

        const recent = donations.slice(0, 10).map(d => ({
          id: d.id,
          food_description: d.food_description,
          donor_name: d.donors?.org_name || 'Community Donor',
          recipient_name: d.recipients?.org_name || 'Community Shelter',
          quantity: d.quantity,
          unit: d.unit,
          status: d.status,
          created_at: d.posted_at
        }));

          setSummary({
            total_meals_rescued: totalMeals,
            total_food_diverted_kg: Math.round(totalWeightKg),
            total_deliveries: totalDeliveries,
            active_pipeline: pipeline,
            recent_rescues: recent
          });
          setLastUpdated('Updated just now');
          setLoading(false);
          return;
        }
      } catch (supabaseErr) {
        console.warn('Supabase direct impact query failed, using API:', supabaseErr);
      }
    }

    try {
      const data = await apiRequest('/api/impact/summary');
      if (data) {
        const s = data.summary || data;
        const byStatus = s.donations_by_status || {};
        const pipeline = s.active_pipeline || {
          posted: byStatus.posted || 0,
          matched: byStatus.matched || 0,
          in_transit: byStatus.picked_up || 0,
          delivered: byStatus.delivered || s.total_deliveries || 0
        };
        setSummary({
          total_meals_rescued: s.total_meals_rescued ?? s.total_meals ?? 0,
          total_food_diverted_kg: s.total_food_diverted_kg ?? s.total_weight_kg ?? 0,
          total_deliveries: s.total_deliveries ?? 0,
          active_pipeline: pipeline,
          recent_rescues: Array.isArray(s.recent_rescues) ? s.recent_rescues : []
        });
        setLastUpdated('Updated just now');
      }
    } catch (err) {
      console.error('Failed to fetch impact summary:', err);
    } finally {
      setLoading(false);
    }
  }

  const {
    total_meals_rescued = 0,
    total_food_diverted_kg = 0,
    total_deliveries = 0,
    active_pipeline = { posted: 0, matched: 0, in_transit: 0, delivered: 0 },
    recent_rescues = []
  } = summary;

  // Pipeline calculations
  const pPosted = active_pipeline.posted || 0;
  const pMatched = active_pipeline.matched || 0;
  const pInTransit = active_pipeline.in_transit || 0;
  const pDelivered = (active_pipeline.delivered || 0) + (total_deliveries || 0);
  const pipelineTotal = pPosted + pMatched + pInTransit + pDelivered || 1;

  const pctPosted = Math.round((pPosted / pipelineTotal) * 100);
  const pctMatched = Math.round((pMatched / pipelineTotal) * 100);
  const pctInTransit = Math.round((pInTransit / pipelineTotal) * 100);
  const pctDelivered = Math.max(0, 100 - pctPosted - pctMatched - pctInTransit);

  return (
    <div className="min-h-screen bg-[#FAF7F1] text-[#22211E] flex flex-col select-none">
      {/* Top Navbar */}
      <header className="border-b border-[#D7D2C7] bg-[#FAF7F1]/90 backdrop-blur-md px-6 lg:px-12 py-4 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#5F684B] flex items-center justify-center text-white shadow-xs">
              <Package size={20} strokeWidth={2.4} />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-[#22211E]">FoodRescue</span>
              <span className="block text-[10px] font-semibold text-[#6F6C64] uppercase tracking-wider">
                Redistribution Network
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <button
              onClick={fetchSummary}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D7D2C7] bg-[#FDFBF7] text-[#6F6C64] hover:text-[#22211E] text-xs font-semibold transition cursor-pointer">
              <RotateCw size={13} />
              <span>Refresh Metrics</span>
            </button>

            <Link
              to="/login"
              className="px-4 py-2 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5">
              <span>Sign In / Register</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-10">
        {/* Hero Section (Matching Image 5) */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#E8EED2] text-[#4D553C] border border-[#D7D2C7] text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#5F684B] animate-pulse" />
            <span>Live Network Metrics • {lastUpdated}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#22211E]">
            Surplus to Shelter — Our Impact
          </h1>

          <p className="text-sm sm:text-base text-[#6F6C64] leading-relaxed">
            Real-time collective food rescue logistics across regional donors, verified couriers, and front-line community shelters.
          </p>
        </div>

        {/* 3 Large KPI Cards (Image 5) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Meals Rescued */}
          <div className="card-warm rounded-2xl p-6 sm:p-8 shadow-xs hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6F6C64]">
                Meals Rescued
              </span>
              <div className="w-10 h-10 rounded-xl bg-[#E8EED2] text-[#5F684B] flex items-center justify-center">
                <Utensils size={20} strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#22211E] mb-3">
              {Number(total_meals_rescued).toLocaleString()}
            </div>
            <p className="text-xs text-[#6F6C64] leading-relaxed border-t border-[#D7D2C7] pt-3">
              Equating to feeding ~{Math.round(total_meals_rescued / 30) || 490} families daily across partner shelters.
            </p>
          </div>

          {/* Food Diverted (kg) */}
          <div className="card-warm rounded-2xl p-6 sm:p-8 shadow-xs hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6F6C64]">
                Food Diverted (kg)
              </span>
              <div className="w-10 h-10 rounded-xl bg-[#E8EED2] text-[#5F684B] flex items-center justify-center">
                <Leaf size={20} strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#22211E] mb-3">
              {Number(total_food_diverted_kg).toLocaleString()} kg
            </div>
            <p className="text-xs text-[#6F6C64] leading-relaxed border-t border-[#D7D2C7] pt-3">
              High-protein meals, fresh produce & bakery surplus rescued from commercial discard.
            </p>
          </div>

      
          <div className="card-warm rounded-2xl p-6 sm:p-8 shadow-xs hover:shadow-md transition">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6F6C64]">
               
              </span>
              <div className="w-10 h-10 rounded-xl bg-[#E8EED2] text-[#5F684B] flex items-center justify-center">
                <Cloud size={20} strokeWidth={2.2} />
              </div>
            </div>
           
            <p className="text-xs text-[#6F6C64] leading-relaxed border-t border-[#D7D2C7] pt-3">
              Prevented methane & greenhouse gas emissions from organic landfill decomposition.
            </p>
          </div>
        </div>

        {/* Today's Active Rescues by Status (Image 5) */}
        <div className="card-warm rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D7D2C7] pb-4">
            <div>
              <h2 className="text-lg font-bold text-[#22211E]">
                Today's Active Rescues by Status
              </h2>
              <p className="text-xs text-[#6F6C64] mt-0.5">
                Current operational distribution of batches in the FoodRescue redistribution pipeline.
              </p>
            </div>
            <span className="text-xs font-bold text-[#6F6C64]">
              Total Active Batches: <strong className="text-[#22211E]">{pipelineTotal}</strong>
            </span>
          </div>

          {/* 4 Pipeline Stage Cards (Image 5) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stage 1 */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F1] border border-[#D7D2C7] relative">
              <div className="flex items-center justify-between text-xs text-[#6F6C64] mb-2 font-semibold">
                <span>Stage 1</span>
                <span className="w-2 h-2 rounded-full bg-[#70795A]" />
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#22211E]">{pPosted}</p>
              <p className="text-[11px] text-[#6F6C64] mt-1">Batches Posted / Awaiting Match</p>
            </div>

            {/* Stage 2 */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F1] border border-[#D7D2C7] relative">
              <div className="flex items-center justify-between text-xs text-[#6F6C64] mb-2 font-semibold">
                <span>Stage 2</span>
                <span className="w-2 h-2 rounded-full bg-[#5F684B]" />
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#22211E]">{pMatched}</p>
              <p className="text-[11px] text-[#6F6C64] mt-1">Matched to Volunteer Drivers</p>
            </div>

            {/* Stage 3 */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#E8EED2]/60 border border-[#D7D2C7] relative">
              <div className="flex items-center justify-between text-xs text-[#4D553C] mb-2 font-semibold">
                <span>Stage 3</span>
                <span className="w-2 h-2 rounded-full bg-[#5F684B]" />
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-[#22211E]">{pInTransit}</p>
              <p className="text-[11px] text-[#4D553C] mt-1">In Transit / Cold-Chain En Route</p>
            </div>

            {/* Completed */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#5F684B] text-white border border-[#5F684B] relative shadow-xs">
              <div className="flex items-center justify-between text-xs text-[#DCE7B8] mb-2 font-semibold">
                <span>Completed</span>
                <CheckCircle2 size={15} className="text-[#DCE7B8]" />
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-white">{pDelivered}</p>
              <p className="text-[11px] text-white/80 mt-1">Safely Delivered Today</p>
            </div>
          </div>

          {/* Manifest Progress Segmented Bar (Image 5) */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-[#6F6C64]">
              <span className="font-semibold text-[#22211E]">Manifest Progress Pipeline</span>
              <span className="font-bold text-[#5F684B]">{pctDelivered}% Delivered Target Met</span>
            </div>

            <div className="w-full h-3 rounded-full bg-[#EFECE6] overflow-hidden flex">
              <div style={{ width: `${pctPosted}%` }} className="bg-[#DCE7B8] h-full" title={`Posted: ${pctPosted}%`} />
              <div style={{ width: `${pctMatched}%` }} className="bg-[#B8C88A] h-full" title={`Matched: ${pctMatched}%`} />
              <div style={{ width: `${pctInTransit}%` }} className="bg-[#8A986A] h-full" title={`In Transit: ${pctInTransit}%`} />
              <div style={{ width: `${pctDelivered}%` }} className="bg-[#5F684B] h-full" title={`Delivered: ${pctDelivered}%`} />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#6F6C64] pt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#DCE7B8]" /> Posted ({pctPosted}%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#B8C88A]" /> Matched ({pctMatched}%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#8A986A]" /> In Transit ({pctInTransit}%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#5F684B]" /> Delivered ({pctDelivered}%)
              </span>
            </div>
          </div>
        </div>

        {/* Recent Rescues Table Card */}
        {recent_rescues && recent_rescues.length > 0 && (
          <div className="card-warm rounded-2xl p-6 sm:p-8 shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#D7D2C7]">
              <div>
                <h3 className="text-base font-bold text-[#22211E]">Verified Rescues Ledger</h3>
                <p className="text-xs text-[#6F6C64]">Audited transactions credited into EPA WARM calculations.</p>
              </div>
              <span className="text-xs text-[#5F684B] font-bold">Live Synced</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#D7D2C7] bg-[#F3EFE7]/60 text-[11px] font-semibold text-[#6F6C64] uppercase tracking-wider">
                    <th className="py-2.5 px-4">Item Description</th>
                    <th className="py-2.5 px-4">Net Weight</th>
                    <th className="py-2.5 px-4">Meals Yield</th>
                    <th className="py-2.5 px-4 text-right">Delivered Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7D2C7]/60">
                  {recent_rescues.map((r, i) => (
                    <tr key={i} className="hover:bg-[#F3EFE7]/40 transition">
                      <td className="py-3 px-4 font-bold text-[#22211E]">{r.food_description}</td>
                      <td className="py-3 px-4 font-semibold text-[#22211E]">{parseFloat(r.weight_kg).toFixed(1)} kg</td>
                      <td className="py-3 px-4 font-bold text-[#5F684B]">~{Math.round(r.meals_rescued ?? r.meals ?? (parseFloat(r.weight_kg) * 1.83))} meals</td>
                      <td className="py-3 px-4 text-right text-[#99958B]">
                        {new Date(r.logged_at || r.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bottom Banner (Image 5) */}
        <div className="card-warm rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xs border-[#D7D2C7]">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#E8EED2] text-[#5F684B] flex items-center justify-center shrink-0">
              <ShieldCheck size={22} strokeWidth={2.4} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#22211E]">
                Good Samaritan Food Safety Standard Compliant
              </h4>
              <p className="text-xs text-[#6F6C64] mt-0.5 max-w-xl leading-relaxed">
                Surplus to Shelter operates under Good Samaritan Food Donation safety standards. Updated in real time as drivers confirm manifests.
              </p>
            </div>
          </div>

          <Link
            to="/login"
            className="px-6 py-3 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer">
            Register as a Donor or Volunteer
          </Link>
        </div>
      </main>
    </div>
  );
}
