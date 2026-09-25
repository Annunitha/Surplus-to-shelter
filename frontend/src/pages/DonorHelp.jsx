import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HelpCircle,
  Phone,
  Mail,
  MessageSquare,
  ShieldCheck,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Thermometer,
  ChevronDown,
  ChevronUp,
  FileText,
  Send,
  ArrowRight,
  Package
} from 'lucide-react';
import Sidebar from '../components/common/Sidebar';
import TopNavbar from '../components/common/TopNavbar';

export default function DonorHelp() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [ticketSubject, setTicketSubject] = useState('Courier Delayed / Dispatch Follow-up');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const faqs = [
    {
      q: 'What is the Good Samaritan Safe Harbor Protection for donors?',
      a: 'Under the Food Safety and Standards (Recovery & Distribution of Surplus Food) Regulations and Good Samaritan protection laws, food donors who donate unexpired, wholesome food in good faith to verified food rescue organizations or shelters are fully protected from civil and criminal liability.'
    },
    {
      q: 'What are the required temperature standards before courier pickup?',
      a: 'Prepared hot food must remain hot (> 60°C) until courier packaging, and chilled/perishable items must be kept continuously refrigerated (< 5°C). Food items must be labeled with batch preparation time and anticipated safe consumption window.'
    },
    {
      q: 'How does the courier verification handshake work?',
      a: 'When an authorized volunteer courier arrives at your loading dock or entrance, ask them to show their Active Assignment screen on the FoodRescue Driver Portal. Confirm that the batch ID matches before handing over the surplus packages.'
    },
    {
      q: 'What happens if a recipient shelter declines or reaches full capacity?',
      a: 'The FoodRescue matching engine automatically runs an instantaneous cascade algorithm, redirecting the surplus food offer to the next closest verified shelter within a 5 km radius in under 15 minutes without interrupting your day.'
    }
  ];

  function handleSubmitTicket(e) {
    e.preventDefault();
    if (!ticketMessage.trim()) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      setTicketMessage('');
    }, 600);
  }

  return (
    <div className="min-h-screen bg-[#FAF7F1] text-[#22211E] flex flex-col md:flex-row select-none">
      <Sidebar
        role="donor"
        activeTab="help"
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
                  <HelpCircle size={13} className="text-[#5F684B]" />
                  24/7 Operations Desk
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#22211E]">
                Donor Help & Safe Harbor Support
              </h1>
              <p className="text-xs sm:text-sm text-[#6F6C64] mt-1">
                Immediate dispatch support, courier coordination hotline, and certified donation guidelines.
              </p>
            </div>

            <button
              onClick={() => navigate('/donor/donations/new')}
              className="px-4 py-2.5 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-semibold transition shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer">
              <Package size={15} />
              <span>Post New Donation</span>
            </button>
          </div>

          {/* Quick Contact Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card-warm rounded-2xl p-5 shadow-xs flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#E8EED2] text-[#5F684B] flex items-center justify-center shrink-0">
                <Phone size={20} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#6F6C64] uppercase tracking-wider block">
                  Emergency Dispatch Hotline
                </span>
                <a href="tel:+9118002663366" className="text-sm font-bold text-[#22211E] hover:underline block mt-0.5">
                  1800-RESCUE-DONOR
                </a>
                <span className="text-[11px] text-[#5F684B] font-medium block mt-1">
                  Average response: &lt; 2 mins
                </span>
              </div>
            </div>

            <div className="card-warm rounded-2xl p-5 shadow-xs flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#E8EED2] text-[#5F684B] flex items-center justify-center shrink-0">
                <Mail size={20} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#6F6C64] uppercase tracking-wider block">
                  Support & Safe Harbor Desk
                </span>
                <a href="mailto:support@foodrescue.org" className="text-sm font-bold text-[#22211E] hover:underline block mt-0.5">
                  support@foodrescue.org
                </a>
                <span className="text-[11px] text-[#6F6C64] block mt-1">
                  Certificates & tax receipts
                </span>
              </div>
            </div>

            <div className="card-warm rounded-2xl p-5 shadow-xs flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#E8EED2] text-[#5F684B] flex items-center justify-center shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#6F6C64] uppercase tracking-wider block">
                  Cold-Chain Protocol
                </span>
                <span className="text-sm font-bold text-[#22211E] block mt-0.5">
                  FSSAI & WARM Compliant
                </span>
                <span className="text-[11px] text-[#6F6C64] block mt-1">
                  Refrigerated &lt; 5°C | Hot &gt; 60°C
                </span>
              </div>
            </div>
          </div>

          {/* 2-Column FAQs and Direct Inquiry Form */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* FAQs Accordion */}
            <div className="lg:col-span-7 card-warm rounded-2xl p-6 shadow-xs">
              <div className="flex items-center gap-2 pb-4 mb-4 border-b border-[#D7D2C7]">
                <FileText size={18} className="text-[#5F684B]" />
                <h2 className="text-sm font-bold text-[#22211E]">
                  Frequently Asked Questions
                </h2>
              </div>

              <div className="space-y-3">
                {faqs.map((faq, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div
                      key={idx}
                      className="border border-[#D7D2C7] rounded-xl overflow-hidden bg-[#FAF7F1] transition">
                      <button
                        onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                        className="w-full p-4 text-left flex items-center justify-between gap-3 text-xs font-bold text-[#22211E] hover:bg-[#F3EFE7]/50 cursor-pointer">
                        <span>{faq.q}</span>
                        {isOpen ? <ChevronUp size={16} className="text-[#6F6C64] shrink-0" /> : <ChevronDown size={16} className="text-[#6F6C64] shrink-0" />}
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 text-xs text-[#6F6C64] leading-relaxed border-t border-[#D7D2C7]/60 pt-3">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Direct Support Message Ticket */}
            <div className="lg:col-span-5 card-warm rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 pb-4 mb-4 border-b border-[#D7D2C7]">
                  <MessageSquare size={18} className="text-[#5F684B]" />
                  <div>
                    <h2 className="text-sm font-bold text-[#22211E]">
                      Direct Dispatch Query
                    </h2>
                    <p className="text-[11px] text-[#6F6C64]">Message our on-duty logistics coordinator</p>
                  </div>
                </div>

                {submitted ? (
                  <div className="py-8 text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-[#E8EED2] text-[#5F684B] flex items-center justify-center mx-auto">
                      <CheckCircle2 size={24} />
                    </div>
                    <h3 className="text-sm font-bold text-[#22211E]">Inquiry Logged</h3>
                    <p className="text-xs text-[#6F6C64]">
                      Our dispatch desk has received your ticket. A representative will contact your on-site manager shortly.
                    </p>
                    <button
                      onClick={() => setSubmitted(false)}
                      className="mt-4 px-3 py-1.5 rounded-lg border border-[#D7D2C7] bg-[#FAF7F1] text-xs font-semibold hover:bg-[#F3EFE7] cursor-pointer">
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitTicket} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#22211E] mb-1">
                        Inquiry Category
                      </label>
                      <select
                        value={ticketSubject}
                        onChange={e => setTicketSubject(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#D7D2C7] bg-[#FDFBF7] text-xs font-medium focus:outline-none focus:border-[#70795A]">
                        <option>Courier Delayed / Dispatch Follow-up</option>
                        <option>Packaging Material / Food Crates Request</option>
                        <option>Safe Harbor & Tax Receipt Query</option>
                        <option>Other Operational Assistance</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#22211E] mb-1">
                        Message / Details
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={ticketMessage}
                        onChange={e => setTicketMessage(e.target.value)}
                        placeholder="Provide details about your current surplus batch or dispatch question..."
                        className="w-full p-3 rounded-xl border border-[#D7D2C7] bg-[#FDFBF7] text-xs text-[#22211E] focus:outline-none focus:border-[#70795A] resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50">
                      <Send size={14} />
                      <span>{submitting ? 'Transmitting...' : 'Submit Inquiry'}</span>
                    </button>
                  </form>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-[#D7D2C7] text-[11px] text-[#99958B] flex items-center gap-1.5">
                <Clock size={12} />
                <span>Operating hours: 24 hours / 7 days a week</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
