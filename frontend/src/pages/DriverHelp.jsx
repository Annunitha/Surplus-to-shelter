import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  HelpCircle,
  Phone,
  MessageSquare,
  AlertTriangle,
  Route,
  Truck,
  Thermometer,
  MapPin,
  Building2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  RotateCw,
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle2,
  X,
  Send,
  AlertCircle
} from 'lucide-react';
import { apiRequest, getUser } from '../api';
import Sidebar from '../components/common/Sidebar';
import TopNavbar from '../components/common/TopNavbar';

export default function DriverHelp() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();

  const [driver, setDriver] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Issue Form State
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [issueSuccess, setIssueSuccess] = useState('');
  const [issueError, setIssueError] = useState('');
  const [issueForm, setIssueForm] = useState({
    issue_type: 'Pickup Problem',
    assignment_id: '',
    priority: 'normal',
    description: '',
    notes: ''
  });

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState(null);

  const faqs = [
    {
      id: 'faq-1',
      question: 'How do I accept an assignment?',
      answer: 'Rescue assignments are dispatched automatically to available couriers based on proximity and vehicle capacity. Once an assignment is routed to you, it appears under "Current Assignment" with pickup details, drop-off location, and transit window.'
    },
    {
      id: 'faq-2',
      question: 'What should I do if the donor is unavailable?',
      answer: 'First, attempt to call the donor contact person listed on your mission manifest. If the donor is unreachable after 5 minutes at the loading dock, notify Central Dispatch immediately via "Call Dispatch" or submit an issue ticket with priority "Urgent". Dispatch will contact the store manager or re-route your mission.'
    },
    {
      id: 'faq-3',
      question: 'What should I do if food temperature is unsafe?',
      answer: 'Food safety standards require hot prepared items to be held at ≥ 60°C and chilled items at ≤ 4°C. If food exceeds safe critical limits or shows signs of spoilage, do NOT load the shipment. Mark the issue via the "Food Temperature Problem" report and notify dispatch.'
    },
    {
      id: 'faq-4',
      question: 'What if the recipient is unavailable?',
      answer: 'Proceed to the receiving bay or kitchen entrance and ring the intake bell. If shelter staff does not respond within 5 minutes, call the shelter intake phone number in the drop-off section. If still unresolved, alert dispatch before leaving the site so an alternate nearby shelter can be designated.'
    },
    {
      id: 'faq-5',
      question: 'How do I report a route problem?',
      answer: 'For road closures, traffic congestion exceeding safe cold-chain transit time, or mechanical breakdowns, click "Report Issue" in your mission dashboard. Selecting "Vehicle Problem" or "Route Problem" will immediately flag your courier status on the central logistics map.'
    },
    {
      id: 'faq-6',
      question: 'What happens after I mark food as picked up?',
      answer: 'When you tap "Mark as Picked Up", the donation status transitions to "In Transit", the pickup timestamp is verified in the database, and the receiving shelter is automatically alerted of your inbound arrival ETA.'
    }
  ];

  const quickHelpCards = [
    {
      id: 'assignment',
      title: 'Assignment Issues',
      desc: 'Problems with dispatch matching, route cancellation, or reassignment.',
      icon: Route,
      actionType: 'Assignment Issues'
    },
    {
      id: 'delivery',
      title: 'Delivery Issues',
      desc: 'En-route transit delays, route re-planning, or shelter dock access.',
      icon: Truck,
      actionType: 'Delivery Problem'
    },
    {
      id: 'food_safety',
      title: 'Food Safety & Temperature',
      desc: 'Hot holding compliance, insulated carrier limits, and inspection.',
      icon: Thermometer,
      actionType: 'Food Temperature Problem'
    },
    {
      id: 'pickup',
      title: 'Pickup Problems',
      desc: 'Donor location access, packaging mismatch, or loading delays.',
      icon: MapPin,
      actionType: 'Pickup Problem'
    },
    {
      id: 'recipient',
      title: 'Recipient Problems',
      desc: 'Shelter capacity full, facility closed, or receiving staff missing.',
      icon: Building2,
      actionType: 'Recipient Unavailable'
    },
    {
      id: 'account',
      title: 'Account & Login',
      desc: 'Profile information, password changes, and volunteer verification.',
      icon: ShieldCheck,
      actionType: 'Other'
    }
  ];

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
      const [driverRes, assignmentRes, issuesRes] = await Promise.all([
        apiRequest('/api/drivers/me').catch(() => ({ driver: null })),
        apiRequest('/api/drivers/me/assignment').catch(() => ({ assignment: null })),
        apiRequest('/api/drivers/me/issues').catch(() => ({ issues: [] }))
      ]);

      if (driverRes?.driver) setDriver(driverRes.driver);
      if (assignmentRes?.assignment) {
        setAssignment(assignmentRes.assignment);
        setIssueForm(prev => ({
          ...prev,
          assignment_id: assignmentRes.assignment.donation_id
        }));
      }
      setIssues(issuesRes?.issues || []);
    } catch (err) {
      console.error('Failed to load support page data:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleQuickHelpClick(issueType) {
    setIssueForm(prev => ({
      ...prev,
      issue_type: issueType,
      assignment_id: assignment?.donation_id || prev.assignment_id || ''
    }));
    setShowIssueModal(true);
  }

  async function handleIssueSubmit(e) {
    e.preventDefault();
    setIssueError('');
    setIssueSuccess('');

    if (!issueForm.description.trim()) {
      setIssueError('Please provide a description of the issue.');
      return;
    }

    setSubmittingIssue(true);
    try {
      const res = await apiRequest('/api/drivers/me/issues', {
        method: 'POST',
        body: JSON.stringify({
          donation_id: issueForm.assignment_id || null,
          issue_type: issueForm.issue_type,
          description: issueForm.description,
          priority: issueForm.priority,
          notes: issueForm.notes
        })
      });

      setIssueSuccess('Support request submitted to dispatch operations.');
      if (res?.issue) {
        setIssues(prev => [res.issue, ...prev]);
      }
      setTimeout(() => {
        setShowIssueModal(false);
        setIssueSuccess('');
        setIssueForm({
          issue_type: 'Pickup Problem',
          assignment_id: assignment?.donation_id || '',
          priority: 'normal',
          description: '',
          notes: ''
        });
      }, 1200);
    } catch (err) {
      console.error('Failed to submit issue:', err);
      setIssueError(err.message || 'Unable to submit support issue. Please try again.');
    } finally {
      setSubmittingIssue(false);
    }
  }

  function getStatusBadge(status) {
    const s = (status || 'open').toLowerCase();
    if (s === 'resolved' || s === 'closed') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E8EED2] text-[#4D553C] border border-[#D7D2C7]">
          <CheckCircle2 size={12} strokeWidth={2.4} />
          <span className="capitalize">{s}</span>
        </span>
      );
    }
    if (s === 'in_progress') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#DCE7B8] text-[#3D4726] border border-[#CAD7A0]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5F684B] animate-pulse" />
          <span>In Progress</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F5EEDB] text-[#7A5B1E] border border-[#E8DBB8]">
        <Clock size={12} strokeWidth={2.4} />
        <span>Open</span>
      </span>
    );
  }

  function getPriorityBadge(priority) {
    if (priority === 'urgent') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#FBEBEA] text-[#B93830] border border-[#F0D5D3]">
          <AlertTriangle size={11} />
          <span>Urgent</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FAF7F1] text-[#6F6C64] border border-[#D7D2C7]">
        Normal
      </span>
    );
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Recent';
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="min-h-screen bg-[#FAF7F1] text-[#22211E] flex flex-col md:flex-row">
      {/* SIDEBAR */}
      <Sidebar
        role="driver"
        activeTab="help"
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
          statusLabel="Support & Operations Helpdesk"
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* BREADCRUMB & BACK BUTTON */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-[#6F6C64]">
              <button
                onClick={() => navigate('/driver')}
                className="hover:text-[#22211E] transition cursor-pointer font-medium">
                Driver Portal
              </button>
              <span>&gt;</span>
              <span className="font-semibold text-[#22211E]">Help & Support</span>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D7D2C7] bg-[#F8F5EE] hover:bg-[#EAE4D8] text-[#22211E] text-xs font-semibold transition cursor-pointer shadow-2xs">
              <ArrowLeft size={13} />
              <span>Back</span>
            </button>
          </div>

          {/* PAGE TITLE & SUBTITLE */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-[30px] font-bold tracking-tight text-[#22211E]">
                Help & Support
              </h1>
              <p className="text-xs sm:text-[13px] text-[#6F6C64] mt-1 leading-relaxed">
                Get assistance with assignments, deliveries, food safety and Driver Portal issues.
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={loadData}
                disabled={loading}
                className="px-4 py-2 rounded-xl border border-[#D7D2C7] bg-[#FDFBF7] hover:bg-[#F3EFE7] text-[#22211E] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs">
                <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>Refresh Status</span>
              </button>
              <button
                onClick={() => {
                  setIssueForm(prev => ({
                    ...prev,
                    assignment_id: assignment?.donation_id || prev.assignment_id || ''
                  }));
                  setShowIssueModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs">
                <AlertTriangle size={14} />
                <span>Report an Issue</span>
              </button>
            </div>
          </div>

          {/* CONTACT DISPATCH PROMINENT CARD */}
          <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#E8EED2] text-[#5F684B] flex items-center justify-center shrink-0 shadow-2xs">
                <Phone size={22} strokeWidth={2.4} />
              </div>
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5F684B] uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-[#5F684B] animate-pulse" />
                  <span>24/7 Operations Desk</span>
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-[#22211E]">
                  Need immediate assistance?
                </h2>
                <p className="text-xs text-[#6F6C64] max-w-xl leading-relaxed">
                  Contact FoodRescue Central Dispatch for urgent operational issues, dock blockages, emergency re-routing, or food temperature safety alerts.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <button
                onClick={() => alert('Dispatch Operations Hotline: Dialing Central Command (+91 11 2345 6789)...')}
                className="px-5 py-2.5 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-xs">
                <Phone size={15} />
                <span>Call Dispatch (+91 11 2345 6789)</span>
              </button>
              <button
                onClick={() => {
                  setIssueForm(prev => ({
                    ...prev,
                    issue_type: 'Other',
                    assignment_id: assignment?.donation_id || prev.assignment_id || ''
                  }));
                  setShowIssueModal(true);
                }}
                className="px-4 py-2.5 rounded-xl border border-[#D7D2C7] bg-[#FAF7F1] hover:bg-[#EAE4D8] text-[#22211E] font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs">
                <MessageSquare size={15} />
                <span>Message Dispatch</span>
              </button>
            </div>
          </div>

          {/* ACTIVE ASSIGNMENT SUPPORT SECTION */}
          <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#D7D2C7] mb-4">
              <div className="flex items-center gap-2">
                <Route size={18} className="text-[#5F684B]" />
                <h2 className="text-base font-bold text-[#22211E]">
                  Active Assignment Support
                </h2>
              </div>
              {assignment && (
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-[#DCE7B8] text-[#3D4726] border border-[#CAD7A0]">
                  Route #FR-{assignment.donation_id.slice(0, 4).toUpperCase()}
                </span>
              )}
            </div>

            {assignment ? (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="bg-[#FAF7F1] border border-[#D7D2C7] rounded-xl p-3.5">
                    <p className="text-[11px] font-semibold text-[#6F6C64] uppercase">Current Cargo</p>
                    <p className="text-sm font-bold text-[#22211E] mt-0.5 truncate" title={assignment.food_description}>
                      {assignment.food_description}
                    </p>
                    <p className="text-[11px] text-[#6F6C64] mt-0.5">
                      {assignment.quantity} {assignment.unit || 'units'}
                    </p>
                  </div>

                  <div className="bg-[#FAF7F1] border border-[#D7D2C7] rounded-xl p-3.5">
                    <p className="text-[11px] font-semibold text-[#6F6C64] uppercase">Pickup Origin</p>
                    <p className="text-sm font-bold text-[#22211E] mt-0.5 truncate" title={assignment.pickup?.org_name}>
                      {assignment.pickup?.org_name || 'Donor'}
                    </p>
                    <p className="text-[11px] text-[#6F6C64] mt-0.5 truncate" title={assignment.pickup?.address}>
                      {assignment.pickup?.address || 'Loading dock'}
                    </p>
                  </div>

                  <div className="bg-[#FAF7F1] border border-[#D7D2C7] rounded-xl p-3.5">
                    <p className="text-[11px] font-semibold text-[#6F6C64] uppercase">Drop-off Shelter</p>
                    <p className="text-sm font-bold text-[#22211E] mt-0.5 truncate" title={assignment.dropoff?.org_name}>
                      {assignment.dropoff?.org_name || 'Recipient'}
                    </p>
                    <p className="text-[11px] text-[#6F6C64] mt-0.5 truncate" title={assignment.dropoff?.address}>
                      {assignment.dropoff?.address || 'Receiving bay'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#6F6C64]">Status:</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#DCE7B8] text-[#3D4726] border border-[#CAD7A0]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#5F684B] animate-pulse" />
                      <span className="capitalize">{assignment.status?.replace('_', ' ') || 'In Progress'}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => alert(`Connecting to Central Dispatch regarding mission #${assignment.donation_id.slice(0, 4).toUpperCase()}...`)}
                      className="px-3.5 py-1.5 rounded-xl border border-[#D7D2C7] bg-[#FAF7F1] hover:bg-[#EAE4D8] text-[#22211E] font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer">
                      <Phone size={13} />
                      <span>Call Dispatcher</span>
                    </button>
                    <button
                      onClick={() => {
                        setIssueForm(prev => ({
                          ...prev,
                          assignment_id: assignment.donation_id
                        }));
                        setShowIssueModal(true);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs">
                      <AlertTriangle size={13} />
                      <span>Report Issue</span>
                    </button>
                    <button
                      onClick={() => navigate('/driver')}
                      className="px-3.5 py-1.5 rounded-xl border border-[#D7D2C7] bg-[#FAF7F1] hover:bg-[#EAE4D8] text-[#22211E] font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer">
                      <Route size={13} />
                      <span>View Assignment</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-[#6F6C64] space-y-2">
                <p className="font-semibold text-sm text-[#22211E]">No active assignment</p>
                <p>You are currently on standby. You can still contact dispatch operations or report general vehicle/account issues below.</p>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setIssueForm(prev => ({ ...prev, assignment_id: '' }));
                      setShowIssueModal(true);
                    }}
                    className="px-4 py-2 rounded-xl border border-[#D7D2C7] bg-[#FAF7F1] hover:bg-[#EAE4D8] text-[#22211E] font-semibold text-xs transition cursor-pointer inline-flex items-center gap-1.5">
                    <AlertTriangle size={13} />
                    <span>Report Vehicle / Account Issue</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* QUICK HELP SECTION */}
          <div>
            <div className="mb-3">
              <h2 className="text-base font-bold text-[#22211E]">Quick Help Topics</h2>
              <p className="text-xs text-[#6F6C64]">Select a category to quickly file an issue ticket or access protocol guides.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {quickHelpCards.map(card => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.id}
                    className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-[#5F684B] transition-colors">
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-[#EAE4D8] text-[#5F684B] flex items-center justify-center mb-3">
                        <Icon size={19} />
                      </div>
                      <h3 className="text-sm font-bold text-[#22211E]">{card.title}</h3>
                      <p className="text-xs text-[#6F6C64] mt-1 leading-relaxed">{card.desc}</p>
                    </div>
                    <div className="pt-4 mt-3 border-t border-[#E3DDD1]">
                      <button
                        onClick={() => handleQuickHelpClick(card.actionType)}
                        className="text-xs font-bold text-[#5F684B] hover:text-[#4D553C] flex items-center gap-1 cursor-pointer">
                        <span>Get Help</span>
                        <span>&rarr;</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FREQUENTLY ASKED QUESTIONS (FAQ) ACCORDION */}
          <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="border-b border-[#D7D2C7] pb-3">
              <h2 className="text-base font-bold text-[#22211E]">Frequently Asked Questions</h2>
              <p className="text-xs text-[#6F6C64] mt-0.5">Common operational answers for couriers and volunteer transport.</p>
            </div>

            <div className="divide-y divide-[#E3DDD1]">
              {faqs.map(faq => {
                const isOpen = openFaq === faq.id;
                return (
                  <div key={faq.id} className="py-3.5 first:pt-0 last:pb-0">
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : faq.id)}
                      className="w-full flex items-center justify-between text-left text-xs sm:text-sm font-bold text-[#22211E] hover:text-[#5F684B] transition cursor-pointer py-1">
                      <span>{faq.question}</span>
                      {isOpen ? (
                        <ChevronUp size={16} className="text-[#5F684B] shrink-0 ml-2" />
                      ) : (
                        <ChevronDown size={16} className="text-[#6F6C64] shrink-0 ml-2" />
                      )}
                    </button>
                    {isOpen && (
                      <p className="text-xs text-[#6F6C64] leading-relaxed mt-2 pl-1 animate-in fade-in duration-150">
                        {faq.answer}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* SUPPORT REQUEST HISTORY */}
          <div className="bg-[#F8F5EE] border border-[#D7D2C7] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#D7D2C7] pb-3">
              <div>
                <h2 className="text-base font-bold text-[#22211E]">Support Request History</h2>
                <p className="text-xs text-[#6F6C64] mt-0.5">Track submitted issue reports and resolution tickets.</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FAF7F1] border border-[#D7D2C7] text-[#6F6C64]">
                {issues.length} {issues.length === 1 ? 'Ticket' : 'Tickets'}
              </span>
            </div>

            {issues.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#6F6C64]">
                <FileText size={28} className="mx-auto text-[#6F6C64] mb-2 opacity-60" />
                <p className="font-semibold text-[#22211E]">No Support Requests Logged</p>
                <p className="mt-0.5">When you report a route or operational exception, your ticket will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#D7D2C7] bg-[#F3EFE7]/80 text-[11px] font-bold text-[#6F6C64] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Ticket ID</th>
                      <th className="py-2.5 px-3">Issue Type</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Priority</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3DDD1]">
                    {issues.map(item => (
                      <tr key={item.id} className="hover:bg-[#F3EFE7]/50 transition-colors">
                        <td className="py-3 px-3 font-mono text-[11px] font-bold text-[#5F684B]">
                          #{item.id.slice(0, 6).toUpperCase()}
                        </td>
                        <td className="py-3 px-3 font-semibold text-[#22211E] whitespace-nowrap">
                          {item.issue_type}
                        </td>
                        <td className="py-3 px-3 text-[#6F6C64] max-w-xs truncate" title={item.description}>
                          {item.description}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {getPriorityBadge(item.priority)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {getStatusBadge(item.status)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-right text-[#6F6C64]">
                          {formatDate(item.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* REPORT AN ISSUE MODAL */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-[#FAF7F1] border border-[#D7D2C7] rounded-3xl max-w-lg w-full shadow-2xl p-6 sm:p-7 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-4 border-b border-[#D7D2C7]">
              <div>
                <h3 className="text-lg font-bold text-[#22211E]">Report an Issue</h3>
                <p className="text-xs text-[#6F6C64] mt-0.5">Submit an operational ticket to Central Dispatch.</p>
              </div>
              <button
                onClick={() => setShowIssueModal(false)}
                className="p-1.5 rounded-lg text-[#6F6C64] hover:bg-[#EAE4D8] hover:text-[#22211E] transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {issueSuccess && (
              <div className="mt-4 p-3 rounded-xl bg-[#E8EED2] border border-[#D7D2C7] text-xs font-semibold text-[#4D553C] flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{issueSuccess}</span>
              </div>
            )}

            {issueError && (
              <div className="mt-4 p-3 rounded-xl bg-[#FBEBEA] border border-[#F0D5D3] text-xs font-semibold text-[#B93830] flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{issueError}</span>
              </div>
            )}

            <form onSubmit={handleIssueSubmit} className="mt-4 space-y-4">
              {/* Issue Type */}
              <div>
                <label className="block text-xs font-semibold text-[#22211E] mb-1">
                  Issue Type *
                </label>
                <select
                  value={issueForm.issue_type}
                  onChange={e => setIssueForm({ ...issueForm, issue_type: e.target.value })}
                  className="w-full px-3 py-2.5 bg-[#F8F5EE] border border-[#D7D2C7] rounded-xl text-xs sm:text-sm text-[#22211E] focus:outline-hidden focus:border-[#5F684B] cursor-pointer">
                  <option value="Pickup Problem">Pickup Problem</option>
                  <option value="Delivery Problem">Delivery Problem</option>
                  <option value="Vehicle Problem">Vehicle Problem</option>
                  <option value="Food Temperature Problem">Food Temperature Problem</option>
                  <option value="Recipient Unavailable">Recipient Unavailable</option>
                  <option value="Donor Unavailable">Donor Unavailable</option>
                  <option value="Route Problem">Route Problem</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Assignment ID */}
              <div>
                <label className="block text-xs font-semibold text-[#22211E] mb-1">
                  Assignment ID (Optional)
                </label>
                <input
                  type="text"
                  value={issueForm.assignment_id}
                  onChange={e => setIssueForm({ ...issueForm, assignment_id: e.target.value })}
                  placeholder="Auto-populated if mission active"
                  className="w-full px-3 py-2 bg-[#F8F5EE] border border-[#D7D2C7] rounded-xl text-xs sm:text-sm text-[#22211E] placeholder-[#8A857A] focus:outline-hidden focus:border-[#5F684B]"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-semibold text-[#22211E] mb-1">
                  Priority
                </label>
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="priority"
                      value="normal"
                      checked={issueForm.priority === 'normal'}
                      onChange={() => setIssueForm({ ...issueForm, priority: 'normal' })}
                      className="accent-[#5F684B]"
                    />
                    <span>Normal</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[#B93830] font-semibold">
                    <input
                      type="radio"
                      name="priority"
                      value="urgent"
                      checked={issueForm.priority === 'urgent'}
                      onChange={() => setIssueForm({ ...issueForm, priority: 'urgent' })}
                      className="accent-[#B93830]"
                    />
                    <span>Urgent (Needs immediate attention)</span>
                  </label>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-[#22211E] mb-1">
                  Description *
                </label>
                <textarea
                  rows={3}
                  required
                  value={issueForm.description}
                  onChange={e => setIssueForm({ ...issueForm, description: e.target.value })}
                  placeholder="Describe the issue encountered, dock location, or delay..."
                  className="w-full px-3 py-2 bg-[#F8F5EE] border border-[#D7D2C7] rounded-xl text-xs sm:text-sm text-[#22211E] placeholder-[#8A857A] focus:outline-hidden focus:border-[#5F684B]"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#D7D2C7]">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#D7D2C7] bg-[#F8F5EE] hover:bg-[#EAE4D8] text-[#22211E] text-xs font-semibold transition cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingIssue}
                  className="px-5 py-2 rounded-xl bg-[#5F684B] hover:bg-[#4D553C] text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50">
                  {submittingIssue ? (
                    <>
                      <RotateCw size={13} className="animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>Submit Issue</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
