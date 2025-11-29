
import React, { useState, useEffect } from 'react';
import { extractEntities } from '../services/geminiService';
import { applyRedaction, calculateLevenshteinDistance, calculateSimilarity, computeWordDiff, detectRegexEntities, mergeEntities } from '../utils/textUtils';
import { DetectedEntity, RedactionMode, ProcessingStats, DiffChunk } from '../types';
import AccuracyMetric from './AccuracyMetric';
import EntityTable from './EntityTable';
import { Upload, RefreshCw, Eye, EyeOff, ShieldCheck, FileText, AlertCircle, FileCheck, Layout, Activity, AlertTriangle, CheckCircle2, ArrowRightLeft, Zap, Target } from 'lucide-react';

const SAMPLE_TEXT = `Subject: Urgent - Account Verification Required

Dear John Smith,

We detected unusual activity on your account from IP address 192.168.1.45 on October 24, 2023 at 14:30 PM.
The login attempt originated from New York, NY.

Please verify your identity by calling (212) 555-0199 or visiting our secure portal at https://secure-bank.com/verify?id=9928.
Do not reply to this email at support@secure-bank.com with your credit card details.

Thank you.`;

type Tab = 'workspace' | 'evaluation';

const RedactionPanel: React.FC = () => {
  // Workspace State
  const [activeTab, setActiveTab] = useState<Tab>('workspace');
  const [inputText, setInputText] = useState<string>(SAMPLE_TEXT);
  const [inputFileName, setInputFileName] = useState<string>('sample_text.txt');
  
  const [redactedText, setRedactedText] = useState<string>('');
  const [entities, setEntities] = useState<DetectedEntity[]>([]);
  const [mode, setMode] = useState<RedactionMode>('MASK');
  const [highAccuracyMode, setHighAccuracyMode] = useState<boolean>(false);
  
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Evaluation State
  const [expectedText, setExpectedText] = useState<string>('');
  const [expectedFileName, setExpectedFileName] = useState<string | null>(null);
  const [comparisonDiff, setComparisonDiff] = useState<{actualChunks: DiffChunk[], expectedChunks: DiffChunk[]} | null>(null);

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>, 
    setText: (s: string) => void,
    setFileName: (s: string) => void
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setText(text);
      };
      reader.readAsText(file);
    }
  };

  const updateStats = (original: string, redacted: string, expected: string, entityCount: number) => {
    const dist = calculateLevenshteinDistance(original, redacted);
    const similarity = calculateSimilarity(original, redacted, dist);
    
    let accuracyScore: number | undefined = undefined;
    if (expected.trim()) {
        const accDist = calculateLevenshteinDistance(expected, redacted);
        accuracyScore = calculateSimilarity(expected, redacted, accDist);
    }

    setStats({
      originalLength: original.length,
      redactedLength: redacted.length,
      levenshteinDistance: dist,
      similarityScore: similarity,
      entityCount: entityCount,
      accuracyScore: accuracyScore
    });
  };

  const processText = async () => {
    if (!inputText.trim()) return;
    
    setIsProcessing(true);
    setProcessingStage('local'); // Stage: Local Regex
    setError(null);
    
    // ---------------------------------------------------------
    // STEP 1: INSTANT LOCAL REDACTION (Regex)
    // ---------------------------------------------------------
    // We run the regex engine locally immediately. This gives the user 
    // instant feedback for structured data (Emails, IPs, Phones, etc.)
    // while the AI processes the harder context-dependent entities.
    
    const regexEntities = detectRegexEntities(inputText);
    
    // Apply and Render immediately (Progressive Rendering)
    const intermediateResult = applyRedaction(inputText, regexEntities, mode);
    setEntities(intermediateResult.entitiesWithIndices);
    setRedactedText(intermediateResult.redactedText);
    updateStats(inputText, intermediateResult.redactedText, expectedText, intermediateResult.entitiesWithIndices.length);

    setProcessingStage('ai'); // Stage: AI Request

    try {
      // ---------------------------------------------------------
      // STEP 2: AI REDACTION (Gemini)
      // ---------------------------------------------------------
      const aiEntities = await extractEntities(inputText, highAccuracyMode);
      
      // ---------------------------------------------------------
      // STEP 3: MERGE & FINALIZE
      // ---------------------------------------------------------
      // We combine the AI's deep understanding with the Regex's precision
      const finalEntities = mergeEntities(aiEntities, regexEntities);
      
      const finalResult = applyRedaction(inputText, finalEntities, mode);
      
      setEntities(finalResult.entitiesWithIndices);
      setRedactedText(finalResult.redactedText);

      updateStats(inputText, finalResult.redactedText, expectedText, finalResult.entitiesWithIndices.length);

    } catch (err) {
      console.error("AI Processing failed", err);
      // We don't clear the text, we just warn. The user still has the Regex redaction!
      setError("AI Service unavailable. Displaying local regex redaction results only.");
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  const runEvaluation = () => {
    if (!redactedText || !expectedText) return;
    updateStats(inputText, redactedText, expectedText, entities.length);
    const diff = computeWordDiff(redactedText, expectedText);
    setComparisonDiff(diff);
  };

  // Re-apply redaction if Mode changes
  useEffect(() => {
    if (entities.length > 0 && !isProcessing) {
      const result = applyRedaction(inputText, entities, mode);
      setRedactedText(result.redactedText);
      updateStats(inputText, result.redactedText, expectedText, entities.length);
      // Reset diff if text changes
      setComparisonDiff(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const renderDiffPanel = (chunks: DiffChunk[], type: 'actual' | 'expected') => {
    return (
      <div className="font-mono text-sm leading-relaxed whitespace-pre-wrap break-words">
        {chunks.map((chunk, idx) => {
           if (chunk.type === 'match') {
             return <span key={idx} className="text-slate-400">{chunk.value}</span>;
           }
           if (type === 'actual' && chunk.type === 'mismatch-actual') {
             return (
               <span key={idx} className="bg-red-900/50 text-red-200 border-b-2 border-red-500 mx-0.5 px-0.5 rounded-sm" title="Mismatch: This text differs from expected output">
                 {chunk.value}
               </span>
             );
           }
           if (type === 'expected' && chunk.type === 'mismatch-expected') {
             return (
                <span key={idx} className="bg-emerald-900/50 text-emerald-200 border-b-2 border-emerald-500 mx-0.5 px-0.5 rounded-sm" title="Expected: This is what should be here">
                  {chunk.value}
                </span>
             );
           }
           return null;
        })}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Navigation Tabs */}
      <div className="flex space-x-1 rounded-xl bg-slate-900/50 p-1 mb-6 border border-slate-800">
        <button
          onClick={() => setActiveTab('workspace')}
          className={`w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all
            ${activeTab === 'workspace' 
              ? 'bg-slate-700 text-white shadow' 
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
        >
          <div className="flex items-center justify-center gap-2">
            <Layout className="w-4 h-4" /> Redaction Workspace
          </div>
        </button>
        <button
          onClick={() => setActiveTab('evaluation')}
          className={`w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all
            ${activeTab === 'evaluation' 
              ? 'bg-indigo-600 text-white shadow' 
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
        >
          <div className="flex items-center justify-center gap-2">
            <Activity className="w-4 h-4" /> Accuracy Evaluation
          </div>
        </button>
      </div>

      {activeTab === 'workspace' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Main Controls */}
            <div className="lg:col-span-2 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex flex-col">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="text-emerald-400" /> Configuration
                </h2>
                
                {/* Accuracy Toggle */}
                <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-700">
                   <button
                     onClick={() => setHighAccuracyMode(!highAccuracyMode)}
                     className={`flex items-center gap-2 text-xs font-bold px-2 py-1 rounded-full transition-all ${highAccuracyMode ? 'text-indigo-400' : 'text-slate-500'}`}
                   >
                     {highAccuracyMode ? <Target className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                     {highAccuracyMode ? 'High Accuracy (Slower)' : 'Standard (Fastest)'}
                   </button>
                   <div 
                      onClick={() => setHighAccuracyMode(!highAccuracyMode)}
                      className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${highAccuracyMode ? 'bg-indigo-600' : 'bg-slate-700'}`}
                   >
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${highAccuracyMode ? 'left-4.5' : 'left-0.5'}`} style={{ left: highAccuracyMode ? '18px' : '2px' }} />
                   </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Redaction Mode</label>
                        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                          <button 
                            onClick={() => setMode('MASK')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${mode === 'MASK' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                          >
                            <Eye className="w-4 h-4" /> Replace
                          </button>
                          <button 
                            onClick={() => setMode('REMOVE')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${mode === 'REMOVE' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                          >
                            <EyeOff className="w-4 h-4" /> Remove
                          </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">Input Source</label>
                        <div className="relative">
                          <input 
                            type="file" 
                            onChange={(e) => handleFileUpload(e, setInputText, setInputFileName)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <div className="flex items-center justify-center gap-2 w-full py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors cursor-pointer group">
                            <Upload className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition-colors" /> <span>Upload Text File</span>
                          </div>
                        </div>
                        {inputFileName && <p className="text-xs text-slate-500 mt-1 truncate">Loaded: {inputFileName}</p>}
                    </div>
                </div>
                
                <div className="space-y-4 flex flex-col justify-end">
                    <button
                        onClick={processText}
                        disabled={isProcessing}
                        className={`w-full py-3 rounded-lg font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all transform hover:scale-[1.01] active:scale-[0.99] 
                        ${isProcessing ? 'bg-slate-700 cursor-wait' : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500'}`}
                    >
                        {isProcessing ? (
                        <>
                            <RefreshCw className="w-5 h-5 animate-spin" /> 
                            {processingStage === 'local' ? 'Running Fast Local Scan...' : 'AI Deep Analysis...'}
                        </>
                        ) : (
                        <>
                            <ShieldCheck className="w-5 h-5" /> Run Redaction Engine
                        </>
                        )}
                    </button>
                </div>
              </div>
              
              {error && (
                <div className="mt-4 p-3 bg-red-900/30 border border-red-800 text-red-200 rounded-lg flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>

            {/* Stats Panel */}
            <div className="lg:col-span-1">
              <AccuracyMetric stats={stats} />
            </div>
          </div>

          {/* Inputs / Outputs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-slate-300 font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Original Text
                </h3>
                <span className="text-xs text-slate-500">{inputText.length} chars</span>
              </div>
              <textarea
                value={inputText}
                onChange={(e) => { setInputText(e.target.value); setInputFileName('Manual Input'); }}
                className="w-full h-80 bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-300 font-mono text-sm leading-relaxed focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none shadow-inner"
                placeholder="Paste text here or upload a file..."
              />
            </div>

            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-2">
                 <h3 className="text-slate-300 font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Redacted Output
                </h3>
                <span className="text-xs text-slate-500">{redactedText.length} chars</span>
              </div>
              <div className="w-full h-80 bg-slate-950 border border-slate-700 rounded-xl p-4 font-mono text-sm leading-relaxed overflow-y-auto shadow-inner whitespace-pre-wrap text-slate-400 relative">
                 {isProcessing && processingStage === 'ai' && (
                    <div className="absolute top-2 right-2 flex items-center gap-2 bg-indigo-900/80 text-indigo-200 text-xs px-2 py-1 rounded backdrop-blur-sm border border-indigo-500/30">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Deep AI Analysis...
                    </div>
                 )}
                 {redactedText ? (
                    redactedText.split(/(\[.*?\])/g).map((part, i) => {
                      if (part.startsWith('[') && part.endsWith(']')) {
                        return <span key={i} className="text-emerald-400 font-bold bg-emerald-950/30 px-1 rounded">{part}</span>;
                      }
                      return part;
                    })
                 ) : (
                   <span className="text-slate-600 italic">Redacted text will appear here...</span>
                 )}
              </div>
            </div>
          </div>
          
          <EntityTable entities={entities} />
        </div>
      )}

      {activeTab === 'evaluation' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
          
          {/* Evaluation Header / Config */}
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
               <Activity className="text-indigo-400" /> Accuracy & Evaluation
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
               {/* Status Card 1 */}
               <div className={`p-4 rounded-lg border flex flex-col justify-between ${inputText ? 'bg-slate-900/50 border-emerald-900/50' : 'bg-slate-900/30 border-slate-800'}`}>
                 <div>
                   <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Step 1: Input Source</span>
                   <div className="flex items-center gap-2 mt-2">
                      <FileText className={inputText ? "text-emerald-400" : "text-slate-600"} />
                      <span className={`font-mono text-sm truncate ${inputText ? "text-slate-200" : "text-slate-500"}`}>
                        {inputText ? inputFileName : "No input loaded"}
                      </span>
                   </div>
                 </div>
                 {inputText && <div className="mt-2 text-xs text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Ready</div>}
               </div>

               {/* Status Card 2 */}
               <div className={`p-4 rounded-lg border flex flex-col justify-between ${redactedText ? 'bg-slate-900/50 border-emerald-900/50' : 'bg-slate-900/30 border-slate-800'}`}>
                 <div>
                   <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Step 2: Redacted Output</span>
                   <div className="flex items-center gap-2 mt-2">
                      <ShieldCheck className={redactedText ? "text-emerald-400" : "text-slate-600"} />
                      <span className={`font-mono text-sm ${redactedText ? "text-slate-200" : "text-slate-500"}`}>
                        {redactedText ? "Generated" : "Not generated yet"}
                      </span>
                   </div>
                 </div>
                 {!redactedText && <div className="mt-2 text-xs text-amber-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Run Redaction in Workspace first</div>}
                 {redactedText && <div className="mt-2 text-xs text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Ready</div>}
               </div>

               {/* Status Card 3 (Action) */}
               <div className={`p-4 rounded-lg border flex flex-col justify-between ${expectedText ? 'bg-slate-900/50 border-indigo-900/50' : 'bg-slate-900/30 border-slate-800'}`}>
                 <div>
                   <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Step 3: Ground Truth</span>
                   <div className="flex items-center gap-2 mt-2">
                      <FileCheck className={expectedText ? "text-indigo-400" : "text-slate-600"} />
                      <span className={`font-mono text-sm truncate ${expectedText ? "text-slate-200" : "text-slate-500"}`}>
                        {expectedText ? expectedFileName : "Upload expected output"}
                      </span>
                   </div>
                 </div>
                 
                 <div className="mt-3">
                   {!expectedText ? (
                      <div className="relative">
                        <input 
                            type="file" 
                            onChange={(e) => handleFileUpload(e, setExpectedText, setExpectedFileName)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <button className="w-full py-1.5 px-3 bg-slate-800 border border-slate-600 rounded text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
                            Upload File
                        </button>
                      </div>
                   ) : (
                       <button onClick={() => {setExpectedText(''); setExpectedFileName(null); setComparisonDiff(null);}} className="text-xs text-red-400 hover:text-red-300 hover:underline">
                           Remove & Upload Different File
                       </button>
                   )}
                 </div>
               </div>
            </div>

            <div className="flex justify-end border-t border-slate-700 pt-6">
                <button
                    onClick={runEvaluation}
                    disabled={!redactedText || !expectedText}
                    className={`px-6 py-2 rounded-lg font-bold text-white shadow-lg flex items-center gap-2 transition-all
                    ${(!redactedText || !expectedText) 
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                        : 'bg-indigo-600 hover:bg-indigo-500'}`}
                >
                    <Activity className="w-4 h-4" /> Test Accuracy
                </button>
            </div>
          </div>

          {/* Results Area */}
          {stats?.accuracyScore !== undefined && comparisonDiff && (
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Score Panel */}
                <div className="lg:col-span-1">
                   <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg h-full flex flex-col items-center justify-center">
                       <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Accuracy Score</h3>
                       <div className="relative flex items-center justify-center w-32 h-32 rounded-full border-8 border-slate-700">
                           <span className="text-3xl font-bold text-white">{stats.accuracyScore.toFixed(1)}%</span>
                           <div 
                              className="absolute inset-0 rounded-full border-8 border-indigo-500"
                              style={{ clipPath: `polygon(0 0, 100% 0, 100% ${stats.accuracyScore}%, 0 ${stats.accuracyScore}%)`}} 
                           ></div>
                       </div>
                       <p className="text-slate-500 text-xs mt-4 text-center">
                           Based on Levenshtein distance between actual and expected output.
                       </p>
                   </div>
                </div>

                {/* Diff View */}
                <div className="lg:col-span-3 bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden flex flex-col">
                    <div className="bg-slate-900/50 p-3 border-b border-slate-700 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                             <ArrowRightLeft className="w-4 h-4" /> Comparison Analysis
                        </h3>
                        <div className="flex gap-4 text-xs">
                             <span className="flex items-center gap-1 text-slate-400"><span className="w-2 h-2 rounded-full bg-slate-500"></span> Match</span>
                             <span className="flex items-center gap-1 text-red-400"><span className="w-2 h-2 rounded-full bg-red-500"></span> Mismatch (Actual)</span>
                             <span className="flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Expected</span>
                        </div>
                    </div>
                    
                    <div className="flex-1 grid grid-cols-2 divide-x divide-slate-700 min-h-[300px]">
                        {/* Actual (Redacted) */}
                        <div className="p-4 bg-slate-900/30 overflow-y-auto max-h-[500px]">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Redacted Output (Actual)</h4>
                            {renderDiffPanel(comparisonDiff.actualChunks, 'actual')}
                        </div>

                        {/* Expected */}
                        <div className="p-4 bg-slate-900/30 overflow-y-auto max-h-[500px]">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Expected Output (Ground Truth)</h4>
                            {renderDiffPanel(comparisonDiff.expectedChunks, 'expected')}
                        </div>
                    </div>
                </div>
             </div>
          )}

          {!comparisonDiff && (
             <div className="flex flex-col items-center justify-center p-12 bg-slate-800/50 border border-slate-700 border-dashed rounded-xl text-slate-500">
                <ArrowRightLeft className="w-12 h-12 mb-4 opacity-50" />
                <p>Run accuracy test to view side-by-side comparison.</p>
             </div>
          )}

        </div>
      )}
    </div>
  );
};

export default RedactionPanel;
