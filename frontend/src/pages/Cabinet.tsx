import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicineStore } from '../store/useMedicineStore';
import type { Medicine } from '../store/useMedicineStore';
import { useAuthStore } from '../store/useAuthStore';
import { 
  Search, Plus, Trash2, Edit2, AlertTriangle, Calendar, FileText, 
  ArrowUpDown, Loader2, X, Clock 
} from 'lucide-react';
import { ReminderSetup } from '../components/ReminderSetup';
import { useReminderStore } from '../store/useReminderStore';
import { calculateStockStatus } from '../utils/stockCalc';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const Cabinet = () => {
  const navigate = useNavigate();
  const { medicines, fetchMedicines, deleteMedicine, fetchMedicineById, activeMedicine, adjustStock, isLoading } = useMedicineStore();
  const { profiles, fetchProfiles, activeProfileId, setActiveProfileId } = useAuthStore();
  const { reminders = [], fetchRemindersByProfile } = useReminderStore();
  
  // Filtering, sorting and threshold state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('expiryDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [expiryThreshold, setExpiryThreshold] = useState<number>(30);

  // Detail view and Lightbox state
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'info' | 'reminders' | 'stock'>('info');

  // Stock Adjustment state
  const [stockAdjustMode, setStockAdjustMode] = useState<'add' | 'correct'>('add');
  const [stockAdjustAmount, setStockAdjustAmount] = useState('');
  const [stockAdjustReason, setStockAdjustReason] = useState('RESTOCK');
  const [isAdjustingStock, setIsAdjustingStock] = useState(false);

  useEffect(() => {
    if (!selectedMedicine) {
      setActiveModalTab('info');
      setStockAdjustAmount('');
      setStockAdjustMode('add');
      setStockAdjustReason('RESTOCK');
    } else {
      fetchMedicineById(selectedMedicine.id!);
    }
  }, [selectedMedicine, fetchMedicineById]);

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedicine || !selectedMedicine.id || !stockAdjustAmount) return;
    setIsAdjustingStock(true);
    try {
      const amountVal = parseFloat(stockAdjustAmount);
      if (isNaN(amountVal) || amountVal < 0) {
        alert("Please enter a valid positive number.");
        return;
      }
      const success = await adjustStock(selectedMedicine.id, {
        type: stockAdjustMode,
        amount: amountVal,
        reason: stockAdjustReason
      });
      if (success) {
        setStockAdjustAmount('');
        // Refresh the active medicine details to show updated history
        fetchMedicineById(selectedMedicine.id);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsAdjustingStock(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);



  // Fetch all medicines and reminders for the active profile once, and then we filter/sort locally for instant UI response
  useEffect(() => {
    if (activeProfileId) {
      fetchMedicines(activeProfileId);
      fetchRemindersByProfile(activeProfileId);
    }
  }, [activeProfileId, fetchMedicines, fetchRemindersByProfile]);

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this medicine from the cabinet?")) {
      await deleteMedicine(id);
      if (selectedMedicine?.id === id) {
        setSelectedMedicine(null);
      }
    }
  };

  const getDaysToExpiry = (expiryStr: string) => {
    const expiry = new Date(expiryStr);
    const now = new Date();
    expiry.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatDaysToExpiry = (days: number) => {
    if (days <= 0) return 'Expired';
    if (days === 1) return 'Expires tomorrow';
    if (days <= 30) return `Expires in ${days} days`;
    const months = Math.floor(days / 30);
    return `Expires in ~${months} month${months > 1 ? 's' : ''}`;
  };

  const getDynamicStatus = (expiryStr: string, threshold: number) => {
    const days = getDaysToExpiry(expiryStr);
    if (days <= 0) return 'EXPIRED';
    if (days <= threshold) return 'EXPIRING_SOON';
    return 'SAFE';
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'EXPIRED':
        return 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400';
      case 'EXPIRING_SOON':
        return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400';
      default:
        return 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400';
    }
  };

  const getPrescriptionUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `${BACKEND_URL}${path}`;
  };

  // Perform client-side filtering and sorting
  const processedMedicines = useMemo(() => {
    let result = [...medicines];

    // 1. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.brandName?.toLowerCase().includes(q) ||
          m.genericName?.toLowerCase().includes(q)
      );
    }

    // 2. Type Filter
    if (typeFilter) {
      result = result.filter((m) => m.type === typeFilter);
    }

    // 3. Status Filter (using our dynamic client-side threshold)
    if (statusFilter) {
      result = result.filter((m) => getDynamicStatus(m.expiryDate, expiryThreshold) === statusFilter);
    }

    // 4. Sorting
    result.sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'expiryDate') {
        comparison = new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
      } else if (sortBy === 'quantityAvailable') {
        comparison = a.quantityAvailable - b.quantityAvailable;
      } else if (sortBy === 'createdAt') {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        comparison = dateA - dateB;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [medicines, searchQuery, typeFilter, statusFilter, sortBy, sortOrder, expiryThreshold]);

  return (
    <div className="animate-in fade-in duration-500">
      
      {/* Action bar */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Track your pharmaceutical supply.</p>
        </div>
        <button
          onClick={() => navigate('/cabinet/new')}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all cursor-pointer"
        >
          <Plus size={15} />
          Add
        </button>
      </div>

      {/* Profile Selector Tab Row */}
      {profiles.length > 1 && (
        <div className="flex border-b border-slate-200 dark:border-white/10 mb-8 overflow-x-auto gap-4 scrollbar-none">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveProfileId(p.id)}
              className={`pb-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                activeProfileId === p.id
                  ? 'border-primary text-slate-950 dark:text-white font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              {p.fullName} ({p.relation})
            </button>
          ))}
        </div>
      )}

      {/* Search & Filters */}
      <div className="space-y-4 mb-6">
        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search by name, brand, or generic..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>

        {/* Scrollable Filters Row */}
        <div className="flex gap-3 overflow-x-auto whitespace-nowrap scrollbar-none pb-2 items-center">
          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 text-sm font-semibold border border-slate-200 dark:border-white/10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary appearance-none shrink-0"
          >
            <option value="">All Types</option>
            <option value="TABLET">Tablet</option>
            <option value="CAPSULE">Capsule</option>
            <option value="SYRUP">Syrup</option>
            <option value="INJECTION">Injection</option>
            <option value="DROPS">Drops</option>
            <option value="OINTMENT">Ointment</option>
            <option value="INHALER">Inhaler</option>
            <option value="OTHER">Other</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 text-sm font-semibold border border-slate-200 dark:border-white/10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary appearance-none shrink-0"
          >
            <option value="">All Statuses</option>
            <option value="SAFE">🟢 Safe</option>
            <option value="EXPIRING_SOON">🟡 Expiring Soon</option>
            <option value="EXPIRED">🔴 Expired</option>
          </select>

          {/* Expiry threshold */}
          <div className="relative flex items-center shrink-0">
            <input
              type="number"
              min="1"
              max="365"
              value={expiryThreshold}
              onChange={(e) => setExpiryThreshold(Math.max(1, Number(e.target.value)))}
              className="w-24 pl-3 pr-10 py-2 text-sm font-semibold border border-slate-200 dark:border-white/10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary text-center"
              title="Days until expiry warning"
            />
            <span className="absolute right-3 text-[10px] uppercase font-bold text-slate-400 pointer-events-none select-none">
              Days
            </span>
          </div>

          <div className="w-px h-6 bg-slate-200 dark:bg-white/10 shrink-0 mx-1"></div>

          {/* Sorting */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 px-2 py-1.5 rounded-xl shrink-0">
            <ArrowUpDown size={14} className="text-slate-400 ml-1" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none appearance-none pr-4"
            >
              <option value="expiryDate">Expiry</option>
              <option value="name">Name</option>
              <option value="quantityAvailable">Quantity</option>
              <option value="createdAt">Date Added</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="px-2 py-1 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              {sortOrder === 'asc' ? 'ASC' : 'DESC'}
            </button>
          </div>
        </div>
      </div>

      {/* Cabinet Card Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="animate-spin h-10 w-10 text-primary" />
          <p className="text-slate-500 dark:text-slate-400">Loading your cabinet...</p>
        </div>
      ) : processedMedicines.length === 0 ? (
        <div className="glass-panel text-center py-20 rounded-3xl">
          <AlertTriangle className="mx-auto h-12 w-12 text-slate-400 mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No medicines found</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">Start by adding your first medicine manually to the cabinet.</p>
          <button
            onClick={() => navigate('/cabinet/new')}
            className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground font-semibold rounded-xl shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer"
          >
            <Plus size={20} />
            Add First Medicine
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {processedMedicines.map((med) => {
            const daysLeft = getDaysToExpiry(med.expiryDate);
            const dynamicStatus = getDynamicStatus(med.expiryDate, expiryThreshold);
            return (
              <div
                key={med.id}
                onClick={() => {
                  setSelectedMedicine(med);
                  setActiveModalTab('info');
                }}
                className="glass-panel rounded-3xl p-6 flex flex-col justify-between border border-slate-200 dark:border-white/5 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 dark:hover:border-primary/30 transition-all duration-300 relative overflow-hidden group cursor-pointer"
              >
                <div>
                  {/* Status Badge */}
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-200/50 dark:bg-white/10 text-slate-800 dark:text-slate-200">
                      {med.type}
                    </span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getStatusStyle(dynamicStatus)}`}>
                      {dynamicStatus === 'EXPIRED' ? 'Expired' : dynamicStatus === 'EXPIRING_SOON' ? 'Expiring Soon' : 'Safe'}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1 group-hover:text-primary transition-all">
                    {med.name}
                  </h3>
                  {med.brandName && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                      Brand: <span className="font-medium text-slate-700 dark:text-slate-300">{med.brandName}</span>
                    </p>
                  )}
                  {med.genericName && (
                    <p className="text-xs text-slate-400 mb-4 italic">
                      ({med.genericName})
                    </p>
                  )}

                  {/* Quantity & Dosage */}
                  <div className="grid grid-cols-2 gap-4 mb-4 bg-slate-100/50 dark:bg-white/5 p-3 rounded-2xl text-sm">
                    <div>
                      <p className="text-slate-400 text-xs">Dosage</p>
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        {med.dosageAmount} {med.dosageUnit}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs">Quantity</p>
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        {med.quantityAvailable} {med.quantityUnit}
                      </p>
                    </div>
                  </div>

                  {/* Expiry calculation */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
                    <Calendar size={14} className="text-primary" />
                    <span>Expiry: <span className="font-semibold text-slate-800 dark:text-slate-200">{new Date(med.expiryDate).toLocaleDateString()}</span></span>
                  </div>
                  
                  <p className={`text-xs font-semibold mb-2 ${daysLeft <= 0 ? 'text-red-500' : daysLeft <= expiryThreshold ? 'text-yellow-500' : 'text-green-500'}`}>
                    {formatDaysToExpiry(daysLeft)}
                  </p>

                  {(() => {
                    const stockInfo = calculateStockStatus(med, reminders);
                    return (
                      <p className={`text-xs font-semibold mb-4 flex items-center gap-1.5`}>
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${stockInfo.status === 'green' ? 'bg-green-500' : stockInfo.status === 'yellow' ? 'bg-amber-500' : stockInfo.status === 'orange' ? 'bg-orange-500' : 'bg-rose-500'}`} />
                        <span className={`${stockInfo.colorClass}`}>Stock: {stockInfo.label}</span>
                      </p>
                    );
                  })()}

                  {med.prescriptionImageUrl && (
                    <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/10 px-2.5 py-1 rounded-lg">
                      <FileText size={12} />
                      Prescription attached
                    </div>
                  )}
                </div>

                {/* Card Action Row */}
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-200 dark:border-white/5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/cabinet/edit/${med.id}`);
                    }}
                    className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                    title="Edit Medicine"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={(e) => handleDelete(med.id!, e)}
                    className="p-2 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                    title="Delete Medicine"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Medicine Detail Modal */}
      {selectedMedicine && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setSelectedMedicine(null)}
        >
          <div 
            className="w-full max-w-2xl rounded-3xl p-6 md:p-8 relative bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              onClick={() => setSelectedMedicine(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-all cursor-pointer"
            >
              <X size={20} />
            </button>

            {/* Modal Header */}
            <div className="mb-6 pr-8">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-200/50 dark:bg-white/10 text-slate-800 dark:text-slate-200">
                  {selectedMedicine.type}
                </span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getStatusStyle(getDynamicStatus(selectedMedicine.expiryDate, expiryThreshold))}`}>
                  {getDynamicStatus(selectedMedicine.expiryDate, expiryThreshold) === 'EXPIRED' ? 'Expired' : getDynamicStatus(selectedMedicine.expiryDate, expiryThreshold) === 'EXPIRING_SOON' ? 'Expiring Soon' : 'Safe'}
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white">
                {selectedMedicine.name}
              </h2>
              {selectedMedicine.brandName && (
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  Brand: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedMedicine.brandName}</span>
                </p>
              )}
              {selectedMedicine.genericName && (
                <p className="text-sm text-slate-400 mt-0.5 italic">
                  ({selectedMedicine.genericName})
                </p>
              )}
            </div>

            {/* Expired Action Prompt Banner */}
            {getDaysToExpiry(selectedMedicine.expiryDate) <= 0 && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <AlertTriangle size={16} /> Medicine Expired
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    This medicine has expired. Please take appropriate action: donate if eligible, dispose of it safely, or remove it from your cabinet.
                  </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto shrink-0">
                  <button 
                    onClick={() => {
                      alert("Redirecting to Community Donation centers... (Phase 4 feature)");
                    }}
                    className="flex-1 sm:flex-none px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all text-center cursor-pointer"
                  >
                    Donate
                  </button>
                  <button 
                    onClick={() => {
                      alert("Safe Disposal Instructions:\n1. Mix medicines (do not crush tablets) with an unappealing substance such as dirt, cat litter, or used coffee grounds.\n2. Place the mixture in a container such as a sealed plastic bag.\n3. Throw the container in your household trash.\n4. Scratch out all personal information on the prescription label before throwing away.");
                    }}
                    className="flex-1 sm:flex-none px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-all text-center cursor-pointer"
                  >
                    Dispose
                  </button>
                  <button 
                    onClick={(e) => handleDelete(selectedMedicine.id!, e)}
                    className="flex-1 sm:flex-none px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-all text-center cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 dark:border-white/10 mb-6">
              <button
                onClick={() => setActiveModalTab('info')}
                className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                  activeModalTab === 'info'
                    ? 'border-primary text-primary font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Information
              </button>
              <button
                onClick={() => setActiveModalTab('reminders')}
                className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                  activeModalTab === 'reminders'
                    ? 'border-primary text-primary font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Reminders
              </button>
              <button
                onClick={() => setActiveModalTab('stock')}
                className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                  activeModalTab === 'stock'
                    ? 'border-primary text-primary font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Stock & History
              </button>
            </div>

            {activeModalTab === 'info' ? (
              <>
                {/* Modal Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  
                  {/* Dosage, Stock & Status Details */}
                  <div className="space-y-4">
                    <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Supply Info</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Dosage Amount</p>
                          <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                            {selectedMedicine.dosageAmount} {selectedMedicine.dosageUnit}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Quantity Available</p>
                          <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                            {selectedMedicine.quantityAvailable} {selectedMedicine.quantityUnit}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5 space-y-2.5">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Key Dates</h4>
                      <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <Calendar size={16} className="text-primary shrink-0" />
                        <span>Expiry: <span className="font-semibold">{new Date(selectedMedicine.expiryDate).toLocaleDateString()}</span></span>
                      </div>
                      {selectedMedicine.purchaseDate && (
                        <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <Clock size={16} className="text-primary shrink-0" />
                          <span>Purchased: <span className="font-semibold">{new Date(selectedMedicine.purchaseDate).toLocaleDateString()}</span></span>
                        </div>
                      )}
                      <div className="text-sm font-semibold mt-2">
                        <span className={getDaysToExpiry(selectedMedicine.expiryDate) <= 0 ? 'text-red-500' : getDaysToExpiry(selectedMedicine.expiryDate) <= expiryThreshold ? 'text-yellow-500' : 'text-green-500'}>
                          {formatDaysToExpiry(getDaysToExpiry(selectedMedicine.expiryDate))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Manufacturing & Prescription Details */}
                  <div className="space-y-4">
                    <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5 space-y-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Additional Specs</h4>
                      {selectedMedicine.doctorName && (
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          Doctor: <span className="font-semibold">{selectedMedicine.doctorName}</span>
                        </p>
                      )}
                      {selectedMedicine.batchNumber && (
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          Batch No: <span className="font-semibold">{selectedMedicine.batchNumber}</span>
                        </p>
                      )}
                      {selectedMedicine.storageInstructions && (
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          Storage: <span className="font-semibold">{selectedMedicine.storageInstructions}</span>
                        </p>
                      )}
                      {!selectedMedicine.doctorName && !selectedMedicine.batchNumber && !selectedMedicine.storageInstructions && (
                        <p className="text-sm text-slate-400 italic">No extra manufacturing specifications provided.</p>
                      )}
                    </div>

                    {selectedMedicine.prescriptionImageUrl && (
                      <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5 flex flex-col items-center">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 self-start">Prescription Image</h4>
                        <div 
                          className="relative h-24 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 cursor-zoom-in group transition-all"
                          onClick={() => setIsLightboxOpen(true)}
                        >
                          <img 
                            src={getPrescriptionUrl(selectedMedicine.prescriptionImageUrl)} 
                            alt="Prescription Thumbnail" 
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-all">
                            Click to Zoom
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes Section */}
                {selectedMedicine.notes && (
                  <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5 mb-6">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Notes</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line">
                      {selectedMedicine.notes}
                    </p>
                  </div>
                )}
              </>
            ) : activeModalTab === 'reminders' ? (
              <div className="mb-6">
                <ReminderSetup 
                  medicineId={selectedMedicine.id!}
                  profileId={selectedMedicine.profileId}
                  defaultUnit={selectedMedicine.dosageUnit}
                  defaultAmount={selectedMedicine.dosageAmount}
                />
              </div>
            ) : (
              <div className="mb-6 space-y-6 animate-in fade-in duration-200">
                {/* Current Stock */}
                <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5 flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Inventory</h4>
                    <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">
                      {activeMedicine ? activeMedicine.quantityAvailable : selectedMedicine.quantityAvailable} {activeMedicine ? activeMedicine.quantityUnit : selectedMedicine.quantityUnit}
                    </p>
                  </div>
                  {(() => {
                    const currentMed = activeMedicine || selectedMedicine;
                    if (!currentMed) return null;
                    const stockInfo = calculateStockStatus(currentMed, reminders);
                    return (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${stockInfo.bgClass} ${stockInfo.colorClass} ${stockInfo.borderClass}`}>
                        {stockInfo.label}
                      </span>
                    );
                  })()}
                </div>

                {/* Adjust Stock Form */}
                <form onSubmit={handleStockAdjustment} className="bg-slate-50 dark:bg-white/5 p-5 rounded-2xl border border-slate-100 dark:border-white/5 space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Update Inventory Count</h4>
                  
                  <div className="flex gap-2 p-1 bg-slate-200/50 dark:bg-white/5 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setStockAdjustMode('add');
                        setStockAdjustReason('RESTOCK');
                      }}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        stockAdjustMode === 'add' ? 'bg-white dark:bg-slate-900 text-primary shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      Add Purchased Stock
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStockAdjustMode('correct');
                        setStockAdjustReason('MANUAL_ADJUSTMENT');
                      }}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        stockAdjustMode === 'correct' ? 'bg-white dark:bg-slate-900 text-primary shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      Correct Stock Count
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">
                        {stockAdjustMode === 'add' ? 'Quantity to Add' : 'Actual Count'}
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        required
                        value={stockAdjustAmount}
                        onChange={(e) => setStockAdjustAmount(e.target.value)}
                        placeholder={stockAdjustMode === 'add' ? 'e.g. 30' : 'e.g. 15'}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-1">Adjustment Reason</label>
                      <select
                        value={stockAdjustReason}
                        onChange={(e) => setStockAdjustReason(e.target.value)}
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all appearance-none"
                      >
                        {stockAdjustMode === 'add' ? (
                          <>
                            <option value="RESTOCK">Purchased / Restocked</option>
                            <option value="MANUAL_ADJUSTMENT">Manual Adjustment</option>
                          </>
                        ) : (
                          <>
                            <option value="MANUAL_ADJUSTMENT">Corrected Log Count</option>
                            <option value="DISPOSED">Disposed Damaged Stock</option>
                            <option value="DONATED">Donated Excess Stock</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isAdjustingStock}
                    className="w-full py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isAdjustingStock ? 'Saving...' : 'Apply Stock Change'}
                  </button>
                </form>

                {/* Stock History Timeline */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Inventory Log History</h4>
                  {(!activeMedicine?.stockHistory || activeMedicine.stockHistory.length === 0) ? (
                    <p className="text-xs text-slate-500 italic py-2">No stock history transactions found for this medicine.</p>
                  ) : (
                    <div className="max-h-[180px] overflow-y-auto pr-1 space-y-2.5">
                      {activeMedicine.stockHistory.map((history) => {
                        const isPositive = history.changeAmount > 0;
                        const changeLabel = isPositive ? `+${history.changeAmount}` : `${history.changeAmount}`;
                        const formattedDate = new Date(history.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        return (
                          <div 
                            key={history.id} 
                            className="flex justify-between items-center text-xs p-3 rounded-xl bg-slate-50 dark:bg-white/2 border border-slate-100 dark:border-white/5"
                          >
                            <div>
                              <p className="font-bold text-slate-800 dark:text-white capitalize">
                                {history.reason.toLowerCase().replace('_', ' ')}
                              </p>
                              <p className="text-[10px] text-slate-500 mt-0.5">{formattedDate}</p>
                            </div>
                            <div className="text-right">
                              <span className={`font-bold px-2 py-0.5 rounded-md ${
                                isPositive 
                                  ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                                  : 'bg-red-500/10 text-red-600 dark:text-red-400'
                              }`}>
                                {changeLabel}
                              </span>
                              <p className="text-[10px] text-slate-400 mt-1">Bal: {history.balanceAfter}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-white/10">
              <button
                onClick={(e) => handleDelete(selectedMedicine.id!, e)}
                className="flex items-center gap-2 px-4 py-2 border border-red-500/20 text-red-500 hover:bg-red-500/10 font-bold rounded-xl transition-all cursor-pointer"
              >
                <Trash2 size={16} />
                Delete Medicine
              </button>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedMedicine(null)}
                  className="px-4 py-2 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-white font-bold rounded-xl transition-all cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => navigate(`/cabinet/edit/${selectedMedicine.id}`)}
                  className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer"
                >
                  <Edit2 size={16} />
                  Edit Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prescription Image Zoom Lightbox */}
      {isLightboxOpen && selectedMedicine?.prescriptionImageUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 transition-all"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button 
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-4 right-4 p-3 text-white rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
          >
            <X size={24} />
          </button>
          
          <img 
            src={getPrescriptionUrl(selectedMedicine.prescriptionImageUrl)} 
            alt="Prescription Full Zoom" 
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

    </div>
  );
};
