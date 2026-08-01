import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Heart, Zap, ShieldAlert, Activity, Pill, Beaker, FileText, CheckCircle2 } from 'lucide-react';

interface MedicineDetail {
  id: string;
  brand_name: string;
  generic_name: string;
  manufacturer_name: string;
  product_type: string;
  route: string;
  active_ingredient: string[];
  purpose: string[];
  indications_and_usage: string[];
  warnings: string[];
  dosage_and_administration: string[];
}

const MOCK_IMAGES = [
  "https://images.unsplash.com/photo-1584308666744-24d5e471d2ea?auto=format&fit=crop&q=80&w=600",
  "https://images.unsplash.com/photo-1550572017-edb9b4a11b8b?auto=format&fit=crop&q=80&w=600",
  "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&q=80&w=600",
  "https://images.unsplash.com/photo-1628771065518-0d82f1938462?auto=format&fit=crop&q=80&w=600",
  "https://images.unsplash.com/photo-1573883431205-98b5f10aaedb?auto=format&fit=crop&q=80&w=600",
  "https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?auto=format&fit=crop&q=80&w=600",
  "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&q=80&w=600",
  "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&q=80&w=600"
];

export const MedicineDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [medicine, setMedicine] = useState<MedicineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchMedicineDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchMedicineDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`https://api.fda.gov/drug/label.json?search=id:"${id}"`);
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const item = data.results[0];
        setMedicine({
          id: item.id || '',
          brand_name: item.openfda?.brand_name?.[0] || 'Unknown Brand',
          generic_name: item.openfda?.generic_name?.[0] || '',
          manufacturer_name: item.openfda?.manufacturer_name?.[0] || 'Unknown Manufacturer',
          product_type: item.openfda?.product_type?.[0] || 'DRUG',
          route: item.openfda?.route?.[0] || 'ORAL',
          active_ingredient: item.active_ingredient || [],
          purpose: item.purpose || [],
          indications_and_usage: item.indications_and_usage || [],
          warnings: item.warnings || [],
          dosage_and_administration: item.dosage_and_administration || []
        });
      } else {
        setMedicine(null);
      }
    } catch (error) {
      console.error("Error fetching medicine details:", error);
      setMedicine(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
        <p className="text-slate-500 font-semibold animate-pulse text-sm">Loading product details...</p>
      </div>
    );
  }

  if (!medicine) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center py-16">
        <div className="w-24 h-24 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6">
          <FileText size={40} className="text-slate-400" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Product Not Found</h2>
        <p className="text-slate-500 max-w-md mb-8">We couldn't retrieve the details for this medicine. It might have been removed or the ID is incorrect.</p>
        <button
          onClick={() => navigate(-1)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-xl font-bold shadow-md shadow-primary/20 transition-all active:scale-95"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Consistent dummy data based on name length so it doesn't change on re-render
  const nameLength = medicine.brand_name.length;
  const dummyDiscount = [17, 33, 44, 49, 15, 25][nameLength % 6];
  const dummyPriceOriginal = [599, 699, 799, 899, 499, 1299][nameLength % 6];
  const dummyPriceDiscounted = Math.floor(dummyPriceOriginal * (1 - dummyDiscount / 100));
  const dummyRating = ((nameLength % 20) / 10 + 3.0).toFixed(1);
  const dummyReviews = (nameLength * 7) % 200 + 10;

  const imageIndex = (nameLength + (medicine.id.charCodeAt(0) || 0)) % MOCK_IMAGES.length;

  return (
    <div className="font-sans pb-4">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-slate-800 dark:text-white hidden sm:block">
          Back to Explorer
        </h1>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 md:px-8 pt-8">
        {/* TOP SECTION: Split Layout */}
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 mb-12">

          {/* Left: Image Gallery */}
          <div className="w-full lg:w-[45%] shrink-0">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-4 md:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800 relative group">
              <div className="absolute top-6 left-6 z-10">
                <span className="bg-emerald-500 text-white text-xs font-black tracking-wide px-3.5 py-1.5 rounded-full shadow-md">
                  {dummyDiscount}% OFF
                </span>
              </div>
              <button className="absolute top-6 right-6 z-10 w-11 h-11 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 shadow-md hover:shadow-lg transition-all border border-slate-100 dark:border-slate-700 hover:scale-105 active:scale-95">
                <Heart size={20} strokeWidth={2.5} className="transition-colors group-hover:fill-rose-500/10" />
              </button>

              <div className="w-full aspect-square bg-slate-50 dark:bg-slate-800/50 rounded-2xl relative overflow-hidden flex items-center justify-center">
                <img
                  src={MOCK_IMAGES[imageIndex]}
                  alt={medicine.brand_name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 text-transparent"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1584308666744-24d5e471d2ea?auto=format&fit=crop&q=80&w=600";
                  }}
                />
              </div>
            </div>
          </div>

          {/* Right: Product Info */}
          <div className="w-full lg:w-[55%] flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-[11px] font-black tracking-wider rounded-md border border-primary/20">
                {medicine.product_type}
              </span>
              <span className="inline-block px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-black tracking-wider rounded-md border border-slate-200 dark:border-slate-700">
                {medicine.route}
              </span>
            </div>

            <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white leading-tight mb-2">
              {medicine.brand_name.toLowerCase().replace(/(^|\s)\S/g, l => l.toUpperCase())}
            </h1>

            {medicine.generic_name && (
              <p className="text-lg md:text-xl font-medium text-slate-500 mb-6 italic">
                ({medicine.generic_name.toLowerCase()})
              </p>
            )}

            <div className="flex items-center gap-4 mb-8">
              <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-100 dark:border-amber-500/20">
                <Star className="text-amber-500 fill-amber-500" size={16} />
                <span className="text-sm font-black text-amber-600 dark:text-amber-500">
                  {dummyRating} <span className="text-amber-600/50 dark:text-amber-500/50 font-semibold ml-1">({dummyReviews} Reviews)</span>
                </span>
              </div>
              <span className="text-sm font-semibold text-slate-400">|</span>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                By <span className="text-primary font-bold">{medicine.manufacturer_name}</span>
              </p>
            </div>

            <div className="flex items-end gap-3 mb-10">
              <span className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                ₹{dummyPriceDiscounted}
              </span>
              <span className="text-lg md:text-xl text-slate-400 line-through font-bold mb-1">
                ₹{dummyPriceOriginal}
              </span>
              <span className="text-emerald-500 font-bold text-sm mb-2 ml-2">Inclusive of all taxes</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mt-auto">
              <button
                onClick={() => {
                  const r = medicine.route.toLowerCase();
                  let formType = 'OTHER';
                  if (r.includes('injection') || r.includes('intravenous')) formType = 'INJECTION';
                  else if (r.includes('topical') || r.includes('ointment')) formType = 'OINTMENT';
                  else if (r.includes('syrup') || r.includes('liquid')) formType = 'SYRUP';
                  else if (r.includes('drops')) formType = 'DROPS';
                  else if (r.includes('inhal')) formType = 'INHALER';
                  else if (r.includes('capsule')) formType = 'CAPSULE';
                  else if (r.includes('tablet') || r.includes('oral')) formType = 'TABLET';

                  const notes = medicine.indications_and_usage.length > 0
                    ? medicine.indications_and_usage[0].substring(0, 500)
                    : '';

                  navigate('/cabinet/new', {
                    state: {
                      autofill: {
                        name: medicine.brand_name.toLowerCase().replace(/(^|\s)\S/g, l => l.toUpperCase()),
                        brandName: medicine.brand_name.toLowerCase().replace(/(^|\s)\S/g, l => l.toUpperCase()),
                        genericName: medicine.generic_name,
                        type: formType,
                        notes: notes
                      }
                    }
                  });
                }}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl flex items-center justify-center gap-3 font-black text-[15px] transition-all shadow-[0_8px_16px_rgb(var(--primary-rgb),0.2)] hover:shadow-[0_12px_24px_rgb(var(--primary-rgb),0.3)] py-4 hover:-translate-y-1 active:translate-y-0"
              >
                <Zap size={20} className="fill-white" />
                ADD TO CABINET
              </button>
            </div>

            {/* Quick Badges */}
            <div className="flex flex-wrap gap-4 mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                <CheckCircle2 size={18} className="text-emerald-500" /> Authentic Product
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                <CheckCircle2 size={18} className="text-emerald-500" /> FDA Approved
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: Detailed Info */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 dark:border-slate-800 overflow-hidden">
          {/* Tabs */}
          <div className="flex overflow-x-auto custom-scrollbar border-b border-slate-100 dark:border-slate-800 p-2">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'ingredients', label: 'Ingredients', icon: Beaker },
              { id: 'dosage', label: 'Dosage & Admin', icon: Pill },
              { id: 'warnings', label: 'Warnings', icon: ShieldAlert },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all whitespace-nowrap rounded-xl ${isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="p-6 md:p-10 min-h-[300px]">
            {activeTab === 'overview' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                    <Activity size={20} className="text-primary" /> Indications & Usage
                  </h3>
                  {medicine.indications_and_usage.length > 0 ? (
                    <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                      {medicine.indications_and_usage.map((text, i) => (
                        <p key={i} className="mb-4">{text}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 font-medium italic">Detailed usage information is not available for this product.</p>
                  )}
                </div>

                {medicine.purpose.length > 0 && (
                  <div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                      <Star size={20} className="text-primary" /> Primary Purpose
                    </h3>
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800">
                      <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300 font-medium">
                        {medicine.purpose.map((text, i) => (
                          <li key={i}>{text}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ingredients' && (
              <div className="animate-in fade-in duration-300">
                <h3 className="text-lg font-black text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                  <Beaker size={20} className="text-primary" /> Active Ingredients
                </h3>
                {medicine.active_ingredient.length > 0 ? (
                  <div className="grid gap-4">
                    {medicine.active_ingredient.map((ingredient, i) => (
                      <div key={i} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <Beaker size={20} />
                        </div>
                        <p className="text-slate-700 dark:text-slate-200 font-semibold leading-relaxed mt-2">{ingredient}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 font-medium italic">Detailed ingredient list is not provided in the current database record.</p>
                )}
              </div>
            )}

            {activeTab === 'dosage' && (
              <div className="animate-in fade-in duration-300">
                <h3 className="text-lg font-black text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                  <Pill size={20} className="text-primary" /> Dosage & Administration
                </h3>
                {medicine.dosage_and_administration.length > 0 ? (
                  <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 leading-relaxed font-medium bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                    {medicine.dosage_and_administration.map((text, i) => (
                      <p key={i} className="mb-4 last:mb-0">{text}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 font-medium italic">Specific dosage instructions are not available.</p>
                )}
              </div>
            )}

            {activeTab === 'warnings' && (
              <div className="animate-in fade-in duration-300">
                <h3 className="text-lg font-black text-rose-600 dark:text-rose-500 mb-6 flex items-center gap-2">
                  <ShieldAlert size={20} /> Warnings & Precautions
                </h3>
                {medicine.warnings.length > 0 ? (
                  <div className="space-y-4">
                    {medicine.warnings.map((text, i) => (
                      <div key={i} className="bg-rose-50 dark:bg-rose-500/10 rounded-2xl p-5 border border-rose-100 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 font-medium leading-relaxed">
                        {text}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 font-medium italic">No specific warnings found in the database.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
