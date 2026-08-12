import { useState, useRef } from 'react';
import {
  X, Scan, Upload, FileText, CheckSquare, Square,
  Camera, AlertCircle, ChevronRight, Pill, User, Stethoscope,
  CalendarDays, RefreshCcw
} from 'lucide-react';
import { extractMedicinesFromImage, parseMedicinesFromText } from '../utils/ocrService';
import type { PrescriptionInfo } from '../utils/ocrService';

interface MedicineCandidate {
  name: string;
  selected: boolean;
}

interface PrescriptionScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with confirmed medicine names to search */
  onMedicinesConfirmed: (medicines: string[]) => void;
}

type Mode = 'select' | 'scan' | 'type' | 'preview';

export function PrescriptionScanModal({
  isOpen,
  onClose,
  onMedicinesConfirmed,
}: PrescriptionScanModalProps) {
  const [mode, setMode] = useState<Mode>('select');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typedText, setTypedText] = useState('');
  const [candidates, setCandidates] = useState<MedicineCandidate[]>([]);
  const [prescriptionInfo, setPrescriptionInfo] = useState<PrescriptionInfo>({});
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // ── Handlers ──────────────────────────────────────────────────

  const reset = () => {
    setMode('select');
    setIsProcessing(false);
    setError(null);
    setTypedText('');
    setCandidates([]);
    setPrescriptionInfo({});
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileSelect = async (file: File) => {
    setError(null);
    setIsProcessing(true);
    setMode('scan');

    try {
      const result = await extractMedicinesFromImage(file);
      setPrescriptionInfo(result.prescriptionInfo);
      setCandidates(result.medicines.map((name) => ({ name, selected: true })));
      setMode('preview');
    } catch (err: any) {
      setError(err.message || 'Failed to scan prescription. Please try again.');
      setMode('scan');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) handleFileSelect(file);
  };

  const handleTypeSubmit = () => {
    if (!typedText.trim()) return;
    const medicines = parseMedicinesFromText(typedText);
    if (medicines.length === 0) {
      setError('No valid medicine names found. Please check your input.');
      return;
    }
    setError(null);
    setCandidates(medicines.map((name) => ({ name, selected: true })));
    setPrescriptionInfo({});
    setMode('preview');
  };

  const toggleCandidate = (idx: number) => {
    setCandidates((prev) => prev.map((c, i) => (i === idx ? { ...c, selected: !c.selected } : c)));
  };

  const handleConfirm = () => {
    const selected = candidates.filter((c) => c.selected).map((c) => c.name);
    if (selected.length === 0) return;
    onMedicinesConfirmed(selected);
    handleClose();
  };

  const selectedCount = candidates.filter((c) => c.selected).length;

  // ── Render ────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Prescription Scanner"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal panel */}
      <div className="relative w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700/50 flex flex-col max-h-[92dvh] overflow-hidden animate-in slide-in-from-bottom-4 duration-300 sm:zoom-in-95">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Scan size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-[16px] font-black text-slate-800 dark:text-white leading-tight">
                {mode === 'preview' ? 'Confirm Medicines' : 'Prescription Scanner'}
              </h2>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                {mode === 'select' && 'Upload a photo or type medicine names'}
                {mode === 'scan' && (isProcessing ? 'Scanning your prescription…' : 'Scan failed')}
                {mode === 'type' && 'Enter medicine names manually'}
                {mode === 'preview' && `${candidates.length} medicine${candidates.length !== 1 ? 's' : ''} detected`}
              </p>
            </div>
          </div>
          <button
            id="prescription-modal-close"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── SELECT MODE: Choose upload or type ── */}
          {mode === 'select' && (
            <div className="p-6 space-y-4">
              {/* Upload Drop Zone */}
              <div
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-primary bg-primary/5 scale-[1.01]'
                    : 'border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileInputChange}
                  id="prescription-file-input"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileInputChange}
                  id="prescription-camera-input"
                />
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Upload size={28} className="text-primary" />
                </div>
                <h3 className="font-black text-slate-800 dark:text-white text-[15px] mb-2">
                  Upload Prescription Photo
                </h3>
                <p className="text-[12px] text-slate-500 font-medium leading-relaxed">
                  Drag & drop or click to select an image.
                  <br />
                  JPG, PNG, BMP supported · Max 1 MB
                </p>

                <div className="mt-5 flex gap-3 justify-center">
                  <button
                    id="prescription-upload-btn"
                    type="button"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-md shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
                  >
                    <Upload size={16} />
                    Choose File
                  </button>
                  <button
                    id="prescription-camera-btn"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      cameraInputRef.current?.click();
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                  >
                    <Camera size={16} />
                    Take Photo
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 my-2">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">or</span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              </div>

              {/* Type mode button */}
              <button
                id="prescription-type-btn"
                type="button"
                onClick={() => setMode('type')}
                className="w-full flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-primary/40 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <FileText size={18} className="text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors" />
                </div>
                <div className="text-left flex-1">
                  <div className="text-[14px] font-black text-slate-800 dark:text-white">Type Medicine Names</div>
                  <div className="text-[11px] font-medium text-slate-500 mt-0.5">Enter names manually if OCR fails or image is unclear</div>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-primary transition-colors" />
              </button>
            </div>
          )}

          {/* ── SCAN MODE: Loading or error ── */}
          {mode === 'scan' && (
            <div className="p-8 flex flex-col items-center justify-center text-center gap-5 min-h-[260px]">
              {isProcessing ? (
                <>
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                      <Scan size={32} className="text-primary" />
                    </div>
                    <div className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                  </div>
                  <div>
                    <p className="font-black text-slate-800 dark:text-white text-[16px]">Scanning Prescription</p>
                    <p className="text-[12px] text-slate-500 font-medium mt-1 animate-pulse">
                      Extracting medicine names…
                    </p>
                  </div>
                </>
              ) : error ? (
                <>
                  <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                    <AlertCircle size={32} className="text-red-500" />
                  </div>
                  <div>
                    <p className="font-black text-slate-800 dark:text-white text-[16px]">Scan Failed</p>
                    <p className="text-[12px] text-slate-500 font-medium mt-2 max-w-xs leading-relaxed">{error}</p>
                  </div>
                  <div className="flex gap-3 flex-wrap justify-center">
                    <button
                      id="prescription-retry-btn"
                      type="button"
                      onClick={() => { setError(null); setMode('select'); }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all"
                    >
                      <RefreshCcw size={15} />
                      Try Again
                    </button>
                    <button
                      id="prescription-type-fallback-btn"
                      type="button"
                      onClick={() => { setError(null); setMode('type'); }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all"
                    >
                      <FileText size={15} />
                      Type Instead
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* ── TYPE MODE: Manual text input ── */}
          {mode === 'type' && (
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Medicine Names
                </label>
                <textarea
                  id="prescription-text-input"
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  placeholder={'Azithromycin\nParacetamol 650mg\nOmeprazole, Pantoprazole'}
                  rows={6}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/40 transition-all text-sm font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 resize-none"
                  autoFocus
                />
                <p className="text-[11px] text-slate-500 font-medium mt-2">
                  Separate with commas, semicolons, or new lines. Strength is optional.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl">
                  <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
                  <p className="text-[12px] font-medium text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setError(null); setMode('select'); }}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all"
                >
                  Back
                </button>
                <button
                  id="prescription-parse-text-btn"
                  type="button"
                  onClick={handleTypeSubmit}
                  disabled={!typedText.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Pill size={16} />
                  Find These Medicines
                </button>
              </div>
            </div>
          )}

          {/* ── PREVIEW MODE: Prescription info + medicine checkboxes ── */}
          {mode === 'preview' && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">

              {/* Prescription metadata card */}
              {(prescriptionInfo.doctorName || prescriptionInfo.patientName || prescriptionInfo.diagnosis || prescriptionInfo.date) && (
                <div className="px-6 py-5">
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Prescription Details
                  </h3>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-3">
                    {prescriptionInfo.doctorName && (
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                          <Stethoscope size={13} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Doctor</div>
                          <div className="text-[13px] font-bold text-slate-800 dark:text-white mt-0.5">
                            Dr. {prescriptionInfo.doctorName}
                          </div>
                        </div>
                      </div>
                    )}
                    {prescriptionInfo.patientName && (
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center shrink-0">
                          <User size={13} className="text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Patient</div>
                          <div className="text-[13px] font-bold text-slate-800 dark:text-white mt-0.5">
                            {prescriptionInfo.patientName}
                          </div>
                        </div>
                      </div>
                    )}
                    {prescriptionInfo.diagnosis && (
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center shrink-0">
                          <Pill size={13} className="text-rose-600 dark:text-rose-400" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Diagnosis</div>
                          <div className="text-[13px] font-bold text-slate-800 dark:text-white mt-0.5">
                            {prescriptionInfo.diagnosis}
                          </div>
                        </div>
                      </div>
                    )}
                    {prescriptionInfo.date && (
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <CalendarDays size={13} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</div>
                          <div className="text-[13px] font-bold text-slate-800 dark:text-white mt-0.5">
                            {prescriptionInfo.date}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Medicines detected */}
              <div className="px-6 py-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Medicines Detected
                  </h3>
                  {candidates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = candidates.every((c) => c.selected);
                        setCandidates((prev) => prev.map((c) => ({ ...c, selected: !allSelected })));
                      }}
                      className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors"
                    >
                      {candidates.every((c) => c.selected) ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>

                {candidates.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                      <AlertCircle size={24} className="text-amber-500" />
                    </div>
                    <p className="text-[13px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      No medicines detected
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed max-w-xs mx-auto">
                      The prescription could not be read clearly. Try a sharper photo or type the medicine names.
                    </p>
                    <button
                      type="button"
                      onClick={() => setMode('type')}
                      className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                      Type Medicine Names
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {candidates.map((cand, idx) => (
                      <button
                        key={`${cand.name}-${idx}`}
                        id={`medicine-candidate-${idx}`}
                        type="button"
                        onClick={() => toggleCandidate(idx)}
                        className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all text-left group ${
                          cand.selected
                            ? 'bg-primary/8 border-primary/25 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className={`shrink-0 transition-colors ${cand.selected ? 'text-primary' : 'text-slate-400'}`}>
                          {cand.selected ? <CheckSquare size={18} /> : <Square size={18} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-[14px] font-black transition-colors leading-tight ${
                            cand.selected ? 'text-slate-800 dark:text-white' : 'text-slate-500'
                          }`}>
                            {cand.name}
                          </div>
                        </div>
                        <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                          cand.selected ? 'bg-primary/15' : 'bg-slate-200 dark:bg-slate-700'
                        }`}>
                          <Pill size={10} className={cand.selected ? 'text-primary' : 'text-slate-400'} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Scan another / type more */}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setCandidates([]); setPrescriptionInfo({}); setMode('select'); }}
                    className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors"
                  >
                    <RefreshCcw size={12} />
                    Scan Another
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('type')}
                    className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors"
                  >
                    <FileText size={12} />
                    Add More
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer — only in preview mode */}
        {mode === 'preview' && candidates.length > 0 && (
          <div className="shrink-0 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <button
              id="prescription-find-medicines-btn"
              type="button"
              onClick={handleConfirm}
              disabled={selectedCount === 0}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-primary text-primary-foreground rounded-2xl font-black text-[15px] shadow-lg shadow-primary/25 hover:bg-primary/90 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              <Scan size={18} />
              Find {selectedCount} Medicine{selectedCount !== 1 ? 's' : ''}
            </button>
            {selectedCount < candidates.length && (
              <p className="text-center text-[11px] font-medium text-slate-500 mt-2">
                {candidates.length - selectedCount} medicine{candidates.length - selectedCount !== 1 ? 's' : ''} deselected
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
