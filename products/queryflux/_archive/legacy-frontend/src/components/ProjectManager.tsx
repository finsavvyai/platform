import { useState, useEffect } from 'react';
import { Folder, Plus, CreditCard as Edit2, Trash2, X, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

interface Project {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  created_at: string;
  updated_at: string;
}

interface ProjectManagerProps {
  onClose: () => void;
}

const PROJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#10b981', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6366f1'
];

export function ProjectManager({ onClose }: ProjectManagerProps) {
  const { theme } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: PROJECT_COLORS[0],
  });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data && !error) {
      setProjects(data);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: formData.name,
        description: formData.description || null,
        color: formData.color,
      });

    if (!error) {
      setFormData({ name: '', description: '', color: PROJECT_COLORS[0] });
      setIsCreating(false);
      loadProjects();
    }
  };

  const handleUpdate = async (id: string) => {
    if (!formData.name.trim()) return;

    const { error } = await supabase
      .from('projects')
      .update({
        name: formData.name,
        description: formData.description || null,
        color: formData.color,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (!error) {
      setFormData({ name: '', description: '', color: PROJECT_COLORS[0] });
      setEditingId(null);
      loadProjects();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? Connections in this project will be ungrouped.')) return;

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (!error) {
      loadProjects();
    }
  };

  const startEdit = (project: Project) => {
    setEditingId(project.id);
    setFormData({
      name: project.name,
      description: project.description || '',
      color: project.color,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
    setFormData({ name: '', description: '', color: PROJECT_COLORS[0] });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}cc` }}>
      <div className="relative w-full max-w-2xl glass-card rounded-3xl shadow-2xl" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme.colors.border }}>
          <div>
            <h2 className="text-xl font-bold" style={{ color: theme.colors.text }}>
              {t('projects.manage')}
            </h2>
            <p className="text-sm mt-1" style={{ color: theme.colors.textSecondary }}>
              {t('projects.subtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full glass-morphism hover-3d transition-all"
          >
            <X className="w-5 h-5" style={{ color: theme.colors.textSecondary }} />
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <button
            onClick={() => setIsCreating(true)}
            className="w-full mb-4 px-4 py-3 rounded-xl border-2 border-dashed transition-all flex items-center justify-center gap-2"
            style={{
              borderColor: theme.colors.border,
              color: theme.colors.textSecondary,
            }}
          >
            <Plus className="w-5 h-5" />
            {t('projects.createNew')}
          </button>

          {isCreating && (
            <div className="mb-4 p-4 rounded-xl glass-card border" style={{ borderColor: theme.colors.border }}>
              <div className="space-y-3">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Project name"
                  className="w-full px-3 py-2 rounded-lg glass-card border outline-none"
                  style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                  autoFocus
                />
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description (optional)"
                  className="w-full px-3 py-2 rounded-lg glass-card border outline-none"
                  style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                />
                <div>
                  <p className="text-xs mb-2" style={{ color: theme.colors.textSecondary }}>Color</p>
                  <div className="flex gap-2 flex-wrap">
                    {PROJECT_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setFormData({ ...formData, color })}
                        className="w-8 h-8 rounded-full transition-all"
                        style={{
                          backgroundColor: color,
                          border: formData.color === color ? `3px solid ${theme.colors.text}` : 'none',
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreate}
                    className="flex-1 px-4 py-2 rounded-lg text-white font-medium transition-all"
                    style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
                  >
                    Create
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex-1 px-4 py-2 rounded-lg font-medium transition-all"
                    style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {projects.map((project) => (
              <div
                key={project.id}
                className="p-4 rounded-xl glass-card border transition-all"
                style={{ borderColor: theme.colors.border }}
              >
                {editingId === project.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg glass-card border outline-none"
                      style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                    />
                    <input
                      type="text"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Description (optional)"
                      className="w-full px-3 py-2 rounded-lg glass-card border outline-none"
                      style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                    />
                    <div>
                      <p className="text-xs mb-2" style={{ color: theme.colors.textSecondary }}>Color</p>
                      <div className="flex gap-2 flex-wrap">
                        {PROJECT_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setFormData({ ...formData, color })}
                            className="w-8 h-8 rounded-full transition-all"
                            style={{
                              backgroundColor: color,
                              border: formData.color === color ? `3px solid ${theme.colors.text}` : 'none',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(project.id)}
                        className="flex-1 px-4 py-2 rounded-lg text-white font-medium transition-all"
                        style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex-1 px-4 py-2 rounded-lg font-medium transition-all"
                        style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: project.color + '20' }}
                      >
                        <Folder className="w-5 h-5" style={{ color: project.color }} />
                      </div>
                      <div>
                        <h3 className="font-semibold" style={{ color: theme.colors.text }}>
                          {project.name}
                        </h3>
                        {project.description && (
                          <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                            {project.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(project)}
                        className="p-2 rounded-lg glass-morphism hover-3d transition-all"
                      >
                        <Edit2 className="w-4 h-4" style={{ color: theme.colors.textSecondary }} />
                      </button>
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="p-2 rounded-lg glass-morphism hover-3d transition-all"
                      >
                        <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {projects.length === 0 && !isCreating && (
            <div className="text-center py-12">
              <Folder className="w-16 h-16 mx-auto mb-3 opacity-50" style={{ color: theme.colors.textSecondary }} />
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                No projects yet. Create one to get started!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
