import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useMedicineStore } from '../store/useMedicineStore';
import { useAuthStore } from '../store/useAuthStore';
import { Save, Camera, Loader2, AlertCircle } from 'lucide-react';

const BACKEND_URL = 'http://localhost:5000';

const MEDICINE_TYPES = [
  { value: 'TABLET', label: 'Tablet' },
  { value: 'CAPSULE', label: 'Capsule' },
  { value: 'SYRUP', label: 'Syrup' },
  { value: 'INJECTION', label: 'Injection' },
  { value: 'DROPS', label: 'Drops' },
  { value: 'OINTMENT', label: 'Ointment' },
  { value: 'INHALER', label: 'Inhaler' },
  { value: 'OTHER', label: 'Other' }
];

const STORAGE_PRESETS = [
  'Store below 25°C',
  'Refrigerate (2°C - 8°C)',
  'Do not freeze',
  'Store in a cool dry place',
  'Protect from sunlight'
];

export const MedicineForm = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { addMedicine, updateMedicine, fetchMedicineById, activeMedicine, uploadPrescriptionImage, isLoading, error, clearError } = useMedicineStore();
  const { profiles, fetchProfiles } = useAuthStore();

  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    brandName: '',
    genericName: '',
    type: 'TABLET',
    dosageAmount: '',
    dosageUnit: 'mg',
    quantityAvailable: '',
    quantityUnit: 'tablets',
    purchaseDate: '',
    expiryDate: '',
    batchNumber: '',
    doctorName: '',
    prescriptionImageUrl: '',
    storageInstructions: STORAGE_PRESETS[0],
    customStorage: '',
    notes: ''
  });

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  useEffect(() => {
    if (profiles.length > 0) {
      const selfProfile = profiles.find((p) => p.relation === 'SELF');
      if (selfProfile) {
        setSelectedProfileId(selfProfile.id);
      } else {
        setSelectedProfileId(profiles[0].id);
      }
    }
  }, [profiles]);

  useEffect(() => {
    if (id) {
      fetchMedicineById(id);
    } else {
      // Clear form for new medicine, auto-fill if navigating from Explorer/PDP
      const autofill = location.state?.autofill || {};
      
      setFormData({
        name: autofill.name || '',
        brandName: autofill.brandName || '',
        genericName: autofill.genericName || '',
        type: autofill.type || 'TABLET',
        dosageAmount: '',
        dosageUnit: 'mg',
        quantityAvailable: '',
        quantityUnit: 'tablets',
        purchaseDate: '',
        expiryDate: '',
        batchNumber: '',
        doctorName: '',
        prescriptionImageUrl: '',
        storageInstructions: STORAGE_PRESETS[0],
        customStorage: '',
        notes: autofill.notes || ''
      });
    }
  }, [id, fetchMedicineById, location.state]);

  useEffect(() => {
    if (id && activeMedicine) {
      setSelectedProfileId(activeMedicine.profileId);
      
      const purchaseStr = activeMedicine.purchaseDate 
        ? new Date(activeMedicine.purchaseDate).toISOString().split('T')[0] 
        : '';
      const expiryStr = activeMedicine.expiryDate 
        ? new Date(activeMedicine.expiryDate).toISOString().split('T')[0] 
        : '';

      const isPreset = STORAGE_PRESETS.includes(activeMedicine.storageInstructions || '');

      setFormData({
        name: activeMedicine.name,
        brandName: activeMedicine.brandName || '',
        genericName: activeMedicine.genericName || '',
        type: activeMedicine.type,
        dosageAmount: String(activeMedicine.dosageAmount),
        dosageUnit: activeMedicine.dosageUnit,
        quantityAvailable: String(activeMedicine.quantityAvailable),
        quantityUnit: activeMedicine.quantityUnit,
        purchaseDate: purchaseStr,
        expiryDate: expiryStr,
        batchNumber: activeMedicine.batchNumber || '',
        doctorName: activeMedicine.doctorName || '',
        prescriptionImageUrl: activeMedicine.prescriptionImageUrl || '',
        storageInstructions: isPreset ? (activeMedicine.storageInstructions || STORAGE_PRESETS[0]) : 'CUSTOM',
        customStorage: isPreset ? '' : (activeMedicine.storageInstructions || ''),
        notes: activeMedicine.notes || ''
      });
    }
  }, [id, activeMedicine]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    clearError();
    
    const photoPath = await uploadPrescriptionImage(file);
    setUploading(false);
    
    if (photoPath) {
      setFormData(prev => ({ ...prev, prescriptionImageUrl: photoPath }));
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    const finalStorage = formData.storageInstructions === 'CUSTOM' 
      ? formData.customStorage 
      : formData.storageInstructions;

    const payload = {
      profileId: selectedProfileId,
      name: formData.name,
      brandName: formData.brandName || undefined,
      genericName: formData.genericName || undefined,
      type: formData.type,
      dosageAmount: parseFloat(formData.dosageAmount),
      dosageUnit: formData.dosageUnit,
      quantityAvailable: parseFloat(formData.quantityAvailable),
      quantityUnit: formData.quantityUnit,
      purchaseDate: formData.purchaseDate || undefined,
      expiryDate: formData.expiryDate,
      batchNumber: formData.batchNumber || undefined,
      doctorName: formData.doctorName || undefined,
      prescriptionImageUrl: formData.prescriptionImageUrl || undefined,
      storageInstructions: finalStorage || undefined,
      notes: formData.notes || undefined
    };

    let success = false;
    if (id) {
      success = await updateMedicine(id, payload);
    } else {
      success = await addMedicine(payload);
    }

    if (success) {
      navigate('/cabinet');
    }
  };

  const getPrescriptionUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `${BACKEND_URL}${path}`;
  };

  return (
    <div className="animate-in fade-in zoom-in duration-500">

      <div className="glass-panel p-4 rounded-2xl">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white mb-5">
          {id ? 'Edit Medicine Details' : 'Add New Medicine'}
        </h1>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl text-sm mb-6 flex items-center gap-2">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Owner Selection */}
          <div className="space-y-2">
            <label htmlFor="profileId" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              For Member Profile
            </label>
            <select
              id="profileId"
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              <option value="" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                Select a member profile...
              </option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                  {p.fullName} ({p.relation})
                </option>
              ))}
            </select>
            {profiles.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                No profiles found. You can manage profiles in your <a href="/profile" className="underline font-semibold">Profile Settings</a>.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Medicine Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="e.g. Paracetamol"
                className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="brandName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Brand Name (Optional)
              </label>
              <input
                type="text"
                id="brandName"
                name="brandName"
                value={formData.brandName}
                onChange={handleChange}
                placeholder="e.g. Crocin"
                className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="genericName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Generic Name (Optional)
              </label>
              <input
                type="text"
                id="genericName"
                name="genericName"
                value={formData.genericName}
                onChange={handleChange}
                placeholder="e.g. Acetaminophen"
                className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="type" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Medicine Type *
              </label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              >
                {MEDICINE_TYPES.map((t) => (
                  <option key={t.value} value={t.value} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">{t.label}</option>
                ))}
              </select>
            </div>

            {/* Dosage fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="dosageAmount" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Dosage Amount *
                </label>
                <input
                  type="number"
                  step="any"
                  id="dosageAmount"
                  name="dosageAmount"
                  value={formData.dosageAmount}
                  onChange={handleChange}
                  required
                  placeholder="e.g. 500"
                  className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="dosageUnit" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Dosage Unit *
                </label>
                <input
                  type="text"
                  id="dosageUnit"
                  name="dosageUnit"
                  value={formData.dosageUnit}
                  onChange={handleChange}
                  required
                  placeholder="e.g. mg, ml"
                  className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Quantity fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="quantityAvailable" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Quantity Available *
                </label>
                <input
                  type="number"
                  step="any"
                  id="quantityAvailable"
                  name="quantityAvailable"
                  value={formData.quantityAvailable}
                  onChange={handleChange}
                  required
                  placeholder="e.g. 20"
                  className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="quantityUnit" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Quantity Unit *
                </label>
                <input
                  type="text"
                  id="quantityUnit"
                  name="quantityUnit"
                  value={formData.quantityUnit}
                  onChange={handleChange}
                  required
                  placeholder="e.g. tablets, ml"
                  className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="purchaseDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Purchase Date (Optional)
              </label>
              <input
                type="date"
                id="purchaseDate"
                name="purchaseDate"
                value={formData.purchaseDate}
                onChange={handleChange}
                className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="expiryDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Expiry Date *
              </label>
              <input
                type="date"
                id="expiryDate"
                name="expiryDate"
                value={formData.expiryDate}
                onChange={handleChange}
                required
                className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="batchNumber" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Batch Number (Optional)
              </label>
              <input
                type="text"
                id="batchNumber"
                name="batchNumber"
                value={formData.batchNumber}
                onChange={handleChange}
                placeholder="e.g. B-983A"
                className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="doctorName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Doctor Name (Optional)
              </label>
              <input
                type="text"
                id="doctorName"
                name="doctorName"
                value={formData.doctorName}
                onChange={handleChange}
                placeholder="e.g. Dr. Jameson"
                className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="storageInstructions" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Storage Instructions (Optional)
              </label>
              <select
                id="storageInstructions"
                name="storageInstructions"
                value={formData.storageInstructions}
                onChange={handleChange}
                className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all mb-3"
              >
                {STORAGE_PRESETS.map((p) => (
                  <option key={p} value={p} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">{p}</option>
                ))}
                <option value="CUSTOM" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Custom Storage Instructions...</option>
              </select>

              {formData.storageInstructions === 'CUSTOM' && (
                <input
                  type="text"
                  name="customStorage"
                  value={formData.customStorage}
                  onChange={handleChange}
                  placeholder="Enter custom storage instructions..."
                  className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              )}
            </div>

            {/* Prescription manual image attachment */}
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Prescription Image (Optional)
              </label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={triggerFileInput}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-3 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    <Camera size={18} />
                  )}
                  Upload Image
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                {formData.prescriptionImageUrl && (
                  <div className="relative h-16 w-16 rounded-lg overflow-hidden border border-slate-200 dark:border-white/10">
                    <img src={getPrescriptionUrl(formData.prescriptionImageUrl)} alt="Prescription" className="h-full w-full object-cover" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="notes" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Notes / Usage Instructions (Optional)
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="e.g. Take twice daily after lunch and dinner..."
                className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 dark:border-white/10 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/cabinet')}
              className="px-6 py-3 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || uploading}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              {id ? 'Save Changes' : 'Add Medicine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
