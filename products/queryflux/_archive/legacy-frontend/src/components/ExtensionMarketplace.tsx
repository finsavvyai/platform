import { useState, useEffect } from 'react';
import { X, Search, Package, Download, Check, Star, DollarSign, Lock, Unlock } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

interface ExtensionMarketplaceProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Extension {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  author: string;
  icon: string;
  category: string;
  is_free: boolean;
  price: number;
  features: string[];
  permissions: string[];
  install_count: number;
  rating: number;
  is_installed?: boolean;
  is_enabled?: boolean;
}

const CATEGORIES = ['all', 'productivity', 'tools', 'ai', 'development', 'collaboration'];

export function ExtensionMarketplace({ isOpen, onClose }: ExtensionMarketplaceProps) {
  const { theme } = useTheme();
  const { t, direction } = useLanguage();
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [installedExtensions, setInstalledExtensions] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadExtensions();
      loadInstalledExtensions();
    }
  }, [isOpen]);

  const loadExtensions = async () => {
    const { data } = await supabase
      .from('extensions')
      .select('*')
      .eq('is_published', true)
      .order('install_count', { ascending: false });

    if (data) {
      setExtensions(data.map(ext => ({
        ...ext,
        features: ext.features || [],
        permissions: ext.permissions || [],
      })));
    }
  };

  const loadInstalledExtensions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('user_extensions')
      .select('extension_id')
      .eq('user_id', user.id);

    if (data) {
      setInstalledExtensions(new Set(data.map(e => e.extension_id)));
    }
  };

  const handleInstall = async (extension: Extension) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_extensions')
      .insert({
        user_id: user.id,
        extension_id: extension.id,
        is_enabled: true,
        config: {},
      });

    if (!error) {
      await supabase
        .from('extensions')
        .update({ install_count: extension.install_count + 1 })
        .eq('id', extension.id);

      loadInstalledExtensions();
      loadExtensions();
      setSelectedExtension(null);
    }
  };

  const handleUninstall = async (extensionId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_extensions')
      .delete()
      .eq('user_id', user.id)
      .eq('extension_id', extensionId);

    if (!error) {
      loadInstalledExtensions();
      setSelectedExtension(null);
    }
  };

  const filteredExtensions = extensions.filter(ext => {
    const matchesSearch = ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ext.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || ext.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getIconComponent = (iconName: string) => {
    const Icon = (Icons as any)[iconName.split('-').map((word: string) =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('')] || Package;
    return Icon;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}cc` }}>
      <div className="relative w-full max-w-6xl h-[85vh] glass-card rounded-3xl shadow-2xl overflow-hidden flex" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}>
        <div className="flex-1 flex flex-col">
          <div className="flex items-center px-6 py-4 border-b" style={{ borderColor: theme.colors.border, flexDirection: direction === 'rtl' ? 'row-reverse' : 'row', justifyContent: 'space-between' }}>
            <div className="flex items-center gap-3" style={{ flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' }}>
              <Package className="w-6 h-6" style={{ color: theme.colors.accent }} />
              <div style={{ textAlign: direction === 'rtl' ? 'right' : 'left' }}>
                <h2 className="text-xl font-bold" style={{ color: theme.colors.text }}>
                  {t('extensions.marketplace')}
                </h2>
                <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                  {t('extensions.enhance')}
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

          <div className="px-6 py-4 border-b" style={{ borderColor: theme.colors.border }}>
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: theme.colors.textSecondary }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('extensions.searchPlaceholder')}
                  className="w-full pl-10 pr-4 py-2 rounded-lg glass-card border outline-none"
                  style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-3 overflow-x-auto">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                    selectedCategory === cat ? 'text-white' : ''
                  }`}
                  style={{
                    background: selectedCategory === cat
                      ? `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})`
                      : 'transparent',
                    color: selectedCategory === cat ? '#ffffff' : theme.colors.text,
                    border: selectedCategory === cat ? 'none' : `1px solid ${theme.colors.border}`
                  }}
                >
                  {t(`extensions.${cat}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-3 gap-4">
              {filteredExtensions.map((ext) => {
                const isInstalled = installedExtensions.has(ext.id);
                const IconComponent = getIconComponent(ext.icon);

                return (
                  <button
                    key={ext.id}
                    onClick={() => setSelectedExtension(ext)}
                    className="p-4 rounded-xl glass-card border transition-all hover:scale-105 text-left"
                    style={{ borderColor: theme.colors.border }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: theme.colors.accent + '20' }}
                      >
                        <IconComponent className="w-6 h-6" style={{ color: theme.colors.accent }} />
                      </div>
                      {isInstalled && (
                        <div className="px-2 py-1 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#10b981' }}>
                          {t('extensions.installed')}
                        </div>
                      )}
                    </div>

                    <h3 className="font-semibold mb-1 truncate" style={{ color: theme.colors.text }}>
                      {ext.name}
                    </h3>

                    <p className="text-xs mb-2 line-clamp-2" style={{ color: theme.colors.textSecondary }}>
                      {ext.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {ext.is_free ? (
                          <span className="text-xs font-medium" style={{ color: '#10b981' }}>{t('plugins.free')}</span>
                        ) : (
                          <span className="text-xs font-medium flex items-center gap-1" style={{ color: theme.colors.accent }}>
                            <DollarSign className="w-3 h-3" />
                            {ext.price}
                          </span>
                        )}
                        <span className="text-xs flex items-center gap-1" style={{ color: theme.colors.textSecondary }}>
                          <Download className="w-3 h-3" />
                          {ext.install_count}
                        </span>
                      </div>
                      {ext.rating > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-current" style={{ color: '#f59e0b' }} />
                          <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                            {ext.rating}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {filteredExtensions.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-16 h-16 mx-auto mb-3 opacity-50" style={{ color: theme.colors.textSecondary }} />
                <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                  {t('common.search')} - No results
                </p>
              </div>
            )}
          </div>
        </div>

        {selectedExtension && (
          <div className="w-96 border-l flex flex-col" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.background }}>
            <div className="p-6 border-b" style={{ borderColor: theme.colors.border }}>
              <button
                onClick={() => setSelectedExtension(null)}
                className="mb-4 text-sm" style={{ color: theme.colors.textSecondary }}
              >
                ← Back
              </button>

              <div className="flex items-center gap-3 mb-4">
                {(() => {
                  const IconComponent = getIconComponent(selectedExtension.icon);
                  return (
                    <div
                      className="w-16 h-16 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: theme.colors.accent + '20' }}
                    >
                      <IconComponent className="w-8 h-8" style={{ color: theme.colors.accent }} />
                    </div>
                  );
                })()}
                <div className="flex-1">
                  <h3 className="font-bold text-lg" style={{ color: theme.colors.text }}>
                    {selectedExtension.name}
                  </h3>
                  <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                    v{selectedExtension.version} by {selectedExtension.author || 'QueryFlux'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                {selectedExtension.is_free ? (
                  <span className="px-3 py-1 rounded-lg text-sm font-medium" style={{ backgroundColor: '#10b98120', color: '#10b981' }}>
                    {t('plugins.free')}
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-lg text-sm font-medium flex items-center gap-1" style={{ backgroundColor: theme.colors.accent + '20', color: theme.colors.accent }}>
                    <DollarSign className="w-4 h-4" />
                    {selectedExtension.price}
                  </span>
                )}

                <div className="flex items-center gap-3 text-sm" style={{ color: theme.colors.textSecondary }}>
                  <span className="flex items-center gap-1">
                    <Download className="w-4 h-4" />
                    {selectedExtension.install_count}
                  </span>
                  {selectedExtension.rating > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-current" style={{ color: '#f59e0b' }} />
                      {selectedExtension.rating}
                    </span>
                  )}
                </div>
              </div>

              {installedExtensions.has(selectedExtension.id) ? (
                <button
                  onClick={() => handleUninstall(selectedExtension.id)}
                  className="w-full px-4 py-3 rounded-xl font-semibold transition-all border"
                  style={{ borderColor: '#ef4444', color: '#ef4444' }}
                >
                  {t('common.uninstall')}
                </button>
              ) : (
                <button
                  onClick={() => handleInstall(selectedExtension)}
                  className="w-full px-4 py-3 text-white rounded-xl font-semibold transition-all"
                  style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
                >
                  {selectedExtension.is_free ? t('common.install') : `Purchase for $${selectedExtension.price}`}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <h4 className="font-semibold mb-2" style={{ color: theme.colors.text }}>Description</h4>
                <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                  {selectedExtension.description}
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2" style={{ color: theme.colors.text }}>{t('extensions.features')}</h4>
                <ul className="space-y-2">
                  {selectedExtension.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: theme.colors.textSecondary }}>
                      <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2" style={{ color: theme.colors.text }}>{t('extensions.permissions')}</h4>
                <div className="space-y-2">
                  {selectedExtension.permissions.map((permission, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm p-2 rounded-lg glass-card">
                      <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: theme.colors.textSecondary }} />
                      <span style={{ color: theme.colors.textSecondary }}>{permission.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
