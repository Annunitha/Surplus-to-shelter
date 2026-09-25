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
  SlidersHorizontal,
  Home
} from 'lucide-react';
import Sidebar from '../components/common/Sidebar';
import TopNavbar from '../components/common/TopNavbar';

export default function RecipientHelp() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [ticketSubject, setTicketSubject] = useState('Incoming Courier Drop-off Coordination');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const faqs = [
    {
      q: 'How does a shelter accept or decline an incoming food offer?',
      a: 'When a new surplus donation matches your shelter profile, it appears under "Offers" with a real-time countdown timer. Clicking "Accept Offer" locks the allocation and dispatches a volunteer courier. Clicking "Decline" immediately cascades the offer to another regional shelter.'
    },
    {
      q: 'How do I prevent offers when our kitchen storage is full?',
      a: 'Go to Settings (Capacity & Preferences). Update your "Current Capacity" or toggle off "Receiving Mode". When your capacity reaches maximum, the matching algorithm automatically routes donations to other partner kitchens.'
    },
    {
      q: 'What should our staff inspect upon courier delivery?',
      a: 'Check that cold items are below 5°C and hot items are above 60°C. Verify packaging seals are intact and compare the digital manifest batch code with the volunteer driver before signing off.'
    },
    {
      q: 'What if a food delivery arrives with spoiled or compromised items?',
      a: 'You can reject the compromised portion at intake. File a report immediately using the hotline or form below. The FoodRescue safety team logs the batch and contacts the donor establishment.'
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
        role="recipient"
        activeTab="help"
        setActiveTab={() => {}}
        isOpen={mobileMenuOpen}
        setIsOpen={setMobileMenuOpen}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopNavbar
          role="recipient"
          onMenuClick={() => setMobileMenuOpen(true)}
          statusLabel="Shelter Online • Receiving Mode"
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8EED2] text-[#4D553C] border border-[#D7D2C7]">
                  <HelpCircle size={13} className="text-[#5F684B]" />
                  Shelter Operations Desk
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#22211E]">
                Shelter Partner Help & Intake Support
              </h1>
              <p className="text-xs sm:text-sm text-[#6F6C64] mt-1">
                Immediate food intake assistance, capacity coordination hotline, and quality assurance guidelines.
              </p>
            </div>

            <button
              onClick={() => navigate('/recipient/settings')}
              className="px-4 py-2.5 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-semibold transition shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer">
              <SlidersHorizontal size={15} />
              <span>Update Capacity & Preferences</span>
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
                  Shelter Coordinator Hotline
                </span>
                <a href="tel:+9118002663377" className="text-sm font-bold text-[#22211E] hover:underline block mt-0.5">
                  1800-RESCUE-SHELTER
                </a>
                <span className="text-[11px] text-[#5F684B] font-medium block mt-1">
                  Direct regional desk link
                </span>
              </div>
            </div>

            <div className="card-warm rounded-2xl p-5 shadow-xs flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#E8EED2] text-[#5F684B] flex items-center justify-center shrink-0">
                <Mail size={20} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#6F6C64] uppercase tracking-wider block">
                  Intake & Logistics Email
                </span>
                <a href="mailto:shelters@foodrescue.org" className="text-sm font-bold text-[#22211E] hover:underline block mt-0.5">
                  shelters@foodrescue.org
                </a>
                <span className="text-[11px] text-[#6F6C64] block mt-1">
                  Batch audits & compliance
                </span>
              </div>
            </div>

            <div className="card-warm rounded-2xl p-5 shadow-xs flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#E8EED2] text-[#5F684B] flex items-center justify-center shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#6F6C64] uppercase tracking-wider block">
                  Quality Assurance
                </span>
                <span className="text-sm font-bold text-[#22211E] block mt-0.5">
                  Thermal Safety Protocol
                </span>
                <span className="text-[11px] text-[#6F6C64] block mt-1">
                  Immediate intake verification
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
                  Intake & Allocation FAQs
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
                      Shelter Operations Inquiry
                    </h2>
                    <p className="text-[11px] text-[#6F6C64]">Message our on-duty shelter liaison</p>
                  </div>
                </div>

                {submitted ? (
                  <div className="py-8 text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-[#E8EED2] text-[#5F684B] flex items-center justify-center mx-auto">
                      <CheckCircle2 size={24} />
                    </div>
                    <h3 className="text-sm font-bold text-[#22211E]">Ticket Sent</h3>
                    <p className="text-xs text-[#6F6C64]">
                      Our shelter coordinator has received your message and will respond promptly.
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
                        Topic
                      </label>
                      <select
                        value={ticketSubject}
                        onChange={e => setTicketSubject(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#D7D2C7] bg-[#FDFBF7] text-xs font-medium focus:outline-none focus:border-[#70795A]">
                        <option>Incoming Courier Drop-off Coordination</option>
                        <option>Capacity Limit & Receiving Mode Issue</option>
                        <option>Damaged / Temperature Compromised Food Report</option>
                        <option>Other Shelter Support</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#22211E] mb-1">
                        Message Details
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={ticketMessage}
                        onChange={e => setTicketMessage(e.target.value)}
                        placeholder="Describe your issue or incoming delivery question..."
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
                <span>Operating hours: 24/7 Priority Emergency Channel</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
