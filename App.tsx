import React, { useState, useEffect, useMemo } from 'react';
import DataSheet from './components/DataSheet';
import DashboardAnalysis from './components/DashboardAnalysis';
import RSBTCellReport from './components/RSBTCellReport';
import BookingReport from './components/BookingReport';
import { parseExcelFile, fetchMasterDataFromUrl, fetchBookingDataFromUrl } from './utils';
import { BookingDataRow, RawBookingRow, MasterDataRow } from './types';
import { MASTER_DATA as DEFAULT_MASTER_DATA } from './constants';
import { LayoutDashboard, Table, UploadCloud, AlertCircle, RefreshCw, Link as LinkIcon, FileSpreadsheet, FileText, ClipboardList, ArrowLeft, Info, CalendarRange } from 'lucide-react';

const MASTER_DATA_URL = 'https://docs.google.com/spreadsheets/d/1sqgOjtJ5uaiI6qIG_LZMZ-D0yaUhJG_FVxZLDeQORFA/export?format=csv';

const MONTHLY_REPORTS = [
    { name: 'April 2025', url: 'https://docs.google.com/spreadsheets/d/1D_d3iwih0aqEBLD1JQVZr1GUtqtsCQryPT-WoxtCfrc/edit?gid=1286396342' },
    { name: 'May 2025', url: 'https://docs.google.com/spreadsheets/d/1D_d3iwih0aqEBLD1JQVZr1GUtqtsCQryPT-WoxtCfrc/edit?gid=1250449318' },
    { name: 'June 2025', url: 'https://docs.google.com/spreadsheets/d/1D_d3iwih0aqEBLD1JQVZr1GUtqtsCQryPT-WoxtCfrc/edit?gid=1901550934' },
    { name: 'July 2025', url: 'https://docs.google.com/spreadsheets/d/1D_d3iwih0aqEBLD1JQVZr1GUtqtsCQryPT-WoxtCfrc/edit?gid=727421896' },
    { name: 'Aug 2025', url: 'https://docs.google.com/spreadsheets/d/1D_d3iwih0aqEBLD1JQVZr1GUtqtsCQryPT-WoxtCfrc/edit?gid=1386667955' },
    { name: 'Sept 2025', url: 'https://docs.google.com/spreadsheets/d/1D_d3iwih0aqEBLD1JQVZr1GUtqtsCQryPT-WoxtCfrc/edit?gid=1678804497' },
    { name: 'Oct 2025', url: 'https://docs.google.com/spreadsheets/d/1D_d3iwih0aqEBLD1JQVZr1GUtqtsCQryPT-WoxtCfrc/edit?gid=1866207457' },
    { name: 'Nov 2025', url: 'https://docs.google.com/spreadsheets/d/1D_d3iwih0aqEBLD1JQVZr1GUtqtsCQryPT-WoxtCfrc/edit?gid=0' },
    { name: 'Dec 2025', url: 'https://docs.google.com/spreadsheets/d/1D_d3iwih0aqEBLD1JQVZr1GUtqtsCQryPT-WoxtCfrc/edit?gid=1401133633' },
    { name: 'Jan 2026', url: 'https://docs.google.com/spreadsheets/d/1D_d3iwih0aqEBLD1JQVZr1GUtqtsCQryPT-WoxtCfrc/edit?gid=1660855752' },
    { name: 'Feb 2026', url: 'https://docs.google.com/spreadsheets/d/1D_d3iwih0aqEBLD1JQVZr1GUtqtsCQryPT-WoxtCfrc/edit?gid=303541532' },
    { name: 'March 2026', url: 'https://docs.google.com/spreadsheets/d/1D_d3iwih0aqEBLD1JQVZr1GUtqtsCQryPT-WoxtCfrc/edit?gid=1940660600' },
];

/**
 * Converts Google Sheets URLs to direct CSV export URLs.
 */
const convertToExportUrl = (inputUrl: string): string | null => {
  let url = inputUrl.trim();
  if (!url) return null;

  if (url.includes('docs.google.com/spreadsheets')) {
    if (url.includes('/d/e/')) {
      const parts = url.split('/pub');
      const baseUrl = parts[0];
      const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
      const gid = gidMatch ? gidMatch[1] : '0';
      return `${baseUrl}/pub?gid=${gid}&single=true&output=csv`;
    }

    const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (idMatch && idMatch[1]) {
      const id = idMatch[1];
      const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
      const gid = gidMatch ? gidMatch[1] : '0';
      return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
    }
  }
  return url;
};

type AppTab = 'datasheet' | 'dashboard' | 'rsbt' | 'booking';

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('datasheet');
  const [rawBookingData, setRawBookingData] = useState<RawBookingRow[]>([]);
  const [masterData, setMasterData] = useState<MasterDataRow[]>(DEFAULT_MASTER_DATA);
  const [isMasterDataLoading, setIsMasterDataLoading] = useState(false);
  const [masterDataSource, setMasterDataSource] = useState<'Default' | 'Synced'>('Default');
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{current: number, total: number, name?: string} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState('');

  // Period Selection State
  const [fromMonthIndex, setFromMonthIndex] = useState(0);
  const [toMonthIndex, setToMonthIndex] = useState(0);

  useEffect(() => {
    handleSyncMasterData(true);
  }, []);

  const handleSyncMasterData = async (silent = false) => {
    if (!silent) setIsMasterDataLoading(true);
    try {
      const data = await fetchMasterDataFromUrl(MASTER_DATA_URL);
      if (data && data.length > 0) {
        setMasterData(data);
        setMasterDataSource('Synced');
        if(!silent) alert(`Successfully synced ${data.length} master data records.`);
      }
    } catch (e) {
      console.error("Master data sync failed", e);
    } finally {
      if (!silent) setIsMasterDataLoading(false);
    }
  };

  const enrichedBookingData: BookingDataRow[] = useMemo(() => {
    return rawBookingData.map(row => {
      const master = masterData.find(m => m.officeId === row.officeId);
      return {
        ...row,
        subDivision: master?.subDivisionName || 'Unknown Sub-Division',
        headOffice: master?.headOfficeName || 'Unknown',
        officeType: master?.officeType || 'Unknown',
        officeJurisdiction: master?.officeJurisdiction || 'Unknown Jurisdiction',
        areaType: master?.areaType || 'Rural'
      };
    });
  }, [rawBookingData, masterData]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    const fileList = (Array.from(files) as File[]).slice(0, 5); // Limit to 5 files as requested
    let aggregatedData: RawBookingRow[] = [];
    let failedFiles: string[] = [];

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        setLoadingProgress({ current: i + 1, total: fileList.length, name: file.name });
        try {
          const rawData = await parseExcelFile(file);
          aggregatedData = [...aggregatedData, ...rawData];
        } catch (err) {
          console.error(`Failed to parse ${file.name}:`, err);
          failedFiles.push(file.name);
        }
      }

      if (aggregatedData.length === 0) {
        throw new Error("No valid booking data found in the uploaded files.");
      }

      if (failedFiles.length > 0) {
        alert(`Note: The following files could not be parsed: ${failedFiles.join(', ')}`);
      }

      setRawBookingData(aggregatedData);
      setActiveTab('dashboard'); 
    } catch (err: any) {
      setError(err.message || "Failed to parse files. Ensure the format is correct.");
    } finally {
      setLoading(false);
      setLoadingProgress(null);
      event.target.value = ''; 
    }
  };

  const loadFromUrl = async (input: string | { name: string, url: string }[]) => {
    setLoading(true);
    setError(null);
    
    const items = Array.isArray(input) ? input : [{ name: 'Selected Report', url: input }];
    const totalItems = items.length;
    let aggregatedData: RawBookingRow[] = [];
    let failedItems: string[] = [];

    try {
      for (let i = 0; i < totalItems; i++) {
        const item = items[i];
        setLoadingProgress({ current: i + 1, total: totalItems, name: item.name });
        
        const fetchUrl = convertToExportUrl(item.url);
        if (!fetchUrl) {
          failedItems.push(item.name);
          continue;
        }

        try {
          const rawData = await fetchBookingDataFromUrl(fetchUrl);
          aggregatedData = [...aggregatedData, ...rawData];
        } catch (err: any) {
          console.error(`Failed to fetch ${item.name}:`, err);
          failedItems.push(item.name);
        }
      }

      if (aggregatedData.length === 0) {
        throw new Error("Could not retrieve any data. Ensure the Google Sheet is 'Published to the web' (File > Share > Publish to web). Standard 'Share' links will not work due to security restrictions.");
      }

      if (failedItems.length > 0) {
        alert(`Note: The following reports could not be loaded: ${failedItems.join(', ')}. Please ensure they are published to the web.`);
      }

      setRawBookingData(aggregatedData);
      setActiveTab('dashboard');
    } catch (err: any) {
      setError(err.message || "A network error occurred while fetching the data.");
    } finally {
      setLoading(false);
      setLoadingProgress(null);
    }
  };

  const loadAnnualReport = () => {
    loadFromUrl(MONTHLY_REPORTS);
  };

  const loadSelectedPeriod = () => {
    if (toMonthIndex < fromMonthIndex) {
      alert("'To Month' cannot be earlier than 'From Month'.");
      return;
    }
    const selectedRange = MONTHLY_REPORTS.slice(fromMonthIndex, toMonthIndex + 1);
    loadFromUrl(selectedRange);
  };

  const triggerReupload = () => {
    setRawBookingData([]);
    setError(null);
    setCustomUrl('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hardReload = () => {
    if (confirm("Reset application and clear all data?")) {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900">
      <header className="bg-[#CE2029] shadow-md sticky top-0 z-50 transition-all"> 
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <button onClick={hardReload} title="Hard Reload App" className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-[#CE2029] font-bold shadow-sm hover:scale-110 transition-transform active:scale-95">IP</button>
             <h1 className="text-xl font-bold text-white tracking-wide hidden lg:block">Mail Booking Monitoring</h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar">
             {rawBookingData.length > 0 && (
               <button 
                onClick={triggerReupload} 
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-[10px] font-black uppercase shadow-lg border border-blue-400"
                title="Go to main screen to re-upload"
               >
                 <ArrowLeft size={14}/> Re-upload
               </button>
             )}

             <div className="hidden xl:flex items-center gap-2 text-xs text-white/90 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/20">
               <span className={`w-2 h-2 rounded-full ${masterDataSource === 'Synced' ? 'bg-green-400' : 'bg-amber-400'}`}></span>
               <span>Master Data: {masterDataSource}</span>
               <button onClick={() => handleSyncMasterData()} className="ml-2 p-1 hover:bg-white/20 rounded-full transition-colors" title="Sync Master Data">
                 <RefreshCw size={12} className={isMasterDataLoading ? 'animate-spin' : ''}/>
               </button>
             </div>

             <div className="flex gap-1 bg-black/10 p-1 rounded-lg">
                <NavTab active={activeTab === 'datasheet'} onClick={() => setActiveTab('datasheet')} label="Data" icon={<Table size={16}/>}/>
                <NavTab active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} label="Analysis" icon={<LayoutDashboard size={16}/>}/>
                <NavTab active={activeTab === 'rsbt'} onClick={() => setActiveTab('rsbt')} label="RSBT Cell" icon={<ClipboardList size={16}/>}/>
                <NavTab active={activeTab === 'booking'} onClick={() => setActiveTab('booking')} label="Booking Report" icon={<FileText size={16}/>}/>
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center">
            <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 min-w-[320px]">
              <div className="relative">
                <RefreshCw className="text-[#CE2029] animate-spin" size={48}/>
              </div>
              <div className="text-center">
                <h3 className="font-bold text-slate-800 tracking-wider text-lg">Processing Data</h3>
                {loadingProgress && (
                  <div className="mt-2">
                    <p className="text-[#CE2029] font-black text-xs uppercase tracking-widest">{loadingProgress.name}</p>
                    <p className="text-slate-500 text-[10px] mt-1">
                      Report {loadingProgress.current} of {loadingProgress.total}
                    </p>
                  </div>
                )}
              </div>
              {loadingProgress && (
                <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
                  <div 
                    className="bg-[#CE2029] h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${(loadingProgress.current / loadingProgress.total) * 100}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>
        )}

        {rawBookingData.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[80vh]">
            <div className="bg-white p-0 rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full overflow-hidden">
              <div className="h-2 bg-[#CE2029]"></div>
              <div className="p-8 md:p-10">
                <div className="flex flex-col items-center text-center mb-8">
                    <div className="w-16 h-16 bg-[#CE2029] text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg"><UploadCloud size={32} /></div>
                    <h2 className="text-3xl font-extrabold text-slate-800 mb-2 tracking-tight">Mail Operations Dashboard</h2>
                    <p className="text-slate-500 max-w-lg mx-auto">Dhenkanal Postal Division</p>
                </div>

                {/* Periodic Selection Section */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-8 shadow-inner">
                    <div className="flex items-center gap-2 mb-4">
                        <CalendarRange className="text-[#CE2029]" size={20}/>
                        <h3 className="font-bold text-slate-700">Custom Period Selection</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">From Month</label>
                            <select 
                                value={fromMonthIndex} 
                                onChange={(e) => setFromMonthIndex(parseInt(e.target.value))}
                                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-bold shadow-sm focus:ring-2 focus:ring-[#CE2029] focus:outline-none"
                            >
                                {MONTHLY_REPORTS.map((m, idx) => (
                                    <option key={m.name} value={idx}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">To Month</label>
                            <select 
                                value={toMonthIndex} 
                                onChange={(e) => setToMonthIndex(parseInt(e.target.value))}
                                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-bold shadow-sm focus:ring-2 focus:ring-[#CE2029] focus:outline-none"
                            >
                                {MONTHLY_REPORTS.map((m, idx) => (
                                    <option key={m.name} value={idx}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                        <button 
                            onClick={loadSelectedPeriod} 
                            disabled={loading}
                            className="bg-[#CE2029] text-white font-black uppercase text-xs tracking-widest px-6 py-3 rounded-lg shadow-lg hover:bg-red-700 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                        >
                            Load Selected Period
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-3 italic font-medium">Select a start and end month to aggregate multi-month data automatically.</p>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <div className="h-px bg-slate-200 flex-1"></div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Quick Selection</span>
                  <div className="h-px bg-slate-200 flex-1"></div>
                </div>

                <button onClick={loadAnnualReport} disabled={loading} className="w-full relative overflow-hidden group rounded-xl shadow-md mb-8">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#CE2029] to-[#B31B24]"></div>
                    <div className="relative p-6 flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <FileSpreadsheet size={28} className="text-white/80" />
                            <div className="text-left">
                                <h3 className="text-white font-bold">Annual Report FY 2025-26</h3>
                                <p className="text-white/60 text-xs">Aggregated (April 2025 - March 2026)</p>
                            </div>
                         </div>
                         <div className="bg-white text-[#CE2029] px-4 py-2 rounded-lg font-bold text-sm hover:scale-105 transition-transform">Load Full Year</div>
                    </div>
                </button>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8">
                  {MONTHLY_REPORTS.map((month) => (
                    <button key={month.name} onClick={() => loadFromUrl(month.url)} disabled={loading} className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:border-[#CE2029] hover:bg-white transition-all text-center group shadow-sm">
                      <span className="font-semibold text-slate-600 text-[11px] group-hover:text-[#CE2029] uppercase tracking-wider">{month.name}</span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="cursor-pointer block">
                      <div className="flex items-center gap-3 p-4 border border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-red-50 hover:border-red-300 transition-all h-full">
                          <UploadCloud size={20} className="text-slate-400"/>
                          <span className="text-sm font-semibold text-slate-700">Upload Excel/CSV Files (Max 5)</span>
                          <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} className="hidden" multiple />
                      </div>
                    </label>
                    <div className="flex items-center gap-2 p-1 border border-slate-300 rounded-xl bg-white shadow-sm overflow-hidden">
                        <input type="text" value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="Custom Google Sheet Link..." className="flex-1 min-w-0 pl-3 py-2 text-sm bg-transparent border-none focus:ring-0 text-slate-800"/>
                        <button onClick={() => loadFromUrl(customUrl)} disabled={loading} className="bg-[#CE2029] text-white p-2.5 rounded-lg transition-colors hover:bg-red-700"><LinkIcon size={18}/></button>
                    </div>
                </div>

                {error && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex gap-3">
                      <AlertCircle className="text-[#CE2029] shrink-0" size={20}/>
                      <div>
                        <p className="text-sm font-bold text-[#CE2029]">Connection Error</p>
                        <p className="text-xs text-red-600 mt-1">{error}</p>
                        <div className="mt-3 flex items-start gap-2 p-2 bg-white/60 rounded border border-red-100">
                           <Info size={14} className="text-slate-500 shrink-0 mt-0.5" />
                           <p className="text-[10px] text-slate-600 leading-normal font-medium">
                             <strong>Tip:</strong> Ensure your Google Sheet is <strong>Published to the web</strong> (File &gt; Share &gt; Publish to web) and select <strong>CSV</strong> format. Normal shared links are often blocked by security policies.
                           </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {rawBookingData.length > 0 && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {activeTab === 'datasheet' && <DataSheet data={enrichedBookingData} onReupload={triggerReupload} />}
            {activeTab === 'dashboard' && <DashboardAnalysis data={enrichedBookingData} masterData={masterData} onReupload={triggerReupload} />}
            {activeTab === 'rsbt' && <RSBTCellReport data={enrichedBookingData} masterData={masterData} onReupload={triggerReupload} />}
            {activeTab === 'booking' && <BookingReport data={enrichedBookingData} masterData={masterData} onReupload={triggerReupload} />}
          </div>
        )}
      </main>
    </div>
  );
}

const NavTab = ({ active, onClick, label, icon }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
    active ? 'bg-white text-[#CE2029] shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'
  }`}>
    {icon} <span className="hidden sm:inline">{label}</span>
  </button>
);

export default App;