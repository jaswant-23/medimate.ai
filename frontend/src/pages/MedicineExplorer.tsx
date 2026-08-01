import { useState, useEffect } from 'react';
import { Search, Heart, Star, Plus, Filter as FilterIcon, ChevronDown, SlidersHorizontal, ToggleRight, ToggleLeft, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FDADrug {
  id: string;
  brand_name: string;
  generic_name: string;
  product_type: string;
  route: string;
  manufacturer_name: string;
}

const CATEGORIES = [
  "All Products",
  "Human OTC Drug",
  "Human Prescription Drug",
  "Dietary Supplement",
  "Medical Device",
];

const MOCK_IMAGES = [
  "https://images.unsplash.com/photo-1584308666744-24d5e471d2ea?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1550572017-edb9b4a11b8b?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1628771065518-0d82f1938462?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1573883431205-98b5f10aaedb?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&q=80&w=400",
  "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&q=80&w=400"
];

export const MedicineExplorer = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState("All Products");
  const [drugs, setDrugs] = useState<FDADrug[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  // UI State for Filters
  const [activePriceFilter, setActivePriceFilter] = useState("Any");
  const [excludeOutOfStock, setExcludeOutOfStock] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');

  useEffect(() => {
    fetchDrugs();
    setIsMobileFiltersOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  const fetchDrugs = async (query = '') => {
    setLoading(true);
    try {
      // Fetch more to account for duplicates we will filter out
      let url = 'https://api.fda.gov/drug/label.json?limit=50';

      let searchParts = [];
      if (query) {
        searchParts.push(`(openfda.brand_name:${query}*+OR+openfda.generic_name:${query}*)`);
      }

      if (activeCategory !== "All Products") {
        const typeStr = activeCategory.toUpperCase().replace(/ /g, '+');
        searchParts.push(`openfda.product_type:"${typeStr}"`);
      }

      if (searchParts.length > 0) {
        url += `&search=${searchParts.join('+AND+')}`;
      } else {
        url += '&search=_exists_:openfda.brand_name';
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.results) {
        const uniqueBrands = new Set();
        const parsedDrugs: FDADrug[] = [];

        for (const item of data.results) {
          if (item.openfda && item.openfda.brand_name) {
            const brand = item.openfda.brand_name[0];
            const generic = item.openfda.generic_name?.[0] || '';

            // Create a unique key for the product to prevent repeats
            const uniqueKey = `${brand.toLowerCase()}-${generic.toLowerCase()}`;

            if (!uniqueBrands.has(uniqueKey)) {
              uniqueBrands.add(uniqueKey);
              parsedDrugs.push({
                id: item.id || Math.random().toString(),
                brand_name: brand,
                generic_name: generic,
                product_type: item.openfda.product_type?.[0] || 'DRUG',
                route: item.openfda.route?.[0] || 'ORAL',
                manufacturer_name: item.openfda.manufacturer_name?.[0] || 'Unknown',
              });
            }
          }
          if (parsedDrugs.length >= 12) break; // limit to 12 unique items for UI
        }

        setDrugs(parsedDrugs);
      } else {
        setDrugs([]);
      }
    } catch (error) {
      console.error("Error fetching FDA drugs:", error);
      setDrugs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDrugs(searchQuery);
  };

  return (
    <div className="animate-in fade-in duration-500 relative">

      {/* Mobile Sticky Header (Search + Filters) */}
      <div className="lg:hidden sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex flex-col gap-3 shadow-sm pt-4 pb-4 px-4 -mx-4 md:-mx-6 mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-lg font-black text-slate-800 dark:text-white">Explore</h1>
          <button
            onClick={() => setIsMobileFiltersOpen(true)}
            className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 active:scale-95 transition-transform"
          >
            <FilterIcon size={16} className="text-primary" />
            Filters
          </button>
        </div>
        
        {/* Mobile Search Bar inside Sticky Header */}
        <form onSubmit={handleSearch} className="flex gap-2 w-full mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search medicines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3 py-3 outline-none focus:ring-2 focus:ring-primary/40 transition-all text-sm font-semibold text-slate-800 dark:text-slate-200 shadow-sm"
            />
          </div>
          <button
            type="submit"
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-3 rounded-xl font-bold shadow-md shadow-primary/20 text-sm active:scale-95 whitespace-nowrap shrink-0"
          >
            Go
          </button>
        </form>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 p-4 md:p-6 lg:p-8">

        {/* LEFT SIDEBAR - FILTERS */}
        {isMobileFiltersOpen && (
          <div className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsMobileFiltersOpen(false)} />
        )}

        <aside className={`fixed lg:sticky lg:top-[24px] lg:max-h-[calc(100vh-48px)] top-0 right-0 h-full lg:h-fit w-[85vw] max-w-[340px] lg:w-[300px] xl:w-[320px] shrink-0 bg-white dark:bg-slate-900 lg:rounded-3xl shadow-2xl lg:shadow-[0_8px_30px_rgb(0,0,0,0.03)] border-l lg:border border-slate-100 dark:border-white/5 p-6 z-50 transition-transform duration-300 overflow-y-auto ${isMobileFiltersOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
          <div className="flex justify-between items-center mb-8 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-slate-800 dark:text-white">
              <FilterIcon className="text-primary" size={20} />
              <h2 className="text-lg font-black tracking-tight">Filters</h2>
            </div>
            <button onClick={() => setIsMobileFiltersOpen(false)} className="lg:hidden p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Sort By */}
          <div className="mb-8">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-3">
              Sort By
            </h3>
            <div className="relative group">
              <select className="w-full appearance-none bg-slate-50 dark:bg-slate-800 border-none text-slate-700 dark:text-slate-300 rounded-xl px-4 py-3 outline-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-primary transition-all text-sm font-semibold cursor-pointer">
                <option>Recommended</option>
                <option>Price: Low to High</option>
                <option>Price: High to Low</option>
                <option>A - Z</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" size={16} />
            </div>
          </div>

          {/* Categories */}
          <div className="mb-8">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-3">
              Categories
            </h3>
            <div className="space-y-1 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all duration-200 flex items-center gap-3 relative overflow-hidden group ${isActive
                        ? 'bg-primary/10 text-primary font-bold border border-primary/20 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium border border-transparent'
                      }`}
                  >
                    {!isActive && <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-primary/50 transition-colors"></span>}
                    {isActive && <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full"></span>}
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price Range Match from Image */}
          <div className="mb-8">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
              <SlidersHorizontal size={14} />
              Price Range
            </h3>

            <div className="border border-slate-100 dark:border-slate-800 rounded-2xl p-5 mb-4 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex justify-between items-center text-sm font-semibold mb-5">
                <span className="text-slate-500 dark:text-slate-400">Selected:</span>
                <span className="text-primary font-bold">₹0 - Any</span>
              </div>

              {/* Slider Track */}
              <div className="relative h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mb-4">
                <div className="absolute left-0 top-0 h-full w-full bg-primary rounded-full"></div>
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-[3px] border-primary rounded-full shadow-md cursor-pointer hover:scale-110 transition-transform"></div>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-[3px] border-primary rounded-full shadow-md cursor-pointer hover:scale-110 transition-transform"></div>
              </div>

              <div className="flex justify-between items-center text-[11px] font-bold text-slate-400">
                <span>₹0</span>
                <span>Any</span>
              </div>
            </div>

            {/* Price Pills */}
            <div className="flex flex-wrap gap-2">
              {['Any', 'Under ₹5k', '₹5k - ₹10k', '₹10k - ₹25k', '₹25k - ₹50k', '₹50k+'].map(price => (
                <button
                  key={price}
                  onClick={() => setActivePriceFilter(price)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${activePriceFilter === price
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                >
                  {price}
                </button>
              ))}
            </div>
          </div>

          {/* Brand Search */}
          <div className="mb-8">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Brand</h3>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search brands..."
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-10 pr-4 py-3 outline-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-primary/50 transition-all text-sm font-medium text-slate-700 dark:text-slate-300"
              />
            </div>
          </div>

          {/* Availability Toggle */}
          <div
            className="p-4 border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/50 rounded-2xl flex items-center justify-between shadow-sm cursor-pointer hover:border-slate-200 dark:hover:border-slate-700 transition-all"
            onClick={() => setExcludeOutOfStock(!excludeOutOfStock)}
          >
            <div>
              <h4 className="text-[13px] font-bold text-slate-800 dark:text-white">AVAILABILITY</h4>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">Exclude out-of-stock</p>
            </div>
            <div className="text-slate-300 dark:text-slate-600 transition-colors">
              {excludeOutOfStock ? <ToggleRight size={32} className="text-primary" /> : <ToggleLeft size={32} />}
            </div>
          </div>
        </aside>

        {/* RIGHT MAIN CONTENT */}
        <div className="flex-1 w-full min-w-0">
          {/* Desktop Search Bar area */}
          <div className="hidden lg:flex bg-white dark:bg-slate-900 p-2 pl-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 items-center gap-3 mb-8 focus-within:ring-2 focus-within:ring-primary/30 transition-all">
            <Search className="text-primary shrink-0" size={20} />
            <form onSubmit={handleSearch} className="flex-1 flex gap-2 w-full">
              <input
                type="text"
                placeholder="Search for medicines, ingredients, or symptoms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent outline-none text-slate-700 dark:text-slate-200 py-3 font-semibold placeholder:font-medium placeholder:text-slate-400 min-w-0"
              />
              <button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-xl font-bold shadow-md shadow-primary/20 transition-all active:scale-95 whitespace-nowrap shrink-0"
              >
                Search
              </button>
            </form>
          </div>

          {/* Mobile Search Bar moved to Sticky Header */}

          {/* Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-5">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
              <p className="text-slate-500 font-semibold animate-pulse">Searching global directory...</p>
            </div>
          ) : drugs.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 md:p-16 text-center border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center mx-auto max-w-lg mt-10">
              <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                <Search size={32} className="text-slate-400" />
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white mb-3">No results found</h3>
              <p className="text-slate-500 font-medium max-w-sm leading-relaxed">We couldn't find any products matching your current filters. Try adjusting your search or selecting a different category.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('All Products');
                }}
                className="mt-6 px-6 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5 lg:gap-6">
              {drugs.map((drug, index) => {
                const dummyDiscount = [17, 33, 44, 49, 15, 25][index % 6];
                const dummyPriceOriginal = [599, 699, 799, 899, 499, 1299][index % 6];
                const dummyPriceDiscounted = Math.floor(dummyPriceOriginal * (1 - dummyDiscount / 100));



                return (
                  <div key={drug.id} className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-[0_12px_30px_rgb(0,0,0,0.06)] hover:border-slate-200 dark:hover:border-slate-700 transition-all duration-300 group flex flex-col relative h-full">

                    {/* Floating Badges */}
                    <div className="absolute top-4 left-4 z-10">
                      <span className="bg-emerald-500 text-white text-[11px] font-black tracking-wide px-3 py-1.5 rounded-full shadow-md flex items-center">
                        {dummyDiscount}% OFF
                      </span>
                    </div>

                    <button className="absolute top-4 right-4 z-10 w-9 h-9 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 shadow-md hover:shadow-lg transition-all border border-slate-100 dark:border-slate-700 hover:scale-105 active:scale-95">
                      <Heart size={16} strokeWidth={2.5} className="transition-colors group-hover:fill-rose-500/10" />
                    </button>

                    {/* Image Area */}
                    <div className="p-3 pb-0">
                      <div
                        onClick={() => navigate(`/medicine/${drug.id}`)}
                        className="h-48 w-full bg-slate-50 dark:bg-slate-800 rounded-[1.25rem] relative overflow-hidden flex items-center justify-center cursor-pointer"
                      >
                        <img
                          src={MOCK_IMAGES[(drug.brand_name.length + index) % MOCK_IMAGES.length]}
                          alt={drug.brand_name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.05] text-transparent"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1584308666744-24d5e471d2ea?auto=format&fit=crop&q=80&w=400";
                          }}
                        />
                      </div>
                    </div>

                    {/* Content Area */}
                    <div className="p-5 flex flex-col flex-1 bg-white dark:bg-slate-900">

                      {/* Rating & Price Row */}
                      <div className="flex justify-between items-end mb-4 gap-2">
                        <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-100 dark:border-amber-500/20">
                          <Star className="text-amber-500 fill-amber-500" size={12} />
                          <span className="text-xs font-black text-amber-600 dark:text-amber-500">
                            {((Math.random() * 2) + 3).toFixed(1)} <span className="text-amber-600/50 dark:text-amber-500/50 font-semibold ml-0.5">({Math.floor(Math.random() * 100) + 10})</span>
                          </span>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span className="text-2xl font-black text-slate-900 dark:text-white leading-none tracking-tight">
                            ₹{dummyPriceDiscounted}
                          </span>
                          <span className="text-[12px] text-slate-400 line-through font-bold mt-1.5">
                            ₹{dummyPriceOriginal}
                          </span>
                        </div>
                      </div>

                      {/* Title & Category */}
                      <div className="mb-6 flex-1">
                        <h3
                          onClick={() => navigate(`/medicine/${drug.id}`)}
                          className="font-black text-slate-800 dark:text-white text-[16px] line-clamp-2 leading-snug hover:text-primary transition-colors cursor-pointer"
                        >
                          {drug.brand_name.toLowerCase().replace(/(^|\s)\S/g, l => l.toUpperCase())}
                        </h3>
                        {drug.generic_name && (
                          <p className="text-[13px] font-medium text-slate-500 mt-1.5 line-clamp-1 italic">
                            ({drug.generic_name.toLowerCase()})
                          </p>
                        )}
                        <span className="inline-block px-3 py-1 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black tracking-wider rounded-md mt-3 border border-slate-200 dark:border-slate-700">
                          {drug.product_type}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 mt-auto">
                        <button
                          onClick={() => {
                            const r = drug.route.toLowerCase();
                            let formType = 'OTHER';
                            if (r.includes('injection') || r.includes('intravenous')) formType = 'INJECTION';
                            else if (r.includes('topical') || r.includes('ointment')) formType = 'OINTMENT';
                            else if (r.includes('syrup') || r.includes('liquid')) formType = 'SYRUP';
                            else if (r.includes('drops')) formType = 'DROPS';
                            else if (r.includes('inhal')) formType = 'INHALER';
                            else if (r.includes('capsule')) formType = 'CAPSULE';
                            else if (r.includes('tablet') || r.includes('oral')) formType = 'TABLET';

                            navigate('/cabinet/new', {
                              state: {
                                autofill: {
                                  name: drug.brand_name.toLowerCase().replace(/(^|\s)\S/g, l => l.toUpperCase()),
                                  brandName: drug.brand_name.toLowerCase().replace(/(^|\s)\S/g, l => l.toUpperCase()),
                                  genericName: drug.generic_name,
                                  type: formType
                                }
                              }
                            });
                          }}
                          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl flex items-center justify-center gap-2 font-black text-[13px] transition-all shadow-[0_8px_16px_rgb(var(--primary-rgb),0.2)] hover:shadow-[0_8px_24px_rgb(var(--primary-rgb),0.3)] py-3 hover:-translate-y-0.5 active:translate-y-0"
                        >
                          <Plus size={18} strokeWidth={3} />
                          ADD TO CABINET
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
