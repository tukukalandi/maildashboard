import React, { useMemo } from 'react';
import { BookingDataRow, TargetDataRow, MasterDataRow } from '../types';
import { formatCurrency, exportToExcel, exportToPDF } from '../utils';
import { PRODUCTS } from '../constants';
import { Target, TrendingUp, Download, Printer, Award, AlertCircle, ArrowLeft } from 'lucide-react';

interface TargetAchievementProps {
  data: BookingDataRow[];
  targetData: TargetDataRow[];
  internationalTargetData: TargetDataRow[];
  domesticTargetData: TargetDataRow[];
  masterData: MasterDataRow[];
  onReupload?: () => void;
}

const TargetAchievement: React.FC<TargetAchievementProps> = ({ data, targetData, internationalTargetData, domesticTargetData, masterData, onReupload }) => {
  const [showSubDivisionSummary, setShowSubDivisionSummary] = React.useState(false);
  const [targetType, setTargetType] = React.useState<'Parcel' | 'International' | 'Domestic'>('Parcel');
  const [officeCategory, setOfficeCategory] = React.useState<'All' | 'Jurisdiction' | 'BO'>('All');

  const achievementData = useMemo(() => {
    let currentTargetData: TargetDataRow[] = [];
    if (targetType === 'Parcel') currentTargetData = targetData;
    else if (targetType === 'International') currentTargetData = internationalTargetData;
    else if (targetType === 'Domestic') currentTargetData = domesticTargetData;
    
    // Calculate achievement for each office in targetData
    const enriched = currentTargetData.map(target => {
      let relevantProducts: string[] = [];
      
      if (targetType === 'Parcel') {
        relevantProducts = PRODUCTS.PARCEL;
      } else if (targetType === 'International') {
        relevantProducts = PRODUCTS.INTERNATIONAL;
      } else if (targetType === 'Domestic') {
        relevantProducts = PRODUCTS.DOMESTIC;
      }

      const normalizedRelevantProducts = relevantProducts.map(p => p.toLowerCase().trim());

      const achievement = data
        .filter(row => 
          row.officeId === target.officeId && 
          normalizedRelevantProducts.includes(row.productName.toLowerCase().trim())
        )
        .reduce((sum, row) => sum + row.totalAmount, 0);

      const percentage = target.totalTarget > 0 ? (achievement / target.totalTarget) * 100 : 0;

      // Find sub division from master data
      const master = masterData.find(m => m.officeId === target.officeId);
      const subDivisionName = master ? master.subDivisionName : 'Unknown';
      const officeType = master ? master.officeType : (target.officeName.toUpperCase().includes('BO') ? 'B.O' : 'P.O');

      return {
        ...target,
        achievement,
        percentage,
        subDivisionName,
        officeType
      };
    });

    // Filter out Unknown sub-divisions and sort by Sub Division Name
    return enriched
      .filter(r => r.subDivisionName !== 'Unknown')
      .sort((a, b) => a.subDivisionName.localeCompare(b.subDivisionName));
  }, [data, targetData, internationalTargetData, domesticTargetData, masterData, targetType]);

  const filteredAchievementData = useMemo(() => {
    if (officeCategory === 'All') return achievementData;
    if (officeCategory === 'Jurisdiction') return achievementData.filter(r => (r as any).officeType === 'P.O');
    if (officeCategory === 'BO') return achievementData.filter(r => (r as any).officeType === 'B.O');
    return achievementData;
  }, [achievementData, officeCategory]);

  const subDivisionSummary = useMemo(() => {
    const summaryMap: Record<string, { target: number, achievement: number }> = {};
    
    // Sub-division summary always includes ALL data regardless of officeCategory filter
    achievementData.forEach(row => {
      if (!summaryMap[row.subDivisionName]) {
        summaryMap[row.subDivisionName] = { target: 0, achievement: 0 };
      }
      summaryMap[row.subDivisionName].target += row.totalTarget;
      summaryMap[row.subDivisionName].achievement += row.achievement;
    });

    return Object.entries(summaryMap)
      .map(([name, stats]) => ({
        name,
        target: stats.target,
        achievement: stats.achievement,
        percentage: stats.target > 0 ? (stats.achievement / stats.target) * 100 : 0
      }))
      .filter(row => row.name !== 'Unknown' || row.target > 0 || row.achievement > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [achievementData]);

  const totals = useMemo(() => {
    const totalTarget = achievementData.reduce((sum, r) => sum + r.totalTarget, 0);
    const totalAchievement = achievementData.reduce((sum, r) => sum + r.achievement, 0);
    const totalPercentage = totalTarget > 0 ? (totalAchievement / totalTarget) * 100 : 0;
    return { totalTarget, totalAchievement, totalPercentage };
  }, [achievementData]);

  const filteredTotals = useMemo(() => {
    const totalTarget = filteredAchievementData.reduce((sum, r) => sum + r.totalTarget, 0);
    const totalAchievement = filteredAchievementData.reduce((sum, r) => sum + r.achievement, 0);
    const totalPercentage = totalTarget > 0 ? (totalAchievement / totalTarget) * 100 : 0;
    return { totalTarget, totalAchievement, totalPercentage };
  }, [filteredAchievementData]);

  const handleExportExcel = () => {
    const exportData = filteredAchievementData.map((r, i) => ({
      'Sl No': i + 1,
      'Name of the Jurisdiction Office': r.officeName,
      'Sub Division': r.subDivisionName,
      'Office ID': r.officeId,
      'Target': r.totalTarget,
      'Achievement': r.achievement,
      '% of Achievement': r.percentage.toFixed(2) + '%'
    }));

    // Add Total row
    exportData.push({
      'Sl No': '',
      'Name of the Jurisdiction Office': 'GRAND TOTAL',
      'Sub Division': '',
      'Office ID': '',
      'Target': filteredTotals.totalTarget,
      'Achievement': filteredTotals.totalAchievement,
      '% of Achievement': filteredTotals.totalPercentage.toFixed(2) + '%'
    } as any);

    exportToExcel(exportData, `${targetType}_${officeCategory}_Target_Achievement_Report`);
  };

  const handleExportPDF = () => {
    const headers = ['Sl No', 'Jurisdiction Office', 'Sub Division', 'Office ID', 'Target', 'Achievement', '% Achievement'];
    const rows = filteredAchievementData.map((r, i) => [
      i + 1,
      r.officeName,
      r.subDivisionName,
      r.officeId,
      formatCurrency(r.totalTarget),
      formatCurrency(r.achievement),
      r.percentage.toFixed(2) + '%'
    ]);

    const footer = [
      '',
      'GRAND TOTAL',
      '',
      '',
      formatCurrency(filteredTotals.totalTarget),
      formatCurrency(filteredTotals.totalAchievement),
      filteredTotals.totalPercentage.toFixed(2) + '%'
    ];

    // Append footer to rows to ensure it's always visible in print
    const rowsWithTotal = [...rows, footer];

    exportToPDF(headers, rowsWithTotal, `${targetType} ${officeCategory} Target Achievement Report`, false);
  };

  const handleExportSubDivisionExcel = () => {
    const exportData = subDivisionSummary.map((r, i) => ({
      'Sl No': i + 1,
      'Name of the Sub-Division': r.name,
      'Target': r.target,
      'Achievement': r.achievement,
      '% of Achievement': r.percentage.toFixed(2) + '%'
    }));

    // Add Total row
    exportData.push({
      'Sl No': '',
      'Name of the Sub-Division': 'TOTAL',
      'Target': totals.totalTarget,
      'Achievement': totals.totalAchievement,
      '% of Achievement': totals.totalPercentage.toFixed(2) + '%'
    } as any);

    exportToExcel(exportData, `SubDivision_${targetType}_Target_Achievement_Report`);
  };

  const handleExportSubDivisionPDF = () => {
    const headers = ['Sl No', 'Sub-Division Name', 'Target', 'Achievement', '% Achievement'];
    const rows = subDivisionSummary.map((r, i) => [
      i + 1,
      r.name,
      formatCurrency(r.target),
      formatCurrency(r.achievement),
      r.percentage.toFixed(2) + '%'
    ]);

    const footer = [
      '',
      'TOTAL',
      formatCurrency(totals.totalTarget),
      formatCurrency(totals.totalAchievement),
      totals.totalPercentage.toFixed(2) + '%'
    ];

    // Append footer to rows to ensure it's always visible in print
    const rowsWithTotal = [...rows, footer];

    exportToPDF(headers, rowsWithTotal, `Sub-Division ${targetType} Target Achievement Report`, false);
  };

  if (targetType === 'Parcel' && targetData.length === 0) {
    return (
      <div className="bg-white p-12 rounded-2xl shadow-md border border-slate-200 text-center space-y-4">
        <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-[#CE2029]">No Parcel Target Data Available</h2>
        <p className="text-slate-500 max-w-md mx-auto">
          Please ensure the Parcel Target Achievement Google Sheet is synced or provided.
        </p>
        <button 
          onClick={onReupload}
          className="px-6 py-2 bg-[#CE2029] text-white rounded-lg font-bold hover:bg-red-700 transition-all shadow-md"
        >
          Back to Upload
        </button>
      </div>
    );
  }

  if (targetType === 'International' && internationalTargetData.length === 0) {
    return (
      <div className="bg-white p-12 rounded-2xl shadow-md border border-slate-200 text-center space-y-4">
        <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-[#CE2029]">No International Target Data Available</h2>
        <p className="text-slate-500 max-w-md mx-auto">
          Please provide the International Mail Target Achievement Google Sheet link.
        </p>
        <button 
          onClick={onReupload}
          className="px-6 py-2 bg-[#CE2029] text-white rounded-lg font-bold hover:bg-red-700 transition-all shadow-md"
        >
          Back to Upload
        </button>
      </div>
    );
  }

  if (targetType === 'Domestic' && domesticTargetData.length === 0) {
    return (
      <div className="bg-white p-12 rounded-2xl shadow-md border border-slate-200 text-center space-y-4">
        <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-[#CE2029]">No Domestic Target Data Available</h2>
        <p className="text-slate-500 max-w-md mx-auto">
          Please provide the Domestic Mail Target Achievement Google Sheet link.
        </p>
        <button 
          onClick={onReupload}
          className="px-6 py-2 bg-[#CE2029] text-white rounded-lg font-bold hover:bg-red-700 transition-all shadow-md"
        >
          Back to Upload
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          className="relative overflow-hidden bg-gradient-to-br from-[#CE2029] to-[#A31920] p-6 rounded-2xl shadow-xl cursor-pointer hover:scale-[1.02] transition-all group border-b-4 border-red-900"
          onClick={() => setShowSubDivisionSummary(!showSubDivisionSummary)}
        >
          <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform">
            <Target size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Total Target</p>
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <Target className="text-white" size={20} />
              </div>
            </div>
            <p className="text-3xl font-black text-white tracking-tight">{formatCurrency(totals.totalTarget)}</p>
            <div className="mt-4 flex items-center gap-2">
              <span className="px-2 py-1 bg-white/20 rounded text-[9px] font-bold text-white uppercase tracking-wider">
                {showSubDivisionSummary ? 'Hide Summary' : 'View Summary'}
              </span>
              <p className="text-[10px] text-white/60 font-medium italic">Click to toggle sub-division view</p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-[#FFD700] to-[#F2C600] p-6 rounded-2xl shadow-xl border-b-4 border-amber-600 group">
          <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform">
            <TrendingUp size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-900/70">Total Achievement</p>
              <div className="p-2 bg-amber-900/10 rounded-lg backdrop-blur-sm">
                <TrendingUp className="text-amber-900" size={20} />
              </div>
            </div>
            <p className="text-3xl font-black text-amber-950 tracking-tight">{formatCurrency(totals.totalAchievement)}</p>
            <div className="mt-4">
              <div className="w-full bg-amber-900/10 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-amber-900 h-full rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(totals.totalPercentage, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-[#1E293B] to-[#0F172A] p-6 rounded-2xl shadow-xl border-b-4 border-slate-950 group">
          <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform">
            <Award size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Overall Achievement %</p>
              <div className="p-2 bg-slate-700 rounded-lg backdrop-blur-sm">
                <Award className="text-amber-400" size={20} />
              </div>
            </div>
            <p className={`text-4xl font-black tracking-tighter ${totals.totalPercentage >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {totals.totalPercentage.toFixed(2)}%
            </p>
            <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-widest">
              {totals.totalPercentage >= 100 ? 'Target Surpassed' : 'Target in Progress'}
            </p>
          </div>
        </div>
      </section>

      {/* Sub-Division Summary Table */}
      {showSubDivisionSummary && (
        <div className="bg-white p-0 rounded-2xl shadow-2xl border-2 border-[#CE2029]/20 overflow-hidden animate-in slide-in-from-top duration-300">
          <div className="bg-gradient-to-r from-[#CE2029] to-[#B31B24] p-6 text-white">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black flex items-center gap-2">
                  <Award className="text-[#FFD700]" /> Sub-Division Wise Target Achievement
                </h3>
                <p className="text-[11px] text-white/70 font-medium uppercase tracking-widest mt-1">Consolidated performance report grouped by Sub-Divisions</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-2 mr-4">
                  <button onClick={handleExportSubDivisionExcel} className="flex items-center gap-2 px-3 py-1.5 bg-white/10 text-white rounded-lg border border-white/20 hover:bg-white/20 transition-all shadow-sm font-bold text-[10px]">
                    <Download size={14} /> EXCEL
                  </button>
                  <button onClick={handleExportSubDivisionPDF} className="flex items-center gap-2 px-3 py-1.5 bg-white/10 text-white rounded-lg border border-white/20 hover:bg-white/20 transition-all shadow-sm font-bold text-[10px]">
                    <Printer size={14} /> PDF
                  </button>
                </div>
                <button 
                  onClick={() => setShowSubDivisionSummary(false)}
                  className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 border-r border-slate-200 text-center w-16">Sl No</th>
                    <th className="px-4 py-3 border-r border-slate-200">Name of the Sub-Division</th>
                    <th className="px-4 py-3 border-r border-slate-200 text-right">Target</th>
                    <th className="px-4 py-3 border-r border-slate-200 text-right">Achievement</th>
                    <th className="px-4 py-3 text-center">% of Achievement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {subDivisionSummary.map((row, idx) => (
                    <tr key={row.name} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-400 font-bold border-r border-slate-100 text-center">{idx + 1}</td>
                      <td className="px-4 py-3 font-black text-slate-800 border-r border-slate-100">{row.name}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-700 border-r border-slate-100">{formatCurrency(row.target)}</td>
                      <td className="px-4 py-3 text-right font-black text-[#CE2029] border-r border-slate-100">{formatCurrency(row.achievement)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2 py-0.5 rounded font-black text-[10px] ${row.percentage >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {row.percentage.toFixed(2)}%
                          </span>
                          <div className="w-20 bg-slate-100 rounded-full h-1 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${row.percentage >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                              style={{ width: `${Math.min(row.percentage, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-900 text-white font-black">
                  <tr>
                    <td colSpan={2} className="px-4 py-4 text-center tracking-widest text-[10px] uppercase">Total</td>
                    <td className="px-4 py-4 text-right">{formatCurrency(totals.totalTarget)}</td>
                    <td className="px-4 py-4 text-right text-[#FFD700]">{formatCurrency(totals.totalAchievement)}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full ${totals.totalPercentage >= 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {totals.totalPercentage.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="bg-white p-0 rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-black text-[#CE2029] flex items-center gap-2">
                <div className="w-8 h-8 bg-[#CE2029] rounded-lg flex items-center justify-center shadow-lg">
                  <Target className="text-white" size={18} />
                </div>
                Target Achievement Sheet
              </h2>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Service Type:</span>
                  <select 
                    value={targetType}
                    onChange={(e) => setTargetType(e.target.value as any)}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm focus:ring-2 focus:ring-[#CE2029] outline-none transition-all"
                  >
                    <option value="Parcel">Parcel Service</option>
                    <option value="International">International Mail Service</option>
                    <option value="Domestic">Domestic Mail Service</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Office Filter:</span>
                  <select 
                    value={officeCategory}
                    onChange={(e) => setOfficeCategory(e.target.value as any)}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm focus:ring-2 focus:ring-[#CE2029] outline-none transition-all"
                  >
                    <option value="All">All Office</option>
                    <option value="Jurisdiction">Only Office Jurisdictions (HOs and SOs)</option>
                    <option value="BO">Only BOs</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-md font-bold text-xs uppercase tracking-widest">
                <Download size={16} /> EXCEL
              </button>
              <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-[#CE2029] text-white rounded-lg hover:bg-red-700 transition-all shadow-md font-bold text-xs uppercase tracking-widest">
                <Printer size={16} /> PRINT PDF
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-900 text-white font-black uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="px-4 py-3 border-r border-slate-800 text-center w-16">Sl No</th>
                  <th className="px-4 py-3 border-r border-slate-800">Name of the Jurisdiction Office</th>
                  <th className="px-4 py-3 border-r border-slate-800">Sub Division Name</th>
                  <th className="px-4 py-3 border-r border-slate-800 text-center">Office ID</th>
                  <th className="px-4 py-3 border-r border-slate-800 text-right">Target</th>
                  <th className="px-4 py-3 border-r border-slate-800 text-right">Achievement</th>
                  <th className="px-4 py-3 text-center">% of Achievement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredAchievementData.map((row, idx) => (
                  <tr key={row.officeId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 font-bold border-r border-slate-100 text-center">{idx + 1}</td>
                    <td className="px-4 py-3 font-black text-slate-800 border-r border-slate-100">{row.officeName}</td>
                    <td className="px-4 py-3 font-medium text-slate-600 border-r border-slate-100">{row.subDivisionName}</td>
                    <td className="px-4 py-3 text-slate-600 border-r border-slate-100 text-center font-mono">{row.officeId}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700 border-r border-slate-100">{formatCurrency(row.totalTarget)}</td>
                    <td className="px-4 py-3 text-right font-black text-[#CE2029] border-r border-slate-100">{formatCurrency(row.achievement)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`px-2 py-0.5 rounded font-black text-[10px] ${row.percentage >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {row.percentage.toFixed(2)}%
                        </span>
                        <div className="w-20 bg-slate-100 rounded-full h-1 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${row.percentage >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(row.percentage, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-900 text-white font-black border-t border-slate-800">
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center tracking-widest text-[10px] uppercase">Grand Totals</td>
                  <td className="px-4 py-4 text-right text-white">{formatCurrency(filteredTotals.totalTarget)}</td>
                  <td className="px-4 py-4 text-right text-[#FFD700]">{formatCurrency(filteredTotals.totalAchievement)}</td>
                  <td className="px-4 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full ${filteredTotals.totalPercentage >= 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {filteredTotals.totalPercentage.toFixed(2)}%
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center p-8 border-t border-slate-100 bg-white rounded-2xl shadow-sm">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mb-2">Performance Tracking • Target vs Achievement</p>
        <p className="text-sm font-bold text-slate-600">
          Prepared by <span className="text-[#CE2029]">Kalandi Charan Sahoo</span>, OA, DO, Dhenkanal
        </p>
      </div>
    </div>
  );
};

export default TargetAchievement;
