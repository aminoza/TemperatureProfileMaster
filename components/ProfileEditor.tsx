import React, { useState, useMemo } from 'react';
import { TemperatureProfile, ProfileStep, DataPoint } from '../types';
import ProfileChart, { STEP_COLORS } from './ProfileChart';
import { Plus, Save, ArrowLeft, ArrowRight, Clock, Calendar, Trash2, Check, Printer, Download, Loader2, FileText } from 'lucide-react';
import { format, addHours, parseISO } from 'date-fns';
import ExcelJS from 'exceljs';
import saveAs from 'file-saver';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface ProfileEditorProps {
  initialProfile?: TemperatureProfile | null;
  onSave: (profile: TemperatureProfile) => Promise<string | void>;
  onCancel: () => void;
}

// Auto-resizing textarea component using a ghost element for robust dimensions
const AutoResizeTextarea = ({ 
  value, 
  onChange, 
  placeholder, 
  className = "",
}: { 
  value: string; 
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; 
  placeholder?: string; 
  className?: string;
}) => {
  // Increased base font size to text-base
  const baseStyles = "px-3 py-2 text-base font-sans leading-snug";

  return (
    <div className="relative grid w-full h-full min-h-[42px]">
      {/* Ghost element: drives the width and height of the container */}
      <div 
        className={`${className} ${baseStyles} invisible whitespace-pre-wrap break-words overflow-hidden border border-transparent print:visible`}
        aria-hidden="true"
        style={{ gridArea: '1 / 1' }}
      >
        {value || placeholder || " "}
      </div>
      
      {/* Actual interactive textarea */}
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`${className} ${baseStyles} w-full h-full resize-none overflow-hidden print:hidden`}
        style={{ gridArea: '1 / 1' }}
        rows={1}
      />
    </div>
  );
};

const generateId = () => Math.random().toString(36).substr(2, 9);

const ProfileEditor: React.FC<ProfileEditorProps> = ({ initialProfile, onSave, onCancel }) => {
  const [name, setName] = useState(initialProfile?.name || 'New Profile');
  const [startDate, setStartDate] = useState(
    initialProfile?.startDate || new Date().toISOString().slice(0, 16)
  );
  // Keep track of the profile ID locally so we can update it after the first save of a new profile
  const [profileId, setProfileId] = useState<string | undefined>(initialProfile?.id);

  // Initialize steps
  const [steps, setSteps] = useState<ProfileStep[]>(
    initialProfile?.steps?.length 
      ? initialProfile.steps 
      : [{ 
          id: generateId(), 
          type: 'Start', 
          objective: '',
          targetTemp: 25, 
          settingTemp: 25, 
          criteria: '',
          position: 'Inlet', 
          duration: 0, 
          notes: 'Starting profile' 
        }]
  );

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isExporting, setIsExporting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // --- Calculations ---

  const stepsWithCalculations = useMemo(() => {
    let currentTime = new Date(startDate);
    let cumulativeHours = 0;

    return steps.map(step => {
      const start = currentTime;
      const startHours = cumulativeHours; 
      
      const hoursToAdd = (step.type === 'Start' || step.type === 'END' || step.type === 'START') ? 0 : Number(step.duration);
      
      currentTime = addHours(currentTime, hoursToAdd);
      cumulativeHours += hoursToAdd;
      
      const endHours = cumulativeHours; 

      return {
        ...step,
        calculatedStart: start,
        calculatedEnd: currentTime,
        cumulativeHours,
        startHours,
        endHours
      };
    });
  }, [steps, startDate]);

  const chartData: DataPoint[] = useMemo(() => {
    return stepsWithCalculations.map(step => ({
      time: step.cumulativeHours,
      temperature: Number(step.targetTemp)
    }));
  }, [stepsWithCalculations]);

  // Helper to calculate rate
  const getStepRate = (step: ProfileStep, index: number) => {
    if (step.type !== 'RAMP') return null;

    const prevTarget = index > 0 
      ? stepsWithCalculations[index - 1].targetTemp 
      : (step.settingTemp ?? 25);
    
    const durationMins = step.duration * 60;
    
    if (durationMins <= 0) return 'Max';
    
    const diff = Math.abs(step.targetTemp - prevTarget);
    const rate = diff / durationMins;
    
    return rate.toFixed(2);
  };

  // --- Handlers ---

  const handleAddStep = () => {
    const lastStep = steps[steps.length - 1];
    setSteps([
      ...steps,
      {
        id: generateId(),
        type: 'RAMP', // Default next step type
        objective: '',
        targetTemp: lastStep ? lastStep.targetTemp : 25,
        settingTemp: lastStep ? (lastStep.settingTemp ?? lastStep.targetTemp) : 25,
        criteria: '',
        position: 'Inlet',
        duration: 1, // Default duration
        notes: ''
      }
    ]);
  };

  const handleUpdateStep = (id: string, field: keyof ProfileStep, value: any) => {
    setSteps(steps.map(step => 
      step.id === id ? { ...step, [field]: value } : step
    ));
  };

  const handleRemoveStep = (id: string) => {
    if (steps.length <= 1) return; // Prevent deleting the last step
    setSteps(steps.filter(s => s.id !== id));
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const profileToSave: TemperatureProfile = {
        ...initialProfile,
        id: profileId,
        name,
        description: '', 
        startDate,
        steps,
        points: chartData
      };
      
      const newId = await onSave(profileToSave);
      
      if (newId && typeof newId === 'string') {
        setProfileId(newId);
      }
      
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000); 
    } catch (e) {
      console.error(e);
      setSaveStatus('idle');
    }
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - (margin * 2);

      // --- Header ---
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(name, margin, margin + 5);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Start Date: ${format(parseISO(startDate), 'dd/MM/yyyy HH:mm')}`, margin, margin + 12);
      
      let currentY = margin + 20;

      // --- 1. Capture Chart ---
      const chartEl = document.getElementById('profile-chart-container');
      if (chartEl) {
        // Use html2canvas to create an image of the chart
        const canvas = await html2canvas(chartEl, { 
          scale: 2,
          useCORS: true,
          logging: false
        });
        const imgData = canvas.toDataURL('image/png');
        
        // Calculate dimensions to fit width
        const imgProps = doc.getImageProperties(imgData);
        const pdfImgHeight = (imgProps.height * contentWidth) / imgProps.width;
        
        doc.addImage(imgData, 'PNG', margin, currentY, contentWidth, pdfImgHeight);
        currentY += pdfImgHeight + 10;
      }

      // --- 2. Capture Table ---
      // We need to handle the potentially scrolling table.
      // Strategy: Clone the table, expand it to full width off-screen, capture it, then remove.
      const tableWrapper = document.getElementById('details-table-wrapper');
      
      if (tableWrapper) {
        if (currentY + 40 > pageHeight) {
          doc.addPage();
          currentY = margin + 5;
        }

        doc.setFontSize(12);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text("Timeline Details", margin, currentY);
        currentY += 5;

        // Clone the node to manipulate for screenshot
        const originalTable = tableWrapper.querySelector('table');
        if (originalTable) {
          // Create a container that is visible but not affecting layout (to allow html2canvas to render full width)
          const tempContainer = document.createElement('div');
          tempContainer.style.position = 'absolute';
          tempContainer.style.left = '-9999px';
          tempContainer.style.top = '0';
          tempContainer.style.width = 'fit-content'; // Allow it to expand
          tempContainer.style.backgroundColor = '#ffffff';
          document.body.appendChild(tempContainer);

          const clonedTable = originalTable.cloneNode(true) as HTMLElement;
          tempContainer.appendChild(clonedTable);
          
          // Ensure styles that might be lost are applied if necessary (tailwindcss classes usually preserve well)
          // Force black text for PDF clarity
          const allElements = tempContainer.querySelectorAll('*');
          allElements.forEach((el) => {
             if (el instanceof HTMLElement) {
                 el.style.overflow = 'visible';
             }
          });

          // Capture
          const tableCanvas = await html2canvas(tempContainer, { 
            scale: 2,
            backgroundColor: '#ffffff'
          });
          
          // Cleanup
          document.body.removeChild(tempContainer);

          const tableImgData = tableCanvas.toDataURL('image/png');
          const tableImgProps = doc.getImageProperties(tableImgData);
          
          // Determine scale to fit page width
          const tablePdfHeight = (tableImgProps.height * contentWidth) / tableImgProps.width;

          // If table is too tall for remaining page, add new page
          if (currentY + tablePdfHeight > pageHeight - margin) {
             doc.addPage();
             currentY = margin + 10;
             doc.addImage(tableImgData, 'PNG', margin, currentY, contentWidth, tablePdfHeight);
          } else {
             doc.addImage(tableImgData, 'PNG', margin, currentY, contentWidth, tablePdfHeight);
          }
        }
      }

      const fileName = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_profile.pdf`;
      doc.save(fileName);

    } catch (error) {
      console.error("PDF Generation failed:", error);
      alert("Failed to generate PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // 1. Initialize Workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Temperature Profile Master';
      workbook.created = new Date();

      // --- SHEET 1: Timeline Details ---
      const sheet = workbook.addWorksheet('Timeline Details');
      
      // Define Columns
      sheet.columns = [
        { header: 'Step #', key: 'index', width: 8 },
        { header: 'Type', key: 'type', width: 10 },
        { header: 'Objective', key: 'objective', width: 30 },
        { header: 'Setting (°C)', key: 'setting', width: 15 },
        { header: 'Target (°C)', key: 'target', width: 15 },
        { header: 'Rate (°C/min)', key: 'rate', width: 15 }, // Added Rate Column
        { header: 'Criteria', key: 'criteria', width: 20 },
        { header: 'Position', key: 'position', width: 15 },
        { header: 'Duration (h)', key: 'duration', width: 15 },
        { header: 'Start Time', key: 'start', width: 20 },
        { header: 'End Time', key: 'end', width: 20 },
        { header: 'Notes', key: 'notes', width: 35 },
      ];

      // Style Header Row
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' }, // Blue 600
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // Add Data Rows
      stepsWithCalculations.forEach((step, index) => {
        const rate = getStepRate(step, index) || '-';

        const row = sheet.addRow({
          index: index + 1,
          type: step.type,
          objective: step.objective || '-',
          setting: step.settingTemp,
          target: step.targetTemp,
          rate: rate,
          criteria: step.criteria || '-',
          position: step.position || '-',
          duration: step.duration,
          start: format(step.calculatedStart, 'dd/MM/yyyy HH:mm'),
          end: format(step.calculatedEnd, 'dd/MM/yyyy HH:mm'),
          notes: step.notes || '-'
        });

        // Center align numerical/short columns
        [1, 2, 4, 5, 6, 9, 10, 11].forEach(colIdx => {
          row.getCell(colIdx).alignment = { vertical: 'top', horizontal: 'center' };
        });
        // Left align text columns
        [3, 7, 8, 12].forEach(colIdx => {
           row.getCell(colIdx).alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
        });
      });

      // --- SHEET 2: Cycle Visualization (Graph & Data) ---
      const vizSheet = workbook.addWorksheet('Cycle Visualization');
      
      // Capture the Chart
      const chartDom = document.getElementById('profile-chart-container');
      if (chartDom) {
        // Use html2canvas to screenshot the div. 
        // Ensure background is white for clean image.
        const canvas = await html2canvas(chartDom, {
          backgroundColor: '#ffffff',
          scale: 2 // Retain high quality
        });
        const imgData = canvas.toDataURL('image/png');

        // Add Image to Workbook
        const imageId = workbook.addImage({
          base64: imgData,
          extension: 'png',
        });

        // Add header for the Graph section
        vizSheet.mergeCells('A1:E1');
        const titleCell = vizSheet.getCell('A1');
        titleCell.value = 'Temperature Profile Graph';
        titleCell.font = { size: 16, bold: true };
        
        // Place Image
        vizSheet.addImage(imageId, {
          tl: { col: 0, row: 2 }, // Start at A3
          ext: { width: 800, height: 400 }
        });
        
        // --- Add Raw Data Table next to or below graph ---
        // Let's put it starting at row 25 (approx below graph)
        const dataStartRow = 25;
        
        vizSheet.getCell(`A${dataStartRow}`).value = "Raw Cycle Data";
        vizSheet.getCell(`A${dataStartRow}`).font = { bold: true, size: 12 };
        
        vizSheet.getCell(`A${dataStartRow + 1}`).value = "Time (Hours)";
        vizSheet.getCell(`B${dataStartRow + 1}`).value = "Temperature (°C)";
        
        // Style Headers
        const dataHeaderRow = vizSheet.getRow(dataStartRow + 1);
        dataHeaderRow.getCell(1).font = { bold: true };
        dataHeaderRow.getCell(2).font = { bold: true };
        dataHeaderRow.getCell(1).border = { bottom: { style: 'thin' } };
        dataHeaderRow.getCell(2).border = { bottom: { style: 'thin' } };

        chartData.forEach((point, idx) => {
          const r = dataStartRow + 2 + idx;
          vizSheet.getCell(`A${r}`).value = point.time;
          vizSheet.getCell(`B${r}`).value = point.temperature;
        });

        vizSheet.getColumn(1).width = 15;
        vizSheet.getColumn(2).width = 20;
      }

      // 3. Generate and Save File
      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_profile.xlsx`;
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, fileName);

    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export Excel file. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // --- Render ---

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden print:h-auto print:overflow-visible print:bg-white print:block">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 10px;
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
          border: 2px solid #f1f5f9;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        @media print {
          @page { size: landscape; margin: 5mm; }
          
          /* Reset root layout for printing to avoid blank pages */
          html, body, #root {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }
          
          /* Ensure all parent containers are visible */
          .flex-col, .flex-1, .overflow-y-auto {
             display: block !important;
             height: auto !important;
             overflow: visible !important;
          }

          /* Force backgrounds to print */
          * { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }

          /* Hide scrollbars & UI elements */
          ::-webkit-scrollbar { display: none; }
          .print\\:hidden { display: none !important; }

          /* Chart sizing */
          #profile-chart-container {
            break-inside: avoid;
            page-break-inside: avoid;
            margin-bottom: 10px;
          }
          
          /* Ensure table fits */
          table { width: 100% !important; font-size: 10px !important; border-collapse: collapse !important; }
          th, td { padding: 4px !important; border-color: #e5e7eb !important; }
        }
      `}</style>

      {/* Top Header Bar */}
      <div className="bg-white border-b border-gray-200 flex-none z-10 print:border-none print:mb-2">
        <div className="w-full h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 print:h-auto print:px-0 print:block">
          <div className="flex items-center gap-4 print:block">
            <button 
              onClick={onCancel} 
              className="flex items-center gap-2 text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors text-base font-medium print:hidden"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </button>
            <div className="h-6 w-px bg-gray-300 mx-2 hidden sm:block print:hidden"></div>
            <div className="print:mb-1">
              <input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-2xl font-bold text-gray-900 border-none focus:ring-0 p-0 hover:bg-gray-50 rounded px-2 w-48 sm:w-auto print:text-2xl print:px-0 print:w-full"
                placeholder="Profile Name"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 print:mt-1 print:flex-row print:justify-between">
             {/* Global Start Date Picker */}
             <div className="hidden md:flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 print:border-none print:px-0 print:bg-transparent print:flex">
                <Calendar className="w-4 h-4 text-gray-500 print:hidden" />
                <span className="text-sm text-gray-500 font-medium uppercase tracking-wider">Start:</span>
                <input 
                  type="datetime-local" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-none text-base text-gray-700 focus:ring-0 p-0 w-44 print:hidden"
                />
                <span className="hidden print:inline text-base font-medium text-gray-900">
                  {format(parseISO(startDate), 'dd/MM/yyyy HH:mm')}
                </span>
             </div>

            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors print:hidden flex items-center gap-2 disabled:opacity-50"
              title="Download PDF"
            >
              {isGeneratingPdf ? (
                 <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              ) : (
                 <Printer className="w-5 h-5" />
              )}
            </button>
            
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="px-3 py-2 rounded-lg text-green-600 hover:bg-green-50 transition-colors print:hidden flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export to Excel"
            >
              {isExporting ? (
                 <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                 <Download className="w-5 h-5" />
              )}
              <span className="hidden sm:inline text-base font-medium">Export</span>
            </button>

            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className={`
                px-4 py-2 rounded-lg text-base font-medium flex items-center gap-2 transition-colors print:hidden
                ${saveStatus === 'saved' 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'}
              `}
            >
              {saveStatus === 'saving' ? (
                <>Saving...</>
              ) : saveStatus === 'saved' ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span className="hidden sm:inline">Save Profile</span>
                  <span className="sm:hidden">Save</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto print:overflow-visible print:h-auto">
        <div className="w-full p-4 md:p-6 space-y-6 print:p-0 print:space-y-4">
          
          {/* Section 1: Chart */}
          <div 
             id="profile-chart-container" 
             className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 print:border-none print:shadow-none print:p-0 print:break-inside-avoid"
          >
            <div className="flex items-center justify-between mb-4 print:hidden">
              <h3 className="font-bold text-gray-800 text-xl">Cycle Visualization</h3>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                 <span>Step colors correspond to the chart segments</span>
              </div>
            </div>
            <div className="h-[350px] w-full print:h-[400px]">
               <ProfileChart 
                  data={chartData} 
                  steps={stepsWithCalculations}
                  height="100%" 
               />
            </div>
          </div>

          {/* Section 3: Profile Steps Table (Transposed & Editable) */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col print:hidden">
            <div className="p-6 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gray-100 rounded-md">
                  <Clock className="w-5 h-5 text-gray-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">Profile Steps (Editable)</h2>
              </div>
              <button
                onClick={handleAddStep}
                className="bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-md text-base font-medium flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Step
              </button>
            </div>

            <div className="p-6">
              <div className="border border-gray-200 rounded-lg overflow-x-auto bg-white shadow-sm custom-scrollbar">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr>
                       {/* Sticky Property Header */}
                       <th className="sticky left-0 z-20 bg-gray-50 border-b border-r border-gray-200 p-3 text-sm font-bold text-gray-500 uppercase w-48 min-w-[192px] text-left">
                          Property
                       </th>
                       {/* Step Column Headers */}
                       {stepsWithCalculations.map((step, idx) => {
                          const stepColor = STEP_COLORS[idx % STEP_COLORS.length];
                          return (
                            <th key={step.id} className="min-w-[200px] p-0 border-b border-gray-100">
                               <div 
                                  className="h-10 flex items-center justify-center text-sm font-bold text-white uppercase tracking-wide w-full"
                                  style={{ backgroundColor: stepColor }}
                               >
                                 Step {idx + 1}
                               </div>
                            </th>
                          );
                       })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                     
                     {/* Row: Type */}
                     <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 p-3 text-sm font-medium text-gray-600 text-left align-middle">
                           Step Type
                        </th>
                        {stepsWithCalculations.map((step, index) => (
                           <td key={step.id} className="p-3 border-r border-gray-50 align-top">
                              <div className="relative">
                                <select 
                                  value={step.type}
                                  onChange={(e) => handleUpdateStep(step.id, 'type', e.target.value)}
                                  className="appearance-none w-full border border-gray-300 text-gray-700 py-2 px-3 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold bg-white"
                                >
                                  <option value="Start">Start</option>
                                  <option value="RAMP">RAMP</option>
                                  <option value="HOLD">HOLD</option>
                                  <option value="OFF">OFF</option>
                                  <option value="END">END</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                  <ArrowRight className="h-3 w-3 opacity-50" />
                                </div>
                              </div>
                           </td>
                        ))}
                     </tr>

                     {/* Row: Objective */}
                     <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 p-3 text-sm font-medium text-gray-600 text-left align-top">
                           วัตถุประสงค์
                        </th>
                        {stepsWithCalculations.map(step => (
                           <td key={step.id} className="p-2 border-r border-gray-50 align-top">
                              <AutoResizeTextarea
                                value={step.objective || ''}
                                onChange={(e) => handleUpdateStep(step.id, 'objective', e.target.value)}
                                className="border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-700 bg-white"
                                placeholder="-"
                              />
                           </td>
                        ))}
                     </tr>

                     {/* Row: Setting Temp */}
                     <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 p-3 text-sm font-medium text-gray-600 text-left align-middle">
                           Setting (°C)
                        </th>
                        {stepsWithCalculations.map(step => (
                           <td key={step.id} className="p-3 border-r border-gray-50 align-top">
                              <input
                                type="number"
                                value={step.settingTemp ?? ''}
                                onChange={(e) => handleUpdateStep(step.id, 'settingTemp', Number(e.target.value))}
                                className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 font-medium text-center"
                                placeholder="-"
                              />
                           </td>
                        ))}
                     </tr>

                     {/* Row: Target Temp */}
                     <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 p-3 text-sm font-medium text-gray-600 text-left align-middle">
                           Target (°C)
                        </th>
                        {stepsWithCalculations.map(step => (
                           <td key={step.id} className="p-3 border-r border-gray-50 bg-gray-50/30 align-top">
                              <div className="flex items-center justify-center">
                                  <input
                                    type="number"
                                    value={step.targetTemp}
                                    onChange={(e) => handleUpdateStep(step.id, 'targetTemp', Number(e.target.value))}
                                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 font-bold text-center"
                                  />
                              </div>
                           </td>
                        ))}
                     </tr>

                     {/* Row: Heating/Cooling Rate */}
                     <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 p-3 text-sm font-medium text-gray-600 text-left align-middle">
                           Heating/Cooling Rate (°C/min)
                        </th>
                        {stepsWithCalculations.map((step, index) => (
                           <td key={step.id} className="p-3 border-r border-gray-50 align-top text-center">
                              <span className={`text-sm font-medium ${step.type === 'RAMP' ? 'text-blue-600' : 'text-gray-300'}`}>
                                 {getStepRate(step, index) || '-'}
                              </span>
                           </td>
                        ))}
                     </tr>

                     {/* Row: Criteria/Limit */}
                     <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 p-3 text-sm font-medium text-gray-600 text-left align-top">
                           Criteria/Limit
                        </th>
                        {stepsWithCalculations.map(step => (
                           <td key={step.id} className="p-2 border-r border-gray-50 align-top">
                              <AutoResizeTextarea
                                value={step.criteria || ''}
                                onChange={(e) => handleUpdateStep(step.id, 'criteria', e.target.value)}
                                className="border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-700 bg-white"
                                placeholder="-"
                              />
                           </td>
                        ))}
                     </tr>

                     {/* Row: Position */}
                     <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 p-3 text-sm font-medium text-gray-600 text-left align-top">
                           ตำแหน่งของ Sensor
                        </th>
                        {stepsWithCalculations.map(step => (
                           <td key={step.id} className="p-2 border-r border-gray-50 bg-gray-50/30 align-top">
                              <AutoResizeTextarea
                                value={step.position}
                                onChange={(e) => handleUpdateStep(step.id, 'position', e.target.value)}
                                className="border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-700 bg-white"
                              />
                           </td>
                        ))}
                     </tr>

                     {/* Row: Duration */}
                     <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 p-3 text-sm font-medium text-gray-600 text-left align-middle">
                           Duration (h)
                        </th>
                        {stepsWithCalculations.map(step => (
                           <td key={step.id} className="p-3 border-r border-gray-50 align-top">
                              {(step.type !== 'Start' && step.type !== 'START' && step.type !== 'END') ? (
                                <input
                                  type="number"
                                  value={step.duration}
                                  onChange={(e) => handleUpdateStep(step.id, 'duration', Number(e.target.value))}
                                  className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 font-bold text-center"
                                />
                              ) : (
                                <span className="text-gray-400 text-center block py-2">-</span>
                              )}
                           </td>
                        ))}
                     </tr>

                     {/* Row: Start Time (Calculated) */}
                     <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 p-3 text-sm font-medium text-gray-600 text-left align-middle">
                           Start Time (Calc)
                        </th>
                        {stepsWithCalculations.map(step => (
                           <td key={step.id} className="p-3 text-center border-r border-gray-50 align-top">
                              <div className="flex flex-col items-center justify-center h-full">
                                <span className="text-xs text-gray-500">{format(step.calculatedStart, 'dd-MM-yy')}</span>
                                <span className="text-sm font-mono text-gray-800">{format(step.calculatedStart, 'HH:mm')}</span>
                              </div>
                           </td>
                        ))}
                     </tr>

                     {/* Row: End Time (Calculated) */}
                     <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 p-3 text-sm font-medium text-gray-600 text-left align-middle">
                           End Time (Calc)
                        </th>
                        {stepsWithCalculations.map(step => (
                           <td key={step.id} className="p-3 text-center border-r border-gray-50 bg-gray-50/30 align-top">
                              <div className="flex flex-col items-center justify-center h-full">
                                <span className="text-xs text-gray-500">{format(step.calculatedEnd, 'dd-MM-yy')}</span>
                                <span className="text-sm font-mono text-gray-800">{format(step.calculatedEnd, 'HH:mm')}</span>
                              </div>
                           </td>
                        ))}
                     </tr>

                     {/* Row: Notes */}
                     <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 p-3 text-sm font-medium text-gray-600 text-left align-top">
                           Notes
                        </th>
                        {stepsWithCalculations.map(step => (
                           <td key={step.id} className="p-2 border-r border-gray-50 align-top">
                              <AutoResizeTextarea
                                value={step.notes}
                                onChange={(e) => handleUpdateStep(step.id, 'notes', e.target.value)}
                                placeholder={step.type === 'Start' ? "Starting profile" : "Add note.."}
                                className={`border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-700 bg-white ${step.type === 'Start' ? 'text-gray-400 italic' : ''}`}
                              />
                           </td>
                        ))}
                     </tr>

                     {/* Row: Actions */}
                     <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 p-3 text-sm font-medium text-gray-600 text-left align-middle">
                           Actions
                        </th>
                        {stepsWithCalculations.map((step, index) => (
                           <td key={step.id} className="p-3 text-center border-r border-gray-50 align-middle">
                              {index !== 0 && (
                                <button 
                                  onClick={() => handleRemoveStep(step.id)}
                                  className="text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors p-2 rounded-lg"
                                  title="Delete Step"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              )}
                           </td>
                        ))}
                     </tr>

                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 bg-blue-50 rounded-lg p-3 text-sm text-blue-800 border border-blue-100 flex items-start gap-2">
                 <div className="mt-0.5">ℹ️</div>
                 <p>
                   Define your profile by adding steps. The "Timestamp" is calculated automatically based on the Start Date ({format(parseISO(startDate), 'dd/MM/yyyy HH:mm')}) and cumulative duration.
                 </p>
              </div>
            </div>
          </div>

          {/* Section 2: Timeline Details (Table Layout) - Read Only View */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 print:border-none print:shadow-none print:p-0 print:break-inside-avoid">
             <div className="flex items-center justify-between mb-4 print:mb-2">
                <h3 className="font-bold text-gray-800 text-base uppercase tracking-wider">Timeline Details (Preview)</h3>
             </div>
             
             {/* Wrapper matches Profile Steps Table wrapper style */}
             <div id="details-table-wrapper" className="border border-gray-200 rounded-lg overflow-x-auto bg-white shadow-sm custom-scrollbar print:border-none print:shadow-none print:overflow-visible">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr>
                       {/* Sticky Corner Header */}
                       <th className="sticky left-0 z-20 bg-gray-50 border-b border-r border-gray-200 p-3 text-sm font-bold text-gray-500 uppercase w-48 min-w-[192px] text-left print:static print:border-gray-300 print:w-auto print:min-w-0">
                          Step
                       </th>
                       {/* Step Headers */}
                       {stepsWithCalculations.map((step, idx) => {
                          const stepColor = STEP_COLORS[idx % STEP_COLORS.length];
                          return (
                            <th key={step.id} className="min-w-[180px] p-0 border-b border-gray-100 print:border-gray-300 print:min-w-0">
                               <div 
                                  className="h-10 flex items-center justify-center text-sm font-bold text-white uppercase tracking-wide w-full print:text-black print:bg-transparent print:border-b print:border-gray-300 print:h-auto print:py-1"
                                  style={{ backgroundColor: stepColor }}
                               >
                                 Step {idx + 1}
                               </div>
                            </th>
                          );
                       })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 print:divide-gray-200">
                     {/* Row: Objective */}
                     <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 p-3 text-sm font-medium text-gray-600 text-left align-top print:static print:border-gray-300">
                           วัตถุประสงค์
                        </th>
                        {stepsWithCalculations.map(step => (
                           <td key={step.id} className="p-3 text-sm text-gray-700 text-left align-top border-r border-gray-50 whitespace-pre-wrap leading-relaxed print:border-gray-200">
                              {step.objective || '-'}
                           </td>
                        ))}
                     </tr>

                     {/* Row: Note */}
                     <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 p-3 text-sm font-medium text-gray-600 text-left align-top print:static print:border-gray-300">
                           Note
                        </th>
                        {stepsWithCalculations.map(step => (
                           <td key={step.id} className="p-3 text-sm text-gray-500 text-left align-top border-r border-gray-50 whitespace-pre-wrap leading-relaxed bg-gray-50/30 print:bg-transparent print:border-gray-200">
                              {step.notes || '-'}
                           </td>
                        ))}
                     </tr>

                     {/* Row: Setting Temp */}
                     <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 p-3 text-sm font-medium text-gray-600 text-left print:static print:border-gray-300">
                           Setting (°C)
                        </th>
                        {stepsWithCalculations.map(step => (
                           <td key={step.id} className="p-3 text-base font-medium text-gray-800 text-center border-r border-gray-50 print:border-gray-200">
                              {step.settingTemp ?? '-'}
                           </td>
                        ))}
                     </tr>

                     {/* Row: Target Temp */}
                     <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 p-3 text-sm font-medium text-gray-600 text-left print:static print:border-gray-300">
                           Target (°C)
                        </th>
                        {stepsWithCalculations.map(step => (
                           <td key={step.id} className="p-3 text-base font-bold text-gray-800 text-center border-r border-gray-50 bg-gray-50/30 print:bg-transparent print:border-gray-200">
                              {step.targetTemp}
                           </td>
                        ))}
                     </tr>

                     {/* Row: Heating/Cooling Rate */}
                     <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 p-3 text-sm font-medium text-gray-600 text-left print:static print:border-gray-300">
                           Rate (°C/min)
                        </th>
                        {stepsWithCalculations.map((step, index) => (
                           <td key={step.id} className="p-3 text-base text-gray-600 text-center border-r border-gray-50 print:border-gray-200">
                              {getStepRate(step, index) || '-'}
                           </td>
                        ))}
                     </tr>

                     {/* Row: Criteria/Limit */}
                     <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 p-3 text-sm font-medium text-gray-600 text-left align-top print:static print:border-gray-300">
                           Criteria/Limit
                        </th>
                        {stepsWithCalculations.map(step => (
                           <td key={step.id} className="p-3 text-sm text-gray-500 text-left align-top border-r border-gray-50 whitespace-pre-wrap print:border-gray-200">
                              {step.criteria || '-'}
                           </td>
                        ))}
                     </tr>

                     {/* Row: Position */}
                     <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 p-3 text-sm font-medium text-gray-600 text-left align-top print:static print:border-gray-300">
                           ตำแหน่งของ Sensor
                        </th>
                        {stepsWithCalculations.map(step => (
                           <td key={step.id} className="p-3 text-sm text-gray-500 text-left align-top border-r border-gray-50 whitespace-pre-wrap bg-gray-50/30 print:bg-transparent print:border-gray-200">
                              {step.position || '-'}
                           </td>
                        ))}
                     </tr>

                     {/* Row: Start */}
                     <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 p-3 text-sm font-medium text-gray-600 text-left print:static print:border-gray-300">
                           Start
                        </th>
                        {stepsWithCalculations.map(step => (
                           <td key={step.id} className="p-3 text-center border-r border-gray-50 print:border-gray-200">
                              <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-500">{format(step.calculatedStart, 'dd-MM-yy')}</span>
                                <span className="text-sm font-mono text-gray-800">{format(step.calculatedStart, 'HH:mm')}</span>
                              </div>
                           </td>
                        ))}
                     </tr>

                     {/* Row: End */}
                     <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 p-3 text-sm font-medium text-gray-600 text-left print:static print:border-gray-300">
                           End
                        </th>
                        {stepsWithCalculations.map(step => (
                           <td key={step.id} className="p-3 text-center border-r border-gray-50 bg-gray-50/30 print:bg-transparent print:border-gray-200">
                              <div className="flex flex-col items-center">
                                <span className="text-xs text-gray-500">{format(step.calculatedEnd, 'dd-MM-yy')}</span>
                                <span className="text-sm font-mono text-gray-800">{format(step.calculatedEnd, 'HH:mm')}</span>
                              </div>
                           </td>
                        ))}
                     </tr>

                     {/* Row: Duration */}
                     <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 border-r border-gray-200 p-3 text-sm font-medium text-gray-600 text-left print:static print:border-gray-300">
                           Duration (h)
                        </th>
                        {stepsWithCalculations.map(step => (
                           <td key={step.id} className="p-3 text-base font-bold text-gray-800 text-center border-r border-gray-50 print:border-gray-200">
                              {step.duration || 0}
                           </td>
                        ))}
                     </tr>
                  </tbody>
                </table>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProfileEditor;