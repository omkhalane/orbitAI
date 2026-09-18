import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { 
  Clock, 
  Plus, 
  Play, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Calendar,
  X,
  Sparkles
} from 'lucide-react';
import type { ScheduledTask } from '../../types/index.ts';

interface ScheduledTasksViewProps {
  onRunInChat?: (prompt: string) => void;
}

export const ScheduledTasksView: React.FC<ScheduledTasksViewProps> = ({ onRunInChat }) => {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newSchedule, setNewSchedule] = useState('Every weekday at 8:00 AM');
  const [creating, setCreating] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);

  const loadTasks = async () => {
    try {
      const res = await api.getScheduledTasks();
      if (res.scheduledTasks) {
        setTasks(res.scheduledTasks);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleToggle = async (task: ScheduledTask) => {
    try {
      const updated = await api.toggleScheduledTask(task.id, !task.enabled);
      if (updated.success) {
        setTasks(prev => prev.map(t => t.id === task.id ? updated.task : t));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteScheduledTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newPrompt.trim()) return;

    setCreating(true);
    try {
      const res = await api.createScheduledTask({
        title: newTitle.trim(),
        prompt: newPrompt.trim(),
        scheduleDescription: newSchedule,
      });
      if (res.success && res.task) {
        setTasks(prev => [res.task, ...prev]);
        setIsModalOpen(false);
        setNewTitle('');
        setNewPrompt('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const handleRunNow = (task: ScheduledTask) => {
    setRunningTaskId(task.id);
    setTimeout(() => {
      setRunningTaskId(null);
      if (onRunInChat) {
        onRunInChat(`[Automated Execution for "${task.title}"]\n${task.prompt}`);
      }
    }, 500);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-10 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-purple-600" />
            Scheduled Workflows
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Automate recurring intelligence reports, morning agendas, and calendar prep briefings.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create Scheduled Task
        </button>
      </div>

      {/* Task List */}
      <div className="mt-8 space-y-4">
        {loading ? (
          <div className="py-12 flex justify-center items-center text-slate-400 text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
            <span>Loading workflows...</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 bg-white">
            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">No scheduled workflows yet</h3>
            <p className="text-xs text-slate-400 mt-1">Set up automated morning executive summaries or weekly agendas.</p>
          </div>
        ) : (
          tasks.map(task => (
            <div
              key={task.id}
              className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-xs hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-sm font-bold text-slate-900">{task.title}</h3>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    task.enabled 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {task.enabled ? 'Active' : 'Paused'}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
                  {task.prompt}
                </p>

                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-purple-500" />
                  <span>{task.scheduleDescription}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleRunNow(task)}
                  disabled={runningTaskId === task.id}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  title="Run now in chat"
                >
                  {runningTaskId === task.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>Run Now</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggle(task)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer"
                >
                  {task.enabled ? 'Pause' : 'Resume'}
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(task.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                  title="Delete scheduled task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">New Scheduled Task</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Task Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Daily Morning Executive Briefing"
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  AI Prompt & Actions
                </label>
                <textarea
                  rows={3}
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  placeholder="e.g. Search Gmail for emails from my manager, review today's calendar meetings, and give me a bulleted executive briefing."
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Schedule Frequency
                </label>
                <select
                  value={newSchedule}
                  onChange={(e) => setNewSchedule(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-purple-500 bg-white"
                >
                  <option value="Every weekday at 8:00 AM">Every weekday at 8:00 AM</option>
                  <option value="Every day at 9:00 AM">Every day at 9:00 AM</option>
                  <option value="Every Friday at 4:30 PM">Every Friday at 4:30 PM</option>
                  <option value="Every Sunday at 8:00 PM">Every Sunday at 8:00 PM</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Workflow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
