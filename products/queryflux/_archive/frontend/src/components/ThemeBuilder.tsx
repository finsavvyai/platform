import { useState, useEffect } from 'react';
import { X, Plus, Eye, Save, Palette, Download, Upload, Shuffle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

interface ThemeBuilderProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CustomTheme {
  id?: string;
  name: string;
  colors: {
    background: string;
    foreground: string;
    sidebar: string;
    border: string;
    accent: string;
    accentHover: string;
    text: string;
    textSecondary: string;
    editorBg: string;
    editorText: string;
  };
  is_public: boolean;
}

export function ThemeBuilder({ isOpen, onClose }: ThemeBuilderProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [themeName, setThemeName] = useState('My Custom Theme');
  const [isPublic, setIsPublic] = useState(false);
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const [previewColors, setPreviewColors] = useState({
    background: '#0a0f1e',
    foreground: '#0f1420',
    sidebar: '#070b16',
    border: '#6366f1',
    accent: '#6366f1',
    accentHover: '#818cf8',
    text: '#e0e7ff',
    textSecondary: '#a5b4fc',
    editorBg: '#0a0f1e',
    editorText: '#e0e7ff',
  });

  useEffect(() => {
    if (isOpen) {
      loadCustomThemes();
    }
  }, [isOpen]);

  const loadCustomThemes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('custom_themes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setCustomThemes(data.map(t => ({
        id: t.id,
        name: t.name,
        colors: t.colors,
        is_public: t.is_public
      })));
    }
  };

  const handleSaveTheme = async () => {
    if (!themeName.trim()) {
      alert('Please enter a theme name');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('You must be logged in to save themes');
      return;
    }

    const { error } = await supabase
      .from('custom_themes')
      .insert({
        user_id: user.id,
        name: themeName,
        colors: previewColors,
        is_public: isPublic,
      });

    if (error) {
      console.error('Error saving theme:', error);
      alert('Failed to save theme: ' + error.message);
    } else {
      alert('Theme saved successfully!');
      loadCustomThemes();
      setThemeName('My Custom Theme');
      setIsPublic(false);
    }
  };

  const handleDeleteTheme = async (id: string) => {
    if (!confirm(t('themeBuilder.deleteTheme'))) return;

    const { error } = await supabase
      .from('custom_themes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting theme:', error);
      alert('Failed to delete theme: ' + error.message);
    } else {
      alert('Theme deleted successfully!');
      loadCustomThemes();
    }
  };

  const handleLoadTheme = (savedTheme: CustomTheme) => {
    setPreviewColors(savedTheme.colors);
    setThemeName(savedTheme.name);
    setIsPublic(savedTheme.is_public);
  };

  const handleExportTheme = () => {
    const themeData = {
      name: themeName,
      colors: previewColors,
      version: '1.0.0',
    };
    const blob = new Blob([JSON.stringify(themeData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${themeName.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportTheme = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (imported.name && imported.colors) {
          setThemeName(imported.name);
          setPreviewColors(imported.colors);
        }
      } catch (error) {
        alert('Invalid theme file');
      }
    };
    reader.readAsText(file);
  };

  const handleRandomize = () => {
    const randomColor = () => {
      const hue = Math.floor(Math.random() * 360);
      const saturation = Math.floor(Math.random() * 40) + 60;
      const lightness = Math.floor(Math.random() * 30) + 10;
      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    };

    const randomAccentColor = () => {
      const hue = Math.floor(Math.random() * 360);
      const saturation = Math.floor(Math.random() * 30) + 70;
      const lightness = Math.floor(Math.random() * 20) + 50;
      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    };

    const randomTextColor = () => {
      const lightness = Math.floor(Math.random() * 15) + 85;
      return `hsl(220, 40%, ${lightness}%)`;
    };

    const accent = randomAccentColor();
    const accentHue = parseInt(accent.match(/\d+/)?.[0] || '0');
    const accentHover = `hsl(${accentHue}, 70%, 65%)`;

    setPreviewColors({
      background: randomColor(),
      foreground: randomColor(),
      sidebar: randomColor(),
      border: accent,
      accent: accent,
      accentHover: accentHover,
      text: randomTextColor(),
      textSecondary: `hsl(220, 40%, 70%)`,
      editorBg: randomColor(),
      editorText: randomTextColor(),
    });

    const themes = ['Cosmic', 'Ocean', 'Sunset', 'Forest', 'Neon', 'Midnight', 'Aurora', 'Desert'];
    setThemeName(`${themes[Math.floor(Math.random() * themes.length)]} Theme`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}cc` }}>
      <div className="relative w-full max-w-4xl glass-card rounded-3xl shadow-2xl overflow-hidden" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center gap-3">
            <Palette className="w-6 h-6" style={{ color: theme.colors.accent }} />
            <div>
              <h2 className="text-xl font-bold" style={{ color: theme.colors.text }}>
                {t('nav.themeBuilder')}
              </h2>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                {t('themeBuilder.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full glass-morphism hover-3d transition-all"
          >
            <X className="w-5 h-5" style={{ color: theme.colors.textSecondary }} />
          </button>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text }}>
                  {t('themeBuilder.themeName')}
                </label>
                <input
                  type="text"
                  value={themeName}
                  onChange={(e) => setThemeName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg glass-card border outline-none"
                  style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                  placeholder={t('themeBuilder.enterThemeName')}
                />
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold" style={{ color: theme.colors.text }}>{t('themeBuilder.colors')}</h3>

                {Object.entries(previewColors).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-3">
                    <input
                      type="color"
                      value={value}
                      onChange={(e) => setPreviewColors({ ...previewColors, [key]: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <div className="flex-1">
                      <label className="text-xs font-medium capitalize" style={{ color: theme.colors.text }}>
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => setPreviewColors({ ...previewColors, [key]: e.target.value })}
                        className="w-full px-2 py-1 text-xs rounded glass-card border outline-none"
                        style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="public"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="public" className="text-sm" style={{ color: theme.colors.text }}>
                  Make this theme public
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleRandomize}
                  className="px-4 py-2 rounded-lg glass-morphism"
                  style={{ color: theme.colors.text }}
                  title="Randomize Theme"
                >
                  <Shuffle className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSaveTheme}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg font-medium"
                  style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
                >
                  <Save className="w-4 h-4" />
                  {t('themeBuilder.saveTheme')}
                </button>
                <button
                  onClick={handleExportTheme}
                  className="px-4 py-2 rounded-lg glass-morphism"
                  style={{ color: theme.colors.text }}
                >
                  <Download className="w-4 h-4" />
                </button>
                <label className="px-4 py-2 rounded-lg glass-morphism cursor-pointer">
                  <Upload className="w-4 h-4" style={{ color: theme.colors.text }} />
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportTheme}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4" style={{ color: theme.colors.textSecondary }} />
                <h3 className="text-sm font-semibold" style={{ color: theme.colors.text }}>{t('themeBuilder.preview')}</h3>
              </div>

              <div
                className="p-6 rounded-xl border-2"
                style={{
                  backgroundColor: previewColors.background,
                  borderColor: previewColors.border
                }}
              >
                <div
                  className="p-4 rounded-lg mb-3"
                  style={{ backgroundColor: previewColors.foreground }}
                >
                  <h4 className="font-bold mb-1" style={{ color: previewColors.text }}>
                    Sample Header
                  </h4>
                  <p className="text-sm" style={{ color: previewColors.textSecondary }}>
                    This is how secondary text looks
                  </p>
                </div>

                <div
                  className="p-4 rounded-lg mb-3"
                  style={{ backgroundColor: previewColors.sidebar }}
                >
                  <p className="text-sm" style={{ color: previewColors.text }}>
                    Sidebar content
                  </p>
                </div>

                <button
                  className="w-full px-4 py-2 rounded-lg text-white font-medium"
                  style={{ backgroundColor: previewColors.accent }}
                >
                  {t('themeBuilder.accentButton')}
                </button>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: theme.colors.text }}>
                  {t('themeBuilder.yourThemes')} ({customThemes.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {customThemes.map((savedTheme) => (
                    <div
                      key={savedTheme.id}
                      className="p-3 rounded-lg glass-card border flex items-center justify-between"
                      style={{ borderColor: theme.colors.border }}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className="w-8 h-8 rounded-full"
                          style={{ backgroundColor: savedTheme.colors.accent }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate" style={{ color: theme.colors.text }}>
                            {savedTheme.name}
                          </p>
                          {savedTheme.is_public && (
                            <p className="text-xs" style={{ color: theme.colors.textSecondary }}>{t('themeBuilder.public')}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleLoadTheme(savedTheme)}
                          className="p-2 rounded-lg hover:bg-white/5 transition-all"
                        >
                          <Eye className="w-4 h-4" style={{ color: theme.colors.textSecondary }} />
                        </button>
                        <button
                          onClick={() => savedTheme.id && handleDeleteTheme(savedTheme.id)}
                          className="p-2 rounded-lg hover:bg-white/5 transition-all"
                        >
                          <X className="w-4 h-4" style={{ color: '#ef4444' }} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {customThemes.length === 0 && (
                    <p className="text-sm text-center py-8" style={{ color: theme.colors.textSecondary }}>
                      No saved themes yet
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
