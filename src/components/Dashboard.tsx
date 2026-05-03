import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GooeyText } from './ui/gooey-text-morphing';
import { InteractiveMenu } from './ui/modern-mobile-menu';
import { GlassButton, GlassFilter } from './ui/liquid-glass';
import { LayeredText } from './ui/layered-text';
import { Camera, Upload, AlertCircle, Cpu, Bug, Activity, Shield, ShoppingCart, Volume2, Clock, MapPin, Search, Thermometer, Droplets, Sun, TrendingUp, Star, MessageSquare, Send, CheckCircle, Database, Minimize2, X, RotateCw, Home, Briefcase, Calendar, Settings } from 'lucide-react';
import { analyseCropImage, generateTreatmentPlan, findNearbySuppliers, generateVoiceReport, AnalysisResult, TreatmentPlan, MarketSupplier } from '../lib/agents';
import { format } from 'date-fns';
import { t } from '../lib/i18n';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const MOCK_YIELD_DATA = [
  { month: 'Jan', index: 85 },
  { month: 'Feb', index: 88 },
  { month: 'Mar', index: 92 },
  { month: 'Apr', index: 90 },
  { month: 'May', index: 95 },
  { month: 'Jun', index: 98 },
];

// Setup file reader as a promise
const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

type ScanRecord = {
    id: string;
    date: string;
    image: string;
    analysis: AnalysisResult;
};

export default function Dashboard() {
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [status, setStatus] = useState<"idle" | "analyzing" | "planning" | "searching" | "complete">("idle");
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [treatment, setTreatment] = useState<TreatmentPlan | null>(null);
    const [suppliers, setSuppliers] = useState<MarketSupplier[]>([]);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [language, setLanguage] = useState<string>("English");
    const [history, setHistory] = useState<ScanRecord[]>([]);
    const [isPrecisionMode, setIsPrecisionMode] = useState<boolean>(false);
    
    // Feedback State
    const [feedbackRating, setFeedbackRating] = useState<number>(0);
    const [feedbackText, setFeedbackText] = useState("");
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Deep Data / Fine-Tuning State
    const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
    const [isFineTuning, setIsFineTuning] = useState(false);
    const [fineTuneProgress, setFineTuneProgress] = useState(0);
    const [fineTuneSuccess, setFineTuneSuccess] = useState(false);
    
    // Weather State
    const [weather, setWeather] = useState<{temp: number, humidity: number, uv: number} | null>(null);
    const [weatherLoading, setWeatherLoading] = useState(true);

    useEffect(() => {
        const saved = localStorage.getItem('agrisense_history');
        if (saved) setHistory(JSON.parse(saved));
        
        // Fetch real-time weather
        const fetchWeather = async (lat: number, lon: number) => {
            try {
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relative_humidity_2m&daily=uv_index_max&timezone=auto`;
                const res = await fetch(url);
                if (!res.ok) throw new Error("Weather request failed");
                const data = await res.json();
                
                // Extract current hour for humidity
                const currentHour = new Date().getHours();
                
                setWeather({
                    temp: data.current_weather.temperature,
                    humidity: data.hourly.relative_humidity_2m[currentHour] || 60,
                    uv: data.daily.uv_index_max[0] || 0
                });
            } catch (err) {
                console.error("Weather fetch error:", err);
                // Fallback realistic mock if API fails
                setWeather({ temp: 28.5, humidity: 65, uv: 7.2 });
            } finally {
                setWeatherLoading(false);
            }
        };

        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
                () => fetchWeather(28.6139, 77.2090) // Fallback coordinates
            );
        } else {
            fetchWeather(28.6139, 77.2090);
        }
    }, []);

    const handleFineTune = () => {
        setIsFineTuning(true);
        setFineTuneProgress(0);
        setFineTuneSuccess(false);

        const interval = setInterval(() => {
            setFineTuneProgress(p => {
                if (p >= 100) {
                    clearInterval(interval);
                    setFineTuneSuccess(true);
                    setTimeout(() => {
                        setIsFineTuning(false);
                    }, 3000);
                    return 100;
                }
                return p + Math.floor(Math.random() * 15) + 5;
            });
        }, 300);
    };

    const saveToHistory = (record: ScanRecord) => {
        const newHistory = [record, ...history].slice(0, 5); // Keep last 5
        setHistory(newHistory);
        localStorage.setItem('agrisense_history', JSON.stringify(newHistory));
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFeedbackRating(0);
        setFeedbackText("");
        setFeedbackSubmitted(false);

        try {
            const base64 = await readFileAsBase64(file);
            setImagePreview(base64);
            setStatus("analyzing");

            // 1. Vision Agent + RAG
            const temperature = isPrecisionMode ? 0.1 : 0.7;
            const analysisResult = await analyseCropImage(base64, language, temperature);
            setAnalysis(analysisResult);

            if (analysisResult.disease_detected) {
                setStatus("planning");
                // 2. Advisory Agent
                const treatmentPlan = await generateTreatmentPlan(analysisResult, language, temperature);
                setTreatment(treatmentPlan);

                // 3. Market Agent
                setStatus("searching");
                const foundSuppliers = await findNearbySuppliers(treatmentPlan.chemical_remedy.product_name || "fungicide", "India", language);
                setSuppliers(foundSuppliers);

                // 4. Voice Agent
                const audio = await generateVoiceReport(analysisResult, treatmentPlan, language);
                setAudioUrl(audio);
                
                // Save History
                saveToHistory({
                    id: Math.random().toString(36).substr(2, 9),
                    date: new Date().toISOString(),
                    image: base64,
                    analysis: analysisResult
                });
            } else {
                 saveToHistory({
                    id: Math.random().toString(36).substr(2, 9),
                    date: new Date().toISOString(),
                    image: base64,
                    analysis: analysisResult
                });
            }

            setStatus("complete");
        } catch (err: any) {
            console.error(err);
            setStatus("idle");
            if (err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED')) {
                alert("API Quota Exceeded. You have reached the rate limit for the Gemini API. Please check your plan and billing details.");
            } else {
                alert("Error processing image. Make sure API keys are set and valid.");
            }
        }
    };

    const getUrgencyColor = (urgency: string) => {
        switch (urgency) {
            case "Critical": return "text-red-500 border-red-500/30 bg-red-500/10";
            case "High": return "text-orange-500 border-orange-500/30 bg-orange-500/10";
            case "Medium": return "text-yellow-500 border-yellow-500/30 bg-yellow-500/10";
            default: return "text-[#D4AF37] border-[#D4AF37]/30 bg-[#D4AF37]/10";
        }
    };

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98, filter: "blur(20px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 min-h-screen flex flex-col p-4 md:p-8 font-sans max-w-7xl mx-auto"
        >
            <GlassFilter />
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                <motion.div initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#D4AF37] rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.4)] relative overflow-hidden group">
                         <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-white/20 z-0"></div>
                        <Bug size={28} className="text-[#050505] relative z-10 transition-transform group-hover:scale-110" />
                    </div>
                    <div className="h-[40px] flex flex-col justify-center">
                        <GooeyText 
                            texts={["AgriSense AI", "Precision", "Pathology", "Global Yield"]} 
                            textClassName="text-2xl md:text-3xl font-serif font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#F8FAFC] to-[#D4AF37] tracking-tight drop-shadow-md pb-1 text-left" 
                            className="justify-start inline-flex items-center" 
                            morphTime={1.5}
                            cooldownTime={3}
                        />
                    </div>
                </motion.div>
                
                <div className="hidden md:block">
                     <InteractiveMenu 
                        items={[
                            { label: 'dashboard', icon: Home },
                            { label: 'reports', icon: Briefcase },
                            { label: 'history', icon: Calendar },
                            { label: 'settings', icon: Settings },
                        ]} 
                    />
                </div>

                <div className="flex flex-wrap gap-4 items-center md:justify-end">
                    <button 
                        onClick={() => setIsPrecisionMode(!isPrecisionMode)}
                        className={`px-4 py-2 text-[10px] uppercase tracking-widest font-mono border rounded backdrop-blur-md outline-none transition-colors flex items-center gap-2 ${isPrecisionMode ? 'border-red-500/50 bg-red-500/10 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'border-[#D4AF37]/20 bg-[#0a0a0c]/80 text-[#D4AF37] hover:border-[#D4AF37]/50'}`}
                    >
                        {isPrecisionMode ? "Precision Mode: ON" : "Precision: OFF"}
                    </button>
                    <select 
                        value={language} 
                        onChange={e => setLanguage(e.target.value)}
                        className="px-4 py-2 text-[10px] uppercase tracking-widest font-mono border border-[#D4AF37]/20 rounded bg-[#0a0a0c]/80 backdrop-blur-md outline-none focus:border-[#D4AF37] appearance-none cursor-pointer text-[#D4AF37]"
                    >
                        <option value="English">English</option>
                        <option value="Telugu">Telugu</option>
                        <option value="Hindi">Hindi</option>
                    </select>
                </div>
            </header>

            <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Left Column: Image Upload & Preview */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        className="luxury-glass rounded-xl p-8 relative overflow-hidden group"
                    >
                        <h2 className="text-[10px] uppercase tracking-widest mb-6 text-[#F8FAFC] flex items-center gap-2 font-mono"><Camera size={18} className="text-[#D4AF37]" /> {t(language, 'scan.title')}</h2>
                        
                        <div className="relative aspect-[4/3] md:aspect-square rounded-3xl overflow-hidden bg-black/40 backdrop-blur-md border border-white/10 hover:border-[#D4AF37]/40 transition-all duration-700 flex items-center justify-center cursor-pointer shadow-[0_8px_32px_rgba(0,0,0,0.4)] w-full" onClick={() => fileInputRef.current?.click()}>
                            {imagePreview ? (
                                <>
                                    <img src={imagePreview} className="w-full h-full object-cover" />
                                    {status !== "idle" && status !== "complete" && (
                                        <div className="absolute inset-0 bg-[#020202]/80 backdrop-blur-[8px] flex items-center justify-center flex-col gap-6 z-20">
                                            <motion.div animate={{ rotate: 360, scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                                                <Cpu className="text-[#D4AF37] w-12 h-12 drop-shadow-[0_0_10px_rgba(212,175,55,0.8)]" />
                                            </motion.div>
                                            <div className="text-center space-y-3">
                                                <p className="font-mono text-[#D4AF37] text-[10px] animate-pulse uppercase tracking-[0.3em]">
                                                    {status === "analyzing" && t(language, 'scan.analyzing')}
                                                    {status === "planning" && t(language, 'scan.planning')}
                                                    {status === "searching" && t(language, 'scan.searching')}
                                                </p>
                                                <div className="w-48 h-1 bg-[#1a1a1a] overflow-hidden rounded mx-auto">
                                                    <motion.div 
                                                        className="h-full bg-gradient-to-r from-[#D4AF37] to-[#FBBF24]"
                                                        initial={{ width: "0%" }}
                                                        animate={{ 
                                                            width: status === "analyzing" ? "30%" : status === "planning" ? "60%" : status === "searching" ? "90%" : "100%" 
                                                        }}
                                                        transition={{ duration: 0.5 }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {/* Scan line effect over image */}
                                    <motion.div 
                                        initial={{ top: "-10%" }}
                                        animate={{ top: "110%" }}
                                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                        className="absolute left-0 right-0 h-[2px] bg-[#D4AF37] shadow-[0_0_20px_#D4AF37] z-10 opacity-80" 
                                    />
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full w-full opacity-50 group-hover:opacity-100 transition-opacity p-4 relative overflow-hidden">
                                    <div className="absolute inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center scale-150">
                                        <LayeredText 
                                            lines={[
                                                { top: "SCAN", bottom: "UPLOAD" },
                                                { top: "UPLOAD", bottom: "DETECT" },
                                                { top: "DETECT", bottom: "YIELD" },
                                            ]}
                                            fontSize="36px"
                                            fontSizeMd="24px"
                                            lineHeight={30}
                                            lineHeightMd={20}
                                        />
                                    </div>
                                    <Upload className="w-8 h-8 mb-4 opacity-80" />
                                    <p className="font-mono text-[10px] uppercase tracking-[0.3em] font-medium text-[#D4AF37] relative z-10">{t(language, 'scan.init')}</p>
                                    <p className="text-[10px] mt-2 opacity-50 font-sans italic relative z-10">{t(language, 'scan.drop')}</p>
                                </div>
                            )}
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                        </div>
                    </motion.div>

                    {/* History Section directly below scan */}
                    {history.length > 0 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-xl p-6">
                            <h2 className="text-[10px] uppercase tracking-widest text-[#94a3b8] flex items-center gap-2 mb-4 font-mono"><Clock size={16} className="text-[#D4AF37]"/> {t(language, 'history.title')}</h2>
                            <div className="space-y-3">
                                {history.map((record, idx) => (
                                    <motion.div 
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                        key={record.id} 
                                        className="bg-[#050505] border border-[#222] rounded-lg p-3 flex gap-3 cursor-pointer hover:border-[#D4AF37]/50 transition-all duration-300 group"
                                        onClick={() => {
                                            setImagePreview(record.image);
                                            setAnalysis(record.analysis);
                                            setTreatment(null);
                                            setSuppliers([]);
                                            setAudioUrl(null);
                                            setFeedbackRating(0);
                                            setFeedbackText("");
                                            setFeedbackSubmitted(false);
                                            setStatus("complete");
                                        }}
                                    >
                                        <img src={record.image} className="w-12 h-12 rounded object-cover border border-[#222] grayscale group-hover:grayscale-0 transition-all duration-500" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-serif text-[#e2e8f0] truncate group-hover:text-[#D4AF37] transition-colors">{record.analysis.disease_name}</p>
                                            <div className="flex justify-between items-center mt-2">
                                                <p className="text-[9px] text-[#64748b] font-mono tracking-widest uppercase">{format(new Date(record.date), 'MMM dd HH:mm')}</p>
                                                <span className={`w-2 h-2 rounded-full shadow-[0_0_5px_currentColor] ${record.analysis.disease_detected ? 'text-red-500 bg-red-500' : 'text-[#D4AF37] bg-[#D4AF37]'}`} />
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Right Column: Analysis & Treatment */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    <AnimatePresence mode="popLayout">
                        {status === "idle" && !imagePreview && (
                            <motion.div 
                                key="idle-state"
                                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                                className="flex flex-col gap-6 h-full"
                            >
                                <div className="h-full min-h-[300px] flex items-center justify-center luxury-glass rounded-xl relative overflow-hidden backdrop-blur-2xl">
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#D4AF37]/10 blur-[100px] rounded-full" />
                                    <div className="text-center opacity-40 z-10 transition-opacity hover:opacity-80 duration-500">
                                        <Shield className="w-16 h-16 mx-auto mb-6 text-[#D4AF37]" strokeWidth={1} />
                                        <h3 className="font-serif italic text-2xl tracking-widest text-[#D4AF37]">{t(language, 'wait.title')}</h3>
                                    </div>
                                </div>
                                
                                {/* New Metrics & Market Feature */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="glass rounded-xl p-8 relative overflow-hidden backdrop-blur-xl border border-white/5 bg-black/40 shadow-[0_8px_32px_rgba(0,0,0,0.4)] group">
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#D4AF37]/5 blur-[120px] rounded-full transition-all duration-700 group-hover:bg-[#D4AF37]/10" />
                                        <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#cbd5e1] mb-6 flex items-center gap-2 relative z-10">
                                            <Activity size={14} className="text-[#D4AF37]"/> {t(language, 'dashboard.metrics')}
                                        </h4>
                                        <div className="space-y-4 relative z-10">
                                            <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                                <span className="flex items-center gap-2 text-sm text-[#94a3b8]"><Thermometer size={14}/> {t(language, 'dashboard.temp')}</span>
                                                <span className="font-mono text-[#D4AF37] font-semibold">
                                                    {weatherLoading ? "..." : `${weather?.temp.toFixed(1)}°C`}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                                <span className="flex items-center gap-2 text-sm text-[#94a3b8]"><Droplets size={14}/> {t(language, 'dashboard.humidity')}</span>
                                                <span className="font-mono text-[#34d399] font-semibold">
                                                    {weatherLoading ? "..." : `${weather?.humidity}%`}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="flex items-center gap-2 text-sm text-[#94a3b8]"><Sun size={14}/> {t(language, 'dashboard.uv')}</span>
                                                <span className={`font-mono font-semibold ${weather && weather.uv > 7 ? 'text-red-400' : 'text-orange-400'}`}>
                                                    {weatherLoading ? "..." : `${weather?.uv! > 7 ? 'High' : weather?.uv! > 3 ? 'Moderate' : 'Low'} (${weather?.uv?.toFixed(1)})`}
                                                </span>
                                            </div>
                                        </div>
                                        {weather && weather.humidity > 70 && weather.temp > 20 && (
                                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-xs text-red-400 font-sans flex gap-3 items-start shadow-inner relative z-10">
                                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                                <p className="leading-relaxed">{t(language, 'dashboard.alert')}</p>
                                            </motion.div>
                                        )}
                                    </div>
                                    <div className="glass rounded-2xl p-8 relative overflow-hidden backdrop-blur-xl border border-white/5 bg-black/40 shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col justify-between group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 blur-[60px] pointer-events-none transition-all duration-700 group-hover:bg-[#D4AF37]/15" />
                                        <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#cbd5e1] mb-2 flex items-center gap-2 relative z-10">
                                            <TrendingUp size={14} className="text-[#D4AF37]"/> {t(language, 'dashboard.market')}
                                        </h4>
                                        <div className="h-40 w-full mt-4 relative z-10 min-w-0 min-h-[160px]">
                                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                                <LineChart data={MOCK_YIELD_DATA}>
                                                    <Line type="basis" dataKey="index" stroke="#D4AF37" strokeWidth={2} dot={{ r: 4, fill: "#000", stroke: "#D4AF37", strokeWidth: 2 }} />
                                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(5,5,5,0.9)', borderColor: 'rgba(212,175,55,0.3)', color: '#D4AF37', fontFamily: 'JetBrains Mono' }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {analysis && (
                            <motion.div 
                                key="analysis-state"
                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                                className="grid grid-cols-1 md:grid-cols-2 gap-6"
                            >
                                {/* Analysis Panel */}
                                <div className="luxury-glass rounded-xl p-8 relative">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 blur-[50px] pointer-events-none" />
                                    
                                    <div className="flex justify-between items-start mb-8">
                                        <h2 className="text-[10px] uppercase tracking-widest text-[#94a3b8] flex items-center gap-2 font-mono"><Activity size={18} className="text-[#D4AF37]"/> {t(language, 'analysis.title')}</h2>
                                        {analysis.disease_detected ? (
                                            <div className={`px-3 py-1 font-mono text-[10px] uppercase tracking-widest border rounded ${getUrgencyColor(analysis.urgency)}`}>
                                                {analysis.urgency} {t(language, 'analysis.threat')}
                                            </div>
                                        ) : (
                                            <div className="px-3 py-1 font-mono text-[10px] uppercase tracking-widest border border-[#D4AF37]/30 text-[#D4AF37] bg-[#D4AF37]/10 rounded">
                                                {t(language, 'analysis.healthy')}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-6">
                                        <div>
                                            <p className="text-[10px] text-[#64748b] uppercase tracking-[0.3em] font-mono mb-2">{t(language, 'analysis.profile')}</p>
                                            <p className="text-3xl font-serif tracking-tight text-[#F8FAFC]">{analysis.disease_name}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-[#050505]/50 p-4 rounded-lg border border-[#D4AF37]/10">
                                                <p className="text-[10px] text-[#64748b] uppercase tracking-[0.3em] font-mono mb-2">{t(language, 'analysis.class')}</p>
                                                <p className="text-sm font-semibold text-[#e2e8f0] font-sans">{analysis.crop_type}</p>
                                            </div>
                                            <div className="bg-[#050505]/50 p-4 rounded-lg border border-[#D4AF37]/10">
                                                <p className="text-[10px] text-[#64748b] uppercase tracking-[0.3em] font-mono mb-2">{t(language, 'analysis.type')}</p>
                                                <p className="text-sm border-l-2 pl-2 border-[#D4AF37] text-[#D4AF37] font-mono">{analysis.issue_type || "Unknown"}</p>
                                            </div>
                                        </div>
                                        {analysis.disease_detected && (
                                            <div>
                                                <p className="text-[10px] text-[#64748b] uppercase tracking-[0.3em] font-mono mb-3">{t(language, 'analysis.symptoms')}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {analysis.visible_symptoms.map((sym, i) => (
                                                        <span key={i} className="text-[10px] bg-[#000] border border-[#222] text-[#cbd5e1] shadow-inner px-3 py-1.5 rounded-md font-medium">{sym}</span>
                                                    ))}
                                                </div>
                                                <button 
                                                    onClick={() => setShowDetailsModal(true)}
                                                    className="mt-6 w-full py-3 bg-[#D4AF37]/5 border border-[#D4AF37]/20 hover:bg-[#D4AF37]/10 transition-colors rounded-lg flex items-center justify-center gap-2 text-xs font-mono tracking-widest text-[#D4AF37] uppercase"
                                                >
                                                    <Database size={14} /> {t(language, 'analysis.modal_details')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Voice Command & Market Panel */}
                                <div className="flex flex-col gap-6">
                                    
                                    {audioUrl && (
                                        <motion.div initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} className="luxury-glass rounded-xl p-6">
                                            <h2 className="text-[10px] uppercase tracking-widest text-[#94a3b8] mb-4 flex items-center gap-2 font-mono"><Volume2 size={16} className="text-[#D4AF37]"/> {t(language, 'audio.title')}</h2>
                                            <audio controls autoPlay className="w-full h-10 custom-audio opacity-90 rounded">
                                                <source src={audioUrl} />
                                            </audio>
                                        </motion.div>
                                    )}

                                    {suppliers.length > 0 && (
                                        <motion.div initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }} className="luxury-glass rounded-xl p-6 flex-1">
                                            <h2 className="text-[10px] uppercase tracking-widest text-[#94a3b8] mb-4 flex items-center gap-2 font-mono"><ShoppingCart size={16} className="text-[#D4AF37]"/> {t(language, 'market.title')}</h2>
                                            <div className="space-y-4">
                                                {suppliers.map((s, i) => (
                                                    <a key={i} href={s.link} target="_blank" rel="noreferrer" className="block bg-[#050505]/50 p-5 rounded-lg border border-[#D4AF37]/10 hover:border-[#D4AF37]/40 transition-colors cursor-pointer group">
                                                        <h4 className="text-[#D4AF37] text-sm font-semibold group-hover:underline truncate font-serif">{s.title}</h4>
                                                        <p className="text-[11px] text-[#94a3b8] mt-2 leading-relaxed line-clamp-2">{s.snippet}</p>
                                                    </a>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {treatment && (
                            <motion.div 
                                key="treatment-state"
                                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                className="luxury-glass rounded-xl p-8 mt-6 relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37]/5 blur-[100px] pointer-events-none" />
                                
                                <div className="flex items-center gap-4 mb-8 relative z-10">
                                    <div className="h-[2px] w-12 bg-gradient-to-r from-[#D4AF37] to-transparent"></div>
                                    <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#F8FAFC] flex items-center gap-2 font-mono">
                                        {t(language, 'treatment.title')}
                                    </h2>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
                                    <div className="space-y-8">
                                        <div>
                                            <p className="text-[10px] text-[#64748b] uppercase tracking-[0.3em] font-mono mb-3">{t(language, 'treatment.immediate')}</p>
                                            <div className="bg-[#D4AF37]/5 border border-[#D4AF37]/20 p-5 rounded-lg text-[#FBBF24] text-sm font-semibold shadow-inner">
                                                {treatment.immediate_action}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-[#64748b] uppercase tracking-[0.3em] font-mono mb-3">{t(language, 'treatment.organic')}</p>
                                            <div className="bg-[#050505]/60 border border-[#D4AF37]/10 p-6 rounded-lg text-sm text-[#e2e8f0]">
                                                <p className="mb-4"><span className="text-[#D4AF37] font-semibold text-xs tracking-widest font-serif">{t(language, 'treatment.method')}</span> <br/><span className="text-[#cbd5e1] leading-relaxed block mt-1">{treatment.organic_remedy.method}</span></p>
                                                <p className="text-xs text-[#F8FAFC] border-left border-l-2 pl-3 border-[#D4AF37]/30 mb-2"><span className="text-[#D4AF37] font-mono opacity-80">{t(language, 'treatment.materials')}</span> <br/> {treatment.organic_remedy.materials.join(", ")}</p>
                                                <p className="text-[10px] text-[#64748b] font-mono uppercase tracking-[0.2em] mt-4 pt-3 border-t border-[#222]">{t(language, 'treatment.freq')} {treatment.organic_remedy.frequency}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-8">
                                         <div>
                                            <p className="text-[10px] text-[#64748b] uppercase tracking-[0.3em] font-mono mb-3">{t(language, 'treatment.chemical')}</p>
                                            <div className="bg-[#050505]/60 border border-[#D4AF37]/10 p-6 rounded-lg text-sm text-[#e2e8f0]">
                                                <p className="font-serif italic text-white text-lg tracking-tight mb-4">{treatment.chemical_remedy.product_name}</p>
                                                <p className="text-xs text-[#F8FAFC] border-l-2 pl-3 border-[#FBBF24]/50 mb-2 py-1 bg-[#FBBF24]/5"><span className="text-[#FBBF24] font-mono opacity-90">{t(language, 'treatment.dosage')}</span> {treatment.chemical_remedy.dosage}</p>
                                                <p className="text-[10px] text-[#64748b] font-mono uppercase tracking-[0.2em] mt-4 pt-3 border-t border-[#222]">{t(language, 'treatment.freq')} {treatment.chemical_remedy.frequency}</p>
                                            </div>
                                        </div>
                                        <div className="bg-[#020202]/80 p-6 rounded-lg border border-[#D4AF37]/10 shadow-inner">
                                            <p className="text-[10px] text-[#64748b] uppercase tracking-[0.3em] font-mono mb-4">{t(language, 'treatment.prevention')}</p>
                                            <ul className="list-square pl-5 text-xs text-[#94a3b8] space-y-3 marker:text-[#D4AF37]">
                                                {treatment.prevention.map((p,i) => <li key={i} className="leading-relaxed">{p}</li>)}
                                            </ul>
                                            {treatment.crop_rotation && treatment.crop_rotation.length > 0 && (
                                                <div className="mt-6 pt-4 border-t border-[#222]">
                                                    <p className="text-[10px] text-[#64748b] uppercase tracking-[0.3em] font-mono mb-3">{t(language, 'treatment.rotation')}</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {treatment.crop_rotation.map((cr, i) => (
                                                            <span key={i} className="text-[10px] bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20 px-3 py-1 rounded">{cr}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Feedback Section */}
                                <div className="mt-10 border-t border-[#D4AF37]/10 pt-8 relative z-10 block">
                                    {!feedbackSubmitted ? (
                                        <div className="bg-[#050505]/40 rounded-xl p-6 border border-[#222]">
                                            <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#cbd5e1] mb-6 flex items-center gap-2">
                                                <MessageSquare size={14} className="text-[#D4AF37]"/> {t(language, 'feedback.title')}
                                            </h3>
                                            <div className="space-y-6">
                                                <div>
                                                    <p className="text-xs text-[#94a3b8] mb-3">{t(language, 'feedback.rating')}</p>
                                                    <div className="flex gap-2">
                                                        {[1, 2, 3, 4, 5].map(star => (
                                                            <button 
                                                                key={star} 
                                                                onClick={() => setFeedbackRating(star)}
                                                                className={`transition-colors duration-300 ${feedbackRating >= star ? 'text-[#D4AF37]' : 'text-[#333] hover:text-[#D4AF37]/50'}`}
                                                            >
                                                                <Star size={24} fill={feedbackRating >= star ? 'currentColor' : 'none'} />
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <textarea 
                                                        value={feedbackText}
                                                        onChange={(e) => setFeedbackText(e.target.value)}
                                                        placeholder={t(language, 'feedback.comments')}
                                                        className="w-full bg-[#020202] border border-[#222] rounded py-3 px-4 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#D4AF37]/50 placeholder-[#444] font-sans resize-none h-24 shadow-inner transition-colors"
                                                    />
                                                </div>
                                                <button 
                                                    onClick={() => {
                                                        if (feedbackRating > 0) setFeedbackSubmitted(true);
                                                    }}
                                                    disabled={feedbackRating === 0}
                                                    className={`px-6 py-2.5 rounded text-[10px] font-mono uppercase tracking-widest flex items-center gap-2 transition-all ${feedbackRating > 0 ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 hover:bg-[#D4AF37]/20 cursor-pointer shadow-[0_0_10px_rgba(212,175,55,0.1)]' : 'bg-[#0a0a0a] text-[#555] border border-[#222] cursor-not-allowed'}`}
                                                >
                                                    <Send size={14} /> {t(language, 'feedback.submit')}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl p-8 text-center shadow-[0_0_20px_rgba(212,175,55,0.1)]">
                                            <CheckCircle className="w-12 h-12 text-[#D4AF37] mx-auto mb-4" />
                                            <p className="text-base font-serif text-[#F8FAFC] tracking-wide">{t(language, 'feedback.success')}</p>
                                        </motion.div>
                                    )}

                                    {/* Fine-Tuning Trigger */}
                                    <div className="mt-6 bg-[#050505]/40 rounded-xl p-6 border border-[#222]">
                                        <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#cbd5e1] mb-2 flex items-center gap-2">
                                            <Cpu size={14} className="text-[#D4AF37]"/> {t(language, 'finetune.title')}
                                        </h3>
                                        <p className="text-xs text-[#64748b] mb-4">Leverage accumulated regional feedback and disease vectors to calibrate neural recognition models for local crop variants.</p>
                                        
                                        {!isFineTuning && !fineTuneSuccess ? (
                                            <div onClick={handleFineTune}>
                                                <GlassButton>
                                                    <div className="flex items-center gap-2">
                                                        <RotateCw size={18} /> 
                                                        <span className="font-mono uppercase tracking-widest text-[#D4AF37] text-xs">
                                                            {t(language, 'finetune.button')}
                                                        </span>
                                                    </div>
                                                </GlassButton>
                                            </div>
                                        ) : isFineTuning ? (
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center text-[10px] font-mono text-[#D4AF37] uppercase tracking-widest">
                                                    <span>{t(language, 'finetune.progress')}</span>
                                                    <span>{fineTuneProgress}%</span>
                                                </div>
                                                <div className="w-full h-1 bg-[#1a1a1a] rounded overflow-hidden">
                                                    <motion.div 
                                                        className="h-full bg-gradient-to-r from-[#D4AF37] to-[#FBBF24]" 
                                                        animate={{ width: `${fineTuneProgress}%` }} 
                                                        transition={{ duration: 0.2 }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 text-[#D4AF37] border border-[#D4AF37]/20 bg-[#D4AF37]/5 px-4 py-3 rounded">
                                                <CheckCircle size={16} />
                                                <span className="text-xs font-mono uppercase tracking-widest">{t(language, 'finetune.success')}</span>
                                            </motion.div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>

            {/* Deep Analysis Modal */}
            <AnimatePresence>
                {showDetailsModal && analysis && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000]/80 backdrop-blur-md"
                        onClick={() => setShowDetailsModal(false)}
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0, y: 20 }} 
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#050505] border border-[#D4AF37]/20 rounded-xl p-8 max-w-2xl w-full relative shadow-[0_0_50px_rgba(212,175,55,0.1)] max-h-[90vh] overflow-y-auto"
                        >
                            <button 
                                onClick={() => setShowDetailsModal(false)}
                                className="absolute top-6 right-6 text-[#64748b] hover:text-[#D4AF37] transition-colors"
                            >
                                <X size={20} />
                            </button>
                            
                            <h3 className="text-2xl font-serif text-[#F8FAFC] mb-2">{analysis.disease_name}</h3>
                            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#D4AF37] mb-8">{t(language, 'analysis.type')}: {analysis.issue_type || 'Unknown'}</p>

                            <div className="space-y-8">
                                <div>
                                    <h4 className="text-[10px] font-mono text-[#64748b] uppercase tracking-widest mb-3 border-b border-[#222] pb-2">{t(language, 'analysis.lifecycle')}</h4>
                                    <p className="text-sm text-[#cbd5e1] leading-relaxed">{analysis.lifecycle || "Life cycle patterns analyzing..."}</p>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-mono text-[#64748b] uppercase tracking-widest mb-3 border-b border-[#222] pb-2">{t(language, 'analysis.geography')}</h4>
                                    <p className="text-sm text-[#cbd5e1] leading-relaxed">{analysis.geography || "Mapping regions..."}</p>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-mono text-[#64748b] uppercase tracking-widest mb-3 border-b border-[#222] pb-2">{t(language, 'analysis.history')}</h4>
                                    <p className="text-sm text-[#cbd5e1] leading-relaxed">{analysis.history || "Compiling chronological data..."}</p>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
