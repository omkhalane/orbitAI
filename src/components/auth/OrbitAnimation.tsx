import React from 'react';
import { motion } from 'motion/react';
import { OrbitLogo } from '../common/OrbitLogo.tsx';
import { 
  Mail, 
  Calendar, 
  HardDrive, 
  FileText, 
  CheckSquare, 
  Video, 
  MessageSquare, 
  Database,
  Cloud,
  Layers
} from 'lucide-react';

interface OrbitItem {
  name: string;
  angle: number; // in degrees
  icon: React.ReactNode;
  bg: string;
  textColor: string;
}

export const OrbitAnimation: React.FC = () => {
  // Inner ring items (radius: ~140px)
  const innerRingItems: OrbitItem[] = [
    {
      name: 'Gmail',
      angle: 30,
      icon: <Mail className="w-4 h-4 text-red-500" />,
      bg: 'bg-white shadow-sm border border-red-100',
      textColor: 'text-slate-700',
    },
    {
      name: 'Google Calendar',
      angle: 150,
      icon: <Calendar className="w-4 h-4 text-blue-500" />,
      bg: 'bg-white shadow-sm border border-blue-100',
      textColor: 'text-slate-700',
    },
    {
      name: 'Google Drive',
      angle: 270,
      icon: <HardDrive className="w-4 h-4 text-emerald-500" />,
      bg: 'bg-white shadow-sm border border-emerald-100',
      textColor: 'text-slate-700',
    },
  ];

  // Middle ring items (radius: ~220px)
  const middleRingItems: OrbitItem[] = [
    {
      name: 'Outlook',
      angle: 0,
      icon: <Mail className="w-4 h-4 text-sky-600" />,
      bg: 'bg-white shadow-sm border border-sky-100',
      textColor: 'text-slate-700',
    },
    {
      name: 'Slack',
      angle: 90,
      icon: <MessageSquare className="w-4 h-4 text-purple-600" />,
      bg: 'bg-white shadow-sm border border-purple-100',
      textColor: 'text-slate-700',
    },
    {
      name: 'Google Docs',
      angle: 180,
      icon: <FileText className="w-4 h-4 text-blue-600" />,
      bg: 'bg-white shadow-sm border border-blue-100',
      textColor: 'text-slate-700',
    },
    {
      name: 'Notion',
      angle: 270,
      icon: <Database className="w-4 h-4 text-slate-800" />,
      bg: 'bg-white shadow-sm border border-slate-200',
      textColor: 'text-slate-700',
    },
  ];

  // Outer ring items (radius: ~300px)
  const outerRingItems: OrbitItem[] = [
    {
      name: 'Google Tasks',
      angle: 45,
      icon: <CheckSquare className="w-4 h-4 text-indigo-500" />,
      bg: 'bg-white shadow-sm border border-indigo-100',
      textColor: 'text-slate-700',
    },
    {
      name: 'Google Meet',
      angle: 135,
      icon: <Video className="w-4 h-4 text-teal-600" />,
      bg: 'bg-white shadow-sm border border-teal-100',
      textColor: 'text-slate-700',
    },
    {
      name: 'OneDrive',
      angle: 225,
      icon: <Cloud className="w-4 h-4 text-blue-500" />,
      bg: 'bg-white shadow-sm border border-blue-100',
      textColor: 'text-slate-700',
    },
    {
      name: 'Teams',
      angle: 315,
      icon: <Layers className="w-4 h-4 text-violet-600" />,
      bg: 'bg-white shadow-sm border border-violet-100',
      textColor: 'text-slate-700',
    },
  ];

  return (
    <div className="relative w-full h-full min-h-[500px] flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#faf7f9]/40 via-white to-[#fcf7f9]/60 select-none">
      {/* Background ambient lighting */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-sky-200/20 via-purple-200/25 to-pink-200/20 blur-3xl pointer-events-none" />
      <div className="absolute w-[300px] h-[300px] rounded-full bg-gradient-to-br from-indigo-200/20 via-fuchsia-200/20 to-transparent blur-2xl pointer-events-none" />

      {/* Ring 3 (Outer) */}
      <div className="absolute w-[580px] h-[580px] rounded-full border border-slate-200/60 shadow-[0_0_20px_rgba(200,210,240,0.15)] flex items-center justify-center">
        <motion.div
          className="w-full h-full relative"
          animate={{ rotate: 360 }}
          transition={{ duration: 75, ease: 'linear', repeat: Infinity }}
        >
          {outerRingItems.map((item, idx) => {
            const rad = (item.angle * Math.PI) / 180;
            const radius = 290;
            const x = Math.cos(rad) * radius;
            const y = Math.sin(rad) * radius;

            return (
              <div
                key={idx}
                className="absolute left-1/2 top-1/2 -ml-5 -mt-5"
                style={{ transform: `translate(${x}px, ${y}px)` }}
              >
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 75, ease: 'linear', repeat: Infinity }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full ${item.bg} backdrop-blur-sm shadow-sm transition-all hover:scale-105`}
                >
                  {item.icon}
                  <span className={`text-[11px] font-medium ${item.textColor} whitespace-nowrap`}>
                    {item.name}
                  </span>
                </motion.div>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Ring 2 (Middle) */}
      <div className="absolute w-[440px] h-[440px] rounded-full border border-purple-200/50 flex items-center justify-center">
        <motion.div
          className="w-full h-full relative"
          animate={{ rotate: -360 }}
          transition={{ duration: 52, ease: 'linear', repeat: Infinity }}
        >
          {middleRingItems.map((item, idx) => {
            const rad = (item.angle * Math.PI) / 180;
            const radius = 220;
            const x = Math.cos(rad) * radius;
            const y = Math.sin(rad) * radius;

            return (
              <div
                key={idx}
                className="absolute left-1/2 top-1/2 -ml-5 -mt-5"
                style={{ transform: `translate(${x}px, ${y}px)` }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 52, ease: 'linear', repeat: Infinity }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full ${item.bg} backdrop-blur-sm shadow-sm transition-all hover:scale-105`}
                >
                  {item.icon}
                  <span className={`text-[11px] font-medium ${item.textColor} whitespace-nowrap`}>
                    {item.name}
                  </span>
                </motion.div>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Ring 1 (Inner) */}
      <div className="absolute w-[290px] h-[290px] rounded-full border border-indigo-200/60 flex items-center justify-center">
        <motion.div
          className="w-full h-full relative"
          animate={{ rotate: 360 }}
          transition={{ duration: 38, ease: 'linear', repeat: Infinity }}
        >
          {innerRingItems.map((item, idx) => {
            const rad = (item.angle * Math.PI) / 180;
            const radius = 145;
            const x = Math.cos(rad) * radius;
            const y = Math.sin(rad) * radius;

            return (
              <div
                key={idx}
                className="absolute left-1/2 top-1/2 -ml-5 -mt-5"
                style={{ transform: `translate(${x}px, ${y}px)` }}
              >
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 38, ease: 'linear', repeat: Infinity }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full ${item.bg} backdrop-blur-sm shadow-sm transition-all hover:scale-105`}
                >
                  {item.icon}
                  <span className={`text-[11px] font-medium ${item.textColor} whitespace-nowrap`}>
                    {item.name}
                  </span>
                </motion.div>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Center Dominant Orbit AI Core */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        <motion.div
          animate={{ y: [-4, 4, -4] }}
          transition={{ duration: 6, ease: 'easeInOut', repeat: Infinity }}
          className="p-6 rounded-3xl bg-white/80 backdrop-blur-md border border-purple-100 shadow-[0_12px_40px_rgba(99,102,241,0.12)] flex flex-col items-center"
        >
          <OrbitLogo size="xl" glow={true} />
          <div className="mt-3 text-center">
            <span className="text-xs font-bold tracking-widest text-slate-900 uppercase">ORBIT AI</span>
            <p className="text-[10px] text-slate-400 font-medium">Unified Intelligence</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
