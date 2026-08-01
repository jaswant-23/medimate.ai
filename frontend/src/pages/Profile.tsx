import { useState, useEffect, useRef } from 'react';
import { User, Phone, Globe, Clock, Loader2, Save, CheckCircle, Bell, Upload, Lock, Shield, Key, AlertTriangle, Settings, Users, Plus, Trash2, Edit3, X, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

const BACKEND_URL = 'http://localhost:5000';

export const Profile = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'family'>('profile');
  const { 
    user, 
    updateProfile, 
    uploadProfileImage, 
    changePassword, 
    deleteAccount, 
    isLoading, 
    error, 
    clearError,
    profiles,
    fetchProfiles,
    createProfile,
    updateProfileMember,
    deleteProfile,
    logout
  } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const memberFileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [memberUploading, setMemberUploading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Family Member form state
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [memberFormData, setMemberFormData] = useState({
    fullName: '',
    relation: 'OTHER',
    dob: '',
    gender: 'PREFER_NOT_TO_SAY',
    photoUrl: ''
  });

  useEffect(() => {
    fetchProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    photo: '',
    dob: '',
    gender: 'PREFER_NOT_TO_SAY',
    address: '',
    language: 'en',
    preferredUnits: 'metric',
    theme: 'LIGHT',
    medicineReminders: true,
    stockAlerts: true,
    expiryAlerts: true,
    refillAlerts: true,
    donationAlerts: true,
    calendarReminders: true,
    quietHoursStart: '',
    quietHoursEnd: '',
    expiryThreshold: 30,
  });

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (user) {
      const pref = user.notificationPref || {};
      let dobString = '';
      if (user.dob) {
        try {
          dobString = new Date(user.dob).toISOString().split('T')[0];
        } catch {
          dobString = '';
        }
      }

      setFormData({
        name: user.name || '',
        phone: user.phone || '',
        photo: user.photo || '',
        dob: dobString,
        gender: user.gender || 'PREFER_NOT_TO_SAY',
        address: user.address || '',
        language: user.language || 'en',
        preferredUnits: user.preferredUnits || 'metric',
        theme: user.theme || 'LIGHT',
        medicineReminders: pref.medicineReminders ?? true,
        stockAlerts: pref.stockAlerts ?? true,
        expiryAlerts: pref.expiryAlerts ?? true,
        refillAlerts: pref.refillAlerts ?? true,
        donationAlerts: pref.donationAlerts ?? true,
        calendarReminders: pref.calendarReminders ?? true,
        quietHoursStart: pref.quietHoursStart || '',
        quietHoursEnd: pref.quietHoursEnd || '',
        expiryThreshold: pref.expiryThreshold ?? 30,
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    setIsSaved(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    clearError();
    
    const photoPath = await uploadProfileImage(file);
    setUploading(false);
    
    if (photoPath) {
      setFormData(prev => ({ ...prev, photo: photoPath }));
      await updateProfile({ photo: photoPath });
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const getPhotoUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `${BACKEND_URL}${path}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    
    const updates: any = {};
    if (formData.name !== user?.name) updates.name = formData.name;
    if (formData.phone !== user?.phone) updates.phone = formData.phone;
    if (formData.photo !== user?.photo) updates.photo = formData.photo;
    if (formData.dob !== (user?.dob ? new Date(user.dob).toISOString().split('T')[0] : '')) updates.dob = formData.dob;
    if (formData.gender !== user?.gender) updates.gender = formData.gender;
    if (formData.address !== user?.address) updates.address = formData.address;
    if (formData.language !== user?.language) updates.language = formData.language;
    if (formData.preferredUnits !== user?.preferredUnits) updates.preferredUnits = formData.preferredUnits;
    if (formData.theme !== user?.theme) updates.theme = formData.theme;

    // Check if notification preferences changed
    const pref = user?.notificationPref || {};
    const hasPrefChanges = 
      formData.medicineReminders !== pref.medicineReminders ||
      formData.stockAlerts !== pref.stockAlerts ||
      formData.expiryAlerts !== pref.expiryAlerts ||
      formData.refillAlerts !== pref.refillAlerts ||
      formData.donationAlerts !== pref.donationAlerts ||
      formData.calendarReminders !== pref.calendarReminders ||
      formData.quietHoursStart !== (pref.quietHoursStart || '') ||
      formData.quietHoursEnd !== (pref.quietHoursEnd || '') ||
      Number(formData.expiryThreshold) !== pref.expiryThreshold;

    if (hasPrefChanges) {
      updates.notificationPref = {
        medicineReminders: formData.medicineReminders,
        stockAlerts: formData.stockAlerts,
        expiryAlerts: formData.expiryAlerts,
        refillAlerts: formData.refillAlerts,
        donationAlerts: formData.donationAlerts,
        calendarReminders: formData.calendarReminders,
        quietHoursStart: formData.quietHoursStart || null,
        quietHoursEnd: formData.quietHoursEnd || null,
        expiryThreshold: Number(formData.expiryThreshold),
      };
    }

    if (Object.keys(updates).length > 0) {
      const success = await updateProfile(updates);
      if (success) {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
      }
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    const success = await changePassword(currentPassword, newPassword);
    if (success) {
      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPasswordError(error || 'Failed to change password');
    }
  };

  const handleDeleteAccount = async () => {
    const confirm = window.confirm("Are you absolutely sure you want to delete your account? This action is permanent and cannot be undone.");
    if (confirm) {
      const success = await deleteAccount();
      if (success) {
        window.alert("Your account has been deleted successfully.");
      }
    }
  };

  const handleMemberFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMemberUploading(true);
    clearError();
    
    const photoPath = await uploadProfileImage(file);
    setMemberUploading(false);
    
    if (photoPath) {
      setMemberFormData(prev => ({ ...prev, photoUrl: photoPath }));
    }
  };

  const triggerMemberFileInput = () => {
    memberFileInputRef.current?.click();
  };

  const handleOpenAddMember = () => {
    setEditingMember(null);
    setMemberFormData({
      fullName: '',
      relation: 'OTHER',
      dob: '',
      gender: 'PREFER_NOT_TO_SAY',
      photoUrl: ''
    });
    setShowMemberModal(true);
  };

  const handleOpenEditMember = (member: any) => {
    setEditingMember(member);
    let dobString = '';
    if (member.dob) {
      try {
        dobString = new Date(member.dob).toISOString().split('T')[0];
      } catch {
        dobString = '';
      }
    }
    setMemberFormData({
      fullName: member.fullName,
      relation: member.relation,
      dob: dobString,
      gender: member.gender || 'PREFER_NOT_TO_SAY',
      photoUrl: member.photoUrl || ''
    });
    setShowMemberModal(true);
  };

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    let success = false;
    if (editingMember) {
      success = await updateProfileMember(editingMember.id, memberFormData);
    } else {
      success = await createProfile(memberFormData);
    }

    if (success) {
      setShowMemberModal(false);
    }
  };

  const handleDeleteMember = async (id: string, name: string) => {
    const confirm = window.confirm(`Are you sure you want to delete ${name}? This will also delete all of their medicine entries and reminders.`);
    if (confirm) {
      await deleteProfile(id);
    }
  };

  return (
    <div className="animate-in fade-in zoom-in duration-500">
      <div className="glass-panel p-4 rounded-2xl">
        
        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-5 border-b border-slate-200 dark:border-white/10 pb-5">
          <div className="relative group h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden border-2 border-primary/20 flex-shrink-0">
            {formData.photo ? (
              <img src={getPhotoUrl(formData.photo)} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <User className="h-8 w-8 text-primary" />
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="animate-spin h-5 w-5 text-white" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate">{formData.name || 'User Profile'}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs truncate">{user?.email}</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2">
              <button
                type="button"
                onClick={triggerFileInput}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50"
              >
                <Upload size={16} />
                Upload Photo
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-white/10 mb-8 gap-4 overflow-x-auto whitespace-nowrap scrollbar-none">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'border-primary text-slate-950 dark:text-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            <Settings size={16} /> Profile & Preferences
          </button>
          <button
            onClick={() => setActiveTab('family')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'family'
                ? 'border-primary text-slate-950 dark:text-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            <Users size={16} /> Family Members
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'password'
                ? 'border-primary text-slate-950 dark:text-white font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            <Key size={16} /> Change Password
          </button>
        </div>

        {activeTab === 'profile' && (
          <>
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl text-sm mb-6">
                {error}
              </div>
            )}
            
            {isSaved && (
              <div className="bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 p-4 rounded-xl text-sm flex items-center gap-2 mb-6">
                <CheckCircle size={18} />
                <span>Profile updated successfully!</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Profile details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="space-y-2">
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={user?.email || ''}
                    disabled
                    className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {user?.isEmailVerified ? (
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle size={12}/> Verified</span>
                    ) : (
                      <span className="text-yellow-600 dark:text-yellow-400">Unverified</span>
                    )}
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+919876543210"
                      className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="dob" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    id="dob"
                    name="dob"
                    value={formData.dob}
                    onChange={handleChange}
                    className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="gender" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Gender
                  </label>
                  <select
                    id="gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all appearance-none"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                    <option value="PREFER_NOT_TO_SAY">Prefer Not To Say</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="preferredUnits" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Preferred Units
                  </label>
                  <select
                    id="preferredUnits"
                    name="preferredUnits"
                    value={formData.preferredUnits}
                    onChange={handleChange}
                    className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all appearance-none"
                  >
                    <option value="metric">Metric (mg, ml, °C)</option>
                    <option value="imperial">Imperial (gr, fl oz, °F)</option>
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="address" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Address (For Donation pickup and verification)
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Enter your home address..."
                    className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="language" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Language
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Globe className="h-5 w-5 text-slate-400" />
                    </div>
                    <select
                      id="language"
                      name="language"
                      value={formData.language}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all appearance-none"
                    >
                      <option value="en">English (US)</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                      <option value="de">Deutsch</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="theme" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Theme Preference
                  </label>
                  <select
                    id="theme"
                    name="theme"
                    value={formData.theme}
                    onChange={handleChange}
                    className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all appearance-none"
                  >
                    <option value="LIGHT">Light Theme</option>
                    <option value="DARK">Dark Theme</option>
                    <option value="AMOLED">AMOLED Dark</option>
                  </select>
                </div>

              </div>

              {/* Notification Prefs */}
              <div className="border-t border-slate-200 dark:border-white/10 pt-6">
                <h3 className="text-lg font-semibold text-slate-950 dark:text-white mb-4 flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" /> Notification Preferences
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="medicineReminders"
                      checked={formData.medicineReminders}
                      onChange={handleChange}
                      className="h-4.5 w-4.5 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Medicine Intake Reminders</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="stockAlerts"
                      checked={formData.stockAlerts}
                      onChange={handleChange}
                      className="h-4.5 w-4.5 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Low Stock Alerts</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="expiryAlerts"
                      checked={formData.expiryAlerts}
                      onChange={handleChange}
                      className="h-4.5 w-4.5 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Medicine Expiry Alerts</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="refillAlerts"
                      checked={formData.refillAlerts}
                      onChange={handleChange}
                      className="h-4.5 w-4.5 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Refill Notifications</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="donationAlerts"
                      checked={formData.donationAlerts}
                      onChange={handleChange}
                      className="h-4.5 w-4.5 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Community Donation Updates</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="calendarReminders"
                      checked={formData.calendarReminders}
                      onChange={handleChange}
                      className="h-4.5 w-4.5 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Doctor & Lab Visit Reminders</span>
                  </label>
                </div>
              </div>

              {/* Expiry Settings */}
              <div className="border-t border-slate-200 dark:border-white/10 pt-6">
                <h3 className="text-lg font-semibold text-slate-950 dark:text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-primary" /> Cabinet Expiry Warning Threshold
                </h3>
                <div className="max-w-xs space-y-2">
                  <label htmlFor="expiryThreshold" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Warning Threshold (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    id="expiryThreshold"
                    name="expiryThreshold"
                    value={formData.expiryThreshold}
                    onChange={handleChange}
                    className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                  <p className="text-xs text-slate-500">
                    Medicines with fewer than this many days remaining will be flagged as "Expiring Soon".
                  </p>
                </div>
              </div>

              {/* Quiet Hours */}
              <div className="border-t border-slate-200 dark:border-white/10 pt-6">
                <h3 className="text-lg font-semibold text-slate-950 dark:text-white mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" /> Quiet Hours (Mute notifications)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="quietHoursStart" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Mute From
                    </label>
                    <input
                      type="time"
                      id="quietHoursStart"
                      name="quietHoursStart"
                      value={formData.quietHoursStart}
                      onChange={handleChange}
                      className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="quietHoursEnd" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Mute Until
                    </label>
                    <input
                      type="time"
                      id="quietHoursEnd"
                      name="quietHoursEnd"
                      value={formData.quietHoursEnd}
                      onChange={handleChange}
                      className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Save changes */}
              <div className="pt-6 border-t border-slate-200 dark:border-white/10 flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    <Save className="h-5 w-5" />
                  )}
                  Save Profile Settings
                </button>
              </div>

            </form>

            {/* Danger Zone */}
            <div className="mt-12 pt-6 border-t border-red-200 dark:border-red-900/20 animate-in fade-in">
              <h3 className="text-lg font-semibold text-red-600 dark:text-red-500 mb-2 flex items-center gap-2">
                <AlertTriangle size={18} /> Danger Zone
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Once you delete your account, all your data, profiles, and medicine cabinets will be permanently erased. This action cannot be undone.
              </p>
              <button
                onClick={handleDeleteAccount}
                type="button"
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-lg shadow-red-600/25 hover:shadow-red-600/45 transition-all hover:-translate-y-0.5"
              >
                Delete Account
              </button>
            </div>
          </>
        )}

        {activeTab === 'password' && (
          /* Change Password Form */
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {passwordError && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl text-sm mb-6">
                {passwordError}
              </div>
            )}
            
            {passwordSuccess && (
              <div className="bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 p-4 rounded-xl text-sm flex items-center gap-2 mb-6">
                <CheckCircle size={18} />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              
              <div className="space-y-2">
                <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Current Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Shield className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    id="currentPassword"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="pt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all hover:-translate-y-0.5 disabled:opacity-70"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    <Save className="h-5 w-5" />
                  )}
                  Update Password
                </button>
              </div>

            </form>
          </div>
        )}

        {activeTab === 'family' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl text-sm mb-6">
                {error}
              </div>
            )}
            
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Family Profiles</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Add profiles for family members to manage their cabinets and intake reminders.</p>
              </div>
              <button
                onClick={handleOpenAddMember}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer"
              >
                <Plus size={18} />
                Add Member
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {profiles.map((p: any) => (
                <div key={p.id} className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-white/5 flex gap-4 hover:shadow-lg hover:border-primary/20 transition-all duration-300">
                  <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden shrink-0 border border-primary/20">
                    {p.photoUrl ? (
                      <img src={getPhotoUrl(p.photoUrl)} alt={p.fullName} className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-8 w-8 text-primary" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-slate-900 dark:text-white truncate">{p.fullName}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        p.relation === 'SELF' 
                          ? 'bg-primary/15 text-primary border border-primary/25'
                          : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-350 border border-slate-200 dark:border-white/5'
                      }`}>
                        {p.relation}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                      Gender: <span className="font-medium text-slate-700 dark:text-slate-300">{p.gender || 'Not specified'}</span>
                    </p>
                    {p.dob && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                        DOB: <span className="font-medium text-slate-700 dark:text-slate-300">{new Date(p.dob).toLocaleDateString()}</span>
                      </p>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenEditMember(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-350 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                      >
                        <Edit3 size={12} />
                        Edit
                      </button>
                      {p.relation !== 'SELF' && (
                        <button
                          onClick={() => handleDeleteMember(p.id, p.fullName)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Add/Edit Member Modal */}
      {showMemberModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setShowMemberModal(false)}
        >
          <div 
            className="w-full max-w-md rounded-3xl p-6 md:p-8 relative bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              onClick={() => setShowMemberModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-all cursor-pointer"
            >
              <X size={20} />
            </button>

            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-6">
              {editingMember ? 'Edit Family Member' : 'Add Family Member'}
            </h2>

            <form onSubmit={handleMemberSubmit} className="space-y-5">
              {/* Photo upload */}
              <div className="flex flex-col items-center gap-3 mb-4">
                <div className="relative group h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden border-2 border-primary/20">
                  {memberFormData.photoUrl ? (
                    <img src={getPhotoUrl(memberFormData.photoUrl)} alt="Member avatar" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-10 w-10 text-primary" />
                  )}
                  {memberUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="animate-spin h-5 w-5 text-white" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={triggerMemberFileInput}
                  disabled={memberUploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-350 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                >
                  <Upload size={12} />
                  Upload Photo
                </button>
                <input
                  type="file"
                  ref={memberFileInputRef}
                  onChange={handleMemberFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label htmlFor="member_fullName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Full Name
                </label>
                <input
                  type="text"
                  id="member_fullName"
                  value={memberFormData.fullName}
                  onChange={(e) => setMemberFormData(prev => ({ ...prev, fullName: e.target.value }))}
                  required
                  placeholder="e.g. Jane Doe"
                  className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>

              {/* Relation */}
              <div className="space-y-1.5">
                <label htmlFor="member_relation" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Relation
                </label>
                <select
                  id="member_relation"
                  value={memberFormData.relation}
                  onChange={(e) => setMemberFormData(prev => ({ ...prev, relation: e.target.value }))}
                  disabled={editingMember?.relation === 'SELF'}
                  className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all appearance-none"
                >
                  {editingMember?.relation === 'SELF' ? (
                    <option value="SELF">Self (Primary Account)</option>
                  ) : (
                    <>
                      <option value="MOTHER">Mother</option>
                      <option value="FATHER">Father</option>
                      <option value="CHILD">Child</option>
                      <option value="GRANDPARENT">Grandparent</option>
                      <option value="SPOUSE">Spouse</option>
                      <option value="PET">Pet</option>
                      <option value="OTHER">Other</option>
                    </>
                  )}
                </select>
              </div>

              {/* DOB */}
              <div className="space-y-1.5">
                <label htmlFor="member_dob" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Date of Birth
                </label>
                <input
                  type="date"
                  id="member_dob"
                  value={memberFormData.dob}
                  onChange={(e) => setMemberFormData(prev => ({ ...prev, dob: e.target.value }))}
                  className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>

              {/* Gender */}
              <div className="space-y-1.5">
                <label htmlFor="member_gender" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Gender
                </label>
                <select
                  id="member_gender"
                  value={memberFormData.gender}
                  onChange={(e) => setMemberFormData(prev => ({ ...prev, gender: e.target.value }))}
                  className="block w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl bg-white/50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all appearance-none"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="PREFER_NOT_TO_SAY">Prefer Not To Say</option>
                </select>
              </div>

              {/* Submit & Cancel Buttons */}
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowMemberModal(false)}
                  className="px-5 py-3 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || memberUploading}
                  className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground font-semibold rounded-xl shadow-lg hover:shadow-primary/30 transition-all hover:-translate-y-0.5 disabled:opacity-70 cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    <Save className="h-5 w-5" />
                  )}
                  {editingMember ? 'Save Changes' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Width Logout Button at the bottom */}
      <div className="mt-8 mb-6 border-t border-slate-200 dark:border-white/10 pt-8">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold rounded-2xl transition-all cursor-pointer"
        >
          <LogOut size={20} />
          Sign Out of MediMate
        </button>
      </div>
    </div>
  );
};
